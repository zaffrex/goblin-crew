// HUD 배치 (docs/design/ui-interaction.md 6절). 480×270 내부 px.
// 그리기(엔진)와 입력 판정(interact.ts)이 이 숫자 하나만 쓴다. 따로 계산하면 그림과 판정이 어긋난다.

import { CHARACTERS, characterDef, type CharacterId } from './characters';
import type { HitBox } from './hit';

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

/** 보송 게이지 칸 5개: (404,12)부터 12×12, 간격 3(끝 x 476). 누를 수 없다. */
export const GAUGE_CELLS: readonly HitBox[] = Array.from({ length: 5 }, (_, i) => ({
  left: 404 + 15 * i,
  top: 12,
  width: 12,
  height: 12,
}));

/**
 * HUD 영역 (300,4)–(476,76). 버튼 아래 이름표 띠(y 65–76, 설계 6-1-4절)까지 넣는다. 이 안의 탭은 버튼에 맞지 않아도 월드(바닥 걷기 등)로 넘기지 않는다.
 * 빈 아이템 칸이나 버튼 사이 틈을 눌러 캐릭터가 화면 위로 걸어가지 않게 한다.
 * 화면 설계 규칙: 이 영역에는 핫스팟·서는 자리를 두지 않는다(validate.ts `hud-overlap`).
 */
export const HUD_AREA: HitBox = { left: 300, top: 4, width: 176, height: 72 };

// ── 이름표·호버 설명 (설계 6-1절, #255) ──
// 글자는 전부 텍스트 키로 읽는다(일본어 #256). 위치는 내부 px이고, DOM으로 띄우는 건 엔진(main.ts)이다.

/** 늘 보이는 이름표 하나. `x`는 가운데, `top`은 위끝(내부 px). */
export interface HudTag {
  id: `verb.${VerbButton}` | 'gauge';
  x: number;
  top: number;
  text: string;
}

/** 이름표 위끝: 버튼 아래 1px(버튼 끝 64 + 1), 게이지 칸 아래 1px(칸 끝 24 + 1). */
export const VERB_TAG_TOP = 65;
export const GAUGE_TAG_TOP = 25;

/** 게이지 칸 5개를 감싸는 상자. 누를 수는 없고 데스크톱 호버 설명만 띄운다. */
export const GAUGE_BOX: HitBox = (() => {
  const first = GAUGE_CELLS[0]!;
  const last = GAUGE_CELLS[GAUGE_CELLS.length - 1]!;
  return { left: first.left, top: first.top, width: last.left + last.width - first.left, height: first.height };
})();

type Text = (id: string) => string;

const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** 능력 버튼 이름표 = 지금 캐릭터 능력 동사(`ui.verb.stretch` 등). 나머지는 `ui.verb.hand`·`ui.verb.look`, 게이지는 `ui.hud.gauge`. */
export function hudTags(active: CharacterId, t: Text): HudTag[] {
  const ability = characterDef(active).ability;
  const tags: HudTag[] = VERB_BUTTONS.map((v) => {
    const b = VERB_SLOTS[v];
    return { id: `verb.${v}` as const, x: b.left + b.width / 2, top: VERB_TAG_TOP, text: t(`ui.verb.${v === 'ability' ? ability : v}`) };
  });
  tags.push({ id: 'gauge', x: GAUGE_BOX.left + GAUGE_BOX.width / 2, top: GAUGE_TAG_TOP, text: t('ui.hud.gauge') });
  return tags;
}

/**
 * 데스크톱 호버 설명(대상 라벨 자리). HUD 칸 ID 또는 `gauge`. 설명이 없는 칸(아이템)은 null.
 * `{name}`은 `char.<id>.name`, `{verb}`는 `ui.verb.<능력>`에서 채운다.
 */
export function hudHoverText(id: HudId | 'gauge', active: CharacterId, t: Text): string | null {
  if (id.startsWith('char.')) {
    const c = id.slice('char.'.length);
    return fill(t('ui.hud.char_hover'), { name: t(`char.${c}.name`) });
  }
  switch (id) {
    case 'verb.ability':
      return fill(t('ui.hud.ability_hover'), { name: t(`char.${active}.name`), verb: t(`ui.verb.${characterDef(active).ability}`) });
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
