// 화면 배경·물건 그림 메타 해석과 "지금 무엇을 그리나" 고르기 (#157 10절 2단계).
// 형식: docs/decisions/2026-11-16-scene-art-format-v1.md (개정 1 포함). 메타는 art/scene-build.mjs가 만든다.
// 순수 로직이다. 이미지 로드·그리기는 engine/sceneArt.ts.
//
// - 멈춘 모습: 그 물건의 "보이는 플래그"(4-2절)로 `when` 첫 일치, 없으면 `default`. 반복(`loop`)은 화면 시계로 고르되,
//   그 물건의 anim이 끝나거나 멈춘 모습이 바뀐 때부터 0으로 센다(#237, `loopStarts`).
// - 일시 연출: 재생 중인 anim 이벤트가 그 물건 ID면 anim 프레임이 멈춘 모습을 대신한다(4절). 갈래는 anim 직전 보이는 플래그(4-1절).
// - 시트에 없는 대상은 null → 엔진이 임시 상자를 그린다(9절 폴백).

import { TICK_MS } from './config';

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

export interface SceneObject {
  key: string;
  ids: string[];
  default: ScenePicture;
  states?: (ScenePicture & { when: When })[];
  overlay?: { sortY: number; frame: number };
}

export interface SceneAnim extends Timed {
  layer: Layer;
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
  for (const [i, o] of m.objects.entries()) {
    const w = `objects[${i}]`;
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
  }
  if (!isObj(m.anims)) return fail('anims 없음');
  for (const [name, a] of Object.entries(m.anims)) {
    timed(a, `anims['${name}']`);
    layer(a.layer, `anims['${name}']`);
    if (a.object !== null && !m.objects.some((o) => o.key === a.object)) fail(`anims['${name}'].object`);
    for (const [j, v] of (a.variants ?? []).entries()) {
      timed(v, `anims['${name}'].variants[${j}]`);
      layer(v.layer, `anims['${name}'].variants[${j}]`);
      when(v.when, `anims['${name}'].variants[${j}]`);
    }
  }
  return m as SceneArtMeta;
}

const matches = (w: When, flags: Flags): boolean => Object.entries(w.flags).every(([k, v]) => (flags[k] ?? false) === v);

/** 대상 ID(hotspot·spot) → 그 대상을 맡은 물건. 없으면 null(임시 상자). */
export function objectOf(meta: SceneArtMeta, target: string): SceneObject | null {
  return meta.objects.find((o) => o.ids.includes(target)) ?? null;
}

/** 멈춘 모습: `when` 첫 일치, 없으면 `default`(4절, hotspot `variants`와 같은 규칙). */
export function pictureOf(o: SceneObject, flags: Flags): ScenePicture {
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

/** ms 시간표의 지금 프레임. 반복이면 감고, 아니면 마지막 프레임에 머문다. */
export function timedFrame(t: Timed, ms: number, loop: boolean): number {
  const total = t.ms.reduce((a, b) => a + b, 0);
  let rest = loop ? ((ms % total) + total) % total : Math.max(0, ms);
  for (let i = 0; i < t.frames.length; i++) {
    rest -= t.ms[i]!;
    if (rest < 0) return t.frames[i]!;
  }
  return t.frames[t.frames.length - 1]!;
}

/** 이번 프레임에 그릴 물건 그림. 엔진은 back → (캐릭터 + overlays를 발 y로 섞기) → front 순서로 그린다(6절). */
export interface SceneDraws {
  back: number[];
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
}

/** 물건 하나의 loop 시작. `pic`이 null이면 그 물건 anim 재생 중이다. */
export interface LoopStart {
  pic: ScenePicture | null;
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
    const pic = view.playing?.object === o.key ? null : pictureOf(o, view.flagsOf(o.key));
    const p = prev[o.key];
    out[o.key] = p && p.pic === pic ? p : { pic, atMs: view.clockMs };
  }
  return out;
}

/**
 * 물건마다 그릴 프레임을 고른다. 적은 순서 = 같은 층 안에서 뒤 → 앞.
 * anim 재생 중인 물건은 멈춘 모습·`loop` 대신 anim 프레임을 그린다(4절). `overlay`(앞판)는 anim 중에도 그린다.
 */
export function sceneDraws(meta: SceneArtMeta, view: SceneView): SceneDraws {
  const out: SceneDraws = { back: [], front: [], overlays: [], byObject: {} };
  for (const o of meta.objects) {
    const p = view.playing;
    let frame: number;
    if (p && p.object === o.key) {
      frame = timedFrame(p.anim, p.ms, false);
      out[p.anim.layer].push(frame);
    } else {
      const pic = pictureOf(o, view.flagsOf(o.key));
      frame = pic.loop ? timedFrame(pic.loop, view.clockMs - (view.loopStarts?.[o.key]?.atMs ?? 0), true) : pic.frame;
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
