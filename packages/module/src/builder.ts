import { detectFormat } from "./detect";
import { SinterValidationError } from "./errors";
import {
  computeDimensions,
  decodeImage,
  encodeFitSize,
  encodeImage,
  resizeImageData,
} from "./pipeline";
import type { ImageFormat, PipelineConfig } from "./types";

const MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export class SinterBuilder {
  /** @internal */
  protected readonly _config: PipelineConfig;

  /** @internal */
  constructor(config: PipelineConfig) {
    this._config = config;
  }

  /**
   * Sets the highest quality the encoder is allowed to use.
   *
   * The final quality may still be reduced to satisfy `size()`.
   */
  maxQuality(value: number): Omit<this, "maxQuality"> {
    if (value < 1 || value > 100) {
      throw new SinterValidationError("maxQuality must be between 1 and 100.");
    }
    this._config.maxQuality = value;
    return this;
  }

  /**
   * Sets the desired output dimensions.
   *
   * Provide `width`, `height`, or both.
   * Tries to satisfy the given constraints without distorting the image.
   */
  dimensions(value: { width?: number; height?: number }): Omit<this, "dimensions"> {
    if (value.width != null && value.width <= 0) {
      throw new SinterValidationError("dimensions width must be a positive number.");
    }
    if (value.height != null && value.height <= 0) {
      throw new SinterValidationError("dimensions height must be a positive number.");
    }
    if (value.width == null && value.height == null) {
      throw new SinterValidationError("dimensions requires at least width or height.");
    }
    this._config.dims = value;
    return this;
  }

  /** Sets the maximum size allowed for the final output blob. */
  size(value: number, unit: "MB" | "KB"): Omit<this, "size"> {
    if (value <= 0) {
      throw new SinterValidationError("size value must be positive.");
    }
    this._config.sizeLimit = unit === "MB" ? value * 1024 * 1024 : value * 1024;
    return this;
  }

  /** Executes the configured pipeline and resolves the compressed image blob. */
  async run(): Promise<Blob> {
    const { file, formatPolicy, codecOpts, maxQuality, dims, sizeLimit } = this._config;

    // 1. Read file bytes
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 2. Detect source format from magic bytes
    const sourceFormat = detectFormat(bytes);

    // 3. Resolve output format
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

    // 4. Decode
    const imageData = await decodeImage(buffer, sourceFormat);
    const srcPixels = imageData.width * imageData.height;

    // 5. Compute resize dimensions
    let resized = imageData;
    let pixelRatio = 1;

    if (dims) {
      const target = computeDimensions(imageData.width, imageData.height, dims);
      resized = resizeImageData(imageData, target);
      pixelRatio = (resized.width * resized.height) / srcPixels;
    }

    // 6. Determine encoder quality
    //    If dimension reduction already brought pixel count below the maxQuality threshold,
    //    the quality constraint is considered satisfied — encode at full quality.
    let quality = 100;
    if (maxQuality != null) {
      const threshold = maxQuality / 100;
      quality = pixelRatio <= threshold ? 100 : maxQuality;
    }

    // 7. Encode
    let encoded: ArrayBuffer;

    if (sizeLimit != null) {
      // Size-constrained path: quality binary search + dimension reduction
      encoded = await encodeFitSize(resized, outputFormat, sizeLimit, quality, codecOpts);
    } else {
      encoded = await encodeImage(resized, outputFormat, { quality, codecOpts });
    }

    // 8. Never return a result larger than the input when no format conversion or actual resize
    const actuallyResized = pixelRatio < 1;
    if (
      outputFormat === sourceFormat &&
      !actuallyResized &&
      sizeLimit == null &&
      encoded.byteLength > buffer.byteLength
    ) {
      return new Blob([buffer], { type: MIME[outputFormat] });
    }

    return new Blob([encoded], { type: MIME[outputFormat] });
  }
}
