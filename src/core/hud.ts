// HUD 배치 (docs/design/ui-interaction.md 6절). 480×270 내부 px.
// 그리기(엔진)와 입력 판정(interact.ts)이 이 숫자 하나만 쓴다. 따로 계산하면 그림과 판정이 어긋난다.

import { CHARACTERS, characterDef, type CharacterId } from './characters';
import { INTERNAL_WIDTH } from './config';
import { inBox, type HitBox } from './hit';
import { GAUGE_MAX } from './puzzle/types';
import type { Point } from './viewport';

/** 동사 버튼. `ability`는 지금 캐릭터 능력이다. 걷기 버튼은 없다(설계 3절). */
export type VerbButton = 'ability' | 'hand' | 'look';
export const VERB_BUTTONS: readonly VerbButton[] = ['ability', 'hand', 'look'];

export type HudId = `char.${CharacterId}` | `verb.${VerbButton}` | 'item.0';

const SLOT = 28;
const slot = (left: number, top: number): HitBox => ({ left, top, width: SLOT, height: SLOT });

/** 캐릭터 칸: 쭉이 / 묵직이 / 삑삑이, (300,4)부터 32px 간격. */
export const CHAR_SLOTS: Readonly<Record<CharacterId, HitBox>> = Object.fromEntries(
  CHARACTERS.map((c, i) => [c.id, slot(300 + 32 * i, 4)]),
) as Record<CharacterId, HitBox>;

/** 동사 버튼: 능력 / 손 / 보기, (300,36)부터 32px 간격. */
export const VERB_SLOTS: Readonly<Record<VerbButton, HitBox>> = {
  ability: slot(300, 36),
  hand: slot(332, 36),
  look: slot(364, 36),
};

/** 아이템 칸. M1은 1칸. */
export const ITEM_SLOT: HitBox = slot(404, 36);

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
 * HUD 영역 (300,4)–(476,76). 버튼 아래 이름표 띠(y 65–76, 설계 6-1-4절)까지 넣는다. 이 안의 탭은 버튼에 맞지 않아도 월드(바닥 걷기 등)로 넘기지 않는다.
 * 빈 아이템 칸이나 버튼 사이 틈을 눌러 캐릭터가 화면 위로 걸어가지 않게 한다.
 * 화면 설계 규칙: 이 영역에는 핫스팟·서는 자리를 두지 않는다(validate.ts `hud-overlap`).
 */
export const HUD_AREA: HitBox = { left: 300, top: 4, width: 176, height: 72 };

/** 탭이 월드(걷기·대사 넘기기)로 가지 않는 곳: 오른쪽 위 HUD 영역과 맨 아래 게이지 띠(6-3-5절). */
export function inHudZone(p: Point): boolean {
  return inBox(p, HUD_AREA) || inBox(p, GAUGE_BAND);
}

// ── 이름표·호버 설명 (설계 6-1절, #255) ──
// 글자는 전부 텍스트 키로 읽는다(일본어 #256). 위치는 내부 px이고, DOM으로 띄우는 건 엔진(main.ts)이다.

/**
 * 늘 보이는 이름표 하나. 내부 px 점 (`x`, `y`)에 `anchor`로 붙인다.
 * - `top-center`: 점이 이름표 위끝 가운데(동사 버튼 아래).
 * - `middle-left`: 점이 이름표 왼쪽 끝 세로 가운데(게이지, 6-3-2절). 글자 크기가 배율마다 달라서 세로 가운데는 DOM이 맞춘다.
 */
export interface HudTag {
  id: `verb.${VerbButton}` | 'gauge';
  x: number;
  y: number;
  anchor: 'top-center' | 'middle-left';
  text: string;
}

/** 동사 이름표 위끝: 버튼 아래 1px(버튼 끝 64 + 1). */
export const VERB_TAG_TOP = 65;

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

/** 능력 버튼 이름표 = 지금 캐릭터 능력 동사(`ui.verb.stretch` 등). 나머지는 `ui.verb.hand`·`ui.verb.look`, 게이지는 `ui.hud.gauge`. */
export function hudTags(active: CharacterId, t: Text): HudTag[] {
  const ability = characterDef(active).ability;
  const tags: HudTag[] = VERB_BUTTONS.map((v) => {
    const b = VERB_SLOTS[v];
    return { id: `verb.${v}` as const, x: b.left + b.width / 2, y: VERB_TAG_TOP, anchor: 'top-center' as const, text: t(`ui.verb.${v === 'ability' ? ability : v}`) };
  });
  tags.push({ id: 'gauge', ...GAUGE_TAG_AT, anchor: 'middle-left', text: t('ui.hud.gauge') });
  return tags;
}

/** 능력 버튼 설명 `{verb}: {desc}`(설계 6-2-3절). 데스크톱 호버와 첫 무장 안내가 같은 글을 쓴다. */
export function abilityText(active: CharacterId, t: Text): string {
  const ability = characterDef(active).ability;
  return fill(t('ui.hud.ability_hover'), { name: t(`char.${active}.name`), verb: t(`ui.verb.${ability}`), desc: t(`ui.ability.${ability}`) });
}

/**
 * 데스크톱 호버 설명(대상 라벨 자리). HUD 칸 ID 또는 `gauge`. 설명이 없는 칸(아이템)은 null.
 * `{name}`은 `char.<id>.name`, `{verb}`는 `ui.verb.<능력>`, `{desc}`는 `ui.ability.<능력>`(특기 설명, 설계 6-2-3절)에서 채운다.
 */
export function hudHoverText(id: HudId | 'gauge', active: CharacterId, t: Text): string | null {
  if (id.startsWith('char.')) {
    const c = id.slice('char.'.length);
    return fill(t('ui.hud.char_hover'), { name: t(`char.${c}.name`) });
  }
  switch (id) {
    case 'verb.ability':
      return abilityText(active, t);
    case 'verb.hand':
      return t('ui.hud.hand_hover');
    case 'verb.look':
      return t('ui.hud.look_hover');
    case 'gauge':
      return t('ui.hud.gauge_hover');
    default:
      return null;
  }
}
