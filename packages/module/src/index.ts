import { SinterFormatStage } from "./format";

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
export function compress(_file: File): SinterFormatStage {
  return new SinterFormatStage();
}

compress(new File([], "image.webp"))
  .allowFormats(["avif"], "webp")
  .codecOptions({ webp: { lossless: false } })
  .maxQuality(80)
  .dimensions({ width: 300 })
  .run();
