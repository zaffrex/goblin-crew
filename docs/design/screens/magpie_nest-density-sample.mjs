// 화면 1 `magpie_nest` **완성 밀도 샘플** (#145, 사장님 피드백 11/16 "도트에 더 공들이자").
// 화면 왼쪽 반(빨랫대 기둥 + 둥지 주변)만 완성 밀도로 그리고, 같은 배율로 세 사람을 세워 밀도를 비교한다.
// 나머지 배경은 이 수준에 맞춰 띠별 PR로 그린다. 구도·좌표는 구도 시안(#149)·magpie_nest.json과 같다.
// 실행: node docs/design/screens/magpie_nest-density-sample.mjs
// 출력(같은 폴더):
//   magpie_nest-density-1x.png       잘라 낸 영역 실제 크기(256×270)
//   magpie_nest-density-2x.png       같은 그림 2배
//   magpie_nest-density-gray-2x.png  명도(흑백) 2배 (ADR-0007 결정 3-6)
//   magpie_nest-density-nest-4x.png  둥지·까치·고리 확대 4배
//   magpie_nest-density-vs-2x.png    왼쪽: 구도 시안(#149) 같은 영역 / 오른쪽: 이 샘플
// 검사(어기면 종료 코드 1): 배경에 ink(0)·hint(31) 없음, 바닥 주색과 세 사람 주색 명도 차 ≥ 30,
//   담장 주색과 피부 명도 차 ≥ 30(#145 리스크 2).
// 시소(E)는 기울기를 Theo와 정한 뒤 물건 시트 PR에서 그린다. 그 자리에 세 사람을 비교용으로 세웠다(실제 시작 위치는 360~440).

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import {
  hash, rng, bay, fill, ellipse, line, stamp, outlined, darker,
  bricks, planks, grassBase, tuft, daisy, clover, pebble,
} from '../../../art/lib/texture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 480, H = 270;
const CROP = [52, 0, 256, 270]; // x, y, w, h
const FENCE_TOP = 150, FLOOR_TOP = 196, POLE_FOOT = 236;
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));

const bg = new Image(W, H, C.aqua); // 배경: ink·hint 금지
const fx = new Image(W, H); // 반짝임 등 효과(외곽선 없음)
const OBJ = []; // 만질 수 있는 것: 따로 그려 외곽선
const obj = (key, draw) => { const im = new Image(W, H); draw(im); OBJ.push([key, im]); };
const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);

// ═════════════ 하늘 ═════════════
fill(bg, 0, 0, W, 160, (x, y) => (y < 56 ? bay(x, y, y / 56, C.white, C.aqua) : bay(x, y, Math.min(1, (y - 56) / 96), C.aqua, C.tealL)));

/** 뭉게구름: 원 여러 개, 위·왼쪽은 white, 아래는 cotton, 밑단은 망점으로 하늘에 녹는다. */
function cloud(puffs, baseY) {
  const inside = (x, y) => puffs.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.25) <= r);
  const xs = puffs.flatMap(([cx, , r]) => [cx - r, cx + r]), ys = puffs.flatMap(([, cy, r]) => [cy - r, cy + r]);
  fill(bg, Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs) - Math.min(...xs)) + 2, Math.ceil(Math.max(...ys) - Math.min(...ys)) + 2, (x, y) => {
    if (!inside(x, y) || y > baseY) return undefined;
    const lit = !inside(x - 2, y - 2); // 왼쪽 위 가장자리
    if (y > baseY - 2) return bay(x, y, 0.5, C.cotton, bg.get(x, y));
    if (lit) return C.white;
    if (!inside(x + 1, y + 2) || y > baseY - 5) return C.cotton;
    return hash(x, y, 40) < 0.06 ? C.cotton : C.white;
  });
}
cloud([[236, 30, 9], [248, 24, 11], [262, 27, 9], [274, 32, 7], [226, 34, 6]], 37);
cloud([[96, 70, 6], [106, 66, 8], [116, 70, 5]], 73);
// 먼 새 두 마리(V자)
for (const [bx, by] of [[200, 18], [209, 23]]) { bg.set(bx, by, C.lav); bg.set(bx + 1, by + 1, C.lav); bg.set(bx + 2, by, C.lav); bg.set(bx - 1, by - 1, C.lint); bg.set(bx + 3, by - 1, C.lint); }

