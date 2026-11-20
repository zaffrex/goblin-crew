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

/** 소리 글자 자리 예외의 값: 고정 기준점(내부 px, `fxTextAt`의 `at`) 또는 `'actor'`(행동한 캐릭터 쪽 대상 끝, `actorEdgeAt`). */
export type FxTextSpot = { x: number; y: number } | 'actor';

/**
 * 소리 글자 자리 예외. 키는 `대상 ID`(그 대상에 뜨는 글자 전부) 또는 `효과@대상 ID`(그 글자만, 먼저 본다).
 * 표에 없으면 대상 그림 위 끝 가운데다.
 *
 * - `nest`: 둥지 위 끝 기준이면 글자가 까치 몸에 얹혀 "까치에게 삑 했는데 반응 없음"으로 읽혀 정답 #4를 가린다(PR #299 Luna 리뷰).
 *   그래서 둥지 오른쪽 옆, 사발 높이: 칸 왼쪽 x 173(상자 오른쪽 164 + 잔가지 7(그림 끝 x 170) + 틈 2), 칸 아래 y 42
 *   → `squeak_text` 폭 31·`TEXT_LIFT` 4로 at = (188, 46). 까치가 바닥에 내려온 뒤에도 같은 자리다.
 * - `clang_text@fountain`(#530 할 일 3, #528): 테두리는 192px로 넓어서 가운데(x 224)에 띄우면 장대가 친 모서리에서 약 90px 떨어져
 *   "효과가 있었는지 모르겠다"로 읽혔다. ノビー가 선 쪽 테두리 끝, 장대 집게 바로 옆에 띄운다. 같은 `fountain`의 `シャー`(물소리)는 그대로다.
 * - `gon_text@fountain`(#528 실패 1·2, Luna 결정 2안): 위 끝 가운데(224, 180)면 글자 칸(y 약 166~176)이 앉은 ズッシー(`fountain_seat` x 220)
 *   가슴에 얹히고, `lav`가 어두운 동상 돌색과 섞여 "돌 덩어리"로 읽혔다. 단서 ②(흙은 `ぼふっ`)와 짝이 되게 엉덩이 오른쪽 테두리 흰 돌 위:
 *   `gon_text` 33×12·`TEXT_LIFT` 4로 시작 칸 x 250~283, y 182~194(테두리 앞면 y 180~198 안). 앉은 몸 오른쪽 끝(약 x 242)과 8px 띄운다.
 */
export const FX_TEXT_SPOT: Readonly<Record<string, FxTextSpot>> = {
  nest: { x: 188, y: 46 },
  'clang_text@fountain': 'actor',
  'gon_text@fountain': { x: 266, y: 198 },
};

/** 이 글자(효과·대상)의 자리 예외. `효과@대상`이 `대상`보다 먼저다. 없으면 null. */
export function fxTextSpot(effect: string, target: string): FxTextSpot | null {
  return FX_TEXT_SPOT[`${effect}@${target}`] ?? FX_TEXT_SPOT[target] ?? null;
}

/** `'actor'` 자리에서 글자 칸과 대상 상자 끝 사이 틈(px). 캐릭터 머리 위 글자(`ニューッ` 등)와 붙지 않게 한다. */
export const ACTOR_EDGE_GAP = 2;

/**
 * `'actor'` 자리의 기준점(`fxTextAt`의 `at`): 대상 상자 위 끝 높이, x는 캐릭터 x에 가장 가까운 곳.
 * 단 글자 칸(폭 `w`)이 상자 안에 `ACTOR_EDGE_GAP`만큼 들어오게 붙잡는다. 캐릭터가 상자 밖 오른쪽에 서면 칸 오른쪽 끝이
 * 상자 오른쪽 끝 − 틈이다(바닥 대상은 가장자리 옆에 서서 친다, ui-interaction 3절). 상자가 칸보다 좁으면 상자 가운데.
 */
export function actorEdgeAt(box: { left: number; top: number; width: number }, actorX: number, w: number): { x: number; y: number } {
  const half = w / 2 + ACTOR_EDGE_GAP;
  const lo = box.left + half;
  const hi = box.left + box.width - half;
  const x = lo > hi ? box.left + box.width / 2 : Math.min(Math.max(actorX, lo), hi);
  return { x, y: box.top };
}

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
