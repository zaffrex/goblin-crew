import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSeen, SEEN_RECORDER, type Seen } from './seen';

describe('formatSeen (#601 7회차: 스크린샷 사이 말풍선)', () => {
  it('글마다 바로 앞 클릭 번호와 그 뒤 시간, 떠 있던 시간을 적는다', () => {
    const seen: Seen[] = [
      { id: 'bubble', text: '…いい石だ。\n落ち着く。', start: 12_330, end: 16_260 },
      { id: 'clear', text: 'やった！', start: 20_000, end: null },
    ];
    expect(formatSeen(seen, [1_000, 10_000])).toEqual([
      'click 2 뒤 +2.3초, 3.9초 동안 말풍선: 「…いい石だ。 / 落ち着く。」',
      'click 2 뒤 +10.0초, 끝까지 클리어 줄: 「やった！」',
    ]);
  });

  it('첫 클릭 전에 뜬 글(진입 대사)은 그렇게 적는다', () => {
    expect(formatSeen([{ id: 'bubble', text: 'あ', start: 500, end: 900 }], [1_000])).toEqual(['첫 클릭 전, 0.4초 동안 말풍선: 「あ」']);
  });

  it('클릭과 같은 시각에 뜬 글은 그 클릭 뒤로 센다', () => {
    expect(formatSeen([{ id: 'faint', text: 'x', start: 2_000, end: 2_100 }], [1_000, 2_000])[0]).toMatch(/^click 2 뒤 \+0\.0초/);
  });
});

describe('SEEN_RECORDER', () => {
  afterEach(() => vi.useRealTimers());

  /** 가짜 페이지에서 기록기를 돌린다. 요소는 `hidden`·`textContent`만 쓴다(main.ts가 쓰는 것과 같다). */
  function fakePage() {
    vi.useFakeTimers();
    let now = 0;
    const els: Record<string, { hidden: boolean; textContent: string }> = {
      bubble: { hidden: true, textContent: '' },
      clear: { hidden: true, textContent: '' },
      faint: { hidden: true, textContent: '' },
    };
    const win: { __qaSeen?: Seen[] } = {};
    const doc = { getElementById: (id: string) => els[id] ?? null };
    new Function('window', 'document', 'performance', 'setInterval', SEEN_RECORDER)(win, doc, { now: () => now }, setInterval);
    const step = (ms: number) => {
      for (let i = 0; i < ms / 50; i++) {
        now += 50;
        vi.advanceTimersByTime(50);
      }
    };
    return { els, log: () => win.__qaSeen!, step };
  }

  it('숨은 요소의 글은 안 적고, 보일 때만 시작·끝을 적는다', () => {
    const p = fakePage();
    p.els.bubble!.textContent = '숨은 글';
    p.step(200);
    expect(p.log()).toEqual([]);
    p.els.bubble!.hidden = false;
    p.step(100);
    p.els.bubble!.hidden = true;
    p.step(100);
    expect(p.log()).toEqual([{ id: 'bubble', text: '숨은 글', start: 250, end: 350 }]);
  });

  it('떠 있는 채로 글이 바뀌면 줄을 나눈다', () => {
    const p = fakePage();
    p.els.bubble!.hidden = false;
    p.els.bubble!.textContent = 'A';
    p.step(100);
    p.els.bubble!.textContent = 'B';
    p.step(100);
    expect(p.log().map((e) => [e.text, e.end === null])).toEqual([
      ['A', false],
      ['B', true],
    ]);
  });
});
