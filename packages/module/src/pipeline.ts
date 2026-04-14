import { detectFormat } from "./detect";
import { SinterCodecError } from "./errors";
import type { CodecMap, ImageFormat, WorkerRequest, WorkerResultMessage } from "./types";

const MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
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
      case "bmp": {
        // BMP는 WASM 없이 순수 TS로 처리 (비압축 포맷)
        const { decodeBmp } = await import("./bmp.js");
        return decodeBmp(buffer);
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
      case "bmp": {
        // BMP는 비압축 lossless — quality 파라미터 무시
        const { encodeBmp } = await import("./bmp.js");
        return encodeBmp(imageData);
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
const PNG_CNUM_MAX = 256; // UPNG 최대 팔레트 크기 (PNG-8 상한)
const PNG_CNUM_MIN = 2; // 단색 방지 하한

// UPNG 팔레트 양자화 인코딩 — cnum=0이면 lossless, 2~256은 최대 색상 수
// maxQuality → cnum: 100→0(lossless), 80→205, 50→128, 0→2
async function encodePngQuantized(imageData: ImageData, cnum: number): Promise<ArrayBuffer> {
  const upng = await import("upng-js");
  // ImageData.data는 Uint8ClampedArray — UPNG은 ArrayBuffer를 요구하므로 slice로 복사
  return upng.default.encode(
    [imageData.data.buffer.slice(0)],
    imageData.width,
    imageData.height,
    cnum
  );
}

export async function encodeFitSize(
  imageData: ImageData,
  format: ImageFormat,
  targetBytes: number,
  startQuality: number,
  codecOpts: Partial<CodecMap>,
  maxQuality?: number // PNG Phase 2 cnum 계산에 사용
): Promise<ArrayBuffer> {
  let current = imageData;
  // BMP/PNG는 lossless — quality 이진탐색 의미 없으므로 100으로 고정
  let bestQuality = format === "png" || format === "bmp" ? 100 : startQuality;

  // Phase 1: @jsquash encode (PNG/BMP는 lossless 1회 시도)
  let encoded = await encodeImage(current, format, { quality: bestQuality, codecOpts });
  if (encoded.byteLength <= targetBytes) {
    return encoded;
  }

  // Phase 1 quality binary search (lossy 포맷만; PNG/BMP는 quality로 크기 조절 불가)
  if (format !== "png" && format !== "bmp" && startQuality > QUALITY_FLOOR) {
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

  // Phase 2 (PNG 전용): UPNG 팔레트 양자화 이진탐색
  // maxQuality → startCnum: 높은 quality → 많은 색상 → 큰 파일
  // 이진탐색으로 targetBytes 이하를 만족하는 최대 cnum(최고 품질) 탐색
  let bestCnum = PNG_CNUM_MIN;
  if (format === "png") {
    const startCnum =
      maxQuality != null && maxQuality < 100
        ? Math.max(PNG_CNUM_MIN, Math.round((maxQuality / 100) * PNG_CNUM_MAX))
        : PNG_CNUM_MAX;
    let low = PNG_CNUM_MIN;
    let high = startCnum;

    for (let step = 0; step < MAX_SEARCH_STEPS && low <= high; step++) {
      const mid = Math.floor((low + high) / 2);
      encoded = await encodePngQuantized(current, mid);

      if (encoded.byteLength <= targetBytes) {
        bestCnum = mid;
        low = mid + 1; // 더 높은 품질(많은 색상)도 시도
      } else {
        high = mid - 1; // 색상 수 줄이기
      }
    }

    encoded = await encodePngQuantized(current, bestCnum);
    if (encoded.byteLength <= targetBytes) {
      return encoded;
    }
  }

  // Phase 3: dimension reduction — 축소 후 재인코딩
  // PNG는 bestCnum으로 UPNG 재인코딩, 나머지는 @jsquash
  for (let step = 0; step < MAX_DIMENSION_STEPS; step++) {
    const newW = Math.max(1, Math.round(current.width * DIMENSION_SCALE));
    const newH = Math.max(1, Math.round(current.height * DIMENSION_SCALE));

    if (newW === current.width && newH === current.height) {
      break;
    }

    current = resizeImageData(current, { width: newW, height: newH });
    encoded =
      format === "png"
        ? await encodePngQuantized(current, bestCnum)
        : await encodeImage(current, format, { quality: bestQuality, codecOpts });

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
    // BMP는 비압축 lossless — maxQuality는 효과 없음 (size constraint는 dimension reduction으로 처리)
    if (outputFormat === "bmp") {
      console.warn(
        "[sinter] maxQuality has no effect on BMP output. Use .size() to constrain file size."
      );
    }
    const threshold = maxQuality / 100;
    quality = pixelRatio <= threshold ? 100 : maxQuality;
  }

  // 6. Encode
  let encoded: ArrayBuffer;

  if (sizeLimit != null) {
    encoded = await encodeFitSize(resized, outputFormat, sizeLimit, quality, codecOpts, maxQuality);
  } else if (outputFormat === "png" && maxQuality != null && maxQuality < 100) {
    // size limit 없이 maxQuality < 100인 PNG → UPNG 팔레트 양자화 적용
    const cnum = Math.max(PNG_CNUM_MIN, Math.round((maxQuality / 100) * PNG_CNUM_MAX));
    encoded = await encodePngQuantized(resized, cnum);
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
