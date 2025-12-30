import { uuid } from "./utils";

/** 압축 옵션 */
export interface CompressOptions {
  format?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxSizeKb?: number;
  preserveExif?: boolean;
}

/** 워커 압축 결과 */
export interface CompressResult {
  format: string;
  mimeType: string;
  extension: string;
  data: Uint8Array;
}

/** 제네릭 워커 매니저 */
export class WorkerManager<TResponse> {
  private worker: Worker | null = null;

  constructor(private createWorker: () => Worker) {}

  /** 워커 인스턴스 반환 (싱글톤) */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  /** 메시지 전송 및 응답 대기 */
  post(payload: Record<string, unknown>): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const id = uuid();

      const handleMessage = (event: MessageEvent) => {
        if (event.data.id !== id) {
          return;
        }

        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);

        if (event.data.success) {
          resolve(event.data as TResponse);
        } else {
          reject(new Error(event.data.error || "Worker processing failed"));
        }
      };

      const handleError = (error: ErrorEvent) => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        reject(new Error(error.message || "Worker error occurred"));
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage({ id, ...payload });
    });
  }

  /** 워커 종료 */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/** 압축 워커 인스턴스 */
export const compressWorker = new WorkerManager<CompressResult>(
  () => new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" })
);
