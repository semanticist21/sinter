import { SinterCodecStage } from "./codec";
import type { ImageFormat } from "./types";

export class SinterFormatStage {
  /** Keeps the original image format for the output blob. */
  keepFormat(): SinterCodecStage {
    return new SinterCodecStage();
  }

  /**
   * Always encodes the result into the given output format.
   *
   * @param _format Target output format.
   */
  toFormat<F extends ImageFormat>(_format: F): SinterCodecStage<F> {
    return new SinterCodecStage<F>();
  }

  /**
   * Keeps the input format when it is in the allowed list, otherwise converts to `_to`.
   *
   * @param _allowed Formats that may pass through unchanged.
   * @param _to Fallback format used when the source format is not allowed.
   */
  allowFormats<A extends readonly ImageFormat[], F extends ImageFormat>(
    _allowed: A,
    _to: F
  ): SinterCodecStage<A[number] | F> {
    return new SinterCodecStage<A[number] | F>();
  }
}
