// Pointer Events 하나로 마우스·터치·펜을 받는다 (ADR-0004 결정 5).

import { screenToInternal, type Point, type Rect, type Size } from '../core/viewport';

export function onPointerTap(
  target: HTMLElement,
  rect: () => Rect,
  internal: Size,
  handler: (p: Point) => void,
): () => void {
  function listener(e: PointerEvent): void {
    if (!e.isPrimary || e.button !== 0) return;
    const p = screenToInternal({ x: e.clientX, y: e.clientY }, rect(), internal);
    if (p) handler(p);
  }
  target.addEventListener('pointerdown', listener);
  return () => target.removeEventListener('pointerdown', listener);
}
