import { convertToBytes } from "./utils";

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

// Worker 싱글톤 인스턴스
let compressWorker: Worker | null = null;

function getCompressWorker(): Worker {
  if (!compressWorker) {
    compressWorker = new Worker(new URL("./compress.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return compressWorker;
}

/**
 * 이미지 압축 및 포맷 변환
 * @param file - input type="file"에서 받은 File 객체
 * @param options - 압축 옵션
 * @returns 처리된 File 객체
 * @example
 * const compressed = await CompressImage(file, { format: 'webp', maxSize: { value: 1, unit: 'MB' } });
 */
export async function CompressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  // 1. 파일을 ArrayBuffer로 읽기
  const arrayBuffer = await file.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  // 2. maxSize를 KB로 변환 (0 = 무제한)
  const maxSizeKb = options.maxSize
    ? Math.ceil(convertToBytes(options.maxSize.value, options.maxSize.unit) / 1024)
    : 0;

  // 3. 워커에서 WASM 함수 호출 (메인 스레드 비블로킹)
  interface CompressionResult {
    format: string;
    mime_type: string;
    extension: string;
    data: Uint8Array;
  }

  const result = await new Promise<CompressionResult>((resolve, reject) => {
    const worker = getCompressWorker();
    const messageId = `compress_${Date.now()}_${Math.random()}`;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.id === messageId) {
        worker.removeEventListener("message", handleMessage);
        if (event.data.success) {
          resolve({
            format: event.data.format,
            mime_type: event.data.mime_type,
            extension: event.data.extension,
            data: event.data.data,
          });
        } else {
          reject(new Error(event.data.error || "Worker processing failed"));
        }
      }
    };

    const handleError = (error: ErrorEvent) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      reject(new Error(error.message || "Worker error occurred"));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    worker.postMessage({
      id: messageId,
      fileData,
      inputMimeType: file.type,
      targetFormat: options.format || "",
      maxWidth: options.maxWidth || 0,
      maxHeight: options.maxHeight || 0,
      maxSizeKb,
      preserveExif: options.preserveExif ?? true,
    });
  });

  // 4. 결과를 File 객체로 변환 (Rust에서 받은 메타데이터 사용)
  const newFileName = `${file.name.replace(/\.[^.]+$/, "")}-compressed.${result.extension}`;
  const dataCopy = result.data.slice(0);
  const blob = new Blob([dataCopy], { type: result.mime_type });
  const compressedFile = new File([blob], newFileName, { type: result.mime_type });

  return compressedFile;
}
