// 화면 1 `laundromat` 앞문 셔터 미리보기·검사 (#764). 원본: art/scenes/laundromat.shutter.mjs
// 실행: node docs/design/screens/laundromat-shutter-preview.mjs
// 출력(같은 폴더):
//   laundromat-shutter-4x.png        상태 그림 세 장(잠김 / 풀림 / 올라감) 4배. 오른쪽 위 빨간 상자는 걸쇠 자리 표시(140, 140, 10×12)
//   laundromat-shutter-scene-2x.png  480×270 자리 표시 방에 잠긴 셔터 + 걸쇠 자리 + 세 사람 시작 위치(240·280·320) = 시작 3초 화면
//   laundromat-shutter-gray-2x.png   같은 장면 명도(흑백) 2배 (ADR-0007 결정 3-6)
// 벽·바닥·세탁기·건조기·자판기·걸쇠는 **자리 표시**다. 셔터만 진짜 그림이다.
// 검사(어기면 종료 코드 1):
//   - 셔터에 ink(0)·hint(31)·빨강 계열 없음 (배경 결정 3-1, 빨강은 걸쇠·장화만 X4)
//   - 판 주색과 걸쇠 빨강 명도 차 ≥ 30, 걸쇠 둘레 1px 주색과도 ≥ 30 (걸쇠가 판에 묻히지 않게)
//   - 판 주색과 손잡이·걸쇠 앞에 서는 사람 주색(ズッシー 셔츠·멜빵, ノビー 셔츠·바지) 차 ≥ 30
//   - 올라감: 문밖 주색과 까치 몸(ink) 차 ≥ 30 (클리어 컷에서 까치가 문밖으로 날아간다)
//   - 풀림: 바닥 줄(y 243)에 빛줄이 판 폭 절반 이상

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { fill } from '../../../art/lib/texture.mjs';
import { shutter, SHUTTER, HOUSING } from '../../../art/scenes/laundromat.shutter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const W = 480, H = 270, FLOOR_Y = 236;
const LATCH = [140, 140, 10, 12]; // 걸쇠 그림 자리(laundromat.md 1-1). 화면 JSON box 133,134 24×24는 히트 상자(결정 6)라 그림보다 크다

// 자리 표시 벽·바닥(세탁기 미리보기 PR #853과 같은 것). 진짜 색은 배경 그림에서 정한다
const wall = (img, x0, y0, w, h) => fill(img, x0, y0, w, h, (x, y) => ((y % 12 === 0 || x % 16 === 0) ? C.lint : C.cotton));
const floor = (img, x0, y0, w, h) => fill(img, x0, y0, w, h, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? C.woodL : C.tan));
const latchBox = (img, dx = 0, dy = 0) => fill(img, LATCH[0] + dx, LATCH[1] + dy, LATCH[2], LATCH[3], (px, py) => (px === LATCH[0] + dx || py === LATCH[1] + dy ? C.redL : C.red));

// ── 4배: 세 상태. 셔터 하나 둘레(통 포함) 136×128을 잘라 나란히
const STATES = ['locked', 'loose', 'up'];
const CX = HOUSING.x - 4, CY = HOUSING.y - 4, CW = HOUSING.w + 8, CH = SHUTTER.y + SHUTTER.h - CY + 6;
const swatch = new Image(STATES.length * (CW + 4), CH);
const solo = {}; // 상태별 셔터만(검사용, 화면 좌표)
STATES.forEach((s, i) => {
  const room = new Image(W, H);
  wall(room, 0, 0, W, FLOOR_Y);
  floor(room, 0, FLOOR_Y, W, H - FLOOR_Y);
  shutter(room, s);
  if (s !== 'up') latchBox(room);
  const only = new Image(W, H);
  shutter(only, s);
  solo[s] = only;
  const crop = new Image(CW, CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) crop.set(x, y, room.get(CX + x, CY + y));
  swatch.blit(crop, i * (CW + 4), 0);
});

