import { convertToBytes } from "./utils";
import { compressWorker } from "./worker";

/** 크기 제약 조건 */
type Constraints = {
  /** 최대 너비 (픽셀) */
  maxWidth?: number;
  /** 최대 높이 (픽셀) */
  maxHeight?: number;
  /** 최대 파일 크기 - 내부적으로 quality 자동 조정 */
  maxSize?: {
    value: number;
    unit: "KB" | "MB" | "GB";
  };
};

/** 이미지 압축 옵션 (종횡비는 항상 유지됨) */
export type CompressImageOptions = {
  /** 변환 포맷: JPEG, PNG, WebP, AVIF */
  format?: "jpeg" | "png" | "webp" | "avif";
  /** 크기 제약 조건 */
  constraints?: Constraints;
  /** EXIF 정보 보존 여부 */
  preserveExif?: boolean;
};

/**
 * 이미지 압축 및 포맷 변환
 * @param file - input type="file"에서 받은 File 객체
 * @param options - 압축 옵션
 * @returns 처리된 File 객체
 * @example
 * const compressed = await CompressImage(file, {
 *   format: 'webp',
 *   constraints: { maxSize: { value: 1, unit: 'MB' } }
 * });
 */
export async function CompressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  const { constraints } = options;

  // 파일 데이터 추출
  const fileData = new Uint8Array(await file.arrayBuffer());

  // maxSize를 KB로 변환
  const maxSizeKb = constraints?.maxSize
    ? Math.ceil(convertToBytes(constraints.maxSize.value, constraints.maxSize.unit) / 1024)
    : undefined;

  // 워커에서 압축 실행
  const result = await compressWorker.post({
    fileData,
    mimeType: file.type,
    format: options.format,
    maxWidth: constraints?.maxWidth,
    maxHeight: constraints?.maxHeight,
    maxSizeKb,
    preserveExif: options.preserveExif,
  });

  // 결과를 File 객체로 변환
  const newFileName = `${file.name.replace(/\.[^.]+$/, "")}-compressed.${result.extension}`;
  const data = result.data.slice(0);

  return new File([data], newFileName, { type: result.mimeType });
}
