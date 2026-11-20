// 글자 아닌 fx(`ability-feedback.md` 3절 끝, #485): 물건 그림을 옮기는 변환(`hop`·`nod`·`rattle`)과 물 입자(`splash`·`ripple`).
// 순수 로직이다. 엔진(main.ts)은 여기서 받은 오프셋으로 그림을 옮겨 그리고, 입자 사각형을 팔레트 색으로 칠하기만 한다.
// - 새 칸 0. 물 입자는 물줄기(`fountain_water`, core/sceneFx.ts)와 같은 물 4색, 1~2px 정수 사각형, 반투명 없음(ADR-0007).
// - 결정적: 입자 위치는 (fx 시작 뒤 틱, 입자 번호) 해시로 고른다. 재생 도구 스크린샷이 흔들리지 않는다.
// - `shake`는 화면 1(`hook`·`basket`)에도 쓰여서 진마씨 재플레이 답 전에는 켜지 않는다(#485). 켤 때는 `NUDGE_FX`에 한 줄.
//   그래서 화면 2의 "물건 그림 2px 좌우 흔들기"는 새 이름 `rattle`로 쓴다(#556). 화면 1 `shake`를 켤 때 `shake: rattle`로 합친다.
// - 비둘기(`pigeons_up`·`pigeons_turn`)는 모양이 있어서 fx가 아니라 물건 anim `floor.pigeons_*`(시트 칸, #526)이다.

import { FX_TICKS } from './fx';
import { objectOf, type SceneArtMeta, type SceneDraws } from './sceneArt';
import { fxHash, type FxParticle } from './sceneFx';

/** 물건 그림 오프셋(px, 내부 좌표). */
export interface Nudge {
  dx: number;
  dy: number;
}

/** `nod`: 6틱마다 1px 숙였다 펴기를 두 번(0.5초 안). 숙인 칸만 y +1. */
function nod(t: number): Nudge {
  return { dx: 0, dy: Math.floor(t / 6) % 2 === 1 ? 1 : 0 };
}

/** `hop`: 처음 16틱 동안 위로 3px 포물선 한 번(놀라서 펄쩍), 나머지는 제자리. */
export const HOP_TICKS = 16;
export const HOP_PX = 3;
function hop(t: number): Nudge {
  if (t >= HOP_TICKS) return { dx: 0, dy: 0 };
  const u = t / HOP_TICKS;
  return { dx: 0, dy: -Math.round(HOP_PX * 4 * u * (1 - u)) };
}

/**
 * `rattle`: 물건 그림을 좌우 2px로 덜컹(`ability-feedback.md` 74줄 "흔들기 2px 좌우, 새 칸 없음", #556).
 * 3틱마다 한 칸, 2px 두 번 → 1px 두 번으로 잦아든 뒤 제자리(0.4초). 위아래로는 안 움직인다:
 * 쿵 화면 흔들림(`shakeOffset`, 세로)과 같은 틱에 겹쳐도 방향이 갈려서 따로 읽힌다.
 */
const RATTLE_X = [2, -2, 2, -2, 1, -1, 1, -1] as const;
export const RATTLE_TICKS = RATTLE_X.length * 3;
function rattle(t: number): Nudge {
  return { dx: t < RATTLE_TICKS ? RATTLE_X[Math.floor(t / 3)]! : 0, dy: 0 };
}

/** 물건 그림을 옮기는 fx(`ability-feedback.md` 3절 끝: 위로 포물선 / 1px 숙이기 / 좌우 2px). 표에 없는 fx는 옮기지 않는다. */
export const NUDGE_FX: Readonly<Record<string, (t: number) => Nudge>> = {
  hop,
  nod,
  rattle,
};

/** fx 시작 뒤 t틱일 때 그 대상의 오프셋. 옮기는 fx가 아니거나 끝났으면 null. */
export function nudgeOf(effect: string, t: number): Nudge | null {
  const f = NUDGE_FX[effect];
  if (!f || t < 0 || t >= FX_TICKS) return null;
  const n = f(t);
  return n.dx === 0 && n.dy === 0 ? null : n;
}

