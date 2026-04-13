import { SinterValidationError } from "./errors";
import { SinterFormatStage } from "./format";
import { createConfig } from "./types";

export { SinterCodecError, SinterError, SinterValidationError } from "./errors";
export type { CodecMap, CodecOptions, ImageFormat } from "./types";

/**
 * Starts a compression pipeline for an image file.
 *
 * Choose an output format first, then add quality, size, or resize constraints,
 * and finish the chain with `run()`.
 *
 * @example
 * const blob = await compress(file)
 *   .allowFormats(["avif", "webp"], "webp")
 *   .codecOptions({ webp: { lossless: false } })
 *   .maxQuality(80)
 *   .dimensions({ width: 1200 })
 *   .run();
 */
export function compress(file: File): SinterFormatStage {
  if (!(file instanceof File)) {
    throw new SinterValidationError("compress() expects a File instance.");
  }
  if (file.size === 0) {
    throw new SinterValidationError("File is empty.");
  }

  return new SinterFormatStage(createConfig(file));
}
