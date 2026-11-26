import { describe, expect, it } from 'vitest';
import { bubbleBounds, bubbleFontPx, bubbleMaxWidth, bubbleTailInset, placeBubble, type BubbleOptions } from './bubble';

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

describe('placeBubble side placement (#356, 6-5절)', () => {
  // 667×375 @2(CSS 1.0배). 고리에 매달린 사람 몸 상자 ≈ 내부 x 148–172, 머리 위끝 96, 발끝 150. 둥지·까치·바구니 히트 박스.
  const g = (left: number, top: number, width: number, height: number) => ({ left: PHONE.left + left, top: PHONE.top + top, width, height });
  const GOAL = g(4.5, 3.8, 106.7, 29.6);
  const TAGS = [g(298.7, 35.8, 31.6, 11), g(334.7, 35.8, 21.7, 11), g(366.7, 35.8, 21.7, 11)];
  const NEST = g(128, 30, 36, 24);
  const MAGPIE = g(134, 6, 24, 24);
  // 바구니·내복은 장난감(`hintAbility` 없음, #598): main.ts `bubbleKeepBoxes`가 `toy`로 넘긴다.
  const BASKET = { ...g(144, 212, 32, 24), toy: true };
  const LONG_JOHNS = { ...g(372, 112, 32, 40), toy: true };
  const KEEP = [NEST, MAGPIE, BASKET, LONG_JOHNS];
  const HOOK = { x: PHONE.left + 160, top: PHONE.top + 96, bottom: PHONE.top + 150, left: PHONE.left + 148, right: PHONE.left + 172 };
  const O: BubbleOptions = { margin: 4, gap: 9, tailInset: 14, avoidGap: 4 };
  const boxOf = (p: { left: number; top: number }, s: { width: number; height: number }) => ({ left: p.left, top: p.top, width: s.width, height: s.height });
  const hit = (a: { left: number; top: number; width: number; height: number }, b: typeof a) =>
    a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

  it('moves a bubble that would cover the nest to the right of the hanging speaker', () => {
    // `取った！/店のカギだ！` 120×59: 위에 두면(#351 오른쪽 밀기 뒤 y 28–87) 둥지(30–54)를 덮는다.
    const size = { width: 120, height: 59 };
    const p = placeBubble(HOOK, size, PHONE, O, [GOAL, ...TAGS], KEEP);
    expect(p.side).toBe('right');
    expect(p.left).toBe(Math.ceil(HOOK.right + O.gap));
    expect(p.top).toBe(HOOK.top);
    expect(p.tailY).toBe(O.tailInset);
    expect(p.below).toBe(false);
    for (const k of KEEP) expect(hit(boxOf(p, size), k)).toBe(false);
  });

  it('also moves the flipped 184px bubble, which would cover the basket below', () => {
    const size = { width: 184, height: 59 };
    const p = placeBubble(HOOK, size, PHONE, O, [GOAL, ...TAGS], KEEP);
    expect(p.side).toBe('right');
    expect(p.left + size.width).toBeLessThanOrEqual(LONG_JOHNS.left);
  });

  it('uses the left side when the right side would leave the game screen', () => {
    const size = { width: 120, height: 59 };
    const near = { ...HOOK, x: PHONE.left + 400, left: PHONE.left + 388, right: PHONE.left + 412 };
    const keep = [g(380, 30, 36, 24)];
    const p = placeBubble(near, size, PHONE, O, [], keep);
    expect(p.side).toBe('left');
    expect(p.left + size.width).toBe(Math.floor(near.left - O.gap));
  });

  it('keeps the old place when neither side fits and it covers only a toy (#598)', () => {
    // 300px는 목표 줄 때문에 위에 못 둬서 발 아래로 뒤집혀 바구니(장난감)만 덮는다. 장난감만이면 예전 자리 그대로.
    const wide = { width: 300, height: 59 };
    const p = placeBubble(HOOK, wide, PHONE, O, [GOAL, ...TAGS], KEEP);
    expect(p.side).toBeUndefined();
    expect(p).toEqual(placeBubble(HOOK, wide, PHONE, O, [GOAL, ...TAGS]));
    expect(hit(boxOf(p, wide), BASKET)).toBe(true);
  });

  it('keeps the old place when every candidate covers clues equally (ties go to the first place)', () => {
    const wide = { width: 300, height: 59 };
    const everywhere = g(0, 0, 480, 270);
    expect(placeBubble(HOOK, wide, PHONE, O, [GOAL, ...TAGS], [everywhere])).toEqual(placeBubble(HOOK, wide, PHONE, O, [GOAL, ...TAGS]));
  });

  it('keeps the old place when it covers only toys, even if the flipped place is free (#598, screen 1 floor)', () => {
    const floor = { x: PHONE.left + 160, top: PHONE.top + 150, bottom: PHONE.top + 190 };
    const size = { width: 120, height: 59 };
    const toy = { ...g(100, 80, 120, 40), toy: true };
    const base = placeBubble(floor, size, PHONE, O, []);
    expect(hit(boxOf(base, size), toy)).toBe(true);
    expect(placeBubble(floor, size, PHONE, O, [], [toy])).toEqual(base);
    // 같은 상자가 단서면 뒤집는다.
    const clue = { ...toy, toy: false };
    const p = placeBubble(floor, size, PHONE, O, [], [clue]);
    expect(p.below).toBe(true);
    expect(hit(boxOf(p, size), clue)).toBe(false);
  });

  it('prefers covering a teammate over a clue when every place covers something (#598 order: clue → body → toy)', () => {
    // 왼쪽 끝 화자: 왼쪽 옆은 화면 밖, 위·아래는 단서, 오른쪽 옆은 동료 몸을 덮는다.
    const edge = { x: PHONE.left + 60, top: PHONE.top + 120, bottom: PHONE.top + 160, left: PHONE.left + 48, right: PHONE.left + 72 };
    const size = { width: 100, height: 40 };
    const clues = [g(20, 75, 40, 30), g(20, 175, 40, 30)];
    const mate = g(90, 120, 24, 40);
    const p = placeBubble(edge, size, PHONE, O, [], clues, [mate]);
    expect(p.side).toBe('right');
    for (const k of clues) expect(hit(boxOf(p, size), k)).toBe(false);
    expect(hit(boxOf(p, size), mate)).toBe(true);
    // 동료 대신 장난감이면 마찬가지로 옆이지만, 위 자리가 장난감만 덮으면 예전 자리다.
    const toys = clues.map((k) => ({ ...k, toy: true }));
    expect(placeBubble(edge, size, PHONE, O, [], toys, [mate])).toEqual(placeBubble(edge, size, PHONE, O, []));
  });

  it('does not move when nothing is covered (same as before #356)', () => {
    const floor = { x: PHONE.left + 400, top: PHONE.top + 200, bottom: PHONE.top + 244, left: PHONE.left + 388, right: PHONE.left + 412 };
    expect(placeBubble(floor, SIZE, PHONE, O, [GOAL, ...TAGS], [NEST, MAGPIE])).toEqual(placeBubble(floor, SIZE, PHONE, O, [GOAL, ...TAGS]));
  });

  it('skips a side that hits an avoid box or another keep box', () => {
    const size = { width: 120, height: 59 };
    const blocker = g(190, 100, 20, 20);
    const p = placeBubble(HOOK, size, PHONE, O, [GOAL, ...TAGS, blocker], KEEP);
    expect(p.side).toBe('left');
    const q = placeBubble(HOOK, size, PHONE, O, [GOAL, ...TAGS], [...KEEP, blocker]);
    expect(q.side).toBe('left');
  });

  it('does not move beside the speaker onto a teammate (floor: keeps the old place over a toy)', () => {
    // 667×375 실측: 바닥 오른쪽 プピ 위 말풍선이 내복을 덮는다. 오른쪽은 화면 밖, 왼쪽은 ノビー·ズッシー 얼굴이다.
    const ppik = { x: PHONE.left + 440, top: PHONE.top + 205, bottom: PHONE.top + 244, left: PHONE.left + 428, right: PHONE.left + 452 };
    const mates = [g(348, 205, 24, 39), g(388, 200, 26, 44)];
    const size = { width: 195, height: 59 };
    const p = placeBubble(ppik, size, PHONE, O, [GOAL, ...TAGS], KEEP, mates);
    expect(p.side).toBeUndefined();
    expect(p).toEqual(placeBubble(ppik, size, PHONE, O, [GOAL, ...TAGS]));
    // 동료가 없으면 왼쪽 옆으로 간다(몸 상자를 안 넘기면 예전 동작과 다르다는 것을 확인).
    expect(placeBubble(ppik, size, PHONE, O, [GOAL, ...TAGS], KEEP).side).toBe('left');
  });

  it('never places beside a speaker without body edges', () => {
    const noEdges = { x: HOOK.x, top: HOOK.top, bottom: HOOK.bottom };
    expect(placeBubble(noEdges, { width: 120, height: 59 }, PHONE, O, [GOAL, ...TAGS], KEEP).side).toBeUndefined();
  });

  it('lifts a side bubble off the bottom edge and moves the tail down, but only while it still points at the body', () => {
    const low = { ...HOOK, top: PHONE.top + 230, bottom: PHONE.top + 268 };
    // 머리 위 물건: 위 자리를 막아서 옆으로 가게 한다(두 경우 모두).
    const keep = [g(130, 160, 40, 100)];
    const size = { width: 120, height: 59 };
    const p = placeBubble(low, size, PHONE, O, [], keep);
    expect(p.side).toBe('right');
    expect(p.top + size.height).toBe(PHONE.top + PHONE.height - O.margin);
    expect(p.top + p.tailY!).toBe(low.top + O.tailInset);
    // 머리가 화면 맨 아래라 꼬리가 말풍선 아래 모서리를 넘으면 포기한다.
    const lower = { ...HOOK, top: PHONE.top + 262, bottom: PHONE.top + 269 };
    // 뒤집은 자리(화면 맨 아래로 끌어온 발 아래)도 물건을 거의 같게(53% vs 59%) 덮으므로 처음 자리 그대로다(#598 COST_EPS).
    const q = placeBubble(lower, size, PHONE, O, [], keep);
    expect(q.side).toBeUndefined();
    expect(q).toEqual(placeBubble(lower, size, PHONE, O, []));
  });
});

