// 화면 효과 자리의 입자 계산 (그림 형식 개정 4, docs/decisions/2026-11-16-scene-art-format-v1.md 11절, #425).
// 순수 로직이다. 엔진(engine/sceneArt.ts)은 여기서 받은 사각형을 팔레트 색으로 칠하기만 한다.
//
// - 결정적: 입자 위치는 (화면 시계 ms, 입자 번호) 해시로 고른다. Math.random을 쓰지 않는다(11-4절).
//   그래서 같은 틱이면 같은 픽셀이고, 재생 도구 스크린샷·그림 검사가 흔들리지 않는다.
// - 입자의 비행 위상은 **화면 시계**로, 모드의 진행(꺼짐·솟음)은 **효과 자리 시계**(anim 시작·모드 변경부터 0)로 센다.
//   두 시계를 나눠서 on → stop → off, burst → on이 끊기지 않고 이어진다(같은 화면 시계면 같은 입자가 같은 자리).
// - 픽셀은 `colors` 4색만, 1~2px 정수 사각형, 반투명 없음(ADR-0007). 효과 자리 하나에 입자 96개 이하.

/** 보송 32색(`docs/design/art/bosong-32.hex`, 번호 = 줄 번호). sceneFx.test.ts가 파일과 같은지 본다. */
export const BOSONG_32: readonly string[] = [
  '#1b1720', '#3a3142', '#5e5068', '#8a7d8f', '#b9adb5', '#e6dcd6', '#fff8ee', '#7a2c3a',
  '#c2404a', '#f0766b', '#5a3a2e', '#8e5c3b', '#c48a52', '#e8bd7e', '#b8953a', '#f2d65c',
  '#fff1a8', '#e88fb0', '#ffc6d6', '#2f4a3a', '#4f7a52', '#86b06a', '#c4dd8f', '#23394d',
  '#36607a', '#5a93a8', '#9cc9cf', '#d8f0ee', '#4b3a72', '#7c64b0', '#b9a3e3', '#ff9f43',
];

/**
 * 엔진 효과 표(11-4절). `still` = 멈춘 모드(default·state에 쓴다), `play` = 연출 모드(효과 anim에만 쓴다).
 * 빌드(art/scene-build.mjs `FX_MODES`)가 같은 표로 검사한다. 두 표가 같은지는 sceneFx.test.ts가 본다.
 */
export const SCENE_FX: Readonly<Record<string, { still: readonly string[]; play: readonly string[] }>> = {
  fountain_water: { still: ['on', 'off'], play: ['stop', 'burst'] },
};

/** 효과 자리 하나에 그리는 입자 상한(11-4절). */
export const FX_MAX_PARTICLES = 96;

/** 이번 프레임에 그릴 효과 자리 하나(`sceneDraws().back`의 한 항목). */
export interface SceneFxDraw {
  /** 효과 자리 물건 키(예: `water`). */
  key: string;
  effect: string;
  area: readonly [number, number, number, number];
  /** bosong-32 번호 4개: 물 밝음·물 중간·물보라 흰색·그림자. */
  colors: readonly [number, number, number, number];
  mode: string;
  /** 화면 시계(ms). 입자 비행 위상. */
  clockMs: number;
  /** 효과 자리 시계(ms). 연출 모드면 anim 시작부터, 멈춘 모드면 그 모드가 된 때부터. */
  slotMs: number;
  /** 연출 모드의 길이(anim ms). 멈춘 모드면 0. */
  durMs: number;
}

/** 칠할 사각형 하나. `color`는 bosong-32 번호. */
export interface FxParticle {
  x: number;
  y: number;
  size: 1 | 2;
  color: number;
}

/** (입자 번호, 소금) → [0, 1). 정수 섞기(xorshift-multiply). 같은 입력이면 늘 같다. */
export function fxHash(i: number, salt: number): number {
  let h = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
}

/**
 * 물줄기 가닥(#510). 가운데 기둥 1 + 양옆 호 2. 입자 96개를 가닥 셋에만 나눠서 가닥 하나가 점선 호로 이어져 보이게 한다.
 * (처음 7가닥 × 약 14개는 같은 호 위의 점 사이가 15~20px라 1배에서 "나무 앞 반짝이"로 읽혔다.)
 * - `spread`: 옆 퍼짐(−1 왼쪽 끝 ~ 1 오른쪽 끝). `lift`: on 높이에 곱하는 값(가운데가 가장 높다).
 * - `n`: 가닥의 물방울 수(합 = FX_MAX_PARTICLES). `phase`: 가닥끼리 물방울 높이가 나란히 서지 않게 미는 값.
 */
const STREAMS = [
  { spread: 0, lift: 1, n: 28, phase: 0 },
  { spread: -0.75, lift: 0.8, n: 34, phase: 0.31 },
  { spread: 0.75, lift: 0.8, n: 34, phase: 0.62 },
] as const;
/**
 * 물방울 하나의 비행 시간(ms). 짧을수록 물이 빨라 보인다.
 * 한 틱(60Hz)에 가는 거리가 가닥 안 물방울 간격의 0.4배쯤 아래여야 한다(#512). 넘으면 눈이 바로 뒤 물방울을 같은 물방울로 짝지어
 * 물이 노즐 쪽으로 거꾸로 빨려 들어가 보인다(바퀴살 착시). 양옆 호 34개면 34 × 16.7 / 1400 ≈ 0.41. 800ms일 때는 0.71이었다.
 * 그래서 연출 길이(stop 900ms, burst 1200ms)보다 길다. stop·burst는 이 값이 아니라 anim 길이 안에 끝나게 센다(아래 `fountainWater`).
 */
