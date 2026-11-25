// 스테이지 3 `laundromat` 머리 위 깃털·둥지 모자 미리보기 (#764, 물건 시트 2/2-b). 시트 원본 art/scenes/laundromat.mjs의 SCENE을 그대로 그린다.
// 실행: node docs/design/screens/laundromat-head-hat-preview.mjs
// 출력(같은 폴더):
//   laundromat-head-feather-4x.png  깃털 줄(4배): feather_puff 2칸(건조기) / ズッシー x 325(오른쪽 봄)·411(왼쪽 봄)에서 feather_head 2칸
//   laundromat-head-nest-4x.png     둥지 모자 줄(4배): nest_hat 3칸 + hat_perch 3칸(둥지 모자 위), 두 방향
//   laundromat-head-nest-1x.png     클리어 끝 모습(둥지 모자 + 까치)을 1배 전체 화면으로(실제 크기 확인용)
// 검사(어기면 종료 코드 1):
//   - feather_puff 칸은 건조기 상자(외곽선 포함 x 343~392) 안, 위 끝 y ≥ 140
//   - 머리 위 끝 칸(꽂힌 깃털·둥지 모자·까치) 셋 다 ズッシー 눈 줄(얼굴 상자 위 끝 + 14)을 0px 가리고, 털모자와 겹친다(떠 있지 않다)
//   - 까치가 앉아도 둥지 모자의 금색 고리(yel·yelL) 픽셀이 하나도 안 줄어든다(ノビー가 집을 열쇠가 보인다)
//   - 발 y 244(걷기 영역 위 끝)에서 머리 위 더미 위 끝이 화면 안(y ≥ 0)이다

import { writeFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SCENE } from '../../../art/scenes/laundromat.mjs';
import { ANCHOR_ORIGIN } from '../../../art/scene-build.mjs';
import { drawFrame, pose } from '../../../art/sprites/mukjik.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 480, H = 270;
const problems = [];
const A = SCENE.anims;
const FEET_Y = 244;

function drawFor(o, flags) {
  for (const s of o.states ?? []) if (Object.entries(s.when.flags).every(([k, v]) => (flags[k] ?? false) === v)) return s.draw;
  return o.draw;
}
function scene(flags = {}, override = {}) {
  const img = new Image(W, H);
  SCENE.bg(img);
  for (const [key, o] of Object.entries(SCENE.objects)) {
    const d = key in override ? override[key] : drawFor(o, flags);
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
function strip(imgs, cols = imgs.length) {
  const w = imgs[0].w, h = imgs[0].h, rows = Math.ceil(imgs.length / cols);
  const o = new Image(cols * (w + 1) - 1, rows * (h + 1) - 1);
  o.c.fill(C.dusk);
  imgs.forEach((im, i) => o.blit(im, (i % cols) * (w + 1), Math.floor(i / cols) * (h + 1)));
  return o;
}
const save = (name, img) => writeFileSync(join(HERE, name), indexedPng(img));
const only = (d) => { const t = new Image(W, H); d(t); return t; };
const pixels = (img, f) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = img.get(x, y); if (c !== EMPTY && f(x, y, c)) out.push([x, y, c]); } return out; };

// ── ズッシー 서 있기 칸 + 머리 위 칸(엔진 headPlace 규칙: 얼굴 상자 위 가운데 + at, 왼쪽을 보면 그 세로줄로 뒤집기)
const { K } = drawFrame(pose('stand', 0));
K.outline();
const AXC = 27, FACE = [12, 2, 24, 24]; // public/sprites/mukjik-base.json anchor·head
const [OX, OY] = ANCHOR_ORIGIN;
/** 머리 위 칸 픽셀 → 화면 좌표 */
function placeHead(img, feetX, facing, frame) {
  const x0 = feetX - AXC;
  const fcx = facing > 0 ? x0 + FACE[0] + FACE[2] / 2 : feetX + AXC - FACE[0] - FACE[2] / 2;
  const fty = FEET_Y - 64 + FACE[1];
  for (const [x, y, c] of pixels(only(frame), () => true)) {
    const rx = x - OX, ry = y - OY;
    const sx = facing > 0 ? fcx + rx : fcx - 1 - rx;
    if (sx >= 0 && sx < W && fty + ry >= 0 && fty + ry < H) img.set(sx, fty + ry, c);
  }
}
function withHead(feetX, facing, flags, ...frames) {
  const img = scene(flags, { magpie: flags['key.back'] ? null : undefined });
  const x0 = feetX - AXC, y0 = FEET_Y - 64;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 48; x++) {
      const c = K.get(x, y);
      if (c !== EMPTY) img.set(facing > 0 ? x0 + x : feetX + (AXC - 1 - x), y0 + y, c);
    }
  for (const f of frames) placeHead(img, feetX, facing, f);
  return img;
}
const rev = { 'dryer.reverse': true };
const done = { 'dryer.reverse': true, 'key.back': true };
const WIN = { 325: [282, 140, 80, 76], 411: [374, 140, 80, 76] };
const both = (flags, list) => [
  ...list.map((fs) => crop(withHead(325, 1, flags, ...fs), ...WIN[325])),
  ...list.map((fs) => crop(withHead(411, -1, flags, ...fs), ...WIN[411])),
];

