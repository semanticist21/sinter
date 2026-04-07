import type { ImageFormat, SinterBuilder } from "./types";

// Codec option mapping by format
export type CodecMap = {
  avif: { speed?: number; quality?: number };
  webp: { lossless?: boolean; quality?: number };
  jpeg: { progressive?: boolean };
  png: Record<string, never>;
};

// Format selection stage after compress(file)
export interface SinterFormatStage {
  // Keep the original format
  keepFormat: () => SinterBuilder;
  // Convert only formats outside the allowed list to the target format
  allowFormats: <F extends ImageFormat>(
    allowed: ImageFormat[],
    to: F,
    options?: { codec?: CodecMap[F] }
  ) => SinterBuilder;
  // Always convert to the target format
  toFormat: <F extends ImageFormat>(format: F, options?: { codec?: CodecMap[F] }) => SinterBuilder;
}
