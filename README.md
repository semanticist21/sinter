<p align="center">
  <img src="https://raw.githubusercontent.com/semanticist21/sinter/main/assets/logo-white.webp" alt="Sinter Logo" />
</p>

<h1 align="center">Sinter</h1>

<p align="center">
  Let the user compress their own images.<br/>
  Release your server from the burden.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sinter/module"><img src="https://img.shields.io/npm/v/@sinter/module" alt="npm" /></a>
  <a href="https://github.com/semanticist21/sinter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@sinter/module" alt="license" /></a>
  <img src="https://img.shields.io/badge/runtime-browser-brightgreen" alt="browser" />
</p>

---

**Sinter** is a browser-side image compression library powered by WASM codecs.
No server round-trips. No backend costs. The user's browser does all the work.

- JPEG, PNG, WebP, AVIF
- Resize, quality control, file size targeting
- Fluent, type-safe API with compile-time guardrails
- Zero server load

## Install

```bash
npm install @sinter/module
```

> `@jsquash/*` WASM codec packages are included as dependencies and loaded on demand.

## Quick Start

```ts
import { compress } from "@sinter/module";

const blob = await compress(file)
  .toFormat("webp")
  .maxQuality(80)
  .dimensions({ width: 1200 })
  .run();
```

## API

Everything starts with `compress(file)`, then flows through stages:

```
compress(file: File)
  .keepFormat()                              // keep the original format
  .toFormat("webp")                          // convert to a specific format
  .allowFormats(["avif", "webp"], "webp")    // keep if allowed, otherwise fallback

  .codecOptions({ webp: { lossless: false } })  // format-specific encoder options

  .maxQuality(80)                            // quality ceiling (1-100)
  .dimensions({ width: 1200 })               // resize constraints
  .size(1, "MB")                             // file size target

  .run()                                     // execute, returns Promise<Blob>
```

Each stage returns a narrowed type. **Calling the same method twice is a compile-time error** — no silent overwrites.

### Format Stage

| Method | Description |
|--------|-------------|
| `keepFormat()` | Output matches the input format |
| `toFormat(format)` | Always encode to the given format |
| `allowFormats(allowed, fallback)` | Keep input format if allowed, otherwise use fallback |

### Codec Options

```ts
compress(file)
  .toFormat("avif")
  .codecOptions({ avif: { speed: 4 } })
  .run();
```

| Format | Options |
|--------|---------|
| `jpeg` | `{ progressive?: boolean }` |
| `webp` | `{ lossless?: boolean }` |
| `avif` | `{ speed?: number }` |
| `png` | *(none — lossless)* |

### Compression

| Method | Description |
|--------|-------------|
| `maxQuality(n)` | Sets quality ceiling (1-100). May be lowered further to meet `size()`. |
| `size(value, unit)` | Target file size (`"KB"` or `"MB"`). Uses quality binary search, then dimension reduction. |
| `dimensions({ width?, height? })` | Resize within bounds, preserving aspect ratio. |

### Errors

```ts
import { SinterValidationError, SinterCodecError } from "@sinter/module";
```

| Error | When |
|-------|------|
| `SinterValidationError` | Invalid input (bad quality range, empty file, etc.) |
| `SinterCodecError` | WASM codec decode/encode failure |

## How It Works

1. **Detect** format via magic bytes (not file extension)
2. **Decode** with the matching `@jsquash/*` WASM decoder
3. **Resize** on canvas if `dimensions()` is set
4. **Encode** to the target format at the determined quality
5. **Fit size** — if `size()` is set, binary-search quality then reduce dimensions until target is met

Single decode-encode pass. No generation loss from repeated re-encoding.

## Browser Only

Sinter uses `File`, `Blob`, `OffscreenCanvas`, and WASM — it runs in modern browsers, not Node.js.

## License

MIT
