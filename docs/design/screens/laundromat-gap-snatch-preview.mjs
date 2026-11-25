// 스테이지 3 `laundromat` O3 틈 속 까치 머리·부리 2칸(`gap.snatch`, 설계 laundromat.md 4절 3-1, 9-2 O3) 미리보기·검사 (#764).
// 아직 빌드에 안 붙였다. 설계 9-3: 단서 칸은 빌드에 붙이기 전에 1배 그림 블라인드("열쇠를 누가 가져갔나")를 먼저 본다.
// 실행: node docs/design/screens/laundromat-gap-snatch-preview.mjs
// 출력(같은 폴더):
//   laundromat-gap-snatch-4x.png       틈 둘레 70×44를 칸 순서대로 다섯 장(길바닥 열쇠 → reach → bite → 빠짐 → 빈 틈), 4배
//   laundromat-gap-snatch-gray-4x.png  같은 줄 명도(흑백, ADR-0007 결정 3-6)
//   laundromat-gap-snatch-anim-4x.png  같은 줄을 칸 시간대로 움직이는 APNG, 4배
//   laundromat-gap-snatch-blind-1x.png 블라인드용 1배 두 장(왼쪽 시작 = 길바닥 열쇠, 오른쪽 = bite 칸). 글·표시 없음.
//                                      창 안 까치는 `fly_out` 뒤라 둘 다 안 그린다(오른쪽만 그리면 "까치가 사라졌다"가 답이 돼 버린다)
// 검사(어기면 종료 코드 1):
//   - reach·bite에서 머리가 보이는 픽셀 ≥ 30, 흰 눈 1px이 잘리지 않고 보인다
//   - 보이는 픽셀이 전부 셔터 판 아래 끝(244 − gapLift)과 가게 바닥(244) 사이, `gap` 핫스팟(80,222 40×24) 안
//   - 머리 ink와 머리 뒤 틈 너머 주색 차 ≥ 30, 광택(tealM)과도 ≥ 30
//   - reach: 부리 끝이 열쇠 고리 구멍(106,239)에서 2px 안 / bite: 금색 고리 테(yelL·yel·yelD)와 부리(ink·lav)가 맞닿음(물고 있다)
//   - 빠짐 칸: 보이는 픽셀이 bite의 절반 이하(판 뒤로 들어감)이고 0은 아님(패 끝이 마지막으로 보인다)
//   - 칸 시간 합 ≤ 1500(형식 기록 8절)

import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { room, W, H } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter, SHUTTER, gapLift } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending } from '../../../art/scenes/laundromat.vending.mjs';
import { nestEmpty, keyTag, KEY_ON_STREET, KEY_RING_HOLE, GAP_SNATCH, gapHead, GAP_HEAD_WITHDRAW, KEY_BITE_LIFT } from '../../../art/scenes/laundromat.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const BOTTOM = SHUTTER.y + SHUTTER.h;
const RING = [KEY_ON_STREET.x + KEY_RING_HOLE.x, KEY_ON_STREET.y + KEY_RING_HOLE.y]; // 열쇠 고리 구멍(2×2 왼쪽 위) 길바닥 자리

/** 방 + 세탁기 줄 + 잠긴 셔터 + 건조기 + 자판기 + 빈 둥지(배경 시안과 같은 구도). 까치는 `fly_out` 뒤라 없다 */
function base() {
  const img = new Image(W, H);
  room(img);
  ['open', 'load', 'empty', 'load'].forEach((door, i) => washer(img, 176 + i * 40 + 1, 180, { n: i + 1, door }));
  shutter(img, 'locked');
  dryer(img, SCREEN.hotspots.dryer_3.box[0], SCREEN.hotspots.dryer_3.box[1]);
  vending(img, SCREEN.hotspots.soap_vending.box[0], SCREEN.hotspots.soap_vending.box[1]);
  nestEmpty(img);
  return img;
}
const layer = (draw) => { const t = new Image(W, H); draw(t); return t; };
const over = (img, t) => { const o = new Image(W, H); o.c.set(img.c); o.blit(t, 0, 0); return o; };
const pixels = (t) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY) out.push([x, y, t.get(x, y)]); return out; };