// ═════════════ 먼 동네 지붕 ═════════════
const roofs = [[76, 128, 40, 0], [116, 118, 36, 1], [176, 124, 52, 0], [240, 112, 30, 1], [270, 120, 38, 0], [300, 126, 60, 1]];
for (const [x0, top, w, chim] of roofs) {
  const mid = x0 + w / 2;
  fill(bg, x0, top - 9, w, 162 - top, (x, y) => {
    const ridge = top - 9 + Math.abs(x + 0.5 - mid) * (18 / w);
    if (y < ridge) return undefined;
    const eave = top + 1;
    if (y < eave) {
      // 기와 줄: 3px마다 한 단 어두운 줄, 줄마다 반 칸 어긋난 세로 이음
      const row = Math.floor((y - ridge) / 3);
      const leftSlope = x < mid;
      const base = leftSlope ? C.purL : C.lav;
      if (y - ridge < 1) return C.lint; // 용마루 빛
      if ((y - Math.floor(ridge)) % 3 === 2) return darker(base);
      if ((x + row * 2) % 5 === 0) return darker(base);
      return base;
    }
    if (y < eave + 2) return C.lav; // 처마 그늘
    // 벽: 하늘과 섞인 낮은 대비 + 창문
    const wx = (x - x0) % 12, wy = (y - eave - 4) % 14;
    const lit = hash(x0 + Math.floor((x - x0) / 12), Math.floor((y - eave - 4) / 14), 9) < 0.45; // 창문은 듬성듬성
    if (lit && wx >= 4 && wx < 8 && wy >= 0 && wy < 5 && y < 156) return wy === 0 || wx === 4 ? C.lav : hash(x0, y, 8) < 0.3 ? C.yelL : C.aqua;
    return bay(x, y, 0.5, C.purL, C.tealL);
  });
  if (chim) {
    const cx = Math.round(x0 + w * 0.7), cy = top - 10;
    R(bg, cx, cy, 5, 8, C.lav); R(bg, cx, cy, 1, 8, C.purL); R(bg, cx - 1, cy - 1, 7, 2, C.lint);
    ellipse(bg, cx + 3, cy - 5, 3, 2, (x, y) => bay(x, y, 0.5, C.white, C.cotton));
    ellipse(bg, cx + 6, cy - 9, 2, 2, (x, y) => bay(x, y, 0.3, C.white, bg.get(x, y)));
  }
}
// TV 안테나 + 비둘기 셋 ② (한 마리는 반대로 앉았다)
R(bg, 256, 94, 1, 18, C.lav); R(bg, 249, 98, 15, 1, C.lav); R(bg, 251, 102, 11, 1, C.lav); R(bg, 253, 106, 7, 1, C.lav);
const pigeon = (px, py, flip) => {
  const rows = ['.hh..', 'hhbbb', '.cbbbt', '..ff.'];
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const col = { h: C.lav, b: C.lint, c: C.cotton, t: C.dusk, f: C.pink }[ch];
    if (col !== undefined) bg.set(flip ? px + 5 - i : px + i, py + j, col);
  }));
};
pigeon(248, 94, false); pigeon(254, 94, false); pigeon(259, 94, true);
// 지붕에서 지붕으로 건너간 전깃줄 + 걸려 버린 양말 한 짝(바람에 날아간 빨래)
const wireY = (x) => Math.round(58 + (x - 188) * 0.03 + 0.0022 * (x - 188) * (308 - x)); // 처진 줄
for (let x = 188; x < 308; x++) bg.set(x, wireY(x), C.lav);
{
  const sx = 268, sy = wireY(268) + 1;
  stamp(bg, sx - 1, sy - 1, ['.ll.', '.qq.', 'qQq.', 'qQq.', 'qqq.', 'pqq.', 'ppqq', '.ppp'], { l: C.woodL, q: C.pinkL, Q: C.white, p: C.pink });
}
for (const bx of [220, 232]) { // 전깃줄 참새
  const by = wireY(bx) - 3;
  stamp(bg, bx, by, ['.dd.', 'dlld', '.ll.'], { d: C.dusk, l: C.lint });
}

