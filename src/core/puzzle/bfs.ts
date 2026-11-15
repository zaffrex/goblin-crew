// BFS state-graph explorer for puzzle screens (ADR-0065 section 8 as amended by ADR-0096, issue #67).
// It only calls the injected `step`, so it never re-interprets puzzle rules.
// Node key = the whole puzzle state including gauge; edges are exactly what `step` returns
// (no reset edge, no gauge=1 re-call). Clear states are not expanded (S4).
// Pure TypeScript, no DOM, no dependencies (ADR-0004).

export interface PuzzleStateLike {
  at: Record<string, string>;
  flags: Record<string, boolean>;
  items: string[];
  gauge: number;
}

export interface ActionLike {
  char: string;
  verb: string;
  target: string;
  item?: string;
}

export interface StepResultLike<S> {
  state: S;
  events: { type: string }[];
  source: string;
}

export interface BfsHost<S extends PuzzleStateLike, A extends ActionLike> {
  initial: S;
  step(state: S, action: A): StepResultLike<S>;
  /** Every action to try from `state` (3 chars x spots/targets/verbs/items). */
  actions(state: S): A[];
  isClear(state: S): boolean;
}

export interface ExploreOptions {
  /** Drop actions with this verb from the graph (M1/M2 required-ability check). */
  excludeVerb?: string;
  /** Stop exploring when this many nodes (gauge included) are reached (ADR-0096 decision 3 warning line). */
  maxStates?: number;
}

/** One action on a path; `faint` marks an edge where `step` emitted a faint event. */
export interface PathStep<A> {
  action: A;
  faint: boolean;
  /** Damage edge (ADR-0096 decision 5): gauge drops or faint, unless the same edge also clears. */
  damage: boolean;
}

/** A reached puzzle state that clears over the full graph but not over the damage-free graph (ADR-0096 decision 5). */
export interface DamageWarning<S, A> {
  state: S;
  /** Gauge values at which this puzzle state is reached, ascending. */
  gauges: number[];
  /** Start to this state, first found (BFS tree). */
  path: PathStep<A>[];
}

export interface StepFailure<A> {
  path: PathStep<A>[];
  action: A;
  message: string;
}

export interface DeadEnd<S, A> {
  /** One representative node (the first found), gauge shown as found. */
  state: S;
  /** Gauge values at which this puzzle state is stuck, ascending. */
  gauges: number[];
  /** Shortest path from start to the first stuck node of this puzzle state. */
  path: PathStep<A>[];
}

export interface ExploreResult<S extends PuzzleStateLike, A extends ActionLike> {
  /** Reached nodes, gauge included. */
  stateCount: number;
  /** Reached puzzle states, gauge folded away. */
  foldedCount: number;
  truncated: boolean;
  clearReachable: boolean;
  /** Shortest action count to clear over the full graph (faint edges included). */
  shortestLength: number | null;
  shortestPath: PathStep<A>[] | null;
  /**
   * Damage-free graph = full graph minus edges whose events lower the gauge or faint, keeping edges that also clear.
   * Assumes nothing raises the gauge (a `gauge: +1` effect would break this; recheck then).
   */
  safeClearReachable: boolean;
  safeShortestLength: number | null;
  safeShortestPath: PathStep<A>[] | null;
  /** States that clear only by taking damage. Empty when truncated. */
  damageWarnings: DamageWarning<S, A>[];
  /** S3: reached nodes that cannot reach a clear state, folded by puzzle state (ADR-0096 decision 4). Empty when truncated. */
  deadEnds: DeadEnd<S, A>[];
  /** False when truncated: S3 cannot be judged and must be reported as a failure (ADR-0096 decision 7). */
  deadEndsKnown: boolean;
  failures: StepFailure<A>[];
}

/** Full node key: the puzzle state including gauge. `screen` is constant per run, so it is ignored. */
export function stateKey(s: PuzzleStateLike): string {
  return JSON.stringify([s.at, s.flags, [...s.items].sort(), s.gauge]);
}

/** Folded key: same without gauge, for reports. */
export function foldedKey(s: PuzzleStateLike): string {
  return JSON.stringify([s.at, s.flags, [...s.items].sort()]);
}

