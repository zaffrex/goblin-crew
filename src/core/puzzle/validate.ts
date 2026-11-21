// 퍼즐 콘텐츠 검사 (ADR-0065 1절·8절 판정표 첫 줄). 의존성 없이 직접 검사한다.
// 입력은 JSON.parse 결과(unknown)다. 타입이 맞는다고 가정하지 않고 모양부터 본다.
// 실패(error)는 콘텐츠 테스트를 깨고, 경고(warning)는 출력만 한다(ADR-0018 실패/경고 구분).
// 상태 그래프가 필요한 검사(정답 도달, S3, 필수 능력, 정원 초과 경로)는 bfs.ts(#67) 몫이다.

import { CHARACTERS } from '../characters';
import { WALK_AREA } from '../config';
import {
  FLOOR,
  STAY,
  VERBS,
  type AbilityVerb,
  type Action,
  type CharacterId,
  type CharactersData,
  type Condition,
  type Effect,
  type HotspotDef,
  type HotspotVariant,
  type RuleDef,
  type ScreenData,
  type SpotDef,
  type Verb,
} from './types';

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: IssueLevel;
  /** 기계가 읽는 종류. 테스트와 집계용. */
  code: string;
  /** JSON 경로. 예: `rules[3].when.at[0]` */
  path: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** ADR-0065 2절 데이터 ID 문법. 64자 이하. */
export const ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
export const ID_MAX = 64;

/** ADR-0007 결정 6: 클릭 대상 최소 크기. */
export const MIN_BOX = 24;
/** ADR-0004: 내부 해상도. */
export const SCREEN_W = 480;
export const SCREEN_H = 270;
/** 말풍선 한계: 한 줄 14자, 2줄 (ADR-0065 8절, ADR-0007). */
export const LINE_MAX = 14;
export const LINES_MAX = 2;
/** HUD 영역 [x, y, w, h] (docs/design/ui-interaction.md 6절). 핫스팟·서는 자리를 두지 않는다. 경고. */
export const HUD_BOX: readonly [number, number, number, number] = [300, 4, 176, 72];
/**
 * 목표 줄 자리 [x, y, w, h] (docs/design/ui-interaction.md 6-2-2절, #349). 화면 2부터 핫스팟·서는 자리를 두지 않는다. 경고.
 * 코어가 UI 모듈을 import하지 않게 `core/hud.ts` `GOAL_ZONE`과 따로 두고, `hud.test.ts`가 `GOAL_ZONE ⊆ GOAL_BOX`를 확인한다.
 */
export const GOAL_BOX: readonly [number, number, number, number] = [4, 4, 114, 34];

type Rect = readonly [number, number, number, number];
/** 두 상자가 겹치나(맞닿기만 하면 아니다). */
const rectsOverlap = (a: Rect, b: Rect): boolean => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
/** 점이 상자 안인가(왼쪽·위 끝 포함, 오른쪽·아래 끝 제외). */
const rectHas = (r: Rect, x: number, y: number): boolean => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];

const CHAR_IDS: readonly CharacterId[] = CHARACTERS.map((c) => c.id);
const ABILITIES: readonly AbilityVerb[] = CHARACTERS.map((c) => c.ability);

/**
 * 타입 T가 가진 필드 목록(`note` 빼고). 객체 리터럴로 받아서 types.ts에 필드를 더하거나 지우거나
 * 이름을 바꾸면 여기서 typecheck가 실패한다(빠진 키 = 필수 속성 누락, 남는 키 = 초과 속성).
 */
const fieldsOf = <T>(keys: { [K in Exclude<keyof T, 'note'>]: true }): readonly string[] => Object.keys(keys);

const SCREEN_KEYS = fieldsOf<ScreenData>({
  id: true,
  spots: true,
  hotspots: true,
  flags: true,
  start: true,
  exitFlag: true,
  onEnter: true,
  rules: true,
  fallbacks: true,
  solution: true,
});
const START_KEYS = fieldsOf<ScreenData['start']>({ at: true, items: true });
const SPOT_KEYS = fieldsOf<SpotDef>({
  x: true,
  y: true,
  free: true,
  capacity: true,
  box: true,
  hold: true,
  releaseTo: true,
  releasePoint: true,
  releaseShow: true,
  takenShow: true,
  board: true,
  approach: true,
  hintAbility: true,
});
const HOTSPOT_KEYS = fieldsOf<HotspotDef>({ box: true, approach: true, variants: true, hintAbility: true, reachPoint: true });
const VARIANT_KEYS = fieldsOf<HotspotVariant>({ when: true, box: true, approach: true });
const RULE_KEYS = fieldsOf<RuleDef>({ id: true, target: true, verb: true, when: true, do: true, show: true });
const COND_KEYS = fieldsOf<Condition>({ who: true, at: true, flags: true, has: true, lacks: true, item: true, occupied: true });
const EFFECT_KEYS = fieldsOf<Effect>({ set: true, give: true, take: true, move: true, gauge: true });
const ACTION_KEYS = fieldsOf<Action>({ char: true, verb: true, target: true, item: true });
const CHARACTERS_KEYS = fieldsOf<CharactersData>({ fallbacks: true, hints: true });

