use crate::error::SinterResult;
use image::{DynamicImage, ImageReader};
use std::io::Cursor;

/// WebP 디코딩
pub fn decode(data: &[u8]) -> SinterResult<DynamicImage> {
    let cursor = Cursor::new(data);
    ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))?
        .decode()
        .map_err(|e| crate::error::SinterError::DecodeFailed(e.to_string()))
}

/// WebP 인코딩
/// Note: libwebp-sys 네이티브 컴파일 제약으로 WASM에서는 지원 불가
/// PNG로 폴백 처리 (src/formats/png.rs 사용)
pub fn encode(img: &DynamicImage, quality: u8) -> SinterResult<Vec<u8>> {
    // WebP는 WASM에서 지원 불가능하므로 PNG로 폴백
    super::png::encode(img, quality)
}
