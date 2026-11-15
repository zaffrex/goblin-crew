// 게임 상태의 최소 골격. 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다
// (Map/Set/클래스/함수/undefined 금지, ADR-0004 결정 2, ADR-0006 세이브).

import { walkerHitBox, type CharacterId } from './characters';
import { WALK_AREA, WALK_SPEED } from './config';
import { hitTest, type HitTarget } from './hit';
import type { Point } from './viewport';
import { createWalker, stepWalker, walkTo, type Walker } from './walk';

export interface GameState {
  tick: number;
  /** 지금 조작하는 캐릭터 ID. */
  active: CharacterId;
  /** 화면에 있는 캐릭터. 순서는 의미 없다(그리기·판정은 y와 id로 정한다). */
  chars: Walker[];
}

/** click()의 결과. 엔진이 효과음·커서 같은 반응을 고르는 데 쓴다. */
export type ClickResult = { kind: 'select'; id: CharacterId } | { kind: 'walk' } | { kind: 'none' };

export function createGame(): GameState {
  return {
    tick: 0,
    active: 'jjuk',
    chars: [
      createWalker('jjuk', { x: 120, y: 236 }),
      createWalker('mukjik', { x: 200, y: 244 }),
      createWalker('ppik', { x: 270, y: 230 }),
    ],
  };
}

export function activeChar(state: GameState): Walker {
  const w = state.chars.find((c) => c.id === state.active);
  if (!w) throw new Error(`조작 캐릭터가 화면에 없습니다: ${state.active}`);
  return w;
}

export function step(state: GameState): void {
  state.tick += 1;
  // 전환해도 다른 캐릭터는 하던 걷기를 끝낸다.
  for (const c of state.chars) stepWalker(c, WALK_SPEED);
}

/** 판정 대상. 지금은 캐릭터뿐이다. 핫스팟은 퍼즐 데이터 모델에서 같은 목록에 들어온다(ADR-0007 결정 6-3). */
export function hitTargets(state: GameState): HitTarget[] {
  return state.chars.map((c) => ({ id: c.id, box: walkerHitBox(c), z: Math.round(c.y) }));
}

/**
 * 내부 좌표 클릭. slop은 여유 폭(마우스 0, 터치 8, ADR-0007 결정 6).
 * - 다른 캐릭터를 누르면 그 캐릭터로 바꾼다(걷지 않는다).
 * - 지금 캐릭터를 누르면 아무 일도 없다(능력·메뉴는 퍼즐 데이터 모델 뒤에).
 * - 그 밖에는 지금 캐릭터가 그곳(바닥 보정)으로 걷는다.
 */
export function click(state: GameState, at: Point, slop = 0): ClickResult {
  const hit = hitTest(hitTargets(state), at, slop);
  if (hit) {
    if (hit.id === state.active) return { kind: 'none' };
    state.active = hit.id as CharacterId;
    return { kind: 'select', id: state.active };
  }
  walkTo(activeChar(state), at, WALK_AREA);
  return { kind: 'walk' };
}