/**
 * 경로에 키를 붙인다. ID 키는 점을 품을 수 있어서(`magpie.down`) 점이 있으면 대괄호로 쓴다:
 * `do.set["magpie.down"]`. 점 없는 키는 그대로 `spots.floor`.
 */
export const keyPath = (path: string, k: string): string => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`);

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

class Checker {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationIssue[] = [];

  err(path: string, code: string, message: string): void {
    this.errors.push({ level: 'error', code, path, message });
  }

  warn(path: string, code: string, message: string): void {
    this.warnings.push({ level: 'warning', code, path, message });
  }

  /** 객체인지, 모르는 키가 없는지(`note`는 어디서나 허용). 오타(`aproach`)를 잡는다. */
  obj(v: unknown, path: string, keys: readonly string[]): v is Obj {
    if (!isObj(v)) {
      this.err(path, 'schema', '객체여야 한다');
      return false;
    }
    for (const k of Object.keys(v)) {
      if (k !== 'note' && !keys.includes(k)) {
        this.err(keyPath(path, k), 'unknown-key', `모르는 필드: ${k} (쓸 수 있는 필드: ${[...keys, 'note'].join(', ')})`);
      }
    }
    if ('note' in v && typeof v.note !== 'string') this.err(`${path}.note`, 'schema', 'note는 문자열');
    return true;
  }

  id(v: unknown, path: string): v is string {
    if (typeof v !== 'string' || !ID_RE.test(v) || v.length > ID_MAX) {
      this.err(path, 'id', `ID 문법 위반(I1): ${JSON.stringify(v)}`);
      return false;
    }
    return true;
  }

  /** 키가 ID인 맵. 키 문법을 검사하고 [키, 값, 경로] 목록을 돌려준다. 경로는 `keyPath` 규칙을 따른다. */
  idMap(v: unknown, path: string): [string, unknown, string][] {
    if (!isObj(v)) {
      this.err(path, 'schema', '객체여야 한다');
      return [];
    }
    const out: [string, unknown, string][] = [];
    for (const [k, x] of Object.entries(v)) {
      const p = keyPath(path, k);
      if (this.id(k, p)) out.push([k, x, p]);
    }
    return out;
  }

  arr(v: unknown, path: string): unknown[] {
    if (!Array.isArray(v)) {
      this.err(path, 'schema', '배열이어야 한다');
      return [];
    }
    return v;
  }

  bool(v: unknown, path: string): void {
    if (typeof v !== 'boolean') this.err(path, 'schema', '불리언이어야 한다');
  }

  box(v: unknown, path: string): void {
    if (!Array.isArray(v) || v.length !== 4 || !v.every(isNum)) {
      this.err(path, 'schema', 'box는 [x, y, w, h] 숫자 4개');
      return;
    }
    const [x, y, w, h] = v as [number, number, number, number];
    if (w < MIN_BOX || h < MIN_BOX) this.err(path, 'box-small', `box가 ${MIN_BOX}×${MIN_BOX}보다 작다(ADR-0007 결정 6): ${w}×${h}`);
    if (x < 0 || y < 0 || x + w > SCREEN_W || y + h > SCREEN_H) {
      this.err(path, 'box-offscreen', `box가 화면(${SCREEN_W}×${SCREEN_H}) 밖으로 나간다`);
    }
    if (rectsOverlap([x, y, w, h], HUD_BOX)) this.warn(path, 'hud-overlap', 'HUD 영역과 겹친다(ui-interaction.md 6절)');
    if (rectsOverlap([x, y, w, h], GOAL_BOX)) this.warn(path, 'goal-overlap', '목표 줄 자리와 겹친다(ui-interaction.md 6-2-2절)');
  }
}

export interface ValidateContext {
  /** `content/text/ko.json`. */
  texts: Record<string, string>;
}

/** 텍스트 하나의 말풍선 한계(14자 × 2줄). 글자 수는 코드 포인트로 센다. */
export function textFits(text: string): boolean {
  const lines = text.split('\n');
  return lines.length <= LINES_MAX && lines.every((l) => [...l].length <= LINE_MAX);
}

/** `content/text/*.json` 자체 검사: 키 문법, 값은 문자열. 길이는 실제로 쓰는 곳(화면·힌트)에서 본다. */
export function validateTexts(raw: unknown): ValidationResult {
  const c = new Checker();
  for (const [, v, p] of c.idMap(raw, 'texts')) {
    if (typeof v !== 'string') c.err(p, 'schema', '문자열이어야 한다');
  }
  return { errors: c.errors, warnings: c.warnings };
}

function checkTextRef(c: Checker, ctx: ValidateContext, v: unknown, path: string): void {
  if (typeof v !== 'string') {
    c.err(path, 'schema', `텍스트 ID(content/text의 키, 문자열)여야 한다: ${JSON.stringify(v)}`);
    return;
  }
  if (!c.id(v, path)) return;
  const t = ctx.texts[v];
  if (t === undefined) c.err(path, 'ref-text', `없는 텍스트 ID: ${v}`);
  else if (!textFits(t)) c.err(path, 'text-long', `말풍선 한계(${LINE_MAX}자×${LINES_MAX}줄) 초과: ${v}`);
}

