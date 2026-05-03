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
  <a href="https://github.com/semanticist21/sinter/blob/main/packages/module/LICENSE"><img src="https://img.shields.io/npm/l/sinter-js" alt="license" /></a>
  <img src="https://img.shields.io/badge/runtime-browser-brightgreen" alt="browser" />
</p>

---

**Sinter** is a browser-side image compression library powered by WASM codecs.
No server round-trips. No backend costs. The user's browser does all the work.

- JPEG, PNG, WebP, AVIF, BMP
- Sinter-owned native WASM codecs for every supported format
- Resize, quality control, file size targeting
- Runs in a **Web Worker** so the UI stays responsive
- Fluent, type-safe API with compile-time guardrails
- Safe to import in SSR-capable apps; compression runs on the client

## Install

```bash
npm install sinter-js
```

> Sinter ships its own native WASM codecs for JPEG, PNG, WebP, AVIF, and BMP.
> Generated WASM artifacts are packaged in `dist` and loaded lazily per format.
> No `@jsquash/*` runtime packages are required.

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

Everything starts with `sinter()`, followed by one required format stage and any
optional compression settings:

```ts
await sinter()
  .toFormat("webp")
  .codecOptions({ webp: { lossless: false } })
  .maxQuality(80)
  .dimensions({ width: 1200 })
  .size(1, "MB")
  .timeout(30)
  .compress(file);
```

Only the format stage (`keepFormat`, `toFormat`, or `allowFormats`) is required.
Everything after it is optional. Each stage returns a narrowed type, so calling
the same method twice is a compile-time error.

### Format

| Method | Description |
|--------|-------------|
| `keepFormat()` | Output matches the input format |
| `toFormat(format)` | Always encode to the given format |
| `allowFormats(allowed, fallback)` | Keep input format if allowed, otherwise use fallback |

### Compression

| Method | Description |
|--------|-------------|
| `codecOptions(options)` | Set format-specific encoder options |
| `maxQuality(n)` | Set quality ceiling from `1` to `100` |
| `dimensions({ width?, height? })` | Resize within bounds while preserving aspect ratio |
| `size(value, unit)` | Best-effort output size target in `"KB"` or `"MB"` |
| `timeout(seconds)` | Reject if compression exceeds the time limit |

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

### Errors

```ts
import { SinterValidationError, SinterCodecError } from "sinter-js";
```

| Error | When |
|-------|------|
| `SinterValidationError` | Invalid input (bad quality range, empty file, etc.) |
| `SinterCodecError` | Codec failure, worker failure, timeout, or calling `compress()` outside a supported browser/Bun execution path |

## Native Codecs

Sinter owns the browser WASM boundary for every supported format. Each codec is
loaded only when that format is decoded or encoded.

| Format | Native backend | Notes |
|--------|----------------|-------|
| JPEG | MozJPEG built with Zig | `quality` and `{ progressive }`; alpha is dropped on encode and filled as `255` on decode |
| PNG | Rust `png` crate | Lossless RGBA encode/decode |
| WebP | libwebp built with Zig | `quality` and `{ lossless }` |
| AVIF | Rust `ravif` / `rav1d` path | `quality` and `{ speed }` |
| BMP | Local Rust codec | Uncompressed RGBA/BGRA path |

Generated WASM files are included in the published package:

```text
dist/jpeg.wasm
dist/png.wasm
dist/webp.wasm
dist/avif.wasm
dist/bmp.wasm
```

## How It Works

1. Detect the source format from magic bytes, not the file extension.
2. Resolve the output format from `keepFormat()`, `toFormat()`, or
   `allowFormats()`.
3. Decode with the matching WASM decoder.
4. Resize with `OffscreenCanvas` when `dimensions()` is set.
5. Encode once at the selected quality, or run best-effort size fitting when
   `size()` is set.
6. Return the original bytes when same-format re-encoding would only inflate the
   file and no resize or size target was requested.

For lossy formats, size fitting reduces quality first and then shrinks
dimensions. PNG uses `upng-js` palette quantization for the second phase before
dimension reduction. BMP is uncompressed, so quality settings do not affect it.

## Browser Only And SSR

Sinter does not touch browser globals at module import time, so importing it in
SSR-capable frameworks is safe.

Actual compression is browser-only. It uses `File`, `Blob`, `OffscreenCanvas`,
Web Workers, and WASM. Call `compress(file)` only from client-side code. If
`compress()` is called in a non-browser runtime without Bun's test/runtime path,
it rejects with `SinterCodecError`.

## Building From Source

The published package already includes generated WASM in `dist`. You only need
the native toolchain when building Sinter itself.

Prerequisites:

- Bun
- Zig `0.16.0`
- Rust with `wasm32-wasip1`
- CMake
- `git`, `curl`, and `tar`

On macOS with Homebrew:

```bash
brew install zig cmake
rustup target add wasm32-wasip1
```

Build and test:

```bash
bun install
bun --filter sinter-js build
bun --filter sinter-js test
bun run check
```

The native build downloads pinned codec sources into `~/.cache/sinter`, verifies
the pinned source where applicable, and keeps generated artifacts out of tracked
source. `bun --filter sinter-js test` rebuilds `dist` and includes smoke tests
that import the built package.

## License

MIT. Third-party codec notices are included in
`packages/module/THIRD_PARTY_NOTICES.md`.
