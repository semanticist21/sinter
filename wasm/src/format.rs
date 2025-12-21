//! 이미지 포맷 정의 및 자동 감지

use crate::error::{SinterError, SinterResult};

/// 지원하는 이미지 포맷
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Jpeg,
    Png,
    Webp,
    Avif,
}

impl ImageFormat {
    /// MIME 타입으로부터 포맷 판별
    /// 예: "image/jpeg" → Some(ImageFormat::Jpeg)
    pub fn from_mime_type(mime: &str) -> Option<Self> {
        match mime {
            "image/jpeg" | "image/jpg" => Some(Self::Jpeg),
            "image/png" => Some(Self::Png),
            "image/webp" => Some(Self::Webp),
            "image/avif" => Some(Self::Avif),
            _ => None,
        }
    }

    /// 파일의 magic bytes로부터 포맷 자동 감지
    pub fn detect_from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 4 {
            return None;
        }

        // JPEG: FF D8 FF
        if bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff {
            return Some(Self::Jpeg);
        }

        // PNG: 89 50 4E 47
        if bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47 {
            return Some(Self::Png);
        }

        // WebP: RIFF ... WEBP (bytes 8-12)
        if bytes.len() >= 12
            && bytes[0] == 0x52
            && bytes[1] == 0x49
            && bytes[2] == 0x46
            && bytes[3] == 0x46
            && bytes[8] == 0x57
            && bytes[9] == 0x45
            && bytes[10] == 0x42
            && bytes[11] == 0x50
        {
            return Some(Self::Webp);
        }

        // AVIF: ftyp (bytes 4-7) + major brand (bytes 8-11)
        // Supported brands: "avif" (61 76 69 66), "avis" (61 76 69 73), "avio" (61 76 69 6F)
        if bytes.len() >= 12
            && bytes[4] == 0x66  // 'f'
            && bytes[5] == 0x74  // 't'
            && bytes[6] == 0x79  // 'y'
            && bytes[7] == 0x70  // 'p'
            && bytes[8] == 0x61  // 'a'
            && bytes[9] == 0x76  // 'v'
            && bytes[10] == 0x69 // 'i'
            && (bytes[11] == 0x66 || bytes[11] == 0x73 || bytes[11] == 0x6F)
        // 'f' | 's' | 'o'
        {
            return Some(Self::Avif);
        }

        None
    }

    /// MIME 타입 또는 magic bytes로부터 포맷 감지 (MIME 우선)
    pub fn detect(mime_type: &str, bytes: &[u8]) -> SinterResult<Self> {
        Self::from_mime_type(mime_type)
            .or_else(|| Self::detect_from_bytes(bytes))
            .ok_or(SinterError::InvalidFormat(
                "Unsupported image format".to_string(),
            ))
    }

    /// 이 포맷의 MIME 타입 반환
    pub fn mime_type(&self) -> &'static str {
        match self {
            Self::Jpeg => "image/jpeg",
            Self::Png => "image/png",
            Self::Webp => "image/webp",
            Self::Avif => "image/avif",
        }
    }

    /// 이 포맷의 파일 확장자 반환 (점 제외)
    pub fn extension(&self) -> &'static str {
        match self {
            Self::Jpeg => "jpg",
            Self::Png => "png",
            Self::Webp => "webp",
            Self::Avif => "avif",
        }
    }

    /// 이 포맷의 문자열 표현 반환 (인코드 시 사용)
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Jpeg => "jpeg",
            Self::Png => "png",
            Self::Webp => "webp",
            Self::Avif => "avif",
        }
    }
}

impl std::fmt::Display for ImageFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for ImageFormat {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "jpeg" | "jpg" => Ok(Self::Jpeg),
            "png" => Ok(Self::Png),
            "webp" => Ok(Self::Webp),
            "avif" => Ok(Self::Avif),
            _ => Err(format!("Unknown format: {}", s)),
        }
    }
}
