# Sinter

Sinter is a high-performance image compression library that combines **Rust WASM** for heavy processing with **TypeScript** for a seamless developer experience. It reduces image file sizes while maintaining quality and optionally preserving EXIF metadata.

## 🚀 Project Overview

* **Goal**: Efficient, browser-based image compression using WebAssembly.
* **Core Tech**: Rust (WASM), TypeScript, Rslib, Worker Threads.
* **Supported Formats**:
  * Input: JPEG, PNG, WebP, AVIF.
  * Output: JPEG, PNG, AVIF (WebP falls back to PNG).
* **Key Features**:
  * Aspect ratio preservation.
  * Target file size constraints (iterative quality reduction).
  * EXIF metadata preservation.
  * Non-blocking execution via Web Workers.

## 🛠 Tech Stack

* **Languages**: TypeScript (Frontend/API), Rust (Core Logic).
* **Runtime**: Node.js 18+ or Bun 1.0+.
* **Build Tools**:
  * **Rust**: `cargo`, `wasm-pack`.
  * **Bundler**: `@rslib/core`.
  * **Lint/Format**: `@biomejs/biome`.
* **Testing**: `@rstest/core` (Vitest wrapper).

## 🏗 Architecture

The project follows a "Rust Core, TypeScript Shell" architecture:

1. **`wasm/` (Rust Core)**:
    * Handles all image processing: decoding, resizing (Lanczos3), encoding, and EXIF manipulation.
    * Compiles to WebAssembly using `wasm-pack`.
    * Exposes a `compress_image` function to JavaScript.
2. **`src/` (TypeScript Shell)**:
    * `index.ts`: Public API entry point. Manages the Web Worker.
    * `compress.worker.ts`: Dedicated worker that loads the WASM module and executes compression off the main thread.
3. **`dist/` (Output)**:
    * Dual-build: ESM (`index.js`) and CommonJS (`index.cjs`).
    * Includes inline WASM for easy distribution.

## 📦 Build & Run

### Prerequisites

* **Node.js** (18+) or **Bun**
* **Rust** (1.70+) with `wasm32-unknown-unknown` target.

### Setup

The project uses a local linked package for the WASM module.

```bash
# Link the WASM package (only needed once)
cd wasm/pkg && bun link
cd ../..
bun link sinter-wasm

# Install dependencies
bun install
```

### Commands

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start development watch mode (rebuilds TS and WASM on change). |
| `bun run build` | Full release build: Cargo → wasm-pack → rslib. Output to `dist/`. |
| `bun run check` | Run all checks: Biome lint, TypeScript check, and Cargo check. |
| `bun run fix` | Auto-fix formatting and linting issues (JS/TS & Rust). |
| `bun run test` | Run tests using `rstest`. |
| `bun run rust:check` | Run `cargo check` only. |

## 📂 Project Structure

```
sinter/
├── src/                        # TypeScript Source
│   ├── index.ts                # Public API
│   ├── compress.worker.ts      # Web Worker entry point
│   ├── utils.ts                # Utilities
│   └── __tests__/              # Integration tests
├── wasm/                       # Rust Source
│   ├── Cargo.toml              # Rust dependencies
│   ├── src/
│   │   ├── lib.rs              # WASM entry point
│   │   ├── format.rs           # Format detection
│   │   ├── formats/            # Format-specific logic (jpeg, png, avif)
│   │   ├── resize.rs           # Resizing logic
│   │   └── exif.rs             # EXIF handling
│   └── pkg/                    # Generated WASM package (do not edit)
├── dist/                       # Build output (ESM/CJS/Types)
├── rslib.config.ts             # Rslib configuration
├── biome.json                  # Biome lint/format config
└── package.json                # Project scripts and deps
```

## 📝 Development Conventions

* **Commits**: Follow **Conventional Commits** (e.g., `feat: add avif support`, `fix: resize logic`).
* **Formatting**: Strictly enforced via **Biome**. Run `bun run fix` before committing.
* **Testing**:
  * Place tests in `src/__tests__/` (integration) or `src/internal/__tests__/` (unit).
  * Files should end in `.test.ts`.
* **WASM Changes**:
  * If you modify Rust code (`wasm/src/`), `bun run dev` will auto-rebuild it.
  * If you change the public Rust API, you must update the TypeScript wrapper (`src/compress.worker.ts` / `src/index.ts`) to match.
* **Publishing**:
  * `dist/` directory **must** be committed to git, as it contains the artifacts published to npm.
  * Run `bun run build` before versioning/publishing.
