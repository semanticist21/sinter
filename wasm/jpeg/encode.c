#include <limits.h>
#include <setjmp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <jpeglib.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

// RGBA/RGB 버퍼를 JPEG 바이너리로 변환한 결과 구조체
typedef struct {
  uint8_t *data;
  uint32_t length;
  int status;
} JpegEncodeResult;

// libjpeg 에러를 상위 호출자로 되돌리기 위한 핸들러
struct encode_error_mgr {
  struct jpeg_error_mgr pub;
  jmp_buf jump_buffer;
};

static void encode_error_exit(j_common_ptr cinfo) {
  struct encode_error_mgr *err = (struct encode_error_mgr *)cinfo->err;
  (*cinfo->err->output_message)(cinfo);
  longjmp(err->jump_buffer, 1);
}

// JPEG 품질 인자를 1~100 범위로 강제
static int clamp_quality(int quality) {
  if (quality < 1) {
    return 1;
  }
  if (quality > 100) {
    return 100;
  }
  return quality;
}

// wasm 메모리 한계를 넘지 않도록 폭/높이/채널 수를 사전 검사
static int validate_encode_dimensions(uint32_t width, uint32_t height, uint32_t channels) {
  if (width == 0 || height == 0) {
    return -2;
  }
  if (channels != 3 && channels != 4) {
    return -3;
  }
  const uint64_t stride = (uint64_t)width * channels;
  if (stride > SIZE_MAX) {
    return -4;
  }
  const uint64_t total = stride * height;
  if (total > SIZE_MAX) {
    return -4;
  }
  return 0;
}

WASM_EXPORT
JpegEncodeResult jpeg_encode(
  const uint8_t *pixels,
  uint32_t width,
  uint32_t height,
  uint32_t channels,
  int quality
) {
  JpegEncodeResult result = {0};

  if (pixels == NULL) {
    result.status = -1;
    return result;
  }

  const int dimension_status = validate_encode_dimensions(width, height, channels);
  if (dimension_status != 0) {
    result.status = dimension_status;
    return result;
  }

  struct jpeg_compress_struct cinfo;
  struct encode_error_mgr jerr;
  JSAMPROW row_pointer[1];
  uint8_t *row_buffer = NULL;
  unsigned char *jpeg_buffer = NULL;
  unsigned long jpeg_size = 0;

  cinfo.err = jpeg_std_error(&jerr.pub);
  jerr.pub.error_exit = encode_error_exit;

  if (setjmp(jerr.jump_buffer)) {
    jpeg_destroy_compress(&cinfo);
    free(row_buffer);
    free(jpeg_buffer);
    result.status = result.status != 0 ? result.status : -5;
    return result;
  }

  jpeg_create_compress(&cinfo);
  jpeg_mem_dest(&cinfo, &jpeg_buffer, &jpeg_size);

  cinfo.image_width = width;
  cinfo.image_height = height;
  cinfo.input_components = 3;
  cinfo.in_color_space = JCS_RGB;

  jpeg_set_defaults(&cinfo);
  jpeg_set_quality(&cinfo, clamp_quality(quality), TRUE);

  jpeg_start_compress(&cinfo, TRUE);

  const size_t rgb_stride = (size_t)width * 3u;
  row_buffer = (uint8_t *)malloc(rgb_stride);
  if (row_buffer == NULL) {
    result.status = -6;
    jpeg_destroy_compress(&cinfo);
    return result;
  }

  row_pointer[0] = row_buffer;
  const size_t src_stride = (size_t)width * channels;

  // 입력 채널이 4개(RGBA)여도 RGB만 추출하여 JPEG을 생성
  for (uint32_t y = 0; y < height; ++y) {
    const uint8_t *src_row = pixels + (size_t)y * src_stride;
    for (uint32_t x = 0; x < width; ++x) {
      const uint32_t src_index = x * channels;
      const uint32_t dst_index = x * 3u;
      row_buffer[dst_index] = src_row[src_index];
      row_buffer[dst_index + 1u] = src_row[src_index + 1u];
      row_buffer[dst_index + 2u] = src_row[src_index + 2u];
    }
    jpeg_write_scanlines(&cinfo, row_pointer, 1);
  }

  jpeg_finish_compress(&cinfo);
  jpeg_destroy_compress(&cinfo);
  free(row_buffer);

  if (jpeg_size > UINT32_MAX) {
    free(jpeg_buffer);
    result.status = -7;
    return result;
  }

  result.data = (uint8_t *)jpeg_buffer;
  result.length = (uint32_t)jpeg_size;
  result.status = 0;
  return result;
}

WASM_EXPORT
void jpeg_encode_free(uint8_t *ptr) {
  free(ptr);
}
