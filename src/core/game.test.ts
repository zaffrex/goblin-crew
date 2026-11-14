import { describe, expect, it } from 'vitest';
import { WALK_AREA } from './config';
import { click, createGame, step } from './game';
import { isWalking } from './walk';

describe('game state', () => {
  it('step은 틱을 1 올린다', () => {
    const s = createGame();
    step(s);
    step(s);
    expect(s.tick).toBe(2);
  });

  it('click은 입력 객체를 붙잡지 않는다', () => {
    const s = createGame();
    const p = { x: 300, y: 240 };
    click(s, p);
    p.x = 99;
    expect(s.actor.target).toEqual({ x: 300, y: 240 });
  });

  it('상태는 JSON 왕복 후에도 같다 (ADR-0004 결정 2)', () => {
    const s = createGame();
    click(s, { x: 300, y: 240 });
    step(s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  // headless 자동 플레이: 브라우저 없이 클릭 → 틱 진행 → 도착을 확인한다.
  it('자동 플레이: 클릭 두 번(두 번째는 벽) 뒤 바닥 보정 점에 도착한다', () => {
    const s = createGame();
    click(s, { x: 400, y: 240 });
    for (let i = 0; i < 30; i++) step(s);
    click(s, { x: 50, y: 20 }); // 벽 클릭 → 바닥 위쪽 끝으로
    let guard = 0;
    while (isWalking(s.actor) && guard++ < 10_000) step(s);
    expect([s.actor.x, s.actor.y]).toEqual([50, WALK_AREA.top]);
    expect(s.actor.facing).toBe(-1);
  });
});
