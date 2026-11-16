// 화면 하나의 진행: 탭 → `step` → 이벤트 재생(busy) (docs/design/ui-interaction.md 5절, ADR-0065 6절).
// 순수 로직이다. DOM·Canvas를 모른다. 엔진(main.ts)은 sceneTap/sceneTick을 부르고 결과를 그리기만 한다.
// 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다(ADR-0004 결정 2). 화면 데이터는 상태에 넣지 않고 인자로 받는다.
//
// 엔진은 `step`이 돌려준 이벤트로만 반응한다(ADR-0065 5절). 퍼즐 상태를 들여다보고 연출을 추측하지 않는다.
// 예외: 바닥(`free`) 자리 캐릭터의 좌표는 퍼즐 상태에 없어서 엔진 걷기(walker)가 들고 있다.

import { CHARACTERS, characterHitBox, characterDef, type CharacterId } from './characters';
import { WALK_AREA, WALK_SPEED } from './config';
import type { HitBox } from './hit';
import { hotspotBox, hudTargets, tap, type Intent, type TapContext, type UiState } from './interact';
import { animOf, animTicks, type SceneAnim, type SceneArtMeta } from './sceneArt';
import { initialState, step } from './puzzle/step';
import { GAUGE_MAX, type Action, type CharactersData, type PuzzleEvent, type PuzzleState, type ScreenData, type StepSource } from './puzzle/types';
import type { Point } from './viewport';
import { clampToArea, createWalker, stepWalker, walkTo, type Walker } from './walk';

/** 연출 시간(틱, 60Hz). 임시값이다. 실제 애니메이션 프레임 수가 나오면 그 길이로 바꾼다(ADR-0007). */
export const TIMING = {
  anim: 30,
  fx: 30,
  gauge: 20,
  item: 20,
  place: 12,
  release: 18,
  faint: 60,
  /** 게이지 0 컷 글(`ui.faint`)이 떠 있는 시간. `faint`(busy)보다 길고, 남는 동안은 입력을 막지 않는다(#129 Luna 제안 2). */
  faintCut: 90,
  /** 말풍선: 기본 + 글자당. 상한을 둔다. */
  sayBase: 60,
  sayPerChar: 4,
  sayMax: 240,
  /** 말풍선이 뜬 뒤 이만큼 지나야 탭으로 넘길 수 있다(설계 5절, 0.4초). */
  saySkipAfter: 24,
  /** 자동 걷기 속도. 엔진 걷기와 같다. */
  walkSpeed: WALK_SPEED,
} as const;

/** 재생 중인 이벤트. `say`는 고른 문구 ID 하나로 바꿔 둔다(배열 변형은 발동 횟수로 고른다). */
export type PlayEvent = Exclude<PuzzleEvent, { type: 'say' }> | { type: 'say'; speaker: string; text: string };

export interface Playing {
  ev: PlayEvent;
  /** 시작한 뒤 지난 틱. */
  t: number;
  /** 이 이벤트가 끝나는 틱 수. 걷기는 도착할 때 끝나서 null. */
  duration: number | null;
  /** 몇 번째로 시작한 이벤트인가(0부터). 멈춘 모습이 바뀌는 시점(`shown`)을 맞추는 데 쓴다. */
  seq: number;
  /** 화면 시트에 있는 물건 anim이면 그 물건과 고른 갈래(형식 기록 4-1절). 엔진은 이걸 그린다. */
  art?: { object: string; anim: SceneAnim };
}

/**
 * 물건의 "보이는 플래그"가 진짜 플래그보다 늦게 바뀌는 동안의 기록(형식 기록 4-2절).
 * `seq`번째 이벤트가 시작(`start`)하거나 끝날(`end`) 때 지운다 → 그때부터 진짜 플래그로 그린다.
 */
export interface ShownFlags {
  flags: Record<string, boolean>;
  seq: number;
  edge: 'start' | 'end';
}