describe('bubbleBounds (#601 묶음 1-1: 아래 라벨 줄·게이지 띠 비우기)', () => {
  // 1280×720 데스크톱 = 2배: 게임 화면 960×540이 (160,45). 라벨 아래끝 = 내부 254 → 45 + 508 = 553, 라벨 14px.
  const DESK = { left: 160, top: 45, width: 960, height: 540 };
  const LABEL_BOTTOM_CSS = 553;
  const area = bubbleBounds(DESK, LABEL_BOTTOM_CSS, 14);

  it('ends the bubble area at the top of the label line (14px × 1.6 = 22.4 → 530)', () => {
    expect(area).toEqual({ left: 160, top: 45, width: 960, height: 530 - 45 });
  });

  it('keeps a flipped bubble of a floor speaker off the label line and the gauge band', () => {
    // 묶음 1-1 `r2-b.png`: 바닥 ノビー(발끝 515) 말풍선이 발 아래로 갔다. 위가 막힌 경우를 머리 위끝 60으로 만든다.
    const anchor = { x: 605, top: 60, bottom: 515 };
    const size = { width: 190, height: 65 };
    const p = placeBubble(anchor, size, area, OPTS);
    expect(p.below).toBe(true);
    expect(p.top + size.height).toBe(530 - OPTS.margin);
    // 예전(게임 화면 전체)에는 아래끝 581까지 내려가 라벨(531~553)과 게이지 띠(557~585)를 덮었다.
    const old = placeBubble(anchor, size, DESK, OPTS);
    expect(old.top + size.height).toBe(581);
  });

  it('does not change a bubble above the head (same as before)', () => {
    const anchor = { x: 605, top: 300, bottom: 400 };
    expect(placeBubble(anchor, SIZE, area, OPTS)).toEqual(placeBubble(anchor, SIZE, DESK, OPTS));
  });

  it('never goes negative when the label sits above the game top', () => {
    expect(bubbleBounds(DESK, 40, 14).height).toBe(0);
  });
});