// ═════════════ 왼쪽: 빨래방 뒷벽(벽돌) ═════════════
const PIPE_X = 72;
bricks(bg, 0, 22, 78, FLOOR_TOP - 22 + 2, {
  seed: 11,
  shade: (x, y) => y < 30 || (x > PIPE_X + 3 && x < PIPE_X + 8 && hash(x, Math.floor(y / 3), 12) < 0.55) || x >= 76,
});
// 벽돌 위 얼룩: 홈통 받침 아래 녹물, 바닥 쪽 습기
for (const by of [60, 120, 180]) for (let y = by + 3; y < by + 14; y++) if (hash(y, by, 13) < 0.7) bg.set(PIPE_X - 1, y, darker(bg.get(PIPE_X - 1, y)));
for (let x = 0; x < 78; x++) for (let y = FLOOR_TOP - 8; y < FLOOR_TOP + 2; y++) if (hash(x, y, 14) < (y - FLOOR_TOP + 8) / 14) bg.set(x, y, darker(bg.get(x, y)));
// 처마: 두 단 + 빗물받이
R(bg, 0, 15, 82, 2, C.purL); R(bg, 0, 17, 82, 4, C.lav); R(bg, 0, 21, 82, 2, C.dusk);
for (let x = 2; x < 82; x += 6) bg.set(x, 19, C.purL);
// 건조기 배기구(빨래방 뒷벽 = 건조기가 김을 내뿜는다) + 김 하나가 양말 모양 ③
R(bg, 52, 84, 16, 12, C.lint); R(bg, 52, 84, 16, 1, C.cotton); R(bg, 67, 84, 1, 12, C.lav); R(bg, 52, 95, 16, 1, C.lav);
for (let y = 86; y < 94; y += 2) { R(bg, 54, y, 12, 1, C.dusk); R(bg, 54, y + 1, 12, 1, C.lav); }
ellipse(bg, 61, 77, 6, 4, (x, y) => (y < 76 ? C.white : bay(x, y, 0.4, C.white, C.cotton)));
ellipse(bg, 66, 67, 4, 3, (x, y) => bay(x, y, 0.2, C.white, C.cotton));
stamp(bg, 66, 48, ['.www', 'wwww', 'wwwc', 'wwwc', 'wwwc', 'wwwwww.', 'wwwwwwc', '.cccccc'], { w: C.white, c: C.cotton });
// 홈통(왼쪽 빛, 오른쪽 그늘) + 받침 + 아래로 꺾여 웅덩이로
R(bg, PIPE_X, 22, 4, 206, C.lint); R(bg, PIPE_X, 22, 1, 206, C.cotton); R(bg, PIPE_X + 3, 22, 1, 206, C.lav);
for (const by of [60, 120, 180]) { R(bg, PIPE_X - 1, by, 6, 2, C.lav); bg.set(PIPE_X - 1, by, C.lint); }
for (let y = 40; y < 228; y += 23) bg.set(PIPE_X + 1, y, C.lav); // 이음매
R(bg, PIPE_X, 226, 10, 4, C.lint); R(bg, PIPE_X, 226, 10, 1, C.cotton); R(bg, PIPE_X, 229, 10, 1, C.lav); R(bg, PIPE_X + 9, 226, 1, 4, C.lav);

// ═════════════ 담장 ═════════════
const behindFence = (x, y) => (hash(x >> 1, y >> 1, 21) < 0.5 ? C.grn : y % 3 === 0 ? C.grnL : C.grnD);
planks(bg, 78, W, FENCE_TOP, FLOOR_TOP + 2, { pw: 16, seed: 22, broken: [7], behind: behindFence });
// 부러진 판자 틈으로 이웃집 고양이가 눈만 내밀고 있다 (구석의 작은 사연)
{ const kx = 78 + 7 * 16 + 5, ky = FENCE_TOP + 21; stamp(bg, kx, ky, ['ll.ll', 'ly.yl'], { l: C.lint, y: C.yel }); }

// 담장 위 이웃집 해바라기 ⑥ (한 송이는 고개를 꺾어 빨래 쪽을 본다)
function sunflower(cx, cy, tilt) {
  line(bg, cx, cy + 4, cx + (tilt ? -1 : 0), FENCE_TOP + 4, C.grn);
  stamp(bg, cx + 1, cy + 12, ['gg', 'Ggg', '.G'], { g: C.grn, G: C.grnL });
  stamp(bg, cx - 3, cy + 18, ['.gg', 'ggG', 'G'], { g: C.grn, G: C.grnL });
  ellipse(bg, cx, cy, 6.5, tilt ? 5 : 6.5, (x, y, dx, dy) => {
    const a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    if (r > 0.8 + 0.2 * Math.cos(a * 6)) return undefined; // 꽃잎 끝 들쭉날쭉
    if (r < 0.45) return (x + y) % 2 ? C.woodD : C.wood; // 씨
    return dx + dy < -0.3 ? C.yelL : dy > 0.4 ? C.yelD : C.yel;
  });
}
sunflower(292, 140, false);

