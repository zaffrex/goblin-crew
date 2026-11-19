import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { DEFAULT_SCREEN, pickScreen, SCREEN_TEXT, screenTextKey } from './screenPick';

const IDS = ['magpie_nest', 'park_fountain'];

describe('pickScreen (#466)', () => {
  it('파라미터가 없으면 화면 1이다(배포본 동작 그대로)', () => {
    expect(DEFAULT_SCREEN).toBe('magpie_nest');
    expect(pickScreen(null, IDS)).toEqual({ id: 'magpie_nest' });
    expect(pickScreen('', IDS)).toEqual({ id: 'magpie_nest' });
  });

  it('?screen=<id>로 번들에 든 화면을 연다', () => {
    expect(pickScreen('park_fountain', IDS)).toEqual({ id: 'park_fountain' });
    expect(pickScreen('magpie_nest', IDS)).toEqual({ id: 'magpie_nest' });
  });

  it('모르는 ID면 화면 1로 열고 그 값을 알려 준다', () => {
    expect(pickScreen('park', IDS)).toEqual({ id: 'magpie_nest', unknown: 'park' });
    expect(pickScreen('../x', IDS)).toEqual({ id: 'magpie_nest', unknown: '../x' });
  });
});

describe('screenTextKey (#466)', () => {
  const T = { 'ui.card.goal': 'A', 'park_fountain.card.goal': 'B', 'park_fountain.clear': 'C', 'ui.clear': 'D' };

  it('화면 키가 있으면 그 키, 없으면 공용 키다', () => {
    expect(screenTextKey(T, 'park_fountain', 'ui.card.goal')).toBe('park_fountain.card.goal');
    expect(screenTextKey(T, 'magpie_nest', 'ui.card.goal')).toBe('ui.card.goal');
    expect(screenTextKey(T, 'park_fountain', 'ui.card.why')).toBe('ui.card.why');
  });

  it('목록 밖 키는 바꾸지 않는다: `ui.clear`(클리어 카드)는 `<id>.clear`(클리어 컷 대사)와 다른 글이다', () => {
    expect(screenTextKey(T, 'park_fountain', 'ui.clear')).toBe('ui.clear');
    expect(screenTextKey(T, 'park_fountain', 'ui.restart')).toBe('ui.restart');
  });

  it('지금 글 파일에서 화면 1은 공용 글 그대로다(화면 1 전용 키를 만들지 않았다)', () => {
    for (const id of Object.keys(SCREEN_TEXT)) {
      expect(id in texts).toBe(true);
      expect(screenTextKey(texts, 'magpie_nest', id)).toBe(id);
    }
  });
});
