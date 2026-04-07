// 지원 이미지 포맷
export type ImageFormat = "webp" | "avif" | "jpeg" | "png" | "qoi";

// 포맷 선택 이후 체이닝 빌더
export interface SinterBuilder {
  quality: (value: number) => SinterBuilder;
  dimensions: (width: number, height: number) => SinterBuilder;
  size: (value: number, unit: "MB" | "KB") => SinterBuilder;
  compress: () => Promise<Blob>;
}
