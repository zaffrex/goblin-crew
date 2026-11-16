// 호버 외곽선 시트 만들기 (#157 3단계, 형식 기록 10-1절). 픽셀 고르기는 core/outline.ts.
// 시트 이미지가 읽힌 뒤 한 번, 프레임마다 외곽선을 칠한 "외곽선 시트"를 캔버스로 만들어 둔다.
// 그릴 때는 같은 src 사각형을 원래 시트 대신 이 캔버스에서 잘라 그린다(좌우 뒤집기도 그대로 된다).

import { outlineSheet, type Rect } from '../core/outline';

/** 외곽선 시트. 캔버스를 못 만들거나 픽셀을 못 읽으면(오염된 캔버스 등) null → 외곽선 없이 그린다. */
export function buildOutlined(image: HTMLImageElement, rects: readonly Rect[]): HTMLCanvasElement | null {
  const { naturalWidth: w, naturalHeight: h } = image;
  if (w === 0 || h === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, w, h);
    pixels.data.set(outlineSheet(pixels.data, w, rects));
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  } catch (e) {
    console.warn(`외곽선 시트를 못 만들었어요(${image.src}): ${(e as Error).message}`);
    return null;
  }
}
