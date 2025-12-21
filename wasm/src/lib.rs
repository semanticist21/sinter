mod constants;
mod error;
mod exif;
mod formats;
mod resize;

use error::SinterResult;
use exif::ExifHandler;
use resize::ImageResizer;
use wasm_bindgen::prelude::*;

/// WASM용 이미지 압축 결과
#[wasm_bindgen]
#[derive(Clone)]
pub struct CompressResult {
    data: Vec<u8>,
    width: u32,
    height: u32,
    format: String,
}

#[wasm_bindgen]
impl CompressResult {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn format(&self) -> String {
        self.format.clone()
    }
}

/// 이미지 압축 및 포맷 변환
///
/// # 인자
/// - `data`: 원본 이미지 바이너리 데이터
/// - `mime_type`: 원본 파일의 MIME 타입 (e.g., "image/jpeg")
/// - `target_format`: 대상 포맷 ("jpeg", "png", "webp", "avif")
/// - `max_width`: 최대 너비 (0이면 무제한)
/// - `max_height`: 최대 높이 (0이면 무제한)
/// - `max_size_kb`: 최대 파일 크기 (KB, 0이면 무제한)
/// - `preserve_exif`: EXIF 메타데이터 보존 여부
///
/// # 반환
/// - 압축된 이미지 데이터와 메타데이터 (CompressResult)
#[wasm_bindgen]
pub fn compress_image(
    data: &[u8],
    mime_type: &str,
    target_format: &str,
    max_width: u32,
    max_height: u32,
    max_size_kb: u32,
    preserve_exif: bool,
) -> Result<CompressResult, String> {
    compress_image_internal(
        data,
        mime_type,
        target_format,
        if max_width > 0 { Some(max_width) } else { None },
        if max_height > 0 {
            Some(max_height)
        } else {
            None
        },
        if max_size_kb > 0 {
            Some(max_size_kb)
        } else {
            None
        },
        preserve_exif,
    )
    .map_err(|e| format!("Compression failed: {}", e))
}

fn compress_image_internal(
    data: &[u8],
    mime_type: &str,
    target_format: &str,
    max_width: Option<u32>,
    max_height: Option<u32>,
    max_size_kb: Option<u32>,
    preserve_exif: bool,
) -> SinterResult<CompressResult> {
    // 1. EXIF 추출 (보존이 필요하면)
    let exif_data = if preserve_exif {
        ExifHandler::extract(data, mime_type)?
    } else {
        None
    };

    // 2. 이미지 디코딩
    let mut img = formats::decode(data, mime_type)?;

    // 3. 리사이징 (maxWidth/maxHeight)
    if max_width.is_some() || max_height.is_some() {
        img = ImageResizer::resize(&img, max_width, max_height)?;
    }

    // 4. 인코딩 (초기 품질 85)
    let mut encoded = formats::encode(&img, target_format, 85)?;

    // 5. maxSize 제약 적용 (반복 품질 감소)
    if let Some(max_kb) = max_size_kb {
        let max_bytes = (max_kb as usize) * 1024;
        let mut quality = 85u8;

        while encoded.len() > max_bytes && quality > 20 {
            quality = quality.saturating_sub(5);
            encoded = formats::encode(&img, target_format, quality)?;
        }
    }

    // 6. EXIF 삽입 (필요하면)
    if let Some(exif) = exif_data {
        encoded = ExifHandler::insert(&encoded, &exif, &format!("image/{}", target_format))?;
    }

    // 결과 반환
    Ok(CompressResult {
        data: encoded,
        width: img.width(),
        height: img.height(),
        format: target_format.to_string(),
    })
}

/// 이미지 정보 조회 (WASM에서 직접 사용 가능)
#[wasm_bindgen]
pub fn get_image_info(data: &[u8], mime_type: &str) -> Result<String, String> {
    let img =
        formats::decode(data, mime_type).map_err(|e| format!("Failed to decode image: {}", e))?;

    let info = format!(r#"{{"width":{},"height":{}}}"#, img.width(), img.height());

    Ok(info)
}

/// 포맷 지원 여부 확인
#[wasm_bindgen]
pub fn is_format_supported(format: &str) -> bool {
    constants::SUPPORTED_FORMATS.contains(&format)
}
