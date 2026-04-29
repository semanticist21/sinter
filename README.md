<p align="center">
  <img src="https://raw.githubusercontent.com/semanticist21/sinter/main/assets/logo-white.webp" alt="Sinter Logo" />
</p>

<h1 align="center">Sinter</h1>

<p align="center">
  Let the user compress their own images.<br/>
  Release your server from the burden.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sinter-js"><img src="https://img.shields.io/npm/v/sinter-js" alt="npm" /></a>
  <a href="https://github.com/semanticist21/sinter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/sinter-js" alt="license" /></a>
  <img src="https://img.shields.io/badge/runtime-browser-brightgreen" alt="browser" />
</p>

---

**Sinter** is a browser-side image compression library powered by WASM codecs.
No server round-trips. No backend costs. The user's browser does all the work.

- JPEG, PNG, WebP, AVIF, BMP
- Resize, quality control, file size targeting
- Runs in a **Web Worker** — UI never blocks
- Fluent, type-safe API with compile-time guardrails
- Zero server load

## Install

```bash
npm install sinter-js
```

> Sinter ships its own native WASM codecs for JPEG, PNG, WebP, AVIF, and BMP.
> Generated WASM artifacts are packaged in `dist` and loaded lazily per format.

## Quick Start

```ts
import { sinter } from "sinter-js";

const blob = await sinter()
  .toFormat("webp")
  .maxQuality(80)
  .dimensions({ width: 1200 })
  .compress(file);
```

Pipeline settings can be stored and reused across multiple files:

```ts
const pipeline = sinter()
  .toFormat("webp")
  .maxQuality(80)
  .dimensions({ width: 1200 });

const blob1 = await pipeline.compress(file1);
const blob2 = await pipeline.compress(file2);
```

## API

Everything starts with `sinter()`, then flows through stages:

```
sinter()
  .keepFormat()                              // keep the original format
  .toFormat("webp")                          // convert to a specific format
  .allowFormats(["avif", "webp"], "webp")    // keep if allowed, otherwise fallback

  .codecOptions({ webp: { lossless: false } })  // format-specific encoder options

  .maxQuality(80)                            // quality ceiling (1-100)
  .dimensions({ width: 1200 })               // resize constraints
  .size(1, "MB")                             // file size target
  .timeout(30)                               // timeout in seconds

  .compress(file: File)                      // execute, returns Promise<Blob>
```

Only the format stage (`keepFormat`, `toFormat`, or `allowFormats`) is required. Everything after it — `codecOptions`, `maxQuality`, `dimensions`, `size`, `timeout` — is optional. Chain what you need, skip what you don't.

Each stage returns a narrowed type. **Calling the same method twice is a compile-time error** — no silent overwrites.

### Format Stage

| Method | Description |
|--------|-------------|
| `keepFormat()` | Output matches the input format |
| `toFormat(format)` | Always encode to the given format |
| `allowFormats(allowed, fallback)` | Keep input format if allowed, otherwise use fallback |

### Codec Options

```ts
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
| `png` | *(none — lossless)* |
| `bmp` | *(none — uncompressed lossless)* |

### Compression

| Method | Description |
|--------|-------------|
| `maxQuality(n)` | Sets quality ceiling (1-100). May be lowered further to meet `size()`. |
| `size(value, unit)` | Try to fit the output within this size (`"KB"` or `"MB"`). Reduces quality first, then shrinks dimensions if needed. The target is best-effort — a warning is logged if it cannot be met. |
| `dimensions({ width?, height? })` | Resize within bounds, preserving aspect ratio. |
| `timeout(seconds)` | Rejects with error if compression exceeds the time limit. No timeout by default. |

### Errors

```ts
import { SinterValidationError, SinterCodecError } from "sinter-js";
```

| Error | When |
|-------|------|
| `SinterValidationError` | Invalid input (bad quality range, empty file, etc.) |
| `SinterCodecError` | WASM codec decode/encode failure |

## How It Works

1. **Detect** format via magic bytes / ISOBMFF brands (not file extension)
2. **Decode** with the matching WASM decoder
3. **Resize** on canvas if `dimensions()` is set
4. **Encode** to the target format at the determined quality using Sinter-owned
   native WASM codecs
5. **Fit size** — if `size()` is set, lossy formats reduce quality first down to a floor, then shrink dimensions step-by-step until the target is met (best-effort)

Single decode-encode pass. No generation loss from repeated re-encoding.

**Inflation guard** — if the output format matches the input, no resize was applied, and no size target was set, Sinter returns the original bytes whenever re-encoding would produce a larger file.

All heavy lifting runs in a **Web Worker**, so the main thread stays responsive.

## Browser Only

Sinter uses `File`, `Blob`, `OffscreenCanvas`, Web Workers, and WASM — it runs in modern browsers, not Node.js.

## License

MIT
