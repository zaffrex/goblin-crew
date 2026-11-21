// HUD 배치 (docs/design/ui-interaction.md 6절). 480×270 내부 px.
// 그리기(엔진)와 입력 판정(interact.ts)이 이 숫자 하나만 쓴다. 따로 계산하면 그림과 판정이 어긋난다.

import { CHARACTERS, characterDef, type CharacterId } from './characters';
import { INTERNAL_WIDTH } from './config';
import { inBox, type HitBox } from './hit';
import { GAUGE_MAX } from './puzzle/types';
import type { Point } from './viewport';

export type HudId = `char.${CharacterId}`;

const SLOT = 28;
const slot = (left: number, top: number): HitBox => ({ left, top, width: SLOT, height: SLOT });

/**
 * 캐릭터 칸: 쭉이 / 묵직이 / 삑삑이, (300,4)부터 37px 간격(x 300 / 337 / 374, 끝 402). 동사 버튼·아이템 칸은 없다(설계 6-4-2절, #311).
 * 간격은 얼굴 이름표가 사람 이름(`ズッシー` 4자)이 되면서 32 → 37(#676). 32면 1.0배에서 `ノビー`–`ズッシー`가 겹친다.
 */
export const CHAR_SLOT_STEP = 37;
export const CHAR_SLOTS: Readonly<Record<CharacterId, HitBox>> = Object.fromEntries(
  CHARACTERS.map((c, i) => [c.id, slot(300 + CHAR_SLOT_STEP * i, 4)]),
) as Record<CharacterId, HitBox>;

/**
 * 게이지 띠(설계 6-3-2절, #312): 화면 맨 아래 14px(y 256–269). 왼쪽은 이름표, 오른쪽은 막대. 누를 수 없다.
 * 띠는 HUD처럼 핫스팟·서는 자리를 두지 않는 곳이고, 띠 안의 탭은 아무 일도 하지 않는다(`inHudZone`).
 */
export const GAUGE_BAND: HitBox = { left: 0, top: 256, width: INTERNAL_WIDTH, height: 14 };

/** 막대 테두리(ink): x 84–474, y 258–268. 칸 사이 1px도 이 ink가 보여서 눈금이 된다. */
export const GAUGE_TRACK: HitBox = { left: 84, top: 258, width: 391, height: 11 };

/** 칸 5개: (85 + 78·i, 259) 77×9, 끝 x 473. 노랑 = 남은 칸, 빨강 = 깎인 칸(6-3-3절). */
export const GAUGE_SEGS: readonly HitBox[] = Array.from({ length: GAUGE_MAX }, (_, i) => ({
  left: GAUGE_TRACK.left + 1 + 78 * i,
  top: GAUGE_TRACK.top + 1,
  width: 77,
  height: 9,
}));

/** 대상 라벨(`#label`) 아래끝: 띠 윗선(256) − 2(6-3-5절). 첫 감소 안내·호버 설명도 같은 자리다. */
export const LABEL_BOTTOM = GAUGE_BAND.top - 2;

/**
 * 대상 라벨 글자 크기(CSS px, #337): 내부 7px × 화면 CSS 배율, 최소 14. 1.0·1.333·2배는 예전 14px 그대로, 4배는 28px.
 * HUD 이름표와 같은 내부 7px 기준이라 위계가 맞는다. 최소만 14로 크다(첫 감소 안내 등 문장이라 11px는 작다).
 */
export function labelFontPx(scale: number): number {
  return Math.max(14, Math.round(7 * scale));
}

/**
 * 클리어·기절 컷 글자 크기(CSS px, #352, 설계 6-6절): 내부 14px × 화면 CSS 배율, 최소 20. 2배는 예전 28px 그대로, 4배 56px.
 * 말풍선(9 × 배율, 최소 16)보다 늘 커서 이 화면의 보상·벌 순간이 툴팁처럼 보이지 않는다.
 */
export function cutFontPx(scale: number): number {
  return Math.max(20, Math.round(14 * scale));
}

/**
 * 목표 줄(`#hud`, 설계 6-2-2절, #336): 게임 화면 내부 왼쪽 위 점. 창이 아니라 캔버스 기준이라 휴대폰에서 검은 여백에 걸치지 않는다.
 * 글자 크기는 HUD 이름표와 같은 `hudTagFontPx`.
 */
export const GOAL_AT: Point = { x: 4, y: 4 };

