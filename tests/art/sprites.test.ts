// 스프라이트 시트 검사 (ADR-0007 결정 7·8). 시트는 node art/build.mjs로 만든다.
// - 다시 만들면 커밋된 파일과 바이트가 같아야 한다(원본과 출력이 어긋나지 않게)
// - 8비트 인덱스 PNG, 팔레트는 보송 32색(+ 투명 1칸)뿐
// - 메타데이터: 칸은 16의 배수, 이미지 폭 = 칸 × 프레임 수, 기준점은 칸 안
// - 캐릭터 시트 합계 300KB 경고선
// - 연출 자세 ms 합 ≤ 1500(캐릭터 연출도 시트 길이가 busy 길이다, scene.ts `charAnimTicks`)

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ANIM_MAX_MS } from '../../art/scene-build.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const DIR = join(ROOT, 'public', 'sprites');
const BOSONG = readFileSync(join(ROOT, 'docs', 'design', 'art', 'bosong-32.hex'), 'utf8')
  .split('\n')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

interface Png {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  plte: string[];
  trns: number[];
}

function readPng(buf: Buffer): Png {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const png: Png = { width: 0, height: 0, bitDepth: 0, colorType: 0, plte: [], trns: [] };
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      png.width = data.readUInt32BE(0);
      png.height = data.readUInt32BE(4);
      png.bitDepth = data.readUInt8(8);
      png.colorType = data.readUInt8(9);
    } else if (type === 'PLTE') {
      for (let i = 0; i < data.length; i += 3) png.plte.push(data.subarray(i, i + 3).toString('hex'));
    } else if (type === 'tRNS') {
      png.trns = [...data];
    }
    off += 12 + len;
  }
  return png;
}

interface Meta {
  image: string;
  cell: [number, number];
  anchor: [number, number];
  hit: [number, number, number, number];
  head: [number, number, number, number];
  walkCycle?: number;
  anims: Record<string, { frames: number[]; ms?: number[]; by?: string }>;
}

