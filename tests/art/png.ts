// 커밋된 시트 PNG를 노드에서 읽는다(#464 앵커 검사에서 나옴, #736 그림 칸 판정 테스트가 같이 쓴다).
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { alphaMask, type AlphaMask } from '../../src/core/alpha';

/** 8비트 인덱스 PNG(시트 형식, ADR-0007 결정 8) → RGBA. 알파만 쓰므로 색은 팔레트 그대로 옮긴다. */
export function decodeIndexed(buf: Buffer): { width: number; height: number; rgba: Uint8ClampedArray } {
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

/** PNG 파일 → 불투명 표(`core/alpha.ts`). 엔진이 시트를 읽어 만드는 것과 같다. */
export function pngAlpha(path: string): AlphaMask {
  const png = decodeIndexed(readFileSync(path));
  return alphaMask(png.rgba, png.width, png.height);
}
