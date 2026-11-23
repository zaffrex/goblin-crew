import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_BY_CLICK_MS, CLOSED_NOTE, formatSeen, GAUGE_NOTE_TEXT, LATE_REACTION_MS, MIXED_NOTE, SEEN_RECORDER, type Seen } from './seen';

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

  it('글 앞 8초 안에 클릭이 더 있으면 그 클릭도 후보로 적고 끝에 안내를 붙인다 (#601 8회차)', () => {
    // 8회차 재현: click 15(대상) 뒤 0.4초에 click 16(바닥)을 눌렀고, click 15 쪽 대사가 4.0초 뒤에 떴다.
    const seen: Seen[] = [{ id: 'bubble', text: '…濡れた。\nまあ、いいか。', start: 14_000, end: 16_600 }];
    expect(formatSeen(seen, [1_000, 10_000, 10_400])).toEqual([
      'click 3 뒤 +3.6초 / click 2 뒤 +4.0초, 2.6초 동안 말풍선: 「…濡れた。 / まあ、いいか。」',
      MIXED_NOTE,
    ]);
  });

  it('후보는 최대 2개(바로 앞 클릭 + 그 앞 하나): 얼굴 고르기 클릭까지 줄줄이 붙지 않게', () => {
    const lines = formatSeen([{ id: 'bubble', text: 'x', start: 5_000, end: 5_500 }], [1_000, 2_000, 3_000, 4_000]);
    expect(lines[0]).toBe('click 4 뒤 +1.0초 / click 3 뒤 +2.0초, 0.5초 동안 말풍선: 「x」');
  });

  it('8초 경계: 정확히 8초 전 클릭은 후보, 그보다 먼 클릭은 아니다', () => {
    const at = 20_000;
    const one = (clicks: number[]) => formatSeen([{ id: 'bubble', text: 'x', start: at, end: null }], clicks)[0];
    expect(one([at - LATE_REACTION_MS, at - 100])).toBe('click 2 뒤 +0.1초 / click 1 뒤 +8.0초, 끝까지 말풍선: 「x」');
    expect(one([at - LATE_REACTION_MS - 1, at - 100])).toBe('click 2 뒤 +0.1초, 끝까지 말풍선: 「x」');
  });

  it('후보가 하나뿐이면 안내를 안 붙인다', () => {
    expect(formatSeen([{ id: 'bubble', text: 'x', start: 20_000, end: 21_000 }], [1_000, 15_000])).toEqual(['click 2 뒤 +5.0초, 1.0초 동안 말풍선: 「x」']);
  });

  it('클릭과 같은 시각에 뜬 글은 그 클릭 뒤로 센다', () => {
    expect(formatSeen([{ id: 'faint', text: 'x', start: 2_000, end: 2_100 }], [1_000, 2_000])[0]).toMatch(/^click 2 뒤 \+0\.0초/);
  });
});