const metas = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('sprite sheets', () => {
  it('보송 팔레트 파일은 32색이다', () => {
    expect(BOSONG).toHaveLength(32);
  });

  it('원본(art/)으로 다시 만들면 커밋된 시트와 같다', () => {
    // 실패하면: node art/build.mjs 를 돌려 나온 파일을 커밋한다
    expect(() => execFileSync(process.execPath, [join(ROOT, 'art', 'build.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('시트가 하나 이상 있다', () => {
    expect(metas.length).toBeGreaterThan(0);
  });

  it('캐릭터 시트 합계가 300KB 경고선 안이다', () => {
    const total = readdirSync(DIR)
      .filter((f) => f.endsWith('.png'))
      .reduce((n, f) => n + readFileSync(join(DIR, f)).length, 0);
    expect(total).toBeLessThan(300 * 1024);
  });

  for (const file of metas) {
    describe(file, () => {
      const meta = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as Meta;
      const png = readPng(readFileSync(join(DIR, meta.image)));

      it('8비트 인덱스 PNG이고 팔레트는 보송 32색(+ 투명 32번)뿐이다', () => {
        expect(png.colorType).toBe(3);
        expect(png.bitDepth).toBe(8);
        expect(png.plte.length).toBeGreaterThanOrEqual(32);
        expect(png.plte.length).toBeLessThanOrEqual(33);
        expect(png.plte.slice(0, 32)).toEqual(BOSONG);
        if (png.plte.length === 33) {
          expect(png.trns).toHaveLength(33);
          expect(png.trns.slice(0, 32).every((a) => a === 255)).toBe(true);
          expect(png.trns[32]).toBe(0);
        }
      });

      it('칸은 16의 배수이고 이미지 = 칸 × 프레임 수(가로 한 줄)', () => {
        const [cw, ch] = meta.cell;
        expect(cw % 16).toBe(0);
        expect(ch % 16).toBe(0);
        const frames = Object.values(meta.anims).flatMap((a) => a.frames);
        expect(new Set(frames).size).toBe(frames.length);
        expect(png.width).toBe(cw * frames.length);
        expect(png.height).toBe(ch);
        expect(Math.max(...frames)).toBe(frames.length - 1);
      });

      it('기준점·히트 영역·머리 박스가 칸 안에 있다', () => {
        const [cw, ch] = meta.cell;
        const [ax, ay] = meta.anchor;
        expect(Number.isInteger(ax)).toBe(true);
        expect(ax).toBeGreaterThan(0);
        expect(ax).toBeLessThan(cw);
        expect(ay).toBe(ch);
        for (const [x, y, w, h] of [meta.hit, meta.head]) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(cw);
          expect(y + h).toBeLessThanOrEqual(ch);
        }
        // UI 초상화는 머리 박스를 24×24로 자른다(ADR-0007 결정 4)
        expect(meta.head[2]).toBeLessThanOrEqual(24);
        expect(meta.head[3]).toBeLessThanOrEqual(24);
      });

      it('걷기는 6장이고 거리로 넘기며 walkCycle이 있다(ADR-0007 결정 5)', () => {
        const walk = meta.anims.walk;
        if (!walk) return;
        expect(walk.frames).toHaveLength(6);
        expect(walk.by).toBe('distance');
        expect(meta.walkCycle).toBeGreaterThan(0);
        expect(meta.walkCycle! % 6).toBe(0);
      });

      it('시간으로 넘기는 애니메이션은 50ms 배수다', () => {
        for (const a of Object.values(meta.anims)) {
          if (!a.ms) continue;
          expect(a.ms).toHaveLength(a.frames.length);
          for (const ms of a.ms) expect(ms % 50).toBe(0);
        }
      });

      it('연출 자세(서 있기·걷기·매달림 밖)의 ms 합은 1500 이하다(busy 길이, 형식 기록 8절과 같은 상한)', () => {
        for (const [name, a] of Object.entries(meta.anims)) {
          if (!a.ms || ['idle', 'walk', 'hold'].includes(name)) continue;
          expect(a.ms.reduce((x, y) => x + y, 0), name).toBeLessThanOrEqual(ANIM_MAX_MS);
        }
      });
    });
  }
});

// 칸 가장자리 잘림 검사(#220). build.mjs가 모든 칸에 돌리고, 여기서는 규칙 자체를 작은 가짜 칸으로 확인한다.
describe('clippedEdge (칸 가장자리 잘림)', () => {
  interface Cnv { w: number; h: number; part(ramp: number[]): number; stamp(x: number, y: number, rows: string[], legend: Record<string, number>, part?: number): void; dot(x: number, y: number, c: number): void }
  type Mods = {
    pixel: { Canvas: new (w: number, h: number, s: number) => Cnv; C: { tan: number; ink: number; white: number } };
    finish: { clippedEdge: (K: Cnv, o?: { tip?: [number, number] }) => string[] };
  };
  // 그림 라이브러리는 타입이 없는 .mjs라 경로를 변수로 둬서 동적으로 읽는다
  const load = async (): Promise<Mods> => {
    const p = '../../art/lib/pixel.mjs', f = '../../art/lib/finish.mjs';
    return { pixel: (await import(p)) as Mods['pixel'], finish: (await import(f)) as Mods['finish'] };
  };

  it('부품 픽셀이 위 0행·옆 끝 열에 있으면 잡고, 외곽선(ink)·fx·tip 칸 0행은 넘긴다', async () => {
    const { pixel: { Canvas, C }, finish: { clippedEdge } } = await load();
    const K = new Canvas(8, 8, 1);
    const body = K.part([C.tan]);
    K.stamp(3, 0, ['t'], { t: C.tan }, body); // 머리카락이 0행에 닿음 → 잘림
    K.stamp(7, 4, ['t'], { t: C.tan }, body); // 오른쪽 끝 열 → 잘림
    K.stamp(5, 0, ['k'], { k: C.ink }, body); // 0행이 외곽선이면 괜찮다
    K.dot(1, 0, C.white); // fx(속도선)는 부품이 없어서 안 센다
    expect(clippedEdge(K)).toEqual(['3,0', '7,4']);
  });

  // #223: tip 칸은 0행에서 엔진이 이어 그리는 장대 4열(tx − 2 … tx + 1)만 빼고, 그 밖의 0행은 그대로 본다
  it('tip 칸은 0행에서 장대 4열만 넘기고, 장대 옆에 닿은 머리는 잡는다', async () => {
    const { pixel: { Canvas, C }, finish: { clippedEdge } } = await load();
    const K = new Canvas(12, 8, 1);
    const pole = K.part([C.tan]);
    const head = K.part([C.tan]);
    K.stamp(4, 0, ['kttk'], { k: C.ink, t: C.tan }, pole); // 장대: 잉크 4 · 몸 5·6 · 잉크 7 → tip x 6
    K.stamp(9, 0, ['t'], { t: C.tan }, head); // 장대 밖 머리가 0행에 닿음 → 잘림
    K.stamp(3, 0, ['t'], { t: C.tan }, head); // 장대 바로 왼쪽(tx − 3)도 잘림
    expect(clippedEdge(K)).toEqual(['3,0', '5,0', '6,0', '9,0']);
    expect(clippedEdge(K, { tip: [6, 0] })).toEqual(['3,0', '9,0']);
  });
});
