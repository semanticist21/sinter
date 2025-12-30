/** Shape of the functions exported by the AVIF WASM module. */
export type AvifDecoderExports = {
  memory: WebAssembly.Memory;
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  avif_decode: (dataPtr: number, dataLength: number) => number;
  avif_decode_free: (resultPtr: number) => void;
};

let decoderPromise: Promise<AvifDecoderExports> | null = null;

/** Lazily instantiate and cache the AVIF WASM decoder module. */
export async function loadWasmDecoder(): Promise<AvifDecoderExports> {
  if (decoderPromise) {
    return decoderPromise;
  }

  const wasmUrl = new URL("../../wasm/output/avif_decode.wasm", import.meta.url);

  decoderPromise = (async () => {
    // Use instantiateStreaming when available to avoid extra ArrayBuffer allocations
    const response = await fetch(wasmUrl);
    const instantiatePromise = WebAssembly.instantiateStreaming
      ? WebAssembly.instantiateStreaming(response, {})
      : response.arrayBuffer().then(buffer => WebAssembly.instantiate(buffer, {}));

    const { instance } = (await instantiatePromise) as WebAssembly.WebAssemblyInstantiatedSource;
    return instance.exports as AvifDecoderExports;
  })();

  return decoderPromise;
}
