// BFS state-graph explorer for puzzle screens (ADR-0065 section 8, issue #67).
// It only calls the injected `step`, so it never re-interprets puzzle rules.
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
  /** `screen.start.at`: where a faint (gauge 0) or reset edge puts everyone. */
  startAt: Record<string, string>;
  /** Gauge value after a faint (ADR-0018 G1). */
  fullGauge: number;
  step(state: S, action: A): StepResultLike<S>;
  /** Every action to try from `state` (3 chars x spots/targets/verbs/items). */
  actions(state: S): A[];
  isClear(state: S): boolean;
}

export interface ExploreOptions {
  /** Drop actions with this verb from the graph (M1/M2 required-ability check). */
  excludeVerb?: string;
  /** Stop exploring when this many states are reached (ADR-0065 "state count" warning). */
  maxStates?: number;
}

export interface StepFailure<A> {
  path: (A | 'reset')[];
  action: A;
  message: string;
}

export interface ExploreResult<S extends PuzzleStateLike, A extends ActionLike> {
  stateCount: number;
  truncated: boolean;
  clearReachable: boolean;
  /** Shortest action count to clear, resets excluded from the count's meaning (they are free edges). */
  shortestLength: number | null;
  shortestPath: (A | 'reset')[] | null;
  /** S3: reachable states that cannot reach a clear state. Path from start included. */
  deadEnds: { state: S; path: (A | 'reset')[]; viaReset: boolean }[];
  failures: StepFailure<A>[];
}

/** Normalized node key: gauge is excluded (ADR-0065 section 8). */
export function stateKey(s: PuzzleStateLike): string {
  return JSON.stringify([s.at, s.flags, [...s.items].sort()]);
}

interface Node<S, A> {
  state: S;
  parent: number;
  via: A | 'reset' | null;
  out: number[];
}

export function explore<S extends PuzzleStateLike, A extends ActionLike>(
  host: BfsHost<S, A>,
  opts: ExploreOptions = {},
): ExploreResult<S, A> {
  const maxStates = opts.maxStates ?? 100_000;
  const norm = (s: S): S => ({ ...s, gauge: host.fullGauge });
  const nodes: Node<S, A>[] = [];
  const index = new Map<string, number>();
  const failures: StepFailure<A>[] = [];
  let truncated = false;

  const at = (i: number): Node<S, A> => nodes[i] as Node<S, A>;
  const pathTo = (i: number): (A | 'reset')[] => {
    const p: (A | 'reset')[] = [];
    for (let n = i; at(n).parent >= 0; n = at(n).parent) p.push(at(n).via as A | 'reset');
    return p.reverse();
  };

  const add = (s: S, parent: number, via: A | 'reset' | null): number => {
    const key = stateKey(s);
    const found = index.get(key);
    if (found !== undefined) return found;
    if (nodes.length >= maxStates) {
      truncated = true;
      return -1;
    }
    nodes.push({ state: norm(s), parent, via, out: [] });
    index.set(key, nodes.length - 1);
    return nodes.length - 1;
  };

  add(host.initial, -1, null);
  for (let head = 0; head < nodes.length; head++) {
    const cur = at(head);
    const link = (s: S, via: A | 'reset') => {
      const to = add(s, head, via);
      if (to >= 0 && to !== head) cur.out.push(to);
    };
    // Reset edge: same flags and items, everyone back at start.
    link({ ...cur.state, at: { ...host.startAt } }, 'reset');
    for (const action of host.actions(cur.state)) {
      if (opts.excludeVerb && action.verb === opts.excludeVerb) continue;
      let res: StepResultLike<S>;
      try {
        res = host.step(cur.state, action);
      } catch (e) {
        failures.push({ path: [...pathTo(head), action], action, message: String(e) });
        continue;
      }
      if (res.source === 'invalid' || res.source === 'blocked') continue;
      link(res.state, action);
      // Damage edge: re-step at gauge 1 so effect + faint together become an edge.
      if (res.state.gauge < cur.state.gauge || res.events.some((ev) => ev.type === 'faint')) {
        try {
          const faint = host.step({ ...cur.state, gauge: 1 }, action);
          link(faint.state, action);
        } catch (e) {
          failures.push({ path: [...pathTo(head), action], action, message: String(e) });
        }
      }
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
  const deadEnds = truncated
    ? []
    : nodes.flatMap((n, i) => {
        if (canClear[i]) return [];
        const path = pathTo(i);
        return [{ state: n.state, path, viaReset: path.includes('reset') }];
      });

  return {
    stateCount: nodes.length,
    truncated,
    clearReachable: firstClear >= 0,
    shortestLength: shortestPath ? shortestPath.filter((a) => a !== 'reset').length : null,
    shortestPath,
    deadEnds,
    failures,
  };
}

/** M1/M2: for each ability verb, is the screen still solvable without it? */
export function requiredAbilities<S extends PuzzleStateLike, A extends ActionLike>(
  host: BfsHost<S, A>,
  abilities: string[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const v of abilities) out[v] = !explore(host, { excludeVerb: v }).clearReachable;
  return out;
}
