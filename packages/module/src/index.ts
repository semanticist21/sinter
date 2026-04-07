import type { SinterFormatStage } from "./format/stage";

// 진입점
export function compress(file: File): SinterFormatStage {
  throw new Error("구현 전");
}

// compress(new File([], "example.txt")).allowFormats(["avif", "webp"], {
//   "to": "avif",
// }).quality(80).dimensions(800, 600).compress();
//

// compress(new File([], "example.txt")).keepFormat()
// compress(new File([], "example.txt")).toFormat("avif")
