import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { CARD_LOCK_TICKS, cardInput, cardReady, cardText, cardTick, createStartCard } from './startCard';

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
    expect(card.rows[1]).toEqual({ id: 'mukjik', name: 'ズッシー', ability: 'ドスン: 全体重でドスンとふむ' });
  });

  it('카드 글은 줄마다 30자 이하(휴대폰 13px × 30 < 카드 폭, 6-2-6절)', () => {
    const card = cardText(t);
    const lines = [card.goal, card.why, card.gauge, card.start, ...card.rows.map((r) => r.ability)];
    expect(lines.filter((s) => [...s].length > 30)).toEqual([]);
  });
});
