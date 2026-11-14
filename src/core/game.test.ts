import { describe, expect, it } from 'vitest';
import { click, createGame, step } from './game';

describe('game state', () => {
  it('step은 틱만 1 올린다', () => {
    const s = createGame();
    step(s);
    step(s);
    expect(s.tick).toBe(2);
  });

  it('click은 좌표를 복사해 둔다 (입력 객체를 붙잡지 않는다)', () => {
    const s = createGame();
    const p = { x: 3, y: 4 };
    click(s, p);
    p.x = 99;
    expect(s.lastClick).toEqual({ x: 3, y: 4 });
  });

  it('상태는 JSON 왕복 후에도 같다 (ADR-0004 결정 2)', () => {
    const s = createGame();
    step(s);
    click(s, { x: 10, y: 20 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
