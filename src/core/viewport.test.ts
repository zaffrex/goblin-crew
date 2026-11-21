import { describe, expect, it } from 'vitest';
import { computeScale, internalToScreen, screenToInternal } from './viewport';

const INTERNAL = { width: 480, height: 270 };

describe('computeScale', () => {
  it('2배 이상이면 정수 배율로 내림한다', () => {
    expect(computeScale({ width: 1920, height: 1080 }, INTERNAL)).toBe(4);
    expect(computeScale({ width: 1366, height: 768 }, INTERNAL)).toBe(2); // 2.84 → 2
  });

  it('2배 판정은 CSS 픽셀로 한다: 고밀도 데스크톱은 장치 픽셀 정수 배율', () => {
    expect(computeScale({ width: 2880, height: 1800 }, INTERNAL, 2)).toBe(6); // 1440×900 레티나, CSS 3배
    expect(computeScale({ width: 1920, height: 1080 }, INTERNAL, 1.25)).toBe(4); // 1536×864 CSS, CSS 3.2배 → 장치 4
  });

  it('휴대폰 가로는 dpr과 상관없이 높이를 꽉 채운다 (#603 10회차: dpr 2에서 CSS 1배로 떨어지던 것)', () => {
    for (const dpr of [2, 2.625, 3]) {
      const s = computeScale({ width: Math.floor(844 * dpr), height: Math.floor(390 * dpr) }, INTERNAL, dpr);
      expect((270 * s) / dpr, `dpr ${dpr}`).toBeCloseTo(390, 0);
    }
  });

  it('2배 미만이면 비정수 배율로 꽉 채운다', () => {
    expect(computeScale({ width: 720, height: 1000 }, INTERNAL)).toBeCloseTo(1.5);
    expect(computeScale({ width: 390, height: 844 }, INTERNAL)).toBeCloseTo(390 / 480);
    expect(computeScale({ width: 1688, height: 780 }, INTERNAL, 2)).toBeCloseTo(780 / 270); // 844×390 dpr 2
  });

  it('더 좁은 축이 배율을 정한다', () => {
    expect(computeScale({ width: 4000, height: 540 }, INTERNAL)).toBe(2);
  });

  it('크기가 0이면 1을 돌려준다 (레이아웃 전)', () => {
    expect(computeScale({ width: 0, height: 0 }, INTERNAL)).toBe(1);
  });
});

describe('screenToInternal / internalToScreen', () => {
  const rect = { left: 100, top: 50, width: 960, height: 540 }; // 2배

  it('화면 좌표를 내부 픽셀로 바꾼다', () => {
    expect(screenToInternal({ x: 100, y: 50 }, rect, INTERNAL)).toEqual({ x: 0, y: 0 });
    expect(screenToInternal({ x: 101.9, y: 51.9 }, rect, INTERNAL)).toEqual({ x: 0, y: 0 });
    expect(screenToInternal({ x: 102, y: 52 }, rect, INTERNAL)).toEqual({ x: 1, y: 1 });
    expect(screenToInternal({ x: 1059.9, y: 589.9 }, rect, INTERNAL)).toEqual({ x: 479, y: 269 });
  });

  it('캔버스 밖이면 null', () => {
    expect(screenToInternal({ x: 99, y: 60 }, rect, INTERNAL)).toBeNull();
    expect(screenToInternal({ x: 1060, y: 60 }, rect, INTERNAL)).toBeNull();
    expect(screenToInternal({ x: 200, y: 590 }, rect, INTERNAL)).toBeNull();
  });

  it('비정수 배율에서도 역변환이 같은 내부 픽셀로 돌아온다', () => {
    const small = { left: 0, top: 10, width: 390, height: 219.375 };
    for (const p of [{ x: 0, y: 0 }, { x: 17, y: 33 }, { x: 240, y: 135 }, { x: 479, y: 269 }]) {
      const s = internalToScreen(p, small, INTERNAL);
      // 픽셀 왼쪽 위 모서리에 부동소수 오차가 붙을 수 있어 픽셀 안쪽 중앙으로 살짝 옮겨서 확인한다.
      const center = { x: s.x + small.width / INTERNAL.width / 2, y: s.y + small.height / INTERNAL.height / 2 };
      expect(screenToInternal(center, small, INTERNAL)).toEqual(p);
    }
  });
});
