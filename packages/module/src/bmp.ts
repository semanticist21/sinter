import { SinterCodecError } from "./errors";

// BMP 파일 헤더 크기 상수
const FILE_HEADER_SIZE = 14;
// BITMAPV4HEADER 크기 (알파 채널 지원)
const V4_HEADER_SIZE = 108;
// 픽셀 데이터 시작 오프셋 = 파일 헤더 + V4 헤더
const PIXEL_OFFSET = FILE_HEADER_SIZE + V4_HEADER_SIZE;

// 순수 TS BMP 디코더: ArrayBuffer → ImageData (RGBA)
export function decodeBmp(buffer: ArrayBuffer): ImageData {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // BM 시그니처 검증
  if (data[0] !== 0x42 || data[1] !== 0x4d) {
    throw new SinterCodecError("Failed to decode BMP: invalid BMP file signature.");
  }
  if (buffer.byteLength < FILE_HEADER_SIZE + 40) {
    throw new SinterCodecError("Failed to decode BMP: file is too small.");
  }

  // 파일 헤더에서 픽셀 데이터 오프셋 읽기
  const pixelOffset = view.getUint32(10, true);

  // 정보 헤더 파싱
  const headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  // 양수 높이 = bottom-up(아래→위), 음수 = top-down(위→아래)
  const bottomUp = rawHeight > 0;
  const bitCount = view.getUint16(28, true);

  if (bitCount !== 24 && bitCount !== 32) {
    throw new SinterCodecError(
      `Failed to decode BMP: ${bitCount}-bit BMP is not supported. Only 24-bit and 32-bit are supported.`
    );
  }
  if (width <= 0 || height <= 0) {
    throw new SinterCodecError("Failed to decode BMP: invalid image dimensions.");
  }

  // compression 필드: 0=BI_RGB(무압축), 3=BI_BITFIELDS만 지원
  const compression = view.getUint32(30, true);
  if (compression !== 0 && compression !== 3) {
    throw new SinterCodecError(
      `Failed to decode BMP: unsupported compression type (${compression}). Only BI_RGB and BI_BITFIELDS are supported.`
    );
  }

  // V4/V5 헤더에서 AlphaMask 확인하여 알파 채널 여부 결정
  let hasAlpha = false;
  if (headerSize >= 108 && buffer.byteLength >= FILE_HEADER_SIZE + 108) {
    const alphaMask = view.getUint32(FILE_HEADER_SIZE + 52, true); // AlphaMask 위치
    hasAlpha = alphaMask !== 0;
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  const bytesPerPixel = bitCount / 8;
  // 행 패딩: BMP 각 행은 4바이트 배수로 정렬
  const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;

  // 픽셀 데이터 영역이 버퍼를 초과하는지 검증
  if (pixelOffset + height * rowStride > buffer.byteLength) {
    throw new SinterCodecError(
      "Failed to decode BMP: pixel data extends beyond the end of the file."
    );
  }

  for (let row = 0; row < height; row++) {
    // bottom-up이면 파일에서 마지막 행이 이미지의 첫 행
    const srcRow = bottomUp ? height - 1 - row : row;
    const srcBase = pixelOffset + srcRow * rowStride;
    const dstBase = row * width * 4;

    for (let col = 0; col < width; col++) {
      const src = srcBase + col * bytesPerPixel;
      const dst = dstBase + col * 4;
      // BMP는 BGR(A) 저장 순서 → RGBA로 변환
      rgba[dst] = data[src + 2]; // R
      rgba[dst + 1] = data[src + 1]; // G
      rgba[dst + 2] = data[src + 0]; // B
      rgba[dst + 3] = bitCount === 32 && hasAlpha ? data[src + 3] : 255; // A
    }
  }

  return new ImageData(rgba, width, height);
}

// 순수 TS BMP 인코더: ImageData (RGBA) → ArrayBuffer (BITMAPV4HEADER, 32-bit BGRA)
export function encodeBmp(imageData: ImageData): ArrayBuffer {
  const { width, height, data } = imageData;
  const pixelDataSize = width * height * 4;
  const fileSize = PIXEL_OFFSET + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const out = new Uint8Array(buf);
  const view = new DataView(buf);

  // --- BITMAPFILEHEADER (14바이트) ---
  out[0] = 0x42;
  out[1] = 0x4d; // "BM" 시그니처
  view.setUint32(2, fileSize, true); // 전체 파일 크기
  view.setUint32(6, 0, true); // 예약 필드 (0)
  view.setUint32(10, PIXEL_OFFSET, true); // 픽셀 데이터 시작 오프셋

  // --- BITMAPV4HEADER (108바이트, 오프셋 14~) ---
  view.setUint32(14, V4_HEADER_SIZE, true); // 헤더 크기
  view.setInt32(18, width, true); // 이미지 너비
  view.setInt32(22, height, true); // 이미지 높이 (양수 = bottom-up)
  view.setUint16(26, 1, true); // 색상 플레인 수 (항상 1)
  view.setUint16(28, 32, true); // 픽셀당 비트 수 (32-bit BGRA)
  view.setUint32(30, 3, true); // BI_BITFIELDS (채널 마스크 사용)
  view.setUint32(34, pixelDataSize, true); // 픽셀 데이터 크기
  view.setUint32(38, 2835, true); // X 해상도 (~72 DPI)
  view.setUint32(42, 2835, true); // Y 해상도 (~72 DPI)
  view.setUint32(46, 0, true); // 색상 테이블 크기 (없음)
  view.setUint32(50, 0, true); // 중요 색상 수 (없음)
  // 채널 마스크 (BGRA 픽셀 저장 방식 기준)
  view.setUint32(54, 0x00ff0000, true); // 빨강 마스크
  view.setUint32(58, 0x0000ff00, true); // 초록 마스크
  view.setUint32(62, 0x000000ff, true); // 파랑 마스크
  view.setUint32(66, 0xff000000, true); // 알파 마스크
  // CSType = LCS_sRGB ("sRGB" 리틀 엔디언 → 바이트: 73 52 47 42)
  view.setUint32(70, 0x42475273, true);
  // 나머지 V4 필드 (Endpoints, Gamma 값)는 ArrayBuffer 초기화 시 0으로 설정됨

  // --- 픽셀 데이터 (bottom-up, BGRA 순서) ---
  let dst = PIXEL_OFFSET;
  for (let row = height - 1; row >= 0; row--) {
    const srcBase = row * width * 4;
    for (let col = 0; col < width; col++) {
      const src = srcBase + col * 4;
      // RGBA → BGRA 변환
      out[dst++] = data[src + 2]; // B
      out[dst++] = data[src + 1]; // G
      out[dst++] = data[src + 0]; // R
      out[dst++] = data[src + 3]; // A
    }
  }

  return buf;
}
