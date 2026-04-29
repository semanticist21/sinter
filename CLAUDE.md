# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** is a Bun workspace monorepo for a browser-only image compression library and its demo app.

- `packages/module`: published package `sinter-js`
- `packages/demo`: local demo app used to validate library behavior before release

## Common Commands

```bash
bun install
bun run build
bun run check
bun run fix
bun run dev
bun run demo
bun --filter sinter-js build
bun --filter sinter-js test
bun test packages/module/test/sinter.test.ts
bun --filter sinter-js test -- --test-name-pattern "detects AVIF"
bun --filter @sinter/demo build
bun --filter @sinter/demo dev
```

### Command Notes

- `bun run check` runs Biome plus TypeScript checks across the workspace.
- `bun run fix` applies Biome formatting fixes.
- `bun run dev` starts only the demo app.
- `bun run demo` rebuilds `sinter-js` first, then starts the demo app on port `4173`.
- The demo resolves `sinter-js` from `packages/module/dist/index.mjs`, so rebuild the module after library changes if you are not using `bun run demo`.
- Module tests run with Bun and use the non-worker execution path.

## Architecture

### Workspace shape

- Root `package.json` orchestrates workspace-wide build/check/fix commands.
- `packages/module` is the real product: a fluent API around image format selection, codec options, resizing, size targeting, and worker execution.
- `packages/demo` is a React 19 + Rspack + Tailwind v4 playground that exercises the built module locally.

### Fluent API pipeline

The public API starts at `packages/module/src/index.ts` and returns `SinterFormatStage`.
The chain is split into staged classes so invalid call order is prevented by the type system:

1. `format.ts` — choose output policy with `keepFormat()`, `toFormat()`, or `allowFormats()`
2. `codec.ts` — attach format-specific codec options
3. `builder.ts` — add shared controls like `maxQuality()`, `dimensions()`, `size()`, `timeout()`, then call `compress()`

This is enforced with a shared mutable `PipelineConfig`, not a recorded step array.
Repeated calls like `maxQuality()` or `size()` are blocked at compile time via `Omit<this, ...>` return types.

### Execution model

`builder.ts` chooses between two execution paths:

- Browser: spawns `dist/worker.mjs` via `new Worker(new URL("./worker.mjs", import.meta.url))`
- Bun tests / non-browser: imports `executePipeline()` directly from `pipeline.ts`

`worker.ts` is only a thin message bridge that converts thrown errors into typed worker messages.
Core compression logic lives in `pipeline.ts` and is shared by both paths.

### Compression pipeline internals

`packages/module/src/pipeline.ts` does the real work in this order:

1. detect source format
2. resolve output format from the format policy
3. decode to `ImageData`
4. resize with `OffscreenCanvas` if needed
5. choose encode quality
6. encode once, or run size-fitting if `size()` is set
7. apply the inflation guard when same-format re-encoding would enlarge the file

Important behavior to preserve:

- Heavy work is designed around a single decode/resize/encode flow to avoid repeated generation loss.
- `size()` is best-effort.
- Lossy formats use quality reduction first, then dimension reduction.
- PNG uses `upng-js` palette quantization when targeting smaller output.
- JPEG uses Sinter's native MozJPEG WASM codec built through Zig.
- BMP uses a local pure TypeScript codec in `bmp.ts` instead of `@jsquash/*`.
- If the output format matches the input, no resize happened, and no size limit is set, larger re-encodes return the original bytes.

### Format detection and codec boundaries

`detect.ts` uses magic bytes, not file extensions.
AVIF detection scans early ISOBMFF boxes for `ftyp`, so valid AVIF files with leading boxes still detect correctly.
Current supported formats are `jpeg`, `png`, `webp`, `avif`, and `bmp`.

Codec boundaries are split like this:

- `src/codecs/jpeg.ts` plus `native/jpeg/sinter_jpeg.c` for JPEG decode/encode
- `src/codecs/avif.ts` plus `native/avif` for AVIF decode/encode
- `@jsquash/png` and `@jsquash/webp` for remaining WASM codec paths
- `bmp.ts` for BMP decode/encode
- `types.ts` for the format policy, worker protocol, and shared config types

### Demo app coupling

The demo’s Rspack config aliases `sinter-js` to `../module/dist/index.mjs` and enables `asyncWebAssembly`.
That means demo behavior reflects the built output, not the raw TypeScript source.
When debugging demo issues after module edits, confirm the module has been rebuilt.

## Testing Notes

- Main coverage lives in `packages/module/test/sinter.test.ts`.
- Tests cover format detection, validation, cross-format conversion, size targeting, and regression cases in the fitting pipeline.
- Test assets live in `assets/test/` and are shared across module tests.

## Tooling Notes

- Biome is the formatter/linter: 2 spaces, 100-char line width, trailing commas `es5`.
- Biome explicitly excludes `.claude` paths to avoid nested-root errors from Claude worktrees.
- TypeScript is strict and ESM-only.
- `tsdown` builds the module output, including both the main entry and worker entry.
