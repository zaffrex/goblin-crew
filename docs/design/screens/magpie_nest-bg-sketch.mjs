// 화면 1 `magpie_nest` 배경 **구도 시안** (#145). 완성 그림이 아니다.
// 목적: 사장님께 방향(소품 배치·시선 흐름·색 분위기)을 먼저 보이고 맞춘다. 색은 거칠게, 디테일은 완성 PR에서.
// 실행: node docs/design/screens/magpie_nest-bg-sketch.mjs
// 출력(같은 폴더):
//   magpie_nest-bg-sketch-2x.png       시안(480×270을 2배). 세 사람은 3차 샘플 ②를 시작 위치에 그대로 올렸다
//   magpie_nest-bg-sketch-notes-2x.png 같은 그림 + 번호(볼거리 ①~⑨, 퍼즐 물건 A~G)
//   magpie_nest-bg-sketch-gray-2x.png  명도(흑백) 버전 (ADR-0007 결정 3-6)
// 검사: 걷는 바닥 주색과 세 사람 주색의 명도 차 ≥ 30(결정 3-4), 배경에 ink(0)·hint(31) 없음(결정 3-1).
//       어기면 종료 코드 1. 좌표는 magpie_nest.md 1절·magpie_nest-layout.mjs와 같다(그림이 좌표를 따른다).

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 480;
const H = 270;
const FLOOR_TOP = 196; // 담장 아래 = 걷는 바닥 시작
const FLOOR_Y = 236;

const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** 4×4 Bayer: t(0~1) 비율만큼 b, 나머지 a. 배경 전용(결정 3-2). */
const bay = (x, y, t, a, b) => (BAYER[y & 3][x & 3] < t * 16 ? b : a);

const bg = new Image(W, H, C.aqua); // 배경(만질 수 없음): ink·hint 금지
const fg = new Image(W, H); // 만질 수 있는 것: 외곽선 ink
const notes = [];

const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);
const fill = (img, x0, y0, w, h, f) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const c = f(x, y);
    if (c !== undefined) img.set(x, y, c);
  }
};
const ellipse = (img, cx, cy, rx, ry, f) =>
  fill(img, Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1 ? (typeof f === 'function' ? f(x, y) : f) : undefined;
  });

// ───────────── 하늘 (위 밝음 → 아래 조금 진함, Bayer 띠) ─────────────
fill(bg, 0, 0, W, 150, (x, y) => (y < 60 ? bay(x, y, y / 60, C.white, C.aqua) : bay(x, y, (y - 60) / 90, C.aqua, C.tealL)));
// 구름 2덩이(하나는 양말 모양: 빨래방 동네다운 구름)
for (const [cx, cy, rx, ry] of [[250, 34, 26, 8], [270, 28, 18, 8], [232, 30, 12, 6]]) ellipse(bg, cx, cy, rx, ry, C.white);
// 양말 구름 ①: 발목(세로) + 발(가로)
fill(bg, 392, 22, 14, 20, (x, y) => (Math.hypot(x - 399, y - 30) < 11 || (y > 30 && x < 406) ? C.white : undefined));
ellipse(bg, 410, 40, 13, 6, C.white);
notes.push([400, 22, 1]);

// 먼 동네 지붕선 (낮은 대비, 보라 계열) + TV 안테나에 앉은 비둘기 셋 ②
const roofs = [[76, 128, 40], [116, 118, 36], [176, 124, 52], [240, 112, 30], [300, 126, 60], [380, 116, 44], [430, 122, 50]];
for (const [x0, top, w] of roofs) {
  // 박공지붕: 가운데가 8px 높다. 벽은 하늘과 섞어 멀리 보이게
  fill(bg, x0, top - 8, w, 158 - top, (x, y) => {
    const ridge = top - 8 + Math.abs(x - x0 - w / 2) * (16 / w);
    if (y < ridge) return undefined;
    return y < ridge + 3 ? C.lav : bay(x, y, 0.5, C.purL, C.tealL);
  });
}
R(bg, 256, 96, 1, 16, C.lav); R(bg, 250, 100, 13, 1, C.lav); R(bg, 252, 104, 9, 1, C.lav);
for (const bx of [250, 255, 260]) { R(bg, bx, 97, 3, 2, C.lav); bg.set(bx + 2, 96, C.lav); }
notes.push([258, 92, 2]);
// 물탱크 지붕
ellipse(bg, 330, 118, 10, 4, C.lav); R(bg, 320, 118, 21, 8, C.purL);

