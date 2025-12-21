use crate::constants::MAX_DIMENSION;
use crate::error::{SinterError, SinterResult};
use image::imageops::FilterType;
use image::DynamicImage;

/// 종횡비를 유지하면서 이미지 리사이징
pub struct ImageResizer;

impl ImageResizer {
    /// 최대 너비/높이 제약 조건에 맞게 이미지 리사이징
    /// 종횡비는 항상 유지됨
    ///
    /// # 인자
    /// - `img`: 원본 이미지
    /// - `max_width`: 최대 너비 (None이면 무제한)
    /// - `max_height`: 최대 높이 (None이면 무제한)
    ///
    /// # 반환
    /// - 리사이징된 이미지 (제약 조건이 없으면 원본 반환)
    pub fn resize(
        img: &DynamicImage,
        max_width: Option<u32>,
        max_height: Option<u32>,
    ) -> SinterResult<DynamicImage> {
        let (original_width, original_height) = (img.width(), img.height());

        // 제약 조건이 없으면 원본 반환
        if max_width.is_none() && max_height.is_none() {
            return Ok(img.clone());
        }

        // 새로운 크기 계산 (종횡비 유지)
        let (new_width, new_height) =
            Self::calculate_dimensions(original_width, original_height, max_width, max_height)?;

        // 이미 제약 조건을 만족하면 원본 반환
        if new_width == original_width && new_height == original_height {
            return Ok(img.clone());
        }

        // 리사이징 수행 (Lanczos3: 고품질)
        let resized = img.resize_exact(new_width, new_height, FilterType::Lanczos3);
        Ok(resized)
    }

    /// 종횡비를 유지하면서 새로운 크기 계산
    /// maxWidth와 maxHeight 두 조건을 모두 만족하는 크기를 찾음
    fn calculate_dimensions(
        original_width: u32,
        original_height: u32,
        max_width: Option<u32>,
        max_height: Option<u32>,
    ) -> SinterResult<(u32, u32)> {
        // 원본 종횡비
        let aspect_ratio = original_width as f64 / original_height as f64;

        // 초기값: 원본 크기
        let mut new_width = original_width;
        let mut new_height = original_height;

        // maxWidth 제약 적용
        if let Some(max_w) = max_width {
            if new_width > max_w {
                new_width = max_w;
                new_height = (new_width as f64 / aspect_ratio).round() as u32;
            }
        }

        // maxHeight 제약 적용 (이미 조정된 크기 기준)
        if let Some(max_h) = max_height {
            if new_height > max_h {
                new_height = max_h;
                new_width = (new_height as f64 * aspect_ratio).round() as u32;
            }
        }

        // 최소 크기 검증 (1x1 이상)
        new_width = new_width.max(1);
        new_height = new_height.max(1);

        // 최대 크기 검증 (브라우저 Canvas 제한)
        if new_width > MAX_DIMENSION || new_height > MAX_DIMENSION {
            return Err(SinterError::InvalidDimensions {
                width: new_width,
                height: new_height,
            });
        }

        Ok((new_width, new_height))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_dimensions_landscape() {
        // 원본: 800x600 (4:3)
        let (w, h) = ImageResizer::calculate_dimensions(800, 600, Some(400), None).unwrap();
        assert_eq!(w, 400);
        assert_eq!(h, 300); // 종횡비 유지
    }

    #[test]
    fn test_calculate_dimensions_portrait() {
        // 원본: 600x800 (3:4)
        let (w, h) = ImageResizer::calculate_dimensions(600, 800, None, Some(400)).unwrap();
        assert_eq!(w, 300);
        assert_eq!(h, 400); // 종횡비 유지
    }

    #[test]
    fn test_calculate_dimensions_both_constraints() {
        // 원본: 1000x1000, 제약: 600x500
        // width 기준으로 먼저: 1000 → 600 (600:600)
        // height 제약 500 적용: 600 → 500 (500:500)
        let (w, h) = ImageResizer::calculate_dimensions(1000, 1000, Some(600), Some(500)).unwrap();
        assert_eq!(w, 500);
        assert_eq!(h, 500);
    }

    #[test]
    fn test_no_resize_needed() {
        // 원본: 400x300, 제약: 800x600
        let (w, h) = ImageResizer::calculate_dimensions(400, 300, Some(800), Some(600)).unwrap();
        assert_eq!(w, 400);
        assert_eq!(h, 300); // 원본 유지
    }
}
