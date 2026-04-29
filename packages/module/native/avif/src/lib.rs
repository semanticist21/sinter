use rav1d::include::dav1d::data::Dav1dData;
use rav1d::include::dav1d::dav1d::{Dav1dContext, Dav1dSettings};
use rav1d::include::dav1d::headers::{
    Dav1dMatrixCoefficients, DAV1D_MC_BT2020_NCL, DAV1D_MC_BT470BG, DAV1D_MC_BT601, DAV1D_MC_BT709,
    DAV1D_MC_FCC, DAV1D_MC_IDENTITY, DAV1D_MC_UNKNOWN,
};
use rav1d::include::dav1d::picture::Dav1dPicture;
use rav1d::src::lib::{
    dav1d_close, dav1d_data_create, dav1d_data_unref, dav1d_default_settings, dav1d_get_picture,
    dav1d_open, dav1d_picture_unref, dav1d_send_data,
};
use ravif::{AlphaColorMode, BitDepth, Encoder, Img};
use rgb::FromSlice;
use std::io::Cursor;
use std::ptr::NonNull;
use std::slice;
use std::sync::Mutex;

struct AvifResult {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

static RESULT: Mutex<Option<AvifResult>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn sinter_avif_malloc(size: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn sinter_avif_free(ptr: *mut u8, capacity: usize) {
    if ptr.is_null() {
        return;
    }

    drop(Vec::from_raw_parts(ptr, 0, capacity));
}

#[no_mangle]
pub extern "C" fn sinter_avif_release_result() {
    RESULT.lock().unwrap().take();
}

#[no_mangle]
pub extern "C" fn sinter_avif_result_ptr() -> *const u8 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(std::ptr::null(), |result| result.bytes.as_ptr())
}

#[no_mangle]
pub extern "C" fn sinter_avif_result_len() -> usize {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.bytes.len())
}

#[no_mangle]
pub extern "C" fn sinter_avif_result_width() -> u32 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.width)
}

#[no_mangle]
pub extern "C" fn sinter_avif_result_height() -> u32 {
    RESULT
        .lock()
        .unwrap()
        .as_ref()
        .map_or(0, |result| result.height)
}

#[no_mangle]
pub unsafe extern "C" fn sinter_avif_decode(input_ptr: *const u8, input_len: usize) -> i32 {
    RESULT.lock().unwrap().take();

    if input_ptr.is_null() || input_len == 0 {
        return 0;
    }

    let input = slice::from_raw_parts(input_ptr, input_len);
    let avif = match avif_parse::read_avif(&mut Cursor::new(input)) {
        Ok(avif) => avif,
        Err(_) => return 0,
    };

    let mut decoded = match decode_av1_item(&avif.primary_item, false) {
        Ok(decoded) => decoded,
        Err(_) => return 0,
    };

    if let Some(alpha_item) = avif.alpha_item.as_deref() {
        let alpha = match decode_av1_item(alpha_item, true) {
            Ok(decoded) => decoded,
            Err(_) => return 0,
        };

        if alpha.width != decoded.width || alpha.height != decoded.height {
            return 0;
        }

        for (color, alpha_px) in decoded
            .bytes
            .chunks_exact_mut(4)
            .zip(alpha.bytes.chunks_exact(4))
        {
            let alpha = alpha_px[0];
            color[3] = alpha;

            if avif.premultiplied_alpha && alpha > 0 {
                let alpha_f = f64::from(alpha) / 255.0;
                color[0] = clamp_u8(f64::from(color[0]) / alpha_f);
                color[1] = clamp_u8(f64::from(color[1]) / alpha_f);
                color[2] = clamp_u8(f64::from(color[2]) / alpha_f);
            }
        }
    }

    *RESULT.lock().unwrap() = Some(decoded);
    1
}