// ───────────── 왼쪽: 빨래방 뒷벽 ─────────────
fill(bg, 0, 20, 78, FLOOR_TOP - 20 + 40, (x, y) => (y % 12 === 0 || (x + (Math.floor(y / 12) % 2) * 9) % 18 === 0 ? C.lint : bay(x, y, 0.2, C.pinkL, C.cotton)));
R(bg, 0, 16, 82, 6, C.lav); // 지붕 처마
R(bg, 0, 22, 82, 2, C.purL);
// 창문 + 창턱의 화분
R(bg, 14, 44, 30, 26, C.lav); R(bg, 16, 46, 26, 22, C.tealL); R(bg, 28, 46, 2, 22, C.lav); R(bg, 16, 56, 26, 2, C.lav);
R(bg, 12, 70, 34, 3, C.purL);
// 건조기 배기구 + 김(김 하나가 양말 모양 ③)
R(bg, 52, 86, 14, 10, C.lav); R(bg, 54, 88, 10, 6, C.dusk);
ellipse(bg, 60, 78, 6, 4, C.white); ellipse(bg, 66, 68, 5, 4, C.white);
R(bg, 70, 50, 6, 10, C.white); R(bg, 70, 58, 10, 4, C.white);
notes.push([72, 46, 3]);
// 잠긴 뒷문 + 자물쇠(우리가 왜 열쇠를 찾나) ④
R(bg, 14, 156, 36, 80, C.purL); R(bg, 16, 158, 32, 78, C.lav);
R(bg, 42, 194, 4, 4, C.yelD); // 손잡이
R(bg, 20, 190, 10, 12, C.dusk); R(bg, 22, 186, 6, 5, C.purL); R(bg, 24, 188, 2, 3, C.lav); // 자물쇠
R(bg, 18, 166, 26, 12, C.cotton); R(bg, 20, 169, 22, 1, C.lav); R(bg, 20, 172, 16, 1, C.lav); // "영업 끝" 쪽지(글자 없이 줄만)
notes.push([30, 150, 4]);
// 홈통 → 웅덩이 + 고무 오리 ⑤
R(bg, 72, 24, 4, 206, C.purL); R(bg, 72, 228, 10, 4, C.purL);
notes.push([86, 252, 5]);

// ───────────── 담장 (나무, 낮은 대비) ─────────────
for (let x = 78; x < W; x++) {
  const p = (x - 78) % 22;
  for (let y = 152; y < FLOOR_TOP + 4; y++) {
    const top = 152 + (p < 11 ? p / 4 : (21 - p) / 4) - 2; // 뾰족 판자 끝
    if (y < top) continue;
    bg.set(x, y, p === 21 ? C.wood : p < 3 ? bay(x, y, 0.5, C.woodL, C.tan) : bay(x, y, (y - 152) / 70, C.woodL, C.wood));
  }
}
// 담장 위로 이웃집 해바라기 셋이 넘겨다봄 ⑥ (한 송이는 고개를 빨래 쪽으로 꺾음)
for (const [fx, fy] of [[292, 140], [310, 134], [326, 142]]) {
  R(bg, fx, fy, 1, 160 - fy, C.grn);
  ellipse(bg, fx, fy, 6, 6, C.yel); ellipse(bg, fx, fy, 3, 3, C.woodD);
}
notes.push([312, 126, 6]);
// 담장에 걸린 엉킨 호스 ⑦
for (let a = 0; a < Math.PI * 6; a += 0.05) {
  const r = 7 + a * 0.6;
  bg.set(Math.round(104 + Math.cos(a) * r * 0.8), Math.round(178 + Math.sin(a) * r * 0.55), C.grn);
}
R(bg, 102, 162, 4, 4, C.dusk);
notes.push([104, 160, 7]);

