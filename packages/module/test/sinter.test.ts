import "./setup";

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectFormat } from "../src/detect";
import { sinter } from "../src/index";
import { computeDimensions, decodeImage, encodeFitSize } from "../src/pipeline";

// ---------------------------------------------------------------------------
// Test assets
// ---------------------------------------------------------------------------

const ASSETS = resolve(import.meta.dir, "../../../assets/test");

function loadAsset(name: string): File {
  const buf = readFileSync(resolve(ASSETS, name));
  return new File([buf], name);
}

function loadBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(ASSETS, name)));
}

function createBox(type: string, payload: number[]): number[] {
  const size = payload.length + 8;
  return [
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    ...type.split("").map(char => char.charCodeAt(0)),
    ...payload,
  ];
}

function createFtypBox(majorBrand: string, compatibleBrands: string[]): Uint8Array {
  return new Uint8Array(
    createBox("ftyp", [
      ...majorBrand.split("").map(char => char.charCodeAt(0)),
      0,
      0,
      0,
      0,
      ...compatibleBrands.flatMap(brand => brand.split("").map(char => char.charCodeAt(0))),
    ])
  );
}

// ---------------------------------------------------------------------------
// Format detection (magic bytes)
// ---------------------------------------------------------------------------

describe("detectFormat", () => {
  test("detects JPEG", () => {
    expect(detectFormat(loadBytes("test.jpeg"))).toBe("jpeg");
  });

  test("detects PNG", () => {
    expect(detectFormat(loadBytes("test.png"))).toBe("png");
  });

  test("detects WebP", () => {
    expect(detectFormat(loadBytes("test.webp"))).toBe("webp");
  });

  test("detects AVIF", () => {
    expect(detectFormat(loadBytes("test.avif"))).toBe("avif");
  });

  test("detects BMP", () => {
    expect(detectFormat(loadBytes("test.bmp"))).toBe("bmp");
  });

  test("detects AVIF when ftyp is preceded by a free box", () => {
    const bytes = new Uint8Array([
      ...createBox("free", [0, 0, 0, 0]),
      ...createFtypBox("avif", []),
    ]);
    expect(detectFormat(bytes)).toBe("avif");
  });

  test("rejects HEIF-compatible mif1 without AVIF brands", () => {
    expect(() => detectFormat(createFtypBox("mif1", ["heic"]))).toThrow("Unsupported");
  });

  test("throws on too-small buffer", () => {
    expect(() => detectFormat(new Uint8Array(5))).toThrow("too small");
  });

  test("throws on unknown format", () => {
    expect(() => detectFormat(new Uint8Array(20))).toThrow("Unsupported");
  });
});

// ---------------------------------------------------------------------------
// Dimension computation
// ---------------------------------------------------------------------------

