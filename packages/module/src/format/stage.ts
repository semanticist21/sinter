import type { ImageFormat, SinterBuilder } from "../types";
import type { CodecMap } from "./types";

// compress(file) 이후 포맷 모드 선택 단계
export interface SinterFormatStage {
  // 원본 포맷 유지
  keepFormat: () => SinterBuilder;
  // 허용 목록 밖 포맷만 to로 변환
  allowFormats: <F extends ImageFormat>(
    allowed: ImageFormat[],
    to: F,
    options?: { codec?: CodecMap[F] }
  ) => SinterBuilder;
  // 무조건 target 포맷으로 변환
  toFormat: <F extends ImageFormat>(format: F, options?: { codec?: CodecMap[F] }) => SinterBuilder;
}
