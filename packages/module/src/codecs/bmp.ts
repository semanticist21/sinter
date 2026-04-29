import { SinterCodecError } from "../errors";

type BmpExports = {
  memory: WebAssembly.Memory;
  sinter_bmp_malloc(size: number): number;
  sinter_bmp_free(ptr: number, capacity: number): void;
  sinter_bmp_decode(inputPtr: number, inputLen: number): number;
  sinter_bmp_encode(rgbaPtr: number, rgbaLen: number, width: number, height: number): number;
  sinter_bmp_result_ptr(): number;
  sinter_bmp_result_len(): number;
  sinter_bmp_result_width(): number;
  sinter_bmp_result_height(): number;
  sinter_bmp_release_result(): void;
};

type BunLike = {
  file(input: string | URL): {
    arrayBuffer(): Promise<ArrayBuffer>;
  };
};

declare const Bun: BunLike | undefined;

let wasmPromise: Promise<ArrayBuffer> | undefined;

export async function decodeBmp(buffer: ArrayBuffer): Promise<ImageData> {
  const bmp = await instantiateBmpModule();
  const input = new Uint8Array(buffer);
  const inputPtr = bmp.sinter_bmp_malloc(input.byteLength);
  if (inputPtr === 0) {
    throw new SinterCodecError("Failed to decode BMP image: WASM allocation failed.");
  }

  try {
    new Uint8Array(bmp.memory.buffer, inputPtr, input.byteLength).set(input);
    if (bmp.sinter_bmp_decode(inputPtr, input.byteLength) !== 1) {
      throw new SinterCodecError("Failed to decode BMP image: native decoder failed.");
    }

    const ptr = bmp.sinter_bmp_result_ptr();
    const len = bmp.sinter_bmp_result_len();
    const width = bmp.sinter_bmp_result_width();
    const height = bmp.sinter_bmp_result_height();
    if (ptr === 0 || len !== width * height * 4 || width <= 0 || height <= 0) {
      throw new SinterCodecError("Failed to decode BMP image: invalid native decoder result.");
    }

    const data = new Uint8ClampedArray(new Uint8Array(bmp.memory.buffer, ptr, len));
    return new ImageData(data, width, height);
  } finally {
    bmp.sinter_bmp_free(inputPtr, input.byteLength);
    bmp.sinter_bmp_release_result();
  }
}

export async function encodeBmp(imageData: ImageData): Promise<ArrayBuffer> {
  const bmp = await instantiateBmpModule();
  const rgba = imageData.data;
  const inputPtr = bmp.sinter_bmp_malloc(rgba.byteLength);
  if (inputPtr === 0) {
    throw new SinterCodecError("Failed to encode BMP image: WASM allocation failed.");
  }

  try {
    new Uint8Array(bmp.memory.buffer, inputPtr, rgba.byteLength).set(rgba);
    if (bmp.sinter_bmp_encode(inputPtr, rgba.byteLength, imageData.width, imageData.height) !== 1) {
      throw new SinterCodecError("Failed to encode BMP image: native encoder failed.");
    }

    const ptr = bmp.sinter_bmp_result_ptr();
    const len = bmp.sinter_bmp_result_len();
    if (ptr === 0 || len <= 0) {
      throw new SinterCodecError("Failed to encode BMP image: invalid native encoder result.");
    }

    return new Uint8Array(bmp.memory.buffer, ptr, len).slice().buffer;
  } finally {
    bmp.sinter_bmp_free(inputPtr, rgba.byteLength);
    bmp.sinter_bmp_release_result();
  }
}

async function instantiateBmpModule(): Promise<BmpExports> {
  wasmPromise ??= readBmpWasm();
  const wasm = await wasmPromise;
  let memory: WebAssembly.Memory | undefined;
  const wasi = createWasiImports(() => memory);
  const result = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi });
  const exports = result.instance.exports as BmpExports;
  memory = exports.memory;

  if (
    !memory ||
    typeof exports.sinter_bmp_decode !== "function" ||
    typeof exports.sinter_bmp_encode !== "function"
  ) {
    throw new SinterCodecError("Failed to load BMP codec: invalid WASM exports.");
  }

  return exports;
}

async function readBmpWasm(): Promise<ArrayBuffer> {
  const url = new URL("./bmp.wasm", import.meta.url);

  if (typeof Bun !== "undefined") {
    return Bun.file(url).arrayBuffer();
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new SinterCodecError(`Failed to load BMP codec: ${response.statusText}`);
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
        `BMP codec exited with code ${code}${message ? `: ${message}` : ""}.`
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
