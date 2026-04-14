import { SinterFormatStage } from "./format";
import { createConfig } from "./types";

export { SinterCodecError, SinterError, SinterValidationError } from "./errors";
export type { CodecMap, CodecOptions, ImageFormat } from "./types";

/**
 * 압축 파이프라인을 구성한다. 포맷 → 옵션 순서로 체이닝하고, 마지막 `compress(file)`에 파일을 전달한다.
 *
 * 파이프라인 설정을 const로 저장해 여러 파일에 재사용할 수 있다.
 *
 * @example
 * const pipeline = sinter()
 *   .allowFormats(["avif", "webp"], "webp")
 *   .codecOptions({ webp: { lossless: false } })
 *   .maxQuality(80)
 *   .dimensions({ width: 1200 });
 *
 * const blob = await pipeline.compress(file);
 */
export function sinter(): SinterFormatStage {
  return new SinterFormatStage(createConfig());
}
