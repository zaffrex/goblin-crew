// 스테이지 3 `laundromat` 3번 건조기 반응 미리보기 (#764, 물건 시트 2/2-a). 시트 원본 art/scenes/laundromat.mjs의 SCENE을 그대로 그린다.
// 실행: node docs/design/screens/laundromat-dryer-burst-preview.mjs
// 출력(같은 폴더):
//   laundromat-dryer-spin-4x.png   드럼 회전 줄(4배): 정회전 반복 3칸 / 역회전 반복 3칸
//   laundromat-dryer-burst-4x.png  문 벌컥 줄(4배): burst 5칸 / burst#2 2칸 + door_bang 3칸
//   laundromat-dryer-head-4x.png   머리 위 양말(4배): ズッシー가 건조기 왼쪽(x 325, 오른쪽 봄)·오른쪽(x 411, 왼쪽 봄)에 서서 sock_head 4칸
//   laundromat-dryer-burst-1x.png  행렬 가운데 칸(병뚜껑이 떠 있는 칸)을 1배 전체 화면으로(블라인드·실제 크기 확인용)
// 검사(어기면 종료 코드 1):
//   - 드럼 회전 3칸은 서로 다르고, 0°·120°가 같다(무리 셋이 같아야 끊김 없이 돈다)
//   - 열린 문 칸은 넓힌 상자(x 336~391, 외곽선 1px 포함 335~392) 밖에 픽셀이 없다. 날아다니는 것은 화면 안(위 끝 y ≥ 140)이다
//   - 머리 위 양말 마지막 칸(얹힌 모습)은 ズッシー 눈 줄(얼굴 상자 위 끝 + 14)을 안 가리고, 털모자와 겹친다(떠 있지 않다)
//   - 병뚜껑이 떠 있는 칸에서 병뚜껑은 뒤(건조기·벽)와 외곽선으로 갈라진다(병뚜껑 픽셀 수 ≥ 25)

import { writeFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SCENE } from '../../../art/scenes/laundromat.mjs';
import { dryer, DRUM_STEP } from '../../../art/scenes/laundromat.dryer.mjs';
import { ANCHOR_ORIGIN } from '../../../art/scene-build.mjs';
import { drawFrame, pose } from '../../../art/sprites/mukjik.mjs';

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
function strip(imgs, cols = imgs.length) {
  const w = imgs[0].w, h = imgs[0].h, rows = Math.ceil(imgs.length / cols);
  const o = new Image(cols * (w + 1) - 1, rows * (h + 1) - 1);
  o.c.fill(C.dusk);
  imgs.forEach((im, i) => o.blit(im, (i % cols) * (w + 1), Math.floor(i / cols) * (h + 1)));
  return o;
}
const save = (name, img) => writeFileSync(join(HERE, name), indexedPng(img));
const only = (d) => { const t = new Image(W, H); d(t); return t; };
const same = (a, b) => a.c.every((v, i) => v === b.c[i]);

// ── 1. 드럼 회전
const DWIN = [332, 150, 64, 92];
const rev = { 'dryer.reverse': true };
const spinRows = [
  ...SCENE.objects.dryer_3.loop.frames.map((d) => crop(scene({}, { dryer_3: d }), ...DWIN)),
  ...SCENE.objects.dryer_3.states[0].loop.frames.map((d) => crop(scene(rev, { dryer_3: d }), ...DWIN)),
];
save('laundromat-dryer-spin-4x.png', scale(strip(spinRows, 3), 4));
{
  const pic = (a) => { const t = new Image(W, H); dryer(t, 344, 164, { spin: a }); return t; };
  const [p0, p1, p2, p3] = [0, 1, 2, 3].map((k) => pic(k * DRUM_STEP));
  if (same(p0, p1) || same(p1, p2) || same(p0, p2)) problems.push('드럼 회전 칸 셋 중 같은 칸이 있다');
  if (!same(p0, p3)) problems.push('드럼 0°와 120°가 다르다(반복이 튄다)');
}

