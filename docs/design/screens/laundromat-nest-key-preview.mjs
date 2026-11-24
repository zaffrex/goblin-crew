// 스테이지 3 `laundromat` O2 열쇠 든 둥지·반짝 2칸(`NEST_KEY`, 설계 laundromat.md 4절 3-1·1-2·2-2, 9-2 O2) 미리보기·검사 (#764).
// 아직 빌드에 안 붙였다. 설계 9-3: 단서 칸은 빌드에 붙이기 전에 1배 그림 블라인드("무엇이 달라졌나")를 먼저 본다.
// 앉은 까치는 이 화면 그림이 아직 없어서(O3 앉음은 다음 PR) magpie_nest `smug` 포즈를 가정 자리 SIT_AT에 찍어 가림만 본다.
// 실행: node docs/design/screens/laundromat-nest-key-preview.mjs
// 출력(같은 폴더):
//   laundromat-nest-key-4x.png        들창 둘레 64×60, 빈 둥지 → 열쇠 든 둥지 → 반짝(앉은 까치 포함), 4배
//   laundromat-nest-key-gray-4x.png   같은 줄 명도(흑백, ADR-0007 결정 3-6)
//   laundromat-nest-key-anim-4x.png   key_in → 대기 반짝 두 바퀴 → key_out, APNG 4배
//   laundromat-nest-key-blind-1x.png  블라인드용 1배 두 장(왼쪽 빈 둥지, 오른쪽 열쇠 든 둥지 멈춘 모습, 둘 다 앉은 까치). 글·표시 없음
// 검사(어기면 종료 코드 1):
//   - 그린 픽셀 전부 들창 왼쪽 칸 안(x 60~85, y 24~71) = `magpie` 핫스팟 안
//   - 앉은 까치를 얹어도 금색 고리 ≥ 12px, 나무 패 밝은 면(tan·woodL) ≥ 18px가 보인다(까치가 단서를 안 가린다)
//   - 고리 금색과 뒤 하늘(purD·pur), 패 woodL과 둥지 wood 명도 차 ≥ 30
//   - 빈 둥지와 열쇠 든 둥지가 다른 픽셀 ≥ 40(1배에서 "달라졌다"가 보일 크기)
//   - key_in 첫 칸 = 빈 둥지, 마지막 칸 = 열쇠 든 둥지 / key_out 반대(형식 4-2 (a)). 대기 반복 첫 칸 = 멈춘 모습(개정 3)
//   - key_in·key_out 칸 시간 합 ≤ 1500(형식 기록 8절)

import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { stamp } from '../../../art/lib/texture.mjs';
import { room, W, H, TRANSOM } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending } from '../../../art/scenes/laundromat.vending.mjs';
import { nestEmpty, nestWithKey, NEST_KEY } from '../../../art/scenes/laundromat.objects.mjs';
import { MAGPIE, MAGPIE_LEGEND } from '../../../art/scenes/magpie_nest.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
/** 앉은 까치 가정 자리(20×18, 60~79 × 27~44): 발 아래 끝 y 44 = 둥지 윗줄, 배 오른쪽 끝 x 78. O3 앉음 PR이 이 자리를 지켜야 고리가 안 가려진다 */
const SIT_AT = [60, 27];

function base() {
  const img = new Image(W, H);
  room(img);
  ['open', 'load', 'empty', 'load'].forEach((door, i) => washer(img, 176 + i * 40 + 1, 180, { n: i + 1, door }));
  shutter(img, 'locked');
  dryer(img, SCREEN.hotspots.dryer_3.box[0], SCREEN.hotspots.dryer_3.box[1]);
  vending(img, SCREEN.hotspots.soap_vending.box[0], SCREEN.hotspots.soap_vending.box[1]);
  return img;
}
const layer = (draw) => { const t = new Image(W, H); draw(t); return t; };
const over = (img, ...ts) => { const o = new Image(W, H); o.c.set(img.c); for (const t of ts) o.blit(t, 0, 0); return o; };
const pixels = (t) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY) out.push([x, y, t.get(x, y)]); return out; };
const same = (a, b) => a.c.every((v, i) => v === b.c[i]);

