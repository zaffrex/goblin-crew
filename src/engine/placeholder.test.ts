import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../core/characters';
import { FIGURES } from './placeholder';

// 임시 그림이 히트 영역 밖으로 나가면 "보이는 곳을 눌렀는데 안 바뀜"이 생긴다 (ADR-0007 결정 6).
// 서 있는 프레임 기준. 걷기 들썩임(1px 위)은 판정에 넣지 않는다.
describe('임시 캐릭터 그림은 히트 영역 안에 들어간다', () => {
  it.each(CHARACTERS)('$id', (def) => {
    const { dx, dy, width, height } = def.hit;
    const parts = FIGURES[def.id];
    expect(parts.length).toBeGreaterThan(0);
    for (const [px, py, pw, ph] of parts) {
      expect(px).toBeGreaterThanOrEqual(dx);
      expect(px + pw).toBeLessThanOrEqual(dx + width);
      expect(py).toBeGreaterThanOrEqual(dy);
      expect(py + ph).toBeLessThanOrEqual(dy + height);
    }
    // 키는 히트 영역 높이를 다 쓴다 (머리 꼭대기 = 히트 영역 위끝).
    expect(Math.min(...parts.map((p) => p[1]))).toBe(dy);
  });
});
