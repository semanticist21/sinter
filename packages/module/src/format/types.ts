// 포맷별 코덱 옵션 매핑
export type CodecMap = {
  avif: { speed?: number; quality?: number };
  webp: { lossless?: boolean; quality?: number };
  jpeg: { progressive?: boolean };
  png: Record<string, never>;
};
