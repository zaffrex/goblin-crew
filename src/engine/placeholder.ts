// 아트가 나오기 전(#7)까지 쓰는 임시 그림. 사각형만으로 그린다.
// 실제 스프라이트가 들어오면 이 파일은 통째로 지운다.

import type { CharacterId } from '../core/characters';
import type { HitBox } from '../core/hit';
import type { WalkArea, Walker } from '../core/walk';
import type { Point, Size } from '../core/viewport';

/** 벽 + 바닥. 바닥 띠는 걷는 영역보다 조금 위에서 시작해, 맨 위에 선 캐릭터도 바닥 위에 있는 것처럼 보이게 한다. */
export function drawRoom(ctx: CanvasRenderingContext2D, size: Size, area: WalkArea): void {
  const floorTop = area.top - 12;
  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(0, 0, size.width, floorTop);
  ctx.fillStyle = '#5c4b51';
  ctx.fillRect(0, floorTop, size.width, size.height - floorTop);
  // 걸레받이와 마룻바닥 이음매
  ctx.fillStyle = '#8d99ae';
  ctx.fillRect(0, floorTop - 3, size.width, 3);
  ctx.fillStyle = '#4a3c41';
  for (let x = 24; x < size.width; x += 48) ctx.fillRect(x, floorTop, 1, size.height - floorTop);
}

export type Part = [dx: number, dy: number, w: number, h: number, color: string];

const SKIN = '#f1c27d';
const EYE = '#1d1d1d';

// 오른쪽을 볼 때 기준점(발 바닥 + 두 다리 가운데) 기준 사각형들. 왼쪽을 보면 기준점 축으로 뒤집는다.
// 키는 ADR-0007 결정 4의 히트 영역 높이(42 / 30 / 25)에 맞춘다. 사람 비율과 외형은 새 ADR-0003에서 정한다.
// 모든 사각형은 characters.ts의 히트 영역 안에 들어간다 (placeholder.test.ts).
export const FIGURES: Record<CharacterId, Part[]> = {
  // 쭉이 → 키다리: 마르고 긴 팔다리
  jjuk: [
    [-4, -42, 9, 9, SKIN], // 머리
    [-5, -42, 10, 3, '#4a2f1d'], // 머리카락
    [-5, -39, 2, 3, '#4a2f1d'],
    [0, -38, 1, 1, EYE], // 눈 2개
    [3, -38, 1, 1, EYE],
    [-1, -33, 3, 2, SKIN], // 목
    [-6, -30, 2, 11, '#1f7a70'], // 뒤쪽 팔
    [-4, -31, 9, 14, '#2a9d8f'], // 몸통
    [5, -30, 2, 10, '#2a9d8f'], // 앞쪽 팔
    [5, -20, 2, 2, SKIN], // 손
    [-3, -17, 3, 15, '#264653'], // 다리
    [1, -17, 3, 15, '#264653'],
    [-3, -2, 4, 2, EYE], // 신발 (발끝이 앞)
    [1, -2, 5, 2, EYE],
  ],
  // 묵직이 → 덩치: 넓은 어깨, 짧고 굵은 다리
  mukjik: [
    [-4, -30, 9, 8, '#c68642'], // 머리
    [-4, -30, 9, 2, EYE], // 짧은 머리카락
    [0, -26, 1, 1, EYE], // 눈 2개
    [3, -26, 1, 1, EYE],
    [-11, -21, 3, 9, '#c68642'], // 뒤쪽 팔
    [-8, -22, 17, 11, '#e76f51'], // 몸통
    [-8, -12, 17, 1, '#5c3a21'], // 허리띠
    [9, -21, 3, 9, '#c68642'], // 앞쪽 팔
    [-7, -11, 6, 9, '#6d6875'], // 다리
    [2, -11, 6, 9, '#6d6875'],
    [-7, -2, 6, 2, '#3d3136'], // 신발
    [2, -2, 8, 2, '#3d3136'],
  ],
  // 삑삑이 → 꼬마: 큰 머리, 짧은 몸
  ppik: [
    [-5, -25, 10, 9, SKIN], // 머리
    [-5, -25, 10, 2, '#e9c46a'], // 머리카락
    [-6, -23, 1, 4, '#e9c46a'], // 뒤로 묶은 머리
    [0, -21, 1, 1, EYE], // 눈 2개
    [3, -21, 1, 1, EYE],
    [-6, -15, 2, 6, SKIN], // 뒤쪽 팔
    [-4, -16, 8, 8, '#a8dadc'], // 몸통
    [4, -15, 2, 6, SKIN], // 앞쪽 팔
    [-3, -8, 2, 6, '#457b9d'], // 다리
    [1, -8, 2, 6, '#457b9d'],
    [-3, -2, 3, 2, '#e63946'], // 신발
    [1, -2, 4, 2, '#e63946'],
  ],
};

