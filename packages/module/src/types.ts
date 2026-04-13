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