export interface SceneState {
  tick: number;
  puzzle: PuzzleState;
  ui: UiState;
  walkers: Record<CharacterId, Walker>;
  /** 아직 시작하지 않은 이벤트. */
  queue: PlayEvent[];
  current: Playing | null;
  /**
   * 화면에 보이는 게이지. `gauge` 이벤트가 올 때 바뀐다(퍼즐 상태는 이미 확정이라 연출보다 앞선다).
   * `faint`는 "자리 리셋 + 게이지 가득"이다(ADR-0065 5절 6). `step`은 `faint` 뒤에 `gauge` 이벤트를 따로 내지 않으므로
   * `faint`가 끝날 때 가득으로 채운다. 컷 동안은 0을 보여 줘서 "0 → 리셋 → 다시 참" 순서가 보이게 한다(ADR-0018 G2, #129).
   */
  shownGauge: number;
  /** 게이지 0 컷 글이 이 틱 전까지 떠 있다. 0이면 없음. */
  faintCutUntil: number;
  /** 규칙·폴백별 발동 횟수(대사 변형 선택), 대상별 폴백 횟수(힌트 ②). UI 상태라 세이브·BFS에 넣지 않는다(ADR-0065 5절). */
  counts: Record<string, number>;
  /** 지금까지 시작한 이벤트 수. 다음에 시작할 이벤트의 `seq`다. */
  started: number;
  /** 물건 키 → 아직 옛 플래그로 그리는 물건(4-2절). 없으면 진짜 플래그로 그린다. 그림 전용이고 판정·히트 박스는 안 쓴다. */
  shown: Record<string, ShownFlags>;
  /** `move floor` 행동에서 걸어갈 바닥 점. 캐릭터별. */
  floorTo: Partial<Record<CharacterId, Point>>;
  cleared: boolean;
}

export interface SceneData {
  screen: ScreenData;
  characters?: CharactersData;
  /** 화면 배경·물건 그림 메타(#157). 있으면 물건 anim 길이가 busy 길이가 되고, 보이는 플래그를 따로 센다. */
  art?: SceneArtMeta;
}

/** busy = 재생할 이벤트가 하나라도 남아 있다(설계 5절). */
export function isBusy(s: SceneState): boolean {
  return s.current !== null || s.queue.length > 0;
}

function spotPoint(data: SceneData, spotId: string): Point {
  const spot = data.screen.spots[spotId];
  if (!spot) throw new Error(`알 수 없는 자리: ${spotId}`);
  return { x: spot.x, y: spot.y };
}

const isFree = (data: SceneData, spotId: string): boolean => data.screen.spots[spotId]?.free === true;

/** 처음 배치. 바닥 자리에 선 캐릭터는 자리 좌표를 중심으로 40px씩 벌려 세운다. */
export function createScene(data: SceneData): SceneState {
  const puzzle = initialState(data.screen);
  const walkers = {} as Record<CharacterId, Walker>;
  CHARACTERS.forEach((c, i) => {
    const spotId = puzzle.at[c.id];
    const p = spotPoint(data, spotId);
    const at = isFree(data, spotId) ? clampToArea({ x: p.x + (i - 1) * 40, y: p.y }, WALK_AREA) : p;
    walkers[c.id] = createWalker(c.id, at);
  });
  const s: SceneState = {
    tick: 0,
    puzzle,
    ui: { active: CHARACTERS[0]!.id, armed: null, selected: null },
    walkers,
    queue: [],
    current: null,
    shownGauge: puzzle.gauge,
    faintCutUntil: 0,
    started: 0,
    shown: {},
    counts: {},
    floorTo: {},
    cleared: false,
  };
  // onEnter는 상태를 바꾸지 않는 연출이다(ADR-0065 5절). say 화자는 캐릭터 ID만 온다.
  for (const item of data.screen.onEnter ?? []) {
    if ('anim' in item) s.queue.push({ type: 'anim', target: item.anim[0], name: item.anim[1] });
    else if ('fx' in item) s.queue.push({ type: 'fx', effect: item.fx[0], target: item.fx[1] });
    else s.queue.push({ type: 'say', speaker: item.say[0], text: pickText(item.say[1], 1) });
  }
  return s;
}

/** 판정용 캐릭터 몸 박스. 엔진이 그리는 위치 그대로다. */
export function bodies(s: SceneState): Record<CharacterId, HitBox> {
  const out = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const w = s.walkers[c.id];
    out[c.id] = characterHitBox(characterDef(c.id), w.x, w.y, w.facing);
  }
  return out;
}

export function tapContext(data: SceneData, s: SceneState): TapContext {
  return { screen: data.screen, puzzle: s.puzzle, bodies: bodies(s) };
}

function pickText(text: string | string[], count: number): string {
  if (!Array.isArray(text)) return text;
  return text[Math.min(count, text.length) - 1] ?? '';
}

/** 대사 변형 키: 규칙은 규칙 ID, 폴백은 출처·대상·동사·캐릭터. */
function variantKey(source: StepSource, ruleId: string | undefined, a: Action): string {
  return source === 'rule' ? `rule:${ruleId}` : `${source}:${a.target}:${a.verb}:${a.char}`;
}

