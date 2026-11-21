import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import magpie from '../../content/screens/magpie_nest.json';
import fountain from '../../content/screens/park_fountain.json';
import { createFirstNotes, currentNote, GAUGE_NOTE_TICKS, labelKey, noteAction, noteGauge, noteHover, noteStood, noteSwitch, noteSwitched, noteTap, selectLabelText, standLabel, SWITCH_NOTE_TICKS } from './firstNotes';
import { labelText } from './interact';
import { initialState, step } from './puzzle/step';
import type { Action, PuzzleState, ScreenData } from './puzzle/types';

const TEXT: Record<string, string> = texts;
const DROP = TEXT['ui.hud.gauge_first_drop']!;

describe('첫 전환 특기 설명 (ui-interaction.md 6-4-3절, #311)', () => {
  const MUK = 'ズッシー: 全体重で踏みつける';
  const PPIK = 'プピ: ニワトリを鳴らして相手の気を引く';

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

describe('올라선 뒤 그 자리 라벨 (ui-interaction.md 6-4-1a절, #630)', () => {
  const screen = magpie as unknown as ScreenData;
  const t = (id: string): string => TEXT[id] ?? id;
  const run = (state: PuzzleState, a: Action): PuzzleState => step(screen, state, a).state;
  /** 그 사람이 그 자리에 선 판(정답과 상관없이 move만). */
  const standing = (char: Action['char'], spot: string): PuzzleState => run(initialState(screen), { char, verb: 'move', target: spot });
  const text = (s: PuzzleState, sc: ScreenData = screen) => ({ char, spot }: { char: Action['char']; spot: string }): string | null => {
    const l = standLabel({ screen: sc, puzzle: s }, sc.rules, char, spot);
    return l ? labelText(l, sc.id, t) : null;
  };

  it('조건 ②·③: 화면 1 표 그대로(묵직이 × 양끝만, 쭉이·삑삑이는 안 띄움)', () => {
    const got: Record<string, string | null> = {};
    for (const char of ['jjuk', 'mukjik', 'ppik'] as const) {
      for (const spot of ['seesaw_left', 'seesaw_right']) got[`${char}>${spot}`] = text(standing(char, spot))({ char, spot });
    }
    expect(got).toEqual({
      'jjuk>seesaw_left': null,
      'jjuk>seesaw_right': null,
      'mukjik>seesaw_left': 'シーソーの左端をドスン',
      'mukjik>seesaw_right': 'シーソーの右端をドスン',
      'ppik>seesaw_left': null,
      'ppik>seesaw_right': null,
    });
  });

  it('호버 라벨과 같은 글이다(새 글 없음)', () => {
    expect(TEXT['ui.label.stomp']).toBe('{target}をドスン');
    expect(TEXT['magpie_nest.name.seesaw_right']).toBe('シーソーの右端');
  });

  it('그 자리에 실제로 서 있지 않으면(자리가 차서 못 감 등) 안 띄운다', () => {
    expect(text(initialState(screen))({ char: 'mukjik', spot: 'seesaw_right' })).toBeNull();
  });

  it('화면 2 park_fountain: 서는 자리를 대상으로 한 규칙이 없어 아무 데서도 안 뜬다', () => {
    const sc = fountain as unknown as ScreenData;
    for (const [spot, def] of Object.entries(sc.spots)) {
      if (def.free || def.hold) continue;
      for (const char of ['jjuk', 'mukjik', 'ppik'] as const) {
        const s = step(sc, initialState(sc), { char, verb: 'move', target: spot }).state;
        expect(text(s, sc)({ char, spot }), `${char}>${spot}`).toBeNull();
      }
    }
  });

  const RIGHT = 'シーソーの右端をドスン';
  const climb: Action = { char: 'mukjik', verb: 'move', target: 'seesaw_right' };
  const stood = standing('mukjik', 'seesaw_right');

  it('올라선 순간 2.5초 뜨고, 다음 탭이나 시간이 지나면 지운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteAction(n, climb, 'floor');
    noteStood(n, 'mukjik', 100, text(stood));
    expect(currentNote(n, 100)).toBe(RIGHT);
    expect(currentNote(n, 100 + GAUGE_NOTE_TICKS - 1)).toBe(RIGHT);
    expect(currentNote(n, 100 + GAUGE_NOTE_TICKS)).toBeNull();
    noteAction(n, climb, 'floor');
    noteStood(n, 'mukjik', 500, text(stood));
    noteTap(n);
    expect(currentNote(n, 501)).toBeNull();
  });

  it('조건 ①: 걷는 동안 다른 얼굴로 바꿨으면 안 띄운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteAction(n, climb, 'floor');
    noteStood(n, 'jjuk', 100, text(stood));
    expect(currentNote(n, 100)).toBeNull();
  });

  it('busy가 풀릴 때 한 번만 본다(올라서기 없는 busy 끝에는 안 뜬다)', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteAction(n, climb, 'floor');
    noteStood(n, 'mukjik', 100, text(stood));
    noteTap(n);
    noteStood(n, 'mukjik', 200, text(stood));
    expect(currentNote(n, 200)).toBeNull();
  });

  it('선 자리에 특기를 한 번 쓰면 그 판에서 다시 안 띄운다. 그 전에는 설 때마다 띄운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    for (const tick of [100, 400]) {
      noteAction(n, climb, 'floor');
      noteStood(n, 'mukjik', tick, text(stood));
      expect(currentNote(n, tick)).toBe(RIGHT);
      noteTap(n);
      noteAction(n, { char: 'mukjik', verb: 'move', target: 'floor' }, 'seesaw_right');
    }
    // 바닥에서 시소 끝을 쿵(자리가 다름)은 "써 봤다"가 아니다.
    noteAction(n, { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' }, 'floor');
    noteAction(n, climb, 'floor');
    noteStood(n, 'mukjik', 700, text(stood));
    expect(currentNote(n, 700)).toBe(RIGHT);
    noteTap(n);
    noteAction(n, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, 'seesaw_right');
    noteAction(n, { char: 'mukjik', verb: 'move', target: 'floor' }, 'seesaw_right');
    noteAction(n, climb, 'floor');
    noteStood(n, 'mukjik', 1000, text(stood));
    expect(currentNote(n, 1000)).toBeNull();
  });

  it('다른 처음 한 번 안내가 떠 있으면 덮지 않고 건너뛴다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteGauge(n, 4, 90, DROP);
    noteAction(n, climb, 'floor');
    noteStood(n, 'mukjik', 100, text(stood));
    expect(currentNote(n, 100)).toBe(DROP);
    expect(n.climbing).toBeNull();
  });
});