// 담장에 걸린 엉킨 호스 ⑦: 못에 걸린 고리 셋 + 놋쇠 꼭지
R(bg, 103, 163, 3, 2, C.lint); bg.set(103, 165, C.lav);
for (let k = 0; k < 3; k++) {
  const rx = 8 + k * 1.5, ry = 10 + k * 1.2, cx = 104 + (k - 1) * 2, cy = 166 + ry;
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = Math.round(cx + Math.sin(a) * rx), y = Math.round(cy - Math.cos(a) * ry);
    const lit = Math.sin(a) < -0.2 && Math.cos(a) > -0.3; // 왼쪽 위
    bg.set(x, y, C.grn); bg.set(x, y + 1, lit ? C.grnP : C.grnD);
  }
}
line(bg, 112, 188, 122, 196, C.grn); line(bg, 112, 189, 122, 197, C.grnD);
R(bg, 122, 196, 4, 3, C.yelD); R(bg, 122, 196, 4, 1, C.yel); bg.set(126, 197, C.woodD);

// ═════════════ 바닥(풀밭) ═════════════
grassBase(bg, 0, FLOOR_TOP, W, H - FLOOR_TOP);
// 담장 밑에 붙은 풀 덩어리(담장 아랫단을 가린다)
{
  const r = rng(32);
  for (let x = 78; x < W; x += 3 + Math.floor(r() * 4)) tuft(bg, x, FLOOR_TOP + 1 + Math.floor(r() * 2), r, 1);
}
// 기둥 밑과 바구니 앞은 사람이 밟아 흙이 드러났다
ellipse(bg, 154, 240, 22, 5, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.8 && hash(x, y, 33) < 0.6 ? undefined : Math.hypot(dx, dy) > 0.6 ? C.woodL : hash(x, y, 36) < 0.12 ? C.woodL : C.tan));
for (let i = 0; i < 6; i++) pebble(bg, 138 + Math.floor(hash(i, 0, 34) * 32), 238 + Math.floor(hash(i, 1, 34) * 5), 2 + (i % 2));
// 홈통 아래 웅덩이 + 고무 오리 ⑤ (오리 그림자가 물에 비친다)
ellipse(bg, 88, 249, 17, 4.5, (x, y, dx, dy) => {
  if (Math.hypot(dx, dy) > 0.85) return C.grn; // 젖은 테두리
  if (y === 247 && x > 76 && x < 86) return C.aqua; // 하늘 반사
  if (y === 250 && x > 92 && x < 100) return C.tealL;
  return dy < 0 ? C.tealL : C.tealM;
});
stamp(bg, 84, 240, ['..YY.', '.YYdr', '.YYY.', 'YYYYY', 'yYYYy', '.yyy.'], { Y: C.yel, y: C.yelD, d: C.dusk, r: C.redL });
R(bg, 84, 246, 5, 1, C.yelL); R(bg, 85, 247, 3, 1, C.tealM); // 물에 비친 오리
// 웅덩이로 떨어지는 물방울
bg.set(78, 233, C.tealL); bg.set(79, 237, C.aqua);

// 풀 포기·데이지·클로버·조약돌을 흩뿌린다(세 사람 발밑과 바구니 자리는 덜 찍는다)
{
  const r = rng(35);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * W), y = FLOOR_TOP + 6 + Math.floor(r() * (H - FLOOR_TOP - 8));
    const busy = (x > 140 && x < 180 && y > 214 && y < 244) || (x > 70 && x < 108 && y > 240 && y < 256);
    if (busy) continue;
    const k = r();
    if (k < 0.62) tuft(bg, x, y, r, y > 240 ? 1 : 0);
    else if (k < 0.75) daisy(bg, x, y);
    else if (k < 0.9) clover(bg, x, y);
    else pebble(bg, x, y, 2 + Math.floor(r() * 2));
  }
}

