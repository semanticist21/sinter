import * as wasm from 'sinter-wasm';

export type ImageProcessorOptions = {
  width: number;
  height: number;
};

/**
 * 이미지 프로세서 - WASM 모듈 래퍼
 */
export class ImageProcessor {
  private width: number;
  private height: number;

  constructor(options: ImageProcessorOptions) {
    this.width = options.width;
    this.height = options.height;
  }

  /**
   * 그레이스케일 변환
   */
  grayscale(imageData: Uint8ClampedArray): Uint8ClampedArray {
    const processed = wasm.grayscale(new Uint8Array(imageData));
    return new Uint8ClampedArray(processed);
  }

  /**
   * 밝기 조절
   */
  brightness(imageData: Uint8ClampedArray, amount: number): Uint8ClampedArray {
    const processed = wasm.brightness(new Uint8Array(imageData), amount);
    return new Uint8ClampedArray(processed);
  }

  /**
   * 색상 반전
   */
  invert(imageData: Uint8ClampedArray): Uint8ClampedArray {
    const processed = wasm.invert(new Uint8Array(imageData));
    return new Uint8ClampedArray(processed);
  }

  /**
   * 블러 효과
   */
  blur(imageData: Uint8ClampedArray, radius: number = 1): Uint8ClampedArray {
    const processed = wasm.blur(
      new Uint8Array(imageData),
      this.width,
      this.height,
      radius
    );
    return new Uint8ClampedArray(processed);
  }
}

// WASM 함수 직접 내보내기
export { grayscale, brightness, invert, blur } from 'sinter-wasm';