function bump(s: SceneState, key: string): number {
  const n = (s.counts[key] ?? 0) + 1;
  s.counts[key] = n;
  return n;
}

/**
 * 힌트 ②(ADR-0018 F3, 화면 1 설계 5절): 같은 대상에서 핫스팟 폴백 2번째에 한 번.
 * 대상의 `hintAbility`가 행동한 캐릭터 자기 능력이면 그 폴백은 **세지도 않는다**.
 * 먼저 세면 자기 능력 캐릭터가 2번째를 써 버려 그 대상의 힌트가 다시는 안 뜬다(#122 리뷰).
 */
function hintEvent(data: SceneData, s: SceneState, source: StepSource, a: Action): PlayEvent | null {
  if (source !== 'hotspotFallback') return null;
  const ability = data.screen.hotspots[a.target]?.hintAbility ?? data.screen.spots[a.target]?.hintAbility;
  if (!ability || ability === characterDef(a.char).ability) return null;
  if (bump(s, `hint:${a.target}`) !== 2) return null;
  const text = data.characters?.hints?.[a.char]?.[ability];
  return text ? { type: 'say', speaker: a.char, text } : null;
}

/**
 * 형식 기록 4-2절: `step`은 이벤트 재생 전에 플래그를 바꾸지만, 그림은 그 행동의 이전 플래그로 그리다가
 * (a) 그 물건(`ids` 포함)의 anim이 시작될 때, (b) 없으면 첫 anim이 끝날 때 바꾼다. anim이 하나도 없으면 바로 바꾼다.
 * 시트에 그 anim이 있는지는 보지 않는다(그림이 붙는 순서와 상관없이 시점이 같다).
 */
function deferShown(data: SceneData, s: SceneState, before: Record<string, boolean>, events: readonly PuzzleEvent[]): void {
  const art = data.art;
  if (!art) return;
  const after = s.puzzle.flags;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  if ([...keys].every((k) => (before[k] ?? false) === (after[k] ?? false))) return;
  // 지금 재생 중인 이벤트는 이미 `started`에 들어 있다. 새 이벤트는 대기열 뒤에 붙는다.
  const base = s.started + s.queue.length;
  const firstAnim = events.findIndex((e) => e.type === 'anim');
  if (firstAnim < 0) return;
  for (const o of art.objects) {
    const own = events.findIndex((e) => e.type === 'anim' && o.ids.includes(e.target));
    s.shown[o.key] = own >= 0 ? { flags: { ...before }, seq: base + own, edge: 'start' } : { flags: { ...before }, seq: base + firstAnim, edge: 'end' };
  }
}

/** 물건 하나의 보이는 플래그(4-2절). 그림 전용. */
export function shownFlags(s: SceneState, objectKey: string): Readonly<Record<string, boolean>> {
  return s.shown[objectKey]?.flags ?? s.puzzle.flags;
}

function commitShown(s: SceneState, seq: number, edge: 'start' | 'end'): void {
  for (const [k, v] of Object.entries(s.shown)) if (v.seq === seq && v.edge === edge) delete s.shown[k];
}

function runAction(data: SceneData, s: SceneState, action: Action, to: Point | null): void {
  const before = s.puzzle.flags;
  const r = step(data.screen, s.puzzle, action, data.characters);
  s.puzzle = r.state;
  deferShown(data, s, before, r.events);
  if (to) s.floorTo[action.char] = to;
  // 행동하는 캐릭터의 엔진 걷기는 멈춘다(그 자리에서 행동한다).
  const w = s.walkers[action.char];
  w.target = null;
  w.walkTicks = 0;
  const n = bump(s, variantKey(r.source, r.ruleId, action));
  for (const ev of r.events) s.queue.push(ev.type === 'say' ? { ...ev, text: pickText(ev.text, n) } : ev);
  const hint = hintEvent(data, s, r.source, action);
  if (hint) s.queue.push(hint);
}

/** 바닥(`free`) 자리로 갈 때 설 점. `move floor`는 누른 점, 그 밖에는 지금 있는 곳 바로 아래(손 놓기·발사·기절). */
function floorPoint(data: SceneData, s: SceneState, char: CharacterId, to: string): Point {
  const picked = s.floorTo[char];
  if (picked) {
    delete s.floorTo[char];
    return clampToArea(picked, WALK_AREA);
  }
  return clampToArea({ x: s.walkers[char].x, y: spotPoint(data, to).y }, WALK_AREA);
}

