// HUD 그림 (설계 6절·6-1-2절, #255). 배치 숫자는 core/hud.ts 하나만 쓴다(그림과 입력 판정이 어긋나지 않게).
// 32색 팔레트만 쓴다(docs/design/art/bosong-32.hex). 이름표 글자는 DOM이라 여기 없다(main.ts).
// 동사 아이콘 그림이 오기 전에는 버튼 안에 임시 한 글자를 그린다. 아이콘 시트가 오면 `drawIcon` 자리만 바꾼다.

import type { CharacterId } from '../core/characters';
import type { HitBox } from '../core/hit';

/** 보송 32색 중 HUD가 쓰는 것. 번호는 bosong-32.hex 줄 순서(0부터). */
const C = {
  ink: '#1b1720', // 0
  plum: '#3a3142', // 1 버튼 바탕
  plumEdge: '#5e5068', // 2 버튼 테두리
  paper: '#e6dcd6', // 5 임시 글자
  cream: '#fff8ee', // 6 무장 중 바탕
  tealDeep: '#23394d', // 23 빈 게이지 칸
  teal: '#5a93a8', // 25 찬 게이지 칸
  hint: '#ff9f43', // 31 지금 캐릭터
} as const;

/** 얼굴 시트가 아직 없을 때 캐릭터 칸 임시 색(팔레트 안). */
const FACE_FALLBACK: Record<CharacterId, string> = { jjuk: '#4f7a52', mukjik: '#c2404a', ppik: '#f2d65c' };

/** 아이콘 전 임시 한 글자. 능력은 그 캐릭터 동사 첫 글자다(이름표와 같은 낱말). */
const GLYPH: Record<string, string> = { 'verb.hand': '손', 'verb.look': '눈', 'item.0': '물' };

export interface HudView {
  active: CharacterId;
  armed: string | null;
  gauge: number;
  /** 능력 버튼 임시 글자(지금 캐릭터 능력 이름표의 첫 글자). */
  abilityGlyph: string;
}

/** 얼굴을 그린다. 시트가 없거나 아직이면 false(→ 임시 색 칸). */
export type DrawFace = (ctx: CanvasRenderingContext2D, id: CharacterId, at: { x: number; y: number }) => boolean;

function frame(ctx: CanvasRenderingContext2D, b: HitBox, fill: string, edge: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(b.left, b.top, b.width, b.height);
  ctx.fillStyle = fill;
  ctx.fillRect(b.left + 1, b.top + 1, b.width - 2, b.height - 2);
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  hud: Record<string, HitBox>,
  gauge: readonly HitBox[],
  view: HudView,
  drawFace: DrawFace,
): void {
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [id, b] of Object.entries(hud)) {
    if (id.startsWith('char.')) {
      const char = id.slice('char.'.length) as CharacterId;
      const on = char === view.active;
      frame(ctx, b, C.plum, on ? C.hint : C.plumEdge);
      // 얼굴 24×24를 칸 28×28 가운데(2px 여백)에(6-1-1절).
      if (!drawFace(ctx, char, { x: b.left + 2, y: b.top + 2 })) {
        ctx.fillStyle = FACE_FALLBACK[char];
        ctx.fillRect(b.left + 8, b.top + 6, b.width - 16, b.height - 12);
      }
      if (on) {
        ctx.fillStyle = C.hint;
        ctx.fillRect(b.left, b.top + b.height + 1, b.width, 2);
      }
      continue;
    }
    const armed = id === view.armed;
    frame(ctx, b, armed ? C.cream : C.plum, armed ? C.ink : C.plumEdge);
    // 무장 중(눌림)은 아이콘을 1px 아래로.
    const dy = armed ? 1 : 0;
    ctx.fillStyle = armed ? C.ink : C.paper;
    const glyph = id === 'verb.ability' ? view.abilityGlyph : (GLYPH[id] ?? '?');
    ctx.fillText(glyph, b.left + b.width / 2, b.top + b.height / 2 + 1 + dy);
  }
  gauge.forEach((b, i) => frame(ctx, b, i < view.gauge ? C.teal : C.tealDeep, C.ink));
}
