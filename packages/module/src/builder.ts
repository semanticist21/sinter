export class SinterBuilder {
  // Context: this stage only records intent from the fluent chain.
  // Constraint: resize and encode should still happen once in `run()` so repeated calls do not
  // introduce extra generation loss.
  // Constraint: this is a ceiling, not a fixed output quality, because `size()` may still force
  // the encoder lower to hit the final blob target.
  /**
   * Sets the highest quality the encoder is allowed to use.
   *
   * The final quality may still be reduced to satisfy `size()`.
   */
  maxQuality(_value: number): this {
    return this;
  }

  // Constraint: callers may provide width, height, or both through one shape so the resize API
  // can evolve without multiplying chain methods.
  // `run()` is responsible for translating the final dimensions into a single resize pass.
  /**
   * Sets the desired output dimensions.
   *
   * Provide `width`, `height`, or both.
   * It trys to satisfy one of the given inputs without distorting image.
   */
  dimensions(_value: { width?: number; height?: number }): this {
    return this;
  }

  // Context: size is an upper bound target for the final blob, not a direct codec option.
  // Constraint: the explicit unit keeps the public API unambiguous at the call site.
  /** Sets the maximum size allowed for the final output blob. */
  size(_value: number, _unit: "MB" | "KB"): this {
    return this;
  }

  // Context: `run()` is the terminal step so the chain can collect configuration first.
  // Constraint: future implementation should collapse the recorded options into one
  // decode/resize/encode pass before resolving the output blob.
  /** Executes the configured pipeline and resolves the compressed image blob. */
  run(): Promise<Blob> {
    return Promise.resolve(new Blob());
  }
}
