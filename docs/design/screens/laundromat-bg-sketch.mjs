// 화면 1 `laundromat` 배경 구도 시안 (#764). 방 껍데기(art/scenes/laundromat.room.mjs) + 세탁기 줄(#853) + 셔터(#856) + 3번 건조기 정지 그림은 진짜 그림,
// 세제 자판기·걸쇠는 Kai 다시 보기(#802) 뒤라 **자리 표시**다.
// 실행: node docs/design/screens/laundromat-bg-sketch.mjs
// 출력(같은 폴더):
//   laundromat-bg-sketch-2x.png       시작 3초 화면(잠긴 셔터 + 세 사람 시작 위치 240·280·320). 세 사람은 배포 시트 0칸
//   laundromat-bg-sketch-gray-2x.png  같은 장면 명도(흑백) (ADR-0007 결정 3-6)
//   laundromat-bg-sketch-4x.png       왼쪽: 걸쇠 자리·빈 열쇠 걸이·선반 끝 / 오른쪽: 벽시계 4배(작은 것이 1배에서 읽히는지)
// 검사(어기면 종료 코드 1):
//   - 방 껍데기에 ink(0)·hint(31) 없음, 빨강 계열 없음 (결정 3-1, X4)
//   - 바닥 주색과 세 사람 주색 명도 차 ≥ 30 (결정 3-4)
//   - 아래 벽 띠 주색과 세 사람 주색·세탁기 몸 주색 차 ≥ 30 (시작 줄에서 몸이 세탁기·벽에 묻히지 않게)
//   - 벽 주색과 셔터 판·세탁기 몸 주색 차 ≥ 30
//   - 셔터 오른쪽 벽(x 152~158, y 140~152): 빨강·갈색 없음 + 걸쇠 red와 차 ≥ 30 (laundromat.md 9-1)
//   - 빈 열쇠 걸이 판 주색과 둘레 벽 차 ≥ 30 (클리어 컷 `clear_hook`이 가리키는 물건)
//   - 벽시계 판과 벽 차 ≥ 20(흰 판이 벽보다 밝게) — 숫자 대신 테두리·바늘로 읽힌다

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { fill } from '../../../art/lib/texture.mjs';
import { room, W, H, FLOOR_Y, WAINSCOT_Y, CEIL_Y, KEY_HOOK, CLOCK } from '../../../art/scenes/laundromat.room.mjs';
import { washer, WASHER_H } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const ROW = { x0: 176, y: 180, pitch: 40 }; // 설계 1-1 메모: 세탁기 4대 176~336, y 180~236
const ROW_DOORS = ['open', 'load', 'empty', 'load']; // #853: 문 열린 칸은 사람에게 안 가리는 1번
const LATCH = [140, 140, 10, 12]; // 걸쇠 그림 자리(설계 1-1). 히트 상자 133,134 24×24보다 작다
if (ROW.y + WASHER_H !== FLOOR_Y) throw new Error(`세탁기 아래 끝 ${ROW.y + WASHER_H} ≠ 바닥 ${FLOOR_Y}`);

const shell = new Image(W, H); // 방 껍데기만(검사용)
room(shell);

const scene = new Image(W, H);
room(scene);
for (let i = 0; i < 4; i++) washer(scene, ROW.x0 + i * ROW.pitch + 1, ROW.y, { n: i + 1, door: ROW_DOORS[i] });
shutter(scene, 'locked');
dryer(scene, SCREEN.hotspots.dryer_3.box[0], SCREEN.hotspots.dryer_3.box[1]); // 정지 그림(검사: laundromat-dryer-preview.mjs)
// 자리 표시: 자판기(lint 상자 + dusk 테두리), 걸쇠(빨간 상자)
{
  const [x, y, w, h] = SCREEN.hotspots.soap_vending.box;
  fill(scene, x, y, w, h, (px, py) => (px === x || py === y || px === x + w - 1 || py === y + h - 1 ? C.dusk : C.lint));
}
fill(scene, LATCH[0], LATCH[1], LATCH[2], LATCH[3], (px, py) => (px === LATCH[0] || py === LATCH[1] ? C.redL : C.red));

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
const PEOPLE = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };
const WASHER_BODY = C.grnL, PANEL = C.lint; // #853·#856 검사의 주색

