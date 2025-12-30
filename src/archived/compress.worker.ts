// Worker script: WASM 압축 실행 (메인 스레드에서 분리)
import * as wasmModule from "sinter-wasm";
import type { CompressOptions } from "./worker";

interface CompressionMessage extends CompressOptions {
  id: string;
  fileData: Uint8Array;
  mimeType: string;
}

self.addEventListener("message", (event: MessageEvent<CompressionMessage>) => {
  try {
    const { id, fileData, mimeType } = event.data;

    // 기본값 처리
    const format = event.data.format || "";
    const maxWidth = event.data.maxWidth || 0;
    const maxHeight = event.data.maxHeight || 0;
    const maxSizeKb = event.data.maxSizeKb || 0;
    const preserveExif = event.data.preserveExif ?? true;

    // Rust WASM 함수 호출
    const result = wasmModule.compress_image(
      fileData,
      mimeType,
      format,
      maxWidth,
      maxHeight,
      maxSizeKb,
      preserveExif
    );

    // 결과 전달 (camelCase로 통일)
    self.postMessage({
      id,
      success: true,
      format: result.format,
      mimeType: result.mime_type,
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
