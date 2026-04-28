import { SinterCodecError } from "../errors";

type JpegExports = {
  memory: WebAssembly.Memory;
  sinter_jpeg_malloc(size: number): number;
  sinter_jpeg_free(ptr: number): void;
  sinter_jpeg_decode(inputPtr: number, inputLen: number): number;
  sinter_jpeg_encode(
    rgbaPtr: number,
    width: number,
    height: number,
    quality: number,
    progressive: number
  ): number;
  sinter_jpeg_result_ptr(): number;
  sinter_jpeg_result_len(): number;
  sinter_jpeg_result_width(): number;
  sinter_jpeg_result_height(): number;
  sinter_jpeg_release_result(): void;
};

type BunLike = {
  file(input: string | URL): {
    arrayBuffer(): Promise<ArrayBuffer>;
  };
};

declare const Bun: BunLike | undefined;

let wasmPromise: Promise<ArrayBuffer> | undefined;

export async function decodeJpeg(buffer: ArrayBuffer): Promise<ImageData> {
  if (!hasJpegEndMarker(new Uint8Array(buffer))) {
    throw new SinterCodecError("Failed to decode JPEG image: missing end marker.");
  }

  const jpeg = await loadJpegModule();
  const input = new Uint8Array(buffer);
  const inputPtr = jpeg.sinter_jpeg_malloc(input.byteLength);
  if (inputPtr === 0) {
    throw new SinterCodecError("Failed to decode JPEG image: WASM allocation failed.");
  }

  try {
    new Uint8Array(jpeg.memory.buffer, inputPtr, input.byteLength).set(input);
    if (jpeg.sinter_jpeg_decode(inputPtr, input.byteLength) !== 1) {
      throw new SinterCodecError("Failed to decode JPEG image: native decoder failed.");
    }

    const ptr = jpeg.sinter_jpeg_result_ptr();
    const len = jpeg.sinter_jpeg_result_len();
    const width = jpeg.sinter_jpeg_result_width();
    const height = jpeg.sinter_jpeg_result_height();
    if (ptr === 0 || len !== width * height * 4 || width <= 0 || height <= 0) {
      throw new SinterCodecError("Failed to decode JPEG image: invalid native decoder result.");
    }

    const data = new Uint8ClampedArray(new Uint8Array(jpeg.memory.buffer, ptr, len));
    return new ImageData(data, width, height);
  } finally {
    jpeg.sinter_jpeg_free(inputPtr);
    jpeg.sinter_jpeg_release_result();
  }
}

export async function encodeJpeg(
  imageData: ImageData,
  options: { quality: number; progressive?: boolean }
): Promise<ArrayBuffer> {
  const jpeg = await loadJpegModule();
  const rgba = imageData.data;
  const inputPtr = jpeg.sinter_jpeg_malloc(rgba.byteLength);
  if (inputPtr === 0) {
    throw new SinterCodecError("Failed to encode JPEG image: WASM allocation failed.");
  }

  try {
    new Uint8Array(jpeg.memory.buffer, inputPtr, rgba.byteLength).set(rgba);
    if (
      jpeg.sinter_jpeg_encode(
        inputPtr,
        imageData.width,
        imageData.height,
        clampQuality(options.quality),
        options.progressive ? 1 : 0
      ) !== 1
    ) {
      throw new SinterCodecError("Failed to encode JPEG image: native encoder failed.");
    }

    const ptr = jpeg.sinter_jpeg_result_ptr();
    const len = jpeg.sinter_jpeg_result_len();
    if (ptr === 0 || len <= 0) {
      throw new SinterCodecError("Failed to encode JPEG image: invalid native encoder result.");
    }

    return new Uint8Array(jpeg.memory.buffer, ptr, len).slice().buffer;
  } finally {
    jpeg.sinter_jpeg_free(inputPtr);
    jpeg.sinter_jpeg_release_result();
  }
}

async function loadJpegModule(): Promise<JpegExports> {
  return instantiateJpegModule();
}

async function instantiateJpegModule(): Promise<JpegExports> {
  wasmPromise ??= readJpegWasm();
  const wasm = await wasmPromise;
  let memory: WebAssembly.Memory | undefined;
  const wasi = createWasiImports(() => memory);
  const result = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi });
  const exports = result.instance.exports as JpegExports;
  memory = exports.memory;

  if (!memory || typeof exports.sinter_jpeg_decode !== "function") {
    throw new SinterCodecError("Failed to load JPEG codec: invalid WASM exports.");
  }

  return exports;
}

async function readJpegWasm(): Promise<ArrayBuffer> {
  const url = new URL("./jpeg.wasm", import.meta.url);

  if (typeof Bun !== "undefined") {
    return Bun.file(url).arrayBuffer();
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new SinterCodecError(`Failed to load JPEG codec: ${response.statusText}`);
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
        `JPEG codec exited with code ${code}${message ? `: ${message}` : ""}.`
      );
    },
    random_get: (ptr: number, len: number) => {
      const memory = getMemory();
      if (memory) {
        crypto.getRandomValues(new Uint8Array(memory.buffer, ptr, len));
      }
      return 0;
    },
  };
}

function clampQuality(quality: number): number {
  return Math.max(1, Math.min(100, Math.round(quality)));
}

function hasJpegEndMarker(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}