/** 지금 도는 fx들 → 대상 ID별 오프셋(같은 대상에 둘이면 더한다). 오프셋이 0인 대상은 넣지 않는다. */
export function fxNudges(fx: readonly { effect: string; target: string; t: number }[]): Record<string, Nudge> {
  const out: Record<string, Nudge> = {};
  for (const f of fx) {
    const n = nudgeOf(f.effect, f.t);
    if (!n) continue;
    const prev = out[f.target];
    out[f.target] = prev ? { dx: prev.dx + n.dx, dy: prev.dy + n.dy } : n;
  }
  return out;
}

/** 물 4색(bosong-32 번호): 밝음·중간·물보라 흰색·그림자. `park_fountain` 물줄기 `colors`와 같다. 입자는 앞의 셋만 쓴다(그림자 점은 얼굴 위 얼룩으로 읽힘, #486 리뷰). */
export const WATER_COLORS = [26, 25, 6, 24] as const;
const [BRIGHT, MID, SPRAY] = WATER_COLORS;

/**
 * 물벼락 방울 수, 중력(px/틱²), 처음 아래 속도(px/틱). 방울은 기준점 위 `SPLASH_TOP`~+`SPLASH_TOP_SPREAD`px에서
 * 틱 0~`SPLASH_STAGGER - 1`에 차례로 떨어지기 시작해, 기준점 아래 `SPLASH_FLOOR`px(어깨)에서 사라진다.
 * 가장 늦은 방울도 30틱 fx가 끝나기 4틱 전에는 다 떨어진다(공중에서 툭 끊기지 않게, #486 리뷰).
 */
export const SPLASH_DROPS = 32;
const SPLASH_G = 0.26;
const SPLASH_V0 = 0.6;
export const SPLASH_TOP = 30;
const SPLASH_TOP_SPREAD = 14;
const SPLASH_STAGGER = 7;
/** 기준점보다 이만큼 더 내려오면(어깨) 사라진다(px). */
const SPLASH_FLOOR = 12;

/**
 * `splash`: 물벼락(설계 `park_fountain.md` 3절 5번 "장대가 물줄기에 닿아 튕기고 물벼락", #525). 기준점(대상 머리 위끝 가운데)
 * 위 30~44px, 펴진 장대가 물줄기에 닿은 높이에서 물이 쏟아져 머리·어깨로 떨어진다. 위에서 좁게 시작해 내려오며 좌우로 벌어진다.
 * 방울은 아래로만 움직인다: 머리에서 솟는 방울은 쭉이 머리에서 물을 뿜는 것처럼 읽힌다(#486 리뷰).
 * 방울 절반과 머리 높이에 닿은 방울은 흰 물보라, 나머지는 밝은 물 → 중간 물. 어깨 바로 위까지는 2px.
 */
function splash(at: { x: number; y: number }, t: number): FxParticle[] {
  const out: FxParticle[] = [];
  for (let i = 0; i < SPLASH_DROPS; i++) {
    const age = t - (i % SPLASH_STAGGER);
    if (age < 0) continue;
    const spread = (fxHash(i, 11) * 2 - 1); // −1 왼쪽 ~ 1 오른쪽
    const top = at.y - SPLASH_TOP - Math.round(fxHash(i, 12) * SPLASH_TOP_SPREAD);
    const y = top + SPLASH_V0 * age + 0.5 * SPLASH_G * age * age;
    if (y > at.y + SPLASH_FLOOR) continue;
    const x = at.x + spread * (3 + 0.6 * age);
    // 배경이 어두운 동상·돌 테두리라 절반은 흰 물보라로 둔다(1배에서 물 색만으로는 묻힌다, #525 캡처).
    const color = y >= at.y - 4 || fxHash(i, 13) < 0.5 ? SPRAY : y < at.y - 18 ? BRIGHT : MID;
    out.push({ x: Math.round(x), y: Math.round(y), size: y < at.y + 4 || fxHash(i, 14) < 0.5 ? 2 : 1, color });
  }
  return out;
}

/** 물결 고리 하나의 점 수, 고리 둘째가 시작하는 틱, 퍼지는 속도(px/틱), 가장 큰 가로 반지름(px). */
const RIPPLE_DOTS = 16;
const RIPPLE_SECOND = 10;
const RIPPLE_SPEED = 0.6;
const RIPPLE_MAX_R = 16;

