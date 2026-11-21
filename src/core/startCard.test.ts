import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { screenTextKey } from './screenPick';
import { INTERNAL_WIDTH } from './config';
import { CARD_LOCK_TICKS, cardFacePx, cardPointer, cardRowGapPx, cardTight, cardInput, cardReady, cardText, cardTick, createStartCard } from './startCard';

const TEXT: Readonly<Record<string, string>> = texts;
const t = (id: string): string => TEXT[id] ?? id;

describe('시작 카드 (ui-interaction.md 6-2-1절, #285)', () => {
  it('1.0초(60틱) 전에는 탭을 먹기만 하고 닫히지 않는다', () => {
    const c = createStartCard();
    expect(CARD_LOCK_TICKS).toBe(60);
    for (let i = 0; i < CARD_LOCK_TICKS - 1; i++) cardTick(c);
    expect(cardReady(c)).toBe(false);
    expect(cardInput(c)).toBe(true); // 게임으로 넘기지 않는다
    expect(c.open).toBe(true);
  });

  it('1.0초 뒤 탭은 카드를 닫고, 그 탭도 게임으로 넘기지 않는다', () => {
    const c = createStartCard();
    for (let i = 0; i < CARD_LOCK_TICKS; i++) cardTick(c);
    expect(cardReady(c)).toBe(true);
    expect(cardInput(c)).toBe(true);
    expect(c.open).toBe(false);
    expect(cardReady(c)).toBe(false);
  });

  it('닫힌 뒤의 입력은 게임 몫이다', () => {
    const c = createStartCard();
    for (let i = 0; i < CARD_LOCK_TICKS; i++) cardTick(c);
    cardInput(c);
    expect(cardInput(c)).toBe(false);
  });

  it('글은 6-2-6절 키를 다 채우고, 특기 줄은 `동사: 설명`이다', () => {
    const card = cardText(t);
    const all = [card.goal, card.why, card.gauge, card.start, ...card.rows.flatMap((r) => [r.name, r.ability])];
    expect(all.filter((s) => s === '' || /^(ui|char)\./.test(s) || s.includes(': ui.'))).toEqual([]);
    expect(card.rows.map((r) => r.id)).toEqual(['jjuk', 'mukjik', 'ppik']);
    expect(card.rows[1]).toEqual({ id: 'mukjik', name: 'ズッシー', ability: '特技「ドスン」全体重で踏みつける' });
  });

  it('카드 글은 줄마다 30자 이하(휴대폰 13px × 30 < 카드 폭, 6-2-6절). 화면마다 바뀌는 목표·이유 줄도(#380)', () => {
    for (const screen of ['magpie_nest', 'park_fountain']) {
      const ts = (id: string): string => TEXT[screenTextKey(TEXT, screen, id)] ?? id;
      for (const pointer of ['touch', 'mouse'] as const) {
        const card = cardText(ts, pointer);
        const lines = [card.goal, card.why, card.gauge, card.start, ...card.rows.map((r) => r.ability)];
        expect(lines.filter((s) => [...s].length > 30), `${screen} ${pointer}`).toEqual([]);
      }
    }
  });

  it('특기 줄은 667×375 압축 카드 한 줄에 들어간다: 얼굴·이름 칸을 빼면 전각 23자까지(#669)', () => {
    // `#card li`는 nowrap, 카드는 overflow: auto라 넘치면 접히지 않고 카드 전체가 가로 스크롤된다.
    // 값은 index.html `#card[data-tight]`와 main.ts renderCard: 글자 13px, 상한 floor(480 × 0.9), 테두리 2px,
    // padding 0.8em, 얼굴 36px(cardFacePx(1, 2)), 칸 사이 0.4em 두 번, 이름 칸 min-width 4.5em.
    // 실측(PR #667, Chrome + Noto Sans CJK JP): `プピ` 줄 23자 = 줄 403.5px, 카드 428.3 / 432px.
    const FONT = 13;
    const content = Math.floor(INTERNAL_WIDTH * 0.9) - 2 * 2 - 2 * 0.8 * FONT;
    const fixed = cardFacePx(1, 2) + 2 * 0.4 * FONT + 4.5 * FONT;
    const maxEm = Math.floor((content - fixed) / FONT);
    expect(maxEm).toBe(23);
    // 전각 1em으로 센다(ASCII도 1em으로 잡아 넉넉하게). 이름이 4.5em을 넘으면 칸이 늘어나 예산이 줄어든다.
    for (const r of cardText(t).rows) {
      expect([...r.name].length, r.name).toBeLessThanOrEqual(4);
      expect([...r.ability].length, r.ability).toBeLessThanOrEqual(maxEm);
    }
  });

  it('목표·이유 줄은 자동 줄바꿈이 걸려서 더 짧게: 목표 16자, 이유 20자 이하(#380)', () => {
    // 667×375 압축 카드에서 27자 이유 줄이 `出られ／ない`로 낱말 중간에서 접혔다(PR 스크린샷). 화면 1은 11자·18자.
    for (const screen of ['magpie_nest', 'park_fountain']) {
      const card = cardText((id) => TEXT[screenTextKey(TEXT, screen, id)] ?? id);
      expect([...card.goal].length, `${screen} ${card.goal}`).toBeLessThanOrEqual(16);
      expect([...card.why].length, `${screen} ${card.why}`).toBeLessThanOrEqual(20);
    }
  });

  it('시작 줄은 터치면 タップ, 마우스면 クリック이고 나머지 줄은 같다(#364)', () => {
    const touch = cardText(t, 'touch');
    const mouse = cardText(t, 'mouse');
    expect(touch.start).toContain('タップ');
    expect(mouse.start).toContain('クリック');
    expect(mouse.start).not.toContain('タップ');
    expect(cardText(t).start).toBe(mouse.start); // 기본은 데스크톱 우선
    expect({ ...touch, start: '' }).toEqual({ ...mouse, start: '' });
  });

  it('입력 방식은 주 포인터로 고른다: 손가락+호버 없음만 touch(#364)', () => {
    const mq = (touch: boolean) => (q: string) => ({ matches: touch && q === '(hover: none) and (pointer: coarse)' });
    expect(cardPointer(mq(true))).toBe('touch');
    expect(cardPointer(mq(false))).toBe('mouse');
    expect(cardPointer(undefined)).toBe('mouse');
  });

  it('얼굴은 정수 배율로 글자와 같이 커지고 최소 2배다(6-2-1절)', () => {
    expect(cardFacePx(640 / 480, 3)).toBe(48); // 휴대폰 가로 844×390 @3
    expect(cardFacePx(2)).toBe(48); // 1280×720
    expect(cardFacePx(1600 / 480)).toBe(72);
    expect(cardFacePx(4)).toBe(96); // 1920×1080, 글자 32px의 3em
  });

  it('얼굴은 장치 px로 그림 24의 정수배다(소수 dpr 포함, #310)', () => {
    // [CSS 배율, dpr]. 배율 × dpr은 display.ts가 고른 장치 정수 배율이다.
    const cases: [number, number][] = [[2, 1], [4, 1], [3.2, 1.25], [4 / 1.5, 1.5], [2, 1.5], [640 / 480, 3], [1, 2], [2 / 3, 3], [1, 1], [1.6, 1.25]];
    for (const [scale, dpr] of cases) {
      const device = cardFacePx(scale, dpr) * dpr;
      expect(Math.abs(device / 24 - Math.round(device / 24)), `${scale}×${dpr}`).toBeLessThan(1e-9);
    }
    expect(cardFacePx(3.2, 1.25)).toBe(76.8); // 1536×864 @1.25: 장치 96 = 4배(예전 72 CSS = 90 장치, 3.75배)
    expect(cardFacePx(2, 1.5)).toBe(48); // 장치 72 = 3배
  });

  it('배율 1.2 미만은 압축 카드, 얼굴은 장치 정수배로 작게(#335)', () => {
    expect(cardTight(1)).toBe(true); // 667×375 @2
    expect(cardTight(640 / 480)).toBe(false); // 844×390 @3
    expect(cardTight(2)).toBe(false);
    expect(cardFacePx(1, 2)).toBe(36); // 장치 72 = 3배, 48이면 높이 상한(229px)을 넘는다
    expect(cardFacePx(2 / 3, 3)).toBe(32); // 장치 96 = 4배
    expect(cardFacePx(1, 1)).toBe(24);
  });

  it('특기 줄 사이는 0.15em을 장치 px 정수로 반올림한다(#342)', () => {
    expect(cardRowGapPx(13, 2)).toBe(2); // 667×375 @2: 장치 4px (0.15em이면 3.9)
    expect(cardRowGapPx(13, 3)).toBe(2); // 844×390 @3: 장치 6px
    expect(cardRowGapPx(32, 1)).toBe(5); // 1920×1080
    expect(cardRowGapPx(16, 1.25)).toBe(2.4); // 장치 3px
    expect(cardRowGapPx(1, 1)).toBe(1); // 최소 장치 1px
    for (const [font, dpr] of [[13, 1.25], [13, 1.5], [21, 1.25], [27, 1.5]] as const) {
      const device = cardRowGapPx(font, dpr) * dpr;
      expect(Math.abs(device - Math.round(device)), `${font}@${dpr}`).toBeLessThan(1e-9);
    }
  });
});
