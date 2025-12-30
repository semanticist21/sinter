/** Number of bytes used by the AVIF decoder result struct. */
export const AVIF_RESULT_STRUCT_SIZE = 24;

type AvifStructView = {
  dataPtr: number;
  dataLength: number;
  width: number;
  height: number;
  channels: number;
  status: number;
};

/** Decode the fixed layout struct produced by the AVIF WASM function. */
export function decodeStruct(memory: WebAssembly.Memory, ptr: number): AvifStructView {
  const view = new DataView(memory.buffer, ptr, AVIF_RESULT_STRUCT_SIZE);
  return {
    dataPtr: view.getUint32(0, true),
    dataLength: view.getUint32(4, true),
    width: view.getUint32(8, true),
    height: view.getUint32(12, true),
    channels: view.getUint32(16, true),
    status: view.getInt32(20, true),
  };
}