#[no_mangle]
pub unsafe extern "C" fn sinter_avif_encode(
    rgba_ptr: *const u8,
    rgba_len: usize,
    width: u32,
    height: u32,
    quality: u32,
    speed: u32,
) -> i32 {
    RESULT.lock().unwrap().take();

    if rgba_ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }

    let expected_len = width as usize * height as usize * 4;
    if rgba_len != expected_len {
        return 0;
    }

    let quality = quality.clamp(1, 100) as f32;
    let speed = speed.clamp(1, 10) as u8;
    let rgba = slice::from_raw_parts(rgba_ptr, rgba_len);
    let image = Img::new(rgba.as_rgba(), width as usize, height as usize);

    let encoded = Encoder::new()
        .with_quality(quality)
        .with_alpha_quality(quality)
        .with_speed(speed)
        .with_bit_depth(BitDepth::Auto)
        .with_alpha_color_mode(AlphaColorMode::UnassociatedClean)
        .with_num_threads(Some(1))
        .encode_rgba(image);

    match encoded {
        Ok(result) => {
            *RESULT.lock().unwrap() = Some(AvifResult {
                bytes: result.avif_file,
                width,
                height,
            });
            1
        }
        Err(_) => 0,
    }
}

fn decode_av1_item(item: &[u8], alpha_only: bool) -> Result<AvifResult, ()> {
    unsafe {
        let mut settings: Dav1dSettings = std::mem::zeroed();
        dav1d_default_settings(NonNull::from(&mut settings));
        settings.n_threads = 1;
        settings.max_frame_delay = 1;
        settings.apply_grain = 0;

        let mut context: Option<Dav1dContext> = None;
        if dav1d_open(
            Some(NonNull::from(&mut context)),
            Some(NonNull::from(&mut settings)),
        )
        .0 != 0
        {
            return Err(());
        }

        let result = decode_with_context(context.clone(), item, alpha_only);
        dav1d_close(Some(NonNull::from(&mut context)));
        result
    }
}

fn decode_with_context(
    context: Option<Dav1dContext>,
    item: &[u8],
    alpha_only: bool,
) -> Result<AvifResult, ()> {
    unsafe {
        let mut data = Dav1dData::default();
        let ptr = dav1d_data_create(Some(NonNull::from(&mut data)), item.len());
        if ptr.is_null() {
            return Err(());
        }
        std::ptr::copy_nonoverlapping(item.as_ptr(), ptr, item.len());

        let send_result = dav1d_send_data(context.clone(), Some(NonNull::from(&mut data))).0;
        dav1d_data_unref(Some(NonNull::from(&mut data)));
        if send_result != 0 {
            return Err(());
        }

        let mut picture = Dav1dPicture::default();
        for _ in 0..8 {
            let result = dav1d_get_picture(context.clone(), Some(NonNull::from(&mut picture))).0;
            if result == 0 {
                let decoded = picture_to_rgba(&picture, alpha_only);
                dav1d_picture_unref(Some(NonNull::from(&mut picture)));
                return decoded;
            }
        }
    }

    Err(())
}