// ═════════════ 빨랫대 기둥(배경: 외곽선 없음) ═════════════
const PX = 140, PW = 12, PTOP = 46;
fill(bg, PX, PTOP, PW, POLE_FOOT - PTOP, (x, y) => {
  const lx = x - PX;
  const wob = Math.round(Math.sin(y / 11) * 0.8);
  if (lx === 0) return C.woodL;
  if (lx <= 2) return hash(x, y, 51) < 0.18 ? C.tan : C.woodL; // 빛 받는 면
  if (lx >= PW - 2) return hash(x, y, 52) < 0.25 ? C.wood : C.woodD; // 그늘 면
  if (lx === PW - 3) return hash(x, y, 53) < 0.5 ? C.woodD : C.wood;
  // 가운데: 결 두 줄 + 갈라진 틈
  if ((lx + wob === 5 || lx + wob === 8) && hash(lx, Math.floor(y / 4), 54) > 0.25) return C.woodD;
  if (lx === 6 && y > 150 && y < 186) return y % 9 === 0 ? C.wood : C.woodD; // 길게 간 금
  return hash(x, y, 55) < 0.08 ? C.woodL : C.wood;
});
// 쇠띠 두 개(위·아래) + 녹
for (const by of [62, 206]) {
  R(bg, PX - 1, by, PW + 2, 3, C.lint); R(bg, PX - 1, by, 3, 3, C.cotton); R(bg, PX + PW - 1, by, 2, 3, C.lav); R(bg, PX - 1, by + 2, PW + 2, 1, C.lav);
  bg.set(PX + 4, by + 1, C.lav); bg.set(PX + 8, by + 1, C.lav);
  for (let y = by + 3; y < by + 7; y++) if (hash(y, by, 56) < 0.6) bg.set(PX + 7, y, C.woodD);
}
// 둥지 받침 가로대(꼭대기)
R(bg, 130, PTOP - 2, 32, 4, C.wood); R(bg, 130, PTOP - 2, 32, 1, C.woodL); R(bg, 130, PTOP + 1, 32, 1, C.woodD);
R(bg, 132, PTOP + 2, 2, 4, C.woodD); R(bg, 158, PTOP + 2, 2, 4, C.woodD); // 받침 쐐기
// 기둥에 물려 둔 빨래집게 둘(누가 깜빡했다)
for (const [cy, lean] of [[116, 0], [122, 1]]) stamp(bg, PX + PW, cy, lean ? ['.tt', 'tl.', 'tl.'] : ['tt.', 'tl.', 'tl.', '.l.'], { t: C.tan, l: C.woodL });
// 찢어진 전단 자국(스테이플 두 개 + 남은 종이 조각)
stamp(bg, PX + 2, 172, ['c.c..', 'cc.cc', '.cl.c', '..cc.', '...c.'], { c: C.cotton, l: C.lint });
bg.set(PX + 2, 172, C.lav); bg.set(PX + 6, 173, C.lav);
// "까치 주의" 표지 ⑨: 못 두 개로 박은 판, 아래 모서리가 들려 있다. 글자 없이 그림으로만
{
  const sx = 130, sy = 128;
  R(bg, sx, sy, 20, 16, C.lint); R(bg, sx, sy, 20, 1, C.cotton); R(bg, sx, sy, 1, 16, C.cotton);
  R(bg, sx + 1, sy + 1, 18, 14, C.white); R(bg, sx + 19, sy + 1, 1, 15, C.lav); R(bg, sx + 1, sy + 15, 19, 1, C.lav);
  bg.set(sx + 2, sy + 2, C.dusk); bg.set(sx + 17, sy + 2, C.dusk); // 못
  ellipse(bg, sx + 10, sy + 8, 6, 6, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.72 ? C.redL : undefined));
  stamp(bg, sx + 6, sy + 5, ['....dd', '.dddwd', 'ddddw.', 'dddww.', '.d.d..'], { d: C.dusk, w: C.cotton });
  line(bg, sx + 6, sy + 4, sx + 14, sy + 12, C.redL); line(bg, sx + 7, sy + 4, sx + 15, sy + 12, C.red);
  stamp(bg, sx + 16, sy + 12, ['..l', '.ll', 'lll'], { l: C.cotton }); bg.set(sx + 19, sy + 15, C.aqua); // 들린 모서리
}
// 기둥 밑동: 풀이 덮고, 그림자는 오른쪽 아래(광원 왼쪽 위)
ellipse(bg, PX + PW + 6, POLE_FOOT + 1, 12, 2.2, (x, y) => darker(bg.get(x, y)));
{ const r = rng(57); for (let x = PX - 3; x < PX + PW + 4; x += 2) tuft(bg, x, POLE_FOOT + 1, r, 1); }

