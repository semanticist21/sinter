// Polyfills for browser APIs not available in Bun runtime

// biome-ignore lint/suspicious/noExplicitAny: test polyfill
type Ctx = any;

if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace = "srgb" as const;

    constructor(sw: Uint8ClampedArray | number, sh: number, settings?: number) {
      if (sw instanceof Uint8ClampedArray) {
        this.data = sw;
        this.width = sh;
        this.height = settings ?? 0;
      } else {
        this.width = sw;
        this.height = sh;
        this.data = new Uint8ClampedArray(sw * sh * 4);
      }
    }
  } as typeof ImageData;
}

if (typeof globalThis.OffscreenCanvas === "undefined") {
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    width: number;
    height: number;

    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }

    getContext(_type: string): Ctx {
      const _w = this.width;
      const _h = this.height;
      // biome-ignore lint/suspicious/noExplicitAny: storing source for drawImage
      let sourceCanvas: any = null;

      return {
        putImageData(imageData: ImageData) {
          sourceCanvas = imageData;
        },
        drawImage(source: OffscreenCanvas | HTMLCanvasElement) {
          // biome-ignore lint/suspicious/noExplicitAny: accessing polyfill internals
          sourceCanvas = (source as any)._imageData ?? sourceCanvas;
        },
        getImageData(_x: number, _y: number, gw: number, gh: number): ImageData {
          // Simple nearest-neighbor resize from source
          if (sourceCanvas?.data) {
            const src = sourceCanvas as ImageData;
            const dst = new Uint8ClampedArray(gw * gh * 4);
            for (let y = 0; y < gh; y++) {
              for (let x = 0; x < gw; x++) {
                const sx = Math.floor((x / gw) * src.width);
                const sy = Math.floor((y / gh) * src.height);
                const si = (sy * src.width + sx) * 4;
                const di = (y * gw + x) * 4;
                dst[di] = src.data[si];
                dst[di + 1] = src.data[si + 1];
                dst[di + 2] = src.data[si + 2];
                dst[di + 3] = src.data[si + 3];
              }
            }
            return new ImageData(dst, gw, gh);
          }
          return new ImageData(gw, gh);
        },
      };
    }
  } as typeof OffscreenCanvas;
}
