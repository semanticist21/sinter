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

## API 설계 결정사항 (@sinter/module)

### 진입점 및 체이닝 구조
```
compress(file: File)
  .keepFormat() | .toFormat(format, options?) | .allowFormats(allowed, to, options?)
  .defaultQuality(80)   // size 제약 없을 때 기본 quality
  .size(1, 'MB')        // 파일 크기 제약 (value, unit 둘 다 필수)
  .width(300)           // width만 리사이즈
  .height(200)          // height만 리사이즈
  .dimensions(300, 200) // width + height 동시 (둘 다 필수)
  .run()                // 터미널 메서드, Promise<Blob> 반환
```

### 주요 결정
- **터미널 메서드**: `.run()` (진입점 `compress()`와 겹침 방지)
- **압축 실행**: single-pass (generation loss 방지) — decode → resize → encode 한 번
- **파이프라인**: `pipeline[]` 배열로 호출 순서 기록, `run()` 시점에 @jsquash로 단일 패스 번역
- **`defaultQuality` vs `size`**: `size`가 있으면 quality를 낮춰 size 충족, 없으면 `defaultQuality` 그대로
- **`width`/`height`/`dimensions` 충돌**: 나중에 호출된 것이 이김 + `console.warn` 발생
- **`quality` 중복 호출** (`defaultQuality(80).defaultQuality(90)`): last-wins
- **코덱**: `@jsquash/avif`, `@jsquash/webp`, `@jsquash/jpeg`, `@jsquash/png` (브라우저용 WASM)
- **Worker 분리**: 초기 구현은 메인 스레드, 추후 내부만 Worker로 교체 가능 (인터페이스 변경 없음)
