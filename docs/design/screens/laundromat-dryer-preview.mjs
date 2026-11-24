// 화면 1 `laundromat` 3번 건조기 미리보기·검사 (#764). 원본: art/scenes/laundromat.dryer.mjs
// 실행: node docs/design/screens/laundromat-dryer-preview.mjs
// 출력(같은 폴더):
//   laundromat-dryer-4x.png       진짜 방(room.mjs) 오른쪽 위에 놓은 건조기 4배 + 왼쪽에 세탁기 4번, 오른쪽에 プピ(시작 자세)를 건조기 앞에 세운 비교
//   laundromat-dryer-gray-4x.png  같은 그림 명도(흑백) (ADR-0007 결정 3-6)
// 장면 전체는 laundromat-bg-sketch.mjs가 만든다(건조기는 거기서 이 그림을 부른다).
// 검사(어기면 종료 코드 1):
//   - 건조기에 ink(0)·hint(31)·빨강 계열 없음 (결정 3-1, X4)
//   - 몸 주색과 세 사람 주색 명도 차 ≥ 30 (사람이 건조기 앞에 선다: 왼쪽 323~327, 오른쪽 409~413)
//   - 몸 주색과 뒤 벽(cotton)·아래 벽 띠(plum) 차 ≥ 30 (명도 띠 결정 2026-11-23)
//   - 문 유리 주색이 몸보다 60 이상 어둡다 (1배에서 "둥근 문 = 빨래 기계"로 읽히는 실루엣, 세탁기와 같은 기준)
//   - 몸 주색 색상이 세탁기 몸(grnL)과 다르다 (줄에서 혼자 다른 기계)
//   - 테이프 X자가 유리 위에서 유리보다 60 이상 밝다 (1배에서 "X" 로 읽힘)

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { room, W, H } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { dryer, DRYER_W, DRYER_H, DRYER_DOOR } from '../../../art/scenes/laundromat.dryer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const [DX, DY] = SCREEN.hotspots.dryer_3.box;

const only = new Image(W, H); // 건조기만(검사용)
dryer(only, DX, DY);

const scene = new Image(W, H);
room(scene);
washer(scene, 176 + 3 * 40 + 1, 180, { n: 4, door: 'load' });
dryer(scene, DX, DY);

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
// プピ를 건조기 오른쪽 설 곳(413, 설계 1-1)에 세운다: 키 작은 사람이 앞에 서도 X자·표시등이 남는지
{
  const meta = JSON.parse(readFileSync(join(ROOT, 'public/sprites', 'ppik-base.json'), 'utf8'));
  const sheet = readIndexedPng(join(ROOT, 'public/sprites', meta.image));
  const [cw, ch] = meta.cell, [ax, ay] = meta.anchor;
  const cell = new Image(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cell.set(x, y, sheet.get(x, y));
  scene.blit(cell, 413 - ax, 244 - ay);
}

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (img, x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY) m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const main = (img, x0, y0, w, h) => [...count(img, x0, y0, w, h)].sort((a, b) => b[1] - a[1])[0][0];
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const name = (c) => `#${c}(Y${Y[c]})`;
const PEOPLE = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };

const used = count(only, DX, DY, DRYER_W, DRYER_H + 1);
const bad = [C.ink, C.hint, C.redD, C.red, C.redL].filter((c) => used.has(c));
check(bad.length === 0, `건조기에 ink·hint·빨강 없음${bad.length ? ` (${bad.join(',')})` : ''}`);
const body = main(only, DX, DY, DRYER_W, DRYER_H);
for (const [n, c] of Object.entries(PEOPLE)) check(dY(body, c) >= 30, `몸 ${name(body)} vs ${n} ${name(c)} 차 ${dY(body, c)} ≥ 30`);
check(dY(body, C.cotton) >= 30, `몸 ${name(body)} vs 뒤 벽 cotton ${name(C.cotton)} 차 ${dY(body, C.cotton)} ≥ 30`);
check(dY(body, C.plum) >= 30, `몸 ${name(body)} vs 아래 벽 띠 plum ${name(C.plum)} 차 ${dY(body, C.plum)} ≥ 30`);
const { cx, cy, ri } = DRYER_DOOR;
const glass = main(only, DX + cx + 3, DY + cy - ri + 3, 5, 5); // 유리 오른쪽 위 1/4(테이프·빨래·반사 피한 자리)
check(Y[body] - Y[glass] >= 60, `문 유리 ${name(glass)}이 몸보다 ${Y[body] - Y[glass]} 어둡다 ≥ 60`);
check(body !== C.grnL && body !== C.grn && body !== C.grnP, `몸 색상이 세탁기(grnL)와 다르다 (${name(body)})`);
const tape = only.get(DX + cx + 6, DY + cy + 6);
check(Y[tape] - Y[glass] >= 60, `테이프 ${name(tape)}가 유리보다 ${Y[tape] - Y[glass]} 밝다 ≥ 60`);
console.log(`건조기 ${DRYER_W}×${DRYER_H} @ (${DX}, ${DY}), 쓴 색 ${used.size}개`);

// ── 4배: 세탁기 4번 끝 ~ 자판기 자리 앞까지(x 300~432, y 120~250)
const crop = (img, x0, y0, w, h) => { const c = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.set(x, y, img.get(x0 + x, y0 + y)); return c; };
const zoom = crop(scene, 300, 120, 132, 130);

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
writeFileSync(join(HERE, 'laundromat-dryer-4x.png'), indexedPng(zoom, 4));
gray(zoom, 4, 'laundromat-dryer-gray-4x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