function destination(data: SceneData, s: SceneState, char: CharacterId, to: string): Point {
  return isFree(data, to) ? floorPoint(data, s, char, to) : spotPoint(data, to);
}

function teleport(w: Walker, p: Point): void {
  w.x = p.x;
  w.y = p.y;
  w.target = null;
  w.walkTicks = 0;
}

function sayDuration(text: string): number {
  return Math.min(TIMING.sayMax, TIMING.sayBase + TIMING.sayPerChar * text.length);
}

/** 이벤트 하나를 시작한다. `seq`는 시작 순번. 보이는 플래그(4-2절 (a))도 여기서 바꾼다. */
function start(data: SceneData, s: SceneState, ev: PlayEvent): Playing {
  const seq = s.started++;
  const p = begin(data, s, ev, seq);
  commitShown(s, seq, 'start');
  return p;
}

/** 즉시 끝나는 효과(배치·게이지 값)는 여기서 적용한다. */
function begin(data: SceneData, s: SceneState, ev: PlayEvent, seq: number): Playing {
  switch (ev.type) {
    case 'walk': {
      const w = s.walkers[ev.char];
      const p = destination(data, s, ev.char, ev.to);
      if (p.x !== w.x) w.facing = p.x > w.x ? 1 : -1;
      w.target = p.x === w.x && p.y === w.y ? null : p;
      return { ev, t: 0, duration: null, seq };
    }
    case 'release':
      teleport(s.walkers[ev.char], destination(data, s, ev.char, ev.to));
      return { ev, t: 0, duration: TIMING.release, seq };
    case 'place':
      teleport(s.walkers[ev.char], destination(data, s, ev.char, ev.to));
      return { ev, t: 0, duration: TIMING.place, seq };
    case 'faint':
      for (const c of CHARACTERS) teleport(s.walkers[c.id], destination(data, s, c.id, ev.to[c.id]));
      s.faintCutUntil = s.tick + TIMING.faintCut;
      return { ev, t: 0, duration: TIMING.faint, seq };
    case 'gauge':
      s.shownGauge = ev.value;
      return { ev, t: 0, duration: TIMING.gauge, seq };
    case 'clear':
      s.cleared = true;
      return { ev, t: 0, duration: 0, seq };
    case 'say':
      return { ev, t: 0, duration: sayDuration(ev.text), seq };
    case 'anim': {
      // 물건 anim은 갈래를 anim 직전 보이는 플래그로 고르고(4-1절), 그 길이가 busy 길이다(5절). 없으면 임시 길이.
      const obj = data.art?.objects.find((o) => o.ids.includes(ev.target));
      const art = data.art && obj ? animOf(data.art, ev.target, ev.name, shownFlags(s, obj.key)) : null;
      return art ? { ev, t: 0, duration: animTicks(art.anim), seq, art } : { ev, t: 0, duration: TIMING.anim, seq };
    }
    case 'fx':
      return { ev, t: 0, duration: TIMING.fx, seq };
    case 'item':
      return { ev, t: 0, duration: TIMING.item, seq };
  }
}

function finished(s: SceneState, p: Playing): boolean {
  if (p.ev.type === 'walk') return s.walkers[p.ev.char].target === null;
  return p.duration !== null && p.t >= p.duration;
}

/** 고정 틱 하나. 세로 화면 안내가 떠 있으면 엔진이 부르지 않는다(설계 9절, 연출 시계 정지). */
export function sceneTick(data: SceneData, s: SceneState): void {
  s.tick += 1;
  // 엔진 걷기와 자동 걷기 모두 같은 속도로 진행한다. 다른 캐릭터의 걷기는 연출 중에도 계속된다.
  for (const c of CHARACTERS) stepWalker(s.walkers[c.id], TIMING.walkSpeed);
  // 이벤트를 시작한 틱이 그 이벤트의 t=0 프레임이다. 길이 0 이벤트(clear)나 이미 도착한 걷기는 같은 틱에 다음으로 넘어간다.
  for (let guard = 0; guard < 64; guard++) {
    if (s.current === null) {
      const next = s.queue.shift();
      if (!next) return;
      s.current = start(data, s, next);
    } else {
      s.current.t += 1;
    }
    if (!finished(s, s.current)) return;
    if (s.current.ev.type === 'faint') s.shownGauge = GAUGE_MAX;
    commitShown(s, s.current.seq, 'end');
    s.current = null;
  }
}

