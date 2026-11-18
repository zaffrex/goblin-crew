import { describe, expect, it } from 'vitest';
import { bubbleFontPx, bubbleMaxWidth, bubbleTailInset, placeBubble, type BubbleOptions } from './bubble';

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

describe('bubbleFontPx', () => {
  it('is internal 9px times the CSS scale, never below 16 (6-5절)', () => {
    // 667×375 @2 → 1.0, 844×390 @3 → 1.33, 1280×720 → 2, 1920×1080 → 4
    expect([1, 4 / 3, 2, 4].map(bubbleFontPx)).toEqual([16, 16, 18, 36]);
    expect(bubbleFontPx(0.8)).toBe(16);
  });
});

describe('placeBubble avoid boxes (#351, 6-5절)', () => {
  // 667×375 @2 실측(main cba305e, Noto Sans CJK): 목표 줄 두 줄, 고리 위 쭉이 x ≈ 160(게임 원점). 화면 좌표로 옮긴다.
  const g = (left: number, right: number, top: number, bottom: number) => ({ left: PHONE.left + left, top: PHONE.top + top, width: right - left, height: bottom - top });
  const GOAL = g(4.5, 111.2, 3.8, 33.4);
  const TAGS = [g(298.7, 330.3, 35.8, 46.8), g(334.7, 356.4, 35.8, 46.8), g(366.7, 388.4, 35.8, 46.8)];
  const HOOK = { x: PHONE.left + 160, top: PHONE.top + 96, bottom: PHONE.top + 150 };
  const O: BubbleOptions = { margin: 4, gap: 9, tailInset: 14, avoidGap: 4 };

  it('pushes right past the goal line and keeps the tail on the speaker', () => {
    // `取った！/店のカギだ！` 120×59: 가운데면 x 100–220이라 목표 줄 끝(111.2)을 덮는다.
    const p = placeBubble(HOOK, { width: 120, height: 59 }, PHONE, O, [GOAL, ...TAGS]);
    expect(p.below).toBe(false);
    expect(p.left).toBe(Math.ceil(GOAL.left + GOAL.width + 4));
    expect(p.left - PHONE.left).toBe(115.5);
    expect(p.left + p.tailX).toBeCloseTo(HOOK.x);
    expect(p.tailX).toBeGreaterThanOrEqual(O.tailInset);
  });

  it('flips below when the gap between the goal line and the face tags is too narrow', () => {
    // `いてっ！まずは/カササギをどうにか…` 184px: 목표 줄 뒤(115.2)로 밀면 오른끝 299.2가 `のばす`(298.7)에 닿는다.
    // 이름표 뒤로 밀면 꼬리가 화자(160)를 못 가리킨다 → 뒤집기.
    const p = placeBubble(HOOK, { width: 184, height: 59 }, PHONE, O, [GOAL, ...TAGS]);
    expect(p.below).toBe(true);
    expect(p.top).toBe(HOOK.bottom + O.gap);
    expect(p.left + p.tailX).toBeCloseTo(HOOK.x);
  });

  it('fits a 152px bubble between the goal line and the face tags', () => {
    const p = placeBubble(HOOK, { width: 152, height: 59 }, PHONE, O, [GOAL, ...TAGS]);
    expect(p.below).toBe(false);
    expect(p.left + 152 + 4).toBeLessThanOrEqual(TAGS[0]!.left);
  });

  it('does not move when the boxes are not in the way (same as before #351)', () => {
    const anchor = { x: 333.5, top: 252.5, bottom: 302.5 };
    expect(placeBubble(anchor, SIZE, PHONE, O, [GOAL, ...TAGS])).toEqual(placeBubble(anchor, SIZE, PHONE, O));
  });

  it('treats a gap of exactly avoidGap as clear', () => {
    const box = { left: 100, top: 100, width: 50, height: 50 };
    // 말풍선 가운데 x 254 → left 154 = 박스 오른끝 150 + 4.
    const p = placeBubble({ x: 254, top: 169, bottom: 200 }, { width: 200, height: 60 }, { left: 0, top: 0, width: 600, height: 400 }, O, [box]);
    expect(p.left).toBe(154);
  });

  it('never pushes left or up: a box right of the speaker flips the bubble', () => {
    const box = { left: PHONE.left + 200, top: PHONE.top + 40, width: 40, height: 20 };
    const p = placeBubble(HOOK, { width: 120, height: 59 }, PHONE, O, [box]);
    expect(p.below).toBe(true);
  });
});

describe('bubbleTailInset', () => {
  it('is 0.875em: 14 at 16px, as before', () => {
    expect([16, 18, 36].map(bubbleTailInset)).toEqual([14, 16, 32]);
  });

  it('keeps the tail (±7px) off the 0.625em rounded corner at every font size', () => {
    for (const font of [16, 18, 24, 36, 48]) {
      const radius = 0.625 * font;
      const tailLeftEdge = bubbleTailInset(font) - 7;
      // 꼬리 왼쪽 끝에서 모서리 곡선이 올라간 높이. 1px 미만이면 테두리 2px 안에 묻힌다.
      const dx = Math.max(0, radius - tailLeftEdge);
      const lift = radius - Math.sqrt(radius * radius - dx * dx);
      expect(lift).toBeLessThan(1);
    }
  });
});
