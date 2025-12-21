use thiserror::Error;

/// Sinter WASM 작업 중 발생할 수 있는 에러
#[derive(Error, Debug)]
pub enum SinterError {
    #[error("Image decode failed: {0}")]
    DecodeFailed(String),

    #[error("Image encode failed: {0}")]
    EncodeFailed(String),

    #[error("Invalid format: {0}")]
    InvalidFormat(String),

    #[error("EXIF processing failed: {0}")]
    ExifFailed(String),

    #[error("Invalid dimensions: width={width}, height={height}")]
    InvalidDimensions { width: u32, height: u32 },

    #[error("AVIF encoding failed: {0}")]
    AvifEncodingFailed(String),
}

pub type SinterResult<T> = Result<T, SinterError>;
