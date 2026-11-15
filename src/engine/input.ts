// Pointer Events 하나로 마우스·터치·펜을 받는다 (ADR-0004 결정 5).

import { screenToInternal, type Point, type Rect, type Size } from '../core/viewport';

/** 터치는 손가락이 커서보다 부정확하므로 히트 영역을 사방 8px 넓혀 판정한다 (ADR-0007 결정 6). */
export const TOUCH_SLOP = 8;

export function slopFor(pointerType: string): number {
  return pointerType === 'touch' ? TOUCH_SLOP : 0;
}

export function onPointerTap(
  target: HTMLElement,
  rect: () => Rect,
  internal: Size,
  handler: (p: Point, slop: number) => void,
): () => void {
  function listener(e: PointerEvent): void {
    if (!e.isPrimary || e.button !== 0) return;
    const p = screenToInternal({ x: e.clientX, y: e.clientY }, rect(), internal);
    if (p) handler(p, slopFor(e.pointerType));
  }
  target.addEventListener('pointerdown', listener);
  return () => target.removeEventListener('pointerdown', listener);
}