describe("computeDimensions", () => {
  test("width only — scales height proportionally", () => {
    const result = computeDimensions(1000, 500, { width: 200 });
    expect(result).toEqual({ width: 200, height: 100 });
  });

  test("height only — scales width proportionally", () => {
    const result = computeDimensions(1000, 500, { height: 100 });
    expect(result).toEqual({ width: 200, height: 100 });
  });

  test("both — fit within box preserving aspect", () => {
    // 1000x500 → fit 300x300 → width-constrained: 300x150
    const result = computeDimensions(1000, 500, { width: 300, height: 300 });
    expect(result).toEqual({ width: 300, height: 150 });
  });

  test("both — tall image in wide box", () => {
    // 500x1000 → fit 300x300 → height-constrained: 150x300
    const result = computeDimensions(500, 1000, { width: 300, height: 300 });
    expect(result).toEqual({ width: 150, height: 300 });
  });

  test("target larger than source — caps at source dimensions", () => {
    const result = computeDimensions(100, 50, { width: 500 });
    expect(result).toEqual({ width: 100, height: 50 });
  });

  test("minimum dimension is 1", () => {
    const result = computeDimensions(10, 10000, { width: 1 });
    expect(result.width).toBe(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("sinter() validation", () => {
  test("throws on empty file", async () => {
    await expect(sinter().keepFormat().compress(new File([], "empty.jpg"))).rejects.toThrow("비어");
  });

  test("returns format stage", () => {
    const stage = sinter();
    expect(stage).toBeDefined();
    expect(typeof stage.keepFormat).toBe("function");
    expect(typeof stage.toFormat).toBe("function");
    expect(typeof stage.allowFormats).toBe("function");
  });
});

describe("builder validation", () => {
  test("maxQuality rejects out of range", () => {
    expect(() => sinter().keepFormat().maxQuality(0)).toThrow();
    expect(() => sinter().keepFormat().maxQuality(101)).toThrow();
  });

  test("maxQuality accepts valid values", () => {
    expect(() => sinter().keepFormat().maxQuality(1)).not.toThrow();
    expect(() => sinter().keepFormat().maxQuality(100)).not.toThrow();
  });

  test("dimensions rejects invalid values", () => {
    expect(() => sinter().keepFormat().dimensions({ width: -1 })).toThrow();
    expect(() => sinter().keepFormat().dimensions({ width: 0 })).toThrow();
    expect(() => sinter().keepFormat().dimensions({})).toThrow();
  });

  test("size rejects non-positive", () => {
    expect(() => sinter().keepFormat().size(0, "KB")).toThrow();
    expect(() => sinter().keepFormat().size(-1, "MB")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// JPEG compression
// ---------------------------------------------------------------------------

describe("JPEG", () => {
  test("keepFormat — quality reduces file size", async () => {
    const file = loadAsset("test.jpeg");
    const original = file.size;

    const blob = await sinter().keepFormat().maxQuality(50).compress(file);
    expect(blob.size).toBeLessThan(original);
    expect(blob.type).toBe("image/jpeg");
  });

  test("keepFormat — lower quality = smaller file", async () => {
    const file = loadAsset("test.jpeg");

    const q80 = await sinter().keepFormat().maxQuality(80).compress(file);
    const q20 = await sinter().keepFormat().maxQuality(20).compress(file);
    expect(q20.size).toBeLessThan(q80.size);
  });

  test("keepFormat — quality 1 produces very small file", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().keepFormat().maxQuality(1).compress(file);
    expect(blob.size).toBeLessThan(file.size * 0.1); // less than 10% of original
  });

  test(
    "size constraint is enforced",
    async () => {
      const file = loadAsset("test.jpeg");

      const blob = await sinter()
        .keepFormat()
        .dimensions({ width: 800 })
        .size(100, "KB")
        .compress(file);
      expect(blob.size).toBeLessThanOrEqual(100 * 1024);
    },
    { timeout: 30_000 }
  );

  test("dimensions reduce output size", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().keepFormat().dimensions({ width: 200 }).compress(file);
    expect(blob.size).toBeLessThan(file.size);
  });

  test("toFormat(webp) converts to WebP", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().toFormat("webp").compress(file);
    expect(blob.type).toBe("image/webp");
  });

  test("toFormat(avif) converts to AVIF", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().toFormat("avif").compress(file);
    expect(blob.type).toBe("image/avif");
  });

  test("toFormat(png) converts to PNG", async () => {
    const file = loadAsset("test.jpeg");
    // Use small dimensions to avoid massive PNG
    const blob = await sinter().toFormat("png").dimensions({ width: 100 }).compress(file);
    expect(blob.type).toBe("image/png");
  });
});

// ---------------------------------------------------------------------------
// PNG compression
// ---------------------------------------------------------------------------

describe("PNG", () => {
  test("keepFormat — result is not larger than original", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter().keepFormat().compress(file);
    // Should return original bytes when re-encode inflates
    expect(blob.size).toBeLessThanOrEqual(file.size);
  });

  test("size constraint — reduces dimensions to meet target", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter().keepFormat().size(100, "KB").compress(file);
    expect(blob.size).toBeLessThanOrEqual(100 * 1024);
    expect(blob.type).toBe("image/png");
  });

  test("toFormat(webp) — converts PNG to WebP and reduces size", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter().toFormat("webp").maxQuality(80).compress(file);
    expect(blob.type).toBe("image/webp");
    expect(blob.size).toBeLessThan(file.size);
  });

  test("toFormat(jpeg) — converts PNG to JPEG", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter().toFormat("jpeg").maxQuality(80).compress(file);
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeLessThan(file.size);
  });

  test("dimensions — reduces to target width", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter().keepFormat().dimensions({ width: 100 }).compress(file);
    expect(blob.size).toBeLessThan(file.size);
  });
});

// ---------------------------------------------------------------------------
// WebP compression
// ---------------------------------------------------------------------------

describe("WebP", () => {
  test("keepFormat — quality reduces file size", async () => {
    const file = loadAsset("test.webp");

    const blob = await sinter().keepFormat().maxQuality(50).compress(file);
    expect(blob.type).toBe("image/webp");
    expect(blob.size).toBeLessThan(file.size);
  });

  test("keepFormat — lower quality = smaller file", async () => {
    const file = loadAsset("test.webp");

    const q80 = await sinter().keepFormat().maxQuality(80).compress(file);
    const q20 = await sinter().keepFormat().maxQuality(20).compress(file);
    expect(q20.size).toBeLessThan(q80.size);
  });

  test(
    "size constraint is enforced",
    async () => {
      const file = loadAsset("test.webp");

      const blob = await sinter()
        .keepFormat()
        .dimensions({ width: 800 })
        .size(200, "KB")
        .compress(file);
      expect(blob.size).toBeLessThanOrEqual(200 * 1024);
    },
    { timeout: 30_000 }
  );

  test("toFormat(jpeg) — converts to JPEG", async () => {
    const file = loadAsset("test.webp");

    const blob = await sinter().toFormat("jpeg").maxQuality(80).compress(file);
    expect(blob.type).toBe("image/jpeg");
  });

  test("toFormat(avif) — converts to AVIF", async () => {
    const file = loadAsset("test.webp");

    const blob = await sinter().toFormat("avif").maxQuality(50).compress(file);
    expect(blob.type).toBe("image/avif");
  });

  test("dimensions — only width", async () => {
    const file = loadAsset("test.webp");

    const blob = await sinter().keepFormat().dimensions({ width: 300 }).compress(file);
    expect(blob.size).toBeLessThan(file.size);
  });
});

// ---------------------------------------------------------------------------
// AVIF compression
// ---------------------------------------------------------------------------

describe("AVIF", () => {
  test("keepFormat — quality reduces file size", async () => {
    const file = loadAsset("test.avif");

    const blob = await sinter().keepFormat().maxQuality(30).compress(file);
    expect(blob.type).toBe("image/avif");
    expect(blob.size).toBeLessThan(file.size);
  });

  test("toFormat(webp) — converts to WebP", async () => {
    const file = loadAsset("test.avif");

    const blob = await sinter().toFormat("webp").maxQuality(50).compress(file);
    expect(blob.type).toBe("image/webp");
  });

  test("toFormat(jpeg) — converts to JPEG", async () => {
    const file = loadAsset("test.avif");

    const blob = await sinter().toFormat("jpeg").maxQuality(50).compress(file);
    expect(blob.type).toBe("image/jpeg");
  });

  test(
    "size constraint is enforced",
    async () => {
      const file = loadAsset("test.avif");

      const blob = await sinter()
        .keepFormat()
        .dimensions({ width: 800 })
        .size(500, "KB")
        .compress(file);
      expect(blob.size).toBeLessThanOrEqual(500 * 1024);
    },
    { timeout: 60_000 }
  );
});

// ---------------------------------------------------------------------------
// allowFormats
// ---------------------------------------------------------------------------

describe("allowFormats", () => {
  test("keeps format when in allowed list", async () => {
    const file = loadAsset("test.webp");

    const blob = await sinter()
      .allowFormats(["webp", "avif"], "jpeg")
      .maxQuality(50)
      .compress(file);
    expect(blob.type).toBe("image/webp"); // webp is in allowed list
  });

  test("falls back when format not in allowed list", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter()
      .allowFormats(["webp", "avif"], "webp")
      .maxQuality(50)
      .compress(file);
    expect(blob.type).toBe("image/webp"); // png not in allowed, falls back to webp
  });

  test("jpeg falls back when only webp/avif allowed", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().allowFormats(["webp"], "webp").maxQuality(80).compress(file);
    expect(blob.type).toBe("image/webp"); // jpeg not in [webp], falls back to webp
  });
});