/**
 * 목표 줄 오른쪽 끝 한계(내부 px). 화면 1 둥지 잔가지 그림이 x≈122부터(핫스팟 `nest` 128, `magpie` 134)라 4px 앞에서 멈춘다.
 * 1.0배(11px 글자 = 내부 11px)에서는 15자 165px가 한 줄로 안 들어가서, 글 파일의 줄바꿈 자리(U+200B)에서 두 줄로 접는다.
 */
export const GOAL_RIGHT = 118;

/** 목표 줄 최대 폭(CSS px, padding 포함). 이 폭을 넘으면 접는다. */
export function goalMaxWidthPx(scale: number): number {
  return Math.floor((GOAL_RIGHT - GOAL_AT.x) * scale);
}

/**
 * 목표 줄이 차지할 수 있는 가장 큰 상자(내부 px). 1.0배 두 줄(11px × 줄 높이 1.25 × 2 + 위아래 여백) ≈ 30px에 여유를 둔다.
 * 화면 데이터 테스트가 이 상자와 핫스팟·서는 자리가 안 겹치는지 본다.
 */
export const GOAL_ZONE: HitBox = { left: GOAL_AT.x, top: GOAL_AT.y, width: GOAL_RIGHT - GOAL_AT.x, height: 34 };

/**
 * HUD 영역 (300,4)–(402,48): 얼굴 3칸 + 아래 얼굴(이름) 이름표 띠(y 36–48, 설계 6-4-2절). 이 안의 탭은 칸에 맞지 않아도
 * 월드(바닥 걷기 등)로 넘기지 않는다. 칸 사이 틈이나 이름표를 눌러 캐릭터가 화면 위로 걸어가지 않게 한다.
 * 화면 설계 규칙의 `validate.ts` `HUD_BOX`(300,4,176,72)는 이보다 넓게 그대로 둔다(코어, 6-4-2절). 이 영역은 그 안에 있어야 한다.
 */
export const HUD_AREA: HitBox = { left: 300, top: 4, width: 102, height: 44 };

/** 탭이 월드(걷기·대사 넘기기)로 가지 않는 곳: 오른쪽 위 HUD 영역과 맨 아래 게이지 띠(6-3-5절). */
export function inHudZone(p: Point): boolean {
  return inBox(p, HUD_AREA) || inBox(p, GAUGE_BAND);
}

// ── 이름표·호버 설명 (설계 6-1절, #255) ──
// 글자는 전부 텍스트 키로 읽는다(일본어 #256). 위치는 내부 px이고, DOM으로 띄우는 건 엔진(main.ts)이다.

/**
 * 늘 보이는 이름표 하나. 내부 px 점 (`x`, `y`)에 `anchor`로 붙인다.
 * - `top-center`: 점이 이름표 위끝 가운데(얼굴 칸 아래, 6-4-2절).
 * - `middle-left`: 점이 이름표 왼쪽 끝 세로 가운데(게이지, 6-3-2절). 글자 크기가 배율마다 달라서 세로 가운데는 DOM이 맞춘다.
 */
export interface HudTag {
  id: `char.${CharacterId}` | 'gauge';
  x: number;
  y: number;
  anchor: 'top-center' | 'middle-left';
  text: string;
}

/** 얼굴 이름표 위끝: 지금 캐릭터 막대(y 33–34) 아래 1px(6-4-2절). */
export const CHAR_TAG_TOP = 36;

/** HUD 이름표 글자 크기(CSS px): 내부 7px × 화면 CSS 배율, 최소 11(6-1-2절). */
export function hudTagFontPx(scale: number): number {
  return Math.max(11, Math.round(7 * scale));
}

/**
 * CSS 배율이 이보다 작으면 HUD 이름표 전부(얼굴 3개 + 게이지) `palt` + `padding: 0`(6-4-2절, #325).
 * 667×375 @2(iPhone SE급)의 1.0배에서 얼굴 이름표가 서로 겹치고 게이지 이름표가 막대를 덮는 것을 막는다.
 * 지금 padding으로 겹치기 시작하는 배율은 약 1.156이라 1.2는 여유를 둔 경계다.
 */
export const HUD_TAG_TIGHT_BELOW = 1.2;
export function hudTagTight(scale: number): boolean {
  return scale < HUD_TAG_TIGHT_BELOW;
}

/** 게이지 이름표: 띠 왼쪽 x 4, 띠 세로 가운데 y 263(6-3-2절). 막대 시작 x 84 앞에서 끝난다. */
export const GAUGE_TAG_AT: Point = { x: 4, y: GAUGE_BAND.top + GAUGE_BAND.height / 2 };

