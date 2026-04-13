import { detectFormat } from "./detect";
import { SinterCodecError } from "./errors";
import type { CodecMap, ImageFormat, WorkerRequest, WorkerResultMessage } from "./types";

const MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

export async function decodeImage(buffer: ArrayBuffer, format: ImageFormat): Promise<ImageData> {
  try {
    switch (format) {
      case "jpeg": {
        const { default: decode } = await import("@jsquash/jpeg/decode.js");
        return decode(buffer);
      }
      case "png": {
        const { default: decode } = await import("@jsquash/png/decode.js");
        return decode(buffer);
      }
      case "webp": {
        const { default: decode } = await import("@jsquash/webp/decode.js");
        return decode(buffer);
      }
      case "avif": {
        const { default: decode } = await import("@jsquash/avif/decode.js");
        const result = await decode(buffer);
        if (!result) {
          throw new SinterCodecError("Failed to decode AVIF image: decoder returned null.");
        }
        return result;
      }
    }
  } catch (err) {
    if (err instanceof SinterCodecError) {
      throw err;
    }
    throw new SinterCodecError(
      `Failed to decode ${format} image: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

interface EncodeOptions {
  quality: number;
  codecOpts: Partial<CodecMap>;
}

export async function encodeImage(
  imageData: ImageData,
  format: ImageFormat,
  options: EncodeOptions
): Promise<ArrayBuffer> {
  const { quality, codecOpts } = options;

  try {
    switch (format) {
      case "jpeg": {
        const { default: encode } = await import("@jsquash/jpeg/encode.js");
        return encode(imageData, {
          quality,
          ...codecOpts.jpeg,
        });
      }
      case "png": {
        const { default: encode } = await import("@jsquash/png/encode.js");
        // PNG is lossless — no quality parameter
        return encode(imageData);
      }
      case "webp": {
        const { default: encode } = await import("@jsquash/webp/encode.js");
        const webpOpts = codecOpts.webp;
        return encode(imageData, {
          quality,
          ...(webpOpts?.lossless != null ? { lossless: webpOpts.lossless ? 1 : 0 } : {}),
        });
      }
      case "avif": {
        const { default: encode } = await import("@jsquash/avif/encode.js");
        return encode(imageData, {
          quality,
          ...codecOpts.avif,
        });
      }
    }
  } catch (err) {
    if (err instanceof SinterCodecError) {
      throw err;
    }
    throw new SinterCodecError(
      `Failed to encode ${format} image: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

function createCanvas(w: number, h: number): OffscreenCanvas {
  return new OffscreenCanvas(w, h);
}

export interface TargetDimensions {
  width: number;
  height: number;
}

export function computeDimensions(
  srcWidth: number,
  srcHeight: number,
  target: { width?: number; height?: number }
): TargetDimensions {
  const { width: tw, height: th } = target;
  const aspect = srcWidth / srcHeight;

  let outW: number;
  let outH: number;

  if (tw != null && th != null) {
    // Fit within the box while preserving aspect ratio
    if (tw / th > aspect) {
      outH = Math.min(th, srcHeight);
      outW = Math.round(outH * aspect);
    } else {
      outW = Math.min(tw, srcWidth);
      outH = Math.round(outW / aspect);
    }
  } else if (tw != null) {
    outW = Math.min(tw, srcWidth);
    outH = Math.round(outW / aspect);
  } else if (th != null) {
    outH = Math.min(th, srcHeight);
    outW = Math.round(outH * aspect);
  } else {
    outW = srcWidth;
    outH = srcHeight;
  }

  return { width: Math.max(1, outW), height: Math.max(1, outH) };
}

export function resizeImageData(imageData: ImageData, target: TargetDimensions): ImageData {
  if (target.width === imageData.width && target.height === imageData.height) {
    return imageData;
  }

  const srcCanvas = createCanvas(imageData.width, imageData.height);
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) {
    throw new SinterCodecError("Failed to acquire 2D canvas context for resize (source).");
  }
  srcCtx.putImageData(imageData, 0, 0);

  const dstCanvas = createCanvas(target.width, target.height);
  const dstCtx = dstCanvas.getContext("2d");
  if (!dstCtx) {
    throw new SinterCodecError("Failed to acquire 2D canvas context for resize (destination).");
  }
  dstCtx.drawImage(srcCanvas, 0, 0, target.width, target.height);

  return dstCtx.getImageData(0, 0, target.width, target.height);
}

// ---------------------------------------------------------------------------
// Size-targeting binary search
// ---------------------------------------------------------------------------

const MIN_QUALITY = 1;
const MAX_SEARCH_STEPS = 7;
const QUALITY_FLOOR = 20; // stop pushing quality below this
const MAX_DIMENSION_STEPS = 8;
const DIMENSION_SCALE = 0.7; // shrink by 30% each step

export async function encodeFitSize(
  imageData: ImageData,
  format: ImageFormat,
  targetBytes: number,
  startQuality: number,
  codecOpts: Partial<CodecMap>
): Promise<ArrayBuffer> {
  let current = imageData;
  let bestQuality = format === "png" ? 100 : startQuality;

  // Phase 1: quality binary search (lossy formats only)
  let encoded = await encodeImage(current, format, { quality: bestQuality, codecOpts });
  if (encoded.byteLength <= targetBytes) {
    return encoded;
  }

  if (format !== "png" && startQuality > QUALITY_FLOOR) {
    let low = MIN_QUALITY;
    let high = startQuality;

    for (let step = 0; step < MAX_SEARCH_STEPS && low < high; step++) {
      const mid = Math.floor((low + high) / 2);
      encoded = await encodeImage(current, format, { quality: mid, codecOpts });

      if (encoded.byteLength <= targetBytes) {
        low = mid + 1;
        bestQuality = mid;
      } else {
        high = mid;
      }

      if (mid <= QUALITY_FLOOR) {
        break;
      }
    }

    // Re-encode at the best quality found
    encoded = await encodeImage(current, format, { quality: bestQuality, codecOpts });
    if (encoded.byteLength <= targetBytes) {
      return encoded;
    }
  }

  // Phase 2: dimension reduction — shrink until size target is met
  for (let step = 0; step < MAX_DIMENSION_STEPS; step++) {
    const newW = Math.max(1, Math.round(current.width * DIMENSION_SCALE));
    const newH = Math.max(1, Math.round(current.height * DIMENSION_SCALE));

    if (newW === current.width && newH === current.height) {
      break;
    }

    current = resizeImageData(current, { width: newW, height: newH });
    encoded = await encodeImage(current, format, { quality: bestQuality, codecOpts });

    if (encoded.byteLength <= targetBytes) {
      return encoded;
    }
  }

  if (encoded.byteLength > targetBytes) {
    console.warn(
      `[sinter] Could not meet size target (${targetBytes} bytes). ` +
        `Best result: ${encoded.byteLength} bytes.`
    );
  }

  return encoded;
}

// ---------------------------------------------------------------------------
// Full pipeline execution (shared by Worker and direct path)
// ---------------------------------------------------------------------------

export async function executePipeline(req: WorkerRequest): Promise<WorkerResultMessage> {
  const { buffer, formatPolicy, codecOpts, maxQuality, dims, sizeLimit } = req;
  const bytes = new Uint8Array(buffer);

  // 1. Detect source format
  const sourceFormat = detectFormat(bytes);

  // 2. Resolve output format
  let outputFormat: ImageFormat;
  switch (formatPolicy.type) {
    case "keep":
      outputFormat = sourceFormat;
      break;
    case "fixed":
      outputFormat = formatPolicy.format;
      break;
    case "allow":
      outputFormat = (formatPolicy.allowed as readonly string[]).includes(sourceFormat)
        ? sourceFormat
        : formatPolicy.fallback;
      break;
  }

  // 3. Decode
  const imageData = await decodeImage(buffer, sourceFormat);
  const srcPixels = imageData.width * imageData.height;

  // 4. Resize
  let resized = imageData;
  let pixelRatio = 1;

  if (dims) {
    const target = computeDimensions(imageData.width, imageData.height, dims);
    resized = resizeImageData(imageData, target);
    pixelRatio = (resized.width * resized.height) / srcPixels;
  }

  // 5. Determine quality
  let quality = 100;
  if (maxQuality != null) {
    const threshold = maxQuality / 100;
    quality = pixelRatio <= threshold ? 100 : maxQuality;
  }

  // 6. Encode
  let encoded: ArrayBuffer;

  if (sizeLimit != null) {
    encoded = await encodeFitSize(resized, outputFormat, sizeLimit, quality, codecOpts);
  } else {
    encoded = await encodeImage(resized, outputFormat, { quality, codecOpts });
  }

  // 7. Inflation guard
  const actuallyResized = pixelRatio < 1;
  if (
    outputFormat === sourceFormat &&
    !actuallyResized &&
    sizeLimit == null &&
    encoded.byteLength > buffer.byteLength
  ) {
    return {
      type: "result",
      buffer,
      mime: MIME[outputFormat],
      originalByteLength: buffer.byteLength,
    };
  }

  return {
    type: "result",
    buffer: encoded,
    mime: MIME[outputFormat],
    originalByteLength: buffer.byteLength,
  };
}