/**
 * `content/characters.json` 검사: 힌트 대사는 화자 = 캐릭터, 키 = 능력, 값 = 텍스트 ID.
 * 힌트 ②(ADR-0018 F3)는 지금 캐릭터 자기 능력이면 띄우지 않으니, 캐릭터마다 **남의 능력 전부**의
 * 힌트가 있어야 한다(없으면 힌트가 조용히 안 뜬다). 자기 능력 키는 쓰이지 않아 경고(ADR-0065 116행).
 */
export function validateCharacters(raw: unknown, ctx: ValidateContext): ValidationResult {
  const c = new Checker();
  if (c.obj(raw, 'characters', CHARACTERS_KEYS)) {
    for (const field of ['fallbacks', 'hints'] as const) {
      if (raw[field] === undefined) continue;
      for (const [who, m, p] of c.idMap(raw[field], field)) {
        if (!(CHAR_IDS as readonly string[]).includes(who)) c.err(p, 'ref-char', `없는 캐릭터: ${who}`);
        const keys: readonly string[] = field === 'hints' ? ABILITIES : VERBS;
        for (const [k, v, kp] of c.idMap(m, p)) {
          if (!keys.includes(k)) c.err(kp, 'schema', `여기에 올 수 없는 동사: ${k}`);
          if (field === 'hints') checkTextRef(c, ctx, v, kp);
          else if (c.obj(v, kp, ['show'])) {
            // 공통 실패 리액션: 행동한 캐릭터가 화자라 `self`·캐릭터만. 자리 정보가 없으니 `@자리`는 못 쓴다.
            showList(c, ctx, v.show, `${kp}.show`, { spots: new Set(), targets: new Set(), hotspots: new Set(), self: true });
          }
        }
      }
    }
    const hints = isObj(raw.hints) ? raw.hints : {};
    for (const ch of CHARACTERS) {
      const m = isObj(hints[ch.id]) ? (hints[ch.id] as Obj) : {};
      for (const ab of ABILITIES) {
        const p = `hints.${ch.id}.${ab}`;
        if (ab === ch.ability) {
          if (m[ab] !== undefined) c.warn(p, 'hint-own-ability', `자기 능력 힌트는 띄우지 않는다(ADR-0065 4절 hintAbility): ${ab}`);
        } else if (m[ab] === undefined) {
          c.err(p, 'hint-missing', `${ch.id}의 ${ab} 힌트 대사가 없다. 이 대상에서 힌트 ②가 안 뜬다(ADR-0018 F3)`);
        }
      }
    }
  }
  return { errors: c.errors, warnings: c.warnings };
}

interface ShowScope {
  spots: ReadonlySet<string>;
  /** `anim`·`fx` 대상으로 쓸 수 있는 핫스팟·서는 자리 ID. */
  targets: ReadonlySet<string>;
  /** `say` 화자로 쓸 수 있는 핫스팟 ID(관리인·손님처럼 사람이 아닌 화자, #380). 서는 자리 ID는 화자가 아니다. */
  hotspots: ReadonlySet<string>;
  /** `self`를 쓸 수 있나(행동한 캐릭터가 있는 연출). `onEnter`는 없다. */
  self: boolean;
}

/**
 * 화자·대상: 캐릭터 ID, `self`, `@자리`. `anim`·`fx`는 핫스팟·서는 자리도 된다.
 * `say` 화자는 핫스팟까지만 된다(ADR-0065 5절 2026-11-19 개정, #380). 말풍선은 핫스팟 상자에 붙는다(`main.ts` `speakerBox`).
 */
function checkActorRef(c: Checker, v: unknown, path: string, scope: ShowScope, allowTargets: boolean): void {
  if (typeof v !== 'string') {
    c.err(path, 'schema', '문자열이어야 한다');
    return;
  }
  if (v === 'self') {
    if (!scope.self) c.err(path, 'ref-self', '여기서는 행동한 캐릭터가 없어 self를 쓸 수 없다');
    return;
  }
  if (v.startsWith('@')) {
    if (!scope.spots.has(v.slice(1))) c.err(path, 'ref-spot', `없는 자리: ${v}`);
    return;
  }
  if ((CHAR_IDS as readonly string[]).includes(v)) return;
  if (allowTargets && scope.targets.has(v)) return;
  if (!allowTargets && scope.hotspots.has(v)) return;
  c.err(path, 'ref-actor', `없는 ${allowTargets ? '대상' : '화자'}: ${v}`);
}

/**
 * 효과 위치 표시 `{ "do": "here" }`(ADR-0065 5절, #206)를 쓸 수 있는 연출인지. 규칙 `show`만 넘긴다.
 * `effect`는 그 규칙의 `do`(검사 전 원본)다.
 */
interface DoHereScope {
  effect: unknown;
}

/** 이벤트를 내는 효과 키. `set`은 이벤트가 없어서 표시를 옮겨도 아무것도 안 바뀐다. */
const EVENT_EFFECT_KEYS = ['give', 'take', 'move', 'gauge'] as const satisfies readonly (keyof Effect)[];

