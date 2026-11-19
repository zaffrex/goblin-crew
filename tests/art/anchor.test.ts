// 말풍선·별·▼ 앵커 높이 검사 (#464). 커밋된 캐릭터 시트 PNG의 실제 픽셀로 `core/sprite.ts` `headTop`을 돌린다.
// - 서 있는 자세(서 있기·걷기·깡충·쿵 등)는 앵커가 예전과 같다(시트 기본 `hit` 위끝). 회귀 방지.
// - 납작 자세(`common.flatten_stay`, `common.flatten` 0·1번)는 앵커가 그 칸의 머리(불투명 위끝)로 내려간다.
// 시트를 다시 그려서 서 있는 자세 위끝이 문턱(LOW_POSE_PX)을 넘게 출렁이면 여기서 걸린다(앵커가 흔들린다는 뜻).

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { cellTops, headTop, parseSpriteMeta } from '../../src/core/sprite';

const DIR = join(import.meta.dirname, '..', '..', 'public', 'sprites');

/** 8비트 인덱스 PNG(시트 형식, ADR-0007 결정 8) → RGBA. 알파만 쓰므로 색은 팔레트 그대로 옮긴다. */
function decodeIndexed(buf: Buffer): { width: number; height: number; rgba: Uint8ClampedArray } {
  let width = 0;
  let height = 0;
  let plte: Buffer = Buffer.alloc(0);
  let trns: Buffer = Buffer.alloc(0);
  const idat: Buffer[] = [];
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 3 || data[12] !== 0) throw new Error('8비트 인덱스, 인터레이스 없음만 읽는다');
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const idx = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (width + 1)]!;
    const src = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1));
    for (let x = 0; x < width; x++) {
      const a = x > 0 ? idx[y * width + x - 1]! : 0;
      const b = y > 0 ? idx[(y - 1) * width + x]! : 0;
      const c = x > 0 && y > 0 ? idx[(y - 1) * width + x - 1]! : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      idx[y * width + x] = (src[x]! + pred) & 0xff;
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < idx.length; i++) {
    const k = idx[i]!;
    rgba[i * 4] = plte[k * 3] ?? 0;
    rgba[i * 4 + 1] = plte[k * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = plte[k * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = k < trns.length ? trns[k]! : 255;
  }
  return { width, height, rgba };
}

/** 서 있는 자세: 앵커가 기본 hit 위끝에서 움직이면 안 된다. 매달린 자세(`hold`·`reach_hang_up`)는 자세 hit 상자가 따로 맡는다. */
const STANDING = ['idle', 'walk', 'step_up', 'common.stomp', 'seesaw_stomp', 'common.zap', 'common.stretch', 'common.reach_wobble', 'common.wet', 'common.shiver', 'common.wag_finger', 'common.squeeze_chicken'];
/** 납작: 이 칸들에서 앵커가 그 칸 머리로 내려가야 한다(#464 완료 조건, #357·#433). */
const FLAT = ['common.flatten_stay'];

const files = readdirSync(DIR).filter((f) => f.endsWith('-base.json'));

describe.each(files)('%s 앵커 높이 (#464)', (file) => {
  const meta = parseSpriteMeta(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
  const png = decodeIndexed(readFileSync(join(DIR, meta.image)));
  const tops = cellTops(png.rgba, png.width, meta.cell, Math.floor(png.width / meta.cell[0]));

  it('서 있는 자세는 모든 칸에서 기본 hit 위끝 그대로', () => {
    for (const name of STANDING) {
      const a = meta.anims[name];
      if (!a) continue;
      for (const f of a.frames) expect(headTop(meta, tops[f] ?? null), `${name} 칸 ${f}`).toEqual({ y: meta.hit[1], low: false });
    }
  });

  it('납작 유지 칸은 앵커가 그 칸의 불투명 위끝(머리)으로 내려간다', () => {
    const flat = FLAT.map((n) => meta.anims[n]).filter((a) => a !== undefined);
    const base = meta.anims['common.flatten'];
    // `flatten_stay`가 없는 시트(묵직이)는 `flatten` 0·1번(엔진이 같은 칸을 쓴다, #433).
    const frames = flat.length > 0 ? flat.flatMap((a) => a.frames) : (base?.frames.slice(0, 2) ?? []);
    expect(frames.length, '납작 칸이 있어야 한다').toBeGreaterThan(0);
    for (const f of frames) {
      const head = headTop(meta, tops[f] ?? null);
      expect(head, `칸 ${f}`).toEqual({ y: tops[f], low: true });
      // 예전 앵커(서 있는 머리)보다 확실히 낮다.
      expect(head.y - meta.hit[1], `칸 ${f}`).toBeGreaterThan(20);
    }
  });
});
