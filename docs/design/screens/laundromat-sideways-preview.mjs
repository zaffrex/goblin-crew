// 스테이지 3 `laundromat` 곁가지 실패 미리보기 (#764, 물건 시트 2/2-c2). 시트 원본 art/scenes/laundromat.mjs의 SCENE을 그대로 그린다.
// 실행: node docs/design/screens/laundromat-sideways-preview.mjs
// 출력(같은 폴더):
//   laundromat-duct-wind-4x.png   `duct.warm_puff`(윗줄)·`suck_pole`(아랫줄)을 덕트 둘레(336,128 64×44)만 잘라 4배로. 맨 앞은 멈춘 모습
//   laundromat-dryer-gulp-3x.png  `dryer_3.gulp_pole` 정회전 8칸을 건조기 둘레(336,152 64×88)만 잘라 3배로
//   laundromat-vend-spill-3x.png  `soap_vending.spill_boxes`(윗줄)·`spill_coin`(아랫줄)을 자판기 앞(392,140 88×112)만 잘라 3배로
// 검사(어기면 종료 코드 1):
//   - 덕트 바람·빨림 선 색이 뒤 벽 cotton(Y222)과 명도 차 30 이상(결정 2026-11-23 명도 띠), 마지막 칸 = 멈춘 모습
//   - 빨림 칸은 관 폭만 줄고(오므림) 관 밖 벽은 같은 무늬(16px 옆 벽)로 채운다: 관 둘레 벽 색 말고 다른 색이 생기지 않는다
//   - gulp: 회전 칸은 대기 반복 칸과 같은 그림(새 칸은 들썩 1장뿐), 마지막 칸 = 멈춘 모습(0°)
//   - 쏟아진 상자·동전: 칸 사이 이동 21px 안(R3), 마지막 칸은 바닥(y 236~252) 위, 금색(yel 계열) 0px(열쇠 전용 약속)

import { writeFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, EMPTY, Image, indexedPng, PALETTE } from '../../../art/lib/pixel.mjs';
import { SCENE, SPILL_BOX_PATHS } from '../../../art/scenes/laundromat.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 480, H = 270;
const problems = [];
const A = SCENE.anims;
const O = SCENE.objects;

