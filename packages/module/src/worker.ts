import { SinterCodecError, SinterValidationError } from "./errors";
import { executePipeline } from "./pipeline";
import type { WorkerErrorMessage, WorkerRequest } from "./types";

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const result = await executePipeline(e.data);
    self.postMessage(result, { transfer: [result.buffer] });
  } catch (err) {
    let errorType: WorkerErrorMessage["errorType"] = "unknown";
    if (err instanceof SinterValidationError) {
      errorType = "validation";
    } else if (err instanceof SinterCodecError) {
      errorType = "codec";
    }
    const msg: WorkerErrorMessage = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      errorType,
    };
    postMessage(msg);
  }
};
