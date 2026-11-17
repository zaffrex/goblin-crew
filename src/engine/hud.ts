// HUD 그림 (설계 6절·6-1-2절, #255). 배치 숫자는 core/hud.ts 하나만 쓴다(그림과 입력 판정이 어긋나지 않게).
// 32색 팔레트만 쓴다(docs/design/art/bosong-32.hex). 이름표 글자는 DOM이라 여기 없다(main.ts).
// 동사 버튼은 아이콘 시트(public/ui/hud-icons.png, engine/hudIcons.ts)로 그린다. 시트가 아직·실패면 임시 한 글자를 그린다.

import type { CharacterId } from '../core/characters';
import type { HitBox } from '../core/hit';
import { gaugeShakeX, type HudId } from '../core/hud';
import { hudIconId, ICON_INSET } from '../core/hudIcons';

/** 보송 32색 중 HUD가 쓰는 것. 번호는 bosong-32.hex 줄 순서(0부터). */
const C = {
  ink: '#1b1720', // 0
  plum: '#3a3142', // 1 버튼 바탕
  plumEdge: '#5e5068', // 2 버튼 테두리
  paper: '#e6dcd6', // 5 임시 글자
  cream: '#fff8ee', // 6 무장 중 바탕
  teal: '#5a93a8', // 25 찬 게이지 칸 그늘
  tealLight: '#9cc9cf', // 26 찬 게이지 칸
  tealGlow: '#d8f0ee', // 27 찬 게이지 칸 빛
  hint: '#ff9f43', // 31 지금 캐릭터
} as const;

/** 얼굴 시트가 아직 없을 때 캐릭터 칸 임시 색(팔레트 안). */
const FACE_FALLBACK: Record<CharacterId, string> = { jjuk: '#4f7a52', mukjik: '#c2404a', ppik: '#f2d65c' };

/** 아이콘 시트가 없을 때 임시 한 글자(뜻을 나타내는 한자 한 글자). 능력은 그 캐릭터 동사 첫 글자다. 아이템 칸은 아직 늘 이 글자다. */
const GLYPH: Record<string, string> = { 'verb.hand': '手', 'verb.look': '目', 'item.0': '物' };

export interface HudView {
  active: CharacterId;
  armed: string | null;
  gauge: number;
  /** 게이지가 줄어드는 연출 중이면 잃은 칸 [from, to)와 경과 틱(칸 터짐 + 흔들림, 설계 6-2-5절). */
  gaugeDrop: { from: number; to: number; t: number } | null;
  /** 능력 버튼 임시 글자(지금 캐릭터 능력 이름표의 첫 글자). 아이콘 시트가 없을 때만 쓴다. */
  abilityGlyph: string;
}

/** 얼굴을 그린다. 시트가 없거나 아직이면 false(→ 임시 색 칸). */
export type DrawFace = (ctx: CanvasRenderingContext2D, id: CharacterId, at: { x: number; y: number }) => boolean;

/** 동사 아이콘(20×20)을 그린다. 시트가 없거나 아직이거나 모르는 id면 false(→ 임시 글자). */
export type DrawIcon = (ctx: CanvasRenderingContext2D, id: string, at: { x: number; y: number }) => boolean;

function frame(ctx: CanvasRenderingContext2D, b: HitBox, fill: string, edge: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(b.left, b.top, b.width, b.height);
  ctx.fillStyle = fill;
  ctx.fillRect(b.left + 1, b.top + 1, b.width - 2, b.height - 2);
}

/** 찬 칸(설계 6-2-4절): ink 테두리 + 26번 채움, 아래·오른쪽 안 1px 25번 그늘, 왼쪽 위 ㄱ자 27번 빛(가로 3·세로 3). "불 켜진 칸". */
function fullCell(ctx: CanvasRenderingContext2D, b: HitBox): void {
  frame(ctx, b, C.tealLight, C.ink);
  const r = b.left + b.width - 2;
  const bottom = b.top + b.height - 2;
  ctx.fillStyle = C.teal;
  ctx.fillRect(b.left + 1, bottom, b.width - 2, 1);
  ctx.fillRect(r, b.top + 1, 1, b.height - 2);
  ctx.fillStyle = C.tealGlow;
  ctx.fillRect(b.left + 1, b.top + 1, 3, 1);
  ctx.fillRect(b.left + 1, b.top + 1, 1, 3);
}

/**
 * 터지는 칸: 처음 12틱(0.2초)은 크림색으로 번쩍, 그다음 구멍. 시트 없이 사각형만 쓴다.
 * 흔들림(18틱)을 보고 눈이 게이지로 옮겨 오는 데 0.2초 안팎이라, 바뀌는 순간이 흔들림 안에 보이게 한다(PR #295 리뷰).
 */
const BURST_FLASH_TICKS = 12;

/**
 * 게이지(설계 6-2-4·6-2-5절, #285): 받침판 위에 찬 칸(밝음)/빈 칸(구멍). 23번 tealDeep은 진해서 찬 칸처럼 보여 쓰지 않는다.
 * 줄어드는 중이면 판째 0.3초 좌우로 흔들고, 잃은 칸은 잠깐 번쩍인 뒤 구멍이 된다.
 */
export function drawGauge(ctx: CanvasRenderingContext2D, plate: HitBox, cells: readonly HitBox[], gauge: number, drop: HudView['gaugeDrop']): void {
  const dx = drop ? gaugeShakeX(drop.t) : 0;
  const at = (b: HitBox): HitBox => (dx ? { ...b, left: b.left + dx } : b);
  frame(ctx, at(plate), C.plum, C.plumEdge);
  cells.forEach((cell, i) => {
    const b = at(cell);
    if (drop && i >= drop.from && i < drop.to && drop.t < BURST_FLASH_TICKS) frame(ctx, b, C.cream, C.ink);
    else if (i < gauge) fullCell(ctx, b);
    else frame(ctx, b, C.ink, C.plumEdge);
  });
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  hud: Record<string, HitBox>,
  gauge: { plate: HitBox; cells: readonly HitBox[] },
  view: HudView,
  drawFace: DrawFace,
  drawIcon: DrawIcon,
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
    // 아이콘 20×20을 버튼 28×28 가운데(4px 여백)에(6-1-2절).
    const icon = hudIconId(id as HudId, view.active);
    if (icon && drawIcon(ctx, icon, { x: b.left + ICON_INSET, y: b.top + ICON_INSET + dy })) continue;
    ctx.fillStyle = armed ? C.ink : C.paper;
    const glyph = id === 'verb.ability' ? view.abilityGlyph : (GLYPH[id] ?? '?');
    ctx.fillText(glyph, b.left + b.width / 2, b.top + b.height / 2 + 1 + dy);
  }
  drawGauge(ctx, gauge.plate, gauge.cells, view.gauge, view.gaugeDrop);
}