const bg = base();
const frames = GAP_SNATCH.frames.map(layer);
const headOnly = {
  reach: layer((t) => gapHead(t, 'reach')),
  bite: layer((t) => gapHead(t, 'bite')),
  out: layer((t) => gapHead(t, 'bite', GAP_HEAD_WITHDRAW)),
};

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const [gx, gy, gw, gh] = SCREEN.hotspots.gap.box;
for (const [pose, t] of Object.entries(headOnly)) {
  const px = pixels(t);
  const outside = px.filter(([x, y]) => y < BOTTOM - gapLift(x) || y >= BOTTOM || x < gx || x >= gx + gw || y < gy || y >= gy + gh);
  check(outside.length === 0, `${pose}: 보이는 ${px.length}px 전부 틈 안 + gap 핫스팟 안 (밖 ${outside.length})`);
}
for (const pose of ['reach', 'bite']) {
  const px = pixels(layer((t) => gapHead(t, pose, { key: false })));
  check(px.length >= 30, `${pose}: 머리가 보이는 픽셀 ${px.length} ≥ 30`);
  check(px.some(([, , c]) => c === C.white), `${pose}: 흰 눈이 잘리지 않고 보인다`);
}
{
  // 머리 뒤(셔터 잠김 그림) 틈 너머 주색: 머리 픽셀 자리의 배경 색 중 가장 많은 것
  const m = new Map();
  for (const [x, y] of pixels(headOnly.reach)) { const c = bg.get(x, y); m.set(c, (m.get(c) ?? 0) + 1); }
  const behind = [...m].sort((a, b) => b[1] - a[1])[0][0];
  check(dY(C.ink, behind) >= 30, `머리 ink(Y${Y[C.ink]}) vs 틈 너머 주색 #${behind}(Y${Y[behind]}) 차 ${dY(C.ink, behind)} ≥ 30`);
  check(dY(C.tealM, behind) >= 30, `정수리 광택 tealM(Y${Y[C.tealM]}) vs 틈 너머 주색 차 ${dY(C.tealM, behind)} ≥ 30`);
  console.log(`참고 머리 뒤 색: ${[...m].map(([c, n]) => `#${c}×${n}`).join(' ')}`);
}
{
  const beak = pixels(headOnly.reach).filter(([, , c]) => c === C.ink || c === C.lav);
  const tip = beak.reduce((a, b) => (b[0] + (BOTTOM - b[1]) < a[0] + (BOTTOM - a[1]) ? b : a)); // 가장 왼쪽 아래
  const d = Math.max(Math.abs(tip[0] - RING[0]), Math.abs(tip[1] - RING[1]));
  check(d <= 2, `reach: 부리 끝 ${tip[0]},${tip[1]}가 고리 ${RING.join(',')}에서 ${d}px ≤ 2`);
  const bite = headOnly.bite;
  // 고리 = 구멍(들어 올린 자리) 둘레 8×8 안의 금색. 부리 ink·lav와 위아래좌우로 닿아야 "물고 있다"
  const hx = RING[0], hy = RING[1] - KEY_BITE_LIFT;
  const gold = [C.yelL, C.yel, C.yelD];
  const ring = pixels(bite).filter(([x, y, c]) => gold.includes(c) && x >= hx - 3 && x <= hx + 4 && y >= hy - 3 && y <= hy + 4);
  const head = layer((t) => gapHead(t, 'bite', { key: false }));
  const touch = ring.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => [C.ink, C.lav].includes(head.get(x + a, y + b))));
  check(ring.length > 0 && touch, `bite: 금색 고리 테(${ring.length}px 보임)가 부리에 맞닿음(물고 있다)`);
}
{
  const nb = pixels(headOnly.bite).length, no = pixels(headOnly.out).length;
  check(no > 0 && no * 2 <= nb, `빠짐: 보이는 ${no}px ≤ bite ${nb}px의 절반, 0 아님`);
}
const total = GAP_SNATCH.ms.reduce((a, b) => a + b, 0);
check(total <= 1500 && GAP_SNATCH.ms.length === GAP_SNATCH.frames.length, `칸 시간 합 ${total}ms ≤ 1500, 칸 ${GAP_SNATCH.frames.length}개`);

// ── 출력
const CROP = { x: 72, y: 206, w: 70, h: 44 };
const crop = (img) => { const c = new Image(CROP.w, CROP.h); for (let y = 0; y < CROP.h; y++) for (let x = 0; x < CROP.w; x++) c.set(x, y, img.get(CROP.x + x, CROP.y + y)); return c; };
const shots = frames.map((f) => crop(over(bg, f)));
const strip = new Image(shots.length * (CROP.w + 2) - 2, CROP.h, C.white);
shots.forEach((s, i) => strip.blit(s, i * (CROP.w + 2), 0));
writeFileSync(join(HERE, 'laundromat-gap-snatch-4x.png'), indexedPng(strip, 4));
// 흑백: 팔레트 명도를 그대로 8비트 회색으로(배경 시안 laundromat-bg-sketch.mjs와 같은 방식)
{
  const S = 4, w = strip.w * S, h = strip.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = strip.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 255 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'laundromat-gap-snatch-gray-4x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
writeFileSync(join(HERE, 'laundromat-gap-snatch-anim-4x.png'), animatedPng(shots.map((img, i) => ({ img, ms: GAP_SNATCH.ms[i] })), 4));
const blind = new Image(W * 2 + 4, H, C.white);
blind.blit(over(bg, layer((t) => keyTag(t, KEY_ON_STREET.x, KEY_ON_STREET.y))), 0, 0);
blind.blit(over(bg, frames[2]), W + 4, 0);
writeFileSync(join(HERE, 'laundromat-gap-snatch-blind-1x.png'), indexedPng(blind, 1));

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
