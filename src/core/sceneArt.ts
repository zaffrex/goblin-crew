// 화면 배경·물건 그림 메타 해석과 "지금 무엇을 그리나" 고르기 (#157 10절 2단계).
// 형식: docs/decisions/2026-11-16-scene-art-format-v1.md (개정 1 포함). 메타는 art/scene-build.mjs가 만든다.
// 순수 로직이다. 이미지 로드·그리기는 engine/sceneArt.ts.
//
// - 멈춘 모습: 그 물건의 "보이는 플래그"(4-2절)로 `when` 첫 일치, 없으면 `default`. 반복(`loop`)은 화면 시계로 고르되,
//   그 물건의 anim이 끝나거나 멈춘 모습이 바뀐 때부터 0으로 센다(#237, `loopStarts`).
// - 일시 연출: 재생 중인 anim 이벤트가 그 물건 ID면 anim 프레임이 멈춘 모습을 대신한다(4절). 갈래는 anim 직전 보이는 플래그(4-1절).
// - 시트에 없는 대상은 null → 엔진이 임시 상자를 그린다(9절 폴백).
// - 효과 자리(11절, 개정 4): 그림 없이 엔진 입자를 `back` 안 그 순서에 끼운다. 대상 ID가 없다(클릭·외곽선 밖).

import { TICK_MS } from './config';
import { SCENE_FX, type SceneFxDraw } from './sceneFx';

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
  frame: number;
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
  step: number;
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
  const picture = (p: Partial<ScenePicture> | undefined, where: string): void => {
    if (!isObj(p)) return fail(where);
    frame(p.frame, where);
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
    if (typeof o?.key !== 'string' || !Array.isArray(o.ids) || o.ids.length === 0 || !o.ids.every((t) => typeof t === 'string')) fail(`${w}: key·ids`);
    picture(o.default, `${w}.default`);
    for (const [j, s] of (o.states ?? []).entries()) {
      picture(s, `${w}.states[${j}]`);
      when(s.when, `${w}.states[${j}]`);
    }
    if (o.overlay !== undefined) {
      if (!isInt(o.overlay.sortY)) fail(`${w}.overlay.sortY`);
      frame(o.overlay.frame, `${w}.overlay`);
    }
    if (o.tilt !== undefined) {
      const t = o.tilt as Partial<SceneTilt>;
      const pos = (v: unknown): boolean => isInt(v) && v > 0;
      if (!isObj(t) || !pos(t.step) || !pos(t.run) || typeof t.pivot !== 'number' || !isObj(t.weight) || !Object.values(t.weight).every(pos)) fail(`${w}.tilt`);
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
  for (const [name, a] of Object.entries(m.anims)) {
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
      layer(v.layer, `anims['${name}'].variants[${j}]`);
      animTilt(v, `anims['${name}'].variants[${j}]`);
      when(v.when, `anims['${name}'].variants[${j}]`);
    }
  }
  return m as SceneArtMeta;
}

const matches = (w: When, flags: Flags): boolean => Object.entries(w.flags).every(([k, v]) => (flags[k] ?? false) === v);

/** 대상 ID(hotspot·spot) → 그 대상을 맡은 물건. 없으면 null(임시 상자). 효과 자리는 ID가 없어서 나오지 않는다. */
export function objectOf(meta: SceneArtMeta, target: string): ScenePictureObject | null {
  return (meta.objects.find((o) => !isFxObject(o) && o.ids.includes(target)) as ScenePictureObject | undefined) ?? null;
}

/** 멈춘 모습(효과 자리면 멈춘 모드): `when` 첫 일치, 없으면 `default`(4절, hotspot `variants`와 같은 규칙). */
export function pictureOf<P>(o: { default: P; states?: (P & { when: When })[] }, flags: Flags): P {
  return o.states?.find((s) => matches(s.when, flags)) ?? o.default;
}

/** `[대상, 이름]` anim → 그 물건과 고른 갈래. 시트에 없으면 null. 갈래는 anim 직전 보이는 플래그로 고른다(4-1절). */
export function animOf(meta: SceneArtMeta, target: string, name: string, flags: Flags): { object: string; anim: SceneAnim } | null {
  const a = meta.anims[`${target}.${name}`];
  if (!a || a.object === null) return null;
  return { object: a.object, anim: a.variants?.find((v) => matches(v.when, flags)) ?? a };
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
  /** 물건 키 → 이번 프레임에 그 물건이 그리는 프레임(앞판 포함). 호버 외곽선(10-1절)이 쓴다. */
  byObject: Record<string, number[]>;
}

export interface SceneView {
  /** 물건 키 → 그 물건의 보이는 플래그(4-2절). */
  flagsOf(objectKey: string): Flags;
  /** 재생 중인 물건 anim(이미 고른 갈래)과 시작 뒤 지난 ms. 없으면 null. */
  playing: { object: string; anim: SceneAnim; ms: number } | null;
  /** 화면 시계(ms). `loop`용. 반복끼리 박자는 맞추지 않는다(4절). */
  clockMs: number;
  /** 물건별 loop 시작 시각(`loopStarts`). 없으면 화면 시계 0부터 센다. */
  loopStarts?: LoopStarts;
  /** 물건 키 → 지금 보이는 기울기 d(12절). 없거나 0이면 멈춘 모습 그대로. */
  tiltOf?(objectKey: string): number;
}

/** 기울기 d일 때 열 x가 내려간 px(12절). 그림 원본의 널빤지 함수와 같은 식이다. */
export function tiltDrop(t: SceneTilt, d: number, x: number): number {
  return d === 0 ? 0 : Math.round((d * (x - t.pivot)) / t.run);
}

/** 멈춘 기울기 칸. d가 0이거나 그 칸이 없으면 null(멈춘 모습 그대로). */
export function tiltFrame(o: SceneObject, d: number): number | null {
  return d === 0 ? null : (o.tilt?.frames[String(d)] ?? null);
}

/** 물건 하나의 loop 시작. `pic`이 null이면 그 물건 anim 재생 중이다. 효과 자리는 멈춘 모드(`SceneFxMode`)다. */
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
    const pic = view.playing?.object === o.key ? null : isFxObject(o) ? pictureOf(o, flags) : pictureOf(o, flags);
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
  const out: SceneDraws = { back: [], front: [], overlays: [], byObject: {} };
  for (const o of meta.objects) {
    const p = view.playing;
    if (isFxObject(o)) {
      // 11절: 효과 자리는 늘 back, 적은 자리에서 그린다. 연출 중이면 anim 시작부터, 아니면 그 모드가 된 때부터 센다.
      const playing = p && p.object === o.key ? p : null;
      const mode = playing ? (playing.anim.mode ?? 'off') : pictureOf(o, view.flagsOf(o.key)).mode;
      if (mode === 'off') continue;
      const slotMs = playing ? playing.ms : view.clockMs - (view.loopStarts?.[o.key]?.atMs ?? 0);
      const durMs = playing ? playing.anim.ms.reduce((a, b) => a + b, 0) : 0;
      out.back.push({ key: o.key, effect: o.effect, area: o.area, colors: o.colors, mode, clockMs: view.clockMs, slotMs, durMs });
      continue;
    }
    let frame: number;
    if (p && p.object === o.key) {
      frame = timedFrame(p.anim, p.ms, false);
      out[p.anim.layer].push(frame);
    } else {
      const pic = pictureOf(o, view.flagsOf(o.key));
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
