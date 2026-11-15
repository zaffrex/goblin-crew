// Screen checker (#67): wires the real `step` into the generic BFS explorer (ADR-0096) and
// replays the screen's `solution`. Part 1 = M1 required items; damage-dependence warnings come in part 2.

import { explore, requiredAbilitiesBoth, type BfsHost, type ExploreResult, type PathStep } from './bfs';
import { initialState, step } from './step';
import type { Action, CharactersData, PuzzleState, ScreenData, Verb } from './types';
import { VERBS } from './types';

export function screenHost(screen: ScreenData, characters?: CharactersData): BfsHost<PuzzleState, Action> {
  const targets = [...new Set([...Object.keys(screen.spots), ...Object.keys(screen.hotspots)])];
  // Characters of this screen come from `start.at`, not the global roster.
  const chars = Object.keys(screen.start.at) as Action['char'][];
  return {
    initial: initialState(screen),
    step: (s, a) => step(screen, s, a, characters),
    isClear: (s) => s.flags[screen.exitFlag] === true,
    actions: (s) => {
      const out: Action[] = [];
      for (const char of chars) {
        for (const target of targets) {
          for (const verb of VERBS as readonly Verb[]) {
            if (verb === 'item') for (const item of s.items) out.push({ char, verb, target, item });
            else out.push({ char, verb, target });
          }
        }
      }
      return out;
    },
  };
}

export interface ScreenReport {
  explore: ExploreResult<PuzzleState, Action>;
  /** Warnings (not CI failures): damage-dependent clear, damage shortcut, states that clear only by damage. */
  damageWarnings: string[];
  /** true = removing the ability makes clear unreachable. `null` = could not be judged (the search was truncated). */
  requiredAbilities: Record<string, boolean | null>;
  /** Same over the full graph; shown in the report only when it differs from `requiredAbilities`. */
  requiredAbilitiesFull: Record<string, boolean | null>;
  /** Empty when `solution` replays cleanly to a clear without fainting. */
  solutionProblems: string[];
}

export function replaySolution(screen: ScreenData, characters?: CharactersData): string[] {
  const problems: string[] = [];
  const solution = screen.solution;
  if (!solution || solution.length === 0) return ['solution 없음'];
  let s = initialState(screen);
  solution.forEach((a, i) => {
    try {
      const r = step(screen, s, a, characters);
      if (r.source === 'invalid' || r.source === 'blocked') problems.push(`step ${i}: ${r.source}`);
      if (r.events.some((e) => e.type === 'faint')) problems.push(`step ${i}: faint`);
      const clear = r.events.some((e) => e.type === 'clear');
      if (clear !== (i === solution.length - 1)) problems.push(`step ${i}: clear ${clear ? '너무 일찍' : '없음'}`);
      s = r.state;
    } catch (e) {
      problems.push(`step ${i}: ${String(e)}`);
    }
  });
  return problems;
}

/** ADR-0018 R1: distinct `anim` names the screen uses, not counting shared `common.*` ones. */
export function uniqueReactions(screen: ScreenData): number {
  const names = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const a = o.anim;
      if (Array.isArray(a) && typeof a[1] === 'string' && !a[1].startsWith('common.')) names.add(a[1]);
      Object.values(o).forEach(walk);
    }
  };
  walk([screen.rules, screen.fallbacks, screen.onEnter, screen.spots]);
  return names.size;
}

const fmtPath = (path: PathStep<Action>[]): string =>
  path.map((p) => `${p.action.char}.${p.action.verb}@${p.action.target}${p.faint ? '(기절)' : p.damage ? '(피해)' : ''}`).join(' > ');

export function damageWarnings(e: ExploreResult<PuzzleState, Action>): string[] {
  const w: string[] = [];
  if (e.truncated) return w;
  if (e.clearReachable && !e.safeClearReachable) w.push('피해 없이는 클리어에 닿지 않음');
  else if (e.shortestLength !== null && e.safeShortestLength !== null && e.shortestLength < e.safeShortestLength)
    w.push(`피해 지름길: 피해 포함 ${e.shortestLength}수 < 피해 없이 ${e.safeShortestLength}수 경로 ${fmtPath(e.shortestPath ?? [])}`);
  for (const d of e.damageWarnings)
    w.push(`피해로만 탈출하는 상태 ${JSON.stringify({ at: d.state.at, flags: d.state.flags, items: d.state.items })} 게이지 ${d.gauges.join(',')} 경로 ${fmtPath(d.path)}`);
  return w;
}

export function checkScreen(screen: ScreenData, characters?: CharactersData, maxStates?: number): ScreenReport {
  const host = screenHost(screen, characters);
  const full = explore(host, maxStates === undefined ? {} : { maxStates });
  const req = requiredAbilitiesBoth(host, ['stretch', 'stomp', 'squeak'], maxStates);
  return {
    explore: full,
    damageWarnings: damageWarnings(full),
    requiredAbilities: req.primary,
    requiredAbilitiesFull: req.full,
    solutionProblems: replaySolution(screen, characters),
  };
}

/** One-screen human report for CI logs. Shortest is over the damage-free graph, or the full graph when it cannot clear damage-free. */
export function formatReport(screen: ScreenData, r: ScreenReport): string {
  const e = r.explore;
  const lines = [
    `[${screen.id}] 노드 ${e.stateCount}(게이지 제외 ${e.foldedCount})${e.truncated ? ' 잘림' : ''}, 최단(${e.safeClearReachable ? '피해 없는 그래프' : '전체 그래프'}) ${(e.safeClearReachable ? e.safeShortestLength : e.shortestLength) ?? '없음'}`,
    `  막다른 상태 ${e.deadEndsKnown ? e.deadEnds.length : '판정 불가'}, 예외 ${e.failures.length}, R1 고유 반응 ${uniqueReactions(screen)}`,
    `  필수 능력 ${Object.entries(r.requiredAbilities).map(([k, v]) => `${k}=${v === null ? '?' : v ? 'Y' : 'N'}`).join(' ')}`,
  ];
  if (JSON.stringify(r.requiredAbilities) !== JSON.stringify(r.requiredAbilitiesFull))
    lines.push(`  필수 능력(전체 그래프) ${Object.entries(r.requiredAbilitiesFull).map(([k, v]) => `${k}=${v === null ? '?' : v ? 'Y' : 'N'}`).join(' ')}`);
  for (const d of e.deadEnds) lines.push(`  막다른: 게이지 ${d.gauges.join(',')} 경로 ${fmtPath(d.path)}`);
  for (const f of e.failures.slice(0, 3)) lines.push(`  예외: ${f.message}`);
  for (const w of r.damageWarnings) lines.push(`  경고: ${w}`);
  for (const p of r.solutionProblems) lines.push(`  solution: ${p}`);
  return lines.join('\n');
}

/** Failures (CI-breaking) for a screen report. Empty = pass. Warnings are the report text only. */
export function reportErrors(r: ScreenReport): string[] {
  const e = r.explore;
  const out: string[] = [];
  if (e.failures.length) out.push(`step 예외 ${e.failures.length}건`);
  if (e.truncated) out.push('상태 수 한도 초과(S3 판정 불가)');
  if (!e.clearReachable) out.push('클리어에 닿지 않음');
  if (e.deadEndsKnown && e.deadEnds.length) out.push(`막다른 상태 ${e.deadEnds.length}개`);
  out.push(...r.solutionProblems);
  return out;
}
