/** Create a Uint8Array view into WASM memory without copying. */
export function viewMemory(memory: WebAssembly.Memory, ptr: number, length: number): Uint8Array {
  return new Uint8Array(memory.buffer, ptr, length);
}

/** Copy decoded pixel data out of WASM memory to prevent mutation. */
export function copyPixels(
  memory: WebAssembly.Memory,
  ptr: number,
  length: number
): Uint8ClampedArray {
  // Copy pixels out of WASM memory to avoid exposing mutable buffers
  const clone = new Uint8ClampedArray(length);
  clone.set(new Uint8Array(memory.buffer, ptr, length));
  return clone;
}
