use wasm_bindgen::prelude::*;

/// 그레이스케일 변환
#[wasm_bindgen]
pub fn grayscale(data: &[u8]) -> Vec<u8> {
    data.chunks(4)
        .flat_map(|chunk| {
            if chunk.len() >= 4 {
                let r = chunk[0] as f32;
                let g = chunk[1] as f32;
                let b = chunk[2] as f32;
                let a = chunk[3];

                // 표준 luminance 공식
                let gray = (0.299 * r + 0.587 * g + 0.114 * b) as u8;
                vec![gray, gray, gray, a]
            } else {
                chunk.to_vec()
            }
        })
        .collect()
}

/// 밝기 조절
#[wasm_bindgen]
pub fn brightness(data: &[u8], amount: i32) -> Vec<u8> {
    data.chunks(4)
        .flat_map(|chunk| {
            if chunk.len() >= 4 {
                let r = (chunk[0] as i32 + amount).clamp(0, 255) as u8;
                let g = (chunk[1] as i32 + amount).clamp(0, 255) as u8;
                let b = (chunk[2] as i32 + amount).clamp(0, 255) as u8;
                let a = chunk[3];
                vec![r, g, b, a]
            } else {
                chunk.to_vec()
            }
        })
        .collect()
}

/// 반전 효과
#[wasm_bindgen]
pub fn invert(data: &[u8]) -> Vec<u8> {
    data.chunks(4)
        .flat_map(|chunk| {
            if chunk.len() >= 4 {
                vec![255 - chunk[0], 255 - chunk[1], 255 - chunk[2], chunk[3]]
            } else {
                chunk.to_vec()
            }
        })
        .collect()
}

/// 블러 효과 (간단한 박스 블러)
#[wasm_bindgen]
pub fn blur(data: &[u8], width: u32, height: u32, radius: u32) -> Vec<u8> {
    let mut result = vec![0u8; data.len()];
    let stride = width as usize * 4;

    for y in 0..height as usize {
        for x in 0..width as usize {
            let mut r_sum = 0u32;
            let mut g_sum = 0u32;
            let mut b_sum = 0u32;
            let mut a_sum = 0u32;
            let mut count = 0u32;

            for dy in 0..=radius as usize * 2 {
                for dx in 0..=radius as usize * 2 {
                    let ny = (y as i32 + dy as i32 - radius as i32).clamp(0, height as i32 - 1) as usize;
                    let nx = (x as i32 + dx as i32 - radius as i32).clamp(0, width as i32 - 1) as usize;

                    let idx = ny * stride + nx * 4;
                    r_sum += data[idx] as u32;
                    g_sum += data[idx + 1] as u32;
                    b_sum += data[idx + 2] as u32;
                    a_sum += data[idx + 3] as u32;
                    count += 1;
                }
            }

            let idx = y * stride + x * 4;
            result[idx] = (r_sum / count) as u8;
            result[idx + 1] = (g_sum / count) as u8;
            result[idx + 2] = (b_sum / count) as u8;
            result[idx + 3] = (a_sum / count) as u8;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grayscale() {
        let input = vec![255, 0, 0, 255]; // 빨강
        let output = grayscale(&input);
        assert_eq!(output.len(), 4);
        assert_eq!(output[3], 255); // 알파는 유지
    }
}
