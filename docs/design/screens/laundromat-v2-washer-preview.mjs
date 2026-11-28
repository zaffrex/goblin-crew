// 빨래방 v2 N4·N5 미리보기·검사 (#1031, laundromat-v2.md 9-2절). 원본: art/scenes/laundromat.towel.mjs
// 실행: node docs/design/screens/laundromat-v2-washer-preview.mjs
// 출력(같은 폴더):
//   laundromat-v2-washer-4x.png     세탁기 1번 세 모습(지금 문 열림 / N4 통 속 마른 수건 / N5 + 반쯤 낀 동전) 4배
//   laundromat-v2-blind-n5-1x.png   블라인드용: 진짜 배경(public/scenes/laundromat-bg.png) 위 1번 세탁기만 N5로 바꾼 한 화면 1배.
//                                    캡션 없이 "동전이 어떻게 됐나"를 묻는다(9-2절 그림 블라인드)
//   laundromat-v2-blind-n5-3x.png   같은 장면의 세탁기 줄 근처를 3배로 자른 것(리뷰용, 블라인드에는 안 씀)
//   laundromat-v2-washer-gray-3x.png  3배 자른 것의 명도(흑백) (ADR-0007 결정 3-6)
// 검사(어기면 종료 코드 1):
//   - 수건 채움 픽셀이 입구 테두리(반지름 13) 안이거나 늘어진 자락 자리에만 있고, 60% 이상이 통 안쪽 원 안
//   - 마른 수건 주색과 통 속 색(dusk·plum) 명도 차 ≥ 30
//   - 동전 몸 픽셀 13개(반달)가 다 보이고, 동전 몸 주색과 조작판 cotton 명도 차 ≥ 30
//   - 동전 홈(dusk 세로 홈 dy 4~6)은 그대로 비친다("반쯤 들어감")
//   - 수건·동전은 세탁기 몸 상자(+ 문 열림 왼쪽 7px) 밖에 안 그린다

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
import { drumTowel, slotCoin, DRUM_TOWEL_BOX, WASHER_OPEN_SPAN } from '../../../art/scenes/laundromat.towel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const W1 = { x: 177, y: 180 }; // 세탁기 1번 몸 왼쪽 위(art/scenes/laundromat.mjs ROW x0 176 + 1, y 180)

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
  for (let y = 0; y < h; y++) {
    if (raw[y * (w + 1)] !== 0) throw new Error(`필터 ${raw[y * (w + 1)]} 줄은 못 읽음`);
    for (let x = 0; x < w; x++) { const i = raw[y * (w + 1) + 1 + x]; img.c[y * w + x] = i >= 32 ? EMPTY : i; }
  }
  return img;
}
const crop = (img, x0, y0, w, h) => { const o = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(x, y, img.get(x0 + x, y0 + y)); return o; };

// ── 4배: 세 모습(자리 표시 벽 cotton·바닥 woodL)
const PAD = 10, STEP = WASHER_W + 7 + PAD * 2;
const swatch = new Image(3 * STEP, WASHER_H + 16);
fill(swatch, 0, 0, swatch.w, WASHER_H + 8, C.cotton);
fill(swatch, 0, WASHER_H + 8, swatch.w, 8, C.woodL);
const STATES = ['open', 'n4', 'n5'];
STATES.forEach((s, i) => {
  const x = i * STEP + PAD + 7, y = 8;
  washer(swatch, x, y, { n: 1, door: 'open' });
  if (s !== 'open') drumTowel(swatch, x, y);
  if (s === 'n5') slotCoin(swatch, x, y);
});

// ── 1배 블라인드: 진짜 배경 + 1번만 N5
const bg = readIndexedPng(join(ROOT, 'public/scenes/laundromat-bg.png'));
const scene = new Image(bg.w, bg.h);
scene.blit(bg, 0, 0);
drumTowel(scene, W1.x, W1.y);
slotCoin(scene, W1.x, W1.y);
const ZOOM = { x: 150, y: 160, w: 200, h: 90 };
const zoomed = crop(scene, ZOOM.x, ZOOM.y, ZOOM.w, ZOOM.h);

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const diffPixels = (before, after) => { const out = []; for (let y = 0; y < after.h; y++) for (let x = 0; x < after.w; x++) if (before.get(x, y) !== after.get(x, y)) out.push([x, y, after.get(x, y)]); return out; };

