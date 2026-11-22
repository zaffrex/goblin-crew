// 클릭·탭 대상 판정 (ADR-0007 결정 6). 순수 함수만 둔다.
// 대상의 필드 이름과 앞뒤 순서 값은 퍼즐 데이터 모델 ADR에서 확정한다. 지금 이름은 임시다.

import type { Point } from './viewport';

/** 히트 영역. 내부 픽셀 좌표. left/top 포함, left+width/top+height 미포함. MVP는 사각형만 쓴다. */
export interface HitBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HitTarget {
  id: string;
  box: HitBox;
  /** 앞뒤 순서. 클수록 앞에 그려진다(겹치면 이긴다). 캐릭터는 발 y를 쓴다. */
  z: number;
  /**
   * 있으면 사각형 대신 이 칸 판정을 쓴다(설계 2-1절 그림 칸, #736). 참이면 거리 0, 아니면 이 대상은 안 맞는다.
   * 여유(slop)가 없다. `box`는 그 칸을 감싸는 사각형으로 남겨 둔다(그리기·도구용).
   */
  mask?: (p: Point) => boolean;
}

/** 점이 사각형 안인가(left/top 포함, 오른쪽·아래 끝 미포함). */
export function inBox(p: Point, b: HitBox): boolean {
  return p.x >= b.left && p.x < b.left + b.width && p.y >= b.top && p.y < b.top + b.height;
}

/** 점에서 사각형까지의 거리. 안쪽이면 0. */
export function distanceToBox(p: Point, b: HitBox): number {
  const dx = Math.max(b.left - p.x, 0, p.x - (b.left + b.width));
  const dy = Math.max(b.top - p.y, 0, p.y - (b.top + b.height));
  return Math.hypot(dx, dy);
}

/**
 * 여유 폭(slop) 안에 든 대상 중 하나를 고른다. 없으면 null.
 * 1. 거리가 가장 짧은 대상
 * 2. 같으면 앞(z가 큰 쪽)
 * 3. 그래도 같으면 id 사전순 (배열 순서에 결과가 좌우되지 않게)
 * 엔진은 포인터 종류만 보고 slop 숫자를 넘긴다(마우스 0, 터치 8). `mask`가 있는 대상은 여유 없이 칸 위일 때만 맞는다.
 */
export function hitTest<T extends HitTarget>(targets: readonly T[], p: Point, slop: number): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const d = t.mask ? (t.mask(p) ? 0 : Infinity) : distanceToBox(p, t.box);
    if (d > slop) continue;
    if (best === null || d < bestDist || (d === bestDist && (t.z > best.z || (t.z === best.z && t.id < best.id)))) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}
