import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../src/core/config';
import { distanceToBox } from '../../src/core/hit';
import type { Box, ScreenData } from '../../src/core/puzzle/types';
import { screenToInternal } from '../../src/core/viewport';
import { bubbleCovers, boxCenter, INTERNAL, internalToPage, outsidePoint, targetBox, targetPagePoint } from './coords';

const screen = JSON.parse(readFileSync('content/screens/magpie_nest.json', 'utf8')) as ScreenData;
const asHit = ([left, top, width, height]: Box) => ({ left, top, width, height });

describe('playtest coords', () => {
  it('내부 해상도가 게임 설정과 같다', () => {
    expect(INTERNAL).toEqual({ width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
  });

  it('핫스팟은 플래그에 맞는 variant 상자를 쓴다 (까치: 둥지 위 → 바닥)', () => {
    expect(targetBox(screen, 'magpie', { 'magpie.on_ground': false })).toEqual([134, 6, 24, 24]);
    expect(targetBox(screen, 'magpie', { 'magpie.on_ground': true })).toEqual([88, 212, 24, 24]);
  });

  it('서는 자리는 box가 있을 때만 클릭 대상이다', () => {
    expect(targetBox(screen, 'seesaw_left', {})).toEqual([208, 196, 38, 24]);
    expect(targetBox(screen, 'floor', {})).toBeNull();
    expect(targetBox(screen, 'nope', {})).toBeNull();
    expect(() => targetPagePoint(screen, 'floor', {}, { left: 0, top: 0, width: 480, height: 270 })).toThrow();
  });

  it('solution의 모든 대상이 클릭 가능하다', () => {
    for (const a of screen.solution ?? []) {
      expect(targetBox(screen, a.target, screen.flags), a.target).not.toBeNull();
    }
  });

  // 게임 입력 경로(screenToInternal)로 되돌렸을 때 같은 픽셀이어야 한다. 배율·여백이 있는 실제 뷰포트로 본다.
  const rects = {
    desktop1280x720: { left: 0, top: 0, width: 1280, height: 720 },
    // 844×390 가로: 비정수 배율(390/270≈1.44), 좌우 여백
    mobile844x390: { left: (844 - 563.3333) / 2, top: 0, width: 563.3333, height: 390 },
  };
  for (const [name, rect] of Object.entries(rects)) {
    it(`페이지 좌표가 게임 입력 변환으로 같은 내부 픽셀에 돌아온다 (${name})`, () => {
      for (const id of [...Object.keys(screen.hotspots), 'seesaw_left', 'seesaw_right', 'hook']) {
        for (const on of [false, true]) {
          const box = targetBox(screen, id, { 'magpie.on_ground': on });
          if (!box) continue;
          const c = boxCenter(box);
          const back = screenToInternal(internalToPage(c, rect), rect, INTERNAL);
          expect(back, `${id}`).toEqual(c);
          expect(distanceToBox(c, asHit(box))).toBe(0);
        }
      }
    });
  }

  it('outsidePoint는 게임 기준 거리가 정확히 dist다 (A6② 8px 경계)', () => {
    const hook = targetBox(screen, 'hook', {})!;
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      for (const d of [1, 8, 9]) {
        expect(distanceToBox(outsidePoint(hook, side, d), asHit(hook)), `${side} ${d}`).toBe(d);
      }
    }
  });
});

describe('bubbleCovers (C-7, #356)', () => {
  // 667×375 @2: 게임 화면 480×270 → 667×375.1, 배율 1.3896.
  const rect = { left: 0, top: 0, width: 667, height: 375.1875 };
  const hotspots = { nest: { left: 128, top: 30, width: 36, height: 24 }, magpie: { left: 134, top: 6, width: 24, height: 24 } };

  it('둥지 히트 박스를 덮은 비율을 잰다', () => {
    const s = 667 / 480;
    // 둥지 아래 절반만 덮는 말풍선
    const bubble = { left: 100 * s, top: 42 * s, width: 100 * s, height: 50 * s };
    const c = bubbleCovers(bubble, 'jjuk', hotspots, rect);
    expect(c.map((x) => x.id)).toEqual(['nest']);
    expect(c[0]?.ratio).toBeCloseTo(0.5, 5);
  });

  it('맞닿기만 하면 세지 않고, 화자 자신의 핫스팟은 뺀다', () => {
    const s = 667 / 480;
    expect(bubbleCovers({ left: 164 * s, top: 30 * s, width: 50, height: 50 }, null, hotspots, rect)).toEqual([]);
    expect(bubbleCovers({ left: 0, top: 0, width: 667, height: 375 }, 'magpie', hotspots, rect).map((x) => x.id)).toEqual(['nest']);
  });
});
