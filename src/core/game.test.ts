import { describe, expect, it } from 'vitest';
import { walkerHitBox } from './characters';
import { WALK_AREA } from './config';
import { activeChar, click, createGame, step, type GameState } from './game';
import { isWalking } from './walk';

function runUntilIdle(s: GameState, limit = 10_000): void {
  let guard = 0;
  while (s.chars.some(isWalking) && guard++ < limit) step(s);
}

/** 캐릭터 히트 영역 한가운데 점 (클릭 위치로 쓴다). */
function centerOf(s: GameState, id: string) {
  const c = s.chars.find((w) => w.id === id)!;
  const b = walkerHitBox(c);
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

describe('game state', () => {
  it('step은 틱을 1 올린다', () => {
    const s = createGame();
    step(s);
    step(s);
    expect(s.tick).toBe(2);
  });

  it('처음에는 캐릭터 3명이 있고 쭉이를 조작한다', () => {
    const s = createGame();
    expect(s.chars.map((c) => c.id).sort()).toEqual(['jjuk', 'mukjik', 'ppik']);
    expect(s.active).toBe('jjuk');
  });

  it('처음 자리에서 서로 히트 영역이 겹치지 않는다', () => {
    const boxes = createGame().chars.map(walkerHitBox);
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const overlap = a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
        expect(overlap).toBe(false);
      }),
    );
  });

  it('click은 입력 객체를 붙잡지 않는다', () => {
    const s = createGame();
    const p = { x: 400, y: 240 };
    click(s, p);
    p.x = 99;
    expect(activeChar(s).target).toEqual({ x: 400, y: 240 });
  });

  it('상태는 JSON 왕복 후에도 같다 (ADR-0004 결정 2)', () => {
    const s = createGame();
    click(s, { x: 400, y: 240 });
    click(s, centerOf(s, 'ppik'));
    step(s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('다른 캐릭터를 누르면 전환만 하고 아무도 새로 걷지 않는다', () => {
    const s = createGame();
    expect(click(s, centerOf(s, 'mukjik'))).toEqual({ kind: 'select', id: 'mukjik' });
    expect(s.active).toBe('mukjik');
    expect(s.chars.some(isWalking)).toBe(false);
  });

  it('지금 캐릭터를 누르면 아무 일도 없다', () => {
    const s = createGame();
    expect(click(s, centerOf(s, 'jjuk'))).toEqual({ kind: 'none' });
    expect(s.chars.some(isWalking)).toBe(false);
  });

  it('터치 여유 폭: 삑삑이 영역 6px 바깥 탭은 터치면 전환, 마우스면 걷기', () => {
    const s = createGame();
    const b = walkerHitBox(s.chars.find((c) => c.id === 'ppik')!);
    const p = { x: b.left + b.width + 6, y: b.top + 10 };
    const mouse = createGame();
    expect(click(mouse, p, 0)).toEqual({ kind: 'walk' });
    expect(click(s, p, 8)).toEqual({ kind: 'select', id: 'ppik' });
  });

  // headless 자동 플레이: 브라우저 없이 클릭 → 틱 진행 → 도착을 확인한다.
  it('자동 플레이: 쭉이를 보내고, 묵직이로 바꿔 보내면 둘 다 각자 목표에 도착한다', () => {
    const s = createGame();
    click(s, { x: 400, y: 250 }); // 쭉이 출발
    for (let i = 0; i < 10; i++) step(s);
    expect(click(s, centerOf(s, 'mukjik')).kind).toBe('select');
    click(s, { x: 50, y: 20 }); // 벽 클릭 → 묵직이가 바닥 위쪽 끝으로
    runUntilIdle(s);
    const by = (id: string) => s.chars.find((c) => c.id === id)!;
    expect([by('jjuk').x, by('jjuk').y]).toEqual([400, 250]); // 전환 뒤에도 하던 걷기를 끝냄
    expect([by('mukjik').x, by('mukjik').y]).toEqual([50, WALK_AREA.top]);
    expect(by('mukjik').facing).toBe(-1);
    expect([by('ppik').x, by('ppik').y]).toEqual([270, 230]);
  });
});
