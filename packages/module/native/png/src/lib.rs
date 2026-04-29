use png::{BitDepth, ColorType, Compression, Decoder, Encoder, Transformations};
use std::io::Cursor;
use std::slice;
use std::sync::Mutex;

struct PngResult {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

static RESULT: Mutex<Option<PngResult>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn sinter_png_malloc(size: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn sinter_png_free(ptr: *mut u8, capacity: usize) {
    if ptr.is_null() {
        return;
    }

    drop(Vec::from_raw_parts(ptr, 0, capacity));
}

#[no_mangle]
pub extern "C" fn sinter_png_release_result() {
    RESULT.lock().unwrap().take();
}

#[no_mangle]
pub extern "C" fn sinter_png_result_ptr() -> *const u8 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(std::ptr::null(), |result| result.bytes.as_ptr())
}

#[no_mangle]
pub extern "C" fn sinter_png_result_len() -> usize {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.bytes.len())
}

#[no_mangle]
pub extern "C" fn sinter_png_result_width() -> u32 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.width)
}

#[no_mangle]
pub extern "C" fn sinter_png_result_height() -> u32 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.height)
}

#[no_mangle]
pub unsafe extern "C" fn sinter_png_decode(input_ptr: *const u8, input_len: usize) -> i32 {
    RESULT.lock().unwrap().take();

    if input_ptr.is_null() || input_len == 0 {
        return 0;
    }

    let input = slice::from_raw_parts(input_ptr, input_len);
    match decode_png(input) {
        Ok(result) => {
            *RESULT.lock().unwrap() = Some(result);
            1
        }
        Err(_) => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn sinter_png_encode(
    rgba_ptr: *const u8,
    rgba_len: usize,
    width: u32,
    height: u32,
) -> i32 {
    RESULT.lock().unwrap().take();

    if rgba_ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }

    let expected_len = width as usize * height as usize * 4;
    if rgba_len != expected_len {
        return 0;
    }

    let rgba = slice::from_raw_parts(rgba_ptr, rgba_len);
    match encode_png(rgba, width, height) {
        Ok(bytes) => {
            *RESULT.lock().unwrap() = Some(PngResult {
                bytes,
                width,
                height,
            });
            1
        }
        Err(_) => 0,
    }
}

fn decode_png(input: &[u8]) -> Result<PngResult, ()> {
    let mut decoder = Decoder::new(Cursor::new(input));
    decoder.set_transformations(Transformations::normalize_to_color8() | Transformations::ALPHA);
    let mut reader = decoder.read_info().map_err(|_| ())?;
    let output_size = reader.output_buffer_size().ok_or(())?;
    let mut buffer = vec![0; output_size];
    let info = reader.next_frame(&mut buffer).map_err(|_| ())?;
    let bytes = &buffer[..info.buffer_size()];
    let pixel_count = info.width as usize * info.height as usize;

    let rgba = match info.color_type {
        ColorType::Rgba => bytes.to_vec(),
        ColorType::Rgb => {
            if bytes.len() != pixel_count * 3 {
                return Err(());
            }
            let mut out = vec![0; pixel_count * 4];
            for (src, dst) in bytes.chunks_exact(3).zip(out.chunks_exact_mut(4)) {
                dst[0] = src[0];
                dst[1] = src[1];
                dst[2] = src[2];
                dst[3] = 255;
            }
            out
        }
        ColorType::GrayscaleAlpha => {
            if bytes.len() != pixel_count * 2 {
                return Err(());
            }
            let mut out = vec![0; pixel_count * 4];
            for (src, dst) in bytes.chunks_exact(2).zip(out.chunks_exact_mut(4)) {
                dst[0] = src[0];
                dst[1] = src[0];
                dst[2] = src[0];
                dst[3] = src[1];
            }
            out
        }
        ColorType::Grayscale => {
            if bytes.len() != pixel_count {
                return Err(());
            }
            let mut out = vec![0; pixel_count * 4];
            for (src, dst) in bytes.iter().zip(out.chunks_exact_mut(4)) {
                dst[0] = *src;
                dst[1] = *src;
                dst[2] = *src;
                dst[3] = 255;
            }
            out
        }
        ColorType::Indexed => return Err(()),
    };

    Ok(PngResult {
        bytes: rgba,
        width: info.width,
        height: info.height,
    })
}

fn encode_png(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, ()> {
    let mut out = Vec::new();
    {
        let mut encoder = Encoder::new(&mut out, width, height);
        encoder.set_color(ColorType::Rgba);
        encoder.set_depth(BitDepth::Eight);
        encoder.set_compression(Compression::Balanced);
        let mut writer = encoder.write_header().map_err(|_| ())?;
        writer.write_image_data(rgba).map_err(|_| ())?;
    }
    Ok(out)
}
