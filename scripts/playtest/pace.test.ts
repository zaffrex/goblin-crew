import { describe, expect, it } from 'vitest';
import { floorTarget, predictRatio, quantile, walkSpan } from './pace';
import { WALK_AREA } from '../../src/core/config';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe('predictRatio (실제 루프 규칙으로 게임 시간 / 벽시계)', () => {
  it('60fps면 1', () => {
    expect(predictRatio(Array(120).fill(1000 / 60), 5)).toBeCloseTo(1, 2);
  });

  it('상한 5틱이면 200ms 프레임에서 83.3/200 ≈ 0.42 (측정한 휴대폰 ×64와 같음)', () => {
    expect(predictRatio(Array(50).fill(200), 5)).toBeCloseTo(5 / 12, 2);
  });

  it('상한 15틱이면 200ms 프레임도 늦어지지 않는다', () => {
    expect(predictRatio(Array(50).fill(200), 15)).toBeCloseTo(1, 1);
  });

  it('긴 공백(탭 전환)은 상한 15틱에서도 버린다', () => {
    expect(predictRatio([5000], 15)).toBeCloseTo(250 / 5000, 3);
  });

  it('프레임이 없으면 NaN', () => {
    expect(predictRatio([], 5)).toBeNaN();
  });
});

describe('walkSpan', () => {
  it('마지막 정지 샘플부터 처음 도착 샘플까지', () => {
    const s = [
      { t: 0, x: 100, busy: false },
      { t: 50, x: 100, busy: true },
      { t: 100, x: 104, busy: true },
      { t: 150, x: 108, busy: true },
      { t: 200, x: 110, busy: false },
      { t: 250, x: 110, busy: false },
    ];
    expect(walkSpan(s)).toEqual({ fromX: 100, toX: 110, wallMs: 150 });
  });

  it('안 움직였으면 null', () => {
    expect(walkSpan([0, 50, 100].map((t) => ({ t, x: 100, busy: false })))).toBeNull();
  });
});

describe('floorTarget', () => {
  const layout = { active: 'jjuk', busy: false, chars: {}, hotspots: {}, spots: {} };

  it('왼쪽에 있으면 오른쪽 바닥, 오른쪽에 있으면 왼쪽 바닥', () => {
    expect(floorTarget(layout, 100)).toEqual({ x: 440, y: WALK_AREA.bottom - 4 });
    expect(floorTarget(layout, 300)).toEqual({ x: 40, y: WALK_AREA.bottom - 4 });
  });

  it('상자에 걸리는 점은 건너뛴다', () => {
    const l = { ...layout, hotspots: { basket: box(430, 200, 20, 60) } };
    expect(floorTarget(l, 100).x).toBe(420);
  });
});

describe('quantile', () => {
  it('중앙값과 p90', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(xs, 0.5)).toBe(6);
    expect(quantile(xs, 0.9)).toBe(10);
  });
});
