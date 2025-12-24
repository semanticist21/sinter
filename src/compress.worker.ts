// Worker script: WASM 압축 실행 (메인 스레드에서 분리)
import * as wasmModule from "sinter-wasm";

interface CompressionMessage {
  id: string;
  fileData: Uint8Array;
  inputMimeType: string;
  targetFormat: string;
  maxWidth: number;
  maxHeight: number;
  maxSizeKb: number;
  preserveExif: boolean;
}

self.addEventListener("message", (event: MessageEvent<CompressionMessage>) => {
  try {
    const {
      id,
      fileData,
      inputMimeType,
      targetFormat,
      maxWidth,
      maxHeight,
      maxSizeKb,
      preserveExif,
    } = event.data;

    // Rust WASM 함수 호출
    const result = wasmModule.compress_image(
      fileData,
      inputMimeType,
      targetFormat,
      maxWidth,
      maxHeight,
      maxSizeKb,
      preserveExif
    );

    // 결과 전달
    self.postMessage({
      id,
      success: true,
      format: result.format,
      mime_type: result.mime_type,
      extension: result.extension,
      data: new Uint8Array(result.data),
    });
  } catch (error) {
    // 에러 처리
    self.postMessage({
      id: event.data.id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
