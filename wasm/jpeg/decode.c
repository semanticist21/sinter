#include <limits.h>
#include <setjmp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <jpeglib.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

// JPEG 데이터를 RGBA 버퍼와 EXIF 바이너리로 변환한 결과를 표준화한 구조체
typedef struct {
  uint8_t *data;
  uint32_t length;
  uint32_t width;
  uint32_t height;
  uint32_t channels;
  uint8_t *exif_data;
  uint32_t exif_length;
  int status;
} JpegDecodeResult;

// libjpeg의 오류 처리를 longjmp로 전달하기 위한 커스텀 핸들러
struct decode_error_mgr {
  struct jpeg_error_mgr pub;
  jmp_buf jump_buffer;
};

static void decode_error_exit(j_common_ptr cinfo) {
  struct decode_error_mgr *err = (struct decode_error_mgr *)cinfo->err;
  (*cinfo->err->output_message)(cinfo);
  longjmp(err->jump_buffer, 1);
}

// 이미지 전체 버퍼 크기가 32비트 주소 공간을 초과하지 않는지 검사
static int validate_size(uint32_t width, uint32_t height) {
  if (width == 0 || height == 0) {
    return -2;
  }

  const uint64_t stride = (uint64_t)width * 4u;
  if (stride > SIZE_MAX) {
    return -3;
  }

  const uint64_t total = stride * height;
  if (total > SIZE_MAX) {
    return -3;
  }

  return 0;
}

WASM_EXPORT
JpegDecodeResult jpeg_decode(const uint8_t *jpeg_buffer, uint32_t jpeg_size) {
  JpegDecodeResult result = {0};

  if (jpeg_buffer == NULL || jpeg_size == 0) {
    result.status = -1;
    return result;
  }

  struct jpeg_decompress_struct cinfo;
  struct decode_error_mgr jerr;
  JSAMPARRAY sample_buffer = NULL;
  uint8_t *rgba = NULL;
  uint8_t *exif_copy = NULL;
  uint32_t exif_length = 0u;

  cinfo.err = jpeg_std_error(&jerr.pub);
  jerr.pub.error_exit = decode_error_exit;

  if (setjmp(jerr.jump_buffer)) {
    jpeg_destroy_decompress(&cinfo);
    free(rgba);
    free(exif_copy);
    result.status = result.status != 0 ? result.status : -4;
    return result;
  }

  jpeg_create_decompress(&cinfo);
  // EXIF는 APP1 마커에 담겨 있으므로 헤더 파싱 전에 저장하도록 요청
  jpeg_save_markers(&cinfo, JPEG_APP0 + 1, 0xFFFF);
  jpeg_mem_src(&cinfo, jpeg_buffer, jpeg_size);

  jpeg_read_header(&cinfo, TRUE);
  // 필요 시 APP1 마커 체인을 훑어 EXIF 페이로드를 복사해 둔다
  for (jpeg_saved_marker_ptr marker = cinfo.marker_list; marker != NULL; marker = marker->next) {
    const int is_app1 = marker->marker == (JPEG_APP0 + 1);
    const int has_signature = marker->data_length > 6 && memcmp(marker->data, "Exif\0\0", 6) == 0;
    if (!is_app1 || !has_signature) {
      continue;
    }

    const size_t marker_length = marker->data_length;
    if (marker_length > UINT32_MAX) {
      result.status = -6;
      goto error_cleanup;
    }

    exif_copy = (uint8_t *)malloc(marker_length);
    if (exif_copy == NULL) {
      result.status = -6;
      goto error_cleanup;
    }

    memcpy(exif_copy, marker->data, marker_length);
    exif_length = (uint32_t)marker_length;
    break;
  }

  cinfo.out_color_space = JCS_RGB;

  jpeg_start_decompress(&cinfo);

  const uint32_t width = (uint32_t)cinfo.output_width;
  const uint32_t height = (uint32_t)cinfo.output_height;
  const uint32_t components = (uint32_t)cinfo.output_components;

  const int size_status = validate_size(width, height);
  if (size_status != 0) {
    result.status = size_status;
    goto error_cleanup;
  }

  const size_t rgba_stride = (size_t)width * 4u;
  const size_t rgba_size = rgba_stride * height;
  rgba = (uint8_t *)malloc(rgba_size);
  if (rgba == NULL) {
    result.status = -5;
    goto error_cleanup;
  }

  sample_buffer = (*cinfo.mem->alloc_sarray)(
    (j_common_ptr)&cinfo,
    JPOOL_IMAGE,
    width * components,
    1
  );

  // 스캔라인 단위로 RGB → RGBA 버퍼를 생성 (알파는 255로 고정)
  while (cinfo.output_scanline < cinfo.output_height) {
    jpeg_read_scanlines(&cinfo, sample_buffer, 1);
    const uint8_t *src = sample_buffer[0];
    uint8_t *dst = rgba + ((cinfo.output_scanline - 1) * rgba_stride);

    for (uint32_t x = 0; x < width; ++x) {
      uint8_t r;
      uint8_t g;
      uint8_t b;

      if (components == 3) {
        const uint32_t src_index = x * 3u;
        r = src[src_index];
        g = src[src_index + 1u];
        b = src[src_index + 2u];
      } else if (components == 1) {
        const uint8_t value = src[x];
        r = g = b = value;
      } else {
        const uint32_t src_index = x * components;
        r = src[src_index];
        g = src[src_index + 1u];
        b = src[src_index + 2u];
      }

      const uint32_t dst_index = x * 4u;
      dst[dst_index] = r;
      dst[dst_index + 1u] = g;
      dst[dst_index + 2u] = b;
      dst[dst_index + 3u] = 255u;
    }
  }

  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);

  result.data = rgba;
  result.length = (uint32_t)rgba_size;
  result.width = width;
  result.height = height;
  result.channels = 4u;
  result.exif_data = exif_copy;
  result.exif_length = exif_length;
  result.status = 0;
  return result;

error_cleanup:
  jpeg_destroy_decompress(&cinfo);
  free(rgba);
  free(exif_copy);
  return result;
}

WASM_EXPORT
void jpeg_decode_free(uint8_t *ptr) {
  free(ptr);
}
