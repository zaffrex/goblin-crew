// 퍼즐 규칙 엔진: 순수 함수 step(screen, state, action) (ADR-0065 5절).
// 게임(#68), 정답 자동 플레이, BFS 검사 도구(#67)가 모두 이 함수 하나를 쓴다.
// 난수·시각·틱을 쓰지 않는다. 같은 상태 + 같은 행동 = 항상 같은 결과(ADR-0018 S1).

import { CHARACTERS } from '../characters';
import {
  FLOOR,
  GAUGE_MAX,
  STAY,
  type Action,
  type CharacterId,
  type CharactersData,
  type Condition,
  type Effect,
  type PuzzleEvent,
  type PuzzleState,
  type RuleDef,
  type ScreenData,
  type ShowItem,
  type SpotDef,
  type StepResult,
  type StepSource,
  type Verb,
} from './types';

/** 콘텐츠(화면 JSON) 오류. 정원 초과 `move`, 선언 안 된 플래그 등. 엔진은 잡아서 행동을 무시한다. */
export class PuzzleContentError extends Error {
  override name = 'PuzzleContentError';
}

/** 캐릭터 순서 고정(쭉이, 묵직이, 삑삑이). `move.from`으로 여러 명을 옮길 때 이 순서를 쓴다. */
const CHAR_ORDER: readonly CharacterId[] = CHARACTERS.map((c) => c.id);
const ABILITY: Readonly<Record<CharacterId, Verb>> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c.ability]),
) as Record<CharacterId, Verb>;

export function initialState(screen: ScreenData): PuzzleState {
  return {
    screen: screen.id,
    at: { ...screen.start.at },
    flags: { ...screen.flags },
    items: [...screen.start.items].sort(),
    gauge: GAUGE_MAX,
  };
}

function cloneState(s: PuzzleState): PuzzleState {
  return { screen: s.screen, at: { ...s.at }, flags: { ...s.flags }, items: [...s.items], gauge: s.gauge };
}

function capacityOf(spot: SpotDef): number {
  return spot.free ? Infinity : (spot.capacity ?? 1);
}

function occupants(s: PuzzleState, spotId: string): CharacterId[] {
  return CHAR_ORDER.filter((c) => s.at[c] === spotId);
}

/** 대상의 `approach`를 풀어 걸어갈 자리 ID(또는 `stay`)를 돌려준다. 핫스팟은 `variants`를 먼저 본다. */
export function approachFor(screen: ScreenData, state: PuzzleState, target: string, verb: Verb): string {
  const hs = screen.hotspots[target];
  let approach = hs ? hs.approach : screen.spots[target]?.approach;
  if (hs?.variants) {
    const v = hs.variants.find((variant) => flagsMatch(state, variant.when.flags));
    if (v?.approach !== undefined) approach = v.approach;
  }
  if (approach === undefined) return FLOOR;
  if (typeof approach === 'string') return approach;
  return approach[verb] ?? approach.default ?? FLOOR;
}

function flagsMatch(s: PuzzleState, flags: Record<string, boolean>): boolean {
  for (const [k, v] of Object.entries(flags)) {
    if (!(k in s.flags)) throw new PuzzleContentError(`선언 안 된 플래그: ${k}`);
    if (s.flags[k] !== v) return false;
  }
  return true;
}

function conditionMatches(s: PuzzleState, action: Action, when: Condition | undefined): boolean {
  if (!when) return true;
  if (when.who && !when.who.includes(action.char)) return false;
  if (when.at && !when.at.includes(s.at[action.char])) return false;
  if (when.flags && !flagsMatch(s, when.flags)) return false;
  if (when.has && !when.has.every((i) => s.items.includes(i))) return false;
  if (when.lacks && when.lacks.some((i) => s.items.includes(i))) return false;
  if (when.item !== undefined && (action.verb !== 'item' || action.item !== when.item)) return false;
  if (when.occupied) {
    for (const [spot, want] of Object.entries(when.occupied)) {
      if (occupants(s, spot).length > 0 !== want) return false;
    }
  }
  return true;
}

function findRule(
  screen: ScreenData,
  s: PuzzleState,
  action: Action,
  target: string,
  verb: Verb,
  extra?: (r: RuleDef) => boolean,
): RuleDef | undefined {
  return screen.rules.find(
    (r) => r.target === target && r.verb === verb && (!extra || extra(r)) && conditionMatches(s, action, r.when),
  );
}

/** `self`, `@자리`(그 자리에 지금 있는 첫 캐릭터)를 실제 캐릭터 ID로 바꾼다. 빈 자리면 undefined. */
function resolveWho(who: string, s: PuzzleState, actor: CharacterId): string | undefined {
  if (who === 'self') return actor;
  if (who.startsWith('@')) return occupants(s, who.slice(1))[0];
  return who;
}

