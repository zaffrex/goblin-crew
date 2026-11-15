import { describe, expect, it } from 'vitest';
import { explore, requiredAbilities, requiredAbilitiesBoth, type ActionLike, type BfsHost, type PuzzleStateLike } from './bfs';

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

  it('trap dead end survives faint (stuck at every gauge)', () => {
    const r = explore(host());
    expect(r.deadEnds.length).toBeGreaterThan(0);
    expect(r.deadEnds.every((d) => d.gauges.length === 5)).toBe(true);
    expect(explore(host(), { excludeVerb: 'squeak' }).clearReachable).toBe(false);
  });

  it('toy B: a position-only dead end stays dead (no reset edge)', () => {
    const r = explore<PuzzleStateLike, ActionLike>({
      initial: { at: { c: 'floor' }, flags: { done: false }, items: [], gauge: 5 },
      isClear: (s) => s.flags.done === true,
      actions: () => ['climb', 'open'].map((verb) => ({ char: 'c', verb, target: 't' })),
      step: (s, a) => {
        if (s.at.c === 'floor' && a.verb === 'climb') return { state: { ...s, at: { c: 'roof' } }, events: [], source: 'rule' };
        if (s.at.c === 'floor' && a.verb === 'open') return { state: { ...s, flags: { done: true } }, events: [], source: 'rule' };
        return { state: s, events: [], source: 'invalid' };
      },
    });
    expect(r.clearReachable).toBe(true);
    expect(r.deadEnds.map((d) => d.state.at.c)).toEqual(['roof']);
    expect(r.deadEnds[0]?.gauges).toEqual([5]);
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

  it('returns null when a truncated search found no clear', () => {
    expect(requiredAbilities(host(), ['squeak'], 1)).toEqual({ squeak: null });
  });
});

describe('damage-free graph (ADR-0096 decision 5/6)', () => {
  type S = PuzzleStateLike;
  // Tiny graph host: states are `at.c` names; edges carry explicit events.
  function graph(edges: Record<string, Record<string, { to: string; events?: { type: string; delta?: number }[] }>>, clear = 'win'): BfsHost<S, ActionLike> {
    return {
      initial: { at: { c: 'start' }, flags: {}, items: [], gauge: 5 },
      isClear: (s) => s.at.c === clear,
      actions: (s) => Object.keys(edges[s.at.c!] ?? {}).map((verb) => ({ char: 'c', verb, target: 't' })),
      step: (s, a) => {
        const e = edges[s.at.c!]?.[a.verb];
        if (!e) return { state: s, events: [], source: 'invalid' };
        const events = e.events ?? [];
        const delta = events.find((x) => x.type === 'gauge')?.delta ?? 0;
        return { state: { ...s, at: { c: e.to }, gauge: s.gauge + delta }, events, source: 'rule' };
      },
    };
  }
  const hurt = { type: 'gauge', delta: -1 };

  it('escape only by non-faint damage warns at every gauge, not just gauge 1', () => {
    const r = explore(graph({ start: { go: { to: 'roof' } }, roof: { jump: { to: 'ground', events: [hurt] } }, ground: { go: { to: 'win' } } }));
    expect(r.safeClearReachable).toBe(false);
    expect(r.damageWarnings.map((w) => foldedKeyOf(w.state))).toContain('roof');
    expect(r.damageWarnings.find((w) => w.state.at.c === 'roof')?.path.length).toBe(1);
  });

  it('a state only reachable through damage is still checked', () => {
    // pushed (via damage) -> stuck unless damage again
    const r = explore(
      graph({
        start: { go: { to: 'win' }, push: { to: 'outside', events: [hurt] } },
        outside: { back: { to: 'inside', events: [hurt] } },
        inside: { go: { to: 'win' } },
      }),
    );
    expect(r.safeClearReachable).toBe(true);
    expect(r.damageWarnings.some((w) => w.state.at.c === 'outside')).toBe(true);
    expect(r.damageWarnings.find((w) => w.state.at.c === 'outside')?.path[0]?.damage).toBe(true);
  });

  it('a final move that hurts while clearing is not a warning', () => {
    const r = explore(graph({ start: { go: { to: 'win', events: [hurt, { type: 'clear' }] } } }));
    expect(r.safeClearReachable).toBe(true);
    expect(r.damageWarnings).toEqual([]);
  });

  it('safe shortest path ignores a shorter damage shortcut', () => {
    const r = explore(
      graph({
        start: { shortcut: { to: 'x', events: [hurt] }, a: { to: 'b' } },
        x: { fin: { to: 'win' } },
        b: { c: { to: 'd' } },
        d: { fin: { to: 'win' } },
      }),
    );
    expect(r.shortestLength).toBe(2);
    expect(r.safeShortestLength).toBe(3);
    expect(r.safeShortestPath?.map((p) => p.action.verb)).toEqual(['a', 'c', 'fin']);
  });

  it('requiredAbilities falls back to the full graph on a damage-required screen', () => {
    const h = graph({ start: { hurt: { to: 'x', events: [hurt] }, squeak: { to: 'start' } }, x: { fin: { to: 'win' } } });
    expect(requiredAbilities(h, ['squeak'])).toEqual({ squeak: false });
    expect(requiredAbilitiesBoth(h, ['hurt'])).toEqual({ primary: { hurt: true }, full: { hurt: true } });
  });

  it('requiredAbilities uses the damage-free graph when it can clear', () => {
    const h = graph({ start: { cheat: { to: 'x', events: [hurt] }, real: { to: 'r' } }, x: { go: { to: 'win' } }, r: { go: { to: 'win' } } });
    expect(requiredAbilitiesBoth(h, ['real'])).toEqual({ primary: { real: true }, full: { real: false } });
  });
});

function foldedKeyOf(s: PuzzleStateLike): string {
  return s.at.c ?? '';
}
