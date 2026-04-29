use std::slice;
use std::sync::Mutex;

const FILE_HEADER_SIZE: usize = 14;
const V4_HEADER_SIZE: usize = 108;
const PIXEL_OFFSET: usize = FILE_HEADER_SIZE + V4_HEADER_SIZE;

struct BmpResult {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

static RESULT: Mutex<Option<BmpResult>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn sinter_bmp_malloc(size: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn sinter_bmp_free(ptr: *mut u8, capacity: usize) {
    if ptr.is_null() {
        return;
    }

    drop(Vec::from_raw_parts(ptr, 0, capacity));
}

#[no_mangle]
pub extern "C" fn sinter_bmp_release_result() {
    RESULT.lock().unwrap().take();
}

#[no_mangle]
pub extern "C" fn sinter_bmp_result_ptr() -> *const u8 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(std::ptr::null(), |result| result.bytes.as_ptr())
}

#[no_mangle]
pub extern "C" fn sinter_bmp_result_len() -> usize {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.bytes.len())
}

#[no_mangle]
pub extern "C" fn sinter_bmp_result_width() -> u32 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.width)
}

#[no_mangle]
pub extern "C" fn sinter_bmp_result_height() -> u32 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.height)
}

#[no_mangle]
pub unsafe extern "C" fn sinter_bmp_decode(input_ptr: *const u8, input_len: usize) -> i32 {
    RESULT.lock().unwrap().take();

    if input_ptr.is_null() || input_len < FILE_HEADER_SIZE + 40 {
        return 0;
    }

    let input = slice::from_raw_parts(input_ptr, input_len);
    match decode_bmp(input) {
        Ok(result) => {
            *RESULT.lock().unwrap() = Some(result);
            1
        }
        Err(_) => 0,
    }
}

#[no_mangle]
pub unsafe extern "C" fn sinter_bmp_encode(
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
    match encode_bmp(rgba, width, height) {
        Ok(bytes) => {
            *RESULT.lock().unwrap() = Some(BmpResult {
                bytes,
                width,
                height,
            });
            1
        }
        Err(_) => 0,
    }
}

fn decode_bmp(input: &[u8]) -> Result<BmpResult, ()> {
    if input[0] != 0x42 || input[1] != 0x4d {
        return Err(());
    }

    let pixel_offset = read_u32(input, 10)? as usize;
    let header_size = read_u32(input, 14)? as usize;
    let width = read_i32(input, 18)?;
    let raw_height = read_i32(input, 22)?;
    let height = raw_height.checked_abs().ok_or(())?;
    let bottom_up = raw_height > 0;
    let bit_count = read_u16(input, 28)?;
    let compression = read_u32(input, 30)?;

    if width <= 0 || height <= 0 || (bit_count != 24 && bit_count != 32) {
        return Err(());
    }
    if compression != 0 && compression != 3 {
        return Err(());
    }

    let width = width as usize;
    let height = height as usize;
    let bytes_per_pixel = bit_count as usize / 8;
    let row_bytes = width.checked_mul(bytes_per_pixel).ok_or(())?;
    let row_stride = row_bytes
        .checked_add(3)
        .and_then(|bytes| bytes.checked_div(4))
        .and_then(|words| words.checked_mul(4))
        .ok_or(())?;
    let pixel_end = pixel_offset
        .checked_add(height.checked_mul(row_stride).ok_or(())?)
        .ok_or(())?;
    if pixel_end > input.len() {
        return Err(());
    }

    let masks = if compression == 3 {
        read_bitfield_masks(input, header_size)?
    } else {
        None
    };
    if let Some((red, green, blue, alpha)) = masks {
        if bit_count != 32 || red != 0x00ff0000 || green != 0x0000ff00 || blue != 0x000000ff {
            return Err(());
        }
        if alpha != 0 && alpha != 0xff000000 {
            return Err(());
        }
    }

    let has_alpha = masks
        .map(|(_, _, _, alpha)| alpha == 0xff000000)
        .unwrap_or_else(|| {
            header_size >= V4_HEADER_SIZE
                && input.len() >= FILE_HEADER_SIZE + V4_HEADER_SIZE
                && read_u32(input, FILE_HEADER_SIZE + 52).unwrap_or(0) != 0
        });

    let rgba_len = width
        .checked_mul(height)
        .and_then(|px| px.checked_mul(4))
        .ok_or(())?;
    let mut rgba = vec![0; rgba_len];
    for row in 0..height {
        let src_row = if bottom_up { height - 1 - row } else { row };
        let src_base = pixel_offset + src_row * row_stride;
        let dst_base = row * width * 4;

        for col in 0..width {
            let src = src_base + col * bytes_per_pixel;
            let dst = dst_base + col * 4;
            rgba[dst] = input[src + 2];
            rgba[dst + 1] = input[src + 1];
            rgba[dst + 2] = input[src];
            rgba[dst + 3] = if bit_count == 32 && has_alpha {
                input[src + 3]
            } else {
                255
            };
        }
    }

    Ok(BmpResult {
        bytes: rgba,
        width: width as u32,
        height: height as u32,
    })
}

