// 화면 1 `laundromat` 세제 자판기 미리보기·검사 (#764). 원본: art/scenes/laundromat.vending.mjs
// 실행: node docs/design/screens/laundromat-vending-preview.mjs
// 출력(같은 폴더):
//   laundromat-vending-4x.png       진짜 방(room.mjs) 오른쪽 구석에 놓은 자판기 4배. 왼쪽은 자판기만, 오른쪽은 プピ를 왼쪽 설 곳(415)에 세운 비교
//   laundromat-vending-gray-4x.png  같은 그림 명도(흑백) (ADR-0007 결정 3-6)
// 장면 전체는 laundromat-bg-sketch.mjs가 만든다(건조기 PR #879가 머지된 뒤 거기에 붙인다).
// 검사(어기면 종료 코드 1):
//   - 자판기에 ink(0)·hint(31)·빨강 계열 없음 (결정 3-1, X4)
//   - 몸 주색과 세 사람 주색 명도 차 ≥ 30 (사람이 자판기 왼쪽 415~419에 선다)
//   - 몸 주색과 뒤 벽(cotton)·아래 벽 띠(plum) 차 ≥ 30 (명도 띠 결정 2026-11-23)
//   - 진열창 유리가 몸보다 60 이상 어둡다 (1배에서 "유리 진열창 = 자판기"로 읽히는 실루엣)
//   - 세제 상자 6개 모두 유리보다 60 이상 밝다 (불 꺼진 유리 너머로도 "물건이 줄지어 있다")
//   - 버튼이 받침 띠보다 60 이상 밝다 (1배에서 버튼 줄이 점선으로 읽힘)
//   - 몸 색상이 세탁기(grn 계열)·건조기(pur 계열)와 다르다
//   - 켜진 불 없음: 진열창에 노랑 표시등 같은 2×2 이상 yel 덩어리가 상자 밖에 없다(건조기 표시등만 켜진 가게)
//   - プピ를 왼쪽 설 곳(415)에 세웠을 때 자판기와 겹치는 칸 0 (우비와 몸 명도 차가 30 딱 경계라, 겹치지 않는 걸 확인해 둔다)

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { room, W, H } from '../../../art/scenes/laundromat.room.mjs';
import { vending, VEND_W, VEND_H, VEND_WINDOW, VEND_BOX, VEND_BUTTON_Y } from '../../../art/scenes/laundromat.vending.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const [VX, VY] = SCREEN.hotspots.soap_vending.box;
const STAND = 415; // 설계 1-1: 자판기 왼쪽 설 곳 ノビー 419·ズッシー 417·プピ 415

const only = new Image(W, H); // 자판기만(검사용)
vending(only, VX, VY);

const scene = new Image(W, H);
room(scene);
vending(scene, VX, VY);

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
const ppikCell = (() => {
  const meta = JSON.parse(readFileSync(join(ROOT, 'public/sprites', 'ppik-base.json'), 'utf8'));
  const sheet = readIndexedPng(join(ROOT, 'public/sprites', meta.image));
  const [cw, ch] = meta.cell, [ax, ay] = meta.anchor;
  const cell = new Image(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cell.set(x, y, sheet.get(x, y));
  return { cell, ax, ay, cw, ch };
})();
const withPpik = new Image(W, H);
room(withPpik);
vending(withPpik, VX, VY);
withPpik.blit(ppikCell.cell, STAND - ppikCell.ax, 244 - ppikCell.ay);

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (img, x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY) m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const main = (img, x0, y0, w, h) => [...count(img, x0, y0, w, h)].sort((a, b) => b[1] - a[1])[0][0];
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const name = (c) => `#${c}(Y${Y[c]})`;
const PEOPLE = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };

