// 화면 1 `laundromat` 세탁기 한 대 미리보기·검사 (#764). 원본: art/scenes/laundromat.washer.mjs
// 실행: node docs/design/screens/laundromat-washer-preview.mjs
// 출력(같은 폴더):
//   laundromat-washer-4x.png        한 대 세 모습(닫힘 빈 통 / 닫힘 빨래 / 문 열림) 4배
//   laundromat-washer-scene-2x.png  480×270 자리 표시 방에 4대 줄 + 세 사람 시작 위치(화면 JSON start: 240·280·320)
//   laundromat-washer-gray-2x.png   같은 장면 명도(흑백) 2배 (ADR-0007 결정 3-6)
// 벽·바닥·셔터·건조기·자판기는 **자리 표시**다(색 미정, 배경 그림에서 정한다). 세탁기만 진짜 그림이다.
// 검사(어기면 종료 코드 1):
//   - 세탁기에 ink(0)·hint(31) 없음 (배경, 결정 3-1)
//   - 몸 주색과 세 사람 주색 명도 차 ≥ 30 (결정 3-4를 바닥 대신 "사람 바로 뒤"에 적용: 시작하면 셋이 세탁기 앞에 선다)
//   - 문 유리 주색이 몸 주색보다 60 이상 어둡다 (1배에서 "둥근 문 = 세탁기"로 읽히는 실루엣)

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { fill } from '../../../art/lib/texture.mjs';
import { washer, WASHER_W, WASHER_H } from '../../../art/scenes/laundromat.washer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const W = 480, H = 270;
const ROW = { x0: 176, y: 180, pitch: 40 }; // 설계 1-1 메모: 세탁기 4대 176~336, y 180~236
const FLOOR_Y = ROW.y + WASHER_H; // 236

// 자리 표시 벽(cotton 타일 줄눈)·바닥(woodL). 진짜 색은 배경 그림에서 정한다
const wall = (img, x0, y0, w, h) => fill(img, x0, y0, w, h, (x, y) => ((y % 12 === 0 || x % 16 === 0) ? C.lint : C.cotton));
const floor = (img, x0, y0, w, h) => fill(img, x0, y0, w, h, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? C.woodL : C.tan));

// ── 4배: 세 모습
const swatch = new Image(3 * 52 + 8, WASHER_H + 14);
wall(swatch, 0, 0, swatch.w, WASHER_H + 6);
floor(swatch, 0, WASHER_H + 6, swatch.w, 8);
const VARIANTS = [['empty', 1], ['load', 2], ['open', 4]];
VARIANTS.forEach(([door, n], i) => washer(swatch, 14 + i * 52, 6, { n, door }));

// ── 장면: 4대 줄 + 자리 표시 + 세 사람
const scene = new Image(W, H);
wall(scene, 0, 0, W, FLOOR_Y);
floor(scene, 0, FLOOR_Y, W, H - FLOOR_Y);
// 문 열린 칸은 1번: 시작하면 2~4번 앞에 세 사람이 서서(240·280·320), 사람에게 안 가리는 칸은 1번뿐이다
const ROW_DOORS = ['open', 'load', 'empty', 'load'];
const only = new Image(W, H); // 세탁기만(검사용)
for (let i = 0; i < 4; i++) {
  const x = ROW.x0 + i * ROW.pitch + 1;
  washer(scene, x, ROW.y, { n: i + 1, door: ROW_DOORS[i] });
  washer(only, x, ROW.y, { n: i + 1, door: ROW_DOORS[i] });
}
// 핫스팟 물건 자리 표시: 회색 상자(lav 테두리)
for (const [id, h] of Object.entries(SCREEN.hotspots)) {
  const [x, y, w, hh] = h.box;
  if (id === 'latch') continue; // 셔터 위 작은 상자라 생략
  fill(scene, x, y, w, hh, (px, py) => (px === x || py === y || px === x + w - 1 || py === y + hh - 1 ? C.dusk : C.lint));
}

function readIndexedPng(file) {
  const buf = readFileSync(file);
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const img = new Image(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = raw[y * (w + 1) + 1 + x]; img.c[y * w + x] = i >= 32 ? EMPTY : i; }
  return img;
}
const START = { jjuk: 240, mukjik: 280, ppik: 320 }; // 화면 JSON note: 시작 좌표 floor ±40
for (const [id, sx] of Object.entries(START)) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'public/sprites', `${id}-base.json`), 'utf8'));
  const sheet = readIndexedPng(join(ROOT, 'public/sprites', meta.image));
  const [cw, ch] = meta.cell, [ax, ay] = meta.anchor;
  const cell = new Image(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cell.set(x, y, sheet.get(x, y));
  scene.blit(cell, sx - ax, 244 - ay);
}

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (img, x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY) m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const main = (img, x0, y0, w, h) => [...count(img, x0, y0, w, h)].sort((a, b) => b[1] - a[1])[0][0];
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const used = count(only, 0, 0, W, H);
check(!used.has(C.ink) && !used.has(C.hint), '세탁기에 ink(0)·hint(31) 없음');
const bodyMain = main(only, ROW.x0, ROW.y, 4 * ROW.pitch, WASHER_H);
const PEOPLE = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };
for (const [name, c] of Object.entries(PEOPLE)) check(dY(c, bodyMain) >= 30, `몸 주색 #${bodyMain}(Y${Y[bodyMain]}) vs ${name} #${c}(Y${Y[c]}) 차 ${dY(c, bodyMain)} ≥ 30`);
const glassMain = main(only, ROW.x0 + 1 + 2 * ROW.pitch + 12, ROW.y + 24, 14, 14); // 3번(빈 통) 유리 가운데
check(Y[bodyMain] - Y[glassMain] >= 60, `문 유리 주색 #${glassMain}(Y${Y[glassMain]})이 몸보다 ${Y[bodyMain] - Y[glassMain]} 어둡다 ≥ 60`);
console.log(`세탁기 한 대 ${WASHER_W}×${WASHER_H}, 쓴 색 ${used.size}개, 자리 표시 벽 cotton(Y${Y[C.cotton]})과 몸 차 ${dY(C.cotton, bodyMain)} (벽 색은 배경 그림에서 정함)`);

// ── 출력
const gray = (img, S, file) => {
  const w = img.w * S, h = img.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[img.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, file), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
};
writeFileSync(join(HERE, 'laundromat-washer-4x.png'), indexedPng(swatch, 4));
writeFileSync(join(HERE, 'laundromat-washer-scene-2x.png'), indexedPng(scene, 2));
gray(scene, 2, 'laundromat-washer-gray-2x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