function showList(c: Checker, ctx: ValidateContext, raw: unknown, path: string, scope: ShowScope, doHere?: DoHereScope): void {
  if (raw === undefined) return;
  let marked: string | undefined;
  c.arr(raw, path).forEach((item, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(item) || Object.keys(item).filter((k) => k !== 'note').length !== 1) {
      c.err(p, 'schema', '연출 한 줄은 anim·say·fx 중 하나만 가진 객체');
      return;
    }
    const [kind] = Object.keys(item).filter((k) => k !== 'note');
    const v = item[kind as string];
    if (kind === 'do') {
      if (!doHere) c.err(`${p}.do`, 'do-here', '효과 위치 표시 { "do": "here" }는 규칙(rules[].show)에서만 쓸 수 있다');
      else if (v !== 'here') c.err(`${p}.do`, 'schema', '효과 위치 표시 값은 "here"만');
      else if (marked !== undefined) c.err(p, 'do-here', `효과 위치 표시는 한 번만(먼저 ${marked})`);
      else if (doHere.effect === undefined) c.err(p, 'do-here', '이 규칙에는 do가 없어 옮길 효과 이벤트가 없다');
      else if (isObj(doHere.effect) && !EVENT_EFFECT_KEYS.some((k) => (doHere.effect as Obj)[k] !== undefined)) {
        c.warn(p, 'do-here-noop', 'do에 이벤트를 내는 효과(give·take·move·gauge)가 없어 표시가 아무것도 바꾸지 않는다');
      }
      marked ??= p;
      return;
    }
    if (!Array.isArray(v) || v.length !== 2) {
      c.err(`${p}.${kind}`, 'schema', '[대상, 값] 2개 배열');
      return;
    }
    if (kind === 'say') {
      checkActorRef(c, v[0], `${p}.say[0]`, scope, false);
      const texts: unknown[] = Array.isArray(v[1]) ? v[1] : [v[1]];
      if (texts.length === 0) c.err(`${p}.say[1]`, 'schema', '텍스트 배열이 비었다');
      texts.forEach((t, j) => checkTextRef(c, ctx, t, Array.isArray(v[1]) ? `${p}.say[1][${j}]` : `${p}.say[1]`));
    } else if (kind === 'anim') {
      checkActorRef(c, v[0], `${p}.anim[0]`, scope, true);
      c.id(v[1], `${p}.anim[1]`);
    } else if (kind === 'fx') {
      c.id(v[0], `${p}.fx[0]`);
      checkActorRef(c, v[1], `${p}.fx[1]`, scope, true);
    } else {
      c.err(`${p}.${kind}`, 'unknown-key', `모르는 연출: ${kind}`);
    }
  });
}

/**
 * 화면 하나 검사. `ScreenData`로 써도 되는지(엔진·BFS가 예외 없이 돌 수 있는지)를 본다.
 * errors가 비어 있을 때만 `as ScreenData`로 쓴다.
 */
