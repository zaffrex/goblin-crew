// 빨래방 v2 N8 미리보기·검사 (#1031·#1067, laundromat-v2.md 9-2절). 원본: art/scenes/laundromat.gap-towel.mjs
// 실행: node docs/design/screens/laundromat-v2-gap-preview.mjs
// 출력(같은 폴더):
//   laundromat-v2-gap-4x.png       틈 둘레 80×44 네 모습(지금 열쇠만 / slip 마른 수건 들뜸 / cover 젖은 수건 덮음 / back 빈 수건 돌아옴) 4배
//   laundromat-v2-blind-n8-1x.png  블라인드용: 진짜 배경 + 잠긴 셔터 + 열쇠 위에 왼쪽 slip, 오른쪽 back 두 장(1배, 글·표시 없음).
//                                  캡션 없이 "수건이 왜 빈손으로 왔나"를 묻는다(9-2절 그림 블라인드). 쭉이는 안 그린다(N1·N5 블라인드와 같음)
//   laundromat-v2-blind-n8-3x.png  같은 두 장의 셔터 둘레를 3배로 자른 것(리뷰용, 블라인드에는 안 씀)
//   laundromat-v2-gap-gray-4x.png  4배 네 모습의 명도(흑백) (ADR-0007 결정 3-6)
// 검사(어기면 종료 코드 1):
//   - 세 자리 모두 셔터 판 뒤(판 아래 끝보다 위) 픽셀을 안 그린다
//   - slip·cover는 `gap` 핫스팟(80,222 40×24) 안에만 그린다
//   - slip: 열쇠 금색 픽셀이 절반 이상 보이고(위 2~3줄은 틈이 낮아 수건에 가린다), 아치 꼭대기 열에서 수건 아래 끝과 가게 바닥 사이에 길바닥 줄이 4줄 이상 비친다(들떴다)
//   - cover: 열쇠 금색·나무 패 픽셀이 하나도 안 보인다(다 덮었다)
//   - back: 수건이 가게 바닥(y ≥ 244)에만 있고, 열쇠와 가로 18px 이상 떨어지고, 열쇠는 하나도 안 가려진다(빈손)
//   - 명도: 마른 수건 tealL vs 길바닥 dusk·건너편 길 purD·가게 바닥 woodL ≥ 30, 젖은 수건 teal vs 가게 바닥 woodL·마른 수건 tealL ≥ 30

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { shutter, SHUTTER } from '../../../art/scenes/laundromat.shutter.mjs';
import { keyTag, KEY_ON_STREET } from '../../../art/scenes/laundromat.objects.mjs';
import { gapTowel, gapVisible, GAP_TOWEL_POSE } from '../../../art/scenes/laundromat.gap-towel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const BOTTOM = SHUTTER.y + SHUTTER.h;

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
const diffPixels = (before, after) => { const out = []; for (let y = 0; y < after.h; y++) for (let x = 0; x < after.w; x++) if (before.get(x, y) !== after.get(x, y)) out.push([x, y, after.get(x, y)]); return out; };

