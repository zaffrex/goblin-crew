// Exploration difficulty report (#67 retro action, Ben). Numbers only: warns about nothing except dead ends,
// which screens-check.test.ts already fails on. Branching is a proxy for "how many things could I try", not for
// "is the clue visible" (that is a visual question, see the retro thread).

import { screenHost } from '../../src/core/puzzle/check';
import { foldedKey } from '../../src/core/puzzle/bfs';
import type { Action, CharactersData, PuzzleState, ScreenData } from '../../src/core/puzzle/types';

export interface DifficultyReport {
  screen: string;
  /** Puzzle states (gauge folded) reached, up to `limit`. */
  states: number;
  /** Shortest damage-agnostic solve length in puzzle actions (moves excluded: walking is not a decision). */
  decisionsOnPath: number | null;
  /** Along that path: how many non-move actions change the state at each step (the real choices). */
  choicesPerStep: number[];
  /** Mean of `choicesPerStep`; 0 when no path. */
  meanChoices: number;
  /** Over all reached states: share of non-move actions that do nothing (fallback/invalid/blocked, state unchanged). */
  wastedShare: number;
}

export function difficultyReport(screen: ScreenData, characters?: CharactersData, limit = 5000): DifficultyReport {
  const host = screenHost(screen, characters);
  const seen = new Map<string, number>(); // folded key -> distance in non-move actions
  const queue: PuzzleState[] = [host.initial];
  seen.set(foldedKey(host.initial), 0);
  const parent = new Map<string, string>();
  const states = new Map<string, PuzzleState>([[foldedKey(host.initial), host.initial]]);
  let clearKey: string | null = null;
  let useful = 0;
  let wasted = 0;
  const choices = new Map<string, number>();
  for (let i = 0; i < queue.length && queue.length < limit; i++) {
    const s = queue[i]!;
    const sk = foldedKey(s);
    let c = 0;
    for (const a of host.actions(s) as Action[]) {
      const r = host.step(s, a);
      const nk = foldedKey(r.state);
      const changed = nk !== sk;
      if (a.verb !== 'move') {
        if (changed) { useful++; c++; } else wasted++;
      }
      if (host.isClear(r.state) && clearKey === null) { clearKey = nk; parent.set(nk, sk); states.set(nk, r.state); }
      if (!seen.has(nk)) {
        seen.set(nk, (seen.get(sk) ?? 0) + (a.verb === 'move' ? 0 : 1));
        parent.set(nk, sk);
        states.set(nk, r.state);
        queue.push(r.state);
      }
    }
    choices.set(sk, c);
  }
  const path: string[] = [];
  for (let k = clearKey; k !== null; k = parent.get(k) ?? null) {
    path.unshift(k);
    if (k === foldedKey(host.initial)) break;
  }
  const onPath = clearKey === null ? [] : path.slice(0, -1).map((k) => choices.get(k) ?? 0);
  return {
    screen: screen.id,
    states: queue.length,
    decisionsOnPath: clearKey === null ? null : onPath.length,
    choicesPerStep: onPath,
    meanChoices: onPath.length ? onPath.reduce((a, b) => a + b, 0) / onPath.length : 0,
    wastedShare: useful + wasted ? wasted / (useful + wasted) : 0,
  };
}

export function formatDifficulty(d: DifficultyReport): string {
  return `[${d.screen}] 난이도 요약: 퍼즐 상태 ${d.states}, 정답 경로 상태 ${d.decisionsOnPath ?? '없음'}칸(걷기 포함), 칸마다 고를 수 있는 행동 ${d.choicesPerStep.join('/')} (평균 ${d.meanChoices.toFixed(1)}), 헛손질 비율 ${(d.wastedShare * 100).toFixed(0)}%`;
}
