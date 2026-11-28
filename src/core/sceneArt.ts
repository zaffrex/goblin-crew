// 화면 배경·물건 그림 메타 해석과 "지금 무엇을 그리나" 고르기 (#157 10절 2단계).
// 형식: docs/decisions/2026-11-16-scene-art-format-v1.md (개정 1 포함). 메타는 art/scene-build.mjs가 만든다.
// 순수 로직이다. 이미지 로드·그리기는 engine/sceneArt.ts.
//
// - 멈춘 모습: 그 물건의 "보이는 플래그"(4-2절)로 `when` 첫 일치, 없으면 `default`. 반복(`loop`)은 화면 시계로 고르되,
//   그 물건의 anim이 끝나거나 멈춘 모습이 바뀐 때부터 0으로 센다(#237, `loopStarts`).
// - 일시 연출: 재생 중인 anim 이벤트가 그 물건 ID면 anim 프레임이 멈춘 모습을 대신한다(4절). 갈래는 anim 직전 보이는 플래그(4-1절).
//   `hold` anim(13절, 개정 8)은 끝난 뒤에도 대기열이 빌 때까지 마지막 칸(효과 자리면 그 연출 모드)을 붙든다(`SceneView.held`).
// - 시트에 없는 대상은 null → 엔진이 임시 상자를 그린다(9절 폴백).
// - 효과 자리(11절, 개정 4): 그림 없이 엔진 입자를 `back` 안 그 순서에 끼운다. 대상 ID가 없다(클릭·외곽선 밖).
// - 머리 위 anim(16절, 개정 12): `anchor` anim의 칸은 제자리가 아니라 그 캐릭터 얼굴 상자 위 가운데에 놓는다(`heads`, `headPlace`).

import { opaqueAt, type AlphaMask } from './alpha';
import { CHARACTERS, type CharacterId } from './characters';
import type { HitBox } from './hit';
import { TICK_MS } from './config';
import { SCENE_FX, type SceneFxDraw } from './sceneFx';
import { parseNthName } from './sprite';

export type Layer = 'back' | 'front';
type Flags = Readonly<Record<string, boolean>>;
interface When {
  flags: Record<string, boolean>;
}
interface Timed {
  frames: number[];
  ms: number[];
}

export interface ScenePicture {
  /** 시트 칸 번호. `null` = 안 그림(state만, 형식 기록 개정 9 #551: 물건이 화면 밖으로 갔다). 외곽선도 켜지지 않는다. */
  frame: number | null;
  layer: Layer;
  loop?: Timed;
}

export interface ScenePictureObject {
  key: string;
  ids: string[];
  effect?: undefined;
  default: ScenePicture;
  states?: (ScenePicture & { when: When })[];
  overlay?: { sortY: number; frame: number };
  /** 멈춘 기울기(형식 기록 12절, 개정 5). 시소처럼 사람이 올라타면 기우는 물건. */
  tilt?: SceneTilt;
  /** 바닥 걷기 목표가 `box` [x, y, w, h] 안이면 y를 `y`로 옮긴다(판 밑에 서지 않게, 12절). */
  noFloor?: { box: [number, number, number, number]; y: number };
}

/** 효과 자리의 멈춘 모드(11-1절). `when` 첫 일치, 없으면 default. */
export interface SceneFxMode {
  mode: string;
}

/** 효과 자리(11절, 개정 4). 그림이 없고 대상 ID도 없다. 좌표(`area`)를 적는 유일한 물건이다. */
export interface SceneFxObject {
  key: string;
  /** 언제나 빈 배열(11-2절: 히트 박스·외곽선·`coveredIds` 밖). */
  ids: string[];
  effect: string;
  area: [number, number, number, number];
  colors: [number, number, number, number];
  default: SceneFxMode;
  states?: (SceneFxMode & { when: When })[];
  overlay?: undefined;
  tilt?: undefined;
  noFloor?: undefined;
}

export type SceneObject = ScenePictureObject | SceneFxObject;

export const isFxObject = (o: SceneObject): o is SceneFxObject => o.effect !== undefined;

/**
 * 기울기 d = `step` × (축 오른쪽에 탄 무게 합 − 왼쪽 합). 단위는 축에서 `run`px 오른쪽 열이 내려간 px(음수 = 왼쪽이 내려감).
 * 열 x의 내려간 px = round(d × (x − pivot) / run). `frames`의 키는 d(0 제외, 0은 멈춘 모습 그대로).
 */
export interface SceneTilt {
  /** 쉬는 판(형식 기록 12절 개정 7, 설계 1-7-1절): 무게가 다르면 무거운 쪽 끝이 이만큼(px) 내려가 쉰다. */
  rest: number;
  weight: Record<string, number>;
  pivot: number;
  run: number;
  frames: Record<string, number>;
}

