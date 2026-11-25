// 스테이지 3 `laundromat` O3 부리에 문 열쇠 1칸(`magpie.beak_suck` 첫 칸, 설계 laundromat.md 4절 3-2, 9-2 O3) 미리보기·검사 (#764).
// PR #932 Theo 리뷰: 커밋된 정답 길(쿵 → プピッ → 쿡)은 3-2 길이라 `key_in`이 없다. 앉음 칸만 재사용하면 이 길에서
// "까치가 열쇠를 가졌다"가 한 번도 안 보여서, smug 앉음에 O2 고리를 매단 합성 칸 하나를 더한다(손그림은 이 두 줄뿐).
// 아직 빌드에 안 붙였다(물건 시트 PR에서 `MAGPIE_SIT.beak_suck`을 시트에 굽는다).
// 실행: node docs/design/screens/laundromat-beak-suck-preview.mjs
// 출력(같은 폴더):
//   laundromat-beak-suck-4x.png       들창 둘레 64×60. 빈 둥지 위 smug → 부리에 문 열쇠 → 빈 부리 smug, 4배
//   laundromat-beak-suck-gray-4x.png  같은 줄 명도(흑백, ADR-0007 결정 3-6)
//   laundromat-beak-suck-anim-4x.png  3-2 순서(`gap.snatch` 빈 틈 뒤) smug 대기 → beak_suck → 빈 부리 멍, APNG 4배
// 검사(어기면 종료 코드 1):
//   - 열쇠 픽셀이 전부 들창 왼쪽 칸 안 + `magpie` 핫스팟 안, 둥지 윗줄(y 43)보다 위, 빈 둥지 픽셀과 겹침 0
//   - 금색(yelL·yel·yelD) ≥ 20px, 금색 테가 부리(ink·lav)에 맞닿음(물고 있다)
//   - 까치 픽셀은 smug와 똑같다(합성 칸: 새 손그림은 열쇠뿐)
//   - 금색 vs 뒤 하늘 명도 차 ≥ 30
//   - 첫 칸 ≠ smug(≥ 20px 다름), 마지막 칸 = smug(형식 4-2 (a)), 칸 시간 합 ≤ 1500

import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { room, W, H, TRANSOM } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending } from '../../../art/scenes/laundromat.vending.mjs';
import { nestEmpty, magpieSit, magpieSitKey, MAGPIE_SIT, NEST } from '../../../art/scenes/laundromat.objects.mjs';

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
const smug = layer((t) => magpieSit(t, 'smug'));
const withKey = layer(magpieSitKey);
const keyPx = pixels(withKey).filter(([x, y]) => smug.get(x, y) === EMPTY); // 까치 밖에 보이는 열쇠(외곽선 포함)
const GOLD = [C.yelL, C.yel, C.yelD];

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const { paneL, inY, inH } = TRANSOM;
const [hx, hy, hw, hh] = SCREEN.hotspots.magpie.box;
{
  const out = keyPx.filter(([x, y]) => x < paneL.x || x >= paneL.x + paneL.w || y < inY || y >= inY + inH || x < hx || x >= hx + hw || y < hy || y >= hy + hh);
  check(out.length === 0, `열쇠 ${keyPx.length}px 전부 들창 왼쪽 칸 + magpie 핫스팟 안 (밖 ${out.length})`);
  const low = Math.max(...keyPx.map(([, y]) => y));
  check(low < NEST.y, `열쇠 아래 끝 y ${low} < 둥지 윗줄 ${NEST.y}`);
  const hit = keyPx.filter(([x, y]) => empty.get(x, y) !== EMPTY).length;
  check(hit === 0, `빈 둥지 픽셀과 겹침 ${hit} = 0`);
}
{
  const gold = keyPx.filter(([, , c]) => GOLD.includes(c));
  check(gold.length >= 20, `금색 ${gold.length}px ≥ 20`);
  const beak = new Set([C.ink, C.lav]);
  const touch = gold.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => beak.has(smug.get(x + a, y + b))));
  check(touch, '금색 테가 부리 ink·lav에 맞닿음(물고 있다)');
  const sky = new Set(gold.map(([x, y]) => bg.get(x, y)));
  const worst = Math.min(...[...sky].flatMap((s) => GOLD.map((g) => Math.abs(Y[g] - Y[s]))));
  check(worst >= 30, `금색 vs 뒤 하늘 최소 명도 차 ${worst} ≥ 30 (뒤 색 ${[...sky].map((c) => `#${c}`).join(' ')})`);
}
{
  const changed = pixels(smug).filter(([x, y, c]) => withKey.get(x, y) !== c).length;
  check(changed === 0, `까치 픽셀이 smug와 같다(다른 ${changed})`);
  let diff = 0;
  for (let i = 0; i < smug.c.length; i++) if (smug.c[i] !== withKey.c[i]) diff++;
  check(diff >= 20, `smug ↔ 부리에 문 열쇠 다른 픽셀 ${diff} ≥ 20`);
}
{
  const a = MAGPIE_SIT.beak_suck, fr = a.frames.map(layer);
  check(same(fr[0], withKey) && same(fr.at(-1), smug), 'beak_suck: 첫 칸 = 부리에 문 열쇠, 마지막 칸 = 빈 부리 smug');
  check(a.ms.length === a.frames.length, `beak_suck: 칸 ${a.frames.length}개 = 시간 ${a.ms.length}개`);
  const s = a.ms.reduce((x, y) => x + y, 0);
  check(s <= 1500, `beak_suck: 칸 시간 합 ${s}ms ≤ 1500`);
}

// ── 출력 (3-2 둥지는 늘 비어 있다)
const CROP = { x: 54, y: 18, w: 64, h: 60 };
const crop = (img) => { const c = new Image(CROP.w, CROP.h); for (let y = 0; y < CROP.h; y++) for (let x = 0; x < CROP.w; x++) c.set(x, y, img.get(CROP.x + x, CROP.y + y)); return c; };
const shots = [smug, withKey, smug].map((m) => crop(over(bg, empty, m)));
const strip = new Image(shots.length * (CROP.w + 2) - 2, CROP.h, C.white);
shots.forEach((s, i) => strip.blit(s, i * (CROP.w + 2), 0));
writeFileSync(join(HERE, 'laundromat-beak-suck-4x.png'), indexedPng(strip, 4));
{
  const S = 4, w = strip.w * S, h = strip.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = strip.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 255 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'laundromat-beak-suck-gray-4x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
{
  const seq = [{ img: crop(over(bg, empty, smug)), ms: 500 }];
  MAGPIE_SIT.beak_suck.frames.forEach((fr, i) => seq.push({ img: crop(over(bg, empty, layer(fr))), ms: MAGPIE_SIT.beak_suck.ms[i] }));
  seq.push({ img: crop(over(bg, empty, smug)), ms: 700 });
  writeFileSync(join(HERE, 'laundromat-beak-suck-anim-4x.png'), animatedPng(seq, 4));
}

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