// 수건만 얹은 것과 빈 열린 세탁기를 비교한다
const base = new Image(80, 80);
washer(base, 20, 10, { n: 1, door: 'open' });
const withTowel = new Image(80, 80); withTowel.blit(base, 0, 0); drumTowel(withTowel, 20, 10);
const towelPx = diffPixels(base, withTowel);
const fillPx = towelPx.filter(([, , c]) => c !== C.ink);
const cx = 20 + 18.5, cy = 10 + 30.5;
const outside = fillPx.filter(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 13);
const flap = (x, y) => y - 10 >= 39 && x - 20 >= 10 && x - 20 <= 17; // 늘어진 자락(몸 기준 dx 10~17, dy 39~)
check(outside.every(([x, y]) => flap(x, y)), `수건 채움 ${fillPx.length}px이 입구 테두리(반지름 13) 안이거나 늘어진 자락 (그 밖 ${outside.filter(([x, y]) => !flap(x, y)).length}px)`);
const inDrum = fillPx.filter(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= 10.5).length;
check(inDrum / fillPx.length >= 0.6, `수건 채움의 ${Math.round((inDrum / fillPx.length) * 100)}%가 통 안쪽 원 안 ≥ 60% (나머지는 늘어진 자락)`);
check(dY(C.tealL, C.grnL) >= 30, `늘어진 자락 tealL(Y${Y[C.tealL]}) vs 세탁기 앞판 grnL(Y${Y[C.grnL]}) 차 ${dY(C.tealL, C.grnL)} ≥ 30`);
const towelMain = [...fillPx.reduce((m, [, , c]) => m.set(c, (m.get(c) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0][0];
for (const [name, c] of [['통 속 dusk', C.dusk], ['통 위쪽 plum', C.plum]]) check(dY(towelMain, c) >= 30, `마른 수건 주색 #${towelMain}(Y${Y[towelMain]}) vs ${name}(Y${Y[c]}) 차 ${dY(towelMain, c)} ≥ 30`);
check(towelPx.every(([x, y]) => x >= 20 + DRUM_TOWEL_BOX.dx && x < 20 + DRUM_TOWEL_BOX.dx + DRUM_TOWEL_BOX.w && y >= 10 + DRUM_TOWEL_BOX.dy && y < 10 + DRUM_TOWEL_BOX.dy + DRUM_TOWEL_BOX.h), 'DRUM_TOWEL_BOX가 수건 픽셀을 다 담는다');

const withCoin = new Image(80, 80); withCoin.blit(withTowel, 0, 0); slotCoin(withCoin, 20, 10);
const coinPx = diffPixels(withTowel, withCoin);
const lone = new Image(80, 80); slotCoin(lone, 20, 10);
const coinBody = diffPixels(new Image(80, 80), lone).filter(([, , c]) => c !== C.ink);
const coinHidden = coinBody.filter(([x, y, c]) => withCoin.get(x, y) !== c).length;
check(coinBody.length === 13 && coinHidden === 0, `동전 몸 ${coinBody.length}px(반달 5×3에서 위 두 귀퉁이 뺀 13)이 수건 그림 위에서도 다 보임(가림 ${coinHidden})`);
check(dY(C.lint, C.cotton) >= 30, `동전 몸 lint(Y${Y[C.lint]}) vs 조작판 cotton(Y${Y[C.cotton]}) 차 ${dY(C.lint, C.cotton)} ≥ 30`);
const slit = [4, 5, 6].map((dy) => withCoin.get(20 + 6, 10 + dy));
check(slit.every((c) => c === C.dusk), `동전 홈 dy 4~6 그대로 dusk (${slit.join(',')})`);
const all = [...towelPx, ...coinPx];
const span = { x0: 20 + WASHER_OPEN_SPAN.dx, x1: 20 + WASHER_OPEN_SPAN.dx + WASHER_OPEN_SPAN.w, y0: 10, y1: 10 + WASHER_H };
check(all.every(([x, y]) => x >= span.x0 && x < span.x1 && y >= span.y0 && y < span.y1), '수건·동전이 세탁기 상자(문 열림 포함) 안');
// 배경과 합친 장면에서 1번 세탁기 밖 픽셀이 안 바뀌었나
const sceneDiff = diffPixels(bg, scene);
check(sceneDiff.every(([x, y]) => x >= W1.x + WASHER_OPEN_SPAN.dx && x < W1.x + WASHER_OPEN_SPAN.dx + WASHER_OPEN_SPAN.w && y >= W1.y && y < W1.y + WASHER_H), `진짜 배경에서 바뀐 ${sceneDiff.length}px이 1번 세탁기 안`);
console.log(`새 칸: N4 수건 ${towelPx.length}px(외곽선 포함), N5 동전 ${coinPx.length}px`);

// ── 출력
const gray = (img, S, file) => {
  const w = img.w * S, h = img.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = img.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 0 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, file), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
};
writeFileSync(join(HERE, 'laundromat-v2-washer-4x.png'), indexedPng(swatch, 4));
writeFileSync(join(HERE, 'laundromat-v2-blind-n5-1x.png'), indexedPng(scene, 1));
writeFileSync(join(HERE, 'laundromat-v2-blind-n5-3x.png'), indexedPng(zoomed, 3));
gray(zoomed, 3, 'laundromat-v2-washer-gray-3x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
