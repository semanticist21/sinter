use crate::error::SinterResult;
use image::{DynamicImage, ImageEncoder, ImageReader};
use std::io::Cursor;

/// PNG 디코딩
pub fn decode(data: &[u8]) -> SinterResult<DynamicImage> {
    let cursor = Cursor::new(data);
    ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))?
        .decode()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))
}

/// PNG 인코딩
pub fn encode(img: &DynamicImage, quality: u8) -> SinterResult<Vec<u8>> {
    let compression = normalize_quality(quality)?;

    let compression_type = if compression <= 3 {
        image::codecs::png::CompressionType::Fast
    } else if compression <= 6 {
        image::codecs::png::CompressionType::Default
    } else {
        image::codecs::png::CompressionType::Best
    };

    let filter_type = if compression <= 3 {
        image::codecs::png::FilterType::Sub
    } else if compression <= 6 {
        image::codecs::png::FilterType::Up
    } else {
        image::codecs::png::FilterType::Adaptive
    };

    let mut buffer = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new_with_quality(
        &mut buffer,
        compression_type,
        filter_type,
    );
    let rgba_img = img.to_rgba8();

    encoder
        .write_image(
            rgba_img.as_raw(),
            img.width(),
            img.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| {
            crate::error::SinterError::EncodeFailed(format!("PNG encoding failed: {}", e))
        })?;

    Ok(buffer)
}

/// PNG 품질 정규화 (0-100 → 압축 레벨 0-9)
fn normalize_quality(quality: u8) -> SinterResult<u8> {
    // 0-100 범위를 0-9 압축 레벨로 매핑
    let normalized = ((quality as f32 / 100.0) * 9.0) as u8;
    Ok(normalized.clamp(0, 9))
}
