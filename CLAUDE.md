# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** - High-performance browser image compression library (Bun workspace monorepo)

## Structure

```
packages/
├── module/    # sinter-js - TypeScript library (built with tsdown)
└── demo/      # @sinter/demo - Demo app (Rspack + React + Tailwind)
```

## Commands

```bash
bun install        # Install dependencies
bun run build      # Build everything
bun run check      # Run Biome lint + TypeScript type checks (read-only)
bun run fix        # Apply Biome formatting and safe fixes (--write)
bun run demo       # Build module, then start the demo dev server (port 4173)
bun run dev        # Start only the demo dev server (does not build module)
bun run update     # Update dependencies
```

### Package-specific

```bash
bun --filter sinter-js build    # Build only the module
bun --filter sinter-js test     # Run tests (bun test, 68 tests, ~50s)
bun --filter @sinter/demo dev        # Start only the demo dev server
```

## Packages

### sinter-js
- **Build**: `tsdown` (externalizes `@jsquash/*`)
- **Output**: `dist/index.mjs` + `dist/index.d.mts`
- **Test**: `bun test` with polyfills for `ImageData`/`OffscreenCanvas` (see `test/setup.ts`)
- **Test assets**: `assets/test/` has test.jpeg, test.png, test.webp, test.avif
- **Codecs**: `@jsquash/*` packages use WASM; dynamic `import()` with `.js` extension required for ESM resolution

### @sinter/demo
- **Stack**: Rspack + React 19 + Tailwind CSS v4 + shadcn/ui (green theme)
- **Purpose**: Demo app for testing library behavior before release
- **Dev**: References `sinter-js` dist directly through an rspack alias
- **WASM**: `experiments.asyncWebAssembly` enabled in rspack config

## Code Style

- **Biome**: 2-space indent, 100-char line width, trailing commas (ES5)
- **TypeScript**: Strict mode, ESM only

## Git Convention

- **Commit**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `build:`, `docs:`, `chore:`)

## API Design Decisions (sinter-js)

### Entry Point and Chaining Shape
```
compress(file: File)
  .keepFormat() | .toFormat(format) | .allowFormats(allowed, to)
  .codecOptions({ webp: { lossless: false } }) // Format-specific codec options
  .maxQuality(80)       // Quality ceiling when no size constraint is set
  .size(1, 'MB')        // File size constraint (both value and unit are required)
  .dimensions({ width: 300 })              // Resize by width only
  .dimensions({ height: 200 })             // Resize by height only
  .dimensions({ width: 300, height: 200 }) // Resize width and height together
  .timeout(30)          // Timeout in seconds (rejects if exceeded)
  .run()                // Terminal method, returns Promise<Blob>
```

### Key Decisions
- **Terminal method**: `.run()` to avoid clashing with the `compress()` entry point
- **Compression execution**: Single-pass to avoid generation loss — decode -> resize -> encode once
- **Pipeline**: Record call order in a `pipeline[]` array, then translate it into a single pass with @jsquash at `run()`
- **Codec options stage**: `codecOptions()` holds format-specific encoder settings after the output format policy is chosen
- **`maxQuality` vs `size`**: If `size` is set, lower the quality until the size target is met; otherwise keep `maxQuality`
- **Quality vs codec options**: Keep quality on `maxQuality()` so shared quality rules do not compete with format-specific options
- **Duplicate call prevention**: `maxQuality()`, `dimensions()`, `size()` return `Omit<this, "method">` — calling the same method twice is a compile-time error
- **Codecs**: `@jsquash/avif`, `@jsquash/webp`, `@jsquash/jpeg`, `@jsquash/png` (browser WASM)
- **Web Worker**: `run()` offloads the entire pipeline (decode → resize → encode) to a dedicated Worker to keep the UI responsive. Falls back to direct execution in non-browser environments (bun test)
- **Timeout**: `.timeout(seconds)` rejects with `SinterCodecError` and terminates the Worker if compression exceeds the limit

### Implementation Notes
- **Pipeline state**: Uses shared mutable `PipelineConfig` object (not a `pipeline[]` array) — functionally equivalent to spec, enforced by the type-safe stage chain
- **Size enforcement**: Two-phase approach — Phase 1: quality binary search (lossy only), Phase 2: dimension reduction (70% per step, max 8 steps). Emits `console.warn` if target not met
- **PNG**: Lossless format — `maxQuality` has no effect; size constraint uses dimension reduction only
- **WebP lossless**: `codecOptions({ webp: { lossless: true } })` converts `boolean` to `number` (0/1) for the encoder
- **Inflation guard**: When same format, no actual resize, no size limit — returns original bytes if re-encode inflates
- **Quality-vs-dimensions heuristic**: If dimension reduction brings pixel count ≤ `maxQuality/100`, encoder quality is set to 100 (dimension reduction already satisfies the quality goal)
- **Format detection**: Magic bytes only (not file extension) — JPEG `FF D8 FF`, PNG `89 50 4E 47...`, WebP `RIFF...WEBP`, AVIF ftyp box with `avif`/`avis`/`mif1` brand
- **Worker build**: `tsdown` produces two entries — `dist/index.mjs` (main) + `dist/worker.mjs` (worker). The worker is loaded via `new URL("./worker.mjs", import.meta.url)` pattern recognized by Rspack/Vite/Webpack
- **Canvas**: Uses `OffscreenCanvas` only (no `document.createElement` fallback) — runs in Worker context
