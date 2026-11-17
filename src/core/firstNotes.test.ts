import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { createFirstNotes, currentNote, GAUGE_NOTE_TICKS, noteArmAbility, noteGauge, noteTap } from './firstNotes';

const TEXT: Record<string, string> = texts;
const DROP = TEXT['ui.hud.gauge_first_drop']!;

describe('첫 무장 특기 설명 (ui-interaction.md 6-2-3절, #285)', () => {
  it('캐릭터마다 처음 한 번만 뜨고, 다음 탭에서 지운다', () => {
    const n = createFirstNotes(5);
    noteArmAbility(n, 'mukjik', 'ドスン: 全体重でドスンとふむ');
    expect(currentNote(n, 0)).toBe('ドスン: 全体重でドスンとふむ');
    expect(currentNote(n, 10_000)).toBe('ドスン: 全体重でドスンとふむ'); // 시간으로는 안 지운다
    noteTap(n);
    expect(currentNote(n, 0)).toBeNull();
    noteArmAbility(n, 'mukjik', 'ドスン: 全体重でドスンとふむ');
    expect(currentNote(n, 0)).toBeNull();
    noteArmAbility(n, 'jjuk', 'のばす: サオをのばして高い所に届く');
    expect(currentNote(n, 0)).toBe('のばす: サオをのばして高い所に届く');
  });
});

describe('첫 감소 게이지 뜻 (6-2-5절, #285)', () => {
  it('그 판에서 처음 줄 때 2.5초 뜨고, 두 번째 감소에는 안 뜬다', () => {
    const n = createFirstNotes(5);
    noteGauge(n, 5, 10, DROP);
    expect(currentNote(n, 10)).toBeNull();
    noteGauge(n, 4, 100, DROP);
    expect(currentNote(n, 100)).toBe(DROP);
    expect(currentNote(n, 100 + GAUGE_NOTE_TICKS - 1)).toBe(DROP);
    expect(currentNote(n, 100 + GAUGE_NOTE_TICKS)).toBeNull();
    noteGauge(n, 3, 400, DROP);
    expect(currentNote(n, 400)).toBeNull();
    expect(GAUGE_NOTE_TICKS).toBe(150);
  });

  it('떠 있는 동안 탭이 오면 지운다', () => {
    const n = createFirstNotes(5);
    noteGauge(n, 4, 0, DROP);
    noteTap(n);
    expect(currentNote(n, 1)).toBeNull();
  });

  it('기절 뒤 다시 차는 것은 감소가 아니고, 그 뒤 첫 감소에는 뜬다', () => {
    const n = createFirstNotes(1);
    noteGauge(n, 5, 0, DROP); // faint 뒤 가득
    expect(currentNote(n, 0)).toBeNull();
    noteGauge(n, 4, 10, DROP);
    expect(currentNote(n, 10)).toBe(DROP);
  });
});
