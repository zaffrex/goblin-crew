import { describe, expect, it } from 'vitest';
import mapJson from '../../content/map.json';
import orderJson from '../../content/screens/order.json';
import texts from '../../content/text/ja.json';
import { MAP_LAYOUT, MAP_LOCKED_MS, mapCardBox, mapLockedShown, mapPathDots, mapReady, mapStampAt, mapThumbBox, thumbOrigin, type Box } from './map';

const SCENE = { width: 480, height: 270 };

describe('map layout (title-and-map 3절)', () => {
  it('cards are 128×100 at y 76, x 24·176·328, and there is no 4th slot', () => {
    expect([0, 1, 2].map(mapCardBox)).toEqual([
      { left: 24, top: 76, width: 128, height: 100 },
      { left: 176, top: 76, width: 128, height: 100 },
      { left: 328, top: 76, width: 128, height: 100 },
    ]);
    expect(mapCardBox(3)).toBeNull();
  });

  it('cards keep 24px gaps and 24px screen margins', () => {
    const b = [0, 1, 2].map((k) => mapCardBox(k)!);
    expect(b[0]!.left).toBe(24);
    expect(SCENE.width - (b[2]!.left + b[2]!.width)).toBe(24);
    expect(b[1]!.left - (b[0]!.left + b[0]!.width)).toBe(24);
  });

  it('thumbnail is 120×68 at (4, 4) inside the card and the name line starts below it', () => {
    const th = mapThumbBox(mapCardBox(0)!);
    expect(th).toEqual({ left: 28, top: 80, width: 120, height: 68 });
    expect(MAP_LAYOUT.thumb.dy + MAP_LAYOUT.thumb.h).toBeLessThanOrEqual(MAP_LAYOUT.name.dy);
    expect(MAP_LAYOUT.name.dy + MAP_LAYOUT.name.h).toBeLessThanOrEqual(MAP_LAYOUT.card.h);
  });

  it('stamp cell (20×20) puts its visible 16×16 2px inside the thumbnail top-right corner (same as the mock)', () => {
    const card = mapCardBox(0)!;
    const at = mapStampAt(card);
    // 목업: sx = cx + 4 + 120 - 16 - 2, sy = cy + 4 + 2, 칸은 (sx - 2, sy - 2)
    expect(at).toEqual({ x: 24 + 4 + 120 - 16 - 2 - 2, y: 76 + 4 + 2 - 2 });
    const th = mapThumbBox(card);
    expect(at.x + 2 + 16).toBeLessThanOrEqual(th.left + th.width);
    expect(at.y + 2).toBeGreaterThanOrEqual(th.top);
  });

  it('path dots start right of the first card, skip cards (±2px), and run to the right edge', () => {
    const boxes = [0, 1, 2].map((k) => mapCardBox(k)!);
    const dots = mapPathDots(boxes, SCENE.width);
    expect(dots.length).toBeGreaterThan(0);
    for (const x of dots) {
      expect(x).toBeGreaterThan(boxes[0]!.left);
      expect(x % MAP_LAYOUT.dot.step).toBe(0);
      for (const b of boxes) expect(x >= b.left - 2 && x < b.left + b.width + 2).toBe(false);
    }
    // 마지막 카드 오른쪽(456~479)에도 점이 있다: 다음 판이 더 있다.
    expect(dots.some((x) => x > 456)).toBe(true);
    // 카드 사이(152~176)에 점이 있다.
    expect(dots.some((x) => x > 154 && x < 174)).toBe(true);
  });

  it('path is empty without cards', () => {
    expect(mapPathDots([] as Box[], SCENE.width)).toEqual([]);
  });
});

describe('thumbOrigin (3-3절, content/map.json)', () => {
  // 숫자는 Luna가 content/map.json 한 곳만 고치면 되게 여기 박지 않는다 (#890 리뷰).
  it('reads every deployed origin as-is and each fits in the scene', () => {
    const entries = Object.entries(mapJson.thumbOrigin);
    expect(entries.map(([id]) => id).sort()).toEqual(['magpie_nest', 'park_fountain']);
    for (const [id, [x, y]] of entries) {
      expect(thumbOrigin(mapJson, id, SCENE)).toEqual({ origin: { x, y }, error: null });
    }
  });

  it('a screen without art yet has no origin and no error (dusk fill)', () => {
    expect(thumbOrigin(mapJson, 'laundromat', SCENE)).toEqual({ origin: null, error: null });
    expect(thumbOrigin(null, 'magpie_nest', SCENE)).toEqual({ origin: null, error: null });
  });

  it('rejects values that are not integers or fall outside the scene', () => {
    for (const v of [[1.5, 0], [-1, 0], [361, 0], [0, 203], [0], 'x']) {
      const r = thumbOrigin({ thumbOrigin: { a: v } }, 'a', SCENE);
      expect(r.origin).toBeNull();
      expect(r.error).toMatch(/thumbOrigin\.a/);
    }
    // 끝에 딱 맞는 값은 된다(480 − 120, 270 − 68).
    expect(thumbOrigin({ thumbOrigin: { a: [360, 202] } }, 'a', SCENE).origin).toEqual({ x: 360, y: 202 });
  });

  it('every origin in content/map.json belongs to a screen in the deploy order', () => {
    for (const id of Object.keys(mapJson.thumbOrigin)) expect(orderJson).toContain(id);
  });
});

describe('locked line (3-2절)', () => {
  it('shows for 2 seconds after the last locked press', () => {
    expect(mapLockedShown(null, 1000)).toBe(false);
    expect(mapLockedShown(1000, 1000)).toBe(true);
    expect(mapLockedShown(1000, 1000 + MAP_LOCKED_MS - 1)).toBe(true);
    expect(mapLockedShown(1000, 1000 + MAP_LOCKED_MS)).toBe(false);
  });
});

describe('mapReady', () => {
  const T = texts as Record<string, string>;
  it('is true for the deployed text and order', () => {
    expect(mapReady(T, orderJson)).toBe(true);
  });

  it('is false when a map key or a screen name is missing', () => {
    const omit = (k: string): Record<string, string> => Object.fromEntries(Object.entries(T).filter(([key]) => key !== k));
    expect(mapReady(omit('ui.map.back'), orderJson)).toBe(false);
    expect(mapReady(omit('park_fountain.map.name'), orderJson)).toBe(false);
    expect(mapReady({ ...T, 'ui.map.locked': '' }, orderJson)).toBe(false);
  });

  it('is false when there are more screens than card slots', () => {
    const order = ['a', 'b', 'c', 'd'];
    const t = { ...T, ...Object.fromEntries(order.map((id) => [`${id}.map.name`, id])) };
    expect(mapReady(t, order)).toBe(false);
    expect(mapReady(t, order.slice(0, 3))).toBe(true);
  });
});
