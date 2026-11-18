import { describe, expect, it } from 'vitest';
import { bubbleMaxWidth, placeBubble, type BubbleOptions } from './bubble';

const OPTS: BubbleOptions = { margin: 4, gap: 6, tailInset: 12 };
// 667×375 @2 = CSS 1.0배: 게임 화면 480×270이 가운데.
const PHONE = { left: 93.5, top: 52.5, width: 480, height: 270 };
const SIZE = { width: 200, height: 60 };

describe('placeBubble', () => {
  it('centres above the speaker when there is room', () => {
    const p = placeBubble({ x: 333.5, top: 252.5, bottom: 302.5 }, SIZE, PHONE, OPTS);
    expect(p).toEqual({ left: 233.5, top: 186.5, below: false, tailX: 100 });
  });

  it('pushes left from the right edge and keeps the tail on the speaker', () => {
    // 화면 1 시작 위치 floor(내부 x 400)에 세 사람이 있다. #329 첫 대사가 여기서 좁게 접혔다.
    const p = placeBubble({ x: 93.5 + 400, top: 200, bottom: 280 }, SIZE, PHONE, OPTS);
    expect(p.left + SIZE.width).toBe(PHONE.left + PHONE.width - OPTS.margin);
    expect(p.left + p.tailX).toBe(93.5 + 400);
    expect(p.below).toBe(false);
  });

  it('pushes right from the left edge', () => {
    const p = placeBubble({ x: 100, top: 200, bottom: 280 }, SIZE, PHONE, OPTS);
    expect(p.left).toBe(PHONE.left + OPTS.margin);
    expect(p.tailX).toBe(OPTS.tailInset);
  });

  it('flips below the speaker when the top would leave the game screen', () => {
    // 까치(내부 y 6)처럼 화면 위쪽 화자.
    const p = placeBubble({ x: 333.5, top: 58.5, bottom: 90 }, SIZE, PHONE, OPTS);
    expect(p.below).toBe(true);
    expect(p.top).toBe(96);
  });

  it('keeps a flipped bubble inside the bottom edge', () => {
    const p = placeBubble({ x: 333.5, top: 60, bottom: 300 }, SIZE, PHONE, OPTS);
    expect(p.below).toBe(true);
    expect(p.top + SIZE.height).toBe(PHONE.top + PHONE.height - OPTS.margin);
  });

  it('does not depend on where the speaker stands for its own size', () => {
    // 폭·높이는 입력 그대로다. 같은 글은 어디서 말해도 같은 상자(완료 조건 1).
    const xs = [100, 333.5, 560];
    const lefts = xs.map((x) => placeBubble({ x, top: 200, bottom: 280 }, SIZE, PHONE, OPTS).left);
    for (const l of lefts) {
      expect(l).toBeGreaterThanOrEqual(PHONE.left + OPTS.margin);
      expect(l + SIZE.width).toBeLessThanOrEqual(PHONE.left + PHONE.width - OPTS.margin);
    }
  });

  it('pins a bubble wider than the screen to the left margin', () => {
    const p = placeBubble({ x: 333.5, top: 200, bottom: 280 }, { width: 600, height: 40 }, PHONE, OPTS);
    expect(p.left).toBe(PHONE.left + OPTS.margin);
  });
});

describe('bubbleMaxWidth', () => {
  it('is the game screen width minus both margins', () => {
    expect(bubbleMaxWidth(PHONE, OPTS)).toBe(472);
    expect(bubbleMaxWidth({ left: 0, top: 0, width: 4, height: 4 }, OPTS)).toBe(0);
  });
});
