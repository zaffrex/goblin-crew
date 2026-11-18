import { describe, expect, it } from 'vitest';
import { isTapKey, type KeyLike } from './keys';

const key = (k: string, more: Partial<KeyLike> = {}): boolean => isTapKey({ key: k, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...more });

describe('아무 키 = 탭 (시작 카드 닫기, PR #306 리뷰)', () => {
  it('보통 키는 탭이다(Space·Enter·Escape·글자·화살표·Shift+글자)', () => {
    expect([' ', 'Enter', 'Escape', 'a', 'ArrowRight', 'A'].every((k) => key(k))).toBe(true);
  });

  it('수정·잠금 키 단독과 Tab은 탭이 아니다', () => {
    expect(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].filter((k) => key(k))).toEqual([]);
  });

  it('누른 채 반복, Ctrl/Cmd/Alt 조합, IME 조합 중은 탭이 아니다', () => {
    expect(key('Enter', { repeat: true })).toBe(false);
    expect(key('r', { ctrlKey: true })).toBe(false);
    expect(key('r', { metaKey: true })).toBe(false);
    expect(key('ArrowLeft', { altKey: true })).toBe(false);
    expect(key('Process', { isComposing: true })).toBe(false);
  });
});
