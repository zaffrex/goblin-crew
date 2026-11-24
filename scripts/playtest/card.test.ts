import { describe, expect, it } from 'vitest';
import { TITLE_LAYOUT } from '../../src/core/title';
import { titleTapPoint } from './card';
import { internalToPage } from './coords';

// 타이틀 버튼은 `#title` 안 DOM이고 `#title`은 캔버스와 같은 자리·크기다(engine/title.ts `placeRoot`).
// 첫 버튼(`はじめ`, 세이브 없음) 상자를 페이지 px로 놓고, 도구가 보낼 탭이 그 상자 안에 떨어지는지 본다.
const b = TITLE_LAYOUT.buttons;
const pageBox = (canvas: { left: number; top: number; width: number; height: number }) => {
  const s = canvas.width / 480;
  return { left: canvas.left + b.x * s, top: canvas.top + b.y * s, width: b.w * s, height: b.h * s };
};
const inside = (p: { x: number; y: number }, r: { left: number; top: number; width: number; height: number }) =>
  p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height;

describe('titleTapPoint (#885)', () => {
  for (const canvas of [
    { name: '데스크톱 1280×720 (2배, 가운데)', left: 160, top: 90, width: 960, height: 540 },
    { name: '휴대폰 844×390 (비정수 1.44배, 좌우 띠)', left: 75.3, top: 0, width: 693.3, height: 390 },
    { name: '작은 폰 667×375', left: 0, top: 0, width: 667, height: 375.2 },
  ]) {
    it(`버튼 가운데를 내부 좌표로 바꾸고, 다시 페이지로 보낸 탭이 버튼 안이다: ${canvas.name}`, () => {
      const button = pageBox(canvas);
      const at = titleTapPoint(button, canvas);
      expect(at).not.toBeNull();
      expect(at!.x).toBeGreaterThanOrEqual(b.x);
      expect(at!.x).toBeLessThan(b.x + b.w);
      expect(at!.y).toBeGreaterThanOrEqual(b.y);
      expect(at!.y).toBeLessThan(b.y + b.h);
      expect(inside(internalToPage(at!, canvas), button)).toBe(true);
    });
  }

  it('버튼 가운데가 캔버스 밖이면 null(탭이 버튼에 안 닿을 수 있다)', () => {
    const canvas = { left: 100, top: 0, width: 480, height: 270 };
    expect(titleTapPoint({ left: 0, top: 10, width: 40, height: 20 }, canvas)).toBeNull();
  });
});