// ═════════════ 만질 수 있는 것 ═════════════
// A 둥지: 잔가지를 겹겹이, 훔친 반짝이로 터질 듯. 숟가락이 삐져나오고 양말이 늘어졌다. 열쇠 고리는 앞으로 늘어뜨린다(PR #149 리뷰 a)
obj('A', (im) => {
  const r = rng(61);
  const CX = 146, TOP = 33, BOT = 46;
  // 컵 모양: 위 두 줄(테두리)이 가장 넓고 아래로 둥글게 좁아진다
  const half = (y) => (y <= 36 ? 18 - (y === TOP ? 1 : 0) : 18 - Math.pow((y - 36) / (BOT - 36), 2) * 11);
  for (let y = TOP; y < BOT; y++) {
    const hw = half(y);
    for (let x = Math.ceil(CX - hw); x <= Math.floor(CX + hw); x++) {
      const right = x > CX + hw - 4; // 오른쪽 그늘
      let c;
      if (y <= TOP + 2) {
        // 테두리: 굵은 가지를 둘둘 감은 띠, 빛을 받는다
        const band = (x + (y - TOP) * 3) % 7;
        c = band < 3 ? C.tan : band < 5 ? C.woodL : C.wood;
      } else {
        // 몸통: 엇갈려 엮은 잔가지(사선 두 방향)
        const a = (((x + y * 2) % 6) + 6) % 6, b = (((x - y * 2) % 7) + 7) % 7;
        c = a === 0 ? C.woodL : b === 0 ? C.woodD : a === 1 && hash(x, y, 64) < 0.5 ? C.tan : C.wood;
        if (y > BOT - 5) c = darker(c); // 아래는 그늘
      }
      if (right) c = darker(c);
      if (y === BOT - 1) c = hash(x, y, 65) < 0.6 ? C.ink : C.woodD; // 가장 어두운 단(안쪽 선)
      im.set(x, y, c);
    }
  }
  // 테두리 위로 울퉁불퉁 삐친 가지 끝
  for (let x = CX - 16; x <= CX + 16; x++) if (hash(x, 1, 66) < 0.45) im.set(x, TOP - 1, hash(x, 2, 66) < 0.5 ? C.tan : C.woodL);
  // 사방으로 삐져나온 잔가지 14개
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, y0 = TOP + 1 + Math.floor(r() * 9);
    const x0 = Math.round(CX + side * (half(y0) - 1));
    const len = 3 + Math.floor(r() * 4), dy = Math.round((r() - 0.6) * 4);
    const col = y0 < TOP + 4 ? C.woodL : r() < 0.5 ? C.wood : C.woodD;
    line(im, x0, y0, x0 + side * len, y0 + dy, col);
  }
  line(im, 140, BOT - 1, 138, BOT + 3, C.woodD); line(im, 152, BOT - 1, 155, BOT + 2, C.wood); line(im, 146, BOT - 1, 146, BOT + 2, C.woodD);
  // ── 훔친 반짝이 더미(테두리 위로 수북)
  // 포크가 삐죽 꽂혀 있다
  line(im, 161, 32, 161, 23, C.cotton); line(im, 162, 31, 162, 24, C.lint);
  stamp(im, 159, 18, ['w.w.w', 'w.w.w', 'wcccl', '.ccl.'], { w: C.white, c: C.cotton, l: C.lint });
  // 병뚜껑(톱니 테두리)
  stamp(im, 137, 29, ['r.r.r', 'RRRRr', 'rrrrr'], { R: C.redL, r: C.red });
  // 은화(금색은 열쇠만 쓴다: 반짝이 더미 속에서 열쇠가 묻히지 않게, PR #149 리뷰 a)
  stamp(im, 142, 29, ['.ll', 'lwl', 'lld'], { l: C.lint, w: C.white, d: C.lav });
  // 단추(구멍 둘)
  stamp(im, 155, 29, ['.mm.', 'mtmt', '.mm.'], { m: C.tealM, t: C.tealD });
  // 구슬
  stamp(im, 133, 30, ['qw', 'pq'], { q: C.purL, w: C.white, p: C.pur });
  // 오른쪽으로 늘어진 줄무늬 양말
  stamp(im, 162, 34, ['qq.', 'qQq', 'ppp', 'qqq', 'ppp', 'qqq', '.pqq', '.ppp'], { q: C.pinkL, Q: C.white, p: C.pink });
  // 열쇠: 고리는 둥지 가장자리에 걸리고 몸통은 앞으로 늘어진다(PR #149 리뷰 a)
  stamp(im, 148, 30, [
    '.YYY.',
    'Yy.yY',
    'Y...y',
    '.yyy.',
    '..Y..',
    '..Yy.',
    '..Y..',
    '..Yy.',
    '..yy.',
  ], { Y: C.yelL, y: C.yel });
  for (const [x, y] of [[150, 31], [149, 32], [150, 32], [151, 32]]) im.set(x, y, C.woodD); // 고리 구멍
  im.set(152, 35, C.yelD); im.set(151, 38, C.yelD);
});
// 열쇠 반짝임(효과층: 외곽선 없음, 물건 시트에서 3프레임 루프)
stamp(fx, 153, 25, ['..w..', '..y..', 'wyWyw', '..y..', '..w..'], { w: C.yelL, y: C.yelL, W: C.white });
fx.set(146, 29, C.white);

