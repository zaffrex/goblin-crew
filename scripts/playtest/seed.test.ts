import { describe, expect, it } from 'vitest';
import { titleMenu } from '../../src/core/title';
import { parseSave } from '../../src/core/save/schema';
import { menuSeed, seedScript, MENU_STATES } from './seed';

const ORDER = ['magpie_nest', 'park_fountain', 'laundromat'];

describe('menuSeed (#792 설계 6절, 체크리스트 3-1절)', () => {
  it('세 상태가 타이틀 버튼 1개 / 3개 / 2개를 만든다(2-1절)', () => {
    const buttons = MENU_STATES.map((s) => titleMenu(menuSeed(s, ORDER, 'jjuk'), ORDER).buttons);
    expect(buttons).toEqual([['new'], ['continue', 'new', 'map'], ['map', 'new']]);
  });

  it('일부 깸은 첫 판만 깨고 둘째 판에서 이어진다', () => {
    const s = menuSeed('some', ORDER, 'jjuk')!;
    expect(s.progress.solvedScreens).toEqual(['magpie_nest']);
    expect(s.checkpoint.screenId).toBe('park_fountain');
  });

  it('다 깸은 모든 판을 깨고 마지막 판에 checkpoint를 둔다', () => {
    const s = menuSeed('all', ORDER, 'jjuk')!;
    expect(s.progress.solvedScreens).toEqual(ORDER);
    expect(s.checkpoint.screenId).toBe('laundromat');
  });

  it('심는 글은 게임 검증(parseSave)을 통과한다', () => {
    const s = menuSeed('all', ORDER, 'jjuk')!;
    const script = seedScript(s);
    const json = JSON.parse(script.slice(script.indexOf(', ') + 2, -2)) as string;
    expect(parseSave(json)).toEqual(s);
    expect(seedScript(null)).toBe('localStorage.removeItem("goblincrew.save.v1");');
  });
});