export function validateScreen(raw: unknown, ctx: ValidateContext): ValidationResult {
  const c = new Checker();
  const done = (): ValidationResult => ({ errors: c.errors, warnings: c.warnings });
  if (!c.obj(raw, 'screen', SCREEN_KEYS)) return done();
  for (const k of ['id', 'spots', 'hotspots', 'flags', 'start', 'exitFlag', 'rules']) {
    if (raw[k] === undefined) c.err(k, 'schema', `필수 필드 없음: ${k}`);
  }
  c.id(raw.id, 'id');

  // --- 선언: 서는 자리, 핫스팟, 플래그 ---
  const spotEntries = c.idMap(raw.spots, 'spots');
  const hotspotEntries = c.idMap(raw.hotspots, 'hotspots');
  const spots = new Map(spotEntries.flatMap(([k, v]): [string, Obj][] => (isObj(v) ? [[k, v]] : [])));
  const spotIds = new Set(spotEntries.map(([k]) => k));
  const targetIds = new Set([...spotIds, ...hotspotEntries.map(([k]) => k)]);
  const flagIds = new Set<string>();
  for (const [k, v, p] of c.idMap(raw.flags, 'flags')) {
    c.bool(v, p);
    flagIds.add(k);
  }
  for (const [k, , p] of hotspotEntries) {
    if (spotIds.has(k)) c.err(p, 'dup-id', `핫스팟과 서는 자리 ID가 같다(같은 이름공간): ${k}`);
  }
  if (spotIds.has(STAY)) c.err(`spots.${STAY}`, 'reserved', `\`${STAY}\`는 예약어라 자리 ID로 못 쓴다`);
  // 화자·대상 이름은 캐릭터 ID·`self`를 먼저 찾는다(`checkActorRef`, `step` `resolveWho`). 같은 ID면 조용히 캐릭터에게 간다(#438).
  for (const [k, , p] of [...spotEntries, ...hotspotEntries]) {
    if (k === 'self' || (CHAR_IDS as readonly string[]).includes(k)) c.err(p, 'reserved', `\`${k}\`는 캐릭터 ID·self라 자리·핫스팟 ID로 못 쓴다`);
  }

  const isHold = (id: string): boolean => spots.get(id)?.hold === true;
  const isFree = (id: string): boolean => spots.get(id)?.free === true;
  const hotspotIds = new Set(hotspotEntries.map(([k]) => k));
  const scope = (self: boolean): ShowScope => ({ spots: spotIds, targets: targetIds, hotspots: hotspotIds, self });

  const spotRef = (v: unknown, path: string): v is string => {
    if (typeof v !== 'string' || !spotIds.has(v)) {
      c.err(path, 'ref-spot', `없는 자리: ${JSON.stringify(v)}`);
      return false;
    }
    return true;
  };
  const flagRef = (v: string, path: string): void => {
    if (!flagIds.has(v)) c.err(path, 'ref-flag', `선언 안 된 플래그: ${v}`);
  };
  const flagMap = (v: unknown, path: string): void => {
    for (const [k, x, p] of c.idMap(v, path)) {
      flagRef(k, p);
      c.bool(x, p);
    }
  };
  const charRef = (v: unknown, path: string, allowSelf: boolean): void => {
    if (allowSelf && v === 'self') return;
    if (!(CHAR_IDS as readonly unknown[]).includes(v)) c.err(path, 'ref-char', `없는 캐릭터: ${JSON.stringify(v)}`);
  };
  /** 쓰인 hintAbility [경로, 능력, 대상]. 규칙을 다 읽은 뒤 그 능력이 그 대상으로 이어지는지 본다. */
  const hintUses: [string, string, string][] = [];
  const ability = (v: unknown, path: string, target: string): void => {
    if (!(ABILITIES as readonly unknown[]).includes(v)) c.err(path, 'hint-ability', `hintAbility는 능력 동사(${ABILITIES.join('/')})`);
    else hintUses.push([path, v as string, target]);
  };
  /** 점 [x, y]가 화면 안인지(오류), HUD·목표 줄 자리와 겹치는지(경고). 서는 자리 x, y와 releasePoint·board에 쓴다. */
  const point = (x: number, y: number, path: string): boolean => {
    if (x < 0 || y < 0 || x > SCREEN_W || y > SCREEN_H) {
      c.err(path, 'point-offscreen', `좌표 (${x}, ${y})가 화면(${SCREEN_W}×${SCREEN_H}) 밖이다`);
      return false;
    }
    if (rectHas(HUD_BOX, x, y)) c.warn(path, 'hud-overlap', 'HUD 영역 안이다(ui-interaction.md 6절)');
    if (rectHas(GOAL_BOX, x, y)) c.warn(path, 'goal-overlap', '목표 줄 자리 안이다(ui-interaction.md 6-2-2절)');
    return true;
  };
  /** 바닥에 설 점 [x, y](releasePoint, board): 모양, 화면 안, 걷기 영역 안. 영역 밖이면 `areaCode` 오류. */
  const floorPoint = (v: unknown, path: string, key: string, areaCode: string): void => {
    if (!(Array.isArray(v) && v.length === 2 && v.every(isNum))) return c.err(path, 'schema', `${key}는 [x, y]`);
    const [x, y] = v as [number, number];
    if (point(x, y, path) && (x < WALK_AREA.left || x > WALK_AREA.right || y < WALK_AREA.top || y > WALK_AREA.bottom)) {
      c.err(path, areaCode, `${key} (${x}, ${y})가 걷기 영역 밖이다(x ${WALK_AREA.left}~${WALK_AREA.right}, y ${WALK_AREA.top}~${WALK_AREA.bottom})`);
    }
  };
  /** 걸어갈 자리: 있는 자리거나 `stay`. `hold` 자리는 걸어서 못 가니(`goTo` invalid) `step`이 예외를 던진다. */
  const approachDest = (v: unknown, path: string): void => {
    if (v === STAY) return;
    if (spotRef(v, path) && isHold(v)) c.err(path, 'approach-hold', `approach가 hold 자리를 가리킨다(걸어서 못 감): ${v}`);
  };
  /** `allowFrom`: 바깥 맵만 `from`(지금 선 자리별 예외, #688)을 가질 수 있다. `from` 안은 자리 ID·`stay` 또는 동사별 맵. */
  const approach = (v: unknown, path: string, allowFrom = true): void => {
    if (v === undefined) return;
    if (typeof v === 'string') return approachDest(v, path);
    if (!isObj(v)) return c.err(path, 'schema', 'approach는 자리 ID 또는 동사별 맵');
    for (const [k, x] of Object.entries(v)) {
      const kp = keyPath(path, k);
      if (k === 'from' && allowFrom) {
        if (!isObj(x)) {
          c.err(kp, 'schema', 'approach.from은 {지금 선 자리: 자리 ID·stay 또는 동사별 맵}');
          continue;
        }
        for (const [at, y] of Object.entries(x)) {
          const ap = keyPath(kp, at);
          if (!spotRef(at, ap)) continue;
          // `hold` 자리에서 하는 행동은 손 놓기가 먼저라(5절 1단계) approach까지 안 온다.
          if (isHold(at)) c.warn(ap, 'approach-unused', `hold 자리(${at})에 선 사람의 행동은 approach를 쓰지 않는다(ADR-0065 5절 1단계)`);
          approach(y, ap, false);
        }
        continue;
      }
      if (k !== 'default' && !(VERBS as readonly string[]).includes(k)) {
        c.err(kp, 'approach-verb', `approach 맵의 키는 동사나 default${allowFrom ? '·from' : ''}: ${k}`);
        continue;
      }
      if (k === 'move' || k === 'look') c.warn(kp, 'approach-unused', `${k}는 approach를 쓰지 않는다(ADR-0065 5절 2단계)`);
      approachDest(x, kp);
    }
  };

  // --- 서는 자리 ---
  const floor = spots.get(FLOOR);
  if (!floor) c.err(`spots.${FLOOR}`, 'floor', `\`${FLOOR}\` 자리가 없다(화면마다 하나, free: true)`);
  else if (floor.free !== true) c.err(`spots.${FLOOR}.free`, 'floor', `\`${FLOOR}\`는 free: true여야 한다`);
  for (const [sid, s, p] of spotEntries) {
    if (!c.obj(s, p, SPOT_KEYS)) continue;
    if (!isNum(s.x) || !isNum(s.y)) c.err(p, 'schema', 'x, y는 숫자');
    else point(s.x, s.y, p);
    if (s.free !== undefined) c.bool(s.free, `${p}.free`);
    if (s.hold !== undefined) c.bool(s.hold, `${p}.hold`);
    if (s.capacity !== undefined && (!isInt(s.capacity) || s.capacity < 1)) c.err(`${p}.capacity`, 'schema', 'capacity는 1 이상 정수');
    if (s.box !== undefined) c.box(s.box, `${p}.box`);
    if (s.hold === true) {
      if (s.free === true) c.err(p, 'hold-free', 'hold 자리는 free일 수 없다');
      if (s.releaseTo === undefined) c.err(`${p}.releaseTo`, 'hold-release', 'hold 자리는 releaseTo가 필수');
      else if (spotRef(s.releaseTo, `${p}.releaseTo`) && !isFree(s.releaseTo)) {
        c.err(`${p}.releaseTo`, 'hold-release', `releaseTo는 free: true 자리여야 한다: ${s.releaseTo}`);
      }
      // 손 놓으면 releaseTo(free 자리 = 바닥)에 그 점으로 떨어지고, 거기서 다시 걷는다. 바닥 영역 밖이면
      // 다음 걷기 첫 틱에 영역 안으로 튄다(scene.ts clampToArea).
      if (s.releasePoint !== undefined) floorPoint(s.releasePoint, `${p}.releasePoint`, 'releasePoint', 'release-point-area');
    } else {
      for (const k of ['releaseTo', 'releasePoint', 'releaseShow']) if (s[k] !== undefined) c.err(`${p}.${k}`, 'schema', `${k}는 hold 자리에만`);
    }
    // 오르내릴 바닥 점(#397): 걸어서 가는 높은 자리에만 뜻이 있다. 바닥(free)은 이미 바닥이고, hold는 걸어서 못 간다.
    if (s.board !== undefined) {
      if (s.free === true || s.hold === true) c.err(`${p}.board`, 'schema', 'board는 free·hold가 아닌 자리에만');
      else floorPoint(s.board, `${p}.board`, 'board', 'board-area');
    }
    if (s.releaseShow !== undefined) {
      for (const [k, list, kp] of c.idMap(s.releaseShow, `${p}.releaseShow`)) {
        if (k !== 'default') charRef(k, kp, false);
        showList(c, ctx, list, kp, scope(true));
      }
    }
    showList(c, ctx, s.takenShow, `${p}.takenShow`, scope(true));
    approach(s.approach, `${p}.approach`);
    if (s.hintAbility !== undefined) ability(s.hintAbility, `${p}.hintAbility`, sid);
  }

  // --- 핫스팟 ---
  for (const [hid, h, p] of hotspotEntries) {
    if (!c.obj(h, p, HOTSPOT_KEYS)) continue;
    c.box(h.box, `${p}.box`);
    approach(h.approach, `${p}.approach`);
    if (h.hintAbility !== undefined) ability(h.hintAbility, `${p}.hintAbility`, hid);
    if (h.reachPoint !== undefined && !(Array.isArray(h.reachPoint) && h.reachPoint.length === 2 && h.reachPoint.every(isNum))) {
      c.err(`${p}.reachPoint`, 'schema', 'reachPoint는 [x, y]');
    }
    if (h.variants !== undefined) {
      c.arr(h.variants, `${p}.variants`).forEach((v, i) => {
        const vp = `${p}.variants[${i}]`;
        if (!c.obj(v, vp, VARIANT_KEYS)) return;
        if (c.obj(v.when, `${vp}.when`, ['flags'])) flagMap(v.when.flags, `${vp}.when.flags`);
        if (v.box !== undefined) c.box(v.box, `${vp}.box`);
        approach(v.approach, `${vp}.approach`);
      });
    }
  }

  // --- 아이템: 선언 목록이 없으니 start.items + 규칙 give가 "있는 아이템"이다 ---
  const itemIds = new Set<string>();
  const ruleList = c.arr(raw.rules, 'rules');
  const collectItems = (v: unknown, path: string): void => {
    c.arr(v, path).forEach((x, i) => {
      if (c.id(x, `${path}[${i}]`)) itemIds.add(x);
    });
  };
  ruleList.forEach((r, i) => {
    if (isObj(r) && isObj(r.do) && r.do.give !== undefined) collectItems(r.do.give, `rules[${i}].do.give`);
  });
  const itemRef = (v: unknown, path: string): void => {
    if (!c.id(v, path)) return;
    if (!itemIds.has(v)) c.err(path, 'ref-item', `어디서도 얻을 수 없는 아이템: ${v}`);
  };

  // --- 시작 상태, 출구 ---
  if (c.obj(raw.start, 'start', START_KEYS)) {
    const start = raw.start;
    if (start.items !== undefined) collectItems(start.items, 'start.items');
    else c.err('start.items', 'schema', '필수 필드 없음: items');
    if (c.obj(start.at, 'start.at', CHAR_IDS)) {
      const count = new Map<string, number>();
      for (const ch of CHAR_IDS) {
        const v = start.at[ch];
        if (v === undefined) {
          c.err(`start.at.${ch}`, 'schema', `시작 자리 없음: ${ch}`);
          continue;
        }
        if (!spotRef(v, `start.at.${ch}`)) continue;
        if (isHold(v)) c.err(`start.at.${ch}`, 'start-hold', 'hold 자리에서 시작할 수 없다');
        count.set(v, (count.get(v) ?? 0) + 1);
      }
      for (const [id, n] of count) {
        const s = spots.get(id);
        const cap = s?.free === true ? Infinity : isInt(s?.capacity) ? s.capacity : 1;
        if (n > cap) c.err(`start.at`, 'capacity', `시작 상태가 정원을 넘는다: ${id} ${n}/${cap}`);
      }
    }
  }
  if (typeof raw.exitFlag === 'string') {
    flagRef(raw.exitFlag, 'exitFlag');
    if (isObj(raw.flags) && raw.flags[raw.exitFlag] === true) c.err('exitFlag', 'exit-initial', 'exitFlag가 처음부터 true라 클리어가 안 난다');
  } else c.err('exitFlag', 'schema', 'exitFlag는 플래그 ID');
  showList(c, ctx, raw.onEnter, 'onEnter', scope(false));

  // --- 규칙 ---
  const ruleIds = new Set<string>();
  ruleList.forEach((r, i) => {
    const p = `rules[${i}]`;
    if (!c.obj(r, p, RULE_KEYS)) return;
    if (c.id(r.id, `${p}.id`)) {
      if (ruleIds.has(r.id)) c.err(`${p}.id`, 'dup-id', `규칙 ID 중복: ${r.id}`);
      ruleIds.add(r.id);
    }
    const verbOk = (VERBS as readonly unknown[]).includes(r.verb);
    if (!verbOk) c.err(`${p}.verb`, 'schema', `모르는 동사: ${JSON.stringify(r.verb)}`);
    if (typeof r.target !== 'string' || !targetIds.has(r.target)) c.err(`${p}.target`, 'ref-target', `없는 대상: ${JSON.stringify(r.target)}`);
    else if (r.verb === 'move' && !spotIds.has(r.target)) c.err(`${p}.target`, 'move-target', 'move 규칙의 대상은 서는 자리여야 한다');
    else if (r.verb === 'move' && isHold(r.target)) {
      // UI는 hold 자리 탭을 move로 만들지 않는다(기본 탭 = 능력, #115). BFS는 이 간선을 봐서 "BFS로는 풀리는데 UI로는 못 푸는" 화면이 된다.
      c.err(`${p}.target`, 'move-hold', `hold 자리에는 move 규칙을 둘 수 없다(UI가 만들지 않는 행동): ${r.target}`);
    }

    if (r.when !== undefined && c.obj(r.when, `${p}.when`, COND_KEYS)) {
      const w = r.when;
      const wp = `${p}.when`;
      if (w.who !== undefined) c.arr(w.who, `${wp}.who`).forEach((x, j) => charRef(x, `${wp}.who[${j}]`, false));
      if (w.at !== undefined) c.arr(w.at, `${wp}.at`).forEach((x, j) => spotRef(x, `${wp}.at[${j}]`));
      if (w.flags !== undefined) flagMap(w.flags, `${wp}.flags`);
      for (const k of ['has', 'lacks'] as const) {
        if (w[k] !== undefined) c.arr(w[k], `${wp}.${k}`).forEach((x, j) => itemRef(x, `${wp}.${k}[${j}]`));
      }
      if (w.item !== undefined) {
        itemRef(w.item, `${wp}.item`);
        if (r.verb !== 'item') c.err(`${wp}.item`, 'schema', 'when.item은 verb가 item인 규칙에만');
      }
      if (w.occupied !== undefined) {
        for (const [k, x, kp] of c.idMap(w.occupied, `${wp}.occupied`)) {
          spotRef(k, kp);
          c.bool(x, kp);
        }
      }
    }

    if (r.do !== undefined && c.obj(r.do, `${p}.do`, EFFECT_KEYS)) {
      const d = r.do;
      const dp = `${p}.do`;
      if (d.set !== undefined) flagMap(d.set, `${dp}.set`);
      if (d.take !== undefined) c.arr(d.take, `${dp}.take`).forEach((x, j) => itemRef(x, `${dp}.take[${j}]`));
      if (d.gauge !== undefined && !isInt(d.gauge)) c.err(`${dp}.gauge`, 'schema', 'gauge는 정수');
      if (d.move !== undefined) {
        c.arr(d.move, `${dp}.move`).forEach((m, j) => {
          const mp = `${dp}.move[${j}]`;
          if (!isObj(m)) return c.err(mp, 'schema', '{who, to} 또는 {from, to}');
          const keys = Object.keys(m).filter((k) => k !== 'note' && k !== 'via').sort().join(',');
          if (keys !== 'to,who' && keys !== 'from,to') return c.err(mp, 'schema', '{who, to} 또는 {from, to} (+via)');
          if ('who' in m) charRef(m.who, `${mp}.who`, true);
          else spotRef(m.from, `${mp}.from`);
          spotRef(m.to, `${mp}.to`);
          // via: 그 hold 자리의 releasePoint로 떨어진다. 손 놓기와 같은 곳(releaseTo)으로 가는 move에만 뜻이 있다.
          if (m.via !== undefined && spotRef(m.via, `${mp}.via`)) {
            const v = spots.get(m.via as string);
            if (v?.hold !== true || v.releasePoint === undefined) c.err(`${mp}.via`, 'move-via', `via는 releasePoint가 있는 hold 자리여야 한다: ${m.via}`);
            else if (v.releaseTo !== m.to) c.err(`${mp}.via`, 'move-via', `via 자리의 releaseTo(${v.releaseTo})와 to(${m.to})가 다르다`);
          }
        });
      }
    }
    showList(c, ctx, r.show, `${p}.show`, scope(true), { effect: r.do });
  });

  // --- 대상 T의 hintAbility A가 T로 이어지는지 (#229) ---
  // 통과: ① verb A, target T인 규칙이 있다 ② verb A 규칙의 do.move가 누군가를 T로 보낸다(to 또는 via).
  // 화면 1 `hook`의 hintAbility는 stomp고, stomp 규칙(seesaw_launch)이 시소에서 hook으로 보낸다(②).
  // "A가 세운 플래그가 T 규칙의 조건"(③)은 넣지 않는다. 대부분 통과해서 다시 느슨해진다. 화면 2에서 실제로 필요하면 더한다.
  const hintReach = new Map<unknown, Set<unknown>>();
  for (const r of ruleList) {
    if (!isObj(r)) continue;
    const reach = hintReach.get(r.verb) ?? new Set<unknown>();
    hintReach.set(r.verb, reach);
    reach.add(r.target);
    if (isObj(r.do) && Array.isArray(r.do.move)) {
      for (const m of r.do.move) {
        if (!isObj(m)) continue;
        reach.add(m.to);
        if (m.via !== undefined) reach.add(m.via);
      }
    }
  }
  for (const [path, ab, target] of hintUses) {
    if (!hintReach.get(ab)?.has(target)) {
      c.warn(path, 'hint-ability-unused', `${ab} 규칙 중 ${target}를 대상으로 하거나 ${target}로 보내는 것이 없다. 힌트가 헛다리를 짚게 한다`);
    }
  }

  // --- 폴백 ①: 상태를 바꾸지 않는다. gauge만 예외 ---
  if (raw.fallbacks !== undefined) {
    for (const [t, m, p] of c.idMap(raw.fallbacks, 'fallbacks')) {
      if (!targetIds.has(t)) c.err(p, 'ref-target', `없는 대상: ${t}`);
      for (const [verb, fb, fp] of c.idMap(m, p)) {
        if (!(VERBS as readonly string[]).includes(verb)) c.err(fp, 'schema', `모르는 동사: ${verb}`);
        if (!c.obj(fb, fp, ['do', 'show'])) continue;
        if (fb.do !== undefined && c.obj(fb.do, `${fp}.do`, ['gauge']) && fb.do.gauge !== undefined && !isInt(fb.do.gauge)) {
          c.err(`${fp}.do.gauge`, 'schema', 'gauge는 정수');
        }
        showList(c, ctx, fb.show, `${fp}.show`, scope(true));
      }
    }
  }

  // --- solution: 모양과 참조만. 실제 재생은 tests/playthrough ---
  if (raw.solution !== undefined) {
    c.arr(raw.solution, 'solution').forEach((a, i) => {
      const p = `solution[${i}]`;
      if (!c.obj(a, p, ACTION_KEYS)) return;
      charRef(a.char, `${p}.char`, false);
      if (!(VERBS as readonly unknown[]).includes(a.verb)) c.err(`${p}.verb`, 'schema', `모르는 동사: ${JSON.stringify(a.verb)}`);
      if (typeof a.target !== 'string' || !targetIds.has(a.target)) c.err(`${p}.target`, 'ref-target', `없는 대상: ${JSON.stringify(a.target)}`);
      if (a.verb === 'item') itemRef(a.item, `${p}.item`);
      else if (a.item !== undefined) c.err(`${p}.item`, 'schema', 'item은 verb가 item일 때만');
      const def = CHARACTERS.find((ch) => ch.id === a.char);
      if (def && (ABILITIES as readonly unknown[]).includes(a.verb) && def.ability !== (a.verb as Verb)) {
        c.err(`${p}.verb`, 'ability', `${a.char}의 능력이 아니다: ${String(a.verb)}`);
      }
    });
  }

  return done();
}
