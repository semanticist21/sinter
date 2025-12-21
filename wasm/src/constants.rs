/// 지원하는 이미지 포맷
pub const SUPPORTED_FORMATS: &[&str] = &["jpeg", "png", "webp", "avif"];

/// 최대 이미지 크기 (픽셀)
/// 브라우저 Canvas 제한 고려
pub const MAX_DIMENSION: u32 = 4096;