describe('placeBubble speaker face (#967·#970: 화자 얼굴 > 단서 > 동료 몸 > 장난감)', () => {
  // 667×375 @2(CSS 1.0배). 말풍선 영역은 라벨 줄 위까지(`bubbleBounds`, 라벨 14px): 내부 아래끝 약 231.6.
  const area = bubbleBounds(PHONE, PHONE.top + 254, 14);
  const O: BubbleOptions = { margin: 4, gap: 9, tailInset: 14, avoidGap: 4 };
  const g = (left: number, top: number, width: number, height: number) => ({ left: PHONE.left + left, top: PHONE.top + top, width, height });
  const boxOf = (p: { left: number; top: number }, s: { width: number; height: number }) => ({ left: p.left, top: p.top, width: s.width, height: s.height });
  const hit = (a: { left: number; top: number; width: number; height: number }, b: typeof a) =>
    a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  // 바닥 プピ(#970 모양): 몸 x 265–298, 머리 위끝 194, 발끝 252. 얼굴 상자 x 270–294, y 196–216.
  const FACE = g(270, 196, 24, 20);
  const ppik = { x: PHONE.left + 282, top: PHONE.top + 194, bottom: PHONE.top + 252, face: FACE };
  const size = { width: 120, height: 34 };
  const withoutFace = <T extends { face?: unknown }>(a: T): Omit<T, 'face'> => {
    const out = { ...a };
    delete out.face;
    return out;
  };

  it('does not take a flipped place that the label line pulls up onto the speaker face', () => {
    // 머리 위 자리는 단서(덕트처럼 위에 긴 것)를 덮는다. 옆은 몸 끝이 없어 못 둔다. 남는 건 발 아래로 뒤집은 자리인데,
    // 라벨 줄 위로 끌려 올라와 얼굴 위에 놓인다. 예전 값은 얼굴을 안 세서 이 자리가 덮는 값 0으로 이겼다.
    const clue = g(240, 150, 90, 12);
    const old = placeBubble(withoutFace(ppik), size, area, O, [], [clue]);
    expect(old.below).toBe(true);
    expect(hit(boxOf(old, size), FACE)).toBe(true);
    const p = placeBubble(ppik, size, area, O, [], [clue]);
    expect(p.below).toBe(false);
    expect(hit(boxOf(p, size), FACE)).toBe(false);
    expect(hit(boxOf(p, size), clue)).toBe(true);
  });

  it('moves a first place that covers the speaker face beside the speaker when the side is free', () => {
    // 위가 피할 상자(목표 줄·이름표)로 막혀 발 아래로 뒤집혔고(#967 휴대폰), 그 자리가 얼굴을 덮는다. 단서는 안 덮는다.
    const withEdges = { ...ppik, left: PHONE.left + 265, right: PHONE.left + 298 };
    const ceiling = g(0, 0, 480, 180);
    const old = placeBubble(withoutFace(withEdges), size, area, O, [ceiling]);
    expect(old.below).toBe(true);
    expect(hit(boxOf(old, size), FACE)).toBe(true);
    const p = placeBubble(withEdges, size, area, O, [ceiling]);
    expect(p.side).toBeDefined();
    expect(hit(boxOf(p, size), FACE)).toBe(false);
  });

  it('keeps the first place when it already misses the face (same as before)', () => {
    const above = { x: PHONE.left + 282, top: PHONE.top + 194, bottom: PHONE.top + 252, left: PHONE.left + 265, right: PHONE.left + 298 };
    const clue = g(400, 20, 30, 30);
    expect(placeBubble({ ...above, face: FACE }, size, area, O, [], [clue])).toEqual(placeBubble(above, size, area, O, [], [clue]));
  });

  it('keeps the first place when every other place also covers the face', () => {
    const ceiling = g(0, 0, 480, 190);
    expect(placeBubble(ppik, size, area, O, [ceiling])).toEqual(placeBubble(withoutFace(ppik), size, area, O, [ceiling]));
  });
});
