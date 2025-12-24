/** 최대 파일 크기 설정 */
export type MaxSize = {
  /** 크기 값 */
  value: number;
  /** 단위: KB, MB, GB */
  unit: "KB" | "MB" | "GB";
};

/** 이미지 압축 옵션 (종횡비는 항상 유지됨) */
export type CompressImageOptions = {
  /** 변환 포맷: JPEG, PNG, WebP, AVIF */
  format?: "jpeg" | "png" | "webp" | "avif";
  /** 최대 너비 (픽셀) - 종횡비 유지하며 조정 */
  maxWidth?: number;
  /** 최대 높이 (픽셀) - 종횡비 유지하며 조정 */
  maxHeight?: number;
  /** 최대 파일 크기 - 내부적으로 quality 자동 조정 */
  maxSize?: MaxSize;
  /** EXIF 정보 보존 여부 */
  preserveExif?: boolean;
};

/**
 * 이미지 압축 및 포맷 변환
 * @param file - input type="file"에서 받은 File 객체
 * @param options - 압축 옵션
 * @returns 처리된 File 객체
 * @example
 * const compressed = await CompressImage(file, { format: 'webp', maxSize: { value: 1, unit: 'MB' } });
 */
export async function CompressImage(
  _file: File,
  _options: CompressImageOptions = {}
): Promise<File> {
  throw new Error("Not implemented - pending new architecture");
}
