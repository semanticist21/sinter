# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** - 브라우저용 고성능 이미지 압축 라이브러리 (Bun Workspace Monorepo)

## Structure

```
packages/
├── module/    # @sinter/module - TypeScript 라이브러리 (tsdown 빌드)
└── demo/      # @sinter/demo - 데모 앱 (Rspack + React + Tailwind)
```

## Commands

```bash
bun install        # 의존성 설치
bun run build      # 전체 빌드
bun run check      # Biome lint + TypeScript 타입 체크 (읽기 전용)
bun run fix        # Biome 자동 포맷 및 수정 (--write)
bun run demo       # module 빌드 후 demo 개발 서버 시작 (포트 4173)
bun run dev        # demo 개발 서버만 시작 (module 빌드 없음)
bun run update     # 의존성 업데이트
```

### Package-specific

```bash
bun --filter @sinter/module build    # module만 빌드
bun --filter @sinter/demo dev        # demo 개발 서버만 시작
```

## Packages

### @sinter/module
- **Build**: `tsdown`
- **Output**: `dist/index.mjs` + `dist/index.d.mts`

### @sinter/demo
- **Stack**: Rspack + React 19 + Tailwind CSS v4
- **Purpose**: 배포 전 라이브러리 기능 테스트용 데모 앱
- **Dev**: rspack alias로 `@sinter/module` dist 직접 참조

## Code Style

- **Biome**: 2-space indent, 100-char line width, trailing commas (ES5)
- **TypeScript**: Strict mode, ESM only

## Git Convention

- **Commit**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `build:`, `docs:`, `chore:`)