/** 탭 결과. 엔진이 효과음·안내 문구를 고르는 데 쓴다. */
export type SceneTapResult =
  | { kind: 'ignored' }
  | { kind: 'skipWalk' }
  | { kind: 'skipSay' }
  | { kind: 'intent'; intent: Intent };

/**
 * 탭 하나. busy 동안은 새 행동·전환·무장을 받지 않는다(설계 5절).
 * - 자동 걷기 중: 걷기만 끝 위치로 건너뛴다. 남은 이벤트는 그대로 재생한다.
 * - 말풍선이 뜬 뒤 0.4초가 지났으면: 그 말풍선만 끝낸다.
 */
export function sceneTap(data: SceneData, s: SceneState, p: Point, slop: number, touch: boolean): SceneTapResult {
  if (s.cleared) return { kind: 'ignored' };
  const cur = s.current;
  if (cur) {
    if (cur.ev.type === 'walk') {
      const w = s.walkers[cur.ev.char];
      if (w.target) teleport(w, w.target);
      return { kind: 'skipWalk' };
    }
    if (cur.ev.type === 'say' && cur.t >= TIMING.saySkipAfter) {
      cur.duration = cur.t;
      return { kind: 'skipSay' };
    }
    return { kind: 'ignored' };
  }
  if (s.queue.length > 0) return { kind: 'ignored' };

  const r = tap(tapContext(data, s), s.ui, p, slop, touch);
  s.ui = r.ui;
  const intent = r.intent;
  // 컷이 남은 동안(faint 뒤 0.5초) 새 행동을 시작하면 컷을 바로 내린다. 말풍선과 겹치지 않게.
  if (intent.kind === 'walk' || intent.kind === 'act') s.faintCutUntil = 0;
  if (intent.kind === 'walk') walkTo(s.walkers[s.ui.active], intent.to, WALK_AREA);
  else if (intent.kind === 'act') runAction(data, s, intent.action, intent.to);
  return { kind: 'intent', intent };
}

/** 지금 떠 있는 말풍선. 없으면 null. */
export function currentBubble(s: SceneState): { speaker: string; text: string } | null {
  const ev = s.current?.ev;
  return ev?.type === 'say' ? { speaker: ev.speaker, text: ev.text } : null;
}

/** 지금 떠 있는 화면 가운데 컷 글 ID. 없으면 null. busy가 끝난 뒤에도 잠깐 남을 수 있다. */
export function currentCut(s: SceneState): string | null {
  return s.tick < s.faintCutUntil ? 'ui.faint' : null;
}

/**
 * 재생 도구 훅 `window.__gcLayout()`(`?playtest=1`) 모양. `scripts/playtest/plan.ts` `Layout`과 같다.
 * 상자는 입력 판정이 쓰는 바로 그 값이다(훅 상자 = 판정 상자).
 */
export interface SceneLayout {
  active: CharacterId;
  armed: `verb.${'ability' | 'hand' | 'look'}` | 'item.0' | null;
  selected: string | null;
  busy: boolean;
  cleared: boolean;
  gauge: number;
  /** 화면 가운데 컷 글 ID(`ui.faint`). 없으면 null. */
  cut: string | null;
  at: Record<CharacterId, string>;
  chars: Record<CharacterId, HitBox>;
  spots: Record<string, HitBox>;
  hotspots: Record<string, HitBox>;
  hud: Record<string, HitBox>;
}

export function sceneLayout(data: SceneData, s: SceneState): SceneLayout {
  const spots: Record<string, HitBox> = {};
  for (const [id, spot] of Object.entries(data.screen.spots)) {
    if (spot.box) {
      const [left, top, width, height] = spot.box;
      spots[id] = { left, top, width, height };
    }
  }
  const hotspots: Record<string, HitBox> = {};
  for (const id of Object.keys(data.screen.hotspots)) {
    const box = hotspotBox(data.screen, s.puzzle, id);
    if (box) hotspots[id] = box;
  }
  const hud: Record<string, HitBox> = {};
  for (const t of hudTargets(s.puzzle)) hud[t.id] = t.box;
  const a = s.ui.armed;
  return {
    active: s.ui.active,
    armed: a === null ? null : a.verb === 'item' ? 'item.0' : `verb.${a.verb}`,
    selected: s.ui.selected,
    busy: isBusy(s),
    cleared: s.cleared,
    gauge: s.shownGauge,
    cut: currentCut(s),
    at: { ...s.puzzle.at },
    chars: bodies(s),
    spots,
    hotspots,
    hud,
  };
}