interface Node<S, A> {
  state: S;
  parent: number;
  via: A | null;
  viaFaint: boolean;
  viaDamage: boolean;
  out: number[];
  /** Parallel to `out`: true when that edge is a damage edge. */
  outDamage: boolean[];
  outVia: A[];
  outFaint: boolean[];
}

export function explore<S extends PuzzleStateLike, A extends ActionLike>(
  host: BfsHost<S, A>,
  opts: ExploreOptions = {},
): ExploreResult<S, A> {
  const maxStates = opts.maxStates ?? 100_000;
  const nodes: Node<S, A>[] = [];
  const index = new Map<string, number>();
  const failures: StepFailure<A>[] = [];
  let truncated = false;

  const at = (i: number): Node<S, A> => nodes[i] as Node<S, A>;
  const pathTo = (i: number): PathStep<A>[] => {
    const p: PathStep<A>[] = [];
    for (let n = i; at(n).parent >= 0; n = at(n).parent) p.push({ action: at(n).via as A, faint: at(n).viaFaint, damage: at(n).viaDamage });
    return p.reverse();
  };

  const add = (s: S, parent: number, via: A | null, viaFaint: boolean, viaDamage: boolean): number => {
    const key = stateKey(s);
    const found = index.get(key);
    if (found !== undefined) return found;
    if (nodes.length >= maxStates) {
      truncated = true;
      return -1;
    }
    nodes.push({ state: s, parent, via, viaFaint, viaDamage, out: [], outDamage: [], outVia: [], outFaint: [] });
    index.set(key, nodes.length - 1);
    return nodes.length - 1;
  };

  add(host.initial, -1, null, false, false);
  for (let head = 0; head < nodes.length; head++) {
    const cur = at(head);
    // S4: a clear state is reached but never expanded.
    if (host.isClear(cur.state)) continue;
    for (const action of host.actions(cur.state)) {
      if (opts.excludeVerb && action.verb === opts.excludeVerb) continue;
      let res: StepResultLike<S>;
      try {
        res = host.step(cur.state, action);
      } catch (e) {
        failures.push({ path: [...pathTo(head), { action, faint: false, damage: false }], action, message: String(e) });
        continue;
      }
      if (res.source === 'invalid' || res.source === 'blocked') continue;
      const faint = res.events.some((ev) => ev.type === 'faint');
      const lowers = faint || res.events.some((ev) => ev.type === 'gauge' && (ev as { delta?: number }).delta! < 0);
      const clears = res.events.some((ev) => ev.type === 'clear') || host.isClear(res.state);
      const damage = lowers && !clears;
      const to = add(res.state, head, action, faint, damage);
      if (to >= 0 && to !== head) {
        cur.out.push(to);
        cur.outDamage.push(damage);
        cur.outVia.push(action);
        cur.outFaint.push(faint);
      }
    }
  }

  // Reverse reachability from clear states: full graph (S3) and damage-free graph (decision 5).
  const reach = (safeOnly: boolean): boolean[] => {
    const rev: number[][] = nodes.map(() => []);
    nodes.forEach((n, i) => n.out.forEach((o, k) => {
      if (!safeOnly || !n.outDamage[k]) (rev[o] as number[]).push(i);
    }));
    const can = new Array<boolean>(nodes.length).fill(false);
    const queue: number[] = [];
    nodes.forEach((n, i) => {
      if (host.isClear(n.state)) {
        can[i] = true;
        queue.push(i);
      }
    });
    for (let q = 0; q < queue.length; q++) {
      for (const p of rev[queue[q] as number] as number[]) {
        if (!can[p]) {
          can[p] = true;
          queue.push(p);
        }
      }
    }
    return can;
  };
  const canClear = reach(false);
  const canClearSafe = reach(true);

  // Shortest damage-free path from the start (plain BFS over the damage-free edges).
  const safeParent = new Array<number>(nodes.length).fill(-2);
  const safeVia = new Array<number>(nodes.length).fill(-1);
  safeParent[0] = -1;
  const sq: number[] = [0];
  let safeClear = -1;
  for (let q = 0; q < sq.length && safeClear < 0; q++) {
    const n = at(sq[q] as number);
    if (host.isClear(n.state)) {
      safeClear = sq[q] as number;
      break;
    }
    n.out.forEach((o, k) => {
      if (n.outDamage[k] || safeParent[o] !== -2) return;
      safeParent[o] = sq[q] as number;
      safeVia[o] = k;
      sq.push(o);
    });
  }
  const safePathTo = (i: number): PathStep<A>[] => {
    const p: PathStep<A>[] = [];
    for (let n = i; safeParent[n] !== -1; n = safeParent[n] as number) {
      const from = at(safeParent[n] as number);
      const k = safeVia[n] as number;
      p.push({ action: from.outVia[k] as A, faint: from.outFaint[k] as boolean, damage: false });
    }
    return p.reverse();
  };

  const firstClear = nodes.findIndex((n) => host.isClear(n.state));
  const shortestPath = firstClear >= 0 ? pathTo(firstClear) : null;
  const safePath = safeClear >= 0 ? safePathTo(safeClear) : null;

  // Decision 5: reached, clears over the full graph, but not over the damage-free graph. Folded by puzzle state.
  const warnFold = new Map<string, DamageWarning<S, A>>();
  if (!truncated) {
    nodes.forEach((n, i) => {
      if (!canClear[i] || canClearSafe[i]) return;
      const key = foldedKey(n.state);
      const found = warnFold.get(key);
      if (found) found.gauges.push(n.state.gauge);
      else warnFold.set(key, { state: n.state, gauges: [n.state.gauge], path: pathTo(i) });
    });
  }
  const damageWarnings = [...warnFold.values()].map((w) => ({ ...w, gauges: w.gauges.sort((x, y) => x - y) }));

  // Fold stuck nodes by puzzle state. Nodes are in BFS order, so the first one has the shortest path.
  const folded = new Map<string, DeadEnd<S, A> & { first: number }>();
  if (!truncated) {
    nodes.forEach((n, i) => {
      if (canClear[i]) return;
      const key = foldedKey(n.state);
      const found = folded.get(key);
      if (found) found.gauges.push(n.state.gauge);
      else folded.set(key, { state: n.state, gauges: [n.state.gauge], path: pathTo(i), first: i });
    });
  }
  const deadEnds: DeadEnd<S, A>[] = [...folded.values()].map((d) => ({
    state: d.state,
    gauges: d.gauges.sort((a, b) => a - b),
    path: d.path,
  }));

  return {
    stateCount: nodes.length,
    foldedCount: new Set(nodes.map((n) => foldedKey(n.state))).size,
    truncated,
    clearReachable: firstClear >= 0,
    shortestLength: shortestPath ? shortestPath.length : null,
    shortestPath,
    safeClearReachable: safeClear >= 0,
    safeShortestLength: safePath ? safePath.length : null,
    safeShortestPath: safePath,
    damageWarnings,
    deadEnds,
    deadEndsKnown: !truncated,
    failures,
  };
}

