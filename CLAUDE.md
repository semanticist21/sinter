# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** - 브라우저용 이미지 압축 라이브러리 (Bun Workspace Monorepo)

## Structure

```
packages/
├── web/          # @sinter/web - 메인 라이브러리 (TypeScript)
└── wasm/         # @sinter/wasm - WASM 이미지 코덱 (C)
```

## Commands

```bash
bun install              # 의존성 설치
bun run dev              # @sinter/web watch mode
bun run build            # 모든 패키지 빌드
bun run check            # Biome + TypeScript 검사
bun run fix              # 자동 포맷 + lint
```

### Package-specific

```bash
bun --filter @sinter/web dev      # web 패키지만 dev
bun --filter @sinter/web build    # web 패키지만 빌드
```

## Packages

### @sinter/web

브라우저용 이미지 압축 라이브러리. EXIF 메타데이터 보존 옵션 지원.

- **Supported Formats**: JPEG, PNG, WebP, AVIF, HEIC
- **Build**: rslib (ESM + CJS)

### @sinter/wasm

WASM 이미지 코덱 (JPEG encode/decode). 현재 scaffolding 단계.

## Code Style

- **Biome**: 2-space indent, 100-char line width
- **TypeScript**: Strict mode
- Worker 파일은 `.worker.ts` 접미사 필수
