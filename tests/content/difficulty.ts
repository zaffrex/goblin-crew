// Exploration difficulty report (#67 retro action, Ben). Numbers only: warns about nothing except dead ends,
// which screens-check.test.ts already fails on. Branching is a proxy for "how many things could I try", not for
// "is the clue visible" (that is a visual question, see the retro thread).
// Counting rules (Luna review on #470): a choice is an action that changes flags/items (a position-only change
// like release/approach is not progress). Moves to a non-floor spot are counted separately because they can be
// the "aha" (seesaw). Invalid actions (not offerable with the picked character's own ability) are not counted.

import { screenHost } from '../../src/core/puzzle/check';
import { foldedKey } from '../../src/core/puzzle/bfs';
import type { Action, CharactersData, PuzzleState, ScreenData } from '../../src/core/puzzle/types';

const FLOOR = 'floor';

/** Key without position: progress means flags/items changed. */
function progressKey(s: PuzzleState): string {
  return JSON.stringify([s.flags, [...s.items].sort()]);
}

export interface DifficultyReport {
  screen: string;
  /** Puzzle states (gauge folded) reached, up to `limit`. */
  states: number;
  /** Cells on the found path (walking included; not a guaranteed minimum of decisions). Null when no clear. */
  pathCells: number | null;
  /** Per path cell: non-move actions that change flags/items. */
  choicesPerCell: number[];
  /** Per path cell: moves to a non-floor spot (can be the aha, e.g. standing on a seesaw). */
  spotMovesPerCell: number[];
  meanChoices: number;
  /** Over all reached states, non-move, non-invalid actions that leave flags/items unchanged, split by source. */
  noChange: { designedRule: number; fallback: number; blocked: number; positionOnly: number; total: number };
}

export function difficultyReport(screen: ScreenData, characters?: CharactersData, limit = 5000): DifficultyReport {
  const host = screenHost(screen, characters);
  const initKey = foldedKey(host.initial);
  const seen = new Set<string>([initKey]);
  const queue: PuzzleState[] = [host.initial];
  const parent = new Map<string, string>();
  let clearKey: string | null = null;
  const noChange = { designedRule: 0, fallback: 0, blocked: 0, positionOnly: 0, total: 0 };
  const choices = new Map<string, number>();
  const spots = new Map<string, number>();
  for (let i = 0; i < queue.length && queue.length < limit; i++) {
    const s = queue[i]!;
    const sk = foldedKey(s);
    let c = 0;
    let m = 0;
    for (const a of host.actions(s) as Action[]) {
      const r = host.step(s, a);
      const nk = foldedKey(r.state);
      if (a.verb === 'move') {
        if (nk !== sk && r.state.at[a.char] !== FLOOR) m++;
      } else if (r.source !== 'invalid') {
        if (progressKey(r.state) !== progressKey(s)) c++;
        else {
          noChange.total++;
          if (r.source === 'rule') noChange.designedRule++;
          else if (r.source === 'blocked') noChange.blocked++;
          else if (r.source === 'release') noChange.positionOnly++;
          else noChange.fallback++;
        }
      }
      if (host.isClear(r.state) && clearKey === null) { clearKey = nk; parent.set(nk, sk); }
      if (!seen.has(nk)) {
        seen.add(nk);
        parent.set(nk, sk);
        queue.push(r.state);
      }
    }
    choices.set(sk, c);
    spots.set(sk, m);
  }
  const path: string[] = [];
  for (let k = clearKey; k !== null; k = parent.get(k) ?? null) {
    path.unshift(k);
    if (k === initKey) break;
  }
  const cells = clearKey === null ? [] : path.slice(0, -1);
  const choicesPerCell = cells.map((k) => choices.get(k) ?? 0);
  return {
    screen: screen.id,
    states: queue.length,
    pathCells: clearKey === null ? null : cells.length,
    choicesPerCell,
    spotMovesPerCell: cells.map((k) => spots.get(k) ?? 0),
    meanChoices: choicesPerCell.length ? choicesPerCell.reduce((a, b) => a + b, 0) / choicesPerCell.length : 0,
    noChange,
  };
}

export function formatDifficulty(d: DifficultyReport): string {
  const n = d.noChange;
  return `[${d.screen}] 탐색 리포트: 퍼즐 상태 ${d.states}, 경로 ${d.pathCells ?? '없음'}칸(걷기 포함), 칸마다 상태가 바뀌는 행동 ${d.choicesPerCell.join('/')} (평균 ${d.meanChoices.toFixed(1)}), 칸마다 특기 자리 이동 ${d.spotMovesPerCell.join('/')}, 상태 안 바뀜 ${n.total}개 = 설계된 반응 ${n.designedRule} / 폴백 ${n.fallback} / 막힘 ${n.blocked} / 자리만 바뀜 ${n.positionOnly}`;
}
