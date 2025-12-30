# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sinter** - 브라우저용 이미지 압축 라이브러리. EXIF 메타데이터 보존 옵션 지원.

- **Language**: TypeScript
- **Runtime**: Bun
- **Supported Formats**: JPEG, PNG, WebP, AVIF, HEIC

## Commands

```bash
bun install              # 의존성 설치
bun run dev              # Watch mode
bun run build            # 프로덕션 빌드
bun run check            # Biome + TypeScript 검사
bun run fix              # 자동 포맷 + lint
```

## Architecture

```
src/
├── index.ts             # Public API: CompressImage() + types
├── worker.ts            # WorkerManager<T> 제네릭 클래스
├── compress.worker.ts   # 실제 압축 로직 (Web Worker)
└── utils.ts             # convertToBytes(), uuid()
```

### Data Flow

```
index.ts                    worker.ts                 compress.worker.ts
   │                           │                            │
   │  compressWorker.post() ──►│  WorkerManager.post()      │
   │                           │  ──► postMessage() ───────►│
   │                           │                            │  압축 처리
   │◄──────────────────────────│◄─── onmessage ────────────│
   │  File 객체 반환            │                            │
```

## Public API

```typescript
export type CompressImageOptions = {
  format?: "jpeg" | "png" | "webp" | "avif" | "heic";
  constraints?: {
    maxWidth?: number;
    maxHeight?: number;
    maxSize?: { value: number; unit: "KB" | "MB" | "GB" };
  };
  preserveExif?: boolean;
};

export async function CompressImage(
  file: File,
  options?: CompressImageOptions
): Promise<File>
```

## Code Style

- **Biome**: 2-space indent, 100-char line width
- **TypeScript**: Strict mode
- Worker 파일은 `.worker.ts` 접미사 필수 (번들러 인식용)