/**
 * For each ability verb, is the screen unsolvable without it?
 * `null` = the search was truncated before a clear was found, so necessity is unknown.
 * Judged over the damage-free graph (ADR-0096 decision 6); falls back to the full graph when the
 * screen cannot clear damage-free. `full` is always the full-graph answer.
 */
export function requiredAbilitiesBoth<S extends PuzzleStateLike, A extends ActionLike>(
  host: BfsHost<S, A>,
  abilities: string[],
  maxStates?: number,
): { primary: Record<string, boolean | null>; full: Record<string, boolean | null> } {
  const lim = maxStates === undefined ? {} : { maxStates };
  const safeBase = explore(host, lim).safeClearReachable;
  const primary: Record<string, boolean | null> = {};
  const full: Record<string, boolean | null> = {};
  for (const v of abilities) {
    const r = explore(host, { excludeVerb: v, ...lim });
    full[v] = r.clearReachable ? false : r.truncated ? null : true;
    primary[v] = !safeBase ? full[v]! : r.safeClearReachable ? false : r.truncated ? null : true;
  }
  return { primary, full };
}

export function requiredAbilities<S extends PuzzleStateLike, A extends ActionLike>(
  host: BfsHost<S, A>,
  abilities: string[],
  maxStates?: number,
): Record<string, boolean | null> {
  return requiredAbilitiesBoth(host, abilities, maxStates).primary;
}
