// 게임 상태의 최소 골격. 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다
// (Map/Set/클래스/함수/undefined 금지, ADR-0004 결정 2, ADR-0006 세이브).

import type { Point } from './viewport';

export interface GameState {
  tick: number;
  lastClick: Point | null;
}

export function createGame(): GameState {
  return { tick: 0, lastClick: null };
}

export function step(state: GameState): void {
  state.tick += 1;
}

export function click(state: GameState, at: Point): void {
  state.lastClick = { x: at.x, y: at.y };
}
