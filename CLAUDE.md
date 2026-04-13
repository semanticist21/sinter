# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** - High-performance browser image compression library (Bun workspace monorepo)

## Structure

```
packages/
├── module/    # @sinter/module - TypeScript library (built with tsdown)
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
bun --filter @sinter/module build    # Build only the module
bun --filter @sinter/demo dev        # Start only the demo dev server
```

## Packages

### @sinter/module
- **Build**: `tsdown`
- **Output**: `dist/index.mjs` + `dist/index.d.mts`

### @sinter/demo
- **Stack**: Rspack + React 19 + Tailwind CSS v4
- **Purpose**: Demo app for testing library behavior before release
- **Dev**: References `@sinter/module` dist directly through an rspack alias

## Code Style

- **Biome**: 2-space indent, 100-char line width, trailing commas (ES5)
- **TypeScript**: Strict mode, ESM only

## Git Convention

- **Commit**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `build:`, `docs:`, `chore:`)

## API Design Decisions (@sinter/module)

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
  .run()                // Terminal method, returns Promise<Blob>
```

### Key Decisions
- **Terminal method**: `.run()` to avoid clashing with the `compress()` entry point
- **Compression execution**: Single-pass to avoid generation loss — decode -> resize -> encode once
- **Pipeline**: Record call order in a `pipeline[]` array, then translate it into a single pass with @jsquash at `run()`
- **Codec options stage**: `codecOptions()` holds format-specific encoder settings after the output format policy is chosen
- **`maxQuality` vs `size`**: If `size` is set, lower the quality until the size target is met; otherwise keep `maxQuality`
- **Quality vs codec options**: Keep quality on `maxQuality()` so shared quality rules do not compete with format-specific options
- **Repeated `dimensions` calls**: Last call wins and emits `console.warn`
- **Repeated `maxQuality` calls**: `maxQuality(80).maxQuality(90)` is last-wins
- **Codecs**: `@jsquash/avif`, `@jsquash/webp`, `@jsquash/jpeg`, `@jsquash/png` (browser WASM)
- **Worker separation**: Initial implementation stays on the main thread; internals can move to a Worker later without changing the interface
