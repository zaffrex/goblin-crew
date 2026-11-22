import { describe, expect, it } from 'vitest';
import { isAllCleared, resumeFrom, saveOnCard } from './progress';
import { playtestOrder, usesSave } from './flow';
import { validateSave, type SaveData } from './save/schema';

const ORDER = ['laundromat', 'magpie_nest', 'park_fountain'];
const mk = (screenId: string, solved: string[]): SaveData => ({
  version: 1, contentVersion: 'c1', updatedAt: '2026-11-22T00:00:00.000Z',
  progress: { solvedScreens: solved }, checkpoint: { screenId, gauge: 5, activeCharacter: 'zuk', carriedItems: [] },
});
const base = { order: ORDER, contentVersion: 'c1', now: new Date('2026-11-23T00:00:00Z'), activeCharacter: 'zuk' };

describe('resumeFrom', () => {
  it('세이브가 없으면 새로 하기', () => expect(resumeFrom(null, ORDER)).toEqual({ kind: 'new' }));
  it('checkpoint 화면에서 이어 한다', () => {
    expect(resumeFrom(mk('magpie_nest', ['laundromat']), ORDER)).toMatchObject({ kind: 'continue', index: 1, screenId: 'magpie_nest' });
  });
  it('order.json에 없는 화면이면 새로 하기', () => expect(resumeFrom(mk('gone', ['laundromat']), ORDER)).toEqual({ kind: 'new' }));
  it('새 화면이 중간에 끼면 그 안 깬 화면으로 간다', () => {
    expect(resumeFrom(mk('park_fountain', ORDER), ['laundromat', 'new_mid', 'magpie_nest', 'park_fountain'])).toMatchObject({ kind: 'continue', screenId: 'new_mid' });
  });
  it('다 깼으면 새로 하기(이어 하기 없음)', () => {
    const s = mk('park_fountain', ORDER);
    expect(isAllCleared(s, ORDER)).toBe(true);
    expect(resumeFrom(s, ORDER)).toEqual({ kind: 'new' });
  });
  it('화면이 늘면 이어 하기가 다시 나온다', () => {
    expect(resumeFrom(mk('park_fountain', ORDER), [...ORDER, 'extra'])).toMatchObject({ kind: 'continue', index: 3, screenId: 'extra' });
  });
});

describe('saveOnCard', () => {
  it('카드가 뜰 때 다음 화면 id를 checkpoint로 쓴다', () => {
    const s = saveOnCard({ ...base, prev: null, index: 0 });
    expect(s.checkpoint).toMatchObject({ screenId: 'magpie_nest', gauge: 5 });
    expect(s.progress.solvedScreens).toEqual(['laundromat']);
    expect(validateSave(s)).not.toBeNull();
  });
  it('마지막 화면은 solvedScreens에 넣고 checkpoint는 자기 id', () => {
    const s = saveOnCard({ ...base, prev: mk('park_fountain', ORDER.slice(0, 2)), index: 2 });
    expect(s.checkpoint.screenId).toBe('park_fountain');
    expect(isAllCleared(s, ORDER)).toBe(true);
  });
  it('맵 재도전이 더 앞선 checkpoint를 덮지 않고 solvedScreens도 안 줄인다', () => {
    const prev = mk('park_fountain', ['laundromat', 'magpie_nest']);
    const s = saveOnCard({ ...base, prev, index: 0 });
    expect(s.checkpoint.screenId).toBe('park_fountain');
    expect(s.progress.solvedScreens).toEqual(['laundromat', 'magpie_nest']);
  });
  it('맵 재도전: prev가 바로 다음 화면이어도 checkpoint(캐릭터 포함)가 그대로다', () => {
    const prev = mk('park_fountain', ['laundromat', 'magpie_nest']);
    const s = saveOnCard({ ...base, prev, index: 1, activeCharacter: 'pupi' });
    expect(s.checkpoint).toEqual(prev.checkpoint);
  });
  it('같은 화면을 두 번 깨도 중복이 안 쌓인다', () => {
    const s = saveOnCard({ ...base, prev: mk('magpie_nest', ['laundromat']), index: 0 });
    expect(s.progress.solvedScreens).toEqual(['laundromat']);
  });
  it('순서 밖 위치는 던진다', () => expect(() => saveOnCard({ ...base, prev: null, index: 9 })).toThrow());
});

describe('기본 링크에서 세이브가 켜진다 (#767, 기록 default-link-always-latest)', () => {
  const known = new Set(ORDER);
  it('쿼리 없음 → playtestOrder null → usesSave true', () => expect(usesSave(playtestOrder(() => null, known))).toBe(true));
  it('playtest order 덮어쓰기 → 꺼짐', () => {
    const q = (k: string) => ({ playtest: '1', order: 'magpie_nest,magpie_nest' } as Record<string, string>)[k] ?? null;
    expect(usesSave(playtestOrder(q, known))).toBe(false);
  });
  it('?playtest=1만(order 없음)은 세이브를 안 끈다는 점에 주의: null이라 켜짐', () => {
    expect(usesSave(playtestOrder((k) => (k === 'playtest' ? '1' : null), known))).toBe(true);
  });
});
