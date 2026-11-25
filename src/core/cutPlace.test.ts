import { describe, expect, it } from 'vitest';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './config';
import { CUT_GAP, CUT_MIN_TOP, cutCenter } from './cutPlace';
import type { HitBox } from './hit';

const boxAt = (c: { x: number; y: number }, s: { width: number; height: number }): HitBox => ({
  left: c.x - s.width / 2,
  top: c.y - s.height / 2,
  width: s.width,
  height: s.height,
});
const overlap = (a: HitBox, b: HitBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

// 화면 1 클리어 순간 몸 상자(배포 빌드 `__gcLayout().chars`, 정답 끝까지 푼 뒤). 노비(jjuk)는 바구니 안에서 열쇠를 들고 있다.
const MAGPIE_CLEAR: HitBox[] = [
  { left: 145, top: 171, width: 28, height: 64 }, // jjuk
  { left: 268, top: 179, width: 39, height: 61 }, // mukjik
  { left: 421, top: 194, width: 33, height: 50 }, // ppik
];
// `やったー！\nお店、開けられる！` 상자를 실제 브라우저에서 잰 크기(CSS px ÷ 배율 = 내부 px).
const SIZES = {
  '667x375 (1.0배)': { width: 148, height: 79 },
  '844x390 (1.33배)': { width: 111, height: 59 },
  '1280x720 (2배)': { width: 104, height: 55 },
};

describe('클리어 컷 자리 (#662)', () => {
  it('겹치는 캐릭터가 없으면 게임 화면 가운데다(창 가운데가 아니다)', () => {
    expect(cutCenter({ width: 100, height: 50 }, [])).toEqual({ x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT / 2 });
    const aside = [{ left: 0, top: 100, width: 30, height: 60 }];
    expect(cutCenter({ width: 100, height: 50 }, aside)).toEqual({ x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT / 2 });
  });

  for (const [name, size] of Object.entries(SIZES)) {
    it(`화면 1 클리어 순간 ${name}: 세 사람 몸 상자와 겹치지 않는다`, () => {
      const box = boxAt(cutCenter(size, MAGPIE_CLEAR), size);
      for (const c of MAGPIE_CLEAR) expect(overlap(box, c)).toBe(false);
      expect(box.top).toBeGreaterThanOrEqual(CUT_MIN_TOP);
    });
  }

  it('667x375에서 아래끝이 노비 머리보다 CUT_GAP 위다(예전 자리는 머리·손을 덮었다)', () => {
    const size = SIZES['667x375 (1.0배)'];
    const box = boxAt(cutCenter(size, MAGPIE_CLEAR), size);
    expect(box.top + box.height).toBeLessThanOrEqual(171 - CUT_GAP);
  });

  it('올린 자리에서 더 높은 캐릭터와 또 겹치면 그 위로 다시 올린다', () => {
    const size = { width: 120, height: 40 };
    const floor = { left: 230, top: 130, width: 30, height: 60 };
    const ledge = { left: 200, top: 60, width: 30, height: 40 };
    const box = boxAt(cutCenter(size, [floor, ledge]), size);
    expect(overlap(box, floor)).toBe(false);
    expect(overlap(box, ledge)).toBe(false);
    expect(box.top + box.height).toBeLessThanOrEqual(60 - CUT_GAP);
  });

  it('위에 자리가 없으면 CUT_MIN_TOP에서 멈춘다(화면 밖으로 안 나간다)', () => {
    const size = { width: 120, height: 80 };
    const c = cutCenter(size, [{ left: 220, top: 40, width: 40, height: 200 }]);
    expect(c.y - size.height / 2).toBe(CUT_MIN_TOP);
  });
  it('연결 순서 끝 카드에 머리 위 칸 상자만 넘기면 그 칸 위로 올린다(#975, M1 압축 배율 카드 약 288×71)', () => {
    const size = { width: 288, height: 71 };
    // 빨래방 ズッシー 머리 위 둥지 모자 + 까치 칸(M1 스크린샷에서 잰 근삿값, 내부 px).
    const head = { left: 300, top: 158, width: 32, height: 40 };
    const box = boxAt(cutCenter(size, [head]), size);
    expect(overlap(box, head)).toBe(false);
    expect(box.top + box.height).toBe(158 - CUT_GAP);
  });
});
