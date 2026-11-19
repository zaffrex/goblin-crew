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

/** 물줄기 가닥의 옆 퍼짐(−1 왼쪽 끝 ~ 1 오른쪽 끝). 가운데(0)는 가장 높이 솟는다. */
const STREAMS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1] as const;
const CENTER = 3;
/** 물방울 하나의 비행 시간(ms). 짧을수록 물이 빨라 보인다. stop은 이 시간 뒤 다 떨어져서 off와 같아진다. */
export const WATER_FLIGHT_MS = 800;
/** on 높이 = area 높이 ÷ 1.5. burst 꼭대기(×1.5)가 area 위 끝에 닿는다(#380 회색 배치 "위쪽 여유는 burst 몫"). */
const BURST_SCALE = 1.5;

/**
 * `fountain_water`(11-4절). area 아래 가운데에서 위로 뿜어 양옆으로 떨어지는 포물선 물방울 96개.
 * - on: 전부. off: 없음.
 * - stop: stop이 시작된 뒤(효과 자리 시계 0 이후)에 뿜을 물방울은 안 나온다 → 이미 뜬 물은 계속 떨어지고 물기둥이 아래부터 낮아진다.
 *   비행 시간(800ms)이 지나면 비어서 `off`와 같다(anim 900ms 끝 → off로 끊김 없이).
 * - burst: 꺼진 물에서 시작한다(엔딩 ③ 순서). 처음 (길이 − 비행 시간) 동안 뿜는 물은 최대 1.5배 높이로 솟고, 그 뒤는 on 높이다.
 *   anim이 끝날 때 떠 있는 물방울은 전부 on 높이라 `on` 첫 박자와 같다.
 */
function fountainWater(d: SceneFxDraw): FxParticle[] {
  const [ax, ay, aw, ah] = d.area;
  const [bright, mid, spray, shade] = d.colors;
  if (d.mode === 'off') return [];
  const cx = ax + aw / 2;
  const base = ay + ah;
  const onH = ah / BURST_SCALE;
  const T = WATER_FLIGHT_MS;
  const peakWindow = Math.max(0, d.durMs - T);
  const out: FxParticle[] = [];
  for (let i = 0; i < FX_MAX_PARTICLES; i++) {
    const age = (((d.clockMs + fxHash(i, 1) * T) % T) + T) % T;
    const born = d.slotMs - age; // 효과 자리 시계로 이 물방울을 뿜은 때
    let k = 1;
    if (d.mode === 'stop' && born > 0) continue;
    if (d.mode === 'burst') {
      if (born < 0) continue;
      if (born < peakWindow) k = 1 + (BURST_SCALE - 1) * Math.sin((Math.PI * born) / peakWindow);
    }
    const u = age / T;
    // 물줄기 7가닥(가운데 1 + 양옆 3씩). 가닥마다 같은 포물선을 타서 점선 같은 물 호가 읽힌다. 가닥 안에서 조금씩 흩는다.
    const stream = Math.floor(fxHash(i, 2) * STREAMS.length);
    const spread = STREAMS[stream]! + (fxHash(i, 3) - 0.5) * 0.08;
    const lift = (stream === CENTER ? 1 : 0.85) * (0.94 + 0.06 * fxHash(i, 5));
    const rising = u < 0.5;
    const size: 1 | 2 = rising || fxHash(i, 6) < 0.5 ? 2 : 1;
    const rawX = Math.round(cx + spread * (aw / 2 - 2) * u);
    const rawY = Math.round(base - onH * k * lift * 4 * u * (1 - u));
    const x = Math.min(Math.max(rawX, ax), ax + aw - size);
    const y = Math.min(Math.max(rawY, ay), base - size);
    let color = rising ? bright : mid;
    if (Math.abs(u - 0.5) < 0.07 || fxHash(i, 4) < 0.1) color = spray; // 꼭대기 물보라 + 군데군데 반짝
    else if (u > 0.85) color = shade; // 떨어지기 직전(테두리 안 물에 닿는 쪽)
    out.push({ x, y, size, color });
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