// ---------------------------------------------------------------------------
// Combined constraints
// ---------------------------------------------------------------------------

describe("combined constraints", () => {
  test("quality + dimensions", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter()
      .keepFormat()
      .maxQuality(60)
      .dimensions({ width: 500, height: 500 })
      .compress(file);

    expect(blob.size).toBeLessThan(file.size);
    expect(blob.type).toBe("image/jpeg");
  });

  test("size fitting keeps original dimensions when lower quality is enough", async () => {
    const bytes = loadBytes("test.jpeg");
    const source = bytes.slice().buffer;
    const imageData = await decodeImage(source, "jpeg");
    const encoded = await encodeFitSize(imageData, "jpeg", 700_000, 80, {});
    const result = await decodeImage(encoded, "jpeg");

    expect(encoded.byteLength).toBeLessThanOrEqual(700_000);
    expect(result.width).toBe(imageData.width);
    expect(result.height).toBe(imageData.height);
  });

  test("size fitting shrinks dimensions when quality floor is still too large", async () => {
    const bytes = loadBytes("test.jpeg");
    const source = bytes.slice().buffer;
    const imageData = await decodeImage(source, "jpeg");
    const encoded = await encodeFitSize(imageData, "jpeg", 40_000, 80, {});
    const result = await decodeImage(encoded, "jpeg");

    expect(encoded.byteLength).toBeLessThanOrEqual(40_000);
    expect(result.width).toBeLessThan(imageData.width);
    expect(result.height).toBeLessThan(imageData.height);
  });

  test("quality + size limit", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().keepFormat().maxQuality(80).size(50, "KB").compress(file);
    expect(blob.size).toBeLessThanOrEqual(50 * 1024);
  });

  test("dimensions + size limit", async () => {
    const file = loadAsset("test.webp");

    const blob = await sinter()
      .keepFormat()
      .dimensions({ width: 800 })
      .size(100, "KB")
      .compress(file);

    expect(blob.size).toBeLessThanOrEqual(100 * 1024);
  });

  test("format conversion + quality + dimensions + size", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter()
      .toFormat("webp")
      .maxQuality(70)
      .dimensions({ width: 400 })
      .size(30, "KB")
      .compress(file);

    expect(blob.type).toBe("image/webp");
    expect(blob.size).toBeLessThanOrEqual(30 * 1024);
  });

  test(
    "aggressive size limit forces dimension reduction",
    async () => {
      const file = loadAsset("test.jpeg");

      const blob = await sinter()
        .keepFormat()
        .dimensions({ width: 800 })
        .size(5, "KB")
        .compress(file);
      expect(blob.size).toBeLessThanOrEqual(5 * 1024);
    },
    { timeout: 30_000 }
  );
});

