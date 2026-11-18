import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { createFirstNotes, currentNote, GAUGE_NOTE_TICKS, noteGauge, noteSwitch, noteTap } from './firstNotes';

const TEXT: Record<string, string> = texts;
const DROP = TEXT['ui.hud.gauge_first_drop']!;

describe('첫 전환 특기 설명 (ui-interaction.md 6-4-3절, #311)', () => {
  const MUK = 'ズッシー: 全体重でドスンとふむ';
  const PPIK = 'プピ: ニワトリを鳴らして気を引く';

  it('캐릭터마다 처음 바꿀 때 한 번만 뜨고, 다음 탭에서 지운다(시간으로는 안 지운다)', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitch(n, 'mukjik', MUK);
    expect(currentNote(n, 0)).toBe(MUK);
    expect(currentNote(n, 10_000)).toBe(MUK);
    noteTap(n);
    expect(currentNote(n, 0)).toBeNull();
    noteSwitch(n, 'mukjik', MUK);
    expect(currentNote(n, 0)).toBeNull();
    noteSwitch(n, 'ppik', PPIK);
    expect(currentNote(n, 0)).toBe(PPIK);
  });

  it('처음 캐릭터는 시작 카드가 말했으니 다시 돌아와도 안 띄운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitch(n, 'jjuk', 'ノビー: …');
    expect(currentNote(n, 0)).toBeNull();
    noteSwitch(n, 'mukjik', MUK);
    noteTap(n);
    noteSwitch(n, 'jjuk', 'ノビー: …');
    expect(currentNote(n, 0)).toBeNull();
  });
});

describe('첫 감소 게이지 뜻 (6-2-5절, #285)', () => {
  it('그 판에서 처음 줄 때 2.5초 뜨고, 두 번째 감소에는 안 뜬다', () => {
    const n = createFirstNotes(5, 'jjuk');
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
    const n = createFirstNotes(5, 'jjuk');
    noteGauge(n, 4, 0, DROP);
    noteTap(n);
    expect(currentNote(n, 1)).toBeNull();
  });

  it('기절 뒤 다시 차는 것은 감소가 아니고, 그 뒤 첫 감소에는 뜬다', () => {
    const n = createFirstNotes(1, 'jjuk');
    noteGauge(n, 5, 0, DROP); // faint 뒤 가득
    expect(currentNote(n, 0)).toBeNull();
    noteGauge(n, 4, 10, DROP);
    expect(currentNote(n, 10)).toBe(DROP);
  });
});
