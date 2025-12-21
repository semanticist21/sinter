/** MaxSize의 값을 바이트로 변환 */
export function convertToBytes(value: number, unit: "KB" | "MB" | "GB"): number {
  switch (unit) {
    case "KB":
      return value * 1024;
    case "MB":
      return value * 1024 * 1024;
    case "GB":
      return value * 1024 * 1024 * 1024;
  }
}

/** 포맷 이름으로부터 MIME 타입 얻기 */
export function getMimeType(format: string): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}

/** MIME 타입으로부터 포맷 얻기 */
export function getFormatFromMimeType(mimeType: string): string | undefined {
  switch (mimeType) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      return undefined;
  }
}

/** 포맷으로부터 파일 확장자 얻기 */
export function getExtensionFromFormat(format: string): string {
  switch (format) {
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "avif":
      return "avif";
    default:
      return "jpg";
  }
}

/** 처리된 이미지를 위한 새로운 파일명 생성 */
export function generateFileName(originalName: string, format: string): string {
  const nameWithoutExt = originalName.replace(/\.[^.]+$/, "");
  const ext = getExtensionFromFormat(format);
  return `${nameWithoutExt}-compressed.${ext}`;
}
