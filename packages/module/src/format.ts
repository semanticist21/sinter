import { SinterCodecStage } from "./codec";
import type { ImageFormat, PipelineConfig } from "./types";

export class SinterFormatStage {
  /** @internal */
  private readonly _config: PipelineConfig;

  /** @internal */
  constructor(config: PipelineConfig) {
    this._config = config;
  }

  /** Keeps the original image format for the output blob. */
  keepFormat(): SinterCodecStage {
    this._config.formatPolicy = { type: "keep" };
    return new SinterCodecStage(this._config);
  }

  /**
   * Always encodes the result into the given output format.
   *
   * @param format Target output format.
   */
  toFormat<F extends ImageFormat>(format: F): SinterCodecStage<F> {
    this._config.formatPolicy = { type: "fixed", format };
    return new SinterCodecStage<F>(this._config);
  }

  /**
   * Keeps the input format when it is in the allowed list, otherwise converts to the fallback.
   *
   * @param allowed Formats that may pass through unchanged.
   * @param to Fallback format used when the source format is not allowed.
   */
  allowFormats<A extends readonly ImageFormat[], F extends ImageFormat>(
    allowed: A,
    to: F
  ): SinterCodecStage<A[number] | F> {
    this._config.formatPolicy = { type: "allow", allowed, fallback: to };
    return new SinterCodecStage<A[number] | F>(this._config);
  }
}