/** 임시 캐릭터(사람 실루엣) 그림. 발 위치(x, y)가 기준점이다. */
export function drawCharacter(ctx: CanvasRenderingContext2D, w: Walker): void {
  const fx = Math.round(w.x);
  const fy = Math.round(w.y);
  const f = w.facing;
  // 걸을 때 8틱마다 1px 들썩인다.
  const bob = w.walkTicks > 0 && Math.floor(w.walkTicks / 8) % 2 === 1 ? 1 : 0;
  const parts = FIGURES[w.id as CharacterId];

  // 그림자
  ctx.fillStyle = '#3d3136';
  ctx.fillRect(fx - 8, fy - 1, 16, 2);

  for (const [dx, dy, bw, bh, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(f === 1 ? fx + dx : fx - (dx + bw), fy + dy - bob, bw, bh);
  }
}

// ADR-0007 팔레트 0번 ink, 6번 white. 임시 그림 중 ▼·× 표시만 팔레트 색으로 맞춘다(#46).
export const INK = '#1b1720';
export const WHITE = '#fff8ee';

export type Rect = [x: number, y: number, w: number, h: number, color: string];

// ▼ 조작 표시 9×6 (Luna, #46 2026-11-17 코멘트): 흰 채움 7×4 ▼ 둘레에 ink 1px.
// '#' = ink, 'W' = white. 흰색과 ink 대비가 16.7:1이라 어떤 배경에서도 둘 중 하나는 4.1:1 이상이다.
export const ACTIVE_MARKER_ROWS = [
  '#########',
  '#WWWWWWW#',
  '.#WWWWW#.',
  '..#WWW#..',
  '...#W#...',
  '....#....',
] as const;

/** ▼의 픽셀 사각형들. 끝(마지막 행)이 히트 박스 top에서 2px 위, 20틱마다 1px 흔들림, 화면 위로 잘리지 않음. */
export function activeMarkerRects(top: number, centerX: number, tick: number): Rect[] {
  const y0 = Math.max(0, Math.round(top) - 8 - (Math.floor(tick / 20) % 2));
  const x0 = Math.round(centerX) - 4;
  const rects: Rect[] = [];
  ACTIVE_MARKER_ROWS.forEach((row, dy) => {
    // 같은 색이 이어지는 칸은 사각형 하나로 묶는다(행마다 최대 3개).
    for (let i = 0; i < row.length; ) {
      const ch = row[i];
      let j = i;
      while (j < row.length && row[j] === ch) j++;
      if (ch !== '.') rects.push([x0 + i, y0 + dy, j - i, 1, ch === '#' ? INK : WHITE]);
      i = j;
    }
  });
  return rects;
}

/** 조작 중인 캐릭터 표시: 히트 영역 위에서 깜빡이지 않고 위아래로 흔들리는 ▼. */
export function drawActiveMarker(ctx: CanvasRenderingContext2D, top: number, centerX: number, tick: number): void {
  for (const [x, y, w, h, color] of activeMarkerRects(top, centerX, tick)) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
}

/** 걸어가는 목표점 표시 (작은 ×). */
export function drawTarget(ctx: CanvasRenderingContext2D, p: Point, tick: number): void {
  if (Math.floor(tick / 15) % 2 === 1) return; // 깜빡임
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  ctx.fillStyle = WHITE;
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(x + i, y + i, 1, 1);
    ctx.fillRect(x + i, y - i, 1, 1);
  }
}

const hb = (b: HitBox): [number, number, number, number] => [b.left, b.top, b.width, b.height];

/** 임시 대상 그림: 서는 자리·핫스팟 상자. 판정 상자 그대로 그려서 그림과 판정이 어긋나지 않는다. */
export function drawTargets(ctx: CanvasRenderingContext2D, spots: Record<string, HitBox>, hotspots: Record<string, HitBox>): void {
  for (const b of Object.values(spots)) {
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(...hb(b));
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(b.left, b.top + b.height - 3, b.width, 3);
  }
  for (const b of Object.values(hotspots)) {
    ctx.fillStyle = '#6d597a';
    ctx.fillRect(...hb(b));
    ctx.strokeStyle = '#b56576';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.left + 0.5, b.top + 0.5, b.width - 1, b.height - 1);
  }
}

/** 고른(터치 첫 탭) 대상 외곽선. */
export function drawOutline(ctx: CanvasRenderingContext2D, b: HitBox, tick: number): void {
  if (Math.floor(tick / 15) % 2 === 1) return;
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1;
  ctx.strokeRect(b.left - 1.5, b.top - 1.5, b.width + 3, b.height + 3);
}

const VERB_GLYPH: Record<string, string> = { 'verb.ability': '능', 'verb.hand': '손', 'verb.look': '눈', 'item.0': '물' };
const CHAR_COLOR: Record<string, string> = { 'char.jjuk': '#2a9d8f', 'char.mukjik': '#e76f51', 'char.ppik': '#a8dadc' };

/** 임시 HUD: 캐릭터 칸·동사 버튼·아이템 칸, 게이지 5칸. 배치는 hud.ts 숫자 그대로. */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  hud: Record<string, HitBox>,
  gauge: readonly HitBox[],
  state: { active: string; armed: string | null; gauge: number },
): void {
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [id, b] of Object.entries(hud)) {
    const on = id === `char.${state.active}` || id === state.armed;
    ctx.fillStyle = on ? '#edf2f4' : '#3d405b';
    ctx.fillRect(...hb(b));
    ctx.fillStyle = CHAR_COLOR[id] ?? (on ? '#2b2d42' : '#edf2f4');
    if (id in CHAR_COLOR) ctx.fillRect(b.left + 8, b.top + 6, b.width - 16, b.height - 12);
    else ctx.fillText(VERB_GLYPH[id] ?? '?', b.left + b.width / 2, b.top + b.height / 2 + 1);
  }
  gauge.forEach((b, i) => {
    ctx.fillStyle = i < state.gauge ? '#f2cc8f' : '#3d405b';
    ctx.fillRect(...hb(b));
  });
}

/** 효과(fx) 임시 표시: 대상 위의 작은 별. */
export function drawSpark(ctx: CanvasRenderingContext2D, at: Point, t: number): void {
  const y = Math.round(at.y) - 4 - Math.floor(t / 6);
  const x = Math.round(at.x);
  ctx.fillStyle = '#f2cc8f';
  ctx.fillRect(x - 1, y - 3, 3, 7);
  ctx.fillRect(x - 3, y - 1, 7, 3);
}
