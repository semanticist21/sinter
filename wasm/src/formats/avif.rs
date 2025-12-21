use crate::error::SinterResult;
use image::{DynamicImage, ImageReader};
use rgb::Rgb;
use std::io::Cursor;

/// AVIF 디코딩
pub fn decode(data: &[u8]) -> SinterResult<DynamicImage> {
    let cursor = Cursor::new(data);
    ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))?
        .decode()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))
}

/// AVIF 인코딩
pub fn encode(img: &DynamicImage, quality: u8) -> SinterResult<Vec<u8>> {
    let _avif_quality = normalize_quality(quality)?;
    let rgb_img = img.to_rgb8();
    let width = rgb_img.width() as usize;
    let height = rgb_img.height() as usize;

    // ravif를 사용한 AVIF 인코딩
    let img_data: &[Rgb<u8>] = unsafe {
        std::slice::from_raw_parts(rgb_img.as_raw().as_ptr() as *const Rgb<u8>, width * height)
    };
    let img_buffer = ravif::Img::new(img_data, width, height);

    let encoder = ravif::Encoder::new();
    let output = encoder.encode_rgb(img_buffer).map_err(|e| {
        crate::error::SinterError::AvifEncodingFailed(format!("AVIF encoding failed: {}", e))
    })?;

    Ok(output.avif_file.to_vec())
}

/// AVIF 품질 정규화 (0-100 → AVIF 형식)
fn normalize_quality(quality: u8) -> SinterResult<u8> {
    let normalized = (quality as f32 / 100.0 * 100.0) as u8;
    Ok(normalized.clamp(0, 100))
}
