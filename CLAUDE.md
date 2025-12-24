# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** is an image compression library for the browser. Reduces image file sizes while maintaining quality and optionally preserving EXIF metadata. Supports JPEG, PNG, WebP, AVIF formats.

**Core API**: `src/index.ts` exports `CompressImage(file, options)` → `Promise<File>`
**Language**: TypeScript

## Architecture

```
sinter/
├── src/
│   ├── index.ts          # Public CompressImage() API + types
│   ├── utils.ts          # convertToBytes() (byte unit conversion)
│   └── internal/         # Internal modules
├── rslib.config.ts       # Library build config (ESM + CJS)
├── package.json          # Dependencies + build scripts
├── tsconfig.json         # Strict TypeScript
└── biome.json            # Formatting: 2-space, 100-char line width
```

## Build & Development

### Commands

```bash
bun install              # Install dependencies
bun run dev              # Watch mode
bun run build            # Build for production
bun run check            # Biome check + TypeScript type check
bun run fix              # Auto-format + type check
bun run test             # Run tests
```

## Public API

### Function

```typescript
export async function CompressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File>
```

### Types

```typescript
export type MaxSize = {
  value: number;
  unit: "KB" | "MB" | "GB";
};

export type CompressImageOptions = {
  format?: "jpeg" | "png" | "webp" | "avif";
  maxWidth?: number;
  maxHeight?: number;
  maxSize?: MaxSize;
  preserveExif?: boolean;
};
```

## Code Quality

| Tool | File | Notes |
|------|------|-------|
| TypeScript | `tsconfig.json` | Strict mode, ES2020 target |
| Biome | `biome.json` | 2-space indent, 100-char line width |

### Pre-Commit

```bash
bun run fix    # Auto-format + lint
bun run check  # Verify (blocking if errors)
```
