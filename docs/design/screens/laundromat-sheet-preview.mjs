// 스테이지 3 `laundromat` 물건 시트 미리보기 (#764, 시트 1/2). 시트 원본 art/scenes/laundromat.mjs의 SCENE을 그대로 그린다.
// 실행: node docs/design/screens/laundromat-sheet-preview.mjs
// 출력(같은 폴더):
//   laundromat-sheet-2x.png      시작 화면(배경 + 물건 멈춘 모습) 2배. 회색 상자 없이 다 그려졌는지
//   laundromat-sheet-states.png  플래그 상태 넷(시작 / key.in_nest / key.stuck / key.back) 1배 2×2
//   laundromat-sheet-window-4x.png 들창 칸 anim 줄(4배): fly_out(시작·클리어) · fly_in · perch_drop · ruffle · snub#2
//   laundromat-sheet-gap-4x.png  틈 anim 줄(4배): nudge · snatch
// 검사(어기면 종료 코드 1):
//   - 시작 화면에서 물건 그림이 히트 상자 밖 바닥(y ≥ 244, 셔터 빛 띠 자리)에 ink를 안 찍는다(바닥 쪽 외곽선 뺌)
//   - 창 안 날기 칸은 들창 왼쪽 칸(x 60~85, y 24~71) 밖에 한 픽셀도 없다(벽 뒤, E3)
//   - nudge 칸 열쇠 픽셀은 셔터 판 위에 0px(틈 안만, PR #929 Theo 리뷰)

import { writeFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SCENE } from '../../../art/scenes/laundromat.mjs';
import { TRANSOM } from '../../../art/scenes/laundromat.room.mjs';
import { SHUTTER, gapLift } from '../../../art/scenes/laundromat.shutter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 480, H = 270;
const problems = [];

/** 플래그에서 그 물건이 쓰는 그림(states 첫 일치, 없으면 draw). null이면 안 그림 */
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
/** 같은 크기 그림들을 가로로 1px 틈(dusk)과 함께 잇는다 */
function strip(imgs, cols = imgs.length) {
  const w = imgs[0].w, h = imgs[0].h, rows = Math.ceil(imgs.length / cols);
  const o = new Image(cols * (w + 1) - 1, rows * (h + 1) - 1);
  o.c.fill(C.dusk);
  imgs.forEach((im, i) => o.blit(im, (i % cols) * (w + 1), Math.floor(i / cols) * (h + 1)));
  return o;
}
const save = (name, img) => writeFileSync(join(HERE, name), indexedPng(img));

// ── 1. 시작 화면
const start = scene();
save('laundromat-sheet-2x.png', scale(start, 2));
{
  const bgOnly = new Image(W, H);
  SCENE.bg(bgOnly);
  let ink = 0;
  for (let y = 244; y < H; y++) for (let x = 0; x < W; x++) if (start.get(x, y) === C.ink && bgOnly.get(x, y) !== C.ink) ink++;
  if (ink) problems.push(`시작 화면 바닥(y ≥ 244)에 물건 ink ${ink}px`);
}

// ── 2. 상태 넷
const STATES = [{}, { 'key.in_nest': true }, { 'key.stuck': true, 'dryer.reverse': true }, { 'key.back': true }];
save('laundromat-sheet-states.png', strip(STATES.map((f) => scene(f)), 2));

// ── 3. 들창 칸 anim (창 둘레 64×64를 4배)
const A = SCENE.anims;
const WIN = [52, 16, 68, 52];
const frameScene = (key, draw, flags = {}) => crop(scene(flags, { [key]: draw }), ...WIN);
const winRows = [];
const fo = A['magpie.fly_out'];
winRows.push(...fo.frames.map((d) => frameScene('magpie', d)));
winRows.push(...fo.variants[0].frames.map((d) => frameScene('magpie', d, { 'key.back': true })));
winRows.push(...A['magpie.fly_in'].frames.map((d) => frameScene('magpie', d)));
winRows.push(...A['magpie.perch_drop'].frames.map((d) => frameScene('magpie', d, { 'key.back': true })));
winRows.push(...A['magpie.ruffle'].frames.map((d) => frameScene('magpie', d)));
winRows.push(...A['magpie.snub#2'].frames.map((d) => frameScene('magpie', d)));
save('laundromat-sheet-window-4x.png', scale(strip(winRows, 8), 4));

// 창 안 날기 칸 검사: 그 칸만 빈 화면에 그려 창 칸 밖 픽셀을 센다
const PANE = { x0: TRANSOM.paneL.x, x1: TRANSOM.paneL.x + TRANSOM.paneL.w, y0: TRANSOM.inY, y1: TRANSOM.inY + TRANSOM.inH };
for (const [name, frames] of [['fly_out', fo.frames], ['fly_out(key.back)', fo.variants[0].frames], ['fly_in', A['magpie.fly_in'].frames]])
  frames.forEach((d, i) => {
    const t = new Image(W, H);
    d(t);
    let out = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY && (x < PANE.x0 || x >= PANE.x1 || y < PANE.y0 || y >= PANE.y1)) out++;
    if (out) problems.push(`${name}[${i}]: 창 칸 밖 ${out}px`);
  });

// ── 4. 틈 anim (틈 둘레 48×24를 4배)
const GAPWIN = [80, 224, 48, 22];
const gapRows = [
  ...A['gap.nudge'].frames.map((d) => crop(scene({}, { gap: d }), ...GAPWIN)),
  ...A['gap.snatch'].frames.map((d) => crop(scene({}, { gap: d }), ...GAPWIN)),
  crop(scene({ 'key.in_nest': true }), ...GAPWIN),
];
save('laundromat-sheet-gap-4x.png', scale(strip(gapRows, 4), 4));
const bottom = SHUTTER.y + SHUTTER.h;
A['gap.nudge'].frames.forEach((d, i) => {
  const t = new Image(W, H);
  d(t);
  let on = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY && y < bottom - gapLift(x)) on++;
  if (on) problems.push(`gap.nudge[${i}]: 셔터 판 위 ${on}px`);
});

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('ok: 시작 화면·상태 넷·창 anim·틈 anim 미리보기, 검사 통과');
