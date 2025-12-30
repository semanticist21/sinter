# Sinter WASM Guide

## Emscripten SDK 설치

1. SDK 저장소를 내려받습니다.
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ```
2. 최신 툴체인을 설치합니다.
   ```bash
   ./emsdk install latest
   ```
3. 현재 사용자 환경에 활성화합니다.
   ```bash
   ./emsdk activate latest
   ```
4. 셸 세션에 PATH·환경 변수를 적용합니다.
   ```bash
   source ./emsdk_env.sh
   ```
   매번 입력하기 번거롭다면 `~/.zshrc` 등에 `source /path/to/emsdk/emsdk_env.sh`를 추가하세요.

필수 의존성: Xcode Command Line Tools, CMake, Python 3. Homebrew의 libjpeg(-turbo)를 함께 설치하면 로컬 헤더 탐색이 쉬워집니다 (`brew install jpeg-turbo`).

## JPEG 모듈 빌드 개요

1. Emscripten 환경을 활성화한 상태에서 프로젝트 루트로 이동합니다.
2. 빌드 출력 디렉터리를 준비합니다.
   ```bash
   mkdir -p wasm/output/jpeg
   ```
3. `emcc`로 디코더/인코더를 각각 빌드합니다 (예시).
   ```bash
   emcc wasm/jpeg/decode.c -O3 -s SIDE_MODULE=0 -s MODULARIZE=1 \
        -o wasm/output/jpeg/decode.js -ljpeg

   emcc wasm/jpeg/encode.c -O3 -s SIDE_MODULE=0 -s MODULARIZE=1 \
        -o wasm/output/jpeg/encode.js -ljpeg
   ```
   - `-ljpeg`는 시스템 libjpeg을 링크합니다. 필요 시 libjpeg 소스를 emcmake로 빌드해 정적 라이브러리를 제공해야 합니다.
   - 추가로 `-s ALLOW_MEMORY_GROWTH=1`, `-s EXPORT_ES6=1` 등 런타임 요구 사항에 맞는 플래그를 붙이세요.
   
   4. 생성된 `.wasm`과 `.js` 래퍼를 `src/worker` 또는 번들러가 접근하는 경로로 복사해 사용합니다.

### 현재 상태 메모

- 시스템(Homebrew) libjpeg는 macOS 네이티브 아카이브라 wasm 타깃으로 링크할 수 없습니다. `wasm-ld` 경고(`archive member ... is neither Wasm object file nor LLVM bitcode`)가 발생하며 빌드가 중단됩니다.
- 해결하려면 libjpeg(-turbo) 소스를 내려받아 `emcmake cmake`/`emmake make`로 WASM용 정적 라이브러리를 따로 빌드하고, `-I`/`-L` 경로를 해당 설치 위치로 덮어씁니다 (예: `/Users/semanticist/code/libjpeg-turbo-3.0.3/build-wasm/install/{include,lib}`).
- 빌드 스크립트를 자동화하거나, Squoosh처럼 `scripts/` 디렉터리에 의존성 다운로드 및 emcmake 명령을 넣으면 재현성이 좋아집니다.

향후 다른 코덱을 추가할 때도 동일한 패턴으로 `wasm/<codec>` 디렉터리에 C/C++ 소스를 두고 `emcc`/`emcmake`로 빌드하면 됩니다.
