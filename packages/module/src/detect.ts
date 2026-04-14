import { SinterValidationError } from "./errors";
import type { ImageFormat } from "./types";

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
const BMP_MAGIC = [0x42, 0x4d]; // "BM"
const ISOBMFF_BOX_HEADER_SIZE = 8;
const ISOBMFF_EXTENDED_BOX_HEADER_SIZE = 16;
const MAX_ISOBMFF_SCAN_BYTES = 4096;

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

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
  );
}

function readFourCC(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function readBoxHeaderSize(data: Uint8Array, offset: number): number | null {
  if (data.length < offset + ISOBMFF_BOX_HEADER_SIZE) {
    return null;
  }
  return readUint32BE(data, offset) === 1
    ? ISOBMFF_EXTENDED_BOX_HEADER_SIZE
    : ISOBMFF_BOX_HEADER_SIZE;
}

function readBoxSize(data: Uint8Array, offset: number): number | null {
  if (data.length < offset + ISOBMFF_BOX_HEADER_SIZE) {
    return null;
  }

  const boxSize = readUint32BE(data, offset);
  if (boxSize === 0) {
    return data.length - offset;
  }
  if (boxSize !== 1) {
    return boxSize;
  }
  if (data.length < offset + ISOBMFF_EXTENDED_BOX_HEADER_SIZE) {
    return null;
  }

  const high = readUint32BE(data, offset + ISOBMFF_BOX_HEADER_SIZE);
  const low = readUint32BE(data, offset + ISOBMFF_BOX_HEADER_SIZE + 4);
  const extendedSize = high * 2 ** 32 + low;
  return Number.isSafeInteger(extendedSize) ? extendedSize : null;
}

function isAvifFtypBox(data: Uint8Array, offset: number, boxSize: number): boolean {
  const headerSize = readBoxHeaderSize(data, offset);
  if (headerSize == null || boxSize < headerSize + 8) {
    return false;
  }

  // Check both the major brand and compatible brands to exclude HEIF/HEIC.
  const brandOffset = offset + headerSize;
  const brand = readFourCC(data, brandOffset);
  if (brand === "avif" || brand === "avis") {
    return true;
  }
  if (brand !== "mif1") {
    return false;
  }

  // ftyp payload: [major brand(4)][minor version(4)][compatible brands(4 each)...]
  for (
    let compatibleOffset = brandOffset + 8;
    compatibleOffset + 4 <= offset + boxSize && compatibleOffset + 4 <= data.length;
    compatibleOffset += 4
  ) {
    const compatibleBrand = readFourCC(data, compatibleOffset);
    if (compatibleBrand === "avif" || compatibleBrand === "av01") {
      return true;
    }
  }

  return false;
}

function isAvif(data: Uint8Array): boolean {
  if (data.length < 12) {
    return false;
  }

  // Scan early ISOBMFF boxes for ftyp even when free/skip boxes come first.
  const scanEnd = Math.min(data.length, MAX_ISOBMFF_SCAN_BYTES);
  for (let offset = 0; offset + ISOBMFF_BOX_HEADER_SIZE <= scanEnd; ) {
    const boxSize = readBoxSize(data, offset);
    if (boxSize == null || boxSize < ISOBMFF_BOX_HEADER_SIZE || offset + boxSize > data.length) {
      return false;
    }

    if (readFourCC(data, offset + 4) === "ftyp") {
      return isAvifFtypBox(data, offset, boxSize);
    }

    offset += boxSize;
  }

  return false;
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
  if (matchBytes(data, BMP_MAGIC)) {
    return "bmp";
  }

  throw new SinterValidationError(
    "Unsupported or invalid image format. Supported formats: JPEG, PNG, WebP, AVIF, BMP."
  );
}
