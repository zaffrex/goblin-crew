// 퍼즐 규칙 엔진: 순수 함수 step(screen, state, action) (ADR-0065 5절).
// 게임(#68), 정답 자동 플레이, BFS 검사 도구(#67)가 모두 이 함수 하나를 쓴다.
// 난수·시각·틱을 쓰지 않는다. 같은 상태 + 같은 행동 = 항상 같은 결과(ADR-0018 S1).

import { CHARACTERS } from '../characters';
import {
  FLOOR,
  isDoHere,
  GAUGE_MAX,
  PICKER,
  STAY,
  type Action,
  type CharacterId,
  type CharactersData,
  type Condition,
  type Effect,
  type PuzzleEvent,
  type PuzzleState,
  type RuleDef,
  type RuleShowItem,
  type ScreenData,
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
  const out: PuzzleState = { screen: s.screen, at: { ...s.at }, flags: { ...s.flags }, items: [...s.items], gauge: s.gauge };
  if (s.hands !== undefined) out.hands = s.hands;
  return out;
}

/** 이 행동이 든 물건 내려놓기 모양인가: 쭉이가 든 물건을 그 물건 자신에게 쓴다(ADR-1031 4절). */
function isPutAction(s: PuzzleState, a: Action): boolean {
  return a.char === PICKER && a.verb === 'item' && s.hands !== undefined && a.item === s.hands && a.target === s.hands;
}

function capacityOf(spot: SpotDef): number {
  return spot.free ? Infinity : (spot.capacity ?? 1);
}

function occupants(s: PuzzleState, spotId: string): CharacterId[] {
  return CHAR_ORDER.filter((c) => s.at[c] === spotId);
}

/**
 * `actor`가 대상에 `verb`를 쓰기 전에 걸어갈 자리 ID(또는 `stay`)를 돌려준다. 핫스팟은 `variants`를 먼저 본다.
 * 맵의 `from`에 `actor`가 지금 선 자리가 있으면 그 값(동사 → `default`)을 먼저 쓴다(#688).
 */
export function approachFor(screen: ScreenData, state: PuzzleState, actor: CharacterId, target: string, verb: Verb): string {
  const hs = screen.hotspots[target];
  let approach = hs ? hs.approach : screen.spots[target]?.approach;
  if (hs?.variants) {
    const v = hs.variants.find((variant) => flagsMatch(state, variant.when.flags));
    if (v?.approach !== undefined) approach = v.approach;
  }
  if (approach === undefined) return FLOOR;
  if (typeof approach === 'string') return approach;
  const here = state.at[actor];
  // 프로토타입 키(`constructor` 등)로 엉뚱한 값을 집지 않게 자기 키만 본다(#699).
  const from = here !== undefined && approach.from && Object.hasOwn(approach.from, here) ? approach.from[here] : undefined;
  if (typeof from === 'string') return from;
  return from?.[verb] ?? from?.default ?? approach[verb] ?? approach.default ?? FLOOR;
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
  if (when.holds !== undefined) {
    const ok = typeof when.holds === 'string' ? s.hands === when.holds : (s.hands !== undefined) === when.holds;
    if (!ok) return false;
  }
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
    (r) =>
      r.target === target && r.verb === verb && (!extra || extra(r)) && handsAllow(screen, s, action, r) && conditionMatches(s, action, r.when),
  );
}

/**
 * 집기·내려놓기의 엔진 조건(ADR-1031). 데이터에 적지 않아도 늘 건다.
 * `pick`: 쭉이가 빈손. `put`: 쭉이가 규칙 대상을 들고 `free` 자리에 서 있다(아니면 캐릭터 폴백, 4절 표).
 */
function handsAllow(screen: ScreenData, s: PuzzleState, action: Action, r: RuleDef): boolean {
  if (r.do?.pick && (action.char !== PICKER || s.hands !== undefined)) return false;
  if (r.do?.put && (action.char !== PICKER || s.hands !== r.target || screen.spots[s.at[action.char]]?.free !== true)) return false;
  return true;
}

/** `self`, `@자리`(그 자리에 지금 있는 첫 캐릭터)를 실제 캐릭터 ID로 바꾼다. 빈 자리면 undefined. */
function resolveWho(who: string, s: PuzzleState, actor: CharacterId): string | undefined {
  if (who === 'self') return actor;
  if (who.startsWith('@')) return occupants(s, who.slice(1))[0];
  return who;
}

/** 연출을 이벤트로 바꾼다. 효과 위치 표시(`do`)는 연출이 아니라 건너뛴다(위치는 `applyRule`이 정한다). */
function showEvents(show: readonly RuleShowItem[] | undefined, s: PuzzleState, actor: CharacterId): PuzzleEvent[] {
  const out: PuzzleEvent[] = [];
  for (const item of show ?? []) {
    if (isDoHere(item)) continue;
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

/** 효과를 set → pick/put → give/take → move → gauge 순서로 적용한다(ADR-0065 5절, ADR-1031). s를 바꾼다. */
function applyEffect(
  screen: ScreenData,
  s: PuzzleState,
  actor: CharacterId,
  target: string,
  eff: Effect | undefined,
  events: PuzzleEvent[],
): void {
  if (!eff) return;
  for (const [k, v] of Object.entries(eff.set ?? {})) {
    if (!(k in s.flags)) throw new PuzzleContentError(`선언 안 된 플래그: ${k}`);
    s.flags[k] = v;
  }
  // 손 바꾸기는 이벤트를 내지 않는다. 그림은 행동 앞뒤 상태의 `hands`로 그린다.
  if (eff.pick) s.hands = target;
  if (eff.put) delete s.hands;
  for (const item of eff.give ?? []) {
    if (s.items.includes(item)) continue;
    s.items.push(item);
    events.push({ type: 'item', op: 'give', item });
  }
  for (const item of eff.take ?? []) {
    if (s.hands === item) delete s.hands;
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
  if (s.hands !== undefined) {
    // 든 물건은 장대 끝에 있어 화면 대상이 아니다. 그 물건을 누르는 건 내려놓기 모양뿐이다(ADR-1031 1·4절).
    if (a.target === s.hands) return isPutAction(s, a);
    // 든 채로 쭉이는 장대 능력이 안 나간다(4절 표).
    if (a.char === PICKER && a.verb === ABILITY[PICKER]) return false;
  }
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
      return a.item !== undefined && (s.items.includes(a.item) || (a.char === PICKER && s.hands === a.item));
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
    // 효과 이벤트는 `{ "do": "here" }` 자리에, 없으면 연출 뒤에 낸다(#206). 바뀌는 건 이벤트 순서뿐이다.
    const show = rule.show ?? [];
    const mark = show.findIndex(isDoHere);
    const split = mark < 0 ? show.length : mark;
    // 연출의 `@자리` 화자는 표시 앞뒤 모두 효과 적용 전 자리로 푼다. 그래서 둘 다 효과 전에 만든다.
    const before = showEvents(show.slice(0, split), s, actor);
    const after = showEvents(show.slice(split + 1), s, actor);
    events.push(...before);
    applyEffect(screen, s, actor, rule.target, rule.do, events);
    events.push(...after);
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
  // 내려놓기는 걷지 않는다(그 자리에 놓는다).
  if (verb !== 'look' && !isPutAction(s, action)) {
    const dest = approachFor(screen, s, actor, target, verb);
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
