#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

#include "src/webp/decode.h"
#include "src/webp/encode.h"
#include "src/webp/types.h"

static uint8_t *result_ptr = NULL;
static size_t result_len = 0;
static int result_width = 0;
static int result_height = 0;

__attribute__((visibility("default"))) void *sinter_webp_malloc(size_t size) {
  return malloc(size);
}

__attribute__((visibility("default"))) void sinter_webp_free(void *ptr) {
  free(ptr);
}

__attribute__((visibility("default"))) void sinter_webp_release_result(void) {
  if (result_ptr != NULL) {
    WebPFree(result_ptr);
  }
  result_ptr = NULL;
  result_len = 0;
  result_width = 0;
  result_height = 0;
}

__attribute__((visibility("default"))) const uint8_t *sinter_webp_result_ptr(void) {
  return result_ptr;
}

__attribute__((visibility("default"))) size_t sinter_webp_result_len(void) {
  return result_len;
}

__attribute__((visibility("default"))) uint32_t sinter_webp_result_width(void) {
  return (uint32_t)result_width;
}

__attribute__((visibility("default"))) uint32_t sinter_webp_result_height(void) {
  return (uint32_t)result_height;
}

__attribute__((visibility("default"))) int sinter_webp_decode(
  const uint8_t *input,
  size_t input_len
) {
  sinter_webp_release_result();
  if (input == NULL || input_len == 0) {
    return 0;
  }

  uint8_t *rgba = WebPDecodeRGBA(input, input_len, &result_width, &result_height);
  if (rgba == NULL || result_width <= 0 || result_height <= 0) {
    return 0;
  }

  result_ptr = rgba;
  result_len = (size_t)result_width * (size_t)result_height * 4;
  return 1;
}

__attribute__((visibility("default"))) int sinter_webp_encode(
  const uint8_t *rgba,
  size_t rgba_len,
  uint32_t width,
  uint32_t height,
  float quality,
  int lossless
) {
  sinter_webp_release_result();
  if (rgba == NULL || width == 0 || height == 0) {
    return 0;
  }

  size_t expected_len = (size_t)width * (size_t)height * 4;
  if (rgba_len != expected_len) {
    return 0;
  }

  uint8_t *out = NULL;
  size_t len = lossless
    ? WebPEncodeLosslessRGBA(rgba, (int)width, (int)height, (int)width * 4, &out)
    : WebPEncodeRGBA(rgba, (int)width, (int)height, (int)width * 4, quality, &out);
  if (len == 0 || out == NULL) {
    return 0;
  }

  result_ptr = out;
  result_len = len;
  result_width = (int)width;
  result_height = (int)height;
  return 1;
}
