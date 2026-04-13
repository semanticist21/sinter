import { SinterValidationError } from "./errors";
import type { ImageFormat } from "./types";

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

function matchBytes(data: Uint8Array, expected: number[], offset = 0): boolean {
  if (data.length < offset + expected.length) {
    return false;
  }
  for (let i = 0; i < expected.length; i++) {
    if (data[offset + i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

function isAvif(data: Uint8Array): boolean {
  // AVIF files use the ISOBMFF container with an "ftyp" box.
  // Minimum: 4 bytes box-size + 4 bytes "ftyp" + 4 bytes major-brand = 12 bytes
  if (data.length < 12) {
    return false;
  }

  // The ftyp box is almost always the first box, but the spec allows it at any position.
  // In practice we only check offset 0 (box starts at byte 0).
  const boxSize = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  if (boxSize < 12 || boxSize > data.length) {
    return false;
  }

  // bytes 4-7 must be "ftyp"
  if (data[4] !== 0x66 || data[5] !== 0x74 || data[6] !== 0x79 || data[7] !== 0x70) {
    return false;
  }

  // major brand at bytes 8-11
  const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
  return brand === "avif" || brand === "avis" || brand === "mif1";
}

export function detectFormat(data: Uint8Array): ImageFormat {
  if (data.length < 12) {
    throw new SinterValidationError("File is too small to be a valid image.");
  }

  if (matchBytes(data, JPEG_MAGIC)) {
    return "jpeg";
  }
  if (matchBytes(data, PNG_MAGIC)) {
    return "png";
  }
  if (matchBytes(data, RIFF_MAGIC) && matchBytes(data, WEBP_MAGIC, 8)) {
    return "webp";
  }
  if (isAvif(data)) {
    return "avif";
  }

  throw new SinterValidationError(
    "Unsupported or invalid image format. Supported formats: JPEG, PNG, WebP, AVIF."
  );
}