// ───────────── 바닥 (풀밭: 걷는 영역 주색 grnL) ─────────────
fill(bg, 0, FLOOR_TOP, W, H - FLOOR_TOP, (x, y) => {
  const t = (y - FLOOR_TOP) / (H - FLOOR_TOP);
  if (y < FLOOR_TOP + 6) return bay(x, y, 0.5, C.grnL, C.grn); // 담장 밑 그늘
  return bay(x, y, 0.12 + 0.1 * Math.sin(x / 23 + y / 9), C.grnL, t > 0.6 ? C.grn : C.grnP);
});
// 데이지·풀 포기
for (let i = 0; i < 40; i++) {
  const x = (i * 97) % W, y = FLOOR_TOP + 10 + ((i * 53) % (H - FLOOR_TOP - 12));
  if (x > 330 && x < 470 && y > 236) continue; // 시작 위치 발밑은 비운다
  if (i % 3 === 0) { bg.set(x, y, C.white); bg.set(x + 1, y, C.white); bg.set(x, y - 1, C.yelL); }
  else { bg.set(x, y, C.grn); bg.set(x + 2, y - 1, C.grn); bg.set(x + 1, y - 2, C.grn); }
}
// 홈통 아래 웅덩이 + 고무 오리 ⑤ (바닥 위에 그린다)
ellipse(bg, 86, 248, 16, 4, (x, y) => bay(x, y, 0.5, C.tealM, C.tealL));
R(bg, 84, 243, 6, 4, C.yel); R(bg, 88, 241, 3, 3, C.yel); bg.set(91, 242, C.redL);
// 디딤돌 3개(빨랫줄 아래)
for (const sx of [348, 392, 436]) ellipse(bg, sx, 258, 9, 3, (x, y) => (y < 258 ? C.lint : C.lav));

// 잃어버린 양말 상자 ⑧ (담장 밑, 시소와 빨랫줄 사이)
R(bg, 300, 194, 26, 18, C.woodL); R(bg, 300, 194, 26, 3, C.tan); R(bg, 298, 190, 6, 5, C.tan);
R(bg, 304, 186, 4, 8, C.pink); R(bg, 312, 188, 4, 6, C.tealL); R(bg, 318, 184, 3, 10, C.yelL); R(bg, 326, 206, 8, 3, C.purL);
notes.push([312, 180, 8]);

// 빨랫대 기둥 (배경: 외곽선 없음). 못·스티커·까치 주의 표지 ⑨
R(bg, 140, 40, 12, FLOOR_Y - 40, C.wood); R(bg, 140, 40, 3, FLOOR_Y - 40, C.woodL); R(bg, 149, 40, 3, FLOOR_Y - 40, C.woodD);
R(bg, 132, FLOOR_Y - 2, 28, 4, C.grn); // 기둥 밑 그늘
R(bg, 132, 130, 18, 14, C.cotton); R(bg, 133, 131, 16, 12, C.white); // 표지판
ellipse(bg, 141, 137, 4, 3, C.dusk); bg.set(145, 136, C.dusk); R(bg, 134, 132, 14, 1, C.redL); R(bg, 134, 142, 14, 1, C.redL);
for (let i = 0; i < 12; i++) { bg.set(134 + i, 132 + i, C.redL); bg.set(135 + i, 132 + i, C.redL); }
notes.push([126, 132, 9]);

// 빨랫줄 기둥(T자) + 줄
for (const px of [332, 464]) { R(bg, px, 104, 4, FLOOR_Y - 104, C.lav); R(bg, px, 104, 1, FLOOR_Y - 104, C.lint); R(bg, px - 6, 104, 16, 3, C.lav); }
R(bg, 336, 110, 128, 1, C.dusk);
// 장식 빨래(만질 수 없음): 집게 5개 물린 아기 양말, 수건, 물방울 무늬 사각팬티
R(bg, 344, 111, 10, 14, C.tealL); R(bg, 344, 122, 14, 5, C.tealL);
for (let i = 0; i < 5; i++) R(bg, 342 + i * 3, 109, 2, 4, C.woodL);
R(bg, 412, 112, 20, 24, C.tealL); for (let y = 114; y < 136; y += 4) R(bg, 412, y, 20, 1, C.tealM);
R(bg, 440, 112, 20, 16, C.purL); R(bg, 440, 128, 8, 6, C.purL); R(bg, 452, 128, 8, 6, C.purL);
for (const [dx, dy] of [[443, 115], [450, 119], [456, 114], [446, 124], [455, 125]]) R(bg, dx, dy, 2, 2, C.cotton);