fn picture_to_rgba(picture: &Dav1dPicture, alpha_only: bool) -> Result<AvifResult, ()> {
    let width = picture.p.w;
    let height = picture.p.h;
    let bit_depth = picture.p.bpc;
    if width <= 0 || height <= 0 || !(8..=12).contains(&bit_depth) {
        return Err(());
    }

    let y_plane = picture.data[0].ok_or(())?.as_ptr().cast::<u8>();
    let u_plane = picture.data[1].map(|plane| plane.as_ptr().cast::<u8>());
    let v_plane = picture.data[2].map(|plane| plane.as_ptr().cast::<u8>());
    let width = width as usize;
    let height = height as usize;
    let bytes_per_sample = if bit_depth > 8 { 2 } else { 1 };
    let (shift_x, shift_y) = match picture.p.layout {
        0 => (0, 0),
        1 => (1, 1),
        2 => (1, 0),
        3 => (0, 0),
        _ => return Err(()),
    };

    let seq = picture.seq_hdr.ok_or(())?;
    let seq = unsafe { seq.as_ref() };
    let full_range = seq.color_range != 0;
    let matrix = seq.mtrx;
    let (kr, kb) = matrix_coefficients(matrix);
    let max = ((1u32 << bit_depth) - 1) as f64;
    let scale = (1u32 << (bit_depth - 8)) as f64;
    let y_min = if full_range { 0.0 } else { 16.0 * scale };
    let y_range = if full_range { max } else { 219.0 * scale };
    let c_mid = 128.0 * scale;
    let c_range = if full_range { max + 1.0 } else { 224.0 * scale };

    let mut rgba = vec![0; width * height * 4];
    for y in 0..height {
        for x in 0..width {
            let y_sample = read_sample(y_plane, picture.stride[0], x, y, bytes_per_sample);
            let dst = (y * width + x) * 4;

            if alpha_only || picture.p.layout == 0 {
                let value = clamp_u8((y_sample as f64 / max) * 255.0);
                rgba[dst] = value;
                rgba[dst + 1] = value;
                rgba[dst + 2] = value;
                rgba[dst + 3] = if alpha_only { value } else { 255 };
                continue;
            }

            let chroma_x = x >> shift_x;
            let chroma_y = y >> shift_y;
            let u_sample = read_sample(
                u_plane.ok_or(())?,
                picture.stride[1],
                chroma_x,
                chroma_y,
                bytes_per_sample,
            );
            let v_sample = read_sample(
                v_plane.ok_or(())?,
                picture.stride[1],
                chroma_x,
                chroma_y,
                bytes_per_sample,
            );

            if matrix == DAV1D_MC_IDENTITY {
                rgba[dst] = clamp_u8((y_sample as f64 / max) * 255.0);
                rgba[dst + 1] = clamp_u8((u_sample as f64 / max) * 255.0);
                rgba[dst + 2] = clamp_u8((v_sample as f64 / max) * 255.0);
                rgba[dst + 3] = 255;
                continue;
            }

            let luma = ((y_sample as f64 - y_min) / y_range).clamp(0.0, 1.0);
            let cb = (u_sample as f64 - c_mid) / c_range;
            let cr = (v_sample as f64 - c_mid) / c_range;
            let red = luma + (2.0 - 2.0 * kr) * cr;
            let blue = luma + (2.0 - 2.0 * kb) * cb;
            let green = (luma - kr * red - kb * blue) / (1.0 - kr - kb);

            rgba[dst] = clamp_u8(red * 255.0);
            rgba[dst + 1] = clamp_u8(green * 255.0);
            rgba[dst + 2] = clamp_u8(blue * 255.0);
            rgba[dst + 3] = 255;
        }
    }

    Ok(AvifResult {
        bytes: rgba,
        width: width as u32,
        height: height as u32,
    })
}

fn read_sample(
    plane: *const u8,
    stride: isize,
    x: usize,
    y: usize,
    bytes_per_sample: usize,
) -> u16 {
    unsafe {
        let ptr = plane.offset(stride * y as isize + (x * bytes_per_sample) as isize);
        if bytes_per_sample == 1 {
            u16::from(*ptr)
        } else {
            u16::from_le_bytes([*ptr, *ptr.add(1)])
        }
    }
}

fn matrix_coefficients(matrix: Dav1dMatrixCoefficients) -> (f64, f64) {
    match matrix {
        DAV1D_MC_BT709 | DAV1D_MC_UNKNOWN => (0.2126, 0.0722),
        DAV1D_MC_FCC | DAV1D_MC_BT470BG | DAV1D_MC_BT601 => (0.299, 0.114),
        DAV1D_MC_BT2020_NCL => (0.2627, 0.0593),
        _ => (0.2126, 0.0722),
    }
}

fn clamp_u8(value: f64) -> u8 {
    value.round().clamp(0.0, 255.0) as u8
}
