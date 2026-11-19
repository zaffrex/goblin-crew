import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkScreen } from '../../src/core/puzzle/check';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67 on screen 2 (#380): the BFS checker runs clean on the real data, so regressions in
// park_fountain.json (dead ends, exceptions, a damage-only shortcut) fail CI.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/park_fountain.json') as ScreenData;
const characters = load('../../content/characters.json') as CharactersData;

describe('park_fountain BFS check', () => {
  const r = checkScreen(screen, characters);
  it('has no step exceptions, dead ends, or truncation', () => {
    expect(r.explore.failures).toEqual([]);
    expect(r.explore.truncated).toBe(false);
    expect(r.explore.deadEndsKnown).toBe(true);
    expect(r.explore.deadEnds).toEqual([]);
  });
  it('matches the expected size and shortest path', () => {
    expect(r.explore.stateCount).toBe(25);
    expect(r.explore.shortestLength).toBe(3);
  });
  it('requires all three abilities', () => {
    expect(r.requiredAbilities).toEqual({ stretch: true, stomp: true, squeak: true });
  });
  it('has no damage dependence or shortcut', () => {
    expect(r.damageWarnings).toEqual([]);
  });
  it('replays the solution', () => {
    expect(r.solutionProblems).toEqual([]);
  });
});
