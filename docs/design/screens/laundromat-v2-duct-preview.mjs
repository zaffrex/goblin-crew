// 빨래방 v2 N1·N2 미리보기·검사 (#1031·#1067, laundromat-v2.md 9-2절). 원본: art/scenes/laundromat.duct-towel.mjs
// 실행: node docs/design/screens/laundromat-v2-duct-preview.mjs
// 출력(같은 폴더):
//   laundromat-v2-duct-4x.png        들창·덕트 근처 세 모습 4배: ① 처음(수건 귀퉁이를 깔고 조는 까치) ② 까치가 간 뒤(빈 둥지 + 처진 귀퉁이)
//                                     ③ 비교용 지금 앉은 까치 smug(조는 까치와 머리 높이 비교)
//   laundromat-v2-blind-n1-1x.png    블라인드용: 진짜 배경(public/scenes/laundromat-bg.png) 위에 빈 둥지 + ①만 얹은 한 화면 1배.
//                                     캡션 없이 "까치가 무엇을 깔고 있나"를 묻는다(9-2절 그림 블라인드)
//   laundromat-v2-blind-n1-3x.png    같은 장면 들창·덕트 근처를 3배로 자른 것(리뷰용, 블라인드에는 안 씀)
//   laundromat-v2-duct-gray-3x.png   3배 자른 것의 명도(흑백) (ADR-0007 결정 3-6)
// 검사(어기면 종료 코드 1):
//   - 수건 몸이 `towel` 핫스팟 상자(116, 40, 32×36) 안
//   - 귀퉁이 띠가 수건 몸과 한 덩어리(4방향 이어짐)로 둥지 위까지 간다
//   - 까치가 띠를 덮는다(깔고 있음) + 띠가 까치 왼쪽(꼬리 앞 끝)·오른쪽 양쪽에서 보인다
//   - 조는 까치 머리 꼭대기가 smug 머리보다 2px 이상 낮다(고개 떨굼을 실루엣으로)
//   - 마른 수건 tealL과 뒤 색(벽 cotton·판자 woodL·덕트 lav) 명도 차 ≥ 30, z(white)와 하늘 명도 차 ≥ 100
//   - 처진 귀퉁이 판에서 수건이 들창 쪽(x < 113)으로 안 간다(띠가 풀렸다)
//   - 진짜 배경에서 바뀐 픽셀이 들창·덕트 근처(x 56~151, y 20~79) 안

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { nestEmpty, magpieSit } from '../../../art/scenes/laundromat.objects.mjs';
import { ductTowel, magpieDoze, DUCT_TOWEL_AT, DUCT_TOWEL_BOX, MAGPIE_DOZE, MAGPIE_DOZE_AT } from '../../../art/scenes/laundromat.duct-towel.mjs';
import { MAGPIE } from '../../../art/scenes/magpie_nest.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const TOWEL_HOTSPOT = { x: 116, y: 40, w: 32, h: 36 }; // laundromat-v2.md 3절 `towel` 기본 상자
const AREA = { x: 56, y: 20, w: 96, h: 60 }; // 들창·덕트 근처(바뀌어도 되는 곳, 자르는 곳)

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

const bg = readIndexedPng(join(ROOT, 'public/scenes/laundromat-bg.png'));
const withBg = (draw) => { const s = new Image(bg.w, bg.h); s.blit(bg, 0, 0); nestEmpty(s); draw(s); return s; };

// ① 처음: 둥지 → 수건(귀퉁이 끌려감) → 조는 까치   ② 까치가 간 뒤: 둥지 → 처진 귀퉁이   ③ 비교: 지금 앉은 까치 smug
const first = withBg((s) => { ductTowel(s, { corner: 'pinned' }); magpieDoze(s); });
const after = withBg((s) => ductTowel(s, { corner: 'loose' }));
const smug = withBg((s) => { ductTowel(s, { corner: 'pinned' }); magpieSit(s, 'smug'); });

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);

// 수건만(외곽선 포함) 빈 그림에 따로 그려 잰다
const lone = (corner) => { const t = new Image(bg.w, bg.h); ductTowel(t, { corner }); return t; };
const pinned = lone('pinned');
const loose = lone('loose');
const filled = (img) => { const out = []; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = img.get(x, y); if (c !== EMPTY && c !== C.ink) out.push([x, y]); } return out; };
const inBox = (b) => ([x, y]) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

// 수건 몸 = 왼쪽 끝(DUCT_TOWEL_AT.x)부터. 그 왼쪽은 그림에만 있는 귀퉁이 띠·쐐기다(9-2절 N1)
const bodyPx = filled(pinned).filter(([x]) => x >= DUCT_TOWEL_AT.x);
check(bodyPx.every(inBox(TOWEL_HOTSPOT)), `수건 몸 ${bodyPx.length}px이 towel 상자(116,40 32×36) 안 (밖 ${bodyPx.filter((p) => !inBox(TOWEL_HOTSPOT)(p)).length})`);
check(
  DUCT_TOWEL_BOX.x >= TOWEL_HOTSPOT.x && DUCT_TOWEL_BOX.y >= TOWEL_HOTSPOT.y && DUCT_TOWEL_BOX.x + DUCT_TOWEL_BOX.w <= TOWEL_HOTSPOT.x + TOWEL_HOTSPOT.w && DUCT_TOWEL_BOX.y + DUCT_TOWEL_BOX.h <= TOWEL_HOTSPOT.y + TOWEL_HOTSPOT.h,
  `DUCT_TOWEL_BOX(${DUCT_TOWEL_BOX.x},${DUCT_TOWEL_BOX.y} ${DUCT_TOWEL_BOX.w}×${DUCT_TOWEL_BOX.h}, 외곽선 포함)가 towel 상자 안`,
);

