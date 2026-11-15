import { describe, expect, it } from 'vitest';
import { distanceToBox, hitTest, type HitTarget } from './hit';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe('distanceToBox', () => {
  const b = box(10, 10, 20, 10); // x 10~30, y 10~20

  it('안쪽과 경계는 0', () => {
    expect(distanceToBox({ x: 15, y: 15 }, b)).toBe(0);
    expect(distanceToBox({ x: 10, y: 10 }, b)).toBe(0);
    expect(distanceToBox({ x: 30, y: 20 }, b)).toBe(0);
  });

  it('옆은 축 거리, 모서리 바깥은 대각선 거리', () => {
    expect(distanceToBox({ x: 35, y: 15 }, b)).toBe(5);
    expect(distanceToBox({ x: 15, y: 2 }, b)).toBe(8);
    expect(distanceToBox({ x: 33, y: 24 }, b)).toBe(5); // 3-4-5
  });
});

describe('hitTest (ADR-0007 결정 6)', () => {
  const table: HitTarget = { id: 'table', box: box(100, 100, 80, 30), z: 1 };
  const cup: HitTarget = { id: 'cup', box: box(130, 90, 24, 24), z: 2 }; // 탁자 위 컵(겹침)
  const door: HitTarget = { id: 'door', box: box(10, 40, 30, 60), z: 0 };

  it('아무것도 안 걸리면 null', () => {
    expect(hitTest([table, cup, door], { x: 300, y: 200 }, 0)).toBeNull();
  });

  it('마우스(slop 0)는 영역 안만 잡는다', () => {
    expect(hitTest([door], { x: 45, y: 50 }, 0)).toBeNull();
    expect(hitTest([door], { x: 40, y: 50 }, 0)?.id).toBe('door');
  });

  it('터치(slop 8)는 사방 8px 바깥까지 잡는다', () => {
    expect(hitTest([door], { x: 48, y: 50 }, 8)?.id).toBe('door');
    expect(hitTest([door], { x: 49, y: 50 }, 8)).toBeNull();
  });

  it('겹치면 앞(z가 큰 쪽)이 이기고, 배열 순서와 상관없다', () => {
    const p = { x: 140, y: 105 };
    expect(hitTest([table, cup], p, 0)?.id).toBe('cup');
    expect(hitTest([cup, table], p, 0)?.id).toBe('cup');
  });

  it('여유 폭 안에서는 z보다 거리가 먼저다', () => {
    // 탁자 안쪽(거리 0), 컵에서는 4px 아래 바깥. 컵이 앞이어도 탁자가 이긴다.
    const p = { x: 140, y: 118 };
    expect(hitTest([cup, table], p, 8)?.id).toBe('table');
  });

  it('거리도 z도 같으면 id 순이라 배열 순서와 상관없다', () => {
    const a: HitTarget = { id: 'a', box: box(0, 0, 10, 10), z: 5 };
    const b: HitTarget = { id: 'b', box: box(20, 0, 10, 10), z: 5 };
    const mid = { x: 15, y: 5 }; // 둘 다 5px
    expect(hitTest([a, b], mid, 8)?.id).toBe('a');
    expect(hitTest([b, a], mid, 8)?.id).toBe('a');
  });
});