/** 게이지가 줄 때 막대(테두리 + 칸) 흔들림 길이(틱, 0.3초, 6-3-4절). 띠는 흔들지 않는다. `gauge` 이벤트(20틱) 안에 끝난다. */
export const GAUGE_SHAKE_TICKS = 18;

/** 게이지 흔들림 가로 오프셋(px). 3틱마다 +1/−1, 0.3초 뒤 0. */
export function gaugeShakeX(t: number): number {
  if (t < 0 || t >= GAUGE_SHAKE_TICKS) return 0;
  return Math.floor(t / 3) % 2 === 0 ? 1 : -1;
}

/** 깎인 칸 크림 조각이 그대로 남는 틱(0.13초)과 그 뒤 노랑 쪽으로 줄어드는 틱(6-3-4절). 합 20 = `gauge` 이벤트 길이. */
export const GAUGE_CHIP_HOLD_TICKS = 8;
export const GAUGE_CHIP_SHRINK_TICKS = 12;

/**
 * 크림 조각 폭(px). 잃은 칸 전체 폭 `full`에서 t 0–7은 그대로, t 8–19는 오른쪽 끝이 왼쪽으로 줄어 t 19에 0이 된다.
 * 규격 식 round(full × (1 − (t−8)/12))는 t 19에 full/12가 남고 t 20에 툭 사라져서, 한 틱 당겨 0에서 끝낸다(PR #316 리뷰).
 */
export function gaugeChipWidth(full: number, t: number): number {
  if (t < GAUGE_CHIP_HOLD_TICKS) return full;
  const left = GAUGE_CHIP_HOLD_TICKS + GAUGE_CHIP_SHRINK_TICKS - 1 - t;
  return left <= 0 ? 0 : Math.round((full * left) / GAUGE_CHIP_SHRINK_TICKS);
}

type Text = (id: string) => string;

const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/**
 * 얼굴 아래 이름표 = 그 사람 이름(`char.<id>.name`, 시작 카드 이름 칸·힌트 대사와 같은 말, #676), 게이지는 `ui.hud.gauge`.
 * 지금 캐릭터와 무관하다. 처음엔 특기 동사(`ui.verb.<능력>`)였는데 플레이어가 동사를 이름으로 읽었다(6-4-2절).
 */
export function hudTags(t: Text): HudTag[] {
  const tags: HudTag[] = CHARACTERS.map((c) => {
    const b = CHAR_SLOTS[c.id];
    return { id: `char.${c.id}` as const, x: b.left + b.width / 2, y: CHAR_TAG_TOP, anchor: 'top-center' as const, text: t(`char.${c.id}.name`) };
  });
  tags.push({ id: 'gauge', ...GAUGE_TAG_AT, anchor: 'middle-left', text: t('ui.hud.gauge') });
  return tags;
}

/** 특기 설명 `{name}：{desc}`(설계 6-4-3절). 데스크톱 얼굴 칸 호버 글이다(호버 때는 아직 안 바뀌었으니 `交代`가 없다). */
export function abilityText(char: CharacterId, t: Text): string {
  const ability = characterDef(char).ability;
  return fill(t('ui.hud.char_hover'), { name: t(`char.${char}.name`), verb: t(`ui.verb.${ability}`), desc: t(`ui.ability.${ability}`) });
}

/** 전환 알림 `{name}に交代`(#692). 몸 탭·얼굴 탭 전환 뒤 대상 라벨 자리에 뜬다. */
export function switchText(char: CharacterId, t: Text): string {
  return fill(t('ui.switch'), { name: t(`char.${char}.name`) });
}

/**
 * 터치 첫 전환 안내 `{name}に交代（{desc}）`(#692 Luna 리뷰, 설계 6-4-3절). 그 판에서 처음 바꾼 사람에게만 뜬다.
 * 호버 글(`abilityText`)을 그대로 쓰면 "설명이 떴다"로 읽혀 "바뀌었다"가 안 보인다. 괄호는 터치 꼬리 `（もう一度タップで決定）`와 같은 덧붙임 결이다.
 */
export function firstSwitchText(char: CharacterId, t: Text): string {
  return fill(t('ui.switch_first'), { name: t(`char.${char}.name`), desc: t(`ui.ability.${characterDef(char).ability}`) });
}

/** 데스크톱 호버 설명(대상 라벨 자리). 얼굴 칸 = 그 사람 특기 설명, `gauge` = 게이지 설명. */
export function hudHoverText(id: HudId | 'gauge', t: Text): string {
  if (id === 'gauge') return t('ui.hud.gauge_hover');
  return abilityText(id.slice('char.'.length) as CharacterId, t);
}
