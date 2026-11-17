// 소리 글자 시트(`public/ui/fx-text.{png,json}`) 메타 해석과 글자 놓을 자리 (#284, `docs/design/ability-feedback.md` 2·3절).
// 순수 로직이다. 이미지 로드·그리기는 engine/fxText.ts. 시트는 `art/build.mjs`가 만든다(원본 art/ui/fx-text.mjs).
// 칸 기준점은 아래 가운데 `(floor(w/2), h)`. 메타가 틀리거나 칸이 없으면 엔진은 임시 별(drawSpark)을 그린다.

/** 칸 `[x, y, w, h]`(시트 안 px). */
export type FxCell = readonly [number, number, number, number];

export interface FxTextMeta {
  image: string;
  /** fx 이름(또는 부품 이름 `ting_spark`) → 칸. */
  cells: Readonly<Record<string, FxCell>>;
}

/** `キン` 옆 반짝 부품 칸 이름. fx가 아니다(3절 비고). */
export const TING_SPARK = 'ting_spark';
/** 반짝을 붙이는 fx. */
export const TING_FX = 'ting_text';
/** 떨어져 튀고 사라지는 fx(3절 표 "소리엔 무게가 없다"). */
export const BOUNCE_FX = 'squeak_bounce';

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function parseFxTextMeta(raw: unknown): FxTextMeta {
  const fail = (why: string): never => {
    throw new Error(`소리 글자 메타 오류: ${why}`);
  };
  const m = raw as { image?: unknown; anchor?: unknown; cells?: unknown } | null;
  if (typeof m !== 'object' || m === null) return fail('객체가 아님');
  if (typeof m.image !== 'string' || m.image === '') fail('image 없음');
  // 기준점 규칙이 바뀌면 자리 계산이 다 틀리므로 조용히 넘어가지 않는다.
  if (m.anchor !== 'bottom-center') fail(`anchor는 bottom-center여야 한다(지금 ${String(m.anchor)})`);
  if (typeof m.cells !== 'object' || m.cells === null) return fail('cells 없음');
  for (const [id, c] of Object.entries(m.cells as Record<string, unknown>)) {
    if (!Array.isArray(c) || c.length !== 4 || !c.every(isInt)) fail(`${id}: 칸은 정수 4개 [x, y, w, h]`);
    const [x, y, w, h] = c as number[];
    if (x! < 0 || y! < 0 || w! <= 0 || h! <= 0) fail(`${id}: 칸 값이 음수이거나 크기가 0`);
  }
  return { image: m.image as string, cells: m.cells as Record<string, FxCell> };
}

/**
 * 떨어져 튀기(`squeak_bounce`): 기준점에서 아래로 민 거리(px, 음수 = 위). 사라졌으면 null.
 * 0~5틱 8px 위에서 떨어져 닿고, 6~17틱 4px 튀었다 다시 닿고(12틱이 꼭대기), 18~23틱 닿은 채로 있다가 24틱에 사라진다.
 * fx 자체는 30틱 돈다(`FX_TICKS`). 글자만 먼저 지운다.
 */
export const BOUNCE_FALL = 8;
export const BOUNCE_HEIGHT = 4;
export const BOUNCE_GONE = 24;
export function bounceDy(t: number): number | null {
  if (t < 0 || t >= BOUNCE_GONE) return null;
  if (t < 6) return -Math.round((BOUNCE_FALL * (6 - t)) / 6);
  if (t < 18) {
    const u = (t - 12) / 6;
    return -Math.round(BOUNCE_HEIGHT * (1 - u * u));
  }
  return 0;
}

/** 글자 아래 끝을 기준점에서 몇 px 위에 두나(2절 위치: "4px 위", `drawSpark`와 같은 높이). */
export const TEXT_LIFT = 4;
/** 6틱마다 1px씩 위로 뜬다(2절 위치). */
export const RISE_EVERY = 6;

/**
 * fx 글자 한 칸을 그릴 왼쪽 위(내부 px). 안 그릴 때(튀기가 끝남)는 null.
 * - 보통: 칸 아래 가운데를 `at`에서 `TEXT_LIFT` 위에 맞추고, 6틱마다 1px 뜬다.
 * - `squeak_bounce`: 칸 아래 가운데를 `at`(대상 위 끝 = 시소 판)에 맞추고 `bounceDy`만큼 움직인다. 뜨지 않는다.
 * - 화면 끝: 칸이 화면 밖으로 나가지 않게 왼쪽·오른쪽·위를 붙잡는다(둥지·고리처럼 화면 위쪽 대상).
 */
export function fxTextAt(effect: string, cell: FxCell, at: { x: number; y: number }, t: number, screenW: number): { x: number; y: number } | null {
  const [, , w, h] = cell;
  let bottom: number;
  if (effect === BOUNCE_FX) {
    const dy = bounceDy(t);
    if (dy === null) return null;
    bottom = Math.round(at.y) + dy;
  } else {
    bottom = Math.round(at.y) - TEXT_LIFT - Math.floor(t / RISE_EVERY);
  }
  const x = Math.min(Math.max(Math.round(at.x) - Math.floor(w / 2), 0), Math.max(screenW - w, 0));
  const y = Math.max(bottom - h, 0);
  return { x, y };
}

/** 반짝 켜짐/꺼짐 주기(틱). 3절 비고 "6틱마다 켜짐/꺼짐". */
export const SPARK_BLINK = 6;

/**
 * `キン` 옆 반짝 부품의 왼쪽 위. 꺼진 틱이면 null.
 * 글자 칸 오른쪽 위 모서리에 반짝 가운데가 오게 둔다(PR #298 "글자 오른쪽 위"). 화면 밖이면 안으로 붙잡는다.
 */
export function tingSparkAt(word: { x: number; y: number }, wordCell: FxCell, sparkCell: FxCell, t: number, screenW: number): { x: number; y: number } | null {
  if (Math.floor(t / SPARK_BLINK) % 2 === 1) return null;
  const [, , ww] = wordCell;
  const [, , sw, sh] = sparkCell;
  const x = Math.min(word.x + ww - Math.floor(sw / 2), screenW - sw);
  const y = Math.max(word.y - Math.floor(sh / 2), 0);
  return { x, y };
}
