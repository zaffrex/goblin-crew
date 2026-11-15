// 게임 상태의 최소 골격. 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다
// (Map/Set/클래스/함수/undefined 금지, ADR-0004 결정 2, ADR-0006 세이브).

import { WALK_AREA, WALK_SPEED } from './config';
import type { Point } from './viewport';
import { createWalker, stepWalker, walkTo, type Walker } from './walk';

export interface GameState {
  tick: number;
  /** 지금 조작하는 캐릭터. M0는 1명(쭉이)뿐이다. 캐릭터 전환은 M1에서. */
  actor: Walker;
}

export function createGame(): GameState {
  return { tick: 0, actor: createWalker('jjuk', { x: 120, y: 236 }) };
}

export function step(state: GameState): void {
  state.tick += 1;
  stepWalker(state.actor, WALK_SPEED);
}

/** 내부 좌표 클릭. 지금은 모든 클릭이 "그곳으로 걸어가기"다. 히트 영역은 M1에서. */
export function click(state: GameState, at: Point): void {
  walkTo(state.actor, at, WALK_AREA);
}