// ───────────── 퍼즐 물건 (만질 수 있음: ink 외곽선) ─────────────
const OBJ = [];
const obj = (key, draw) => { const im = new Image(W, H); draw(im); OBJ.push([key, im]); };
// A 둥지 + 반짝이 잡동사니 (병뚜껑·숟가락·단추·열쇠 반짝임)
obj('A', (im) => {
  ellipse(im, 146, 38, 18, 7, (x, y) => bay(x, y, 0.4, C.wood, C.woodD));
  for (let x = 129; x < 164; x += 3) { im.set(x, 32 + (x % 5), C.woodL); im.set(x + 1, 44 - (x % 4), C.woodD); }
  R(im, 132, 31, 4, 2, C.red); R(im, 158, 32, 3, 2, C.lint); R(im, 160, 31, 2, 1, C.white); R(im, 137, 33, 2, 2, C.pink);
  R(im, 150, 33, 4, 3, C.yelL); im.set(152, 31, C.white); im.set(152, 37, C.white); im.set(148, 34, C.white); im.set(155, 34, C.white);
});
// B 까치(둥지 위): 흑백 몸 + 청록 꼬리 + 왕눈
obj('B', (im) => {
  ellipse(im, 146, 25, 6, 5, C.dusk); ellipse(im, 147, 27, 4, 3, C.white);
  R(im, 136, 22, 6, 3, C.tealD); ellipse(im, 151, 20, 3, 3, C.dusk); R(im, 154, 20, 3, 1, C.yelD);
  im.set(152, 19, C.white);
});
// C 고리
obj('C', (im) => { R(im, 152, 92, 10, 2, C.lav); R(im, 159, 92, 2, 8, C.lav); R(im, 156, 98, 4, 2, C.lav); im.set(152, 92, C.lint); });
// D 바구니(옆구리로 분홍 양말이 삐져나옴)
obj('D', (im) => {
  fill(im, 144, 222, 32, 14, (x, y) => ((x + y) % 4 < 2 ? C.woodL : C.tan));
  R(im, 144, 220, 32, 3, C.wood); R(im, 150, 216, 6, 5, C.pink); R(im, 164, 217, 8, 4, C.cotton);
});
// E 시소: 널빤지 + 세제 통 받침
obj('E', (im) => {
  R(im, 208, 214, 80, 5, C.woodL); R(im, 208, 218, 80, 1, C.wood);
  R(im, 242, 220, 12, 16, C.teal); R(im, 242, 220, 12, 3, C.tealM); R(im, 244, 226, 8, 5, C.white); R(im, 246, 228, 4, 1, C.red);
});
// F 왕꽃무늬 내복
obj('F', (im) => {
  R(im, 372, 112, 32, 22, C.redL); R(im, 372, 134, 14, 18, C.redL); R(im, 390, 134, 14, 18, C.redL);
  for (const [fx, fy] of [[377, 117], [392, 120], [383, 128], [398, 130], [376, 140], [394, 144]]) {
    R(im, fx - 1, fy, 3, 1, C.yelL); R(im, fx, fy - 1, 1, 3, C.yelL); im.set(fx, fy, C.red);
  }
  for (let i = 0; i < 2; i++) R(im, 374 + i * 26, 109, 2, 4, C.woodL);
});

/** 만질 수 있는 것의 바깥쪽 1px ink 외곽선(결정 3-1). */
function outlined(im) {
  const out = new Image(W, H);
  out.blit(im, 0, 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (im.get(x, y) !== EMPTY) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => im.get(x + dx, y + dy) !== EMPTY)) out.set(x, y, C.ink);
  }
  return out;
}
for (const [, im] of OBJ) fg.blit(outlined(im), 0, 0);

