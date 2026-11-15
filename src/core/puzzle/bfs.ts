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
  out: number[];
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
    for (let n = i; at(n).parent >= 0; n = at(n).parent) p.push({ action: at(n).via as A, faint: at(n).viaFaint });
    return p.reverse();
  };

  const add = (s: S, parent: number, via: A | null, viaFaint: boolean): number => {
    const key = stateKey(s);
    const found = index.get(key);
    if (found !== undefined) return found;
    if (nodes.length >= maxStates) {
      truncated = true;
      return -1;
    }
    nodes.push({ state: s, parent, via, viaFaint, out: [] });
    index.set(key, nodes.length - 1);
    return nodes.length - 1;
  };

  add(host.initial, -1, null, false);
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
        failures.push({ path: [...pathTo(head), { action, faint: false }], action, message: String(e) });
        continue;
      }
      if (res.source === 'invalid' || res.source === 'blocked') continue;
      const to = add(res.state, head, action, res.events.some((ev) => ev.type === 'faint'));
      if (to >= 0 && to !== head) cur.out.push(to);
    }
  }

  // Reverse reachability from clear states (S3).
  const rev: number[][] = nodes.map(() => []);
  nodes.forEach((n, i) => n.out.forEach((o) => (rev[o] as number[]).push(i)));
  const canClear = new Array<boolean>(nodes.length).fill(false);
  const queue: number[] = [];
  nodes.forEach((n, i) => {
    if (host.isClear(n.state)) {
      canClear[i] = true;
      queue.push(i);
    }
  });
  for (let q = 0; q < queue.length; q++) {
    for (const p of rev[queue[q] as number] as number[]) {
      if (!canClear[p]) {
        canClear[p] = true;
        queue.push(p);
      }
    }
  }

  const firstClear = nodes.findIndex((n) => host.isClear(n.state));
  const shortestPath = firstClear >= 0 ? pathTo(firstClear) : null;

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
    deadEnds,
    deadEndsKnown: !truncated,
    failures,
  };
}

/**
 * For each ability verb, is the screen unsolvable without it?
 * `null` = the search was truncated before a clear was found, so necessity is unknown.
 */
export function requiredAbilities<S extends PuzzleStateLike, A extends ActionLike>(
  host: BfsHost<S, A>,
  abilities: string[],
  maxStates?: number,
): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const v of abilities) {
    const r = explore(host, { excludeVerb: v, ...(maxStates === undefined ? {} : { maxStates }) });
    out[v] = r.clearReachable ? false : r.truncated ? null : true;
  }
  return out;
}