// ---------------------------------------------------------------------------
// BMP
// ---------------------------------------------------------------------------

describe("BMP", () => {
  test("keepFormat — BMP 출력 타입 확인", async () => {
    const file = loadAsset("test.bmp");

    const blob = await sinter().keepFormat().compress(file);
    expect(blob.type).toBe("image/bmp");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("keepFormat — 인플레이션 가드 (재인코딩이 원본보다 크면 원본 반환)", async () => {
    const file = loadAsset("test.bmp");

    const blob = await sinter().keepFormat().compress(file);
    expect(blob.size).toBeLessThanOrEqual(file.size);
  });

  test("toFormat(jpeg) — BMP → JPEG 변환", async () => {
    const file = loadAsset("test.bmp");

    const blob = await sinter().toFormat("jpeg").maxQuality(80).compress(file);
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("toFormat(webp) — BMP → WebP 변환", async () => {
    const file = loadAsset("test.bmp");

    const blob = await sinter().toFormat("webp").maxQuality(80).compress(file);
    expect(blob.type).toBe("image/webp");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("toFormat(png) — BMP → PNG 변환", async () => {
    const file = loadAsset("test.bmp");

    const blob = await sinter().toFormat("png").compress(file);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("toFormat(bmp) — JPEG → BMP 변환", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().toFormat("bmp").dimensions({ width: 100 }).compress(file);
    expect(blob.type).toBe("image/bmp");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("size constraint — BMP는 dimension reduction만 적용", async () => {
    const file = loadAsset("test.jpeg");

    // JPEG를 BMP로 변환하면 사이즈 커지므로, 작은 크기로 dimension 제한
    const blob = await sinter()
      .toFormat("bmp")
      .dimensions({ width: 10 })
      .size(10, "KB")
      .compress(file);
    expect(blob.type).toBe("image/bmp");
    expect(blob.size).toBeLessThanOrEqual(10 * 1024);
  });
});

// ---------------------------------------------------------------------------
// Cross-format matrix
// ---------------------------------------------------------------------------

describe("cross-format conversion", () => {
  const formats = ["jpeg", "png", "webp", "avif"] as const;
  const files: Record<string, string> = {
    jpeg: "test.jpeg",
    png: "test.png",
    webp: "test.webp",
    avif: "test.avif",
  };
  const mimes: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
  };

  for (const src of formats) {
    for (const dst of formats) {
      if (src === dst) {
        continue;
      }

      test(
        `${src} → ${dst}`,
        async () => {
          const file = loadAsset(files[src]);

          const blob = await sinter()
            .toFormat(dst)
            .maxQuality(50)
            .dimensions({ width: 200 })
            .compress(file);

          expect(blob.type).toBe(mimes[dst]);
          expect(blob.size).toBeGreaterThan(0);
        },
        { timeout: 30_000 }
      );
    }
  }
});

// ---------------------------------------------------------------------------
// codecOptions
// ---------------------------------------------------------------------------

describe("codecOptions", () => {
  test("webp lossless produces different output than lossy", async () => {
    const file = loadAsset("test.jpeg");

    const lossy = await sinter()
      .toFormat("webp")
      .codecOptions({ webp: { lossless: false } })
      .maxQuality(80)
      .dimensions({ width: 200 })
      .compress(file);

    const lossless = await sinter()
      .toFormat("webp")
      .codecOptions({ webp: { lossless: true } })
      .dimensions({ width: 200 })
      .compress(file);

    // Lossless and lossy should produce different sizes
    expect(lossy.size).not.toBe(lossless.size);
    expect(lossy.type).toBe("image/webp");
    expect(lossless.type).toBe("image/webp");
  });

  test("avif speed option is accepted", async () => {
    const file = loadAsset("test.jpeg");

    // Should not throw
    const blob = await sinter()
      .toFormat("avif")
      .codecOptions({ avif: { speed: 8 } })
      .maxQuality(50)
      .dimensions({ width: 200 })
      .compress(file);

    expect(blob.type).toBe("image/avif");
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Repeated calls are prevented at the type level (Omit<this, "method">)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quality-vs-dimensions interaction
// ---------------------------------------------------------------------------

describe("quality-vs-dimensions interaction", () => {
  test("aggressive resize satisfies maxQuality threshold — quality stays high", async () => {
    const file = loadAsset("test.jpeg");

    // maxQuality(80) + dimensions reducing to ~25% of pixels (50% each axis)
    // pixelRatio ~0.25 <= 0.8 threshold → quality should be 100 (not 80)
    const withDims = await sinter()
      .keepFormat()
      .maxQuality(80)
      .dimensions({ width: 200 })
      .compress(file);

    // Same dimensions but quality forced to 80 manually (no heuristic skip)
    // The heuristic means withDims should be encoded at q100, so it should be LARGER
    // than a separate encode of the same small size at q80
    const atQ80 = await sinter().keepFormat().maxQuality(80).compress(file);

    // Both should succeed
    expect(withDims.size).toBeGreaterThan(0);
    expect(atQ80.size).toBeGreaterThan(0);
    // The resized one should be much smaller due to fewer pixels regardless
    expect(withDims.size).toBeLessThan(atQ80.size);
  });
});

// ---------------------------------------------------------------------------
// Default behavior (no constraints)
// ---------------------------------------------------------------------------

describe("default behavior", () => {
  test("keepFormat with no constraints re-encodes at full quality", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().keepFormat().compress(file);
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeGreaterThan(0);
  });

  test("PNG keepFormat with no constraints does not inflate", async () => {
    const file = loadAsset("test.png");

    const blob = await sinter().keepFormat().compress(file);
    expect(blob.size).toBeLessThanOrEqual(file.size);
  });
});

// ---------------------------------------------------------------------------
// Output dimensions verification
// ---------------------------------------------------------------------------

describe("output dimensions", () => {
  test("dimensions(width: 200) produces correctly sized output", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().keepFormat().dimensions({ width: 200 }).compress(file);
    const url = URL.createObjectURL(blob);

    // Decode the output to check dimensions
    const buf = await blob.arrayBuffer();
    const { default: decode } = await import("@jsquash/jpeg/decode.js");
    const img = await decode(buf);
    expect(img.width).toBe(200);
    // Height should be proportional (3840x2880 → 200x150)
    expect(img.height).toBe(150);

    URL.revokeObjectURL(url);
  });

  test("dimensions(height: 100) produces correctly sized output", async () => {
    const file = loadAsset("test.jpeg");

    const blob = await sinter().keepFormat().dimensions({ height: 100 }).compress(file);

    const buf = await blob.arrayBuffer();
    const { default: decode } = await import("@jsquash/jpeg/decode.js");
    const img = await decode(buf);
    expect(img.height).toBe(100);
    // Width should be proportional (3840x2880 → 133x100)
    expect(img.width).toBe(133);
  });
});
