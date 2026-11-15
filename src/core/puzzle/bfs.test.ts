import { describe, expect, it } from 'vitest';
import { explore, requiredAbilities, type ActionLike, type BfsHost, type PuzzleStateLike } from './bfs';

// Toy screen: squeak sets flag `a`; stretch with `a` set clears; poke is a trap
// that sets `trap` (dead end: nothing can ever clear afterwards); hurt costs gauge
// and faints (back to gauge 5) from gauge 1.
const init: PuzzleStateLike = { at: { c: 'floor' }, flags: { a: false, trap: false, done: false }, items: [], gauge: 5 };

function host(extra: Partial<BfsHost<PuzzleStateLike, ActionLike>> = {}): BfsHost<PuzzleStateLike, ActionLike> {
  return {
    initial: init,
    isClear: (s) => s.flags.done === true,
    actions: () => ['squeak', 'stretch', 'poke', 'hurt'].map((verb) => ({ char: 'c', verb, target: 't' })),
    step: (s, a) => {
      const flags = { ...s.flags };
      let gauge = s.gauge;
      const events: { type: string }[] = [];
      if (a.verb === 'squeak') flags.a = true;
      else if (a.verb === 'stretch' && flags.a && !flags.trap) flags.done = true;
      else if (a.verb === 'poke') flags.trap = true;
      else if (a.verb === 'hurt') {
        gauge -= 1;
        if (gauge <= 0) {
          gauge = 5;
          events.push({ type: 'faint' });
        }
      } else return { state: s, events: [], source: 'invalid' };
      return { state: { ...s, flags, gauge }, events, source: 'rule' };
    },
    ...extra,
  };
}

describe('explore', () => {
  it('keys nodes by gauge and finds the shortest clear path', () => {
    const r = explore(host());
    expect(r.clearReachable).toBe(true);
    expect(r.shortestLength).toBe(2);
    expect(r.stateCount).toBeGreaterThan(r.foldedCount);
    expect(r.foldedCount).toBe(5);
  });

  it('does not expand clear states (S4)', () => {
    let calledOnClear = false;
    const base = host();
    explore(
      host({
        step: (s, a) => {
          if (s.flags.done) calledOnClear = true;
          return base.step(s, a);
        },
      }),
    );
    expect(calledOnClear).toBe(false);
  });

  it('reports dead ends folded by puzzle state, with stuck gauges and one path', () => {
    const r = explore(host());
    expect(r.deadEndsKnown).toBe(true);
    // trap=true states: (a false/true) x gauges 5..1 -> 2 puzzle states, each stuck at all 5 gauges.
    expect(r.deadEnds).toHaveLength(2);
    for (const d of r.deadEnds) {
      expect(d.state.flags.trap).toBe(true);
      expect(d.gauges).toEqual([1, 2, 3, 4, 5]);
      expect(d.path.length).toBeGreaterThan(0);
    }
  });

  it('has no reset edge: a real dead end stays dead', () => {
    const r = explore(host());
    // Trap states stay dead even though everyone could "start over": no reset edge exists.
    expect(r.deadEnds.length).toBeGreaterThan(0);
    // A faint edge is flagged on its step.
    const faintHost = explore(host(), { excludeVerb: 'squeak' });
    expect(faintHost.clearReachable).toBe(false);
  });

  it('flags the faint step in a path', () => {
    // Clear only after fainting once: stretch needs gauge 5 and a, but `a` is set only by the faint.
    const h = host({
      step: (s, a) => {
        const base = host().step(s, a);
        if (a.verb === 'hurt' && s.gauge === 1)
          return { state: { ...s, flags: { ...s.flags, a: true }, gauge: 5 }, events: [{ type: 'faint' }], source: 'rule' };
        if (a.verb === 'squeak') return { state: s, events: [], source: 'invalid' };
        return base;
      },
    });
    const r = explore(h);
    expect(r.clearReachable).toBe(true);
    expect(r.shortestPath?.map((p) => p.action.verb)).toEqual(['hurt', 'hurt', 'hurt', 'hurt', 'hurt', 'stretch']);
    expect(r.shortestPath?.filter((p) => p.faint)).toHaveLength(1);
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
    expect(r.failures[0]?.path.map((p) => p.action.verb)).toEqual(['squeak', 'stretch']);
  });

  it('on truncation, S3 is unknown: deadEnds empty and deadEndsKnown false', () => {
    const r = explore(host(), { maxStates: 2 });
    expect(r.truncated).toBe(true);
    expect(r.stateCount).toBe(2);
    expect(r.deadEnds).toEqual([]);
    expect(r.deadEndsKnown).toBe(false);
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
