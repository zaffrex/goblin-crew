import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkScreen } from '../../src/core/puzzle/check';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67 on stage 3 B (#897, #909): design laundromat.md 3절·6절 BFS expectations, so a data change that adds a
// dead end, a damage shortcut, or drops a required ability fails CI.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/laundromat.json') as ScreenData;
const characters = load('../../content/characters.json') as CharactersData;

describe('laundromat BFS check', () => {
  const r = checkScreen(screen, characters);
  it('has no step exceptions, dead ends, or truncation', () => {
    expect(r.explore.failures).toEqual([]);
    expect(r.explore.truncated).toBe(false);
    expect(r.explore.deadEndsKnown).toBe(true);
    expect(r.explore.deadEnds).toEqual([]);
  });
  it('matches the expected size and shortest path', () => {
    // 6-3: (forward, street) (reverse, street) (forward, nest) (reverse, duct) + clear = 5 puzzle states × gauge 5..1 = 25.
    // One free spot, no hold. Both orders (stomp → squeak → stretch, squeak → stomp → stretch) are 3.
    expect(r.explore.stateCount).toBe(25);
    expect(r.explore.shortestLength).toBe(3);
    expect(r.explore.safeShortestLength).toBe(3);
  });
  it('needs all three abilities (matrix ●●●, design 6-1 M1·M2)', () => {
    expect(r.requiredAbilities).toEqual({ stretch: true, stomp: true, squeak: true });
  });
  it('has no damage dependence or shortcut', () => {
    expect(r.damageWarnings).toEqual([]);
  });
  it('replays the solution', () => {
    expect(r.solutionProblems).toEqual([]);
  });
});
