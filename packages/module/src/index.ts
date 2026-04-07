import type { SinterFormatStage } from "./format";

// Entry point
export function compress(_file: File): SinterFormatStage {
  throw new Error("Not implemented yet");
}

// compress(new File([], "example.txt")).allowFormats(["avif", "webp"], {
//   "to": "avif",
// }).quality(80).dimensions(800, 600).compress();
//

// compress(new File([], "example.txt")).keepFormat()
// compress(new File([], "example.txt")).toFormat("avif")