export interface SceneAnim extends Timed {
  layer: Layer;
  /** 칸별 기울기 d(형식 기록 12-5절, 개정 6). 기울기 물건 anim만. 판 위 발이 지금 칸의 판 높이를 따른다. */
  tilt?: number[];
  /** 효과 anim(11-3절)의 연출 모드. 있으면 `frames`는 빈 배열, `ms`는 한 칸(길이)이다. */
  mode?: string;
  /**
   * 끝나도 대기열이 빌 때까지 마지막 칸을 붙든다(13절, 개정 8, #450). 효과 anim이면 그 연출 모드를 계속한다.
   * 메타에는 anim에만 적고, 갈래는 `animOf`가 물려받게 한다.
   */
  hold?: true;
  /**
   * 머리 위 anim(16절, 개정 12, #901). 칸 `at`이 그 캐릭터 얼굴 상자 위 가운데에서 잰 상대 좌표이고, 왼쪽을 보면 좌우로 뒤집힌다.
   * 늘 `front`(사람 위). 메타에는 anim에만 적고 갈래는 `animOf`가 물려받게 한다. 외곽선·덮개·말풍선 상자에서 빠진다.
   */
  anchor?: SceneAnchor;
}

export interface SceneAnchor {
  char: CharacterId;
  point: 'head';
}

