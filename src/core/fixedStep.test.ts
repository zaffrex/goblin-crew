import { describe, expect, it } from 'vitest';
import { consumeFrame } from './fixedStep';

const TICK = 1000 / 60;

describe('consumeFrame', () => {
  it('60fps 프레임 하나는 틱 하나', () => {
    expect(consumeFrame(0, TICK, TICK, 5).steps).toBe(1);
  });

  it('남은 시간을 다음 프레임으로 넘긴다', () => {
    const a = consumeFrame(0, TICK * 0.6, TICK, 5);
    expect(a.steps).toBe(0);
    const b = consumeFrame(a.remainderMs, TICK * 0.6, TICK, 5);
    expect(b.steps).toBe(1);
    expect(b.remainderMs).toBeCloseTo(TICK * 0.2);
  });

  it('120Hz 모니터에서도 1초에 60틱', () => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 120; i++) {
      const r = consumeFrame(acc, 1000 / 120, TICK, 5);
      acc = r.remainderMs;
      total += r.steps;
    }
    expect(total).toBe(60);
  });

  it('긴 공백(탭 전환)은 maxSteps에서 자르고 밀린 시간을 버린다', () => {
    expect(consumeFrame(0, 5000, TICK, 5)).toEqual({ steps: 5, remainderMs: 0 });
  });

  it('음수 프레임 시간은 0으로 본다', () => {
    expect(consumeFrame(0, -10, TICK, 5).steps).toBe(0);
  });
});
