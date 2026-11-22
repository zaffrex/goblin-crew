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

// ADR-0761 section 5 (#67): `정답 길 반응` / `오답 반응` report lines. Numbers + decoy warnings only; humans judge funny (H3).
// Counted with the real `step` over `solution` and over the BFS-reachable states, so `StepResult` stays unchanged.
// `common.*` anims are counted apart. Separate from R1 `uniqueReactions` (static) on purpose, do not merge names.

export interface ReactionReport {
  screen: string;
  /** Unique anim/say on the `solution` replay. `outside` = every step before the last, `clearCut` = last step only (ADR-0761 H1). */
  solution: { outside: number; clearCut: number; common: number };
  /** Unique anim/say from actions (any reached state, not move/invalid) whose ruleId never fires on the `solution` replay; `states` = all reached folded states (gauge excluded). */
  wrong: { reactions: number; states: number; common: number };
  decoys: string[];
  warnings: string[];
}

type Reaction = { key: string; common: boolean };

function reactionsOf(events: { type: string }[]): Reaction[] {
  const out: Reaction[] = [];
  for (const e of events) {
    if (e.type === 'anim') {
      const a = e as { target: string; name: string };
      out.push({ key: `anim:${a.target}:${a.name}`, common: a.name.startsWith('common.') });
    } else if (e.type === 'say') {
      const s = e as { speaker: string; text: string | string[] };
      out.push({ key: `say:${s.speaker}:${JSON.stringify(s.text)}`, common: false });
    }
  }
  return out;
}

export function reactionReport(screen: ScreenData, characters?: CharactersData, limit = 5000): ReactionReport {
  const host = screenHost(screen, characters);
  const warnings: string[] = [];
  const ruledTargets = new Set(screen.rules.map((r) => r.target));
  const decoys = Object.keys(screen.hotspots).filter((id) => !ruledTargets.has(id) && screen.fallbacks?.[id]);
  for (const id of decoys) {
    for (const [verb, fb] of Object.entries(screen.fallbacks![id]!)) {
      if (fb?.do?.gauge) warnings.push(`미끼 폴백 ${id}.${verb}에 do.gauge(H4 ①)`);
    }
  }
  for (const h of Object.entries(screen.hotspots)) {
    if (/미끼/.test(h[1].note ?? '') && !decoys.includes(h[0]) && !screen.rules.some((r) => r.id?.startsWith(`decoy.${h[0]}`))) {
      warnings.push(`note에 미끼라고 적힌 ${h[0]}가 미끼로 안 잡힘(경고만)`);
    }
  }

  // solution replay
  const solRules = new Set<string>();
  const inside = new Set<string>();
  const outside = new Set<string>();
  const solCommon = new Set<string>();
  let s = host.initial;
  const sol = screen.solution ?? [];
  sol.forEach((a, i) => {
    const r = host.step(s, a);
    if (r.ruleId) solRules.add(r.ruleId);
    for (const x of reactionsOf(r.events)) {
      if (x.common) solCommon.add(x.key);
      else (i === sol.length - 1 ? inside : outside).add(x.key);
    }
    s = r.state;
  });

  // wrong-side reactions
  const seen = new Set<string>([foldedKey(host.initial)]);
  const queue: PuzzleState[] = [host.initial];
  const wrong = new Set<string>();
  const wrongCommon = new Set<string>();
  for (let i = 0; i < queue.length && queue.length < limit; i++) {
    const st = queue[i]!;
    for (const a of host.actions(st) as Action[]) {
      const r = host.step(st, a);
      if (r.source === 'invalid') continue;
      const nk = foldedKey(r.state);
      if (r.ruleId?.startsWith('decoy.') && (progressKey(r.state) !== progressKey(st) || r.state.gauge !== st.gauge)) {
        warnings.push(`${r.ruleId}가 퍼즐 상태/게이지를 바꿈(H4 ①)`);
      }
      if (a.verb !== 'move' && !(r.ruleId && solRules.has(r.ruleId))) {
        for (const x of reactionsOf(r.events)) (x.common ? wrongCommon : wrong).add(x.key);
      }
      if (!seen.has(nk)) {
        seen.add(nk);
        if (!host.isClear(r.state)) queue.push(r.state);
      }
    }
  }
  return {
    screen: screen.id,
    solution: { outside: outside.size, clearCut: inside.size, common: solCommon.size },
    wrong: { reactions: wrong.size, states: seen.size, common: wrongCommon.size },
    decoys,
    warnings: [...new Set(warnings)],
  };
}

export function formatReactions(d: ReactionReport): string {
  const w = d.wrong;
  const lines = [
    `[${d.screen}] 정답 길 반응: 클리어 연출 밖 ${d.solution.outside} / 클리어 연출 ${d.solution.clearCut} (common.* ${d.solution.common} 따로)`,
    `[${d.screen}] 오답 반응: 도달 상태 ${w.states}개의 정답 길 밖 행동에서 고유 반응 ${w.reactions} (common.* ${w.common} 따로), 미끼 ${d.decoys.length ? d.decoys.join(',') : '없음'}`,
  ];
  for (const x of d.warnings) lines.push(`[${d.screen}] 경고: ${x}`);
  return lines.join('\n');
}