// 한 덩어리: 채움 픽셀 4방향 이어짐
const parts = (px) => {
  const key = (x, y) => `${x},${y}`;
  const left = new Set(px.map(([x, y]) => key(x, y)));
  let n = 0;
  while (left.size) {
    n++;
    const stack = [left.values().next().value];
    left.delete(stack[0]);
    while (stack.length) {
      const [x, y] = stack.pop().split(',').map(Number);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (left.delete(key(nx, ny))) stack.push(key(nx, ny));
    }
  }
  return n;
};
const pinnedPx = filled(pinned);
const minX = Math.min(...pinnedPx.map(([x]) => x));
check(parts(pinnedPx) === 1 && minX <= 66, `귀퉁이 띠가 수건 몸과 한 덩어리(덩어리 ${parts(pinnedPx)})이고 둥지 위 x ${minX}까지 간다(≤ 66)`);

// 까치가 띠를 덮는다 / 양옆에서 보인다
const stripPx = pinnedPx.filter(([x, y]) => x < 93 && y <= 47);
const hidden = stripPx.filter(([x, y]) => first.get(x, y) !== pinned.get(x, y));
const shownLeft = stripPx.filter(([x, y]) => x < 69 && first.get(x, y) === pinned.get(x, y));
const shownRight = stripPx.filter(([x, y]) => x > 77 && first.get(x, y) === pinned.get(x, y));
check(hidden.length >= 8, `조는 까치가 둥지 위 띠 ${stripPx.length}px 중 ${hidden.length}px를 덮는다(≥ 8, 깔고 앉음)`);
check(shownLeft.length >= 2 && shownRight.length >= 10, `띠가 까치 왼쪽(꼬리 앞 끝) ${shownLeft.length}px(≥ 2)·오른쪽 ${shownRight.length}px(≥ 10) 보인다`);

// 머리 높이: 몸 오른쪽 반(열 ≥ 9, 꼬리 빼고) 가장 위 줄
const headTop = (rows) => rows.findIndex((r) => [...r].some((c, i) => i >= 9 && c !== '.'));
const dozeTop = headTop(MAGPIE_DOZE), smugTop = headTop(MAGPIE.smug);
check(dozeTop - smugTop >= 2, `조는 까치 머리 꼭대기 y ${MAGPIE_DOZE_AT.y + dozeTop} vs smug ${MAGPIE_DOZE_AT.y + smugTop}: ${dozeTop - smugTop}px 낮다(≥ 2)`);
check(MAGPIE_DOZE.length === 18 && MAGPIE_DOZE.every((r) => r.length === 20), '조는 까치 칸 20×18(O3 앉은 자리와 같음)');
check(!MAGPIE_DOZE.some((r) => r.includes('e') || r.includes('d')), '조는 까치에 뜬 눈(e)·발(d)이 없다(감은 눈, 발은 깃털 속)');

// 명도
for (const [name, c] of [['벽 cotton', C.cotton], ['판자 woodL', C.woodL], ['덕트 lav', C.lav]]) check(dY(C.tealL, c) >= 30, `마른 수건 tealL(Y${Y[C.tealL]}) vs ${name}(Y${Y[c]}) 차 ${dY(C.tealL, c)} ≥ 30`);
const zOnly = (() => { const a = withBg(() => {}); const b = withBg((s) => magpieDoze(s)); const c = withBg((s) => magpieDoze(s, { z: false })); return diffPixels(c, b).map(([x, y]) => [x, y, a.get(x, y)]); })();
const zMinGap = Math.min(...zOnly.map(([, , under]) => dY(C.white, under)));
check(zOnly.length > 0 && zMinGap >= 100, `z ${zOnly.length}px 뒤 하늘과 명도 차 최소 ${zMinGap} ≥ 100`);

// 처진 귀퉁이
const loosePx = filled(loose);
const looseMinX = Math.min(...loosePx.map(([x]) => x));
check(looseMinX >= 113 && parts(loosePx) === 1, `처진 귀퉁이 판: 수건 왼쪽 끝 x ${looseMinX} ≥ 113(들창 쪽으로 안 감), 한 덩어리`);

// 진짜 배경에서 바뀐 곳
const nestOnly = withBg(() => {});
for (const [name, img] of [['①', first], ['②', after]]) {
  const d = diffPixels(nestOnly, img);
  check(d.every(inBox(AREA)), `${name} 배경+둥지 대비 바뀐 ${d.length}px이 들창·덕트 근처(${AREA.x},${AREA.y} ${AREA.w}×${AREA.h}) 안`);
}
console.log(`새 칸: N1 수건+띠 ${pinnedPx.length}px·처진 귀퉁이 ${loosePx.length}px(채움), N2 조는 까치 + z ${zOnly.length}px`);

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
const GAP = 4;
const strip = new Image(AREA.w * 3 + GAP * 2, AREA.h);
[first, after, smug].forEach((img, i) => strip.blit(crop(img, AREA.x, AREA.y, AREA.w, AREA.h), i * (AREA.w + GAP), 0));
const zoomed = crop(first, AREA.x, AREA.y, AREA.w, AREA.h);
writeFileSync(join(HERE, 'laundromat-v2-duct-4x.png'), indexedPng(strip, 4));
writeFileSync(join(HERE, 'laundromat-v2-blind-n1-1x.png'), indexedPng(first, 1));
writeFileSync(join(HERE, 'laundromat-v2-blind-n1-3x.png'), indexedPng(zoomed, 3));
gray(zoomed, 3, 'laundromat-v2-duct-gray-3x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
