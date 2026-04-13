import { SinterCodecError, SinterValidationError } from "./errors";
import type {
  PipelineConfig,
  WorkerErrorMessage,
  WorkerRequest,
  WorkerResultMessage,
} from "./types";

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

  /** Sets a timeout in seconds. Rejects with an error if compression exceeds the limit. */
  timeout(seconds: number): Omit<this, "timeout"> {
    if (seconds <= 0) {
      throw new SinterValidationError("timeout must be a positive number.");
    }
    this._config.timeout = seconds;
    return this;
  }

  /** Executes the configured pipeline and resolves the compressed image blob. */
  async run(): Promise<Blob> {
    const { file, formatPolicy, codecOpts, maxQuality, dims, sizeLimit, timeout } = this._config;

    const buffer = await file.arrayBuffer();

    const request: WorkerRequest = {
      buffer,
      formatPolicy,
      codecOpts,
      maxQuality,
      dims,
      sizeLimit,
    };

    // Use Web Worker in browser, direct execution in non-browser environments (bun test)
    const isBrowser = typeof globalThis.window !== "undefined";
    const response = isBrowser
      ? await this.runInWorker(request, timeout)
      : await import("./pipeline").then(m => m.executePipeline(request));

    return new Blob([response.buffer], { type: response.mime });
  }

  private runInWorker(
    request: WorkerRequest,
    timeout: number | undefined
  ): Promise<WorkerResultMessage> {
    const worker = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });

    return new Promise<WorkerResultMessage>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
        }
        worker.terminate();
      };

      if (timeout != null) {
        timer = setTimeout(() => {
          cleanup();
          reject(new SinterCodecError(`Compression timed out after ${timeout}s.`));
        }, timeout * 1000);
      }

      worker.onmessage = (e: MessageEvent<WorkerResultMessage | WorkerErrorMessage>) => {
        const msg = e.data;
        if (msg.type === "error") {
          const ErrorClass =
            msg.errorType === "validation"
              ? SinterValidationError
              : msg.errorType === "codec"
                ? SinterCodecError
                : SinterCodecError;
          cleanup();
          reject(new ErrorClass(msg.message));
        } else {
          cleanup();
          resolve(msg);
        }
      };

      worker.onerror = e => {
        cleanup();
        reject(new SinterCodecError(`Worker error: ${e.message}`));
      };

      worker.postMessage(request, [request.buffer]);
    });
  }
}
