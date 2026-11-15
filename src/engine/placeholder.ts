// 아트가 나오기 전(#7)까지 쓰는 임시 그림. 사각형만으로 그린다.
// 실제 스프라이트가 들어오면 이 파일은 통째로 지운다.

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

/** 쭉이 임시 그림: 줄무늬 니삭스 실루엣. 발 위치(x, y)가 기준점이다. 키 40px. */
export function drawSock(ctx: CanvasRenderingContext2D, w: Walker): void {
  const fx = Math.round(w.x);
  const fy = Math.round(w.y);
  const f = w.facing;
  // 걸을 때 8틱마다 1px 들썩인다.
  const bob = w.walkTicks > 0 && Math.floor(w.walkTicks / 8) % 2 === 1 ? 1 : 0;
  const top = fy - 40 - bob;

  // 그림자
  ctx.fillStyle = '#3d3136';
  ctx.fillRect(fx - 7, fy - 1, 14, 2);

  // 다리(몸통): 줄무늬
  ctx.fillStyle = '#e9c46a';
  ctx.fillRect(fx - 5, top, 10, 34);
  ctx.fillStyle = '#e76f51';
  for (let y = top + 6; y < fy - 8 - bob; y += 6) ctx.fillRect(fx - 5, y, 10, 2);
  // 고무줄 입구
  ctx.fillStyle = '#f4f1de';
  ctx.fillRect(fx - 6, top, 12, 3);

  // 발: 발끝이 보는 방향으로 나온다
  ctx.fillStyle = '#e9c46a';
  ctx.fillRect(f === 1 ? fx - 5 : fx - 10, fy - 6 - bob, 15, 6);
  ctx.fillStyle = '#e76f51';
  ctx.fillRect(f === 1 ? fx + 7 : fx - 10, fy - 6 - bob, 3, 6); // 발끝 덧댐

  // 눈
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(fx + f * 2, top + 6, 1, 2);
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