// ── 2. 문 벌컥
const burstRows = [
  ...A['dryer_3.burst'].frames.map((d) => crop(scene(rev, { dryer_3: d }), ...DWIN)),
  ...A['dryer_3.burst#2'].frames.map((d) => crop(scene(rev, { dryer_3: d }), ...DWIN)),
  ...A['dryer_3.door_bang'].frames.map((d) => crop(scene(rev, { dryer_3: d }), ...DWIN)),
];
save('laundromat-dryer-burst-4x.png', scale(strip(burstRows, 5), 4));
save('laundromat-dryer-burst-1x.png', scene(rev, { dryer_3: A['dryer_3.burst'].frames[2] }));
for (const [name, frames] of [['burst', A['dryer_3.burst'].frames], ['burst#2', A['dryer_3.burst#2'].frames], ['door_bang', A['dryer_3.door_bang'].frames]])
  frames.forEach((d, i) => {
    const t = only(d);
    let top = H, left = W, right = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY) { top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }
    if (top < 140) problems.push(`${name}[${i}]: 위 끝 y ${top} < 140`);
    if (left < 335 || right > 392) problems.push(`${name}[${i}]: 가로 ${left}~${right}가 x 335~392(외곽선 포함) 밖`);
  });
{
  // 병뚜껑이 떠 있는 칸: 은색(lint·white) 중 건조기 위 끝(164) 위에 있는 픽셀 = 병뚜껑
  const t = only(A['dryer_3.burst'].frames[2]);
  let cap = 0;
  for (let y = 168; y < 182; y++) for (let x = 362; x < 374; x++) if ([C.lint, C.white, C.lav].includes(t.get(x, y))) cap++;
  if (cap < 25) problems.push(`burst[2] 병뚜껑 픽셀 ${cap} < 25`);
}

// ── 3. 머리 위 양말: ズッシー 서 있기 칸 + anchor 칸(엔진 headPlace와 같은 규칙: 얼굴 상자 위 가운데 + at, 왼쪽을 보면 그 세로줄로 뒤집기)
const { K } = drawFrame(pose('stand', 0));
K.outline();
const AXC = 27, FACE = [12, 2, 24, 24]; // public/sprites/mukjik-base.json anchor·head
const [OX, OY] = ANCHOR_ORIGIN;
function withHead(feetX, facing, frame) {
  const img = scene(rev);
  const x0 = feetX - AXC, y0 = 244 - 64;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 48; x++) {
      const c = K.get(x, y);
      if (c === EMPTY) continue;
      img.set(facing > 0 ? x0 + x : feetX + (AXC - 1 - x), y0 + y, c);
    }
  // 얼굴 상자 위 가운데(오른쪽 봄): x0 + 12 + 12. 왼쪽 봄은 발 축으로 뒤집은 상자의 가운데
  const fcx = facing > 0 ? x0 + FACE[0] + FACE[2] / 2 : feetX + AXC - FACE[0] - FACE[2] / 2;
  const fty = y0 + FACE[1];
  const t = only(frame);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = t.get(x, y);
      if (c === EMPTY) continue;
      const rx = x - OX, ry = y - OY;
      const sx = facing > 0 ? fcx + rx : fcx - 1 - rx;
      if (sx >= 0 && sx < W && fty + ry >= 0 && fty + ry < H) img.set(sx, fty + ry, c);
    }
  return img;
}
const SH = A['dryer_3.sock_head'].frames;
const headRows = [
  ...SH.map((d) => crop(withHead(325, 1, d), 290, 140, 96, 64)),
  ...SH.map((d) => crop(withHead(411, -1, d), 358, 140, 96, 64)),
];
save('laundromat-dryer-head-4x.png', scale(strip(headRows, 4), 4));
{
  const t = only(SH.at(-1));
  let low = 0, overCap = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (t.get(x, y) === EMPTY) continue;
      const ry = y - OY, sx = x - OX + AXC - 3; // 오른쪽 봄 칸 안 x(얼굴 상자 가운데 = 칸 x 24)
      if (ry >= 14) low++;
      const kx = sx, ky = FACE[1] + ry;
      if (kx >= 0 && kx < 48 && ky >= 0 && ky < 64 && K.get(kx, ky) !== EMPTY) overCap++;
    }
  if (low) problems.push(`sock_head 마지막 칸: 눈 줄(+14) 아래 ${low}px`);
  if (overCap < 10) problems.push(`sock_head 마지막 칸: 머리와 겹치는 픽셀 ${overCap} < 10(떠 있다)`);
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('ok: 드럼 회전·문 벌컥·머리 위 양말 미리보기, 검사 통과');
