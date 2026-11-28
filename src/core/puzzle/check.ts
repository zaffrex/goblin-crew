// Screen checker (#67): wires the real `step` into the generic BFS explorer (ADR-0096) and
// replays the screen's `solution`. Part 1 = M1 required items; damage-dependence warnings come in part 2.

import { explore, requiredAbilitiesBoth, type BfsHost, type ExploreResult, type PathStep } from './bfs';
import { initialState, step } from './step';
import type { Action, CharacterId, CharactersData, ChainKind, PuzzleState, RuleDef, ScreenData, Verb } from './types';
import { PICKER, VERBS } from './types';

export function screenHost(screen: ScreenData, characters?: CharactersData): BfsHost<PuzzleState, Action> {
  const targets = [...new Set([...Object.keys(screen.spots), ...Object.keys(screen.hotspots)])];
  // Characters of this screen come from `start.at`, not the global roster.
  const chars = Object.keys(screen.start.at) as Action['char'][];
  return {
    initial: initialState(screen),
    step: (s, a) => step(screen, s, a, characters),
    isClear: (s) => s.flags[screen.exitFlag] === true,
    actions: (s) => {
      const out: Action[] = [];
      for (const char of chars) {
        for (const target of targets) {
          for (const verb of VERBS as readonly Verb[]) {
            if (verb === 'item') {
              for (const item of s.items) out.push({ char, verb, target, item });
              // 든 물건은 쭉이만 쓴다(ADR-1031). 파티 아이템과 ID가 겹치지 않는다(검사 `hands-item-overlap`).
              if (char === PICKER && s.hands !== undefined) out.push({ char, verb, target, item: s.hands });
            }
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
  /** Warnings (not CI failures): damage-dependent clear, damage shortcut, states that clear only by damage. */
  damageWarnings: string[];
  /** Warnings (not CI failures) about `solution` itself, e.g. longer than the BFS shortest. Kept apart from `damageWarnings`: a deliberately long solution must not fail the damage-free playthrough tests. */
  solutionWarnings: string[];
  /** true = removing the ability makes clear unreachable. `null` = could not be judged (the search was truncated). */
  requiredAbilities: Record<string, boolean | null>;
  /** Same over the full graph; shown in the report only when it differs from `requiredAbilities`. */
  requiredAbilitiesFull: Record<string, boolean | null>;
  /** Empty when `solution` replays cleanly to a clear without fainting. */
  solutionProblems: string[];
  /** ADR-1031 C1·C2·C4(b)·C7 counts over `solution` (report line). */
  chain: ChainSummary;
  /** ADR-1031 C1·C2·C4(b)·C7 failures. Empty = pass. Screens in `CHAIN_EXEMPT` only get C7. */
  chainErrors: string[];
}

/** Warning (not a failure): `solution` is longer than the BFS shortest, so the shortest route may skip the designed beats. */
export function solutionLengthWarning(screen: ScreenData, e: ExploreResult<PuzzleState, Action>): string | null {
  if (e.truncated || !screen.solution?.length) return null;
  const shortest = e.safeClearReachable ? e.safeShortestLength : e.shortestLength;
  if (shortest === null || screen.solution.length <= shortest) return null;
  return `solution ${screen.solution.length}수 > 최단 ${shortest}수: 최단 길로 깨면 설계한 박자를 건너뛸 수 있음 (의도된 길이면 무시)`;
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

/** ADR-0018 R1: distinct `anim` names the screen uses, not counting shared `common.*` ones. */
export function uniqueReactions(screen: ScreenData): number {
  const names = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const a = o.anim;
      if (Array.isArray(a) && typeof a[1] === 'string' && !a[1].startsWith('common.')) names.add(a[1]);
      Object.values(o).forEach(walk);
    }
  };
  walk([screen.rules, screen.fallbacks, screen.onEnter, screen.spots]);
  return names.size;
}

const fmtPath = (path: PathStep<Action>[]): string =>
  path.map((p) => `${p.action.char}.${p.action.verb}@${p.action.target}${p.faint ? '(기절)' : p.damage ? '(피해)' : ''}`).join(' > ');

export function damageWarnings(e: ExploreResult<PuzzleState, Action>): string[] {
  const w: string[] = [];
  if (e.truncated) return w;
  if (e.clearReachable && !e.safeClearReachable) w.push('피해 없이는 클리어에 닿지 않음');
  else if (e.shortestLength !== null && e.safeShortestLength !== null && e.shortestLength < e.safeShortestLength)
    w.push(`피해 지름길: 피해 포함 ${e.shortestLength}수 < 피해 없이 ${e.safeShortestLength}수 경로 ${fmtPath(e.shortestPath ?? [])}`);
  for (const d of e.damageWarnings)
    w.push(`피해로만 탈출하는 상태 ${JSON.stringify({ at: d.state.at, flags: d.state.flags, items: d.state.items, hands: d.state.hands })} 게이지 ${d.gauges.join(',')} 경로 ${fmtPath(d.path)}`);
  return w;
}

// --- 물건 사슬 검사(ADR-1031 2절 C1·C2·C4(b)·C7, 실패) ---

/**
 * 아직 ADR-1031대로 다시 짜지 않은 화면(2절 "옮겨 가는 동안의 예외"). C7만 보고 C1·C2·C4(b)는 건너뛴다.
 * 비어 가기만 한다: 테스트가 "이 목록 ⊆ 처음 세 개"를 고정한다. 다시 짠 화면 PR이 자기 id를 지운다.
 */
export const CHAIN_EXEMPT: readonly string[] = ['magpie_nest', 'park_fountain', 'laundromat'];
/** 튜토리얼 화면(ADR-0018 M6, ADR-0905 순서의 첫 판). C1이 "집기 ≥1"로 바뀌고 C2·C4(b)는 안 본다. */
export const CHAIN_TUTORIAL: readonly string[] = ['magpie_nest'];
/** C1 일반 화면 하한: `solution`에서 맞은 `combine`+`use` 규칙 수. */
export const CHAIN_USE_MIN = 3;
/** C7: 쭉이가 들 수 있는 서로 다른 물건 수 상한(`pick` 규칙 대상, 결합으로 생긴 물건 포함). */
export const PICK_MAX = 4;

/** `solution` 리플레이에서 규칙이 맞은 행동 하나. `on` = 그 행동으로 false/없음 → true가 된 플래그. */
export interface FiredRule {
  i: number;
  char: CharacterId;
  rule: RuleDef;
  on: string[];
}

export interface ChainSummary {
  fired: FiredRule[];
  /** C1: `combine`+`use` 규칙 수(일반), `pick` 규칙 수(튜토리얼). */
  uses: number;
  picks: number;
  /** C2: 변화가 켠 플래그를 그 뒤 결합이 `when.flags` true로 본 쌍 `[변화 i, 결합 j, 플래그]`. */
  changeIntoCombine: [number, number, string][];
  /** C4(b): 쭉이 말고 화면에 있는 캐릭터별 `change`·`combine` 규칙 수. */
  stateChangers: Partial<Record<CharacterId, number>>;
  /** C7: `pick` 규칙 대상 물건 ID(정렬). */
  pickIds: string[];
}

const isKind = (r: RuleDef, ...k: ChainKind[]): boolean => r.chain !== undefined && k.includes(r.chain);

/** `solution`을 돌리며 규칙이 맞은 행동만 모은다. 막히거나 예외가 나면 거기서 멈춘다(문제는 `replaySolution`이 따로 낸다). */
export function firedRules(screen: ScreenData, characters?: CharactersData): FiredRule[] {
  const out: FiredRule[] = [];
  const byId = new Map(screen.rules.map((r) => [r.id, r]));
  let s = initialState(screen);
  for (const [i, a] of (screen.solution ?? []).entries()) {
    let r;
    try {
      r = step(screen, s, a, characters);
    } catch {
      break;
    }
    if (r.source === 'invalid' || r.source === 'blocked') break;
    const rule = r.source === 'rule' && r.ruleId !== undefined ? byId.get(r.ruleId) : undefined;
    if (rule) {
      const on = Object.keys(r.state.flags).filter((k) => r.state.flags[k] === true && s.flags[k] !== true);
      out.push({ i, char: a.char, rule, on });
    }
    s = r.state;
  }
  return out;
}

export function chainSummary(screen: ScreenData, characters?: CharactersData): ChainSummary {
  const fired = firedRules(screen, characters);
  const changeIntoCombine: [number, number, string][] = [];
  for (const c of fired.filter((f) => isKind(f.rule, 'change'))) {
    for (const b of fired.filter((f) => f.i > c.i && isKind(f.rule, 'combine'))) {
      const want = b.rule.when?.flags ?? {};
      for (const k of c.on) if (want[k] === true) changeIntoCombine.push([c.i, b.i, k]);
    }
  }
  const stateChangers: Partial<Record<CharacterId, number>> = {};
  for (const ch of Object.keys(screen.start.at) as CharacterId[]) {
    if (ch !== PICKER) stateChangers[ch] = fired.filter((f) => f.char === ch && isKind(f.rule, 'change', 'combine')).length;
  }
  return {
    fired,
    uses: fired.filter((f) => isKind(f.rule, 'combine', 'use')).length,
    picks: fired.filter((f) => f.rule.do?.pick === true).length,
    changeIntoCombine,
    stateChangers,
    pickIds: [...new Set(screen.rules.filter((r) => r.do?.pick === true).map((r) => r.target))].sort(),
  };
}

/** ADR-1031 C1·C2·C4(b)·C7 실패 목록. 빈 배열 = 통과. */
export function chainErrors(screen: ScreenData, c: ChainSummary): string[] {
  const out: string[] = [];
  if (c.pickIds.length > PICK_MAX) out.push(`C7 들 물건 ${c.pickIds.length}개 > ${PICK_MAX}: ${c.pickIds.join(',')}`);
  if (CHAIN_EXEMPT.includes(screen.id)) return out;
  if (CHAIN_TUTORIAL.includes(screen.id)) {
    if (c.picks < 1) out.push('C1 튜토리얼 solution에 집기(pick) 0개 < 1');
    return out;
  }
  if (c.uses < CHAIN_USE_MIN) out.push(`C1 solution의 결합+쓰기(chain combine·use) ${c.uses}개 < ${CHAIN_USE_MIN}`);
  const changes = c.fired.filter((f) => isKind(f.rule, 'change')).length;
  const combines = c.fired.filter((f) => isKind(f.rule, 'combine')).length;
  if (changes < 1) out.push('C2 solution에 변화(chain change) 0개');
  if (combines < 1) out.push('C2 solution에 결합(chain combine) 0개');
  if (changes >= 1 && combines >= 1 && c.changeIntoCombine.length === 0)
    out.push('C2 변화가 켠 플래그를 그 뒤 결합 규칙의 when.flags(true)가 보지 않음(변화된 물건이 결합 재료가 아님)');
  for (const [ch, n] of Object.entries(c.stateChangers)) {
    if (n === 0) out.push(`C4(b) ${ch}가 solution에서 물건 상태를 바꾸는 고리(change·combine) 0개`);
  }
  return out;
}

export function formatChain(screen: ScreenData, c: ChainSummary): string {
  const who = Object.entries(c.stateChangers).map(([k, v]) => `${k}=${v}`).join(' ');
  const exempt = CHAIN_EXEMPT.includes(screen.id) ? ' (CHAIN_EXEMPT: C7만 검사)' : '';
  return `  사슬 C1 결합+쓰기 ${c.uses} 집기 ${c.picks}, C2 변화→결합 ${c.changeIntoCombine.length}, C4(b) ${who}, C7 들 물건 ${c.pickIds.length}${exempt}`;
}

export function checkScreen(screen: ScreenData, characters?: CharactersData, maxStates?: number): ScreenReport {
  const host = screenHost(screen, characters);
  const full = explore(host, maxStates === undefined ? {} : { maxStates });
  const req = requiredAbilitiesBoth(host, ['stretch', 'stomp', 'squeak'], maxStates);
  const chain = chainSummary(screen, characters);
  return {
    explore: full,
    damageWarnings: damageWarnings(full),
    solutionWarnings: [solutionLengthWarning(screen, full)].filter((w): w is string => w !== null),
    requiredAbilities: req.primary,
    requiredAbilitiesFull: req.full,
    solutionProblems: replaySolution(screen, characters),
    chain,
    chainErrors: chainErrors(screen, chain),
  };
}

/** One-screen human report for CI logs. Shortest is over the damage-free graph, or the full graph when it cannot clear damage-free. */
export function formatReport(screen: ScreenData, r: ScreenReport): string {
  const e = r.explore;
  const lines = [
    `[${screen.id}] 노드 ${e.stateCount}(게이지 제외 ${e.foldedCount})${e.truncated ? ' 잘림' : ''}, 최단(${e.safeClearReachable ? '피해 없는 그래프' : '전체 그래프'}) ${(e.safeClearReachable ? e.safeShortestLength : e.shortestLength) ?? '없음'}`,
    `  막다른 상태 ${e.deadEndsKnown ? e.deadEnds.length : '판정 불가'}, 예외 ${e.failures.length}, R1 고유 반응 ${uniqueReactions(screen)}`,
    `  필수 능력 ${Object.entries(r.requiredAbilities).map(([k, v]) => `${k}=${v === null ? '?' : v ? 'Y' : 'N'}`).join(' ')}`,
  ];
  if (JSON.stringify(r.requiredAbilities) !== JSON.stringify(r.requiredAbilitiesFull))
    lines.push(`  필수 능력(전체 그래프) ${Object.entries(r.requiredAbilitiesFull).map(([k, v]) => `${k}=${v === null ? '?' : v ? 'Y' : 'N'}`).join(' ')}`);
  for (const d of e.deadEnds) lines.push(`  막다른: 게이지 ${d.gauges.join(',')} 경로 ${fmtPath(d.path)}`);
  for (const f of e.failures.slice(0, 3)) lines.push(`  예외: ${f.message}`);
  for (const w of r.damageWarnings) lines.push(`  경고: ${w}`);
  for (const w of r.solutionWarnings) lines.push(`  경고(solution): ${w}`);
  for (const p of r.solutionProblems) lines.push(`  solution: ${p}`);
  lines.push(formatChain(screen, r.chain));
  for (const p of r.chainErrors) lines.push(`  사슬: ${p}`);
  return lines.join('\n');
}

/** Failures (CI-breaking) for a screen report. Empty = pass. Warnings are the report text only. */
export function reportErrors(r: ScreenReport): string[] {
  const e = r.explore;
  const out: string[] = [];
  if (e.failures.length) out.push(`step 예외 ${e.failures.length}건`);
  if (e.truncated) out.push('상태 수 한도 초과(S3 판정 불가)');
  if (!e.clearReachable) out.push('클리어에 닿지 않음');
  if (e.deadEndsKnown && e.deadEnds.length) out.push(`막다른 상태 ${e.deadEnds.length}개`);
  out.push(...r.solutionProblems);
  out.push(...r.chainErrors);
  return out;
}