function showEvents(show: ShowItem[] | undefined, s: PuzzleState, actor: CharacterId): PuzzleEvent[] {
  const out: PuzzleEvent[] = [];
  for (const item of show ?? []) {
    if ('anim' in item) {
      const target = resolveWho(item.anim[0], s, actor);
      if (target !== undefined) out.push({ type: 'anim', target, name: item.anim[1] });
    } else if ('say' in item) {
      const speaker = resolveWho(item.say[0], s, actor);
      const text = item.say[1];
      if (speaker !== undefined) out.push({ type: 'say', speaker, text: Array.isArray(text) ? [...text] : text });
    } else {
      const target = resolveWho(item.fx[1], s, actor);
      if (target !== undefined) out.push({ type: 'fx', effect: item.fx[0], target });
    }
  }
  return out;
}

function spotOrThrow(screen: ScreenData, id: string): SpotDef {
  const spot = screen.spots[id];
  if (!spot) throw new PuzzleContentError(`없는 서는 자리: ${id}`);
  return spot;
}

function applyGauge(s: PuzzleState, delta: number, events: PuzzleEvent[]): void {
  if (!delta) return;
  s.gauge = Math.max(0, Math.min(GAUGE_MAX, s.gauge + delta));
  events.push({ type: 'gauge', delta, value: s.gauge });
}

/** 효과를 set → give/take → move → gauge 순서로 적용한다(ADR-0065 5절). s를 바꾼다. */
function applyEffect(screen: ScreenData, s: PuzzleState, actor: CharacterId, eff: Effect | undefined, events: PuzzleEvent[]): void {
  if (!eff) return;
  for (const [k, v] of Object.entries(eff.set ?? {})) {
    if (!(k in s.flags)) throw new PuzzleContentError(`선언 안 된 플래그: ${k}`);
    s.flags[k] = v;
  }
  for (const item of eff.give ?? []) {
    if (s.items.includes(item)) continue;
    s.items.push(item);
    events.push({ type: 'item', op: 'give', item });
  }
  for (const item of eff.take ?? []) {
    const i = s.items.indexOf(item);
    if (i < 0) continue;
    s.items.splice(i, 1);
    events.push({ type: 'item', op: 'take', item });
  }
  s.items.sort();
  for (const m of eff.move ?? []) {
    const movers = 'from' in m ? occupants(s, m.from) : [m.who === 'self' ? actor : m.who];
    const dest = spotOrThrow(screen, m.to);
    for (const c of movers) {
      const from = s.at[c];
      if (from === m.to) continue;
      if (occupants(s, m.to).length >= capacityOf(dest)) {
        throw new PuzzleContentError(`정원 초과: ${screen.id}/${m.to}로 ${c}를 옮길 수 없음`);
      }
      s.at[c] = m.to;
      events.push(m.via === undefined ? { type: 'place', char: c, from, to: m.to } : { type: 'place', char: c, from, to: m.to, via: m.via });
    }
  }
  applyGauge(s, eff.gauge ?? 0, events);
}

type GoTo = { kind: 'rule'; rule: RuleDef } | { kind: 'moved' } | { kind: 'blocked' } | { kind: 'invalid' };

/**
 * 이동 판정(ADR-0065 5절 2단계). (T, move) 규칙이 맞으면 그 규칙(아직 적용 전),
 * 없으면 기본 이동: hold면 invalid, 정원이 차면 blocked(+takenShow), 아니면 at = T(+walk).
 */
function goTo(screen: ScreenData, s: PuzzleState, action: Action, target: string, events: PuzzleEvent[]): GoTo {
  const rule = findRule(screen, s, action, target, 'move');
  if (rule) return { kind: 'rule', rule };
  const spot = screen.spots[target];
  if (!spot || spot.hold) return { kind: 'invalid' };
  if (occupants(s, target).length >= capacityOf(spot)) {
    events.push(...showEvents(spot.takenShow, s, action.char));
    return { kind: 'blocked' };
  }
  const from = s.at[action.char];
  s.at[action.char] = target;
  events.push({ type: 'walk', char: action.char, from, to: target });
  return { kind: 'moved' };
}

function isValidAction(screen: ScreenData, s: PuzzleState, a: Action): boolean {
  if (!(a.char in s.at) || !(a.char in ABILITY)) return false;
  const isTarget = a.target in screen.spots || a.target in screen.hotspots;
  if (!isTarget) return false;
  switch (a.verb) {
    case 'move':
      return a.target in screen.spots && s.at[a.char] !== a.target && a.item === undefined;
    case 'look':
    case 'hand':
      return a.item === undefined;
    case 'stretch':
    case 'stomp':
    case 'squeak':
      return ABILITY[a.char] === a.verb && a.item === undefined;
    case 'item':
      return a.item !== undefined && s.items.includes(a.item);
    default:
      return false;
  }
}

