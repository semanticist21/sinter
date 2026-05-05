import { SinterCodecError, SinterValidationError } from "./errors";
import type {
  PipelineConfig,
  WorkerErrorMessage,
  WorkerRequest,
  WorkerResultMessage,
} from "./types";

function validateFile(file: File): void {
  if (typeof File === "undefined" || !(file instanceof File)) {
    throw new SinterValidationError("compress() expects a File instance.");
  }
  if (file.size === 0) {
    throw new SinterValidationError("파일이 비어 있습니다.");
  }
}

function canUseBrowserWorker(): boolean {
  return typeof globalThis.window !== "undefined" && typeof globalThis.Worker !== "undefined";
}

function isBunRuntime(): boolean {
  return "Bun" in globalThis;
}

function createTimeoutError(timeout: number): SinterCodecError {
  return new SinterCodecError(`Compression timed out after ${timeout}s.`);
}

function rejectUnsupportedEnvironment(): never {
  throw new SinterCodecError(
    "Sinter compression requires a browser client with Web Worker support. " +
      "SSR imports are safe, but call compress() only from client-side code."
  );
}

function withTimeout<T>(promise: Promise<T>, timeout: number | undefined): Promise<T> {
  if (timeout == null) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(createTimeoutError(timeout));
    }, timeout * 1000);

    promise.then(
      value => {
        if (!settled) {
          clearTimeout(timer);
          resolve(value);
        }
      },
      error => {
        if (!settled) {
          clearTimeout(timer);
          reject(error);
        }
      }
    );
  });
}

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
    if (!Number.isFinite(value) || value < 1 || value > 100) {
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
    if (value.width != null && (!Number.isFinite(value.width) || value.width <= 0)) {
      throw new SinterValidationError("dimensions width must be a positive number.");
    }
    if (value.height != null && (!Number.isFinite(value.height) || value.height <= 0)) {
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
    if (!Number.isFinite(value) || value <= 0) {
      throw new SinterValidationError("size value must be positive.");
    }
    this._config.sizeLimit = unit === "MB" ? value * 1024 * 1024 : value * 1024;
    return this;
  }

  /** Sets a timeout in seconds. Rejects with an error if compression exceeds the limit. */
  timeout(seconds: number): Omit<this, "timeout"> {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new SinterValidationError("timeout must be a positive number.");
    }
    this._config.timeout = seconds;
    return this;
  }

  /** Executes the pipeline and returns the compressed image Blob. */
  async compress(file: File): Promise<Blob> {
    validateFile(file);
    const { formatPolicy, codecOpts, maxQuality, dims, sizeLimit, timeout } = this._config;
    const useWorker = canUseBrowserWorker();
    const useDirectPipeline = isBunRuntime();

    if (!useWorker && !useDirectPipeline) {
      rejectUnsupportedEnvironment();
    }

    const buffer = await file.arrayBuffer();

    const request: WorkerRequest = {
      buffer,
      formatPolicy,
      codecOpts,
      maxQuality,
      dims,
      sizeLimit,
    };

    const response = useWorker
      ? await this.runInWorker(request, timeout)
      : await withTimeout(
          import("./pipeline").then(m => m.executePipeline(request)),
          timeout
        );

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
          reject(createTimeoutError(timeout));
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
