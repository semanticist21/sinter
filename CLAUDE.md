# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** - 브라우저용 고성능 이미지 압축 라이브러리 (Bun Workspace Monorepo)

## Structure

```
packages/
├── web/    # @sinter/web - TypeScript 라이브러리 (tsgo 빌드)
└── wasm/   # @sinter/wasm - Zig WASM 코덱
```

## Commands

```bash
bun install        # 의존성 설치
bun run build      # 전체 빌드 (web: tsgo, wasm: zig)
bun run check      # Biome lint + TypeScript 타입 체크
bun run fix        # Biome 자동 포맷
bun run update     # 의존성 + zig 업데이트
```

### Package-specific

```bash
bun --filter @sinter/web build     # web만 빌드
bun --filter @sinter/wasm build    # wasm만 빌드
```

## Packages

### @sinter/web
- **Build**: `tsgo` (TypeScript Native Preview)
- **Output**: `dist/index.js` + `dist/index.d.ts`

### @sinter/wasm
- **Build**: `zig build-exe` → `wasm32-freestanding`
- **Output**: `dist/main.wasm`

## Code Style

- **Biome**: 2-space indent, 100-char line width, trailing commas (ES5)
- **TypeScript**: Strict mode, ESM only

## Git Convention

- **Commit**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `build:`, `docs:`, `chore:`)