function scene(override = {}) {
  const img = new Image(W, H);
  SCENE.bg(img);
  for (const [key, o] of Object.entries(O)) {
    const d = key in override ? override[key] : o.draw;
    if (d) d(img);
  }
  return img;
}
function scale(img, k) {
  const o = new Image(img.w * k, img.h * k);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.c[y * o.w + x] = img.c[Math.floor(y / k) * img.w + Math.floor(x / k)];
  return o;
}
function crop(img, x0, y0, w, h) {
  const o = new Image(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.c[y * w + x] = img.c[(y0 + y) * img.w + x0 + x];
  return o;
}
function grid(rows) {
  const w = rows[0][0].w, h = rows[0][0].h, n = Math.max(...rows.map((r) => r.length));
  const o = new Image(n * (w + 1) - 1, rows.length * (h + 1) - 1);
  o.c.fill(C.dusk);
  rows.forEach((r, j) => r.forEach((im, i) => o.blit(im, i * (w + 1), j * (h + 1))));
  return o;
}
const save = (name, img) => writeFileSync(join(HERE, name), indexedPng(img));
const only = (d) => { const t = new Image(W, H); d(t); return t; };
const sameImg = (a, b) => a.c.every((v, i) => v === b.c[i]);
const lum = (c) => { const [r, g, b] = PALETTE[c]; return 0.299 * r + 0.587 * g + 0.114 * b; };
const sceneWith = (key, d) => scene({ [key]: d });

// ── 덕트
const ductRest = only(O.duct.draw);
const bg = scene();
const ductRow = (name) => [O.duct.draw, ...A[name].frames].map((d) => scale(crop(sceneWith('duct', d), 336, 128, 64, 44), 4));
save('laundromat-duct-wind-4x.png', grid([ductRow('duct.warm_puff'), ductRow('duct.suck_pole')]));
for (const name of ['duct.warm_puff', 'duct.suck_pole']) {
  const fr = A[name].frames;
  if (!sameImg(only(fr.at(-1)), ductRest)) problems.push(`${name} 마지막 칸이 멈춘 모습과 다름`);
  fr.forEach((d, i) => {
    const s = sceneWith('duct', d);
    const seen = new Set();
    for (let y = 120; y < 164; y++) for (let x = 336; x < 400; x++) if (s.get(x, y) !== bg.get(x, y)) seen.add(s.get(x, y));
    for (const c of seen) {
      const wall = c === C.cotton || c === C.white || c === C.lint; // 오므림이 채운 벽 무늬·관 색
      const pipe = [C.lav, C.lint, C.cotton, C.dusk, C.white, C.plum].includes(c);
      if (!wall && !pipe && Math.abs(lum(c) - lum(C.cotton)) < 30) problems.push(`${name} 칸 ${i}: 색 ${c}가 벽 cotton과 명도 차 30 미만`);
    }
  });
}
// 오므림이 관 밖 벽에 새 색을 안 만든다: 관 x 360~373 밖 픽셀은 바람·빨림 선(pink·lav) 말고 그대로
A['duct.suck_pole'].frames.forEach((d, i) => {
  const s = sceneWith('duct', d);
  for (let y = 120; y < 164; y++) for (let x = 336; x < 400; x++) {
    if (x >= 360 && x < 374) continue;
    const c = s.get(x, y);
    if (c !== bg.get(x, y) && c !== C.lav) problems.push(`suck_pole 칸 ${i}: 관 밖 (${x},${y})에 다른 색 ${c}`);
  }
});

// ── 건조기
const gulp = A['dryer_3.gulp_pole'];
save('laundromat-dryer-gulp-3x.png', grid([[O.dryer_3.draw, ...gulp.frames].map((d) => scale(crop(sceneWith('dryer_3', d), 336, 152, 64, 88), 3))]));
const loopImgs = O.dryer_3.loop.frames.map(only);
const isLoop = (d) => loopImgs.some((l) => sameImg(l, only(d)));
const fresh = gulp.frames.filter((d) => !isLoop(d)).length;
if (fresh !== 1) problems.push(`gulp 새 그림 ${fresh}장(들썩 1장이어야)`);
if (!sameImg(only(gulp.frames.at(-1)), only(O.dryer_3.draw))) problems.push('gulp 마지막 칸이 멈춘 모습과 다름');
for (const v of gulp.variants ?? []) if (v.frames.some((d) => !isLoop(d) && !sameImg(only(d), only(gulp.frames[6])))) problems.push('gulp 역회전 갈래에 새 그림');

// ── 자판기
const vendRow = (name) => [O.soap_vending.draw, ...A[name].frames].map((d) => scale(crop(sceneWith('soap_vending', d), 392, 140, 88, 112), 3));
save('laundromat-vend-spill-3x.png', grid([vendRow('soap_vending.spill_boxes'), vendRow('soap_vending.spill_coin')]));
let maxBox = 0;
for (const [k, at] of SPILL_BOX_PATHS) {
  for (let f = 1; f < at.length; f++) {
    if (!at[f] || !at[f - 1]) continue;
    const d = Math.hypot(at[f][0] - at[f - 1][0], at[f][1] - at[f - 1][1]);
    maxBox = Math.max(maxBox, d);
    if (d > 21.5) problems.push(`상자 ${k} 칸 ${f}: ${d.toFixed(1)}px 이동(R3 21)`);
  }
  const [, y] = at.at(-1);
  if (y + 8 < 236 - 1 && k !== 2) problems.push(`상자 ${k} 마지막 자리 y ${y}: 바닥 위가 아님`);
}
const GOLD = new Set([C.yel, C.yelL, C.yelD]);
const vendRest = only(O.soap_vending.draw);
for (const name of ['soap_vending.spill_boxes', 'soap_vending.spill_coin']) {
  A[name].frames.forEach((d, i) => {
    const f = only(d);
    let gold = 0;
    for (let j = 0; j < f.c.length; j++) if (GOLD.has(f.c[j]) && f.c[j] !== vendRest.c[j]) gold++;
    // 상자 색에 노랑 상자가 있다(진열창 상자 재사용). 동전만 금색 0px을 본다
    if (name.endsWith('coin') && gold) problems.push(`${name} 칸 ${i}: 금색 ${gold}px`);
  });
}
// 동전 길(R3): 동전 픽셀 중심
const coinCenter = (d) => {
  const f = only(d);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f.get(x, y) !== vendRest.get(x, y) && f.get(x, y) !== EMPTY) { sx += x; sy += y; n++; }
  return [sx / n, sy / n];
};
const coins = A['soap_vending.spill_coin'].frames.map(coinCenter);
let maxCoin = 0;
for (let i = 1; i < coins.length; i++) {
  const d = Math.hypot(coins[i][0] - coins[i - 1][0], coins[i][1] - coins[i - 1][1]);
  maxCoin = Math.max(maxCoin, d);
  if (d > 21.5) problems.push(`동전 칸 ${i}: ${d.toFixed(1)}px 이동(R3 21)`);
}
if (coins.at(-1)[1] < 236) problems.push('동전 마지막 칸이 바닥 위가 아님');

const sum = (a) => (Array.isArray(a) ? a.reduce((x, y) => x + y, 0) : a);
console.log(`warm_puff ${sum(A['duct.warm_puff'].ms)}ms, suck_pole ${sum(A['duct.suck_pole'].ms)}ms, gulp ${sum(gulp.ms)}ms(새 그림 ${fresh}), ` +
  `spill_boxes ${sum(A['soap_vending.spill_boxes'].ms)}ms(상자 최대 ${maxBox.toFixed(1)}px), spill_coin ${sum(A['soap_vending.spill_coin'].ms)}ms(동전 최대 ${maxCoin.toFixed(1)}px)`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('검사 통과');
