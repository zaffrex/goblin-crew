import { describe, expect, it } from 'vitest';
import { sayText, sayTextVariants, seenSayKey } from './sayText';

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

describe('sayTextVariants (#304 재생 검사가 변형 글도 인정)', () => {
  it('기본 글 다음에 캐릭터 변형을 중복 없이 모은다. 다른 하위 키(a.look.x)는 변형이 아니다', () => {
    const texts = { 'a.look': 'base', 'a.look.mukjik': '…m', 'a.look.ppik': 'base', 'a.look.hook': 'h' };
    expect(sayTextVariants(texts, 'a.look')).toEqual(['base', '…m']);
  });

  it('기본 글이 없으면 ID를 화면 글로 친다(sayText 폴백과 같다)', () => {
    expect(sayTextVariants({ 'x.jjuk': 'j' }, 'x')).toEqual(['x', 'j']);
  });

  it('본 대사 키는 화자마다 다르다', () => {
    expect(seenSayKey('jjuk', 'a')).not.toBe(seenSayKey('ppik', 'a'));
  });
});
