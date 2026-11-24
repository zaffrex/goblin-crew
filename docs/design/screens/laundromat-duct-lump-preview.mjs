// 스테이지 3 `laundromat` O6 덕트 혹 3칸(`DUCT_LUMP`, 설계 laundromat.md 4절 1-2·3-2·2-2·6, 9-2 O6, E2) 미리보기·검사 (#764).
// 아직 빌드에 안 붙였다. 설계 9-3: 단서 칸은 빌드에 붙이기 전에 1배 그림 블라인드("무엇이 달라졌나")를 먼저 본다.
// 실행: node docs/design/screens/laundromat-duct-lump-preview.mjs
// 출력(같은 폴더):
//   laundromat-duct-lump-4x.png        걸린 자리 둘레 56×64, 혹 없음 → 걸림 → 끙끙, 4배
//   laundromat-duct-lump-gray-4x.png   같은 줄 명도(흑백, ADR-0007 결정 3-6)
//   laundromat-duct-lump-path-2x.png   덕트 전체 308×132에 lump_travel 자리 여섯 곳을 한 장에 겹친 것, 2배
//   laundromat-duct-lump-anim-2x.png   lump_travel → 끙끙 두 바퀴 → lump_back → lump_travel → lump_pop, APNG 2배
//   laundromat-duct-lump-blind-1x.png  블라인드용 1배 두 장(왼쪽 혹 없음, 오른쪽 걸린 혹 멈춘 모습). 글·표시 없음
// 검사(어기면 종료 코드 1):
//   - 혹 그림이 쓰는 덕트 값이 방 껍데기 DUCT와 같다
//   - 걸린 혹(멈춘 모습·끙끙) 그린 픽셀 전부 `duct` 핫스팟 안 = 혹을 누르면 덕트가 받는다(★③ S6). 혹 가운데 = reachPoint
//   - 어느 칸도 건조기 위 끝(164) 아래에 안 그린다, 빈 칸(0px)이 없다(빌드 picture() 실패)
//   - 가로 칸은 가로 구간 위아래 4px 안, 판자 구멍(x ≤ 96)·걸이와 안 겹치는 x
//   - 혹이 벽에 닿는 테두리는 전부 ink, 관 안쪽엔 ink 세로줄 없음
//   - 혹 없음 ↔ 걸린 혹 다른 픽셀 ≥ 120, 멈춘 모습 ↔ 끙끙 다른 픽셀 ≥ 40(1배에서 보일 크기)
//   - lump_travel 첫 칸 = 창 쪽 가로 자리, 마지막 칸 = stuck 첫 칸 / lump_back = 거꾸로 / stuck 첫 칸 = 멈춘 모습
//   - lump_travel 첫 칸 ≥ 160ms(창 쪽 머묾), 마지막 칸 80~120ms(덜컥과 깃털 한 박자), 다른 칸 80ms(E2)
//   - lump_travel·lump_back·lump_pop 칸 시간 합 ≤ 1500(형식 기록 8절)

import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { room, W, H, DUCT } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending } from '../../../art/scenes/laundromat.vending.mjs';
import { nestEmpty, DUCT_LUMP, LUMP_PATH, LUMP_STUCK, lumpV } from '../../../art/scenes/laundromat.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const DRYER_TOP = SCREEN.hotspots.dryer_3.box[1];

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
const over = (img, ...ts) => { const o = new Image(W, H); o.c.set(img.c); for (const t of ts) o.blit(t, 0, 0); return o; };
const pixels = (t) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY) out.push([x, y, t.get(x, y)]); return out; };
const same = (a, b) => a.c.every((v, i) => v === b.c[i]);
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.c.length; i++) if (a.c[i] !== b.c[i]) n++; return n; };

