import { SinterCodecError } from "../errors";

type WebpExports = {
  memory: WebAssembly.Memory;
  sinter_webp_malloc(size: number): number;
  sinter_webp_free(ptr: number): void;
  sinter_webp_decode(inputPtr: number, inputLen: number): number;
  sinter_webp_encode(
    rgbaPtr: number,
    rgbaLen: number,
    width: number,
    height: number,
    quality: number,
    lossless: number
  ): number;
  sinter_webp_result_ptr(): number;
  sinter_webp_result_len(): number;
  sinter_webp_result_width(): number;
  sinter_webp_result_height(): number;
  sinter_webp_release_result(): void;
};

type BunLike = {
  file(input: string | URL): {
    arrayBuffer(): Promise<ArrayBuffer>;
  };
};

declare const Bun: BunLike | undefined;

let wasmPromise: Promise<ArrayBuffer> | undefined;

export async function decodeWebp(buffer: ArrayBuffer): Promise<ImageData> {
  const webp = await instantiateWebpModule();
  const input = new Uint8Array(buffer);
  const inputPtr = webp.sinter_webp_malloc(input.byteLength);
  if (inputPtr === 0) {
    throw new SinterCodecError("Failed to decode WebP image: WASM allocation failed.");
  }

  try {
    new Uint8Array(webp.memory.buffer, inputPtr, input.byteLength).set(input);
    if (webp.sinter_webp_decode(inputPtr, input.byteLength) !== 1) {
      throw new SinterCodecError("Failed to decode WebP image: native decoder failed.");
    }

    const ptr = webp.sinter_webp_result_ptr();
    const len = webp.sinter_webp_result_len();
    const width = webp.sinter_webp_result_width();
    const height = webp.sinter_webp_result_height();
    if (ptr === 0 || len !== width * height * 4 || width <= 0 || height <= 0) {
      throw new SinterCodecError("Failed to decode WebP image: invalid native decoder result.");
    }

    const data = new Uint8ClampedArray(new Uint8Array(webp.memory.buffer, ptr, len));
    return new ImageData(data, width, height);
  } finally {
    webp.sinter_webp_free(inputPtr);
    webp.sinter_webp_release_result();
  }
}

export async function encodeWebp(
  imageData: ImageData,
  options: { quality: number; lossless?: boolean }
): Promise<ArrayBuffer> {
  const webp = await instantiateWebpModule();
  const rgba = imageData.data;
  const inputPtr = webp.sinter_webp_malloc(rgba.byteLength);
  if (inputPtr === 0) {
    throw new SinterCodecError("Failed to encode WebP image: WASM allocation failed.");
  }

  try {
    new Uint8Array(webp.memory.buffer, inputPtr, rgba.byteLength).set(rgba);
    if (
      webp.sinter_webp_encode(
        inputPtr,
        rgba.byteLength,
        imageData.width,
        imageData.height,
        clampQuality(options.quality),
        options.lossless ? 1 : 0
      ) !== 1
    ) {
      throw new SinterCodecError("Failed to encode WebP image: native encoder failed.");
    }

    const ptr = webp.sinter_webp_result_ptr();
    const len = webp.sinter_webp_result_len();
    if (ptr === 0 || len <= 0) {
      throw new SinterCodecError("Failed to encode WebP image: invalid native encoder result.");
    }

    return new Uint8Array(webp.memory.buffer, ptr, len).slice().buffer;
  } finally {
    webp.sinter_webp_free(inputPtr);
    webp.sinter_webp_release_result();
  }
}

async function instantiateWebpModule(): Promise<WebpExports> {
  wasmPromise ??= readWebpWasm();
  const wasm = await wasmPromise;
  let memory: WebAssembly.Memory | undefined;
  const wasi = createWasiImports(() => memory);
  const result = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi });
  const exports = result.instance.exports as WebpExports;
  memory = exports.memory;

  if (
    !memory ||
    typeof exports.sinter_webp_decode !== "function" ||
    typeof exports.sinter_webp_encode !== "function"
  ) {
    throw new SinterCodecError("Failed to load WebP codec: invalid WASM exports.");
  }

  return exports;
}

async function readWebpWasm(): Promise<ArrayBuffer> {
  const url = new URL("./webp.wasm", import.meta.url);

  if (typeof Bun !== "undefined") {
    return Bun.file(url).arrayBuffer();
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new SinterCodecError(`Failed to load WebP codec: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

function createWasiImports(getMemory: () => WebAssembly.Memory | undefined) {
  let stderr = "";

  function writeU32(ptr: number, value: number): void {
    const memory = getMemory();
    if (!memory) {
      return;
    }
    new DataView(memory.buffer).setUint32(ptr, value, true);
  }

  return {
    args_get: () => 0,
    args_sizes_get: (argcPtr: number, argvBufSizePtr: number) => {
      writeU32(argcPtr, 0);
      writeU32(argvBufSizePtr, 0);
      return 0;
    },
    clock_time_get: (_id: number, _precision: bigint, timePtr: number) => {
      const memory = getMemory();
      if (memory) {
        new DataView(memory.buffer).setBigUint64(timePtr, BigInt(Date.now()) * 1_000_000n, true);
      }
      return 0;
    },
    environ_get: () => 0,
    environ_sizes_get: (countPtr: number, bufSizePtr: number) => {
      writeU32(countPtr, 0);
      writeU32(bufSizePtr, 0);
      return 0;
    },
    fd_close: () => 0,
    fd_fdstat_get: () => 0,
    fd_prestat_dir_name: () => 0,
    fd_prestat_get: () => 8,
    fd_seek: () => 0,
    fd_write: (fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number) => {
      const memory = getMemory();
      let written = 0;
      if (memory) {
        const bytes = new Uint8Array(memory.buffer);
        const view = new DataView(memory.buffer);
        for (let i = 0; i < iovsLen; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);
          written += len;
          if (fd === 2 && len > 0) {
            stderr += new TextDecoder().decode(bytes.subarray(ptr, ptr + len));
          }
        }
      }
      writeU32(nwrittenPtr, written);
      return 0;
    },
    proc_exit: (code: number) => {
      const message = stderr.trim();
      throw new SinterCodecError(
        `WebP codec exited with code ${code}${message ? `: ${message}` : ""}.`
      );
    },
    random_get: (ptr: number, len: number) => {
      const memory = getMemory();
      if (memory) {
        crypto.getRandomValues(new Uint8Array(memory.buffer, ptr, len));
      }
      return 0;
    },
    sched_yield: () => 0,
  };
}

function clampQuality(quality: number): number {
  return Math.max(1, Math.min(100, Math.round(quality)));
}
