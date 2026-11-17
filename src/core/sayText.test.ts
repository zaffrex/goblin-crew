import { describe, expect, it } from 'vitest';
import { sayText } from './sayText';

describe('sayText (#286 화자별 말투 변형)', () => {
  const texts = { 'a.look': 'base', 'a.look.mukjik': '…m', 'b.only': 'b' };

  it('화자 변형이 있으면 그 글', () => {
    expect(sayText(texts, 'a.look', 'mukjik')).toBe('…m');
  });

  it('변형이 없으면 기본 글, 기본도 없으면 ID 그대로', () => {
    expect(sayText(texts, 'a.look', 'jjuk')).toBe('base');
    expect(sayText(texts, 'b.only', 'ppik')).toBe('b');
    expect(sayText(texts, 'nope', 'ppik')).toBe('nope');
  });
});