// ── 장면: 시작 3초 화면(잠김 + 걸쇠 + 세 사람). 세탁기·건조기·자판기는 회색 상자
const scene = new Image(W, H);
wall(scene, 0, 0, W, FLOOR_Y);
floor(scene, 0, FLOOR_Y, W, H - FLOOR_Y);
for (const [id, h] of Object.entries(SCREEN.hotspots)) {
  if (id === 'latch' || id === 'shutter') continue;
  const [x, y, w, hh] = h.box;
  fill(scene, x, y, w, hh, (px, py) => (px === x || py === y || px === x + w - 1 || py === y + hh - 1 ? C.dusk : C.lint));
}
for (let i = 0; i < 4; i++) fill(scene, 177 + i * 40, 180, 38, 56, (px, py) => (px === 177 + i * 40 || py === 180 ? C.grnP : C.grnL)); // 세탁기 자리(PR #853 민트)
shutter(scene, 'locked');
latchBox(scene);

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
const name = (c) => `#${c}(Y${Y[c]})`;
for (const s of STATES) {
  const used = count(solo[s], 0, 0, W, H);
  const bad = [C.ink, C.hint, C.redD, C.red, C.redL].filter((c) => used.has(c));
  check(bad.length === 0, `${s}: 셔터에 ink·hint·빨강 없음${bad.length ? ` (${bad.join(',')})` : ''}`);
}
const L = solo.locked;
const panel = main(L, SHUTTER.x + 6, SHUTTER.y, SHUTTER.w - 12, SHUTTER.h - 6);
check(dY(panel, C.red) >= 30, `판 주색 ${name(panel)} vs 걸쇠 red ${name(C.red)} 차 ${dY(panel, C.red)} ≥ 30`);
const ring = new Map();
for (let x = LATCH[0] - 1; x <= LATCH[0] + LATCH[2]; x++) for (let y = LATCH[1] - 1; y <= LATCH[1] + LATCH[3]; y++) {
  if (x >= LATCH[0] && x < LATCH[0] + LATCH[2] && y >= LATCH[1] && y < LATCH[1] + LATCH[3]) continue;
  const c = L.get(x, y); if (c !== EMPTY) ring.set(c, (ring.get(c) ?? 0) + 1);
}
const ringMain = [...ring].sort((a, b) => b[1] - a[1])[0][0];
check(dY(ringMain, C.red) >= 30, `걸쇠 둘레 1px 주색 ${name(ringMain)} vs red 차 ${dY(ringMain, C.red)} ≥ 30`);
const FRONT = { 'ズッシー 셔츠': C.white, 'ズッシー 멜빵': C.teal, 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk };
for (const [n, c] of Object.entries(FRONT)) check(dY(c, panel) >= 30, `판 ${name(panel)} vs ${n} ${name(c)} 차 ${dY(c, panel)} ≥ 30`);
console.log(`참고(앞에 안 섬): プピ 우비 ${name(C.yel)} 차 ${dY(C.yel, panel)}`);
const outside = main(solo.up, SHUTTER.x + 6, SHUTTER.y + 4, SHUTTER.w - 12, SHUTTER.h - 20);
check(dY(outside, C.ink) >= 30, `올라감 문밖 주색 ${name(outside)} vs 까치 ink ${name(C.ink)} 차 ${dY(outside, C.ink)} ≥ 30`);
let lit = 0;
for (let x = SHUTTER.x + 6; x < SHUTTER.x + SHUTTER.w - 6; x++) if (Y[solo.loose.get(x, SHUTTER.y + SHUTTER.h - 1)] >= 190) lit++;
check(lit >= (SHUTTER.w - 12) / 2, `풀림 바닥 줄 빛 ${lit}px ≥ 판 폭 절반 ${(SHUTTER.w - 12) / 2}`);
console.log(`셔터 ${SHUTTER.w}×${SHUTTER.h} + 통 ${HOUSING.w}×${HOUSING.h}, 쓴 색 잠김 ${count(L, 0, 0, W, H).size} / 풀림 ${count(solo.loose, 0, 0, W, H).size} / 올라감 ${count(solo.up, 0, 0, W, H).size}개`);

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
writeFileSync(join(HERE, 'laundromat-shutter-4x.png'), indexedPng(swatch, 4));
writeFileSync(join(HERE, 'laundromat-shutter-scene-2x.png'), indexedPng(scene, 2));
gray(scene, 2, 'laundromat-shutter-gray-2x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
