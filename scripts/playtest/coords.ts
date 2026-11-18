// 재생 도구의 좌표 계산. 순수 함수만 둔다 (Chrome 없이 테스트한다).
// 화면 JSON의 대상(핫스팟·서는 자리) → 내부 좌표 → 페이지 CSS px.
// 내부 → 화면 변환은 게임이 입력에 쓰는 것과 같은 함수(viewport.ts)를 쓴다. 따로 계산하면 두 식이 어긋날 수 있다.

import { internalToScreen, type Point, type Rect, type Size } from '../../src/core/viewport.ts';
import type { Box, ScreenData } from '../../src/core/puzzle/types.ts';

export type { Point, Rect, Size };

/** 게임 내부 해상도 (src/core/config.ts와 같아야 한다. 테스트가 확인한다). */
export const INTERNAL: Size = { width: 480, height: 270 };

/** 상자 중심. 정수 내부 픽셀로 내린다(게임 판정이 정수 픽셀 단위다). */
export function boxCenter(box: Box): Point {
  const [x, y, w, h] = box;
  return { x: Math.floor(x + w / 2), y: Math.floor(y + h / 2) };
}

/** step.ts `approachFor`와 같은 규칙: 모든 조건 플래그가 같은 첫 변형을 쓴다. */
function flagsMatch(flags: Record<string, boolean>, want: Record<string, boolean>): boolean {
  return Object.entries(want).every(([k, v]) => flags[k] === v);
}

/**
 * 대상 ID의 지금 클릭 상자. 핫스팟이면 `variants`를 먼저 본다. 서는 자리는 `box`가 있어야 클릭 대상이다.
 * 클릭할 수 없는 대상이면 null (예: `floor`, 상자 없는 자리).
 */
export function targetBox(screen: ScreenData, target: string, flags: Record<string, boolean>): Box | null {
  const hs = screen.hotspots[target];
  if (hs) {
    const v = hs.variants?.find((variant) => flagsMatch(flags, variant.when.flags));
    return v?.box ?? hs.box;
  }
  return screen.spots[target]?.box ?? null;
}

/** 내부 픽셀 p의 *중심*을 페이지 CSS px로. 경계에 걸리면 반올림 때문에 옆 픽셀로 갈 수 있어서 중심을 쓴다. */
export function internalToPage(p: Point, rect: Rect, internal: Size = INTERNAL): Point {
  return internalToScreen({ x: p.x + 0.5, y: p.y + 0.5 }, rect, internal);
}

/** 대상 중심을 페이지 좌표로. 클릭할 수 없는 대상이면 오류(재생 계획이 잘못된 것). */
export function targetPagePoint(
  screen: ScreenData,
  target: string,
  flags: Record<string, boolean>,
  rect: Rect,
): Point {
  const box = targetBox(screen, target, flags);
  if (!box) throw new Error(`클릭할 상자가 없는 대상: ${screen.id}/${target}`);
  return internalToPage(boxCenter(box), rect);
}

/**
 * 상자에서 게임 기준 거리(`src/core/hit.ts` `distanceToBox`)가 정확히 `dist`인 점(각 변의 중앙).
 * A6② "8px 여유 탭" 확인용: dist 8은 터치로 맞아야 하고, 9는 빗나가야 한다.
 */
export function outsidePoint(box: Box, side: 'left' | 'right' | 'top' | 'bottom', dist: number): Point {
  const [x, y, w, h] = box;
  const c = boxCenter(box);
  switch (side) {
    case 'left':
      return { x: x - dist, y: c.y };
    case 'right':
      return { x: x + w + dist, y: c.y };
    case 'top':
      return { x: c.x, y: y - dist };
    case 'bottom':
      return { x: c.x, y: y + h + dist };
  }
}

/** 내부 좌표 상자 → 페이지 CSS px 상자(경계 그대로, 중심 보정 없음). */
export function internalBoxToPage(box: { left: number; top: number; width: number; height: number }, rect: Rect, internal: Size = INTERNAL): Rect {
  const tl = internalToScreen({ x: box.left, y: box.top }, rect, internal);
  const br = internalToScreen({ x: box.left + box.width, y: box.top + box.height }, rect, internal);
  return { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
}

/**
 * C-7(#356): 말풍선이 화면 물건(화자 자신을 뺀 핫스팟)을 덮은 비율. 겹친 넓이 ÷ 핫스팟 넓이, 0보다 큰 것만.
 * 게임 `placeBubble`의 `keep`과 같은 대상이다. 맞닿기만 한 것(겹친 넓이 0)은 세지 않는다.
 */
export function bubbleCovers(
  bubble: Rect,
  speaker: string | null,
  hotspots: Record<string, { left: number; top: number; width: number; height: number }>,
  rect: Rect,
  internal: Size = INTERNAL,
): { id: string; ratio: number }[] {
  const out: { id: string; ratio: number }[] = [];
  for (const [id, box] of Object.entries(hotspots)) {
    if (id === speaker) continue;
    const h = internalBoxToPage(box, rect, internal);
    const w = Math.min(bubble.left + bubble.width, h.left + h.width) - Math.max(bubble.left, h.left);
    const t = Math.min(bubble.top + bubble.height, h.top + h.height) - Math.max(bubble.top, h.top);
    if (w > 0 && t > 0) out.push({ id, ratio: (w * t) / (h.width * h.height) });
  }
  return out;
}
