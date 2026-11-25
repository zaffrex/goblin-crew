// 스테이지 3 `laundromat` O3 앉은 까치 + 내려다보기 1칸(`MAGPIE_SIT`, 설계 laundromat.md 4절 5-1·8, 9-2 O3) 미리보기·검사 (#764).
// 아직 빌드에 안 붙였다. 설계 9-3: 단서 칸은 빌드에 붙이기 전에 1배 그림 블라인드("무엇이 달라졌나")를 먼저 본다.
// 가림 검사는 PR #920 Theo 요청대로 이 화면 앉은 까치 포즈 전부(smug·flick·puff·peek) + 좌우 뒤집은 것(snub)까지 본다.
// 실행: node docs/design/screens/laundromat-magpie-peek-preview.mjs
// 출력(같은 폴더):
//   laundromat-magpie-peek-4x.png        들창 둘레 64×60. 윗줄 빈 둥지 smug → peek → 뒤집은 peek, 아랫줄 열쇠 든 둥지 같은 셋, 4배
//   laundromat-magpie-peek-gray-4x.png   같은 그림 명도(흑백, ADR-0007 결정 3-6)
//   laundromat-magpie-peek-anim-4x.png   대기 반복 한 바퀴 → peek, APNG 4배
//   laundromat-magpie-peek-blind-1x.png  블라인드용 1배 두 장(왼쪽 smug, 오른쪽 peek, 둘 다 빈 둥지). 글·표시 없음
// 검사(어기면 종료 코드 1):
//   - 포즈 4 × 뒤집기 2 = 8장 모두 그린 픽셀이 들창 왼쪽 칸 안 + `magpie` 핫스팟 안, 발 아래 끝 y 44(둥지 윗줄)
//   - 8장 모두 까치가 둥지 위(그리는 순서 nest → magpie)여도 열쇠·패·끈·고리 외곽선을 가리는 수 0(결정 2026-11-24-laundromat-nest-key-bow-tag-magpie-sit)
//   - 열쇠 자리 비움(MAGPIE_KEY_ZONE)이 잘라 내는 픽셀: 새 칸 peek과 안 뒤집은 smug·flick은 0, 그 밖은 포즈당 ≤ 4
//   - peek 오른쪽 끝 x ≤ 78, 부리 끝이 smug보다 ≥ 10px 아래, smug ↔ peek 다른 픽셀 ≥ 40(1배에서 "달라졌다")
//   - peek 첫 칸·마지막 칸 = smug(형식 4-2 (a)), 대기 반복 첫 칸 = smug(개정 3), peek 칸 시간 합 ≤ 1500