// B 까치: 둥지 왼쪽에 서서 가슴을 내밀고 부리를 치켜든 "내 거다" 자세. 흑백 몸 + 청록 광택 날개·꼬리
obj('B', (im) => {
  stamp(im, 131, 16, [
    '..........kkk...',
    '.........kkpkk..',
    '........kkkwkkd.',
    '........kkkkk.dd',
    '........kkkkk...',
    '.......kkkkww...',
    '......kktkwwww..',
    '.....ktTmkwwwww.',
    '....ktTmwwkwwwc.',
    '...ktTmwwwkcwcc.',
    '..ktTtmkwkkcccl.',
    '.ktTtkkkkkklll..',
    'ktTt...kkk......',
    'tTt.....d.d.....',
    'Tt......d.d.....',
    't......dd.dd....',
  ], { k: C.ink, p: C.plum, w: C.white, c: C.cotton, l: C.lint, d: C.dusk, t: C.tealD, T: C.teal, m: C.tealM });
  // 정수리 광택
  im.set(142, 17, C.dusk); im.set(141, 18, C.plum);
});
// C 고리: 기둥에 나사로 박은 판 + L자 고리
obj('C', (im) => {
  stamp(im, 152, 88, [
    'lc........',
    'll........',
    'lccccccl..',
    'lllllllcl.',
    'll.....ll.',
    'dl.....ll.',
    'll...dlld.',
    'll...ddd..',
    'dl........',
    'll........',
  ], { l: C.lint, c: C.cotton, d: C.lav });
});
// D 빨래 바구니: 엮은 결, 꼬인 테두리, 손잡이. 흰 셔츠 소매가 앞으로 늘어지고 분홍 양말이 삐져나왔다
obj('D', (im) => {
  const x0 = 144, x1 = 176, top = 223, bot = 236;
  fill(im, x0, top, x1 - x0, bot - top, (x, y) => {
    const inset = Math.floor((y - top) / 7);
    if (x < x0 + inset || x >= x1 - inset) return undefined;
    const row = Math.floor((y - top) / 3), lx = (x - x0 + (row % 2) * 2) % 4, ly = (y - top) % 3;
    let c = lx === 3 ? C.wood : ly === 0 ? C.tan : ly === 2 ? C.wood : C.woodL;
    if (x >= x1 - inset - 5) c = darker(c); // 오른쪽 그늘
    if (y === bot - 1) c = C.woodD;
    return c;
  });
  // 꼬인 테두리
  for (let x = x0 - 1; x < x1 + 1; x++) {
    im.set(x, 220, (x % 3) === 0 ? C.woodL : C.tan);
    im.set(x, 221, (x % 3) === 1 ? C.woodL : C.wood);
    im.set(x, 222, (x % 3) === 2 ? C.wood : C.woodD);
  }
  // 손잡이
  stamp(im, x0 - 3, 223, ['tt', 't.', 'tw'], { t: C.woodL, w: C.wood });
  stamp(im, x1 + 1, 223, ['ww', '.w', 'ww'], { w: C.wood });
  // 흰 셔츠 소매(앞으로 늘어짐, 소매 끝 단추)
  stamp(im, 149, 218, ['wwwww...', 'wwwwcc..', '.cwwwc..', '..cwwc..', '..cwwc..', '..cwcc..', '..llll..', '...lt...'], { w: C.white, c: C.cotton, l: C.lint, t: C.tealM });
  // 분홍 양말
  stamp(im, 164, 214, ['..qq', '.qQq', 'qqq.', 'pqq.', 'pp..', '.p..'], { q: C.pinkL, Q: C.white, p: C.pink });
});
// 바구니 접지 그림자(오른쪽 아래)
ellipse(bg, 164, 237, 18, 2, (x, y) => darker(bg.get(x, y)));

