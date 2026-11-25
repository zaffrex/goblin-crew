// 스테이지 3 `laundromat` 진입 반짝·셔터 올라감 미리보기 (#764, 물건 시트 2/2-c1). 시트 원본 art/scenes/laundromat.mjs의 SCENE을 그대로 그린다.
// 실행: node docs/design/screens/laundromat-glint-rollup-preview.mjs
// 출력(같은 폴더):
//   laundromat-glint-4x.png    `gap.glint` 4칸을 틈 둘레(80,222 44×24)만 잘라 4배로. 맨 앞은 멈춘 모습(비교용)
//   laundromat-rollup-2x.png   `shutter.roll_up` 5칸을 셔터 둘레(16,120 144×132)만 잘라 2배로. 맨 앞은 잠김 멈춘 모습
//   laundromat-rollup-1x.png   올라가는 중간 칸(rise 42)을 1배 전체 화면으로(실제 크기 확인용)
// 검사(어기면 종료 코드 1):
//   - glint: 별 픽셀이 셔터 틈에 잘리지 않는다(틈 마스크 전후 같은 수), 열쇠 픽셀은 큰 별의 빛 1px 말고는 안 바뀐다, 마지막 칸 = 멈춘 모습
//   - roll_up: 칸마다 판 아래 끝(손잡이 막대 줄)이 21px 넘게 안 뛴다(R3), 마지막 칸 = key.back 멈춘 모습(올라감), 합 ≤ 500ms(엔진 폴백 길이)

import { writeFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SCENE } from '../../../art/scenes/laundromat.mjs';
import { sparkStar } from '../../../art/scenes/laundromat.objects.mjs';
import { SHUTTER, gapLift } from '../../../art/scenes/laundromat.shutter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 480, H = 270;
const problems = [];
const A = SCENE.anims;

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
function strip(imgs) {
  const w = imgs[0].w, h = imgs[0].h;
  const o = new Image(imgs.length * (w + 1) - 1, h);
  o.c.fill(C.dusk);
  imgs.forEach((im, i) => o.blit(im, i * (w + 1), 0));
  return o;
}
const save = (name, img) => writeFileSync(join(HERE, name), indexedPng(img));
const only = (d) => { const t = new Image(W, H); d(t); return t; };
const sameImg = (a, b) => a.c.every((v, i) => v === b.c[i]);

// ── gap.glint
const glint = A['gap.glint'];
const gapRest = only(SCENE.objects.gap.draw);
const glintStrip = [gapRest, ...glint.frames.map(only)].map((f) => {
  const s = scene({}, { gap: null });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = f.get(x, y); if (c !== EMPTY) s.set(x, y, c); }
  return scale(crop(s, 80, 222, 44, 24), 4);
});
save('laundromat-glint-4x.png', strip(glintStrip));
for (const size of ['small', 'big']) {
  const raw = only((t) => sparkStar(t, 110, 234, size));
  const bottom = SHUTTER.y + SHUTTER.h;
  let cut = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw.get(x, y) !== EMPTY && !(y >= bottom - gapLift(x) && y < bottom)) cut++;
  if (cut) problems.push(`glint ${size} 별이 틈 밖으로 ${cut}px 잘림`);
}
glint.frames.forEach((fr, i) => {
  const f = only(fr);
  let changed = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = gapRest.get(x, y); if (r !== EMPTY && f.get(x, y) !== r) changed++; }
  if (changed > 1) problems.push(`glint 칸 ${i}: 열쇠 픽셀 ${changed}개 바뀜(빛 1px까지만)`);
});
if (!sameImg(only(glint.frames.at(-1)), gapRest)) problems.push('glint 마지막 칸이 멈춘 모습과 다름');

// ── shutter.roll_up
const roll = A['shutter.roll_up'];
const lockedRest = only(SCENE.objects.shutter.draw);
const upRest = only(SCENE.objects.shutter.states[0].draw);
const rollScenes = [lockedRest, ...roll.frames.map(only)].map((f) => {
  const s = scene({}, { shutter: null, gap: null });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = f.get(x, y); if (c !== EMPTY) s.set(x, y, c); }
  return s;
});
save('laundromat-rollup-2x.png', strip(rollScenes.map((s) => scale(crop(s, 16, 120, 144, 132), 2))));
save('laundromat-rollup-1x.png', rollScenes[2]);
// 판 아래 끝 = 가운데 열(x 60)에서 손잡이 막대 윗줄(cotton) y. 올라감은 통 밑 SHUTTER.y
const barY = (img) => { for (let y = SHUTTER.y + SHUTTER.h - 1; y >= SHUTTER.y; y--) if (img.get(60, y) === C.cotton && img.get(60, y + 1) === C.lav) return y; return null; };
const bars = [lockedRest, ...roll.frames.map(only)].map(barY);
for (let i = 1; i < bars.length; i++) if (bars[i] === null || bars[i - 1] - bars[i] > 21) problems.push(`roll_up 칸 ${i - 1}: 막대 ${bars[i - 1]} → ${bars[i]} (21px 넘음)`);
if (!sameImg(only(roll.frames.at(-1)), upRest)) problems.push('roll_up 마지막 칸이 key.back 멈춘 모습과 다름');
const rollMs = roll.ms.reduce((a, b) => a + b, 0);
if (rollMs > 500) problems.push(`roll_up 합 ${rollMs}ms > 500ms`);

console.log(`glint 칸 ${glint.frames.length} (${glint.ms.join('+')}ms), roll_up 막대 y ${bars.join(' → ')} (${rollMs}ms)`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('검사 통과');
