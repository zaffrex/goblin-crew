// 소리 글자 시트 검사 (#284, docs/design/ability-feedback.md 3절). 시트는 node art/build.mjs로 만든다(--check는 sprites.test.ts가 돈다).
// - FX_STYLE의 fx마다 칸이 있고, 칸 높이 = 글자 높이 + 외곽선 2px
// - 칸은 이미지 안이고 서로 겹치지 않는다
// - 원본 WORDS의 fx·칠이 FX_STYLE과 같다(시트 칠과 임시 별 칠이 어긋나지 않게)
// - `キン` 옆 반짝 부품 `ting_spark` 칸이 있다(5×5, 3×3 + 외곽선)
// - 8비트 인덱스 PNG(보송 32색 + 투명 1칸)

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX_COLORS, FX_STYLE } from '../../src/core/fx';
import { WORDS } from '../../art/ui/fx-text.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const meta = JSON.parse(readFileSync(join(ROOT, 'public', 'ui', 'fx-text.json'), 'utf8')) as {
  image: string;
  anchor: string;
  cells: Record<string, [number, number, number, number]>;
};
const png = readFileSync(join(ROOT, 'public', 'ui', meta.image));

describe('fx-text sheet', () => {
  it('8비트 인덱스 PNG다', () => {
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(3); // color type: indexed
  });

  it('FX_STYLE의 소리 글자 fx마다 칸이 있고, 높이 = 글자 높이 + 외곽선 2px', () => {
    for (const [fx, style] of Object.entries(FX_STYLE)) {
      expect(meta.cells[fx], fx).toBeDefined();
      expect(meta.cells[fx]![3], fx).toBe(style.height + 2);
    }
  });

  it('원본 WORDS는 FX_STYLE과 fx 목록·높이·칠이 같다', () => {
    const hex = readFileSync(join(ROOT, 'docs', 'design', 'art', 'bosong-32.hex'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    expect(WORDS.map((w) => w.fx).sort()).toEqual(Object.keys(FX_STYLE).sort());
    for (const w of WORDS) {
      const style = FX_STYLE[w.fx]!;
      expect(w.size, w.fx).toBe(style.height);
      expect(`#${hex[w.color]}`.toLowerCase(), w.fx).toBe(FX_COLORS[style.color].toLowerCase());
    }
  });

  it('ting_spark 부품 칸이 있다(3×3 + 외곽선 = 5×5)', () => {
    const c = meta.cells['ting_spark'];
    expect(c).toBeDefined();
    expect([c![2], c![3]]).toEqual([5, 5]);
  });

  it('칸은 이미지 안이고 서로 겹치지 않는다', () => {
    const W = png.readUInt32BE(16);
    const H = png.readUInt32BE(20);
    const boxes = Object.entries(meta.cells);
    for (const [name, [x, y, w, h]] of boxes) {
      expect(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= W && y + h <= H, name).toBe(true);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]![1], boxes[j]![1]];
        const apart = a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
        expect(apart, `${boxes[i]![0]} / ${boxes[j]![0]}`).toBe(true);
      }
  });

  it('기준점은 아래 가운데다', () => {
    expect(meta.anchor).toBe('bottom-center');
  });
});
