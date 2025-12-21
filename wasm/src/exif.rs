use crate::error::{SinterError, SinterResult};
use img_parts::{Bytes, ImageEXIF};

/// EXIF 메타데이터 처리
pub struct ExifHandler;

impl ExifHandler {
    /// 이미지 데이터에서 EXIF 정보 추출
    pub fn extract(image_data: &[u8], mime_type: &str) -> SinterResult<Option<Vec<u8>>> {
        match mime_type {
            "image/jpeg" => Self::extract_jpeg(image_data),
            "image/png" => Self::extract_png(image_data),
            "image/webp" => Self::extract_webp(image_data),
            "image/avif" => Self::extract_avif(image_data),
            _ => Ok(None),
        }
    }

    /// JPEG에서 EXIF 추출
    fn extract_jpeg(data: &[u8]) -> SinterResult<Option<Vec<u8>>> {
        use img_parts::jpeg::Jpeg;

        Jpeg::from_bytes(Bytes::copy_from_slice(data))
            .map_err(|e| SinterError::ExifFailed(e.to_string()))
            .and_then(|jpeg| Ok(jpeg.exif().map(|exif| exif.to_vec().to_vec())))
    }

    /// PNG에서 EXIF 추출
    fn extract_png(data: &[u8]) -> SinterResult<Option<Vec<u8>>> {
        use img_parts::png::Png;

        Png::from_bytes(Bytes::copy_from_slice(data))
            .map_err(|e| SinterError::ExifFailed(e.to_string()))
            .and_then(|png| Ok(png.exif().map(|exif| exif.to_vec().to_vec())))
    }

    /// WebP에서 EXIF 추출
    fn extract_webp(data: &[u8]) -> SinterResult<Option<Vec<u8>>> {
        use img_parts::webp::WebP;

        WebP::from_bytes(Bytes::copy_from_slice(data))
            .map_err(|e| SinterError::ExifFailed(e.to_string()))
            .and_then(|webp| Ok(webp.exif().map(|exif| exif.to_vec().to_vec())))
    }

    /// AVIF에서 EXIF 추출 (현재는 지원 안함)
    fn extract_avif(_data: &[u8]) -> SinterResult<Option<Vec<u8>>> {
        // AVIF는 img_parts에서 지원하지 않으므로 None 반환
        Ok(None)
    }

    /// EXIF를 이미지에 삽입
    pub fn insert(image_data: &[u8], exif_data: &[u8], mime_type: &str) -> SinterResult<Vec<u8>> {
        match mime_type {
            "image/jpeg" => Self::insert_jpeg(image_data, exif_data),
            "image/png" => Self::insert_png(image_data, exif_data),
            "image/webp" => Self::insert_webp(image_data, exif_data),
            "image/avif" => {
                // AVIF는 현재 EXIF 삽입 미지원
                Ok(image_data.to_vec())
            }
            _ => Ok(image_data.to_vec()),
        }
    }

    /// JPEG에 EXIF 삽입
    fn insert_jpeg(image_data: &[u8], exif_data: &[u8]) -> SinterResult<Vec<u8>> {
        use img_parts::jpeg::Jpeg;

        let mut jpeg = Jpeg::from_bytes(Bytes::copy_from_slice(image_data))
            .map_err(|e| SinterError::ExifFailed(format!("Failed to parse JPEG: {}", e)))?;

        jpeg.set_exif(Some(Bytes::copy_from_slice(exif_data)));
        Ok(jpeg.encoder().bytes().to_vec())
    }

    /// PNG에 EXIF 삽입
    fn insert_png(image_data: &[u8], exif_data: &[u8]) -> SinterResult<Vec<u8>> {
        use img_parts::png::Png;

        let mut png = Png::from_bytes(Bytes::copy_from_slice(image_data))
            .map_err(|e| SinterError::ExifFailed(format!("Failed to parse PNG: {}", e)))?;

        png.set_exif(Some(Bytes::copy_from_slice(exif_data)));
        Ok(png.encoder().bytes().to_vec())
    }

    /// WebP에 EXIF 삽입
    fn insert_webp(image_data: &[u8], exif_data: &[u8]) -> SinterResult<Vec<u8>> {
        use img_parts::webp::WebP;

        let mut webp = WebP::from_bytes(Bytes::copy_from_slice(image_data))
            .map_err(|e| SinterError::ExifFailed(format!("Failed to parse WebP: {}", e)))?;

        webp.set_exif(Some(Bytes::copy_from_slice(exif_data)));
        Ok(webp.encoder().bytes().to_vec())
    }
}
