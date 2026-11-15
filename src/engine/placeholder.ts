// 아트가 나오기 전(#7)까지 쓰는 임시 그림. 사각형만으로 그린다.
// 실제 스프라이트가 들어오면 이 파일은 통째로 지운다.

import type { CharacterId } from '../core/characters';
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

type Part = [dx: number, dy: number, w: number, h: number, color: string];

/** 가로 줄무늬: top부터 bottom 전까지 6px마다 2px 줄. */
function stripes(dx: number, top: number, bottom: number, w: number, color: string): Part[] {
  const out: Part[] = [];
  for (let y = top; y < bottom; y += 6) out.push([dx, y, w, 2, color]);
  return out;
}

// 오른쪽을 볼 때 기준점(발 바닥 + 다리 가운데) 기준 사각형들. 왼쪽을 보면 기준점 축으로 뒤집는다.
// 크기는 ADR-0007 결정 4(쭉이 20×42, 묵직이 30×30, 삑삑이 18×25)를 흉내만 낸다.
const SHAPES: Record<CharacterId, Part[]> = {
  // 쭉이: 길고 가는 줄무늬 니삭스
  jjuk: [
    [-5, -42, 10, 36, '#e9c46a'],
    ...stripes(-5, -36, -8, 10, '#e76f51'),
    [-6, -42, 12, 3, '#f4f1de'], // 고무줄 입구
    [-5, -6, 15, 6, '#e9c46a'], // 발
    [10, -6, 4, 6, '#e76f51'], // 발끝 덧댐
    [2, -36, 1, 2, '#1d1d1d'], // 눈
  ],
  // 묵직이: 넓고 뭉툭한 울 양말, 발끝에 동전
  mukjik: [
    [-11, -30, 22, 22, '#6d6875'],
    [-11, -30, 22, 4, '#b5838d'], // 접힌 입구
    [-11, -8, 30, 8, '#6d6875'], // 발
    [13, -6, 4, 4, '#e9c46a'], // 동전 불룩
    [4, -22, 2, 1, '#1d1d1d'], // 졸린 눈
  ],
  // 삑삑이: 작은 아기 양말, 머리에 털방울
  ppik: [
    [-3, -25, 6, 5, '#f4a6c1'], // 털방울
    [-6, -20, 12, 14, '#a8dadc'],
    [-6, -6, 18, 6, '#a8dadc'], // 발
    [-6, -6, 3, 6, '#e63946'], // 뒤꿈치 삑삑이
    [2, -16, 1, 2, '#1d1d1d'], // 눈
  ],
};

/** 임시 양말 그림. 발 위치(x, y)가 기준점이다. */
export function drawSock(ctx: CanvasRenderingContext2D, w: Walker): void {
  const fx = Math.round(w.x);
  const fy = Math.round(w.y);
  const f = w.facing;
  // 걸을 때 8틱마다 1px 들썩인다.
  const bob = w.walkTicks > 0 && Math.floor(w.walkTicks / 8) % 2 === 1 ? 1 : 0;
  const parts = SHAPES[w.id as CharacterId];

  // 그림자
  ctx.fillStyle = '#3d3136';
  ctx.fillRect(fx - 8, fy - 1, 16, 2);

  for (const [dx, dy, bw, bh, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(f === 1 ? fx + dx : fx - (dx + bw), fy + dy - bob, bw, bh);
  }
}

/** 조작 중인 캐릭터 표시: 히트 영역 위에서 깜빡이지 않고 위아래로 흔들리는 작은 ▼. */
export function drawActiveMarker(ctx: CanvasRenderingContext2D, top: number, centerX: number, tick: number): void {
  const y = top - 7 - (Math.floor(tick / 20) % 2);
  ctx.fillStyle = '#edf2f4';
  for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(centerX) - 2 + i, y + i, 5 - 2 * i, 1);
}

/** 걸어가는 목표점 표시 (작은 ×). */
export function drawTarget(ctx: CanvasRenderingContext2D, p: Point, tick: number): void {
  if (Math.floor(tick / 15) % 2 === 1) return; // 깜빡임
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  ctx.fillStyle = '#edf2f4';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(x + i, y + i, 1, 1);
    ctx.fillRect(x + i, y - i, 1, 1);
  }
}
