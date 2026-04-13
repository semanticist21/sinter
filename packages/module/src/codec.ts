import { SinterBuilder } from "./builder";
import type { CodecOptions, ImageFormat } from "./types";

export class SinterCodecStage<F extends ImageFormat = ImageFormat> extends SinterBuilder {
  /**
   * Sets codec-specific options for the formats that may be produced by this pipeline.
   *
   * Quality stays separate on `maxQuality()` so shared quality rules do not compete with
   * per-codec settings.
   */
  codecOptions(options: CodecOptions<F>): this {
    Object.assign(this._config.codecOpts, options);
    return this;
  }
}
