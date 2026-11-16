// 호버 외곽선 (#157 3단계, ADR-0007 결정 2·3-5, 형식 기록 10-1절).
// "투명 픽셀과 4방향으로 맞닿은 가장 바깥 불투명 픽셀"만 hint(31번)로 바꾼다. 색이 아니라 위치로 고르므로
// 안쪽 ink 선·눈동자·입은 그대로다(PR #42 리뷰). 순수 로직이다. 캔버스에서 픽셀을 읽고 쓰는 건 engine/outline.ts.

/** 보송 팔레트 31번 hint `#ff9f43` (docs/design/art/bosong-32.hex 마지막 줄). 호버·선택 강조 전용. */
export const HINT_RGB: readonly [number, number, number] = [0xff, 0x9f, 0x43];

/** 시트 안 사각형 [x, y, w, h]. 프레임 하나. */
export type Rect = readonly [x: number, y: number, w: number, h: number];

/**
 * 시트 RGBA(`width` 픽셀 폭)를 복사해, 각 프레임 사각형 안의 가장 바깥 불투명 픽셀을 `rgb`로 칠한 새 버퍼를 돌려준다.
 * - 사각형 밖은 투명으로 본다. 그래서 시트에서 옆 프레임과 맞붙은 픽셀도 바깥으로 친다(프레임마다 따로 그려지므로).
 * - 알파가 0이 아니면 불투명이다(시트는 인덱스 PNG라 반투명이 없다). 칠한 픽셀은 알파 255.
 * - 사각형 밖 픽셀은 바꾸지 않는다.
 */
export function outlineSheet(src: Uint8ClampedArray, width: number, rects: readonly Rect[], rgb: readonly [number, number, number] = HINT_RGB): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const height = Math.floor(src.length / 4 / width);
  for (const [rx, ry, rw, rh] of rects) {
    const x0 = Math.max(0, rx);
    const y0 = Math.max(0, ry);
    const x1 = Math.min(width, rx + rw);
    const y1 = Math.min(height, ry + rh);
    const solid = (x: number, y: number): boolean => x >= x0 && x < x1 && y >= y0 && y < y1 && src[(y * width + x) * 4 + 3]! > 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (!solid(x, y)) continue;
        if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;
        const i = (y * width + x) * 4;
        out[i] = rgb[0];
        out[i + 1] = rgb[1];
        out[i + 2] = rgb[2];
        out[i + 3] = 255;
      }
    }
  }
  return out;
}
