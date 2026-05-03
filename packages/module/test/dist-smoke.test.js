import "./setup.ts";

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ASSETS = resolve(import.meta.dir, "../../../assets/test");
const PACKAGE_ROOT = resolve(import.meta.dir, "..");

function loadAsset(name) {
  const bytes = readFileSync(resolve(ASSETS, name));
  return new File([bytes], name);
}

describe("dist package smoke", () => {
  test("built package loads JPEG, PNG, WebP, and BMP codec chunks", async () => {
    const { sinter } = await import("../dist/index.mjs");
    const source = loadAsset("test.jpeg");

    const jpeg = await sinter().keepFormat().maxQuality(80).compress(source);
    const png = await sinter().toFormat("png").dimensions({ width: 64 }).compress(source);
    const webp = await sinter().toFormat("webp").maxQuality(80).compress(source);
    const bmp = await sinter().toFormat("bmp").dimensions({ width: 32 }).compress(source);

    expect(jpeg.type).toBe("image/jpeg");
    expect(png.type).toBe("image/png");
    expect(webp.type).toBe("image/webp");
    expect(bmp.type).toBe("image/bmp");
    expect(jpeg.size).toBeGreaterThan(0);
    expect(png.size).toBeGreaterThan(0);
    expect(webp.size).toBeGreaterThan(0);
    expect(bmp.size).toBeGreaterThan(0);
  });

  test("built package imports in Node without browser globals", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `
          const { sinter } = await import("./dist/index.mjs");
          if (typeof sinter !== "function") {
            throw new Error("sinter export was not a function");
          }
        `,
      ],
      { cwd: PACKAGE_ROOT, encoding: "utf8" }
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  test("built package rejects compression outside browser and Bun runtimes", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `
          globalThis.window = {};
          const { sinter, SinterCodecError } = await import("./dist/index.mjs");
          const file = new File([new Uint8Array([1])], "test.bin");

          try {
            await sinter().keepFormat().compress(file);
          } catch (error) {
            if (!(error instanceof SinterCodecError)) {
              throw error;
            }
            if (!error.message.includes("browser client with Web Worker support")) {
              throw new Error("Unexpected message: " + error.message);
            }
            process.exit(0);
          }

          throw new Error("compress() unexpectedly succeeded");
        `,
      ],
      { cwd: PACKAGE_ROOT, encoding: "utf8" }
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
