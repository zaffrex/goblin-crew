// 효과(fx) 표: 특기 시그니처, fx별 칠·높이·길이, 쿵 흔들림·먼지 (`docs/design/ability-feedback.md` 2·3절, #284).
// 순수 로직이다. 엔진(main.ts)은 이 값으로 그리기만 한다. 글자 그림 시트(`fx-text`)가 들어오기 전에는 칠 색만 다른 임시 별이다.

import type { CharacterId } from './characters';
import type { ShowItem } from './puzzle/types';

/** 보송 32색 중 fx가 쓰는 색(`docs/design/art/bosong-32.hex`). 32색 밖의 색을 만들지 않으려고 이름으로만 고른다. */
export const FX_COLORS = {
  ink: '#1b1720',
  dusk: '#5e5068',
  lint: '#b9adb5',
  white: '#fff8ee',
  redL: '#f0766b',
  woodL: '#c48a52',
  yelL: '#fff1a8',
  tealM: '#5a93a8',
} as const;
export type FxColor = keyof typeof FX_COLORS;

/** 다른 fx의 길이(틱). 예전 `TIMING.fx`. */
export const FX_TICKS = 30;
/** 시그니처 글자의 길이(틱, 0.6초). 2절 "소리 글자는 0.6초 이상 보인다". */
export const SIGNATURE_TICKS = 36;

/**
 * 특기 시그니처(2절 표). 특기 연출(`anims`) 바로 뒤에는 늘 이 fx가 온다(5절 검사). 캐릭터 정의 옆 한 곳에 둔다.
 * `squeak_text`는 원래 있던 fx라 이름 그대로 쓴다.
 */
export const SIGNATURES: Readonly<Record<CharacterId, { anims: readonly string[]; fx: string }>> = {
  jjuk: { anims: ['common.reach_wobble', 'reach_hang_up', 'common.stretch'], fx: 'stretch_text' },
  mukjik: { anims: ['common.stomp'], fx: 'stomp_text' },
  ppik: { anims: ['common.squeeze_chicken'], fx: 'squeak_text' },
};

/** 3절 표: 소리 글자 fx의 글자 칠과 높이(px). 표에 없는 fx(물건 그림, P1 #286)는 임시 별 기본색이다. */
export const FX_STYLE: Readonly<Record<string, { color: FxColor; height: number }>> = {
  squeak_text: { color: 'yelL', height: 8 },
  small_squeak_text: { color: 'lint', height: 6 },
  kkak_text: { color: 'white', height: 8 },
  ting_text: { color: 'white', height: 8 },
  clang_text: { color: 'yelL', height: 8 },
  creak_text: { color: 'woodL', height: 8 },
  squeak_bounce: { color: 'yelL', height: 8 },
  stretch_text: { color: 'redL', height: 8 },
  stomp_text: { color: 'tealM', height: 10 },
};

const SIGNATURE_FX = new Set(Object.values(SIGNATURES).map((s) => s.fx));

/** 이 fx가 도는 틱 수. 시그니처는 0.6초, 나머지는 예전 그대로. */
export function fxTicks(effect: string): number {
  return SIGNATURE_FX.has(effect) ? SIGNATURE_TICKS : FX_TICKS;
}

/** 2-1절 화면 흔들림: 3틱마다 y +2, −2, +1, −1, 0(합 15틱). 장면 층만 세로로 흔든다. */
const SHAKE_Y = [2, -2, 1, -1, 0] as const;
export const SHAKE_TICKS = SHAKE_Y.length * 3;

/** 흔들림을 내는 fx. 쿵에만 쓴다(멀미 리스크, 2-1절). */
export const SHAKE_FX = 'stomp_text';

/** fx 시작 뒤 t틱일 때 장면 층 y 오프셋(px). 흔들림이 끝났거나 흔드는 fx가 아니면 0. */
export function shakeOffset(effect: string, t: number): number {
  if (effect !== SHAKE_FX || t < 0 || t >= SHAKE_TICKS) return 0;
  return SHAKE_Y[Math.floor(t / 3)]!;
}

/** 2-1절 발밑 먼지: 12틱 동안 바깥으로 6px. 0~11틱이면 바깥으로 민 거리(px), 그 뒤면 null(사라짐). */
export const DUST_TICKS = 12;
export const DUST_PUSH = 6;
export function dustPush(t: number): number | null {
  if (t < 0 || t >= DUST_TICKS) return null;
  return Math.round((DUST_PUSH * t) / (DUST_TICKS - 1));
}

/** show 한 줄에서 [캐릭터, 연출] 또는 [fx, 대상]. 고른 줄이 아니면 null. */
function animOf(item: ShowItem): [string, string] | null {
  return 'anim' in item ? item.anim : null;
}
function fxOf(item: ShowItem): [string, string] | null {
  return 'fx' in item ? item.fx : null;
}

/**
 * 5절 검사: show에서 `[캐릭터, 그 캐릭터 특기 연출]` 바로 다음 줄이 그 캐릭터의 시그니처 fx가 아닌 곳.
 * 돌려주는 값은 show 안 순서(0부터)다. 비어 있으면 통과. 다음 화면에서 시그니처를 빠뜨리지 않게 하려는 검사다.
 * fx 이름만 본다. 대상(뜨는 자리)은 보통 그 캐릭터지만, 둥지에 삑(메아리 개그)처럼 대상 위에 띄우는 예외가 있다(PR #289 Luna 답).
 */
export function missingSignatures(show: readonly ShowItem[]): number[] {
  const out: number[] = [];
  show.forEach((item, i) => {
    const a = animOf(item);
    if (!a) return;
    const sig = (SIGNATURES as Record<string, { anims: readonly string[]; fx: string }>)[a[0]];
    if (!sig || !sig.anims.includes(a[1])) return;
    const next = show[i + 1] ? fxOf(show[i + 1]!) : null;
    if (!next || next[0] !== sig.fx) out.push(i);
  });
  return out;
}