// ═════════════ 세 사람(3차 샘플 ②, 비교용) ═════════════
function readPng(file) {
  const buf = readFileSync(file);
  let p = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const row = w * bpp + 1;
  const key = new Map(PALETTE.map(([r, g, b], i) => [(r << 16) | (g << 8) | b, i]));
  const img = new Image(w, h);
  for (let y = 0; y < h; y++) {
    if (raw[y * row] !== 0) throw new Error('필터 0만 읽는다');
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * bpp;
      if (bpp === 3) img.c[y * w + x] = key.get((raw[o] << 16) | (raw[o + 1] << 8) | raw[o + 2]) ?? EMPTY;
      else img.c[y * w + x] = raw[o] >= 32 ? EMPTY : raw[o];
    }
  }
  return img;
}
const down = (img, s) => { const o = new Image(img.w / s, img.h / s); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, img.get(x * s, y * s)); return o; };
const people = new Image(W, H);
{
  const sheet = down(readPng(join(HERE, '../art/crew-v3b-4x.png')), 4);
  const BAND = 68, bgCol = new Set([C.cotton, C.lint]);
  const crew = new Image(sheet.w, BAND);
  for (let y = 0; y < BAND; y++) for (let x = 0; x < sheet.w; x++) crew.set(x, y, sheet.get(x, y));
  const st = [];
  for (let x = 0; x < crew.w; x++) st.push([x, 0]);
  for (let y = 0; y < BAND; y++) st.push([0, y], [crew.w - 1, y]);
  while (st.length) {
    const [x, y] = st.pop(); const c = crew.get(x, y);
    if (c === EMPTY || !bgCol.has(c)) continue;
    crew.set(x, y, EMPTY); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const cols = [];
  for (let x = 0; x < crew.w; x++) {
    let any = false;
    for (let y = 0; y < BAND; y++) if (crew.get(x, y) !== EMPTY) any = true;
    if (any && (!cols.length || cols[cols.length - 1][1] < x - 1)) cols.push([x, x]);
    else if (any) cols[cols.length - 1][1] = x;
  }
  if (cols.length !== 3) throw new Error(`세 사람을 못 찾음: ${cols.length}`);
  const AT = [[214, 244], [250, 244], [286, 244]];
  cols.forEach(([x0, x1], i) => {
    let foot = 0;
    for (let y = 0; y < BAND; y++) for (let x = x0; x <= x1; x++) if (crew.get(x, y) !== EMPTY) foot = Math.max(foot, y);
    const part = new Image(x1 - x0 + 1, foot + 1);
    for (let y = 0; y <= foot; y++) for (let x = x0; x <= x1; x++) part.set(x - x0, y, crew.get(x, y));
    // 엔진 그림자(보송 1번 plum, 너비 = 그림 폭 - 8, 높이 2)는 엔진이 그린다. 여기서는 모양만 흉내
    const sw = part.w - 8;
    R(people, AT[i][0] - (sw >> 1), AT[i][1] - 1, sw, 2, C.plum);
    people.blit(part, AT[i][0] - Math.floor(part.w / 2), AT[i][1] - foot, { flipAx: part.w / 2 });
  });
}

// ═════════════ 합치기 + 검사 ═════════════
const fg = new Image(W, H);
for (const [, im] of OBJ) fg.blit(outlined(im), 0, 0);
const scene = new Image(W, H);
scene.blit(bg, 0, 0); scene.blit(people, 0, 0); scene.blit(fg, 0, 0); scene.blit(fx, 0, 0);

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (img, x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const bgAll = count(bg, ...CROP);
check(!bgAll.has(C.ink) && !bgAll.has(C.hint), '배경에 ink(0)·hint(31) 없음');
const floorMain = [...count(bg, CROP[0], 214, CROP[2], 44)].sort((a, b) => b[1] - a[1])[0][0];
const MAIN = { '쭉이 셔츠': C.red, '쭉이 바지': C.dusk, '묵직이 멜빵': C.teal, '묵직이 셔츠': C.white, '삑삑이 우비': C.yel };
for (const [name, c] of Object.entries(MAIN)) check(Math.abs(Y[c] - Y[floorMain]) >= 30, `바닥 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[floorMain])}`);
const fenceMain = [...count(bg, 180, 160, 120, 30)].sort((a, b) => b[1] - a[1])[0][0];
for (const [name, c] of Object.entries({ '피부 밝은 단': C.tan, '피부 중간 단': C.woodL })) check(Math.abs(Y[c] - Y[fenceMain]) >= 30, `담장 주색 #${fenceMain}(Y${Y[fenceMain]}) vs ${name}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[fenceMain])}`);
console.log(`배경 잘라 낸 영역 색 수: ${bgAll.size}`);

// ═════════════ 출력 ═════════════
const crop = (img, [x0, y0, w, h]) => { const o = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(x, y, img.get(x0 + x, y0 + y)); return o; };
const sample = crop(scene, CROP);
writeFileSync(join(HERE, 'magpie_nest-density-1x.png'), indexedPng(sample, 1));
writeFileSync(join(HERE, 'magpie_nest-density-2x.png'), indexedPng(sample, 2));
writeFileSync(join(HERE, 'magpie_nest-density-nest-4x.png'), indexedPng(crop(scene, [112, 0, 80, 110]), 4));
// 비교: 구도 시안(#149) 같은 영역 | 샘플 (가운데 4px 레터박스색)
{
  const sketch = down(readPng(join(HERE, 'magpie_nest-bg-sketch-2x.png')), 2);
  const vs = new Image(CROP[2] * 2 + 4, CROP[3], C.ink);
  vs.blit(crop(sketch, CROP), 0, 0); vs.blit(sample, CROP[2] + 4, 0);
  writeFileSync(join(HERE, 'magpie_nest-density-vs-2x.png'), indexedPng(vs, 2));
}
{
  const S = 2, w = sample.w * S, h = sample.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[sample.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'magpie_nest-density-gray-2x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
console.log(`샘플 1배(인덱스 PNG): ${indexedPng(sample, 1).length} bytes`);
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
