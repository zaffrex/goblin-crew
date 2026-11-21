// 화면의 도달 가능한 클리어 전 상태 × 모든 행동을 진짜 `step`으로 한 번씩 돌린다(#67 BFS와 같은 호스트).
// 자세 장부·반응 검사(screen-poses.test.ts)와 R1 칸 예산(r1-cells.test.ts, ADR-0422)이 같이 쓴다.

import { stateKey } from '../../src/core/puzzle/bfs';
import { screenHost } from '../../src/core/puzzle/check';
import { step } from '../../src/core/puzzle/step';
import type { Action, CharactersData, PuzzleState, ScreenData, StepResult } from '../../src/core/puzzle/types';

/** `invalid`(엔진이 거르는 행동)는 넘긴다. 돌려주는 값은 방문한 상태 전부(클리어 상태 포함). */
export function eachStep(
  screen: ScreenData,
  chars: CharactersData,
  visit: (s: PuzzleState, a: Action, r: StepResult) => void,
): PuzzleState[] {
  const host = screenHost(screen, chars);
  const seen = new Set<string>([stateKey(host.initial)]);
  const states: PuzzleState[] = [];
  const queue: PuzzleState[] = [host.initial];
  while (queue.length) {
    const s = queue.shift()!;
    states.push(s);
    if (host.isClear(s)) continue;
    for (const a of host.actions(s)) {
      const r = step(screen, s, a, chars);
      if (r.source === 'invalid') continue;
      visit(s, a, r);
      const k = stateKey(r.state);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(r.state);
      }
    }
  }
  return states;
}
