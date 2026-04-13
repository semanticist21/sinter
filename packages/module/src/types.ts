// Supported image formats aligned with the current codec scope
export type ImageFormat = "webp" | "avif" | "jpeg" | "png";

// Codec option mapping by format
export type CodecMap = {
  avif: { speed?: number };
  webp: { lossless?: boolean };
  jpeg: { progressive?: boolean };
  png: Record<string, never>;
};

export type CodecOptions<F extends ImageFormat = ImageFormat> = Partial<{
  [K in F]: CodecMap[K];
}>;

// Internal format policy — resolved to a concrete output format at run-time
export type FormatPolicy =
  | { type: "keep" }
  | { type: "fixed"; format: ImageFormat }
  | { type: "allow"; allowed: readonly ImageFormat[]; fallback: ImageFormat };

// Internal pipeline configuration accumulated through the fluent chain
export interface PipelineConfig {
  file: File;
  formatPolicy: FormatPolicy;
  codecOpts: Partial<CodecMap>;
  maxQuality?: number;
  dims?: { width?: number; height?: number };
  sizeLimit?: number; // bytes
  timeout?: number; // seconds
}

// Worker message protocol
export interface WorkerRequest {
  buffer: ArrayBuffer;
  formatPolicy: FormatPolicy;
  codecOpts: Partial<CodecMap>;
  maxQuality?: number;
  dims?: { width?: number; height?: number };
  sizeLimit?: number;
}

export interface WorkerResultMessage {
  type: "result";
  buffer: ArrayBuffer;
  mime: string;
  originalByteLength: number;
}

export interface WorkerErrorMessage {
  type: "error";
  message: string;
  errorType: "validation" | "codec" | "unknown";
}

export function createConfig(file: File): PipelineConfig {
  return {
    file,
    formatPolicy: { type: "keep" },
    codecOpts: {},
  };
}
