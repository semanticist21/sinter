// Supported image formats aligned with the current codec scope
export type ImageFormat = "webp" | "avif" | "jpeg" | "png";

// Chaining builder returned after format selection
export interface SinterBuilder {
  quality: (value: number) => SinterBuilder;
  dimensions: (width: number, height: number) => SinterBuilder;
  size: (value: number, unit: "MB" | "KB") => SinterBuilder;
  compress: () => Promise<Blob>;
}
