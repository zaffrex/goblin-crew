// HUD 동사 아이콘 시트 메타 해석과 버튼 → 칸 고르기 (#255, 설계 docs/design/ui-interaction.md 6-1-2절). 순수 로직이다.
// 시트 `public/ui/hud-icons.{png,json}`은 `art/build.mjs`가 만든다(원본 art/ui/hud-icons.mjs). 이미지 로드·그리기는 engine/hudIcons.ts.
// 칸은 가로 한 줄, 20×20. 버튼 28×28 가운데(4px 여백)에 그린다. 메타가 틀리면 엔진은 임시 글자를 그린다.

import { characterDef, type CharacterId } from './characters';
import type { HudId } from './hud';

/** 아이콘 한 칸 크기(설계 6-1-2절). 버튼 28 − 여백 4 × 2. */
export const ICON_SIZE = 20;
/** 버튼 왼쪽 위에서 아이콘까지 여백. */
export const ICON_INSET = 4;

export interface HudIconMeta {
  image: string;
  /** 아이콘 id(능력 동사 id `stretch`·`stomp`·`squeak`, `hand`, `look`) → 칸 번호. */
  icons: Readonly<Record<string, number>>;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function parseHudIconMeta(raw: unknown): HudIconMeta {
  const fail = (why: string): never => {
    throw new Error(`HUD 아이콘 메타 오류: ${why}`);
  };
  const m = raw as { image?: unknown; cell?: unknown; icons?: unknown } | null;
  if (typeof m !== 'object' || m === null) return fail('객체가 아님');
  if (typeof m.image !== 'string' || m.image === '') fail('image 없음');
  const cell = m.cell;
  if (!Array.isArray(cell) || cell.length !== 2 || cell[0] !== ICON_SIZE || cell[1] !== ICON_SIZE) fail(`cell은 [${ICON_SIZE}, ${ICON_SIZE}]이어야 한다`);
  if (typeof m.icons !== 'object' || m.icons === null) return fail('icons 없음');
  const icons = m.icons as Record<string, unknown>;
  const seen = new Set<number>();
  for (const [id, i] of Object.entries(icons)) {
    if (!isInt(i) || i < 0) fail(`${id}: 칸 번호가 0 이상 정수가 아님`);
    if (seen.has(i as number)) fail(`${id}: 칸 ${String(i)}을 다른 아이콘과 같이 쓴다`);
    seen.add(i as number);
  }
  return { image: m.image as string, icons: icons as Record<string, number> };
}

/** HUD 버튼 → 아이콘 id. 능력 버튼은 지금 캐릭터 능력 동사다. 캐릭터 칸(얼굴)·아이템 칸은 아이콘이 없다(null). */
export function hudIconId(id: HudId, active: CharacterId): string | null {
  if (id === 'verb.ability') return characterDef(active).ability;
  if (id === 'verb.hand') return 'hand';
  if (id === 'verb.look') return 'look';
  return null;
}
