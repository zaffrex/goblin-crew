import { describe, expect, it } from 'vitest';
import { explore, requiredAbilities, type ActionLike, type BfsHost, type PuzzleStateLike } from './bfs';

// Toy screen: squeak sets flag `a`; stretch with `a` set clears; poke is a trap
// that sets `trap` (dead end: nothing can ever clear afterwards); hurt costs gauge.
const start = { c: 'floor' };
const init: PuzzleStateLike = { at: start, flags: { a: false, trap: false, done: false }, items: [], gauge: 5 };

function host(extra: Partial<BfsHost<PuzzleStateLike, ActionLike>> = {}): BfsHost<PuzzleStateLike, ActionLike> {
  return {
    initial: init,
    startAt: start,
    fullGauge: 5,
    isClear: (s) => s.flags.done === true,
    actions: () =>
      ['squeak', 'stretch', 'poke', 'hurt'].map((verb) => ({ char: 'c', verb, target: 't' })),
    step: (s, a) => {
      const flags = { ...s.flags };
      let gauge = s.gauge;
      if (a.verb === 'squeak') flags.a = true;
      else if (a.verb === 'stretch' && flags.a && !flags.trap) flags.done = true;
      else if (a.verb === 'poke') flags.trap = true;
      else if (a.verb === 'hurt') gauge -= 1;
      else return { state: s, events: [], source: 'invalid' };
      return { state: { ...s, flags, gauge }, events: [], source: 'rule' };
    },
    ...extra,
  };
}

describe('explore', () => {
  it('finds the shortest clear path and counts states', () => {
    const r = explore(host());
    expect(r.clearReachable).toBe(true);
    expect(r.shortestLength).toBe(2);
    expect(r.stateCount).toBeGreaterThan(3);
  });

  it('reports states that can never clear (S3), reset edge included', () => {
    const r = explore(host());
    expect(r.deadEnds.length).toBeGreaterThan(0);
    expect(r.deadEnds.every((d) => d.state.flags.trap)).toBe(true);
  });

  it('collects step exceptions with the path to them', () => {
    const r = explore(
      host({
        step: (s, a) => {
          if (a.verb === 'stretch' && s.flags.a) throw new Error('capacity');
          return host().step(s, a);
        },
      }),
    );
    expect(r.failures[0]?.path.map((p) => (p === 'reset' ? p : p.verb))).toEqual(['squeak', 'stretch']);
  });

  it('stops at maxStates and flags truncation', () => {
    const r = explore(host(), { maxStates: 2 });
    expect(r.truncated).toBe(true);
    expect(r.stateCount).toBe(2);
  });

  it('adds a faint edge for damage actions', () => {
    const faintHost = host({
      step: (s, a) => {
        const base = host().step(s, a);
        if (a.verb === 'hurt' && s.gauge === 1)
          return { state: { ...s, flags: { ...s.flags, a: true }, gauge: 5 }, events: [{ type: 'faint' }], source: 'rule' };
        return base;
      },
    });
    const r = explore(faintHost, { excludeVerb: 'squeak' });
    expect(r.clearReachable).toBe(true);
    expect(r.shortestPath?.some((p) => p !== 'reset' && p.verb === 'hurt')).toBe(true);
  });
});

describe('requiredAbilities', () => {
  it('marks abilities whose removal makes the screen unsolvable', () => {
    expect(requiredAbilities(host(), ['squeak', 'stretch', 'poke'])).toEqual({
      squeak: true,
      stretch: true,
      poke: false,
    });
  });
});
