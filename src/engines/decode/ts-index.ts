import { loadWasmDecoder } from "./ts-loader";
import { copyPixels, viewMemory } from "./ts-memory";
import { decodeStruct } from "./ts-struct";

/** Result of decoding an AVIF image into RGBA pixels. */
export type AvifDecodeResult = {
  /** Raw pixel buffer in RGBA order. */
  pixels: Uint8ClampedArray;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** Number of channels (expect 4 for RGBA). */
  channels: number;
};

/** Decode an AVIF file via the WebAssembly decoder pipeline. */
export async function decodeAvif(source: File): Promise<AvifDecodeResult> {
  const decoder = await loadWasmDecoder();

  // Read File into ArrayBuffer to prepare WASM input buffer
  const buffer = await source.arrayBuffer();
  const data = new Uint8Array(buffer);

  const { memory, malloc, free, avif_decode, avif_decode_free } = decoder;

  // Copy encoded data into WASM memory
  const inputPtr = malloc(data.byteLength);
  if (inputPtr === 0) {
    throw new Error("Failed to allocate memory for AVIF decoder.");
  }

  viewMemory(memory, inputPtr, data.byteLength).set(data);

  const resultPtr = avif_decode(inputPtr, data.byteLength);
  free(inputPtr);

  if (resultPtr === 0) {
    throw new Error("Failed to decode AVIF image.");
  }

  // Parse result struct to read pixel metadata and pointers
  const resultView = decodeStruct(memory, resultPtr);

  if (resultView.status !== 0) {
    avif_decode_free(resultPtr);
    throw new Error(`AVIF decode error (status=${resultView.status})`);
  }

  // Copy decoded pixels for JS usage
  const pixels = copyPixels(memory, resultView.dataPtr, resultView.dataLength);

  avif_decode_free(resultPtr);

  return {
    pixels,
    width: resultView.width,
    height: resultView.height,
    channels: resultView.channels,
  };
}
