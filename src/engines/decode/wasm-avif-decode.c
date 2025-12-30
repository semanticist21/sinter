#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <avif/avif.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

// Struct returned to JS; contains decoded pixels and metadata
typedef struct {
  uint8_t *data;
  uint32_t length;
  uint32_t width;
  uint32_t height;
  uint32_t channels;
  int32_t status;
} AvifDecodeResult;

// Allocate and initialize result container
static AvifDecodeResult *alloc_result(void) {
  AvifDecodeResult *result = (AvifDecodeResult *)malloc(sizeof(AvifDecodeResult));
  if (result == NULL) {
    return NULL;
  }
  memset(result, 0, sizeof(AvifDecodeResult));
  result->status = -1;
  return result;
}

// Ensure decoded size fits within memory limits
static int validate_dimensions(uint32_t width, uint32_t height) {
  if (width == 0 || height == 0) {
    return -2;
  }

  const uint64_t stride = (uint64_t)width * 4u;
  const uint64_t total = stride * (uint64_t)height;
  if (total > SIZE_MAX || total > UINT32_MAX) {
    return -3;
  }

  return 0;
}

// Copy libavif RGB buffer into a tightly packed RGBA array
static uint8_t *copy_rgba_pixels(const avifRGBImage *rgb, uint32_t width, uint32_t height) {
  const uint64_t total_bytes = (uint64_t)width * (uint64_t)height * 4u;
  uint8_t *output = (uint8_t *)malloc(total_bytes);
  if (output == NULL) {
    return NULL;
  }

  const uint8_t *src_row = rgb->pixels;
  uint8_t *dst_row = output;
  for (uint32_t y = 0; y < height; ++y) {
    memcpy(dst_row, src_row, (size_t)width * 4u);
    src_row += rgb->rowBytes;
    dst_row += (size_t)width * 4u;
  }

  return output;
}

// Release libavif decoder and RGB buffers, if allocated
static void cleanup_decoder(avifDecoder *decoder, avifRGBImage *rgb) {
  if (rgb != NULL) {
    avifRGBImageFreePixels(rgb);
  }
  if (decoder != NULL) {
    avifDecoderDestroy(decoder);
  }
}

WASM_EXPORT
uintptr_t avif_decode(const uint8_t *input, uint32_t input_size) {
  AvifDecodeResult *result = alloc_result();
  if (result == NULL) {
    return 0u;
  }

  if (input == NULL || input_size == 0) {
    result->status = -2;
    return (uintptr_t)result;
  }

  avifDecoder *decoder = avifDecoderCreate();
  if (decoder == NULL) {
    result->status = -3;
    return (uintptr_t)result;
  }

  avifRGBImage rgb;
  memset(&rgb, 0, sizeof(avifRGBImage));

  avifResult set_io = avifDecoderSetIOMemory(decoder, input, input_size);
  if (set_io != AVIF_RESULT_OK) {
    result->status = -4;
    cleanup_decoder(decoder, NULL);
    return (uintptr_t)result;
  }

  avifResult parse_result = avifDecoderParse(decoder);
  if (parse_result != AVIF_RESULT_OK) {
    result->status = -5;
    cleanup_decoder(decoder, NULL);
    return (uintptr_t)result;
  }

  avifResult next_result = avifDecoderNextImage(decoder);
  if (next_result != AVIF_RESULT_OK) {
    result->status = -6;
    cleanup_decoder(decoder, NULL);
    return (uintptr_t)result;
  }

  avifRGBImageSetDefaults(&rgb, decoder->image);
  rgb.depth = 8;
  rgb.format = AVIF_RGB_FORMAT_RGBA;
  avifRGBImageAllocatePixels(&rgb);
  if (rgb.pixels == NULL) {
    result->status = -7;
    cleanup_decoder(decoder, &rgb);
    return (uintptr_t)result;
  }

  avifResult convert_result = avifImageYUVToRGB(decoder->image, &rgb);
  if (convert_result != AVIF_RESULT_OK) {
    result->status = -8;
    cleanup_decoder(decoder, &rgb);
    return (uintptr_t)result;
  }

  const uint32_t width = decoder->image->width;
  const uint32_t height = decoder->image->height;
  const int dimension_status = validate_dimensions(width, height);
  if (dimension_status != 0) {
    result->status = dimension_status;
    cleanup_decoder(decoder, &rgb);
    return (uintptr_t)result;
  }

  uint8_t *pixels = copy_rgba_pixels(&rgb, width, height);
  if (pixels == NULL) {
    result->status = -9;
    cleanup_decoder(decoder, &rgb);
    return (uintptr_t)result;
  }

  cleanup_decoder(decoder, &rgb);

  result->data = pixels;
  result->length = (uint32_t)((uint64_t)width * (uint64_t)height * 4u);
  result->width = width;
  result->height = height;
  result->channels = 4u;
  result->status = 0;

  return (uintptr_t)result;
}

WASM_EXPORT
void avif_decode_free(uintptr_t result_ptr) {
  if (result_ptr == 0) {
    return;
  }
  AvifDecodeResult *result = (AvifDecodeResult *)result_ptr;
  free(result->data);
  free(result);
}
