import "./setup.ts";

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ASSETS = resolve(import.meta.dir, "../../../assets/test");

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
});
