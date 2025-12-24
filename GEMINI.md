# Sinter

Sinter is an image compression library for the browser. It reduces image file sizes while maintaining quality and optionally preserving EXIF metadata.

## Project Overview

* **Goal**: Efficient, browser-based image compression.
* **Core Tech**: TypeScript, Rslib.
* **Supported Formats**:
  * Input: JPEG, PNG, WebP, AVIF.
  * Output: JPEG, PNG, WebP, AVIF.
* **Key Features**:
  * Aspect ratio preservation.
  * Target file size constraints.
  * EXIF metadata preservation.

## Tech Stack

* **Language**: TypeScript
* **Runtime**: Node.js 18+ or Bun 1.0+.
* **Build Tools**:
  * **Bundler**: `@rslib/core`.
  * **Lint/Format**: `@biomejs/biome`.
* **Testing**: `@rstest/core`.

## Build & Run

### Prerequisites

* **Node.js** (18+) or **Bun**

### Setup

```bash
bun install
```

### Commands

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start development watch mode. |
| `bun run build` | Build for production. Output to `dist/`. |
| `bun run check` | Run all checks (Biome + TypeScript). |
| `bun run fix` | Auto-fix formatting and linting issues. |
| `bun run test` | Run tests. |

## Project Structure

```
sinter/
├── src/                        # TypeScript Source
│   ├── index.ts                # Public API
│   ├── utils.ts                # Utilities
│   └── internal/               # Internal modules
├── dist/                       # Build output (ESM/CJS/Types)
├── rslib.config.ts             # Rslib configuration
├── biome.json                  # Biome lint/format config
├── tsconfig.json               # TypeScript configuration
└── package.json                # Project scripts and deps
```

## Development Conventions

* **Commits**: Follow **Conventional Commits** (e.g., `feat: add avif support`).
* **Formatting**: Strictly enforced via **Biome** (2-space indent, 100-char line width).
  * Run `bun run fix` before committing.
* **Testing**:
  * Place tests in `src/__tests__/` or `src/internal/__tests__/`, name with `.test.ts` suffix.

## Public API

See `src/index.ts` for `CompressImage()` function signature and types.
