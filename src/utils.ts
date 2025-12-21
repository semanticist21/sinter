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