/**
 * 행동 하나를 처리한다. 입력 state는 바꾸지 않는다.
 * @param characters `content/characters.json`(폴백 ② 연출). 없으면 폴백 ②는 연출 없이 끝난다.
 *   연출만 바꾸고 상태는 바꾸지 않으므로 BFS(#67)는 넘기지 않아도 된다.
 */
export function step(screen: ScreenData, state: PuzzleState, action: Action, characters?: CharactersData): StepResult {
  if (!isValidAction(screen, state, action)) {
    return { state: cloneState(state), events: [], source: 'invalid' };
  }
  const s = cloneState(state);
  const actor = action.char;
  const { target, verb } = action;
  const events: PuzzleEvent[] = [];

  const finish = (source: StepSource, ruleId?: string): StepResult => {
    // 6. 게이지 0: 위치만 시작으로, 게이지 가득. 플래그·아이템은 그대로(ADR-0018 G2).
    if (s.gauge <= 0) {
      s.at = { ...screen.start.at };
      s.gauge = GAUGE_MAX;
      events.push({ type: 'faint', to: { ...s.at } });
    }
    // 7. 클리어: exitFlag가 이번 행동으로 true가 됨.
    if (!state.flags[screen.exitFlag] && s.flags[screen.exitFlag]) events.push({ type: 'clear' });
    return ruleId === undefined ? { state: s, events, source } : { state: s, events, source, ruleId };
  };

  const applyRule = (rule: RuleDef): StepResult => {
    // 연출의 `@자리` 화자는 효과 적용 전 자리로 푼다.
    events.push(...showEvents(rule.show, s, actor));
    applyEffect(screen, s, actor, rule.do, events);
    return finish('rule', rule.id);
  };

  // 1. 유지 상태: 그 자리에서 할 수 있는 규칙만, 아니면 손을 놓고 끝.
  const here = s.at[actor];
  const hereSpot = screen.spots[here];
  if (hereSpot?.hold && verb !== 'look') {
    const rule = findRule(screen, s, action, target, verb, (r) => r.when?.at?.includes(here) ?? false);
    if (rule) return applyRule(rule);
    const to = hereSpot.releaseTo;
    if (to === undefined) throw new PuzzleContentError(`hold 자리에 releaseTo 없음: ${screen.id}/${here}`);
    spotOrThrow(screen, to);
    // `@자리` 화자는 손 놓기 전 자리로 푼다(규칙 연출과 같은 기준).
    const show = showEvents(hereSpot.releaseShow?.[actor] ?? hereSpot.releaseShow?.default, s, actor);
    s.at[actor] = to;
    events.push({ type: 'release', char: actor, from: here, to }, ...show);
    return finish('release');
  }

  // 2. 이동 판정.
  if (verb === 'move') {
    const g = goTo(screen, s, action, target, events);
    if (g.kind === 'rule') return applyRule(g.rule);
    if (g.kind === 'moved') return finish('move');
    return { state: g.kind === 'invalid' ? cloneState(state) : s, events, source: g.kind };
  }
  if (verb !== 'look') {
    const dest = approachFor(screen, s, target, verb);
    if (dest !== STAY && s.at[actor] !== dest) {
      const g = goTo(screen, s, action, dest, events);
      if (g.kind === 'rule') return applyRule(g.rule);
      if (g.kind === 'blocked') return { state: s, events, source: 'blocked' };
      if (g.kind === 'invalid') throw new PuzzleContentError(`approach가 갈 수 없는 자리: ${screen.id}/${target} → ${dest}`);
    }
  }

  // 3. 규칙: 이동 뒤 상태로 첫 규칙 하나.
  const rule = findRule(screen, s, action, target, verb);
  if (rule) return applyRule(rule);

  // 4. 폴백 ①: 이 대상의 동사별 기본 반응. 게이지만 바꿀 수 있다.
  const fb = screen.fallbacks?.[target]?.[verb];
  if (fb) {
    events.push(...showEvents(fb.show, s, actor));
    applyGauge(s, fb.do?.gauge ?? 0, events);
    return finish('hotspotFallback');
  }

  // 5. 폴백 ②: 캐릭터 공통 실패 리액션. 상태는 그대로(걷기만 남는다).
  events.push(...showEvents(characters?.fallbacks?.[actor]?.[verb]?.show, s, actor));
  return finish('characterFallback');
}