export const WATER_FLIGHT_MS = 1400;
/** on 높이 = area 높이 ÷ 1.5. burst 꼭대기(×1.5)가 area 위 끝에 닿는다(#380 회색 배치 "위쪽 여유는 burst 몫"). */
const BURST_SCALE = 1.5;

/**
 * `fountain_water`(11-4절). area 아래 가운데에서 위로 뿜어 양옆으로 떨어지는 포물선 물방울 96개.
 * - 가닥 안의 물방울은 비행 위상을 **고르게** 나눠 둔다(#510). 무작위 위상이면 뭉치고 비는 자리가 생겨 호가 끊긴다.
 *   해시는 물방울마다 높이를 조금(3%) 흔드는 데만 쓴다. 그래도 결정적이다(화면 시계와 번호만 본다).
 * - 흰색(물보라)은 호 꼭대기에만 쓴다. 예전의 "군데군데 무작위 흰 점"은 반짝이로 읽혀서 뺐다(#510).
 * - on: 전부. off: 없음.
 * - stop/burst는 비행 시간이 아니라 **anim 길이**(`durMs`) 안에 끝난다(#512). 보이는 경계(끊는 자리)가 노즐에서 물 끝까지
 *   `max(1, 비행 시간 ÷ 길이)` 배 빠르기로 훑는다. 물방울보다 조금 빨라서 경계 근처 물방울은 날다가 사라진다(2px라 1배에서 안 보인다).
 * - stop: 효과 자리 시계 t에서 `age ≥ t × 배`인 물방울만 남는다. t = 0이면 on과 같고, 물기둥이 아래부터 낮아지다가
 *   anim 끝(900ms)에 비어서 `off`와 같다(끊김 없이).
 * - burst: 꺼진 물에서 시작한다(엔딩 ③ 순서). `age ≤ t × 배`인 물방울만 나온다(노즐에서 물이 차오른다).
 *   높이 배율은 효과 자리 시계로 한꺼번에 정한다: `1 + 0.5 × sin(π t / 길이)`, 가운데에서 1.5배(area 위 끝), 끝에서 1이다.
 *   그래서 anim 끝에는 물방울이 다 나와 있고 on 높이라 `on` 첫 박자와 같다. 길이를 넘어 붙든 burst(13절)도 on과 같다.
 */
function fountainWater(d: SceneFxDraw): FxParticle[] {
  const [ax, ay, aw, ah] = d.area;
  const [bright, mid, spray, shade] = d.colors;
  if (d.mode === 'off') return [];
  const cx = ax + aw / 2;
  const base = ay + ah;
  const onH = ah / BURST_SCALE;
  const T = WATER_FLIGHT_MS;
  const dur = d.durMs > 0 ? d.durMs : T;
  /** 보이는 경계가 효과 자리 시계로 t ms일 때 지난 비행 나이(ms). 길이 끝에 T(전부)에 닿는다. */
  const front = Math.min(T, d.slotMs * Math.max(1, T / dur));
  const k = d.mode === 'burst' && d.slotMs < dur ? 1 + (BURST_SCALE - 1) * Math.sin((Math.PI * Math.max(0, d.slotMs)) / dur) : 1;
  const out: FxParticle[] = [];
  let i = 0; // 물방울 번호(해시 입력). 가닥을 지나도 이어서 센다.
  for (const s of STREAMS) {
    for (let j = 0; j < s.n; j++, i++) {
      const phase = (((d.clockMs / T + j / s.n + s.phase) % 1) + 1) % 1;
      const age = phase * T;
      if (d.mode === 'stop' && age < front) continue; // 경계보다 노즐 쪽 = stop 뒤에 뿜을 물
      if (d.mode === 'burst' && age > front) continue; // 경계보다 앞 = 아직 안 뿜은 물
      const u = age / T;
      const lift = s.lift * (0.97 + 0.03 * fxHash(i, 5));
      const size = 2;
      const rawX = Math.round(cx + s.spread * (aw / 2 - 2) * u);
      const rawY = Math.round(base - onH * k * lift * 4 * u * (1 - u));
      const x = Math.min(Math.max(rawX, ax), ax + aw - size);
      const y = Math.min(Math.max(rawY, ay), base - size);
      let color = u < 0.5 ? bright : mid;
      if (Math.abs(u - 0.5) < 0.07) color = spray; // 호 꼭대기 물보라
      else if (u > 0.85) color = shade; // 떨어지기 직전(테두리 안 물에 닿는 쪽)
      out.push({ x, y, size, color });
    }
  }
  return out;
}

const PARTICLES: Readonly<Record<string, (d: SceneFxDraw) => FxParticle[]>> = {
  fountain_water: fountainWater,
};

/** 효과 자리 하나의 이번 프레임 입자. 모르는 효과는 빈 목록(빌드 검사가 먼저 막는다, 11-2절). */
export function fxParticles(d: SceneFxDraw): FxParticle[] {
  return PARTICLES[d.effect]?.(d) ?? [];
}