/**
 * `ripple`: 기준점(대상 아래 끝 가운데 = 물에 닿은 자리)에서 납작한 타원 고리 두 개가 차례로 퍼진다. 분수대 돌이 울릴 때 연못(#4).
 * 처음엔 흰 물보라, 커지면 밝은 물 → 중간 물로 옅어진다. 1px 점만 쓴다.
 */
function ripple(at: { x: number; y: number }, t: number): FxParticle[] {
  const out: FxParticle[] = [];
  for (const start of [0, RIPPLE_SECOND]) {
    const age = t - start;
    if (age < 0) continue;
    const rx = 2 + age * RIPPLE_SPEED;
    if (rx > RIPPLE_MAX_R) continue;
    const ry = Math.max(1, rx / 3);
    const color = rx < 5 ? SPRAY : rx < 10 ? BRIGHT : MID;
    for (let k = 0; k < RIPPLE_DOTS; k++) {
      const a = (k / RIPPLE_DOTS) * Math.PI * 2;
      out.push({ x: Math.round(at.x + Math.cos(a) * rx), y: Math.round(at.y + Math.sin(a) * ry), size: 1, color });
    }
  }
  return out;
}

/** 물 입자 fx. `anchor`는 엔진이 고를 기준점: `head` = 대상 머리 위끝 가운데, `foot` = 대상 상자 아래 끝 가운데. */
export const WATER_FX: Readonly<Record<string, { anchor: 'head' | 'foot'; particles: (at: { x: number; y: number }, t: number) => FxParticle[] }>> = {
  splash: { anchor: 'head', particles: splash },
  ripple: { anchor: 'foot', particles: ripple },
};

/** 물 입자 fx의 이번 프레임 입자. 물 fx가 아니거나 끝났으면 빈 목록. */
export function waterParticles(effect: string, at: { x: number; y: number }, t: number): FxParticle[] {
  const f = WATER_FX[effect];
  if (!f || t < 0 || t >= FX_TICKS) return [];
  return f.particles(at, t);
}

/**
 * 흙 3색(bosong-32 번호): 흙먼지 13 `e8bd7e`, 흙덩이 그늘 11 `8e5c3b`, 흙덩이 10 `5a3a2e`. `park_fountain` 흙길 바탕은 12 `c48a52`라
 * 바탕보다 밝은 먼지와 어두운 덩이만 쓴다. 바탕색 점은 안 보인다(#526 캡처에서 바탕 픽셀을 셌다).
 */
export const SOIL_COLORS = [13, 11, 10] as const;
const [DUST, CLOD_SHADE, CLOD] = SOIL_COLORS;
/** 흙먼지 덩이 수, 튀는 흙덩이 수. 먼지 덩이 하나는 입자 둘(밝은 몸 + 아래 그늘)이라 합이 64개, `FX_MAX_PARTICLES` 안이다. */
export const SOIL_DUST = 28;
export const SOIL_CLODS = 8;
/**
 * 기준점(발 아래 끝 가운데)에서 가장 높이 오르는 높이(px), 좌우로 가장 멀리 퍼지는 거리(px), 먼지가 처음 나오는 거리(px).
 * 낮고 넓게: 쿵 먼지(회색 2덩이, 2-1절)와 모양이 갈린다. 묵직이 발은 기준점 ±16px라 먼지는 발 옆 끝에서 나온다.
 */
export const SOIL_HIGH = 9;
export const SOIL_WIDE = 42;
export const SOIL_FROM = 12;

/**
 * `poof_text`의 흙먼지(#526, `ability-feedback.md` 3-1절): 발 양옆에서 흙먼지가 땅을 따라 **옆으로** 낮게 번지고, 흙덩이 몇 개가 작게 튀었다 떨어진다.
 * - 먼지 덩이: 2px 밝은 흙(13) 몸 + 바로 아래 2px 그늘(11). 바탕 흙에도 밝은 점(13)이 섞여 있어서 몸만 두면 1배에서 묻혔다(#526 첫 캡처).
 *   그늘을 받쳐 덩이로 읽히게 한다. 처음에 빨리, 나중에 느리게 번지며 살짝 떴다 가라앉고, 하나씩 꺼진다.
 * - 흙덩이: 진갈색(10), 포물선 한 번.
 * 발 밑(±`SOIL_FROM`px 안)에서는 그리지 않는다. 묵직이 발을 덮지 않는다.
 */