const bg = base();
const stuck = layer((t) => lumpV(t, LUMP_STUCK.y));
const strain = layer((t) => lumpV(t, LUMP_STUCK.y, { strain: true }));
const anims = Object.fromEntries(Object.entries(DUCT_LUMP).map(([k, a]) => [k, a.frames.map(layer)]));

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
check(DUCT.x === 360 && DUCT.w === 14 && DUCT.runY === 52 && DUCT.runH === 12 && DUCT.endX === 92 && DUCT.bottom === DRYER_TOP,
  `혹 덕트 값 = 방 껍데기 DUCT(x ${DUCT.x}, w ${DUCT.w}, runY ${DUCT.runY}, runH ${DUCT.runH}, endX ${DUCT.endX}, bottom ${DUCT.bottom} = 건조기 위 ${DRYER_TOP})`);
{
  const [bx, by, bw, bh] = SCREEN.hotspots.duct.box;
  const [rx, ry] = SCREEN.hotspots.duct.reachPoint;
  for (const [name, t] of Object.entries({ stuck, strain })) {
    const out = pixels(t).filter(([x, y]) => x < bx || x >= bx + bw || y < by || y >= by + bh);
    check(out.length === 0, `${name}: 그린 픽셀 전부 duct 핫스팟 ${bx},${by} ${bw}×${bh} 안 (밖 ${out.length})`);
  }
  check(rx === LUMP_STUCK.x && ry === LUMP_STUCK.y, `걸린 혹 가운데 ${LUMP_STUCK.x},${LUMP_STUCK.y} = reachPoint ${rx},${ry}`);
}
for (const [k, fs] of Object.entries(anims)) {
  const low = fs.reduce((n, t) => n + pixels(t).filter(([, y]) => y >= DRYER_TOP).length, 0);
  const emptyAt = fs.findIndex((t) => pixels(t).length === 0);
  check(low === 0, `${k}: 건조기 위 끝 ${DRYER_TOP} 아래 픽셀 ${low} = 0`);
  check(emptyAt < 0, `${k}: 빈 칸 없음${emptyAt < 0 ? '' : ` (${emptyAt}번 칸이 비었다)`}`);
}
{
  const hangers = [150, 236, 316];
  const fs = anims.lump_travel.slice(0, LUMP_PATH.h.length);
  const ys = fs.flatMap((t) => pixels(t).map(([, y]) => y));
  const xs = fs.flatMap((t) => pixels(t).map(([x]) => x));
  check(Math.min(...ys) >= DUCT.runY - 4 && Math.max(...ys) <= DUCT.runY + DUCT.runH + 3, `가로 칸 y ${Math.min(...ys)}~${Math.max(...ys)}: 가로 구간 위아래 4px 안`);
  check(Math.min(...xs) > DUCT.endX + 4, `가로 칸 왼쪽 끝 x ${Math.min(...xs)} > 판자 구멍 ${DUCT.endX + 4}`);
  check(fs.every((t) => pixels(t).every(([x, y]) => !hangers.includes(x) || y >= DUCT.runY - 1)), '가로 칸이 걸이 줄(x 150·236·316)을 관 위에서 안 덮는다');
}
{
  const inside = (x, y) => (y >= DUCT.runY && y < DUCT.runY + DUCT.runH && x >= DUCT.endX && x < DUCT.x + DUCT.w) || (x >= DUCT.x && x < DUCT.x + DUCT.w && y >= DUCT.runY && y < DUCT.bottom);
  let edgeBad = 0, inkInside = 0;
  for (const t of [...anims.lump_travel, strain]) {
    for (const [x, y, c] of pixels(t)) {
      if (inside(x, y) && c === C.ink) inkInside++;
      const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]);
      if (c !== C.ink && n4.some(([nx, ny]) => t.get(nx, ny) === EMPTY && !inside(nx, ny) && ny < DUCT.bottom)) edgeBad++;
    }
  }
  check(edgeBad === 0, `혹이 벽에 닿는 테두리 ink 아닌 픽셀 ${edgeBad} = 0`);
  check(inkInside === 0, `관 안쪽 ink 픽셀 ${inkInside} = 0 (관과 이어지는 끝에 세로 ink 줄 없음)`);
}
{
  const d0 = diff(bg, over(bg, stuck)), d1 = diff(over(bg, stuck), over(bg, strain));
  check(d0 >= 120, `혹 없음 ↔ 걸린 혹 다른 픽셀 ${d0} ≥ 120`);
  check(d1 >= 40, `멈춘 모습 ↔ 끙끙 다른 픽셀 ${d1} ≥ 40`);
  check(Math.abs(Y[C.lint] - Y[C.cotton]) >= 30, `혹 몸 lint(Y${Y[C.lint]}) vs 벽 cotton(Y${Y[C.cotton]}): 차 ${Math.abs(Y[C.lint] - Y[C.cotton])}, 테두리 ink(Y${Y[C.ink]})가 가른다`);
}
{
  const { lump_travel: tr, lump_back: bk, stuck: st, lump_pop: pop } = anims;
  const firstH = layer((t) => DUCT_LUMP.lump_travel.frames[0](t));
  check(same(tr[0], firstH) && pixels(tr[0]).every(([x]) => x < 140), 'lump_travel: 첫 칸 = 창 쪽 판자 앞 가로 자리');
  check(same(tr.at(-1), stuck) && same(st[0], stuck), 'lump_travel: 마지막 칸 = 걸린 멈춘 모습 = stuck 첫 칸');
  check(bk.length === tr.length && bk.every((t, i) => same(t, tr[tr.length - 1 - i])), 'lump_back: lump_travel 칸 거꾸로(0칸)');
  check(same(st[1], strain), 'stuck: 둘째 칸 = 끙끙');
  check(same(pop[0], strain), 'lump_pop: 첫 칸 = 끙끙(쿡에 한 번 더 끙), 같은 자리라 안 튄다');
  const ms = DUCT_LUMP.lump_travel.ms;
  check(ms[0] >= 160, `lump_travel 첫 칸 ${ms[0]}ms ≥ 160 (창 쪽 머묾, PR #900 재리뷰 1)`);
  check(ms.at(-1) >= 80 && ms.at(-1) <= 120, `lump_travel 마지막 칸 ${ms.at(-1)}ms 80~120 (덜컥 → 깃털 한 박자, 재리뷰 2)`);
  check(ms.slice(1, -1).every((m) => m === 80), 'lump_travel 가운데 칸 80ms(E2)');
  for (const [k, a] of Object.entries(DUCT_LUMP)) check(a.ms.length === a.frames.length, `${k}: 칸 ${a.frames.length}개 = 시간 ${a.ms.length}개`);
  for (const k of ['lump_travel', 'lump_back', 'lump_pop']) { const s = DUCT_LUMP[k].ms.reduce((a, b) => a + b, 0); check(s <= 1500, `${k}: 칸 시간 합 ${s}ms ≤ 1500`); }
}