export interface SceneArtMeta {
  image: string;
  screen: string;
  /** 배경 PNG 이름. draft면 null(엔진은 임시 방을 그린다). */
  bg: string | null;
  frames: { src: [number, number, number, number]; at: [number, number] }[];
  objects: SceneObject[];
  anims: Record<string, SceneAnim & { object: string | null; variants?: (SceneAnim & { when: When })[] }>;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 메타 JSON을 검사한다. 틀리면 이유를 던진다 → 엔진은 그 화면 그림을 통째로 폴백한다(빌드 검사를 통과한 파일이라 방어용). */
export function parseSceneArt(raw: unknown): SceneArtMeta {
  const m = raw as Partial<SceneArtMeta>;
  const fail = (why: string): never => {
    throw new Error(`화면 그림 메타 오류(${String(m?.screen)}): ${why}`);
  };
  if (!isObj(m)) return fail('객체가 아님');
  if (typeof m.image !== 'string' || typeof m.screen !== 'string') fail('image·screen 없음');
  if (m.bg !== null && typeof m.bg !== 'string') fail('bg는 문자열 또는 null');
  if (!Array.isArray(m.frames)) return fail('frames 없음');
  const n = m.frames.length;
  for (const [i, f] of m.frames.entries()) {
    const ok = Array.isArray(f?.src) && f.src.length === 4 && f.src.every(isInt) && Array.isArray(f.at) && f.at.length === 2 && f.at.every(isInt);
    if (!ok) fail(`frames[${i}]`);
  }
  const frame = (v: unknown, where: string): void => {
    if (!isInt(v) || v < 0 || v >= n) fail(`${where}: 프레임 번호 ${String(v)}`);
  };
  const timed = (t: Partial<Timed> | undefined, where: string): void => {
    if (!t || !Array.isArray(t.frames) || !Array.isArray(t.ms) || t.frames.length === 0 || t.frames.length !== t.ms.length) fail(`${where}: frames·ms`);
    t!.frames!.forEach((f, i) => frame(f, `${where}.frames[${i}]`));
    if (!t!.ms!.every((v) => isInt(v) && v > 0)) fail(`${where}: ms는 양의 정수`);
  };
  const animTilt = (a: Partial<SceneAnim>, where: string): void => {
    if (a.tilt === undefined) return;
    if (!Array.isArray(a.tilt) || a.tilt.length !== a.frames?.length || !a.tilt.every(isInt)) fail(`${where}.tilt`);
  };
  const layer = (v: unknown, where: string): void => {
    if (v !== 'back' && v !== 'front') fail(`${where}: layer`);
  };
  const when = (v: unknown, where: string): void => {
    if (!isObj(v) || !isObj(v.flags) || !Object.values(v.flags).every((b) => typeof b === 'boolean')) fail(`${where}: when`);
  };
  /** `hidden`이면 `frame: null`(안 그림)을 받는다. 안 그리는 모습에는 반복이 없다(개정 9). */
  const picture = (p: Partial<ScenePicture> | undefined, where: string, hidden = false): void => {
    if (!isObj(p)) return fail(where);
    if (hidden && p.frame === null) {
      if (p.loop !== undefined) fail(`${where}: 안 그리는 모습(frame null)에 loop`);
    } else frame(p.frame, where);
    layer(p.layer, where);
    if (p.loop !== undefined) timed(p.loop, `${where}.loop`);
  };
  if (!Array.isArray(m.objects)) return fail('objects 없음');
  const fxKeys = new Map<string, string>(); // 효과 자리 키 → 효과 이름
  for (const [i, raw] of m.objects.entries()) {
    const w = `objects[${i}]`;
    if (isObj(raw) && raw.effect !== undefined) {
      const o = raw as Partial<SceneFxObject>;
      const fx = typeof o.effect === 'string' ? SCENE_FX[o.effect] : undefined;
      if (typeof o.key !== 'string' || !fx) return fail(`${w}: key·effect`);
      if (!Array.isArray(o.ids) || o.ids.length !== 0) fail(`${w}: 효과 자리는 ids가 빈 배열`);
      if (!Array.isArray(o.area) || o.area.length !== 4 || !o.area.every(isInt)) fail(`${w}.area`);
      if (!Array.isArray(o.colors) || o.colors.length !== 4 || !o.colors.every((c) => isInt(c) && c >= 0 && c < 32)) fail(`${w}.colors`);
      const still = (p: unknown, where: string): void => {
        if (!isObj(p) || typeof p.mode !== 'string' || !fx.still.includes(p.mode)) fail(`${where}: mode`);
      };
      still(o.default, `${w}.default`);
      for (const [j, s] of (o.states ?? []).entries()) {
        still(s, `${w}.states[${j}]`);
        when(s.when, `${w}.states[${j}]`);
      }
      fxKeys.set(o.key, o.effect!);
      continue;
    }
    const o = raw as ScenePictureObject;
    // 15절(개정 11): `ids: []`는 장식 물건(대상 없음, anim 원본 `object`로만 바뀐다).
    if (typeof o?.key !== 'string' || !Array.isArray(o.ids) || !o.ids.every((t) => typeof t === 'string')) fail(`${w}: key·ids`);
    // 16절(개정 12): 장식 물건만 평소 안 그릴 수 있다(default `frame: null`). 대상이 없어 임시 상자·히트 박스 문제가 없다.
    picture(o.default, `${w}.default`, Array.isArray(o.ids) && o.ids.length === 0);
    for (const [j, s] of (o.states ?? []).entries()) {
      picture(s, `${w}.states[${j}]`, true);
      when(s.when, `${w}.states[${j}]`);
    }
    if (o.overlay !== undefined) {
      if (!isInt(o.overlay.sortY)) fail(`${w}.overlay.sortY`);
      frame(o.overlay.frame, `${w}.overlay`);
    }
    if (o.tilt !== undefined) {
      const t = o.tilt as Partial<SceneTilt>;
      const pos = (v: unknown): boolean => isInt(v) && v > 0;
      if (!isObj(t) || !pos(t.rest) || !pos(t.run) || typeof t.pivot !== 'number' || !isObj(t.weight) || !Object.values(t.weight).every(pos)) fail(`${w}.tilt`);
      if (!isObj(t.frames)) return fail(`${w}.tilt.frames`);
      for (const [k, f] of Object.entries(t.frames)) {
        if (!isInt(Number(k)) || Number(k) === 0) fail(`${w}.tilt.frames['${k}']`);
        frame(f, `${w}.tilt.frames['${k}']`);
      }
    }
    if (o.noFloor !== undefined) {
      const b = o.noFloor.box as unknown;
      if (!Array.isArray(b) || b.length !== 4 || !b.every(isInt) || !isInt(o.noFloor.y)) fail(`${w}.noFloor`);
    }
  }
  if (!isObj(m.anims)) return fail('anims 없음');
  const charIds: readonly string[] = CHARACTERS.map((c) => c.id);
  for (const [name, a] of Object.entries(m.anims)) {
    if (a.hold !== undefined && a.hold !== true) fail(`anims['${name}'].hold: true만 쓴다`);
    if (a.anchor !== undefined) {
      const an = a.anchor as Partial<SceneAnchor> | undefined;
      if (!isObj(an) || !charIds.includes(an.char as string) || an.point !== 'head') fail(`anims['${name}'].anchor`);
      if (a.layer !== 'front' || a.tilt !== undefined || fxKeys.has(a.object as string)) fail(`anims['${name}'].anchor: front 그림 anim만, tilt 없음`);
    }
    const fxName = a.object === null ? undefined : fxKeys.get(a.object);
    if (fxName !== undefined) {
      // 효과 anim(11-3절): 효과 자리를 연출 모드로 바꿔 그린다. 칸·갈래·기울기가 없다.
      const okMs = Array.isArray(a.ms) && a.ms.length === 1 && isInt(a.ms[0]) && a.ms[0] > 0;
      if (!okMs || !Array.isArray(a.frames) || a.frames.length !== 0 || a.variants !== undefined || a.tilt !== undefined) fail(`anims['${name}']: 효과 anim 모양`);
      if (typeof a.mode !== 'string' || !SCENE_FX[fxName]!.play.includes(a.mode)) fail(`anims['${name}'].mode`);
      layer(a.layer, `anims['${name}']`);
      continue;
    }
    if (a.mode !== undefined) fail(`anims['${name}'].mode: 효과 자리 anim만`);
    timed(a, `anims['${name}']`);
    layer(a.layer, `anims['${name}']`);
    animTilt(a, `anims['${name}']`);
    if (a.object !== null && !m.objects.some((o) => o.key === a.object)) fail(`anims['${name}'].object`);
    for (const [j, v] of (a.variants ?? []).entries()) {
      timed(v, `anims['${name}'].variants[${j}]`);
      if (v.hold !== undefined) fail(`anims['${name}'].variants[${j}].hold: hold는 anim에만 적는다`);
      if (v.anchor !== undefined) fail(`anims['${name}'].variants[${j}].anchor: anchor는 anim에만 적는다`);
      if (a.anchor !== undefined && v.layer !== 'front') fail(`anims['${name}'].variants[${j}]: 머리 위 anim 갈래는 front`);
      layer(v.layer, `anims['${name}'].variants[${j}]`);
      animTilt(v, `anims['${name}'].variants[${j}]`);
      when(v.when, `anims['${name}'].variants[${j}]`);
    }
    const nth = parseNthName(name);
    if (nth) {
      // n번째 변형(#765 2/2): 같은 물건, 같은 `hold`. 다르면 끝난 뒤 붙드는 칸·보이는 플래그 시점이 처음 판과 갈린다.
      const base = m.anims[nth.base];
      if (!base) fail(`anims['${name}']: 변형의 원래 anim '${nth.base}'가 없음`);
      else if (base.object !== a.object || base.hold !== a.hold || base.anchor?.char !== a.anchor?.char)
        fail(`anims['${name}']: 변형은 '${nth.base}'와 object·hold·anchor가 같아야 한다`);
    }
  }
  return m as SceneArtMeta;
}

const matches = (w: When, flags: Flags): boolean => Object.entries(w.flags).every(([k, v]) => (flags[k] ?? false) === v);

/** 대상 ID(hotspot·spot) → 그 대상을 맡은 물건. 없으면 null(임시 상자). 효과 자리는 ID가 없어서 나오지 않는다. */
export function objectOf(meta: SceneArtMeta, target: string): ScenePictureObject | null {
  return (meta.objects.find((o) => !isFxObject(o) && o.ids.includes(target)) as ScenePictureObject | undefined) ?? null;
}

/**
 * anim 하나가 바꿔 그리는 그림 물건(4-2절 (a)의 "그 물건"). 메타 `object`가 그림 물건이면 그것(개정 11: 장식 물건 `nest`처럼
 * 대상 ID를 안 맡아도 된다), 아니면 대상 ID를 맡은 물건이다. 효과 anim(`object` = 효과 자리)·시트에 없는 anim은 대상의 물건.
 */
export function animObject(meta: SceneArtMeta, target: string, name: string): ScenePictureObject | null {
  const key = meta.anims[`${target}.${name}`]?.object;
  const o = key == null ? undefined : meta.objects.find((x) => x.key === key && !isFxObject(x));
  return (o as ScenePictureObject | undefined) ?? objectOf(meta, target);
}

/** 멈춘 모습(효과 자리면 멈춘 모드): `when` 첫 일치, 없으면 `default`(4절, hotspot `variants`와 같은 규칙). */
export function pictureOf<P>(o: { default: P; states?: (P & { when: When })[] }, flags: Flags): P {
  return o.states?.find((s) => matches(s.when, flags)) ?? o.default;
}

/**
 * `[대상, 이름]` anim → 그 물건과 고른 갈래. 시트에 없으면 null. 갈래는 anim 직전 보이는 플래그로 고른다(4-1절).
 * 갈래는 anim의 `hold`를 물려받는다(13절).
 */
export function animOf(meta: SceneArtMeta, target: string, name: string, flags: Flags): { object: string; anim: SceneAnim } | null {
  const a = meta.anims[`${target}.${name}`];
  if (!a || a.object === null) return null;
  const v = a.variants?.find((x) => matches(x.when, flags));
  return { object: a.object, anim: v ? (a.hold || a.anchor ? { ...v, ...(a.hold ? { hold: true as const } : {}), ...(a.anchor ? { anchor: a.anchor } : {}) } : v) : a };
}

/** anim 하나의 busy 길이(60Hz 틱, ms 합을 올림). 5절: 시트에 있는 anim은 이 길이가 그 이벤트의 busy 길이다. */
export function animTicks(anim: Timed): number {
  const ms = anim.ms.reduce((a, b) => a + b, 0);
  // 부동소수 오차로 100ms → 6.000000001틱이 7이 되지 않게 아주 작게 깎는다.
  return Math.ceil(ms / TICK_MS - 1e-9);
}

/** ms 시간표의 지금 칸 번호(0부터). 반복이면 감고, 아니면 마지막 칸에 머문다. */
export function timedIndex(t: Timed, ms: number, loop: boolean): number {
  const total = t.ms.reduce((a, b) => a + b, 0);
  let rest = loop ? ((ms % total) + total) % total : Math.max(0, ms);
  for (let i = 0; i < t.frames.length; i++) {
    rest -= t.ms[i]!;
    if (rest < 0) return i;
  }
  return t.frames.length - 1;
}

/** ms 시간표의 지금 프레임. 반복이면 감고, 아니면 마지막 프레임에 머문다. */
export function timedFrame(t: Timed, ms: number, loop: boolean): number {
  return t.frames[timedIndex(t, ms, loop)]!;
}

/** 이번 프레임에 그릴 물건 그림. 엔진은 back → (캐릭터 + overlays를 발 y로 섞기) → front 순서로 그린다(6절). */
export interface SceneDraws {
  /** 프레임 번호 또는 효과 자리(11절). 적은 순서대로 그린다. */
  back: (number | SceneFxDraw)[];
  front: number[];
  overlays: { sortY: number; frame: number }[];
  /**
   * 머리 위 칸(16절): `front` 다음, 사람 위에 그 캐릭터 얼굴 상자 기준으로 그린다(`headPlace`). 적은 순서대로.
   * 제자리가 아니라서 `byObject`(외곽선·끄덕임)와 덮개(`coverFrames`)에 안 들어간다.
   */
  heads: { frame: number; char: CharacterId }[];
  /** 물건 키 → 이번 프레임에 그 물건이 그리는 프레임(앞판 포함). 호버 외곽선(10-1절)이 쓴다. */
  byObject: Record<string, number[]>;
}

export interface SceneView {
  /** 물건 키 → 그 물건의 보이는 플래그(4-2절). */
  flagsOf(objectKey: string): Flags;
  /** 재생 중인 물건 anim(이미 고른 갈래)과 시작 뒤 지난 ms. 없으면 null. */
  playing: { object: string; anim: SceneAnim; ms: number } | null;
  /** 물건 키 → 캐릭터 연출의 칸 신호로 겹쳐 재생 중인 물건 anim(#507)과 시작 뒤 지난 ms. `playing` 다음, `held`보다 먼저다. */
  cued?: Readonly<Record<string, { anim: SceneAnim; ms: number }>>;
  /**
   * 물건 키 → 끝났지만 붙들고 있는 `hold` anim(13절)과 그 anim 시작 뒤 지난 ms(길이보다 크다). 재생 중인 anim이 먼저다.
   * 그림 물건은 마지막 칸, 효과 자리는 그 연출 모드를 시계를 계속 돌려 그린다.
   */
  held?: Readonly<Record<string, { anim: SceneAnim; ms: number }>>;
  /** 화면 시계(ms). `loop`용. 반복끼리 박자는 맞추지 않는다(4절). */
  clockMs: number;
  /** 물건별 loop 시작 시각(`loopStarts`). 없으면 화면 시계 0부터 센다. */
  loopStarts?: LoopStarts;
  /** 물건 키 → 지금 보이는 기울기 d(12절). 없거나 0이면 멈춘 모습 그대로. */
  tiltOf?(objectKey: string): number;
  /**
   * 물건 키 → 그 물건이 가리키는 핫스팟이 전부 화면에 없나(`HotspotDef.present`, ADR-1031). 참이면 멈춘 모습을 안 그린다
   * (`frame: null`과 같음). 그 물건 anim이 재생 중이거나 붙들려 있으면 anim이 먼저다(빨려 들어가는 칸 등). 없으면 늘 거짓.
   */
  absent?(objectKey: string): boolean;
}

/** 기울기 d일 때 열 x가 내려간 px(12절). 그림 원본의 널빤지 함수와 같은 식이다. */
export function tiltDrop(t: SceneTilt, d: number, x: number): number {
  return d === 0 ? 0 : Math.round((d * (x - t.pivot)) / t.run);
}

/** 멈춘 기울기 칸. d가 0이거나 그 칸이 없으면 null(멈춘 모습 그대로). */
export function tiltFrame(o: SceneObject, d: number): number | null {
  return d === 0 ? null : (o.tilt?.frames[String(d)] ?? null);
}

/** 이 물건이 지금 그리는 anim: 재생 중인 것, 칸 신호로 겹쳐 재생 중인 것(#507), 없으면 붙든 `hold` anim(13절). 없으면 null(멈춘 모습). */
function artNow(view: SceneView, objectKey: string): { anim: SceneAnim; ms: number } | null {
  const p = view.playing;
  if (p && p.object === objectKey) return p;
  return view.cued?.[objectKey] ?? view.held?.[objectKey] ?? null;
}

/** 물건 하나의 loop 시작. `pic`이 null이면 그 물건 anim 재생 중(또는 붙든 중)이다. 효과 자리는 멈춘 모드(`SceneFxMode`)다. */
export interface LoopStart {
  pic: ScenePicture | SceneFxMode | null;
  atMs: number;
}
export type LoopStarts = Readonly<Record<string, LoopStart>>;

/**
 * 물건별 loop 시작 시각을 갱신한다(#237). 렌더마다 한 번 부르고 결과를 다음 렌더에 넘긴다.
 * 그 물건의 anim이 끝나거나 멈춘 모습(state)이 바뀐 프레임부터 0으로 센다. 그래서 anim 끝 칸 → loop 첫 칸
 * (= 멈춘 모습 `frame`)으로 이어지고, 도착하자마자 loop 중간 칸이 튀어나오지 않는다. 물건끼리 박자는 여전히 안 맞춘다(4절).
 */
export function loopStarts(meta: SceneArtMeta, view: SceneView, prev: LoopStarts): LoopStarts {
  const out: Record<string, LoopStart> = {};
  for (const o of meta.objects) {
    const flags = view.flagsOf(o.key);
    const pic = artNow(view, o.key) ? null : isFxObject(o) ? pictureOf(o, flags) : pictureOf(o, flags);
    const p = prev[o.key];
    out[o.key] = p && p.pic === pic ? p : { pic, atMs: view.clockMs };
  }
  return out;
}

/**
 * 물건마다 그릴 프레임을 고른다. 적은 순서 = 같은 층 안에서 뒤 → 앞.
 * anim 재생 중인 물건은 멈춘 모습·`loop` 대신 anim 프레임을 그린다(4절). `overlay`(앞판)는 anim 중에도 그린다.
 * 기울기 칸(12절)이 있으면 멈춘 모습 대신 그 칸을 같은 층에 그린다. anim이 기울기보다 앞선다(U6 튕김).
 */
export function sceneDraws(meta: SceneArtMeta, view: SceneView): SceneDraws {
  const out: SceneDraws = { back: [], front: [], overlays: [], heads: [], byObject: {} };
  for (const o of meta.objects) {
    const p = artNow(view, o.key);
    if (isFxObject(o)) {
      // 11절: 효과 자리는 늘 back, 적은 자리에서 그린다. 연출 중이면 anim 시작부터, 아니면 그 모드가 된 때부터 센다.
      // 붙든 효과(13절)는 시계가 길이를 넘어 계속 간다(burst는 on 높이로 계속 뿜는다).
      const playing = p;
      const mode = playing ? (playing.anim.mode ?? 'off') : pictureOf(o, view.flagsOf(o.key)).mode;
      if (mode === 'off') continue;
      const slotMs = playing ? playing.ms : view.clockMs - (view.loopStarts?.[o.key]?.atMs ?? 0);
      const durMs = playing ? playing.anim.ms.reduce((a, b) => a + b, 0) : 0;
      out.back.push({ key: o.key, effect: o.effect, area: o.area, colors: o.colors, mode, clockMs: view.clockMs, slotMs, durMs });
      continue;
    }
    let frame: number;
    if (p?.anim.anchor) {
      // 16절: 머리 위 칸. 그동안 그 물건의 제자리 그림은 없다(anim이 멈춘 모습을 대신하는 4절 규칙 그대로).
      out.heads.push({ frame: timedFrame(p.anim, p.ms, false), char: p.anim.anchor.char });
      out.byObject[o.key] = [];
      continue;
    }
    if (p) {
      frame = timedFrame(p.anim, p.ms, false);
      out[p.anim.layer].push(frame);
    } else {
      const pic = pictureOf(o, view.flagsOf(o.key));
      if (pic.frame === null || view.absent?.(o.key)) {
        // 안 그리는 멈춘 모습(개정 9): 앞판도 없고 외곽선도 안 켜진다. 히트 박스·`coveredIds`는 그대로다(임시 상자도 안 그린다).
        // 화면에 없는 물건(`absent`)도 같다. 그쪽은 히트 박스도 `hotspotBox`에서 빠진다.
        out.byObject[o.key] = [];
        continue;
      }
      const tilted = o.tilt && view.tiltOf ? tiltFrame(o, view.tiltOf(o.key)) : null;
      frame = tilted ?? (pic.loop ? timedFrame(pic.loop, view.clockMs - (view.loopStarts?.[o.key]?.atMs ?? 0), true) : pic.frame);
      out[pic.layer].push(frame);
    }
    out.byObject[o.key] = [frame];
    if (o.overlay) {
      out.overlays.push({ sortY: o.overlay.sortY, frame: o.overlay.frame });
      out.byObject[o.key]!.push(o.overlay.frame);
    }
  }
  return out;
}

/**
 * 대상을 맡은 물건의 멈춘 모습 그림 상자(`frames[].at` + 크기). 시트에 없거나 안 그리는 모습(`frame: null`)이면 null.
 * 높은 대상 앞에 설 때 몸이 그림을 가리는지 본다(#575).
 */
export function restingBox(meta: SceneArtMeta, target: string, flags: Flags): { left: number; top: number; width: number; height: number } | null {
  const o = objectOf(meta, target);
  const frame = o ? pictureOf(o, flags).frame : null;
  const f = frame === null ? undefined : meta.frames[frame];
  return f ? { left: f.at[0], top: f.at[1], width: f.src[2], height: f.src[3] } : null;
}

/**
 * 핫스팟 화자 말풍선이 붙을 상자(13절, #450): 대상을 맡은 물건이 지금 anim(재생 중 또는 붙든 `hold`)을 그리면 그 칸 그림 상자
 * (`frames[].at` + 크기). 멈춘 모습이거나 시트에 없는 대상이면 null → 엔진은 지금처럼 핫스팟 상자를 쓴다.
 * 손님이 칸마다 `at`으로 달려오면 말풍선도 같이 온다.
 */
export function animFrameBox(meta: SceneArtMeta, view: SceneView, target: string): { left: number; top: number; width: number; height: number } | null {
  const o = objectOf(meta, target);
  const a = o ? artNow(view, o.key) : null;
  if (!a || a.anim.frames.length === 0 || a.anim.anchor) return null;
  const f = meta.frames[timedFrame(a.anim, a.ms, false)];
  return f ? { left: f.at[0], top: f.at[1], width: f.src[2], height: f.src[3] } : null;
}

/**
 * 머리 위 칸(16절) 하나를 그릴 자리. `face`는 그 캐릭터의 그린 얼굴 상자(`characterFaceBox`, 그리는 방향 그대로)다.
 * 칸 `at`은 얼굴 상자 위 가운데에서 잰 값이고, 왼쪽(`facing` -1)을 보면 그 가운데 세로줄로 좌우를 뒤집는다(`flip`).
 * 반환 x·y는 그린 그림의 왼쪽 위(화면 좌표). 칸이 없으면 null.
 */
export function headPlace(meta: SceneArtMeta, frame: number, face: HitBox, facing: 1 | -1): { x: number; y: number; w: number; h: number; flip: boolean } | null {
  const f = meta.frames[frame];
  if (!f) return null;
  const w = f.src[2];
  const h = f.src[3];
  const cx = face.left + Math.round(face.width / 2);
  const x = facing === 1 ? cx + f.at[0] : cx - f.at[0] - w;
  return { x, y: face.top + f.at[1], w, h, flip: facing === -1 };
}

/** 머리 위 칸 하나를 그릴 자리(`headPlace` 결과)와 그 칸·캐릭터. */
/**
 * 쭉이가 든 물건(ADR-1031 5절)을 그릴 칸과 자리. 칸은 그 물건(대상 ID를 맡은 그림 물건)의 지금 멈춘 모습(`pictureOf`)이라
 * 성질 플래그로 모습이 바뀌면(젖은 수건 등) 손에서도 같이 바뀐다. `at`은 `spriteCarry` 점: 그림의 아래 가운데를 맞춘다.
 * 가로는 `at.x − 폭/2`를 반올림한다(홀수 폭이면 반 px 오른쪽). 뒤집지 않는다(물건은 쭉이 방향과 상관없이 같은 모습).
 * 시트에 그 물건이 없거나 안 그리는 모습(`frame: null`)이면 null. 반환 x·y는 그린 그림의 왼쪽 위(화면 좌표).
 */
export function carriedPlace(
  meta: SceneArtMeta,
  item: string,
  flagsOf: (objectKey: string) => Flags,
  at: { x: number; y: number },
): { frame: number; x: number; y: number } | null {
  const o = objectOf(meta, item);
  const frame = o ? pictureOf(o, flagsOf(o.key)).frame : null;
  const f = frame === null ? undefined : meta.frames[frame];
  if (!f || frame === null) return null;
  return { frame, x: Math.round(at.x - f.src[2] / 2), y: at.y - f.src[3] };
}

/**
 * 내려놓은 물건(ADR-1031 4절, `SceneState.placed`)의 그림을 옮길 양. 대상 ID → 멈춘 모습 칸을 아래 가운데가 놓인 점에 오게 하는 dx·dy
 * (`carriedPlace`와 같은 셈). `frameNudges`에 넘기면 그 물건이 지금 그리는 칸(anim·앞판 포함)이 다 같이 옮겨진다.
 * 시트에 없거나 안 그리는 모습이면 뺀다(엔진은 옮긴 핫스팟 상자의 임시 상자를 그린다).
 */
export function placedShifts(
  meta: SceneArtMeta,
  placed: Readonly<Record<string, { x: number; y: number }>>,
  flagsOf: (objectKey: string) => Flags,
): Record<string, { dx: number; dy: number }> {
  const out: Record<string, { dx: number; dy: number }> = {};
  for (const [id, at] of Object.entries(placed)) {
    const p = carriedPlace(meta, id, flagsOf, at);
    const f = p ? meta.frames[p.frame] : undefined;
    if (p && f) out[id] = { dx: p.x - f.at[0], dy: p.y - f.at[1] };
  }
  return out;
}

export interface HeadPlaced {
  frame: number;
  char: CharacterId;
  at: { x: number; y: number; w: number; h: number; flip: boolean };
}

/**
 * 이번 프레임 머리 위 칸(16절) 전부를 그릴 자리에 놓는다. 적은 순서 그대로다. `faceOf`는 그 캐릭터의 그리는 얼굴 상자·방향
 * (`scene.ts` `headAnchor`)을 준다. 엔진은 이 자리에 그리고, 말풍선이 가리면 안 되는 상자(`headKeepBoxes`, #947)로도 쓴다.
 */
export function headPlaces(
  meta: SceneArtMeta,
  heads: SceneDraws['heads'],
  faceOf: (char: CharacterId) => { face: HitBox; facing: 1 | -1 },
): HeadPlaced[] {
  const out: HeadPlaced[] = [];
  for (const h of heads) {
    const { face, facing } = faceOf(h.char);
    const at = headPlace(meta, h.frame, face, facing);
    if (at) out.push({ frame: h.frame, char: h.char, at });
  }
  return out;
}

/**
 * 말풍선이 가리면 안 되는 머리 위 칸 상자(#947). 화자가 **아닌** 사람 머리 위 칸만이다: 빨래방 3-2에서 プピ가 말하는 동안
 * ズッシー 머리에 꽂힌 깃털이 웃음이다(설계 8-1 ④). 화자 자기 머리 위 칸은 넣지 않는다. 넣으면 화자 머리 위 자리가 늘 막혀
 * 말풍선이 옆으로만 간다. 단서와 같은 무게(`toy` 아님)다.
 */
export function headKeepBoxes(placed: readonly HeadPlaced[], speaker: string): HitBox[] {
  return placed.filter((p) => p.char !== speaker).map((p) => ({ left: p.at.x, top: p.at.y, width: p.at.w, height: p.at.h }));
}

/**
 * 호버 외곽선을 켤 프레임(10-1절). 대상(hotspot·spot ID)을 맡은 물건이 이번 프레임에 그리는 것 전부.
 * 시소처럼 `ids`가 여럿이면 어느 쪽을 가리켜도 물건 전체가 켜진다(5절). 시트에 없는 대상(9절 폴백 상자)은 빈 집합.
 */
export function litFrames(meta: SceneArtMeta, draws: SceneDraws, target: string | null): Set<number> {
  const o = target === null ? null : objectOf(meta, target);
  return new Set(o ? (draws.byObject[o.key] ?? []) : []);
}

/** 시트가 그리는 대상 ID 전부. 엔진은 이 밖의 대상만 임시 상자로 그린다. */
export function coveredIds(meta: SceneArtMeta): Set<string> {
  return new Set(meta.objects.flatMap((o) => o.ids));
}

/**
 * 시트 프레임 하나를 제자리(`at`)에 그렸을 때 화면 정수 픽셀 (px, py)가 불투명인가(설계 2-1절 "물건 그림 아래 깔린 칸", #736).
 * `mask`는 물건 시트 이미지의 알파. 그 프레임이 없으면 false.
 */
export function frameOpaqueAt(meta: SceneArtMeta, mask: AlphaMask, frame: number, px: number, py: number): boolean {
  const f = meta.frames[frame];
  if (!f) return false;
  const [sx, sy, w, h] = f.src;
  const dx = px - f.at[0];
  const dy = py - f.at[1];
  if (dx < 0 || dy < 0 || dx >= w || dy >= h) return false;
  return opaqueAt(mask, sx + dx, sy + dy);
}

/**
 * 사람을 덮는 물건 프레임(설계 2-1절, #736). 그리기 순서(6절)대로 `front` 층은 늘 사람 위, 앞판(`overlays`)은 발 y가 `sortY` 이하인 사람 위다.
 * `front`에서 반복(`loop`)으로 그리는 멈춘 모습은 반복 칸 전부를 덮개로 친다. 반복 시계(`loopStarts`)는 엔진 상태라
 * 판정 쪽은 지금 몇 번째 칸인지 모른다(땅의 까치 7·8·9번은 칸 상자가 1px 안쪽으로만 다르다, #738 Theo 견적).
 */
export function coverFrames(meta: SceneArtMeta, view: SceneView): { front: number[]; overlays: { sortY: number; frame: number }[] } {
  const draws = sceneDraws(meta, view);
  const front = new Set(draws.front);
  for (const o of meta.objects) {
    if (isFxObject(o) || artNow(view, o.key)) continue;
    const pic = pictureOf(o, view.flagsOf(o.key));
    const drawn = draws.byObject[o.key]?.[0];
    if (pic.layer === 'front' && pic.loop && drawn !== undefined && pic.loop.frames.includes(drawn)) for (const f of pic.loop.frames) front.add(f);
  }
  return { front: [...front], overlays: draws.overlays };
}
