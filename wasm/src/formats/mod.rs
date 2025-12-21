//! 포맷별 인코더 모듈

pub mod avif;
pub mod jpeg;
pub mod png;
pub mod webp;

use crate::error::{SinterError, SinterResult};
use image::DynamicImage;

/// 바이트 데이터를 지정된 포맷에서 디코딩
pub fn decode(data: &[u8], format: &str) -> SinterResult<DynamicImage> {
    match format {
        "image/jpeg" => jpeg::decode(data),
        "image/png" => png::decode(data),
        "image/webp" => webp::decode(data),
        "image/avif" => avif::decode(data),
        // 기타 포맷도 image 크레이트가 자동 처리 (with_guessed_format)
        _ => jpeg::decode(data), // 기본값은 모든 포맷 시도
    }
}

/// 지정된 포맷으로 이미지 인코딩
pub fn encode(img: &DynamicImage, format: &str, quality: u8) -> SinterResult<Vec<u8>> {
    match format {
        "jpeg" => jpeg::encode(img, quality),
        "png" => png::encode(img, quality),
        "webp" => webp::encode(img, quality),
        "avif" => avif::encode(img, quality),
        _ => Err(SinterError::InvalidFormat(format.to_string())),
    }
}
