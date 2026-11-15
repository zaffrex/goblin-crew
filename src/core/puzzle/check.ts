// Screen checker (#67): wires the real `step` into the generic BFS explorer (ADR-0096) and
// replays the screen's `solution`. Part 1 = M1 required items; damage-dependence warnings come in part 2.

import { CHARACTERS } from '../characters';
import { explore, requiredAbilities, type BfsHost, type ExploreResult } from './bfs';
import { initialState, step } from './step';
import type { Action, CharactersData, PuzzleState, ScreenData, Verb } from './types';
import { VERBS } from './types';

export function screenHost(screen: ScreenData, characters?: CharactersData): BfsHost<PuzzleState, Action> {
  const targets = [...new Set([...Object.keys(screen.spots), ...Object.keys(screen.hotspots)])];
  const chars = CHARACTERS.map((c) => c.id);
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
  requiredAbilities: Record<string, boolean>;
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

export function checkScreen(screen: ScreenData, characters?: CharactersData, maxStates?: number): ScreenReport {
  const host = screenHost(screen, characters);
  return {
    explore: explore(host, maxStates === undefined ? {} : { maxStates }),
    requiredAbilities: requiredAbilities(host, ['stretch', 'stomp', 'squeak']),
    solutionProblems: replaySolution(screen, characters),
  };
}
