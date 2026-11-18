// HUD 그림 (설계 6절·6-4-2절, #255·#311). 배치 숫자는 core/hud.ts 하나만 쓴다(그림과 입력 판정이 어긋나지 않게).
// 32색 팔레트만 쓴다(docs/design/art/bosong-32.hex). 이름표 글자는 DOM이라 여기 없다(main.ts).
// 그리는 것은 얼굴 칸 3개와 맨 아래 게이지뿐이다. 동사 버튼·아이템 칸은 없다(6-4-2절).

import type { CharacterId } from '../core/characters';
import type { HitBox } from '../core/hit';
import { gaugeChipWidth, gaugeShakeX } from '../core/hud';

/** 보송 32색 중 HUD가 쓰는 것. 번호는 bosong-32.hex 줄 순서(0부터). */
const C = {
  ink: '#1b1720', // 0
  plum: '#3a3142', // 1 칸·띠 바탕
  plumEdge: '#5e5068', // 2 칸 테두리
  paper: '#e6dcd6', // 5 깎인 조각 아랫줄
  cream: '#fff8ee', // 6 방금 깎인 게이지 조각
  redShade: '#7a2c3a', // 7 깎인 칸 그늘
  red: '#c2404a', // 8 깎인 칸
  yellowShade: '#b8953a', // 14 남은 칸 그늘
  yellow: '#f2d65c', // 15 남은 칸
  yellowLight: '#fff1a8', // 16 남은 칸 빛
  hint: '#ff9f43', // 31 지금 캐릭터
} as const;

/** 얼굴 시트가 아직 없을 때 캐릭터 칸 임시 색(팔레트 안). */
const FACE_FALLBACK: Record<CharacterId, string> = { jjuk: '#4f7a52', mukjik: '#c2404a', ppik: '#f2d65c' };

export interface HudView {
  active: CharacterId;
  gauge: number;
  /** 게이지가 줄어드는 연출 중이면 잃은 칸 [from, to)와 경과 틱(크림 조각 + 흔들림, 설계 6-3-4절). */
  gaugeDrop: { from: number; to: number; t: number } | null;
}

/** 얼굴을 그린다. 시트가 없거나 아직이면 false(→ 임시 색 칸). */
export type DrawFace = (ctx: CanvasRenderingContext2D, id: CharacterId, at: { x: number; y: number }) => boolean;

function frame(ctx: CanvasRenderingContext2D, b: HitBox, fill: string, edge: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(b.left, b.top, b.width, b.height);
  ctx.fillStyle = fill;
  ctx.fillRect(b.left + 1, b.top + 1, b.width - 2, b.height - 2);
}

/** 게이지 띠·막대 배치(core/hud.ts `GAUGE_BAND`·`GAUGE_TRACK`·`GAUGE_SEGS`). */
export interface GaugeLayout {
  band: HitBox;
  track: HitBox;
  segs: readonly HitBox[];
}

/** 칸 하나: 채움 + 윗줄 1px(없으면 채움 그대로) + 아랫줄 1px(6-3-3절). */
function seg(ctx: CanvasRenderingContext2D, b: HitBox, fill: string, top: string | null, bottom: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(b.left, b.top, b.width, b.height);
  if (top) {
    ctx.fillStyle = top;
    ctx.fillRect(b.left, b.top, b.width, 1);
  }
  ctx.fillStyle = bottom;
  ctx.fillRect(b.left, b.top + b.height - 1, b.width, 1);
}

/**
 * 게이지(설계 6-3절, #312): 맨 아래 띠 + 5칸 막대. 노랑 = 남은 칸(왼쪽부터), 빨강 = 깎인 칸(계속 보임).
 * 줄어드는 중(`drop`, `gauge` 이벤트 20틱)이면 막대만 0.3초 좌우로 흔들고, 잃은 칸 [from, to)를 크림 조각으로 덮었다가
 * 8틱 뒤 노랑 쪽으로 줄인다(6-3-4절). 상태는 `drop`(t)뿐이라 새 상태가 없다. 사각형만 쓴다(시트 없음).
 */
export function drawGauge(ctx: CanvasRenderingContext2D, g: GaugeLayout, gauge: number, drop: HudView['gaugeDrop']): void {
  // 띠는 화면 폭 전체라 흔들지 않는다(흔들면 양 끝에 틈이 보인다).
  ctx.fillStyle = C.plum;
  ctx.fillRect(g.band.left, g.band.top, g.band.width, g.band.height);
  ctx.fillStyle = C.plumEdge;
  ctx.fillRect(g.band.left, g.band.top, g.band.width, 1);

  const dx = drop ? gaugeShakeX(drop.t) : 0;
  const at = (b: HitBox): HitBox => (dx ? { ...b, left: b.left + dx } : b);
  const track = at(g.track);
  ctx.fillStyle = C.ink;
  ctx.fillRect(track.left, track.top, track.width, track.height);
  g.segs.forEach((cell, i) => {
    if (i < gauge) seg(ctx, at(cell), C.yellow, C.yellowLight, C.yellowShade);
    else seg(ctx, at(cell), C.red, null, C.redShade);
  });
  if (!drop || drop.to <= drop.from) return;
  const first = g.segs[drop.from];
  const last = g.segs[drop.to - 1];
  if (!first || !last) return;
  const full = last.left + last.width - first.left;
  const width = gaugeChipWidth(full, drop.t);
  if (width <= 0) return;
  seg(ctx, at({ left: first.left, top: first.top, width, height: first.height }), C.cream, null, C.paper);
  // 조각 위에도 칸 사이 눈금(ink 1px)을 다시 그린다. 2칸 이상이 한 조각이어도 칸 수가 보이게.
  ctx.fillStyle = C.ink;
  for (let i = drop.from + 1; i < drop.to; i++) {
    const b = at(g.segs[i]!);
    if (b.left - 1 < first.left + dx + width) ctx.fillRect(b.left - 1, b.top, 1, b.height);
  }
}

/** 얼굴 칸 3개(`hud`, id `char.<id>`)와 게이지. 지금 캐릭터는 hint 테두리 + 칸 아래 2px 막대(y 33–34). */
export function drawHud(ctx: CanvasRenderingContext2D, hud: Record<string, HitBox>, gauge: GaugeLayout, view: HudView, drawFace: DrawFace): void {
  for (const [id, b] of Object.entries(hud)) {
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
  }
  drawGauge(ctx, gauge, view.gauge, view.gaugeDrop);
}
