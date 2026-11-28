// 성질 효과 시트 검사 (#1053, ADR-1031 5절, 특기 성질 표 #1052 5절). 시트는 node art/build.mjs로 만든다(--check는 sprites.test.ts가 돈다).
// - 젖음·따뜻함·반짝·바람이 2칸씩(공통 새 칸 8), ms 수 = 칸 수, 칸은 이미지 안이고 서로 겹치지 않는다
// - 효과라 외곽선(ink) 없음(ADR-0007 결정 3-1)
// - 빨래방 명도 띠 네 개(dusk / cotton / plum / woodL, 띠 결정 2026-11-23) 위에서 칸마다 효과 픽셀의 40% 이상이 띠와 명도 차 30 이상
//   (두 단 짝: 밝은 벽에서는 어두운 단, 바닥에서는 밝은 단이 읽힌다. 한 단만 남기면 어느 띠에서 반쯤 사라진다)

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeIndexed } from './png';

const ROOT = join(import.meta.dirname, '..', '..');
type Anim = { frames: [number, number, number, number][]; ms: number[]; loop: boolean; anchor: [number, number]; pin: string };
const meta = JSON.parse(readFileSync(join(ROOT, 'public', 'ui', 'prop-fx.json'), 'utf8')) as { image: string; anims: Record<string, Anim> };
const png = decodeIndexed(readFileSync(join(ROOT, 'public', 'ui', meta.image)));
const hex = readFileSync(join(ROOT, 'docs', 'design', 'art', 'bosong-32.hex'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const rgb = (i: number) => [0, 2, 4].map((o) => parseInt(hex[i]!.slice(o, o + 2), 16)) as [number, number, number];
const luma = ([r, g, b]: [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b;
// 보송 인덱스: ink 0, plum 1, dusk 2, cotton 5, woodL 12
const BANDS = { dusk: luma(rgb(2)), cotton: luma(rgb(5)), plum: luma(rgb(1)), woodL: luma(rgb(12)) };
const INK = rgb(0);

function pixels([x0, y0, w, h]: [number, number, number, number]) {
  const out: [number, number, number][] = [];
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * png.width + x) * 4;
      if (png.rgba[i + 3]! > 0) out.push([png.rgba[i]!, png.rgba[i + 1]!, png.rgba[i + 2]!]);
    }
  return out;
}

describe('prop-fx sheet', () => {
  it('젖음·따뜻함·반짝·바람이 2칸씩, ms 수 = 칸 수, 기준점이 칸 안', () => {
    expect(Object.keys(meta.anims).sort()).toEqual(['shine', 'warm', 'wet', 'wind']);
    for (const [name, a] of Object.entries(meta.anims)) {
      expect(a.frames.length, name).toBe(2);
      expect(a.ms.length, name).toBe(a.frames.length);
      expect(['bottom', 'top', 'top-right', 'source']).toContain(a.pin);
      for (const [, , w, h] of a.frames) {
        expect(a.anchor[0], name).toBeLessThanOrEqual(w);
        expect(a.anchor[1], name).toBeLessThanOrEqual(h);
      }
    }
  });

  it('칸은 이미지 안이고 서로 겹치지 않는다', () => {
    const all = Object.values(meta.anims).flatMap((a) => a.frames);
    for (const [x, y, w, h] of all) {
      expect(x + w).toBeLessThanOrEqual(png.width);
      expect(y + h).toBeLessThanOrEqual(png.height);
    }
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const [a, b] = [all[i]!, all[j]!];
        const apart = a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
        expect(apart, `${a} / ${b}`).toBe(true);
      }
  });

  it('칸마다 그림이 있고 ink 외곽선이 없다', () => {
    for (const [name, a] of Object.entries(meta.anims))
      a.frames.forEach((f, k) => {
        const px = pixels(f);
        expect(px.length, `${name} ${k}`).toBeGreaterThan(0);
        expect(px.some(([r, g, b]) => r === INK[0] && g === INK[1] && b === INK[2]), `${name} ${k} ink`).toBe(false);
      });
  });

  it('빨래방 명도 띠 네 개 위에서 칸마다 효과 픽셀 40% 이상이 명도 차 30 이상', () => {
    for (const [name, a] of Object.entries(meta.anims))
      a.frames.forEach((f, k) => {
        const px = pixels(f).map(luma);
        for (const [band, y] of Object.entries(BANDS)) {
          const share = px.filter((v) => Math.abs(v - y) >= 30).length / px.length;
          expect(share, `${name} ${k} on ${band}`).toBeGreaterThanOrEqual(0.4);
        }
      });
  });
});
