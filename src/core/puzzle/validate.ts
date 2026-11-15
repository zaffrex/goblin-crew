// 퍼즐 콘텐츠 검사 (ADR-0065 1절·8절 판정표 첫 줄). 의존성 없이 직접 검사한다.
// 입력은 JSON.parse 결과(unknown)다. 타입이 맞는다고 가정하지 않고 모양부터 본다.
// 실패(error)는 콘텐츠 테스트를 깨고, 경고(warning)는 출력만 한다(ADR-0018 실패/경고 구분).
// 상태 그래프가 필요한 검사(정답 도달, S3, 필수 능력, 정원 초과 경로)는 bfs.ts(#67) 몫이다.

import { CHARACTERS } from '../characters';
import { FLOOR, STAY, VERBS, type AbilityVerb, type CharacterId, type Verb } from './types';

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
export const HUD_BOX: readonly [number, number, number, number] = [300, 4, 176, 60];

const CHAR_IDS: readonly CharacterId[] = CHARACTERS.map((c) => c.id);
const ABILITIES: readonly AbilityVerb[] = CHARACTERS.map((c) => c.ability);

const SCREEN_KEYS = ['id', 'spots', 'hotspots', 'flags', 'start', 'exitFlag', 'onEnter', 'rules', 'fallbacks', 'solution'];
const SPOT_KEYS = ['x', 'y', 'free', 'capacity', 'box', 'hold', 'releaseTo', 'releaseShow', 'takenShow', 'approach', 'hintAbility'];
const HOTSPOT_KEYS = ['box', 'approach', 'variants', 'hintAbility', 'reachPoint'];
const VARIANT_KEYS = ['when', 'box', 'approach'];
const RULE_KEYS = ['id', 'target', 'verb', 'when', 'do', 'show'];
const COND_KEYS = ['who', 'at', 'flags', 'has', 'lacks', 'item', 'occupied'];
const EFFECT_KEYS = ['set', 'give', 'take', 'move', 'gauge'];
const ACTION_KEYS = ['char', 'verb', 'target', 'item'];

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
      if (k !== 'note' && !keys.includes(k)) this.err(`${path}.${k}`, 'unknown-key', `모르는 필드: ${k}`);
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

  /** 키가 ID인 맵. 키 문법을 검사하고 [키, 값] 목록을 돌려준다. */
  idMap(v: unknown, path: string): [string, unknown][] {
    if (!isObj(v)) {
      this.err(path, 'schema', '객체여야 한다');
      return [];
    }
    const out: [string, unknown][] = [];
    for (const [k, x] of Object.entries(v)) {
      if (this.id(k, `${path}.${k}`)) out.push([k, x]);
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
    const [hx, hy, hw, hh] = HUD_BOX;
    if (x < hx + hw && x + w > hx && y < hy + hh && y + h > hy) {
      this.warn(path, 'hud-overlap', 'HUD 영역과 겹친다(ui-interaction.md 6절)');
    }
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
  for (const [k, v] of c.idMap(raw, 'texts')) {
    if (typeof v !== 'string') c.err(`texts.${k}`, 'schema', '문자열이어야 한다');
  }
  return { errors: c.errors, warnings: c.warnings };
}

function checkTextRef(c: Checker, ctx: ValidateContext, v: unknown, path: string): void {
  if (!c.id(v, path)) return;
  const t = ctx.texts[v];
  if (t === undefined) c.err(path, 'ref-text', `없는 텍스트 ID: ${v}`);
  else if (!textFits(t)) c.err(path, 'text-long', `말풍선 한계(${LINE_MAX}자×${LINES_MAX}줄) 초과: ${v}`);
}

/** `content/characters.json` 검사: 힌트 대사는 화자 = 캐릭터, 키 = 능력, 값 = 텍스트 ID. */
export function validateCharacters(raw: unknown, ctx: ValidateContext): ValidationResult {
  const c = new Checker();
  if (c.obj(raw, 'characters', ['fallbacks', 'hints'])) {
    for (const field of ['fallbacks', 'hints'] as const) {
      if (raw[field] === undefined) continue;
      for (const [who, m] of c.idMap(raw[field], field)) {
        const p = `${field}.${who}`;
        if (!(CHAR_IDS as readonly string[]).includes(who)) c.err(p, 'ref-char', `없는 캐릭터: ${who}`);
        const keys: readonly string[] = field === 'hints' ? ABILITIES : VERBS;
        for (const [k, v] of c.idMap(m, p)) {
          if (!keys.includes(k)) c.err(`${p}.${k}`, 'schema', `여기에 올 수 없는 동사: ${k}`);
          if (field === 'hints') checkTextRef(c, ctx, v, `${p}.${k}`);
          else if (c.obj(v, `${p}.${k}`, ['show'])) {
            // 공통 실패 리액션: 행동한 캐릭터가 화자라 `self`·캐릭터만. 자리 정보가 없으니 `@자리`는 못 쓴다.
            showList(c, ctx, v.show, `${p}.${k}.show`, { spots: new Set(), targets: new Set(), self: true });
          }
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
  /** `self`를 쓸 수 있나(행동한 캐릭터가 있는 연출). `onEnter`는 없다. */
  self: boolean;
}

/** 화자·대상: 캐릭터 ID, `self`, `@자리`. `anim`·`fx`는 핫스팟·서는 자리도 된다. */
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
  c.err(path, 'ref-actor', `없는 ${allowTargets ? '대상' : '화자'}: ${v}`);
}

function showList(c: Checker, ctx: ValidateContext, raw: unknown, path: string, scope: ShowScope): void {
  if (raw === undefined) return;
  c.arr(raw, path).forEach((item, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(item) || Object.keys(item).filter((k) => k !== 'note').length !== 1) {
      c.err(p, 'schema', '연출 한 줄은 anim·say·fx 중 하나만 가진 객체');
      return;
    }
    const [kind] = Object.keys(item).filter((k) => k !== 'note');
    const v = item[kind as string];
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
  const spots = new Map(spotEntries.filter((e): e is [string, Obj] => isObj(e[1])));
  const spotIds = new Set(spotEntries.map(([k]) => k));
  const targetIds = new Set([...spotIds, ...hotspotEntries.map(([k]) => k)]);
  const flagIds = new Set<string>();
  for (const [k, v] of c.idMap(raw.flags, 'flags')) {
    c.bool(v, `flags.${k}`);
    flagIds.add(k);
  }
  for (const [k] of hotspotEntries) {
    if (spotIds.has(k)) c.err(`hotspots.${k}`, 'dup-id', `핫스팟과 서는 자리 ID가 같다(같은 이름공간): ${k}`);
  }
  if (spotIds.has(STAY)) c.err(`spots.${STAY}`, 'reserved', `\`${STAY}\`는 예약어라 자리 ID로 못 쓴다`);

  const isHold = (id: string): boolean => spots.get(id)?.hold === true;
  const isFree = (id: string): boolean => spots.get(id)?.free === true;
  const scope = (self: boolean): ShowScope => ({ spots: spotIds, targets: targetIds, self });

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
    for (const [k, x] of c.idMap(v, path)) {
      flagRef(k, `${path}.${k}`);
      c.bool(x, `${path}.${k}`);
    }
  };
  const charRef = (v: unknown, path: string, allowSelf: boolean): void => {
    if (allowSelf && v === 'self') return;
    if (!(CHAR_IDS as readonly unknown[]).includes(v)) c.err(path, 'ref-char', `없는 캐릭터: ${JSON.stringify(v)}`);
  };
  const ability = (v: unknown, path: string): void => {
    if (!(ABILITIES as readonly unknown[]).includes(v)) c.err(path, 'hint-ability', `hintAbility는 능력 동사(${ABILITIES.join('/')})`);
  };
  /** 걸어갈 자리: 있는 자리거나 `stay`. `hold` 자리는 걸어서 못 가니(`goTo` invalid) `step`이 예외를 던진다. */
  const approachDest = (v: unknown, path: string): void => {
    if (v === STAY) return;
    if (spotRef(v, path) && isHold(v)) c.err(path, 'approach-hold', `approach가 hold 자리를 가리킨다(걸어서 못 감): ${v}`);
  };
  const approach = (v: unknown, path: string): void => {
    if (v === undefined) return;
    if (typeof v === 'string') return approachDest(v, path);
    if (!isObj(v)) return c.err(path, 'schema', 'approach는 자리 ID 또는 동사별 맵');
    for (const [k, x] of Object.entries(v)) {
      if (k !== 'default' && !(VERBS as readonly string[]).includes(k)) c.err(`${path}.${k}`, 'approach-verb', `approach 맵의 키는 동사나 default: ${k}`);
      if (k === 'move' || k === 'look') c.warn(`${path}.${k}`, 'approach-unused', `${k}는 approach를 쓰지 않는다(ADR-0065 5절 2단계)`);
      approachDest(x, `${path}.${k}`);
    }
  };

  // --- 서는 자리 ---
  const floor = spots.get(FLOOR);
  if (!floor) c.err(`spots.${FLOOR}`, 'floor', `\`${FLOOR}\` 자리가 없다(화면마다 하나, free: true)`);
  else if (floor.free !== true) c.err(`spots.${FLOOR}.free`, 'floor', `\`${FLOOR}\`는 free: true여야 한다`);
  for (const [id, s] of spotEntries) {
    const p = `spots.${id}`;
    if (!c.obj(s, p, SPOT_KEYS)) continue;
    if (!isNum(s.x) || !isNum(s.y)) c.err(p, 'schema', 'x, y는 숫자');
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
    } else {
      for (const k of ['releaseTo', 'releaseShow']) if (s[k] !== undefined) c.err(`${p}.${k}`, 'schema', `${k}는 hold 자리에만`);
    }
    if (s.releaseShow !== undefined) {
      for (const [k, list] of c.idMap(s.releaseShow, `${p}.releaseShow`)) {
        if (k !== 'default') charRef(k, `${p}.releaseShow.${k}`, false);
        showList(c, ctx, list, `${p}.releaseShow.${k}`, scope(true));
      }
    }
    showList(c, ctx, s.takenShow, `${p}.takenShow`, scope(true));
    approach(s.approach, `${p}.approach`);
    if (s.hintAbility !== undefined) ability(s.hintAbility, `${p}.hintAbility`);
  }

  // --- 핫스팟 ---
  for (const [id, h] of hotspotEntries) {
    const p = `hotspots.${id}`;
    if (!c.obj(h, p, HOTSPOT_KEYS)) continue;
    c.box(h.box, `${p}.box`);
    approach(h.approach, `${p}.approach`);
    if (h.hintAbility !== undefined) ability(h.hintAbility, `${p}.hintAbility`);
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
  if (c.obj(raw.start, 'start', ['at', 'items'])) {
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
        for (const [k, x] of c.idMap(w.occupied, `${wp}.occupied`)) {
          spotRef(k, `${wp}.occupied.${k}`);
          c.bool(x, `${wp}.occupied.${k}`);
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
          const keys = Object.keys(m).filter((k) => k !== 'note').sort().join(',');
          if (keys !== 'to,who' && keys !== 'from,to') return c.err(mp, 'schema', '{who, to} 또는 {from, to}');
          if ('who' in m) charRef(m.who, `${mp}.who`, true);
          else spotRef(m.from, `${mp}.from`);
          spotRef(m.to, `${mp}.to`);
        });
      }
    }
    showList(c, ctx, r.show, `${p}.show`, scope(true));
  });

  // --- 폴백 ①: 상태를 바꾸지 않는다. gauge만 예외 ---
  if (raw.fallbacks !== undefined) {
    for (const [t, m] of c.idMap(raw.fallbacks, 'fallbacks')) {
      const p = `fallbacks.${t}`;
      if (!targetIds.has(t)) c.err(p, 'ref-target', `없는 대상: ${t}`);
      for (const [verb, fb] of c.idMap(m, p)) {
        const fp = `${p}.${verb}`;
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