const used = count(shell, 0, 0, W, H);
const bad = [C.ink, C.hint, C.redD, C.red, C.redL].filter((c) => used.has(c));
check(bad.length === 0, `방 껍데기에 ink·hint·빨강 없음${bad.length ? ` (${bad.join(',')})` : ''}`);
const floorMain = main(shell, 0, FLOOR_Y, W, H - FLOOR_Y);
for (const [n, c] of Object.entries(PEOPLE)) check(dY(floorMain, c) >= 30, `바닥 ${name(floorMain)} vs ${n} ${name(c)} 차 ${dY(floorMain, c)} ≥ 30`);
const band = main(shell, 0, WAINSCOT_Y + 2, W, FLOOR_Y - WAINSCOT_Y - 4);
for (const [n, c] of Object.entries({ ...PEOPLE, '세탁기 몸': WASHER_BODY })) check(dY(band, c) >= 30, `아래 벽 띠 ${name(band)} vs ${n} ${name(c)} 차 ${dY(band, c)} ≥ 30`);
const wallMain = main(shell, 0, CEIL_Y + 1, W, WAINSCOT_Y - CEIL_Y - 1);
check(dY(wallMain, PANEL) >= 30, `벽 ${name(wallMain)} vs 셔터 판 ${name(PANEL)} 차 ${dY(wallMain, PANEL)} ≥ 30`);
check(dY(wallMain, WASHER_BODY) >= 30, `벽 ${name(wallMain)} vs 세탁기 몸 ${name(WASHER_BODY)} 차 ${dY(wallMain, WASHER_BODY)} ≥ 30`);
const besideLatch = count(scene, 152, 140, 7, 13);
const warm = [C.redD, C.red, C.redL, C.woodD, C.wood, C.woodL].filter((c) => besideLatch.has(c));
check(warm.length === 0, `셔터 오른쪽 벽(152~158, 140~152)에 빨강·갈색 없음${warm.length ? ` (${warm.join(',')})` : ''}`);
const besideMain = main(scene, 152, 140, 7, 13);
check(dY(besideMain, C.red) >= 30, `셔터 오른쪽 벽 ${name(besideMain)} vs 걸쇠 red 차 ${dY(besideMain, C.red)} ≥ 30`);
const hookMain = main(shell, KEY_HOOK.x, KEY_HOOK.y, KEY_HOOK.w, KEY_HOOK.h);
const hookAround = main(shell, KEY_HOOK.x - 4, KEY_HOOK.y - 4, 2, KEY_HOOK.h + 8);
check(dY(hookMain, hookAround) >= 30, `열쇠 걸이 판 ${name(hookMain)} vs 둘레 벽 ${name(hookAround)} 차 ${dY(hookMain, hookAround)} ≥ 30`);
const faceMain = main(shell, CLOCK.cx - 4, CLOCK.cy - 4, 8, 8);
const clockAround = main(shell, CLOCK.cx - CLOCK.r - 4, CLOCK.cy - 2, 2, 4);
check(Y[faceMain] - Y[clockAround] >= 20, `시계 판 ${name(faceMain)}이 벽 ${name(clockAround)}보다 ${Y[faceMain] - Y[clockAround]} 밝음 ≥ 20`);
// 참고(검사 아님): 쿵 글자(teal, 묵직이 약속) 자리 뒤 배경. 설계 13절 Q5(머리 위 vs 발치) 판단 재료
const HEAD = { '셔터 앞 머리 위(171, 176)': [166, 172, 10, 8], '건조기 앞 머리 위(409, 176)': [404, 172, 10, 8] };
for (const [n, [x, y, w, h]] of Object.entries(HEAD)) { const m = main(scene, x, y, w, h); console.log(`참고 쿵 글자 teal vs ${n} ${name(m)} 차 ${dY(C.teal, m)}`); }
console.log(`참고 쿵 글자 teal vs 바닥(발치) ${name(floorMain)} 차 ${dY(C.teal, floorMain)}`);
console.log(`방 껍데기 쓴 색 ${used.size}개, 장면 ${count(scene, 0, 0, W, H).size}개`);

// ── 4배: 작은 것 셋(걸쇠 자리·열쇠 걸이·시계) 둘레
const crop = (img, x0, y0, w, h) => { const c = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.set(x, y, img.get(x0 + x, y0 + y)); return c; };
const zoom = new Image(140, 44);
zoom.blit(crop(scene, 128, 120, 70, 44), 0, 0); // 걸쇠·셔터 오른쪽 끝·열쇠 걸이·1번 세탁기 문
zoom.blit(crop(scene, CLOCK.cx - 35, CLOCK.cy - 22, 70, 44), 70, 0); // 시계 둘레

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
writeFileSync(join(HERE, 'laundromat-bg-sketch-2x.png'), indexedPng(scene, 2));
writeFileSync(join(HERE, 'laundromat-bg-sketch-4x.png'), indexedPng(zoom, 4));
gray(scene, 2, 'laundromat-bg-sketch-gray-2x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