// ── 1. 깃털
const DWIN = [332, 150, 64, 76];
const FP = A['dryer_3.feather_puff'].frames, FH = A['dryer_3.feather_head'].frames;
const featherRows = [
  ...FP.map((d) => crop(scene(rev, { dryer_3: d }), ...DWIN)),
  ...both(rev, FH.map((d) => [d])).map((im) => crop(im, 8, 0, 64, 76)),
];
save('laundromat-head-feather-4x.png', scale(strip(featherRows, 6), 4));
FP.forEach((d, i) => {
  const px = pixels(only(d), () => true);
  const top = Math.min(...px.map((p) => p[1])), left = Math.min(...px.map((p) => p[0])), right = Math.max(...px.map((p) => p[0]));
  if (top < 140) problems.push(`feather_puff[${i}]: 위 끝 y ${top} < 140`);
  if (left < 343 || right > 392) problems.push(`feather_puff[${i}]: 가로 ${left}~${right}가 x 343~392 밖`);
});

// ── 2. 둥지 모자 + 까치
const NH = A['dryer_3.nest_hat'].frames, HP = A['magpie.hat_perch'].frames;
const nestRows = both(done, [...NH.map((d) => [d]), ...HP.map((d) => [NH.at(-1), d])]);
save('laundromat-head-nest-4x.png', scale(strip(nestRows, 6), 4));
save('laundromat-head-nest-1x.png', withHead(325, 1, done, NH.at(-1), HP.at(-1)));

// ── 3. 끝 칸 검사(오른쪽 봄 기준, 칸 안 좌표: 얼굴 상자 가운데 = 칸 x 24)
function onHead(frame, name) {
  let low = 0, over = 0;
  for (const [x, y] of pixels(only(frame), () => true)) {
    const ry = y - OY, kx = x - OX + FACE[0] + FACE[2] / 2, ky = FACE[1] + ry;
    if (ry >= 14) low++;
    if (kx >= 0 && kx < 48 && ky >= 0 && ky < 64 && K.get(kx, ky) !== EMPTY) over++;
  }
  if (low) problems.push(`${name} 끝 칸: 눈 줄(+14) 아래 ${low}px`);
  if (over < 3) problems.push(`${name} 끝 칸: 머리와 겹치는 픽셀 ${over} < 3(떠 있다)`);
  return over;
}
onHead(FH.at(-1), 'feather_head');
onHead(NH.at(-1), 'nest_hat');
{
  const gold = (img) => pixels(img, (x, y, c) => c === C.yel || c === C.yelL).length;
  const hat = only(NH.at(-1));
  const both2 = only(NH.at(-1));
  HP.at(-1)(both2);
  if (gold(both2) < gold(hat)) problems.push(`hat_perch: 까치가 둥지 모자 금색 고리 ${gold(hat) - gold(both2)}px를 가린다`);
  const stack = pixels(both2, () => true);
  const top = Math.min(...stack.map((p) => p[1])) - OY + FEET_Y - 64 + FACE[1];
  if (top < 0) problems.push(`발 y ${FEET_Y}에서 머리 위 더미 위 끝 y ${top} < 0`);
  console.log(`머리 위 더미 위 끝(발 y ${FEET_Y}): y ${top}`);
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('ok: 머리 위 깃털·둥지 모자 미리보기, 검사 통과');
