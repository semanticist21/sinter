import { SinterCodecError } from "./errors";

// BMP file header size constant
const FILE_HEADER_SIZE = 14;
// BITMAPV4HEADER size with alpha channel support
const V4_HEADER_SIZE = 108;
// Pixel data offset = file header + V4 header
const PIXEL_OFFSET = FILE_HEADER_SIZE + V4_HEADER_SIZE;

// Pure TypeScript BMP decoder: ArrayBuffer → ImageData (RGBA)
export function decodeBmp(buffer: ArrayBuffer): ImageData {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Validate the BM signature
  if (data[0] !== 0x42 || data[1] !== 0x4d) {
    throw new SinterCodecError("Failed to decode BMP: invalid BMP file signature.");
  }
  if (buffer.byteLength < FILE_HEADER_SIZE + 40) {
    throw new SinterCodecError("Failed to decode BMP: file is too small.");
  }

  // Read the pixel data offset from the file header
  const pixelOffset = view.getUint32(10, true);

  // Parse the info header
  const headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  // Positive height means bottom-up, negative means top-down
  const bottomUp = rawHeight > 0;
  const bitCount = view.getUint16(28, true);

  if (bitCount !== 24 && bitCount !== 32) {
    throw new SinterCodecError(
      `Failed to decode BMP: ${bitCount}-bit BMP is not supported. Only 24-bit and 32-bit are supported.`
    );
  }
  if (width <= 0 || height <= 0) {
    throw new SinterCodecError("Failed to decode BMP: invalid image dimensions.");
  }

  // The compression field supports only 0=BI_RGB and 3=BI_BITFIELDS
  const compression = view.getUint32(30, true);
  if (compression !== 0 && compression !== 3) {
    throw new SinterCodecError(
      `Failed to decode BMP: unsupported compression type (${compression}). Only BI_RGB and BI_BITFIELDS are supported.`
    );
  }

  // Check AlphaMask in V4/V5 headers to determine alpha channel presence
  let hasAlpha = false;
  if (headerSize >= 108 && buffer.byteLength >= FILE_HEADER_SIZE + 108) {
    const alphaMask = view.getUint32(FILE_HEADER_SIZE + 52, true); // AlphaMask offset
    hasAlpha = alphaMask !== 0;
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  const bytesPerPixel = bitCount / 8;
  // Row padding: BMP rows are aligned to 4-byte boundaries
  const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;

  // Validate that the pixel data range stays within the buffer
  if (pixelOffset + height * rowStride > buffer.byteLength) {
    throw new SinterCodecError(
      "Failed to decode BMP: pixel data extends beyond the end of the file."
    );
  }

  for (let row = 0; row < height; row++) {
    // For bottom-up BMPs, the last file row becomes the first image row
    const srcRow = bottomUp ? height - 1 - row : row;
    const srcBase = pixelOffset + srcRow * rowStride;
    const dstBase = row * width * 4;

    for (let col = 0; col < width; col++) {
      const src = srcBase + col * bytesPerPixel;
      const dst = dstBase + col * 4;
      // Convert BMP BGR(A) channel order to RGBA
      rgba[dst] = data[src + 2]; // R
      rgba[dst + 1] = data[src + 1]; // G
      rgba[dst + 2] = data[src + 0]; // B
      rgba[dst + 3] = bitCount === 32 && hasAlpha ? data[src + 3] : 255; // A
    }
  }

  return new ImageData(rgba, width, height);
}

// Pure TypeScript BMP encoder: ImageData (RGBA) → ArrayBuffer (BITMAPV4HEADER, 32-bit BGRA)
export function encodeBmp(imageData: ImageData): ArrayBuffer {
  const { width, height, data } = imageData;
  const pixelDataSize = width * height * 4;
  const fileSize = PIXEL_OFFSET + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const out = new Uint8Array(buf);
  const view = new DataView(buf);

  // --- BITMAPFILEHEADER (14 bytes) ---
  out[0] = 0x42;
  out[1] = 0x4d; // "BM" signature
  view.setUint32(2, fileSize, true); // Total file size
  view.setUint32(6, 0, true); // Reserved field (0)
  view.setUint32(10, PIXEL_OFFSET, true); // Pixel data start offset

  // --- BITMAPV4HEADER (108 bytes, starting at offset 14) ---
  view.setUint32(14, V4_HEADER_SIZE, true); // Header size
  view.setInt32(18, width, true); // Image width
  view.setInt32(22, height, true); // Image height (positive = bottom-up)
  view.setUint16(26, 1, true); // Number of color planes (always 1)
  view.setUint16(28, 32, true); // Bits per pixel (32-bit BGRA)
  view.setUint32(30, 3, true); // BI_BITFIELDS (uses channel masks)
  view.setUint32(34, pixelDataSize, true); // Pixel data size
  view.setUint32(38, 2835, true); // X resolution (~72 DPI)
  view.setUint32(42, 2835, true); // Y resolution (~72 DPI)
  view.setUint32(46, 0, true); // Color table size (none)
  view.setUint32(50, 0, true); // Important color count (none)
  // Channel masks for BGRA pixel storage
  view.setUint32(54, 0x00ff0000, true); // Red mask
  view.setUint32(58, 0x0000ff00, true); // Green mask
  view.setUint32(62, 0x000000ff, true); // Blue mask
  view.setUint32(66, 0xff000000, true); // Alpha mask
  // CSType = LCS_sRGB ("sRGB" little-endian → bytes: 73 52 47 42)
  view.setUint32(70, 0x42475273, true);
  // The remaining V4 fields (Endpoints, Gamma values) stay zero-initialized

  // --- Pixel data (bottom-up, BGRA order) ---
  let dst = PIXEL_OFFSET;
  for (let row = height - 1; row >= 0; row--) {
    const srcBase = row * width * 4;
    for (let col = 0; col < width; col++) {
      const src = srcBase + col * 4;
      // Convert RGBA to BGRA
      out[dst++] = data[src + 2]; // B
      out[dst++] = data[src + 1]; // G
      out[dst++] = data[src + 0]; // R
      out[dst++] = data[src + 3]; // A
    }
  }

  return buf;
}
