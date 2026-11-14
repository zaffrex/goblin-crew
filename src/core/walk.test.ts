import { describe, expect, it } from 'vitest';
import { clampToArea, createWalker, isWalking, stepWalker, walkTo } from './walk';

const AREA = { left: 10, top: 100, right: 200, bottom: 150 };

function runUntilStopped(w: ReturnType<typeof createWalker>, speed: number, limit = 10_000): number {
  let ticks = 0;
  while (isWalking(w) && ticks < limit) {
    stepWalker(w, speed);
    ticks++;
  }
  return ticks;
}

describe('clampToArea', () => {
  it('안쪽 점은 그대로', () => {
    expect(clampToArea({ x: 50, y: 120 }, AREA)).toEqual({ x: 50, y: 120 });
  });

  it('바깥 점은 가장 가까운 바닥 점으로', () => {
    expect(clampToArea({ x: 5, y: 20 }, AREA)).toEqual({ x: 10, y: 100 });
    expect(clampToArea({ x: 999, y: 999 }, AREA)).toEqual({ x: 200, y: 150 });
  });
});

describe('walkTo / stepWalker', () => {
  it('목표까지 정확히 도착하고 멈춘다 (넘치지 않는다)', () => {
    const w = createWalker('jjuk', { x: 20, y: 120 });
    walkTo(w, { x: 170, y: 120 }, AREA);
    const ticks = runUntilStopped(w, 1.5);
    expect(ticks).toBe(100); // 150px / 1.5
    expect(w).toMatchObject({ x: 170, y: 120, target: null, walkTicks: 0 });
  });

  it('속도로 나누어떨어지지 않는 거리도 마지막 틱에 목표점에 붙는다', () => {
    const w = createWalker('jjuk', { x: 20, y: 100 });
    walkTo(w, { x: 57, y: 133 }, AREA);
    runUntilStopped(w, 1.5);
    expect([w.x, w.y]).toEqual([57, 133]);
  });

  it('왼쪽으로 가면 왼쪽을 보고, 수직 이동은 방향을 바꾸지 않는다', () => {
    const w = createWalker('jjuk', { x: 100, y: 120 });
    walkTo(w, { x: 50, y: 120 }, AREA);
    expect(w.facing).toBe(-1);
    walkTo(w, { x: 100, y: 140 }, AREA);
    expect(w.facing).toBe(-1);
  });

  it('걷는 중 새 클릭이 오면 바로 새 목표로 간다', () => {
    const w = createWalker('jjuk', { x: 100, y: 120 });
    walkTo(w, { x: 200, y: 120 }, AREA);
    for (let i = 0; i < 10; i++) stepWalker(w, 1.5);
    expect(w.x).toBe(115);
    walkTo(w, { x: 10, y: 120 }, AREA);
    expect(w.facing).toBe(-1);
    stepWalker(w, 1.5);
    expect(w.x).toBe(113.5);
  });

  it('바닥 밖 클릭은 보정된 점으로 간다', () => {
    const w = createWalker('jjuk', { x: 100, y: 120 });
    walkTo(w, { x: 100, y: 0 }, AREA);
    runUntilStopped(w, 1.5);
    expect([w.x, w.y]).toEqual([100, 100]);
  });

  it('제자리 클릭은 걷지 않는다', () => {
    const w = createWalker('jjuk', { x: 100, y: 120 });
    walkTo(w, { x: 100, y: 120 }, AREA);
    expect(isWalking(w)).toBe(false);
  });

  it('걷는 동안 walkTicks가 오르고 도착하면 0', () => {
    const w = createWalker('jjuk', { x: 100, y: 120 });
    walkTo(w, { x: 130, y: 120 }, AREA);
    stepWalker(w, 1.5);
    stepWalker(w, 1.5);
    expect(w.walkTicks).toBe(2);
    runUntilStopped(w, 1.5);
    expect(w.walkTicks).toBe(0);
  });
});
