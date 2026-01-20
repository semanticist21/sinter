import { SinterImageFormat } from "./format";

interface Options{
  maxWidth: number,
  maxHeight: number,
  sizeLimit: number,
  format: SinterImageFormat,
}

export async function compactImageFile(file:File, options:Options): Promise<File> {
  // WASM Decoode

  // Canvas Resizing

  // Wasm Encode

  // Return Result
  return new File([new Uint8Array()], "test")
}