fn read_bitfield_masks(
    input: &[u8],
    header_size: usize,
) -> Result<Option<(u32, u32, u32, u32)>, ()> {
    if header_size >= V4_HEADER_SIZE {
        return Ok(Some((
            read_u32(input, FILE_HEADER_SIZE + 40)?,
            read_u32(input, FILE_HEADER_SIZE + 44)?,
            read_u32(input, FILE_HEADER_SIZE + 48)?,
            read_u32(input, FILE_HEADER_SIZE + 52)?,
        )));
    }

    if header_size == 40 {
        let mask_offset = FILE_HEADER_SIZE + header_size;
        return Ok(Some((
            read_u32(input, mask_offset)?,
            read_u32(input, mask_offset + 4)?,
            read_u32(input, mask_offset + 8)?,
            0,
        )));
    }

    Ok(None)
}

fn encode_bmp(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, ()> {
    let width_usize = width as usize;
    let height_usize = height as usize;
    let pixel_data_size = width_usize
        .checked_mul(height_usize)
        .and_then(|px| px.checked_mul(4))
        .ok_or(())?;
    let file_size = PIXEL_OFFSET.checked_add(pixel_data_size).ok_or(())?;
    let mut out = vec![0; file_size];

    out[0] = 0x42;
    out[1] = 0x4d;
    write_u32(&mut out, 2, file_size as u32)?;
    write_u32(&mut out, 10, PIXEL_OFFSET as u32)?;
    write_u32(&mut out, 14, V4_HEADER_SIZE as u32)?;
    write_i32(&mut out, 18, width as i32)?;
    write_i32(&mut out, 22, height as i32)?;
    write_u16(&mut out, 26, 1)?;
    write_u16(&mut out, 28, 32)?;
    write_u32(&mut out, 30, 3)?;
    write_u32(&mut out, 34, pixel_data_size as u32)?;
    write_u32(&mut out, 38, 2835)?;
    write_u32(&mut out, 42, 2835)?;
    write_u32(&mut out, 54, 0x00ff0000)?;
    write_u32(&mut out, 58, 0x0000ff00)?;
    write_u32(&mut out, 62, 0x000000ff)?;
    write_u32(&mut out, 66, 0xff000000)?;
    write_u32(&mut out, 70, 0x42475273)?;

    let mut dst = PIXEL_OFFSET;
    for row in (0..height_usize).rev() {
        let src_base = row * width_usize * 4;
        for col in 0..width_usize {
            let src = src_base + col * 4;
            out[dst] = rgba[src + 2];
            out[dst + 1] = rgba[src + 1];
            out[dst + 2] = rgba[src];
            out[dst + 3] = rgba[src + 3];
            dst += 4;
        }
    }

    Ok(out)
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, ()> {
    let slice = bytes.get(offset..offset + 2).ok_or(())?;
    Ok(u16::from_le_bytes([slice[0], slice[1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ()> {
    let slice = bytes.get(offset..offset + 4).ok_or(())?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_i32(bytes: &[u8], offset: usize) -> Result<i32, ()> {
    let slice = bytes.get(offset..offset + 4).ok_or(())?;
    Ok(i32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn write_u16(bytes: &mut [u8], offset: usize, value: u16) -> Result<(), ()> {
    bytes
        .get_mut(offset..offset + 2)
        .ok_or(())?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn write_u32(bytes: &mut [u8], offset: usize, value: u32) -> Result<(), ()> {
    bytes
        .get_mut(offset..offset + 4)
        .ok_or(())?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn write_i32(bytes: &mut [u8], offset: usize, value: i32) -> Result<(), ()> {
    bytes
        .get_mut(offset..offset + 4)
        .ok_or(())?
        .copy_from_slice(&value.to_le_bytes());
    Ok(())
}