// ───────────── 세 사람 (3차 샘플 ② crew-v3b-4x.png 첫 줄을 잘라 시작 위치에) ─────────────
function readCrewPng(file) {
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
  // crew-v3.mjs가 쓴 RGB PNG(필터 0)를 보송 인덱스로 되돌린다
  const img = new Image(w, h);
  const key = new Map(PALETTE.map(([r, g, b], i) => [(r << 16) | (g << 8) | b, i]));
  const row = w * 3 + 1;
  for (let y = 0; y < h; y++) {
    if (raw[y * row] !== 0) throw new Error('필터 0만 읽는다');
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * 3;
      const i = key.get((raw[o] << 16) | (raw[o + 1] << 8) | raw[o + 2]);
      img.c[y * w + x] = i ?? EMPTY; // 아래 두 줄(명도·실루엣)은 회색이라 팔레트 밖이다. 첫 줄만 쓴다
    }
  }
  return img;
}
const sheet4 = readCrewPng(join(HERE, '../art/crew-v3b-4x.png'));
const sheet = new Image(sheet4.w / 4, sheet4.h / 4);
for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, sheet4.get(x * 4, y * 4));
// 첫 줄(색) 칸의 배경을 칸 가장자리에서부터 채워 지운다(몸 안쪽 cotton은 외곽선에 막혀 남는다)
const BAND = 68;
const bgCol = new Set([C.cotton, C.lint]); // 칸 바탕과 점선 테두리
const crew = new Image(sheet.w, BAND);
for (let y = 0; y < BAND; y++) for (let x = 0; x < sheet.w; x++) crew.set(x, y, sheet.get(x, y));
const stack = [];
for (let x = 0; x < crew.w; x++) stack.push([x, 0]);
for (let y = 0; y < BAND; y++) stack.push([0, y], [crew.w - 1, y]);
while (stack.length) {
  const [x, y] = stack.pop();
  const c = crew.get(x, y);
  if (c === EMPTY || !bgCol.has(c)) continue;
  crew.set(x, y, EMPTY);
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
// 칸마다 그림 박스를 찾아 발 가운데를 시작 위치에 맞춘다
const cols = [];
for (let x = 0; x < crew.w; x++) {
  let any = false;
  for (let y = 0; y < BAND; y++) if (crew.get(x, y) !== EMPTY) any = true;
  if (any && (!cols.length || cols[cols.length - 1][1] < x - 1)) cols.push([x, x]);
  else if (any) cols[cols.length - 1][1] = x;
}
if (cols.length !== 3) throw new Error(`3차 샘플에서 세 사람을 못 찾음: ${cols.length}`);
const START = [[360, 244], [400, 244], [440, 244]];
const people = new Image(W, H);
cols.forEach(([x0, x1], i) => {
  let foot = 0;
  for (let y = 0; y < BAND; y++) for (let x = x0; x <= x1; x++) if (crew.get(x, y) !== EMPTY) foot = Math.max(foot, y);
  const part = new Image(x1 - x0 + 1, foot + 1);
  for (let y = 0; y <= foot; y++) for (let x = x0; x <= x1; x++) part.set(x - x0, y, crew.get(x, y));
  // 3차 샘플은 오른쪽을 본다. 시작 위치에서는 왼쪽(빨랫대)을 보게 뒤집는다
  people.blit(part, START[i][0] - Math.floor(part.w / 2), START[i][1] - foot, { flipAx: part.w / 2 });
});

// ───────────── 합치기 + 검사 ─────────────
const scene = new Image(W, H);
scene.blit(bg, 0, 0); scene.blit(fg, 0, 0); scene.blit(people, 0, 0);

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const bgCount = new Map();
for (const c of bg.c) bgCount.set(c, (bgCount.get(c) ?? 0) + 1);
check(!bgCount.has(C.ink) && !bgCount.has(C.hint), '배경에 ink(0)·hint(31) 없음');
// 걷는 영역(바닥, 시작 위치 줄)의 주색 = 가장 많은 색
const floorCount = new Map();
for (let y = 214; y < 258; y++) for (let x = 0; x < W; x++) { const c = bg.get(x, y); floorCount.set(c, (floorCount.get(c) ?? 0) + 1); }
const floorMain = [...floorCount].sort((a, b) => b[1] - a[1])[0][0];
const MAIN = { '쭉이 셔츠': C.red, '쭉이 바지': C.dusk, '묵직이 멜빵': C.teal, '묵직이 셔츠': C.white, '삑삑이 우비': C.yel };
for (const [name, c] of Object.entries(MAIN)) check(Math.abs(Y[c] - Y[floorMain]) >= 30, `바닥 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name} #${c}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[floorMain])} ≥ 30`);

// ───────────── 번호 표시판 (notes 그림 전용) ─────────────
const DIG = {
  1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'], 3: ['110', '001', '010', '001', '110'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'], 6: ['011', '100', '110', '101', '010'],
  7: ['111', '001', '010', '010', '010'], 8: ['010', '101', '010', '101', '010'], 9: ['010', '101', '011', '001', '110'],
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
};
const tag = (im, x, y, ch, back) => {
  R(im, x - 3, y - 4, 7, 9, back);
  DIG[ch].forEach((row, j) => [...row].forEach((b, i) => b === '1' && im.set(x - 1 + i, y - 2 + j, C.white)));
};
const noted = new Image(W, H);
noted.blit(scene, 0, 0);
for (const [x, y, n] of notes) tag(noted, x, y, String(n), C.hint);
for (const [k, x, y] of [['A', 124, 36], ['B', 140, 10], ['C', 170, 92], ['D', 182, 222], ['E', 248, 204], ['F', 412, 146]]) tag(noted, x, y, k, C.purD);

// ───────────── 출력 ─────────────
writeFileSync(join(HERE, 'magpie_nest-bg-sketch-2x.png'), indexedPng(scene, 2));
writeFileSync(join(HERE, 'magpie_nest-bg-sketch-notes-2x.png'), indexedPng(noted, 2));
{
  // 명도 버전: 8비트 회색 PNG
  const S = 2, w = W * S, h = H * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[scene.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'magpie_nest-bg-sketch-gray-2x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
console.log(`배경 1배 크기(인덱스 PNG): ${indexedPng(bg, 1).length} bytes`);
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