describe('터치 첫 탭 라벨의 "한 번 더 탭" 줄 (#661 → #680, 설계 4절)', () => {
  const HINT = TEXT['ui.touch.tap_again']!;
  const BASE = 'シーソーの左端にのる';

  it('문구가 ja.json에 있고 원래 라벨 자리({label})가 하나다', () => {
    expect(HINT.split('{label}')).toHaveLength(2);
  });

  it('첫 탭 라벨과 같은 줄에 붙는다(줄바꿈 없음)', () => {
    const s = selectLabelText(BASE, HINT);
    expect(s).toBe(HINT.replace('{label}', BASE));
    expect(s).toContain(BASE);
    expect(s).not.toContain('\n');
  });
});

describe('전환 알림 `{name}に交代` (#692, #603 7·8회차)', () => {
  const SW = 'ズッシーに交代';
  const MUK = 'ズッシーに交代（全体重で踏みつける）';
  const STAND = labelKey({ verb: 'stomp', target: 'seesaw_left' });

  it('터치: 다음 탭까지 남는다(시간으로는 안 지운다)', () => {
    const n = createFirstNotes(5, 'jjuk');
    n.introduced.add('mukjik');
    noteTap(n);
    noteSwitch(n, 'mukjik', MUK);
    noteSwitched(n, SW, 100, true, '');
    expect(currentNote(n, 100)).toBe(SW);
    expect(currentNote(n, 100_000)).toBe(SW);
    noteTap(n);
    expect(currentNote(n, 100_000)).toBeNull();
  });

  it('그 판 처음 바꾼 캐릭터(터치)는 첫 전환 안내 `{name}に交代（{desc}）`가 먼저다. 다시 바꾸면 그때부터 짧은 交代', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitch(n, 'mukjik', MUK);
    noteSwitched(n, SW, 0, true, '');
    expect(currentNote(n, 0)).toBe(MUK);
    noteTap(n);
    noteSwitch(n, 'jjuk', 'ノビーに交代（…）');
    noteSwitched(n, 'ノビーに交代', 0, true, '');
    expect(currentNote(n, 0)).toBe('ノビーに交代');
  });

  it('마우스: 0.8초 뒤 지운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitched(n, SW, 100, false, STAND);
    expect(currentNote(n, 100 + SWITCH_NOTE_TICKS - 1)).toBe(SW);
    expect(currentNote(n, 100 + SWITCH_NOTE_TICKS)).toBeNull();
  });

  it('마우스: 같은 대상 위에서 움직이면 그대로, 다른 대상으로 가면 바로 호버 라벨에 자리를 내준다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitched(n, SW, 0, false, STAND);
    noteHover(n, STAND);
    expect(currentNote(n, 1)).toBe(SW);
    noteHover(n, labelKey({ verb: 'stomp', target: 'seesaw_right' }));
    expect(currentNote(n, 1)).toBeNull();
  });

  it('호버로는 다른 안내(특기 설명·첫 감소)를 안 지운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitch(n, 'mukjik', MUK);
    noteHover(n, STAND);
    expect(currentNote(n, 0)).toBe(MUK);
  });

  it('labelKey: 라벨이 없으면 빈 글, 동사·대상·물건이 다르면 다른 키', () => {
    expect(labelKey(null)).toBe('');
    expect(labelKey({ verb: null, target: 'mukjik' })).not.toBe(labelKey({ verb: null, target: 'ppik' }));
    expect(labelKey({ verb: 'item', target: 'nest', item: 'a' })).not.toBe(labelKey({ verb: 'item', target: 'nest', item: 'b' }));
  });
});
