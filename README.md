<p align="center">
  <img src="https://raw.githubusercontent.com/semanticist21/sinter/main/assets/logo-white.webp" alt="Sinter Logo" />
</p>

<h1 align="center">Sinter</h1>

<p align="center">
  Browser image compression for JPEG, PNG, WebP, AVIF, and BMP.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sinter-js"><img src="https://img.shields.io/npm/v/sinter-js" alt="npm" /></a>
  <a href="https://github.com/semanticist21/sinter/blob/main/packages/module/LICENSE"><img src="https://img.shields.io/npm/l/sinter-js" alt="license" /></a>
  <img src="https://img.shields.io/badge/runtime-browser-brightgreen" alt="browser" />
</p>

---

**Sinter** is a browser-side image compression library for apps that need image
files smaller before upload, preview, or download. It takes a browser `File`,
applies the options you choose, and returns a compressed image `Blob`.

- JPEG, PNG, WebP, AVIF, BMP
- Keep the input format or convert to another supported format
- Resize, quality control, and best-effort file size targeting
- Runs compression off the main UI flow in supported browsers
- Safe to import in SSR-capable apps; compression runs on the client

## Install

```bash
npm install sinter-js
```

## Basic Usage

```js
import { sinter } from "sinter-js";

const blob = await sinter()
  .toFormat("webp")
  .maxQuality(80)
  .dimensions({ width: 1200 })
  .compress(file);
```

Pipeline settings can be reused:

```js
const pipeline = sinter()
  .toFormat("webp")
  .maxQuality(80)
  .dimensions({ width: 1200 });

const firstBlob = await pipeline.compress(firstFile);
const secondBlob = await pipeline.compress(secondFile);
```

## API

Start with `sinter()`, choose an output format policy, then add any compression
options before calling `compress(file)`.

```js
await sinter()
  .allowFormats(["avif", "webp"], "webp")
  .codecOptions({ webp: { lossless: false } })
  .maxQuality(80)
  .dimensions({ width: 1200 })
  .size(1, "MB")
  .timeout(30)
  .compress(file);
```

### Format

| Method | Description |
|--------|-------------|
| `keepFormat()` | Use the input format for the output |
| `toFormat(format)` | Encode to one output format |
| `allowFormats(allowed, fallback)` | Keep the input format when it is allowed; otherwise use `fallback` |

Supported formats:

```js
"jpeg" | "png" | "webp" | "avif" | "bmp"
```

### Compression

| Method | Description |
|--------|-------------|
| `codecOptions(options)` | Set encoder options for formats this pipeline can produce |
| `maxQuality(n)` | Set the maximum quality from `1` to `100` |
| `dimensions({ width?, height? })` | Resize within the given bounds while preserving aspect ratio |
| `size(value, unit)` | Try to fit the output under a target size; `unit` must be `"KB"` or `"MB"` |
| `timeout(seconds)` | Reject if compression takes longer than the limit |
| `compress(file)` | Run the pipeline and return a `Blob` |

### Codec Options

```js
sinter()
  .toFormat("avif")
  .codecOptions({ avif: { speed: 4 } })
  .compress(file);
```

| Format | Options |
|--------|---------|
| `jpeg` | `{ progressive?: boolean }` |
| `webp` | `{ lossless?: boolean }` |
| `avif` | `{ speed?: number }` |
| `png` | None |
| `bmp` | None |

## Behavior

- Input format is detected from file bytes, not the file extension.
- `size()` is best effort. Some images may not fit the requested target.
- For lossy output formats, size fitting lowers quality before reducing dimensions.
- `maxQuality()` does not change BMP output quality.
- If same-format compression would make the file larger, Sinter returns the
  original bytes when no resize or size target was requested.

## Browser And SSR

Sinter can be imported in SSR-capable apps because it does not access browser
globals at import time.

Call `compress(file)` from browser client code. Other runtimes are not part of
the public API and may reject with `SinterCodecError`.

## Errors

```js
import { SinterValidationError, SinterCodecError } from "sinter-js";
```

| Error | When |
|-------|------|
| `SinterValidationError` | Invalid input, such as an empty file or an out-of-range option |
| `SinterCodecError` | Compression failed, timed out, or ran outside the public browser API path |

## License

MIT. Third-party notices are included in
`packages/module/THIRD_PARTY_NOTICES.md`.