import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { stamp } from '../../../art/lib/texture.mjs';
import { MAGPIE_LEGEND } from '../../../art/scenes/magpie_nest.objects.mjs';
import { room, W, H, TRANSOM } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending } from '../../../art/scenes/laundromat.vending.mjs';
import { nestEmpty, nestWithKey, magpieSit, MAGPIE_SIT, MAGPIE_SIT_POSES, MAGPIE_SIT_AT } from '../../../art/scenes/laundromat.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));

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
const empty = layer(nestEmpty);
const still = layer((t) => nestWithKey(t));
const POSES = Object.keys(MAGPIE_SIT_POSES);
const sits = POSES.flatMap((p) => [false, true].map((flip) => ({ name: `${p}${flip ? '(뒤집음)' : ''}`, pose: p, flip, t: layer((t) => magpieSit(t, p, { flip })) })));
const sit = (p, flip = false) => sits.find((s) => s.pose === p && s.flip === flip).t;

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const { paneL, inY, inH } = TRANSOM;
const [hx, hy, hw, hh] = SCREEN.hotspots.magpie.box;
const keyPx = pixels(still).filter(([x, y, c]) => empty.get(x, y) !== c); // 열쇠·패·끈·고리 외곽선(빈 둥지와 다른 픽셀)
{
  const bad = [];
  for (const s of sits) {
    const px = pixels(s.t);
    const out = px.filter(([x, y]) => x < paneL.x || x >= paneL.x + paneL.w || y < inY || y >= inY + inH || x < hx || x >= hx + hw || y < hy || y >= hy + hh);
    const feet = Math.max(...px.map(([, y]) => y));
    if (out.length || feet !== 44) bad.push(`${s.name} 밖 ${out.length}·발 y ${feet}`);
  }
  check(bad.length === 0, `포즈 ${POSES.length} × 뒤집기 2 = ${sits.length}장: 들창 왼쪽 칸 + magpie 핫스팟 안, 발 아래 끝 y 44 ${bad.join(', ')}`);
}
{
  const covered = (s) => keyPx.filter(([x, y]) => s.t.get(x, y) !== EMPTY).length;
  const bad = sits.map((s) => [s.name, covered(s)]).filter(([, n]) => n);
  check(bad.length === 0, `${sits.length}장 모두 까치가 둥지 위여도 열쇠·패·끈·고리 외곽선 가림 0 ${bad.map(([n, k]) => `${n} ${k}`).join(', ')}`);
  // 비움 마스크가 잘라 낸 픽셀 = 마스크 없이 찍은 수 − 찍힌 수
  const raw = (p, flip) => { const t = new Image(20, 18); stamp(t, 0, 0, MAGPIE_SIT_POSES[p], MAGPIE_LEGEND); const o = new Image(W, H); o.blit(t, MAGPIE_SIT_AT.x, MAGPIE_SIT_AT.y, flip ? { flipAx: 10 } : {}); return pixels(o).length; };
  const cut = sits.map((s) => [s, raw(s.pose, s.flip) - pixels(s.t).length]);
  console.log(`     (참고) 열쇠 자리 비움이 잘라 낸 픽셀: ${cut.map(([s, n]) => `${s.name} ${n}`).join(' · ')}`);
  const must0 = cut.filter(([s, n]) => n && !s.flip && s.pose !== 'puff');
  check(must0.length === 0 && cut.filter(([s]) => s.pose === 'peek').every(([, n]) => n === 0), '잘라 냄 0: 새 칸 peek(뒤집기 포함)·안 뒤집은 smug·flick');
  const worst = Math.max(...cut.map(([, n]) => n));
  check(worst <= 4, `잘라 냄 포즈당 최대 ${worst} ≤ 4 (puff 배 끝·뒤집은 꼬리 끝)`);
}
{
  const smug = pixels(sit('smug')), peek = pixels(sit('peek'));
  const right = Math.max(...peek.map(([x]) => x));
  check(right <= 78, `peek 오른쪽 끝 x ${right} ≤ 78 (고리 자리 79~ 비움)`);
  const tip = (px) => { const b = px.filter(([, , c]) => c === C.lav); return Math.max(...b.map(([, y]) => y)); };
  check(tip(peek) - tip(smug) >= 10, `부리 빛(lav) 아래 끝 smug y ${tip(smug)} → peek y ${tip(peek)} (≥ 10px 아래)`);
  const a = sit('smug'), b = sit('peek');
  let diff = 0;
  for (let i = 0; i < a.c.length; i++) if (a.c[i] !== b.c[i]) diff++;
  check(diff >= 40, `smug ↔ peek 다른 픽셀 ${diff} ≥ 40`);
  const sky = new Set(pixels(sit('peek')).map(([x, y]) => bg.get(x, y)));
  const worst = Math.min(...[...sky].map((c) => dY(C.ink, c)));
  check(worst >= 30, `peek 몸 ink vs 뒤 배경(하늘·후드·창살) 최소 명도 차 ${worst} ≥ 30`);
}
{
  const f = (a) => a.frames.map(layer);
  const pk = f(MAGPIE_SIT.peek), lp = f(MAGPIE_SIT.loop);
  check(same(pk[0], sit('smug')) && same(pk.at(-1), sit('smug')) && same(pk[1], sit('peek')), 'peek: 첫 칸·마지막 칸 = smug, 가운데 = 내려다보기');
  check(same(lp[0], sit('smug')), '대기 반복: 첫 칸 = 멈춘 모습 smug');
  for (const k of ['peek', 'loop']) check(MAGPIE_SIT[k].ms.length === MAGPIE_SIT[k].frames.length, `${k}: 칸 ${MAGPIE_SIT[k].frames.length}개 = 시간 ${MAGPIE_SIT[k].ms.length}개`);
  const s = MAGPIE_SIT.peek.ms.reduce((x, y) => x + y, 0);
  check(s <= 1500, `peek: 칸 시간 합 ${s}ms ≤ 1500`);
}

// ── 출력 (그리는 순서 nest → magpie: 까치가 둥지 위)
const CROP = { x: 54, y: 18, w: 64, h: 60 };
const crop = (img) => { const c = new Image(CROP.w, CROP.h); for (let y = 0; y < CROP.h; y++) for (let x = 0; x < CROP.w; x++) c.set(x, y, img.get(CROP.x + x, CROP.y + y)); return c; };
const row = [['smug', false], ['peek', false], ['peek', true]];
const strip = new Image(row.length * (CROP.w + 2) - 2, CROP.h * 2 + 2, C.white);
[empty, still].forEach((nest, j) => row.forEach(([p, flip], i) => strip.blit(crop(over(bg, nest, sit(p, flip))), i * (CROP.w + 2), j * (CROP.h + 2))));
writeFileSync(join(HERE, 'laundromat-magpie-peek-4x.png'), indexedPng(strip, 4));
{
  const S = 4, w = strip.w * S, h = strip.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = strip.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 255 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'laundromat-magpie-peek-gray-4x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
{
  const seq = [];
  const add = (a) => a.frames.forEach((fr, i) => seq.push({ img: crop(over(bg, empty, layer(fr))), ms: a.ms[i] }));
  add(MAGPIE_SIT.loop); add(MAGPIE_SIT.peek);
  seq.push({ img: crop(over(bg, empty, sit('smug'))), ms: 600 });
  writeFileSync(join(HERE, 'laundromat-magpie-peek-anim-4x.png'), animatedPng(seq, 4));
}
const blind = new Image(W * 2 + 4, H, C.white);
blind.blit(over(bg, empty, sit('smug')), 0, 0);
blind.blit(over(bg, empty, sit('peek')), W + 4, 0);
writeFileSync(join(HERE, 'laundromat-magpie-peek-blind-1x.png'), indexedPng(blind, 1));

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