describe('formatSeen: 클릭이 닫은 글 (#601 묶음 1 「1.0초만 떠서 읽을 틈이 없었다」)', () => {
  it('떠 있는 동안 누른 클릭 바로 뒤에 사라지면 그 클릭이 닫았을 수 있다고 적고 끝에 안내를 붙인다', () => {
    // 묶음 1-2 #2 재현: 대사가 뜨고 1.0초 뒤 다음 클릭을 눌렀더니 0.05초 뒤 사라졌다(잠금 뒤 클릭 = 닫기).
    const seen: Seen[] = [{ id: 'bubble', text: 'うわっ！冷たっ！\nびしょびしょやん…', start: 5_000, end: 6_050 }];
    expect(formatSeen(seen, [1_000, 6_000])).toEqual([
      'click 1 뒤 +4.0초, 1.1초 동안(click 2 뒤 닫힘) 말풍선: 「うわっ！冷たっ！ / びしょびしょやん…」',
      CLOSED_NOTE,
    ]);
  });

  it('잠금 전에 눌러 맡아 둔 클릭(#832)이 1.0초에 닫은 것도 잡는다', () => {
    const seen: Seen[] = [{ id: 'bubble', text: 'x', start: 5_000, end: 6_000 }];
    expect(formatSeen(seen, [1_000, 5_200])[0]).toBe('click 1 뒤 +4.0초, 1.0초 동안(click 2 뒤 닫힘) 말풍선: 「x」');
  });

  it('클릭 뒤 오래 떠 있다가 사라졌으면(버려진 클릭 뒤 제 시간에 끝남) 닫힘으로 안 적는다', () => {
    const at = 10_000;
    const one = (end: number) => formatSeen([{ id: 'bubble', text: 'x', start: 5_000, end }], [1_000, at])[0];
    expect(one(at + CLOSE_BY_CLICK_MS)).toMatch(/\(click 2 뒤 닫힘\)/);
    expect(one(at + CLOSE_BY_CLICK_MS + 1)).not.toMatch(/닫힘/);
  });

  it('글을 띄운 클릭(뜨기 전·같은 시각)과 사라진 뒤 클릭은 닫은 클릭이 아니다', () => {
    expect(formatSeen([{ id: 'bubble', text: 'x', start: 2_000, end: 2_500 }], [2_000, 3_000])).toEqual(['click 1 뒤 +0.0초, 0.5초 동안 말풍선: 「x」']);
  });

  it('두 안내가 다 필요하면 섞임 안내 다음에 닫힘 안내', () => {
    const seen: Seen[] = [{ id: 'bubble', text: 'x', start: 14_000, end: 15_100 }];
    expect(formatSeen(seen, [10_000, 10_400, 15_000]).slice(1)).toEqual([MIXED_NOTE, CLOSED_NOTE]);
  });
});

describe('formatSeen: 첫 게이지 안내 (#601 P1-e)', () => {
  it('다치는 실패 뒤 안내를 게이지 안내로 적고, 다음 클릭이 지웠으면 그렇게 적는다', () => {
    // 묶음 1-3 #2·#3 재현(라이브 8c5046b): click 1(재킷) 뒤 +4.1초 칸 터짐 + 안내 + 젖는 대사, 1.2초 뒤 click 2(동상 팔, 걷기)가 안내를 지움.
    const seen: Seen[] = [
      { id: 'gaugeNote', text: GAUGE_NOTE_TEXT, start: 5_100, end: 6_250 },
      { id: 'bubble', text: 'うわっ！冷たっ！\nびしょびしょやん…', start: 5_100, end: 8_400 },
    ];
    expect(formatSeen(seen, [1_000, 6_200])).toEqual([
      `click 1 뒤 +4.1초, 1.1초 동안(click 2 뒤 닫힘) 게이지 안내: 「${GAUGE_NOTE_TEXT}」`,
      'click 1 뒤 +4.1초, 3.3초 동안 말풍선: 「うわっ！冷たっ！ / びしょびしょやん…」',
      CLOSED_NOTE,
    ]);
  });

  it('안내 글은 화면 UI 글(ja.json `ui.hud.gauge_first_drop`)이다', () => {
    expect(GAUGE_NOTE_TEXT).toMatch(/ゲージ/);
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
      label: { hidden: true, textContent: '' },
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

  it('#label은 첫 게이지 안내 글자일 때만 적는다(호버 라벨은 안 적는다)', () => {
    const p = fakePage();
    p.els.label!.hidden = false;
    p.els.label!.textContent = 'スーツの上着までのばす';
    p.step(100);
    p.els.label!.textContent = GAUGE_NOTE_TEXT;
    p.step(100);
    p.els.label!.textContent = 'あるく';
    p.step(100);
    expect(p.log()).toEqual([{ id: 'gaugeNote', text: GAUGE_NOTE_TEXT, start: 150, end: 250 }]);
  });
});