const bg = base();
const sit = layer((t) => stamp(t, SIT_AT[0], SIT_AT[1], MAGPIE.smug, MAGPIE_LEGEND));
const empty = layer(nestEmpty);
const still = layer((t) => nestWithKey(t));
const shine = layer((t) => nestWithKey(t, { shine: true }));

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const { paneL, inY, inH } = TRANSOM;
const [hx, hy, hw, hh] = SCREEN.hotspots.magpie.box;
for (const [name, t] of Object.entries({ empty, still, shine, sit })) {
  const out = pixels(t).filter(([x, y]) => x < paneL.x || x >= paneL.x + paneL.w || y < inY || y >= inY + inH || x < hx || x >= hx + hw || y < hy || y >= hy + hh);
  check(out.length === 0, `${name}: 그린 픽셀 전부 들창 왼쪽 칸 안 + magpie 핫스팟 안 (밖 ${out.length})`);
}
{
  const seen = over(new Image(W, H), still, sit);
  let gold = 0, tag = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = seen.get(x, y);
    if (sit.get(x, y) !== EMPTY) continue;
    if (c === C.yel || c === C.yelL) gold++;
    if ((c === C.woodL || c === C.tan) && y >= 46 && y <= 51 && x >= 70 && x <= 78) tag++;
  }
  check(gold >= 12, `앉은 까치를 얹어도 금색 고리 ${gold}px ≥ 12`);
  check(tag >= 18, `앉은 까치를 얹어도 나무 패 밝은 면 ${tag}px ≥ 18`);
  const sitOverKey = pixels(sit).filter(([x, y]) => still.get(x, y) !== empty.get(x, y)).length;
  check(sitOverKey === 0, `앉은 까치가 열쇠·패·끈 픽셀을 가리는 수 ${sitOverKey} = 0`);
}
{
  const sky = new Map();
  for (const [x, y, c] of pixels(still)) if ((c === C.yel || c === C.yelL) && empty.get(x, y) === EMPTY) { const b = bg.get(x, y); sky.set(b, (sky.get(b) ?? 0) + 1); }
  const worst = Math.min(...[...sky.keys()].map((b) => Math.min(dY(C.yel, b), dY(C.yelL, b))));
  check(worst >= 30, `고리 금색 vs 뒤 하늘 ${[...sky.keys()].map((b) => `#${b}(Y${Y[b]})`).join('·')} 최소 차 ${worst} ≥ 30`);
  check(dY(C.woodL, C.wood) >= 30, `패 woodL(Y${Y[C.woodL]}) vs 둥지 wood(Y${Y[C.wood]}) 차 ${dY(C.woodL, C.wood)} ≥ 30`);
}
{
  const diff = pixels(still).filter(([x, y, c]) => empty.get(x, y) !== c).length + pixels(empty).filter(([x, y]) => still.get(x, y) === EMPTY).length;
  check(diff >= 40, `빈 둥지 ↔ 열쇠 든 둥지 다른 픽셀 ${diff} ≥ 40`);
}
{
  const f = (a) => a.frames.map(layer);
  const kin = f(NEST_KEY.key_in), kout = f(NEST_KEY.key_out), lp = f(NEST_KEY.loop);
  check(same(kin[0], empty) && same(kin.at(-1), still), 'key_in: 첫 칸 = 빈 둥지, 마지막 칸 = 열쇠 든 둥지');
  check(same(kout[0], still) && same(kout.at(-1), empty), 'key_out: 첫 칸 = 열쇠 든 둥지, 마지막 칸 = 빈 둥지');
  check(same(lp[0], still) && same(lp[1], shine), '대기 반복: 첫 칸 = 멈춘 모습, 둘째 칸 = 반짝');
  for (const k of ['key_in', 'key_out', 'loop']) check(NEST_KEY[k].ms.length === NEST_KEY[k].frames.length, `${k}: 칸 ${NEST_KEY[k].frames.length}개 = 시간 ${NEST_KEY[k].ms.length}개`);
  for (const k of ['key_in', 'key_out']) { const s = NEST_KEY[k].ms.reduce((a, b) => a + b, 0); check(s <= 1500, `${k}: 칸 시간 합 ${s}ms ≤ 1500`); }
}

// ── 출력
const CROP = { x: 54, y: 18, w: 64, h: 60 };
const crop = (img) => { const c = new Image(CROP.w, CROP.h); for (let y = 0; y < CROP.h; y++) for (let x = 0; x < CROP.w; x++) c.set(x, y, img.get(CROP.x + x, CROP.y + y)); return c; };
const shots = [empty, still, shine].map((t) => crop(over(bg, t, sit)));
const strip = new Image(shots.length * (CROP.w + 2) - 2, CROP.h, C.white);
shots.forEach((s, i) => strip.blit(s, i * (CROP.w + 2), 0));
writeFileSync(join(HERE, 'laundromat-nest-key-4x.png'), indexedPng(strip, 4));
{
  const S = 4, w = strip.w * S, h = strip.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = strip.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 255 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'laundromat-nest-key-gray-4x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
{
  const seq = [];
  const add = (a) => a.frames.forEach((fr, i) => seq.push({ img: crop(over(bg, layer(fr), sit)), ms: a.ms[i] }));
  seq.push({ img: crop(over(bg, empty, sit)), ms: 600 });
  add(NEST_KEY.key_in); add(NEST_KEY.loop); add(NEST_KEY.loop); add(NEST_KEY.key_out);
  seq.push({ img: crop(over(bg, empty, sit)), ms: 600 });
  writeFileSync(join(HERE, 'laundromat-nest-key-anim-4x.png'), animatedPng(seq, 4));
}
const blind = new Image(W * 2 + 4, H, C.white);
blind.blit(over(bg, empty, sit), 0, 0);
blind.blit(over(bg, still, sit), W + 4, 0);
writeFileSync(join(HERE, 'laundromat-nest-key-blind-1x.png'), indexedPng(blind, 1));

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