function soilPuff(at: { x: number; y: number }, t: number): FxParticle[] {
  const out: FxParticle[] = [];
  const ease = 1 - (1 - t / FX_TICKS) ** 2;
  for (let i = 0; i < SOIL_DUST; i++) {
    const life = Math.round(FX_TICKS * (0.65 + 0.35 * fxHash(i, 21)));
    if (t >= life) continue;
    const side = i % 2 === 0 ? -1 : 1;
    const reach = SOIL_FROM + 4 + (SOIL_WIDE - SOIL_FROM - 4) * fxHash(i, 22);
    const dx = SOIL_FROM + (reach - SOIL_FROM) * ease;
    const rise = Math.round((1 + (SOIL_HIGH - 3) * fxHash(i, 23)) * Math.sin(Math.PI * Math.min(1, t / life * 0.8 + 0.1)));
    const x = Math.round(at.x + side * dx) - (side < 0 ? 1 : 0);
    const y = at.y - 4 - rise;
    out.push({ x, y, size: 2, color: CLOD_SHADE }, { x, y: y + 2, size: 2, color: CLOD });
    if (fxHash(i, 24) < 0.5) out.push({ x, y: y - 1, size: 1, color: DUST });
  }
  for (let i = 0; i < SOIL_CLODS; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const flight = 14 + Math.round(8 * fxHash(i, 31));
    if (t >= flight) continue;
    const v = t / flight;
    const dx = SOIL_FROM + (6 + 14 * fxHash(i, 32)) * v;
    const lift = Math.round(SOIL_HIGH * (0.7 + 0.3 * fxHash(i, 33)) * 4 * v * (1 - v));
    const size = fxHash(i, 34) < 0.5 ? 2 : 1;
    out.push({ x: Math.round(at.x + side * dx) - (side < 0 ? size - 1 : 0), y: at.y - size - lift, size, color: CLOD });
  }
  return out;
}

/**
 * 글자와 함께 입자를 그리는 fx. 물 입자 fx와 달리 글자 시트 글자도 그대로 그린다(`drawnByShape`에 안 넣는다).
 * `ドスン` 묶음(2-1절)처럼 결과 글자 하나가 모양을 같이 나른다. 신호 하나 = fx 한 줄(5-2절)이라 둘을 따로 띄우면 시차가 생긴다.
 */
export const TEXT_PARTICLE_FX: Readonly<Record<string, { anchor: 'head' | 'foot'; particles: (at: { x: number; y: number }, t: number) => FxParticle[] }>> = {
  poof_text: { anchor: 'foot', particles: soilPuff },
};

/** 입자를 그리는 fx(물 입자 + 글자 곁 입자)의 표 한 줄. 없으면 undefined. */
export function particleFx(effect: string): { anchor: 'head' | 'foot'; particles: (at: { x: number; y: number }, t: number) => FxParticle[] } | undefined {
  return WATER_FX[effect] ?? TEXT_PARTICLE_FX[effect];
}

/** 입자를 그리는 fx의 이번 프레임 입자. 그런 fx가 아니거나 끝났으면 빈 목록. */
export function shapeParticles(effect: string, at: { x: number; y: number }, t: number): FxParticle[] {
  const f = particleFx(effect);
  if (!f || t < 0 || t >= FX_TICKS) return [];
  return f.particles(at, t);
}

/** 엔진이 임시 별을 그리지 않는 fx(여기서 그린다). */
export function drawnByShape(effect: string): boolean {
  return effect in NUDGE_FX || effect in WATER_FX;
}

/**
 * 대상 ID별 오프셋 → 이번 프레임 시트 칸 번호별 오프셋. 대상을 그리는 물건(`objectOf`)의 칸(`byObject`, 앞판 포함)이 다 같이 움직인다.
 * 시트가 그리지 않는 대상(임시 상자)은 엔진이 상자를 직접 옮긴다.
 */
export function frameNudges(meta: SceneArtMeta, draws: SceneDraws, nudges: Readonly<Record<string, Nudge>>): Map<number, Nudge> {
  const out = new Map<number, Nudge>();
  for (const [target, n] of Object.entries(nudges)) {
    const o = objectOf(meta, target);
    if (!o) continue;
    for (const f of draws.byObject[o.key] ?? []) out.set(f, n);
  }
  return out;
}
