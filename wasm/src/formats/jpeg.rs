use crate::error::SinterResult;
use image::{DynamicImage, ImageReader};
use std::io::Cursor;

/// JPEG 디코딩
pub fn decode(data: &[u8]) -> SinterResult<DynamicImage> {
    let cursor = Cursor::new(data);
    ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))?
        .decode()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))
}

/// JPEG 인코딩
pub fn encode(img: &DynamicImage, quality: u8) -> SinterResult<Vec<u8>> {
    let jpeg_quality = normalize_quality(quality)?;
    let mut buffer = Vec::new();

    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, jpeg_quality);
    let rgb_img = img.to_rgb8();

    encoder
        .encode(
            rgb_img.as_raw(),
            img.width(),
            img.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| {
            crate::error::SinterError::EncodeFailed(format!("JPEG encoding failed: {}", e))
        })?;

    Ok(buffer)
}

/// JPEG 품질 정규화 (0-100 → JPEG 범위 0-100)
fn normalize_quality(quality: u8) -> SinterResult<u8> {
    // JPEG는 0-100 범위 사용
    Ok(quality.clamp(1, 100))
}