// ── 출력
const cropper = (R) => (img) => { const c = new Image(R.w, R.h); for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) c.set(x, y, img.get(R.x + x, R.y + y)); return c; };
const near = cropper({ x: 339, y: 104, w: 56, h: 64 });
const shots = [bg, over(bg, stuck), over(bg, strain)].map(near);
const strip = new Image(shots.length * 58 - 2, 64, C.white);
shots.forEach((s, i) => strip.blit(s, i * 58, 0));
writeFileSync(join(HERE, 'laundromat-duct-lump-4x.png'), indexedPng(strip, 4));
{
  const S = 4, w = strip.w * S, h = strip.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = strip.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 255 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'laundromat-duct-lump-gray-4x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
const wide = cropper({ x: 86, y: 38, w: 308, h: 132 });
writeFileSync(join(HERE, 'laundromat-duct-lump-path-2x.png'), indexedPng(wide(over(bg, ...anims.lump_travel)), 2));
{
  const seq = [{ img: wide(bg), ms: 600 }];
  const add = (k) => anims[k].forEach((t, i) => seq.push({ img: wide(over(bg, t)), ms: DUCT_LUMP[k].ms[i] }));
  add('lump_travel'); add('stuck'); add('stuck'); add('lump_back');
  seq.push({ img: wide(bg), ms: 500 });
  add('lump_travel'); add('stuck'); add('lump_pop');
  seq.push({ img: wide(bg), ms: 600 });
  writeFileSync(join(HERE, 'laundromat-duct-lump-anim-2x.png'), animatedPng(seq, 2));
}
const blind = new Image(W * 2 + 4, H, C.white);
blind.blit(bg, 0, 0);
blind.blit(over(bg, stuck), W + 4, 0);
writeFileSync(join(HERE, 'laundromat-duct-lump-blind-1x.png'), indexedPng(blind, 1));

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
