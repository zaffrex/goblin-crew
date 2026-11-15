import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkScreen } from '../../src/core/puzzle/check';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67 part 1 on the real screen 1 (ADR-0096): 305 nodes / 108 folded, shortest 4, no dead ends,
// all three abilities required, no step exceptions (capacity overflow etc.), solution replays.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const characters = load('../../content/characters.json') as CharactersData;

describe('magpie_nest BFS check', () => {
  const r = checkScreen(screen, characters);
  it('has no step exceptions, dead ends, or truncation', () => {
    expect(r.explore.failures).toEqual([]);
    expect(r.explore.truncated).toBe(false);
    expect(r.explore.deadEndsKnown).toBe(true);
    expect(r.explore.deadEnds).toEqual([]);
  });
  it('matches the expected size and shortest path', () => {
    expect(r.explore.stateCount).toBe(305);
    expect(r.explore.foldedCount).toBe(61);
    expect(r.explore.shortestLength).toBe(4);
  });
  it('requires all three abilities', () => {
    expect(r.requiredAbilities).toEqual({ stretch: true, stomp: true, squeak: true });
  });
  it('replays the solution', () => {
    expect(r.solutionProblems).toEqual([]);
  });
});
