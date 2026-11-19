// 효과(fx) 표: 특기 시그니처, fx별 칠·높이·길이, 쿵 흔들림·먼지 (`docs/design/ability-feedback.md` 2·3절, #284).
// 순수 로직이다. 엔진(main.ts)은 이 값으로 그리기만 한다. 글자는 시트 `fx-text`(core/fxText.ts)로 그리고, `FX_STYLE.color`는 시트가 없을 때 임시 별 칠에만 쓴다.

import type { CharacterId } from './characters';
import { isDoHere, type RuleShowItem } from './puzzle/types';

/** 보송 32색 중 fx가 쓰는 색(`docs/design/art/bosong-32.hex`). 32색 밖의 색을 만들지 않으려고 이름으로만 고른다. */
export const FX_COLORS = {
  ink: '#1b1720',
  dusk: '#5e5068',
  lav: '#8a7d8f',
  lint: '#b9adb5',
  white: '#fff8ee',
  redL: '#f0766b',
  woodL: '#c48a52',
  tan: '#e8bd7e',
  pinkL: '#ffc6d6',
  yelL: '#fff1a8',
  tealM: '#5a93a8',
  aqua: '#d8f0ee',
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
  mukjik: { anims: ['common.stomp', 'seesaw_stomp'], fx: 'stomp_text' },
  ppik: { anims: ['common.squeeze_chicken'], fx: 'squeak_text' },
};

/** 3절 표: 소리 글자 fx의 글자 칠과 높이(px). 표에 없는 fx(물건 그림, P1 #286)는 임시 별 기본색이다. */
export const FX_STYLE: Readonly<Record<string, { color: FxColor; height: number }>> = {
  squeak_text: { color: 'yelL', height: 8 },
  small_squeak_text: { color: 'lint', height: 6 },
  kkak_text: { color: 'white', height: 8 },
  chirp_text: { color: 'white', height: 8 },
  ting_text: { color: 'white', height: 8 },
  clang_text: { color: 'yelL', height: 8 },
  creak_text: { color: 'woodL', height: 8 },
  squeak_bounce: { color: 'yelL', height: 8 },
  stretch_text: { color: 'redL', height: 8 },
  stomp_text: { color: 'tealM', height: 10 },
  gon_text: { color: 'lav', height: 10 },
  poof_text: { color: 'tan', height: 8 },
  quack_text: { color: 'white', height: 8 },
  kokee_text: { color: 'pinkL', height: 10 },
  shaa_text: { color: 'aqua', height: 8 },
};

/**
 * 소리 글자 자리 예외: 대상 ID → 글자 기준점(내부 px, `fxTextAt`의 `at`). 표에 없는 대상은 그림 위 끝 가운데다.
 * 둥지 하나만 둔다(#289 리스크 "위치 예외는 둥지 하나"). 둥지 위 끝 기준이면 글자가 까치 몸에 얹혀
 * "까치에게 삑 했는데 반응 없음"으로 읽혀 정답 #4를 가린다(PR #299 Luna 리뷰). 그래서 둥지 오른쪽 옆, 사발 높이:
 * 칸 왼쪽 x 173(상자 오른쪽 164 + 잔가지 7(그림 끝 x 170) + 틈 2), 칸 아래 y 42 → `squeak_text` 폭 31·`TEXT_LIFT` 4로 at = (188, 46).
 * 까치가 바닥에 내려온 뒤에도 같은 자리다. 데이터로 옮기는 건 #206(`{ do: "here" }`).
 */
export const FX_TEXT_SPOT: Readonly<Record<string, { x: number; y: number }>> = {
  nest: { x: 188, y: 46 },
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
function animOf(item: RuleShowItem): [string, string] | null {
  return 'anim' in item ? item.anim : null;
}
function fxOf(item: RuleShowItem): [string, string] | null {
  return 'fx' in item ? item.fx : null;
}

/**
 * 5절 검사: show에서 `[캐릭터, 그 캐릭터 특기 연출]` 바로 다음 줄이 그 캐릭터의 시그니처 fx가 아닌 곳.
 * 돌려주는 값은 show 안 순서(0부터)다. 비어 있으면 통과. 다음 화면에서 시그니처를 빠뜨리지 않게 하려는 검사다.
 * fx 이름만 본다. 대상(뜨는 자리)은 보통 그 캐릭터지만, 둥지에 삑(메아리 개그)처럼 대상 위에 띄우는 예외가 있다(PR #289 Luna 답).
 * 효과 위치 표시 `{ do: "here" }`(ADR-0065 5절)는 줄로 치지 않고 건너뛴다. `anim → 표시 → fx`도 통과다(PR #245 Ben 리뷰).
 */
export function missingSignatures(show: readonly RuleShowItem[]): number[] {
  const out: number[] = [];
  show.forEach((item, i) => {
    const a = animOf(item);
    if (!a) return;
    const sig = (SIGNATURES as Record<string, { anims: readonly string[]; fx: string }>)[a[0]];
    if (!sig || !sig.anims.includes(a[1])) return;
    const after = show.slice(i + 1).find((x) => !isDoHere(x));
    const next = after ? fxOf(after) : null;
    if (!next || next[0] !== sig.fx) out.push(i);
  });
  return out;
}
