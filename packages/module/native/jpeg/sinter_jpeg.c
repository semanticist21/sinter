#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "jpeglib.h"

static unsigned char *result_ptr = NULL;
static unsigned long result_len = 0;
static int result_width = 0;
static int result_height = 0;

static void clear_result(void) {
  if (result_ptr == NULL) {
    return;
  }

  free(result_ptr);
  result_ptr = NULL;
  result_len = 0;
  result_width = 0;
  result_height = 0;
}

void *sinter_jpeg_malloc(size_t size) {
  return malloc(size);
}

void sinter_jpeg_free(void *ptr) {
  free(ptr);
}

void sinter_jpeg_release_result(void) {
  clear_result();
}

uintptr_t sinter_jpeg_result_ptr(void) {
  return (uintptr_t)result_ptr;
}

unsigned long sinter_jpeg_result_len(void) {
  return result_len;
}

int sinter_jpeg_result_width(void) {
  return result_width;
}

int sinter_jpeg_result_height(void) {
  return result_height;
}

int sinter_jpeg_decode(const unsigned char *input, unsigned long input_len) {
  clear_result();

  struct jpeg_decompress_struct cinfo;
  struct jpeg_error_mgr jerr;
  cinfo.err = jpeg_std_error(&jerr);

  jpeg_create_decompress(&cinfo);
  jpeg_mem_src(&cinfo, input, input_len);

  if (jpeg_read_header(&cinfo, TRUE) != JPEG_HEADER_OK) {
    jpeg_destroy_decompress(&cinfo);
    return 0;
  }

  cinfo.out_color_space = JCS_RGB;
  jpeg_start_decompress(&cinfo);

  int width = (int)cinfo.output_width;
  int height = (int)cinfo.output_height;
  if (width <= 0 || height <= 0 || cinfo.output_components != 3) {
    jpeg_destroy_decompress(&cinfo);
    return 0;
  }

  unsigned long rgba_len = (unsigned long)width * (unsigned long)height * 4UL;
  unsigned char *rgba = (unsigned char *)malloc(rgba_len);
  unsigned char *rgb_row = (unsigned char *)malloc((unsigned long)width * 3UL);
  if (rgba == NULL || rgb_row == NULL) {
    free(rgba);
    free(rgb_row);
    jpeg_destroy_decompress(&cinfo);
    return 0;
  }

  while (cinfo.output_scanline < cinfo.output_height) {
    JSAMPROW row_pointer[1];
    row_pointer[0] = rgb_row;
    JDIMENSION y = cinfo.output_scanline;
    jpeg_read_scanlines(&cinfo, row_pointer, 1);

    unsigned long rgba_offset = (unsigned long)y * (unsigned long)width * 4UL;
    for (int x = 0; x < width; x++) {
      int rgb_offset = x * 3;
      unsigned long dst = rgba_offset + (unsigned long)x * 4UL;
      rgba[dst] = rgb_row[rgb_offset];
      rgba[dst + 1] = rgb_row[rgb_offset + 1];
      rgba[dst + 2] = rgb_row[rgb_offset + 2];
      rgba[dst + 3] = 255;
    }
  }

  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);
  free(rgb_row);

  result_ptr = rgba;
  result_len = rgba_len;
  result_width = width;
  result_height = height;
  return 1;
}

int sinter_jpeg_encode(
  const unsigned char *rgba,
  int width,
  int height,
  int quality,
  int progressive
) {
  clear_result();

  if (rgba == NULL || width <= 0 || height <= 0) {
    return 0;
  }

  if (quality < 1) {
    quality = 1;
  } else if (quality > 100) {
    quality = 100;
  }

  struct jpeg_compress_struct cinfo;
  struct jpeg_error_mgr jerr;
  cinfo.err = jpeg_std_error(&jerr);

  unsigned char *jpeg_buf = NULL;
  unsigned long jpeg_size = 0;
  unsigned char *rgb_row = (unsigned char *)malloc((unsigned long)width * 3UL);
  if (rgb_row == NULL) {
    return 0;
  }

  jpeg_create_compress(&cinfo);
  jpeg_mem_dest(&cinfo, &jpeg_buf, &jpeg_size);

  cinfo.image_width = (JDIMENSION)width;
  cinfo.image_height = (JDIMENSION)height;
  cinfo.input_components = 3;
  cinfo.in_color_space = JCS_RGB;

  jpeg_set_defaults(&cinfo);
  jpeg_set_quality(&cinfo, quality, TRUE);
  cinfo.optimize_coding = progressive ? TRUE : FALSE;
  if (progressive) {
    jpeg_simple_progression(&cinfo);
  }

  jpeg_start_compress(&cinfo, TRUE);
  while (cinfo.next_scanline < cinfo.image_height) {
    JDIMENSION y = cinfo.next_scanline;
    const unsigned char *src = rgba + (unsigned long)y * (unsigned long)width * 4UL;
    for (int x = 0; x < width; x++) {
      int rgb_offset = x * 3;
      int rgba_offset = x * 4;
      rgb_row[rgb_offset] = src[rgba_offset];
      rgb_row[rgb_offset + 1] = src[rgba_offset + 1];
      rgb_row[rgb_offset + 2] = src[rgba_offset + 2];
    }

    JSAMPROW row_pointer[1];
    row_pointer[0] = rgb_row;
    jpeg_write_scanlines(&cinfo, row_pointer, 1);
  }

  jpeg_finish_compress(&cinfo);
  jpeg_destroy_compress(&cinfo);
  free(rgb_row);

  if (jpeg_buf == NULL || jpeg_size == 0) {
    free(jpeg_buf);
    return 0;
  }

  result_ptr = jpeg_buf;
  result_len = jpeg_size;
  result_width = width;
  result_height = height;
  return 1;
}
