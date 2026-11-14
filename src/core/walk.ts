// 캐릭터 걷기: 클릭한 바닥 점까지 고정 틱마다 일정 속도로 직선 이동한다 (#35).
// 순수 로직이다. 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다 (ADR-0004 결정 2).
// 경로 찾기(장애물 우회)는 M1 퍼즐 데이터 모델에서 다룬다. 지금은 바닥이 사각형 하나다.

import type { Point } from './viewport';

/** 캐릭터 발이 설 수 있는 영역. 내부 픽셀 좌표, 양 끝 포함. */
export interface WalkArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Facing = 1 | -1;

export interface Walker {
  /** 안정 ID (ADR-0003). 세이브와 퍼즐 데이터가 이 값을 참조한다. */
  id: string;
  /** 발 위치(내부 픽셀). 그릴 때 반올림한다. */
  x: number;
  y: number;
  /** 걸어가는 목표점. 서 있으면 null. */
  target: Point | null;
  /** 1 = 오른쪽, -1 = 왼쪽 */
  facing: Facing;
  /** 지금 걷기를 시작한 뒤 지난 틱 수. 걷기 흔들림 애니메이션용. 서 있으면 0. */
  walkTicks: number;
}

export function createWalker(id: string, at: Point, facing: Facing = 1): Walker {
  return { id, x: at.x, y: at.y, target: null, facing, walkTicks: 0 };
}

/** 바닥 밖을 클릭하면 가장 가까운 바닥 점으로 보낸다 (벽을 클릭해도 그쪽으로 걸어간다). */
export function clampToArea(p: Point, area: WalkArea): Point {
  return {
    x: Math.min(area.right, Math.max(area.left, p.x)),
    y: Math.min(area.bottom, Math.max(area.top, p.y)),
  };
}

/**
 * 새 목표를 준다. 걷는 중이어도 바로 바꾼다 ("새 입력이 오면 자동 걷기 취소"가 기본값).
 * 이미 그 자리에 서 있으면 아무 일도 하지 않는다.
 */
export function walkTo(w: Walker, p: Point, area: WalkArea): void {
  const t = clampToArea(p, area);
  if (t.x === w.x && t.y === w.y) {
    w.target = null;
    w.walkTicks = 0;
    return;
  }
  if (t.x !== w.x) w.facing = t.x > w.x ? 1 : -1;
  w.target = t;
}

/** 한 틱 진행한다. speed는 틱당 픽셀. 목표를 넘어가지 않고 정확히 그 점에 멈춘다. */
export function stepWalker(w: Walker, speed: number): void {
  const t = w.target;
  if (!t) return;
  const dx = t.x - w.x;
  const dy = t.y - w.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed) {
    w.x = t.x;
    w.y = t.y;
    w.target = null;
    w.walkTicks = 0;
    return;
  }
  w.x += (dx / dist) * speed;
  w.y += (dy / dist) * speed;
  w.walkTicks += 1;
}

export function isWalking(w: Walker): boolean {
  return w.target !== null;
}