// 진짜 배경 + 잠긴 셔터 + 길바닥 열쇠(지금 판 시작 그림과 같은 순서)
const bg = readIndexedPng(join(ROOT, 'public/scenes/laundromat-bg.png'));
const base = new Image(bg.w, bg.h);
base.blit(bg, 0, 0);
shutter(base, 'locked');
keyTag(base, KEY_ON_STREET.x, KEY_ON_STREET.y);
const withTowel = (pose) => { const s = new Image(base.w, base.h); s.blit(base, 0, 0); gapTowel(s, pose); return s; };
const shots = Object.fromEntries(Object.entries(GAP_TOWEL_POSE).map(([k, p]) => [k, withTowel(p)]));

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const GOLD = new Set([C.yelL, C.yel, C.yelD]);
const WOOD = new Set([C.tan, C.woodL, C.wood]);
const keyPx = (() => { const t = new Image(base.w, base.h); keyTag(t, KEY_ON_STREET.x, KEY_ON_STREET.y); const o = []; for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.get(x, y) !== EMPTY) o.push([x, y, t.get(x, y)]); return o; })();
const goldPx = keyPx.filter(([, , c]) => GOLD.has(c));
const platePx = keyPx.filter(([, , c]) => WOOD.has(c));
const shown = (img, px) => px.filter(([x, y, c]) => img.get(x, y) === c).length;
const [gx, gy, gw, gh] = SCREEN.hotspots.gap.box;
const inGap = ([x, y]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh;

for (const [name, img] of Object.entries(shots)) {
  const d = diffPixels(base, img);
  const hidden = d.filter(([x, y]) => !gapVisible(x, y));
  check(d.length > 0 && hidden.length === 0, `${name}: 바뀐 ${d.length}px 중 셔터 판 뒤 픽셀 ${hidden.length}개(0)`);
  if (name !== 'back') check(d.every(inGap), `${name}: gap 핫스팟(${gx},${gy} ${gw}×${gh}) 안 (밖 ${d.filter((p) => !inGap(p)).length})`);
}
{
  const g = shown(shots.slip, goldPx);
  check(g / goldPx.length >= 0.5, `slip: 열쇠 금색 ${g}/${goldPx.length}px(${Math.round((g / goldPx.length) * 100)}%) 보임 ≥ 50% (아치 밑으로 열쇠가 보인다)`);
  // 아치 꼭대기 열(띠 열 17~25)에서 수건 아래 끝 바로 밑부터 바닥 선(243)까지 수건이 아닌 줄 수
  const towelOnly = diffPixels(base, shots.slip);
  const under = [];
  for (let col = 17; col <= 25; col++) {
    const x = GAP_TOWEL_POSE.slip.x + col;
    const ys = towelOnly.filter(([px]) => px === x).map(([, y]) => y);
    if (ys.length) under.push(BOTTOM - 1 - Math.max(...ys));
  }
  const minUnder = Math.min(...under);
  check(under.length === 9 && minUnder >= 4, `slip: 아치 꼭대기 9열에서 수건 밑으로 비치는 줄 최소 ${minUnder} ≥ 4 (들떴다)`);
}
{
  const g = shown(shots.cover, goldPx), w = shown(shots.cover, platePx);
  check(g === 0 && w === 0, `cover: 열쇠 금색 ${g}px·나무 패 ${w}px 보임 (둘 다 0, 다 덮었다)`);
}
{
  const d = diffPixels(base, shots.back);
  check(d.every(([, y]) => y >= BOTTOM), `back: 수건 ${d.length}px이 전부 가게 바닥(y ≥ ${BOTTOM}) 위`);
  const right = Math.max(...d.map(([x]) => x));
  check(KEY_ON_STREET.x - right >= 18, `back: 수건 오른쪽 끝 x ${right}이 열쇠(x ${KEY_ON_STREET.x})와 ${KEY_ON_STREET.x - right}px 떨어짐 ≥ 18 (붙어 있으면 "끌어왔다"로 읽힘, 블라인드 1회차)`);
  check(shown(shots.back, keyPx) === keyPx.length, `back: 열쇠 ${keyPx.length}px 하나도 안 가려짐(빈손)`);
}
for (const [name, c] of [['길바닥 dusk', C.dusk], ['건너편 길 purD', C.purD], ['가게 바닥 woodL', C.woodL]]) check(dY(C.tealL, c) >= 30, `마른 수건 tealL(Y${Y[C.tealL]}) vs ${name}(Y${Y[c]}) 차 ${dY(C.tealL, c)} ≥ 30`);
for (const [name, c] of [['가게 바닥 woodL', C.woodL], ['마른 수건 tealL', C.tealL]]) check(dY(C.teal, c) >= 30, `젖은 수건 teal(Y${Y[C.teal]}) vs ${name}(Y${Y[c]}) 차 ${dY(C.teal, c)} ≥ 30`);
console.log(`참고(검사 아님): 젖은 수건 teal(Y${Y[C.teal]}) vs 길바닥 dusk(Y${Y[C.dusk]}) 차 ${dY(C.teal, C.dusk)}. 색상(청록 ↔ 보라 회색)과 ink 외곽선으로만 갈린다`);
console.log(`새 칸: N8 1칸(slip ${diffPixels(base, shots.slip).length}px, back ${diffPixels(base, shots.back).length}px, cover ${diffPixels(base, shots.cover).length}px은 같은 띠의 자리·들뜸·색)`);

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
const AREA = { x: 60, y: 214, w: 80, h: 44 }, SEP = 4;
const strip = new Image(AREA.w * 4 + SEP * 3, AREA.h);
[base, shots.slip, shots.cover, shots.back].forEach((img, i) => strip.blit(crop(img, AREA.x, AREA.y, AREA.w, AREA.h), i * (AREA.w + SEP), 0));
const blind = new Image(base.w * 2 + SEP, base.h);
blind.blit(shots.slip, 0, 0);
blind.blit(shots.back, base.w + SEP, 0);
const ZOOM = { x: 0, y: 150, w: 240, h: 120 };
const zoomed = new Image(ZOOM.w * 2 + SEP, ZOOM.h);
zoomed.blit(crop(shots.slip, ZOOM.x, ZOOM.y, ZOOM.w, ZOOM.h), 0, 0);
zoomed.blit(crop(shots.back, ZOOM.x, ZOOM.y, ZOOM.w, ZOOM.h), ZOOM.w + SEP, 0);
writeFileSync(join(HERE, 'laundromat-v2-gap-4x.png'), indexedPng(strip, 4));
writeFileSync(join(HERE, 'laundromat-v2-blind-n8-1x.png'), indexedPng(blind, 1));
writeFileSync(join(HERE, 'laundromat-v2-blind-n8-3x.png'), indexedPng(zoomed, 3));
gray(strip, 4, 'laundromat-v2-gap-gray-4x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
