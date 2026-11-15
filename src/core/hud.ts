// HUD 배치 (docs/design/ui-interaction.md 6절). 480×270 내부 px.
// 그리기(엔진)와 입력 판정(interact.ts)이 이 숫자 하나만 쓴다. 따로 계산하면 그림과 판정이 어긋난다.

import { CHARACTERS, type CharacterId } from './characters';
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
 * HUD 영역 (300,4)–(476,64). 이 안의 탭은 버튼에 맞지 않아도 월드(바닥 걷기 등)로 넘기지 않는다.
 * 빈 아이템 칸이나 버튼 사이 틈을 눌러 캐릭터가 화면 위로 걸어가지 않게 한다.
 * 화면 설계 규칙: 이 영역에는 핫스팟·서는 자리를 두지 않는다(validate.ts `hud-overlap`).
 */
export const HUD_AREA: HitBox = { left: 300, top: 4, width: 176, height: 60 };
