// 화면 1 배경 미리보기·검사 (#145). 원본: art/scenes/magpie_nest.mjs
// 실행: node docs/design/screens/magpie_nest-bg-preview.mjs
// 출력(같은 폴더):
//   magpie_nest-bg-1x.png          배경 전체 실제 크기(480×270). 사장님이 보시는 기준
//   magpie_nest-bg-2x.png          같은 그림 2배
//   magpie_nest-bg-gray-2x.png     명도(흑백) 2배 (ADR-0007 결정 3-6)
//   magpie_nest-bg-band-a-4x.png   띠 ②(a) 왼쪽 건물(창문·뒷문) 확대 4배
//   magpie_nest-bg-vs-2x.png       위: 구도 시안(#149) / 아래: 지금 배경
// 검사(어기면 종료 코드 1): 480×270, 빈 칸 없음, ink(0)·hint(31) 없음, 금색(yel 계열)은 열쇠 전용이라
//   배경 하늘·건물·지붕 띠(y < FENCE_TOP)에 노란 덩어리를 두지 않음(해바라기·창문 불빛은 예외 영역),
//   바닥·담장 주색과 세 사람 주색·피부 명도 차 ≥ 30(결정 3-4, #145 리스크 2), 배경 PNG ≤ 100KB(결정 8).

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SCENE, W, H, FENCE_TOP } from '../../../art/scenes/magpie_nest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));

const bg = new Image(W, H);
SCENE.bg(bg);

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = bg.get(x, y); m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const all = count(0, 0, W, H);
check(bg.w === 480 && bg.h === 270, '배경 480×270');
check(!all.has(EMPTY), '빈 칸 없음(불투명)');
check(!all.has(C.ink) && !all.has(C.hint), '배경에 ink(0)·hint(31) 없음');
const main = (x0, y0, w, h) => [...count(x0, y0, w, h)].sort((a, b) => b[1] - a[1])[0][0];
const floorMain = main(0, 214, W, 44);
const PEOPLE = { '쭉이 셔츠': C.red, '쭉이 바지': C.dusk, '묵직이 멜빵': C.teal, '묵직이 셔츠': C.white, '삑삑이 우비': C.yel };
for (const [name, c] of Object.entries(PEOPLE)) check(Math.abs(Y[c] - Y[floorMain]) >= 30, `바닥 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[floorMain])}`);
const fenceMain = main(180, 160, 120, 30);
for (const [name, c] of Object.entries({ '피부 밝은 단': C.tan, '피부 중간 단': C.woodL })) check(Math.abs(Y[c] - Y[fenceMain]) >= 30, `담장 주색 #${fenceMain}(Y${Y[fenceMain]}) vs ${name}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[fenceMain])}`);
// 금색은 열쇠 전용: 위쪽 띠에서 yel·yelL·yelD 픽셀은 해바라기(x 280~300)와 창문 불빛(1px짜리)만
{
  let stray = 0;
  for (let y = 0; y < FENCE_TOP; y++) for (let x = 0; x < W; x++) {
    const c = bg.get(x, y);
    if (c !== C.yel && c !== C.yelD) continue; // yelL(창문 불빛)은 노란 '덩어리'로 안 읽힌다
    if (x >= 280 && x <= 300 && y >= 128) continue; // 해바라기 ⑥
    stray++;
  }
  check(stray === 0, `위쪽 띠에 금색(yel·yelD) 덩어리 없음 (${stray}px)`);
}
const png1 = indexedPng(bg, 1);
check(png1.length <= 100 * 1024, `배경 PNG ${(png1.length / 1024).toFixed(1)}KB ≤ 100KB`);
console.log(`배경 색 수: ${all.size}`);

// ── 출력
const crop = (img, [x0, y0, w, h]) => { const o = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(x, y, img.get(x0 + x, y0 + y)); return o; };
writeFileSync(join(HERE, 'magpie_nest-bg-1x.png'), png1);
writeFileSync(join(HERE, 'magpie_nest-bg-2x.png'), indexedPng(bg, 2));
writeFileSync(join(HERE, 'magpie_nest-bg-band-a-4x.png'), indexedPng(crop(bg, [0, 0, 96, 210]), 4));

/** 커밋된 인덱스/RGB PNG(필터 0)를 보송 인덱스로 읽는다. 구도 시안 비교용. */
function readPng(file) {
  const buf = readFileSync(file);
  let p = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 2 ? 3 : 1, raw = inflateSync(Buffer.concat(idat)), row = w * bpp + 1;
  const key = new Map(PALETTE.map(([r, g, b], i) => [(r << 16) | (g << 8) | b, i]));
  const img = new Image(w, h);
  for (let y = 0; y < h; y++) {
    if (raw[y * row] !== 0) throw new Error('필터 0만 읽는다');
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * bpp;
      img.c[y * w + x] = bpp === 3 ? key.get((raw[o] << 16) | (raw[o + 1] << 8) | raw[o + 2]) ?? EMPTY : raw[o] >= 32 ? EMPTY : raw[o];
    }
  }
  return img;
}
{
  const sk = readPng(join(HERE, 'magpie_nest-bg-sketch-2x.png'));
  const sketch = new Image(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sketch.set(x, y, sk.get(x * 2, y * 2));
  const vs = new Image(W, H * 2 + 4, C.ink);
  vs.blit(sketch, 0, 0); vs.blit(bg, 0, H + 4);
  writeFileSync(join(HERE, 'magpie_nest-bg-vs-2x.png'), indexedPng(vs, 2));
}
// 흑백 2배(8비트 그레이 PNG)
{
  const S = 2, w = W * S, h = H * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[bg.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  writeFileSync(join(HERE, 'magpie_nest-bg-gray-2x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

if (problems.length) { console.error(`검사 실패 ${problems.length}건`); process.exit(1); }