const used = count(only, VX, VY, VEND_W, VEND_H + 1);
const bad = [C.ink, C.hint, C.redD, C.red, C.redL].filter((c) => used.has(c));
check(bad.length === 0, `자판기에 ink·hint·빨강 없음${bad.length ? ` (${bad.join(',')})` : ''}`);
const body = main(only, VX, VY, VEND_W, VEND_H);
for (const [n, c] of Object.entries(PEOPLE)) check(dY(body, c) >= 30, `몸 ${name(body)} vs ${n} ${name(c)} 차 ${dY(body, c)} ≥ 30`);
check(dY(body, C.cotton) >= 30, `몸 ${name(body)} vs 뒤 벽 cotton ${name(C.cotton)} 차 ${dY(body, C.cotton)} ≥ 30`);
check(dY(body, C.plum) >= 30, `몸 ${name(body)} vs 아래 벽 띠 plum ${name(C.plum)} 차 ${dY(body, C.plum)} ≥ 30`);
const { x: wx, y: wy, w: ww } = VEND_WINDOW;
const glass = main(only, VX + wx + 1, VY + wy + 1, ww - 2, 2); // 진열창 위 2줄(상자 위 빈 유리)
check(Y[body] - Y[glass] >= 60, `진열창 유리 ${name(glass)}이 몸보다 ${Y[body] - Y[glass]} 어둡다 ≥ 60`);
let darkest = 999;
VEND_BOX.rows.forEach((ry) => VEND_BOX.cols.forEach((cx0) => { darkest = Math.min(darkest, Y[main(only, VX + cx0, VY + ry + 1, VEND_BOX.w - 1, 2)]); }));
check(darkest - Y[glass] >= 60, `세제 상자 6개가 유리보다 ${darkest - Y[glass]} 이상 밝다 ≥ 60`);
const btn = only.get(VX + VEND_BOX.cols[0] + 2, VY + VEND_BUTTON_Y[0]);
const plate = only.get(VX + VEND_BOX.cols[0], VY + VEND_BUTTON_Y[0]);
check(Y[btn] - Y[plate] >= 60, `버튼 ${name(btn)}이 받침 ${name(plate)}보다 ${Y[btn] - Y[plate]} 밝다 ≥ 60`);
const GREENS = [C.grnD, C.grn, C.grnL, C.grnP], PURPLES = [C.purD, C.pur, C.purL];
check(!GREENS.includes(body) && !PURPLES.includes(body), `몸 색상이 세탁기(grn)·건조기(pur)와 다르다 (${name(body)})`);
// 켜진 불: 상자 칸 밖에서 yel/yelL 2×2 덩어리
const inBox = (px, py) => VEND_BOX.rows.some((ry) => VEND_BOX.cols.some((cx0) => px >= VX + cx0 && px < VX + cx0 + VEND_BOX.w && py >= VY + ry && py < VY + ry + VEND_BOX.h));
const lit = (c) => c === C.yel || c === C.yelL;
let lamps = 0;
for (let py = VY; py < VY + VEND_H - 1; py++) for (let px = VX; px < VX + VEND_W - 1; px++) {
  if (inBox(px, py)) continue;
  if (lit(only.get(px, py)) && lit(only.get(px + 1, py)) && lit(only.get(px, py + 1)) && lit(only.get(px + 1, py + 1))) lamps++;
}
check(lamps === 0, `상자 밖에 켜진 노란 불 없음 (${lamps})`);
// プピ(우비 Y208, 몸과 30 딱 경계)를 왼쪽 설 곳에 세웠을 때 자판기와 겹치는 칸 수와 가장 가까운 틈
let overlap = 0, rightmost = -1;
for (let cy = 0; cy < ppikCell.ch; cy++) for (let cx = 0; cx < ppikCell.cw; cx++) {
  if (ppikCell.cell.get(cx, cy) === EMPTY) continue;
  const px = STAND - ppikCell.ax + cx, py = 244 - ppikCell.ay + cy;
  rightmost = Math.max(rightmost, px);
  if (only.get(px, py) !== EMPTY) overlap++;
}
check(overlap === 0, `プピ(설 곳 ${STAND})가 자판기와 겹치는 칸 ${overlap}개, 몸 오른끝 ${rightmost} → 자판기 왼끝 ${VX}까지 ${VX - rightmost - 1}px`);
console.log(`자판기 ${VEND_W}×${VEND_H} @ (${VX}, ${VY}), 쓴 색 ${used.size}개`);

// ── 4배: 건조기 오른쪽 끝 ~ 화면 오른쪽 끝(x 392~480, y 136~250). 왼쪽 판 자판기만, 오른쪽 판 プピ 세움
const crop = (img, x0, y0, w, h) => { const c = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.set(x, y, img.get(x0 + x, y0 + y)); return c; };
const A = crop(scene, 392, 136, 88, 114), B = crop(withPpik, 392, 136, 88, 114);
const zoom = new Image(88 * 2 + 4, 114);
zoom.blit(A, 0, 0); zoom.blit(B, 92, 0);
for (let y = 0; y < 114; y++) for (let x = 88; x < 92; x++) zoom.set(x, y, C.white);

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
writeFileSync(join(HERE, 'laundromat-vending-4x.png'), indexedPng(zoom, 4));
gray(zoom, 4, 'laundromat-vending-gray-4x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
