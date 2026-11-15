// 화면 1 물건 시트 ③ 미리보기·검사 (#145). 원본: art/scenes/magpie_nest.objects.mjs
// 빌드와 같은 buildScene()으로 시트를 만든 뒤, **시트에서 잘라 `at`에 붙여** 화면을 다시 조립한다(엔진이 할 일과 같은 경로).
// 실행: node docs/design/screens/magpie_nest-objects-preview.mjs
// 출력(같은 폴더):
//   magpie_nest-objects-1x.png       배경 + 물건, 시작 상태(실제 크기)
//   magpie_nest-objects-2x.png       같은 그림 2배
//   magpie_nest-objects-states-4x.png  상태별 크롭 4배: 위 = 둥지 위 까치 U8 3장 + 열쇠 반짝임 3장 / 아래 = 바닥 까치 U8 3장 + 열쇠 집은 뒤 둥지
//   magpie_nest-objects-loop-3x.png  둥지·까치 반복을 실제 ms로 돌린 움직이는 그림(APNG) 3배
//   magpie_nest-objects-basket-4x.png  바구니 앞판 확인: 바구니 안 사람(발 235)은 허리 위만, 앞을 지나는 사람(발 244)은 다 보인다
//   magpie_nest-objects-gray-2x.png  명도(흑백) 2배 (ADR-0007 결정 3-6)
// 검사(어기면 종료 코드 1): buildScene 문제 0건, 금색(yel 계열)은 열쇠·반짝임에만, 열쇠 몸통이 1배에서 7×12 이상,
//   고리 갈고리 아래 끝이 손 기준점 y(100), 바닥 까치 발이 바닥 히트 박스 안.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { SCENE, W, H } from '../../../art/scenes/magpie_nest.mjs';
import { buildScene } from '../../../art/scene-build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const screen = JSON.parse(readFileSync(join(ROOT, 'content', 'screens', 'magpie_nest.json'), 'utf8'));
const r = buildScene(SCENE, screen);

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
check(r.problems.length === 0, `buildScene 검사 문제 0건${r.problems.length ? `: ${r.problems.join(' / ')}` : ''}`);
if (!r.meta) { console.error('물건 시트가 없다'); process.exit(1); }
const { meta, sheet } = r;

/** 시트의 프레임 i를 dst에 `at`으로 붙인다 */
function put(dst, i, dx = 0, dy = 0) {
  const [sx, sy, sw, sh] = meta.frames[i].src, [ax, ay] = meta.frames[i].at;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const c = sheet.get(sx + x, sy + y);
    if (c !== EMPTY) dst.set(ax + x + dx, ay + y + dy, c);
  }
}
/** flags에서 물건의 멈춘 모습(첫 일치 state, 없으면 default) */
const pose = (o, flags) => o.states?.find((s) => Object.entries(s.when.flags).every(([k, v]) => flags[k] === v)) ?? o.default;
/** 반복 시계 t(ms)에서 고를 프레임 */
function loopFrame(p, t) {
  if (!p.loop) return p.frame;
  const total = p.loop.ms.reduce((a, b) => a + b, 0);
  let u = t % total;
  for (let i = 0; i < p.loop.ms.length; i++) { if (u < p.loop.ms[i]) return p.loop.frames[i]; u -= p.loop.ms[i]; }
  return p.loop.frames[0];
}

/** 화면 조립(형식 6절 순서): 배경 → back 물건 → 사람·overlay(발 y 순) → front 물건 */
function compose(flags, t = 0, people = []) {
  const img = new Image(W, H);
  img.blit(r.bg, 0, 0);
  for (const o of meta.objects) { const p = pose(o, flags); if (p.layer === 'back') put(img, loopFrame(p, t)); }
  const sorted = [
    ...people.map((d) => ({ y: d.footY, draw: () => d.draw(img) })),
    ...meta.objects.filter((o) => o.overlay).map((o) => ({ y: o.overlay.sortY + 0.5, draw: () => put(img, o.overlay.frame) })),
  ].sort((a, b) => a.y - b.y);
  for (const s of sorted) s.draw();
  for (const o of meta.objects) { const p = pose(o, flags); if (p.layer === 'front') put(img, loopFrame(p, t)); }
  return img;
}
const START = { ...screen.flags };
const GROUND = { ...START, 'magpie.on_ground': true };
const TAKEN = { ...GROUND, 'nest.key_taken': true };

// ── 검사
{
  // 금색은 열쇠 전용(#149 리뷰 a): yel·yelD·yelL은 nest 프레임에만
  const gold = new Set([C.yel, C.yelD, C.yelL]);
  const nest = meta.objects.find((o) => o.key === 'nest');
  const nestFrames = new Set([nest.default.frame, ...(nest.default.loop?.frames ?? [])]);
  const stray = meta.frames.flatMap((f, i) => {
    if (nestFrames.has(i)) return [];
    const [sx, sy, sw, sh] = f.src;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (gold.has(sheet.get(sx + x, sy + y))) return [i];
    return [];
  });
  check(stray.length === 0, `금색은 열쇠(둥지 프레임)에만 (다른 프레임 ${stray.length}장)`);
  // 열쇠가 읽히는 크기: 1배 화면에서 yel 계열 픽셀의 범위
  const img = compose(START);
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 26; y < 50; y++) for (let x = 140; x < 160; x++) if (img.get(x, y) === C.yel || img.get(x, y) === C.yelL) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  check(x1 - x0 + 1 >= 5 && y1 - y0 + 1 >= 12, `열쇠 1배 크기 ${x1 - x0 + 1}×${y1 - y0 + 1} (금색 범위, 목표 5×12 이상. #154는 5×9)`);
  // 고리: 갈고리 아래 끝 = 손 기준점 y
  const hook = meta.objects.find((o) => o.key === 'hook');
  const [, hy, , hh] = [...meta.frames[hook.default.frame].at, ...meta.frames[hook.default.frame].src.slice(2)];
  check(hy + hh - 1 >= 97 && hy + hh - 1 <= 100, `고리 그림 아래 끝 y ${hy + hh - 1} (손 기준점 ${SCENE.grips.hook[1]}에서 3px 안)`);
  // 바닥 까치 발: 바닥 히트 박스 안
  const mg = meta.objects.find((o) => o.key === 'magpie').states[0];
  const f = meta.frames[mg.frame];
  const [bx, by, bw, bh] = screen.hotspots.magpie.variants[0].box;
  const footY = f.at[1] + f.src[3] - 1;
  check(f.at[0] >= bx - 4 && f.at[0] + f.src[2] <= bx + bw + 4 && footY <= by + bh && footY >= by + bh - 4, `바닥 까치 그림 [${f.at},${f.src[2]}×${f.src[3]}] 발 y ${footY}가 히트 박스 [${bx},${by},${bw},${bh}] 아래 끝 근처`);
  console.log(`시트 ${sheet.w}×${sheet.h}, 그림 ${meta.frames.length}장, PNG ${(indexedPng(sheet).length / 1024).toFixed(1)}KB`);
}

// ── 출력
const crop = (img, [x0, y0, w, h]) => { const o = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(x, y, img.get(x0 + x, y0 + y)); return o; };
const start = compose(START);
writeFileSync(join(HERE, 'magpie_nest-objects-1x.png'), indexedPng(start, 1));
writeFileSync(join(HERE, 'magpie_nest-objects-2x.png'), indexedPng(start, 2));

// 상태별 크롭 4배: 위 줄 둥지 영역 6장, 아래 줄 바닥 까치 3장 + 집은 뒤 둥지
{
  const NEST_CROP = [124, 4, 46, 50], GROUND_CROP = [80, 206, 46, 36];
  const gap = 2, cw = 46, rowA = 50, rowB = 50;
  const out = new Image(gap + 6 * (cw + gap), gap * 3 + rowA + rowB, C.ink);
  const nestLoop = meta.objects.find((o) => o.key === 'nest').default.loop;
  const magLoop = meta.objects.find((o) => o.key === 'magpie');
  const at = (k, row) => [gap + k * (cw + gap), row ? gap * 2 + rowA : gap];
  // 위: 까치 U8 0·1·2 (반짝임 꺼짐), 반짝임 0·1·2 (까치 smug)
  for (let k = 0; k < 3; k++) {
    const t = magLoop.default.loop.ms.slice(0, k).reduce((a, b) => a + b, 0); // 까치 프레임 k가 보이는 시각
    const img = new Image(W, H); img.blit(r.bg, 0, 0); put(img, nestLoop.frames[0]); put(img, loopFrame(magLoop.default, t));
    put(img, meta.objects.find((o) => o.key === 'hook').default.frame);
    out.blit(crop(img, NEST_CROP), ...at(k, 0));
  }
  for (let k = 0; k < 3; k++) {
    const img = new Image(W, H); img.blit(r.bg, 0, 0); put(img, nestLoop.frames[k]); put(img, magLoop.default.loop.frames[0]);
    put(img, meta.objects.find((o) => o.key === 'hook').default.frame);
    out.blit(crop(img, NEST_CROP), ...at(3 + k, 0));
  }
  // 아래: 바닥 까치 U8 0·1·2, 열쇠 집은 뒤 둥지(까치는 바닥)
  const st = magLoop.states[0];
  for (let k = 0; k < 3; k++) {
    const img = new Image(W, H); img.blit(r.bg, 0, 0); put(img, st.loop.frames[k]);
    const c = crop(img, GROUND_CROP), [ox, oy] = at(k, 1);
    out.blit(c, ox, oy + (rowB - GROUND_CROP[3]) / 2);
  }
  {
    const img = compose(TAKEN);
    const [ox, oy] = at(3, 1);
    out.blit(crop(img, NEST_CROP), ox, oy);
  }
  writeFileSync(join(HERE, 'magpie_nest-objects-states-4x.png'), indexedPng(out, 4));
}

// 반복 움직이는 그림(둥지 위 + 바닥, 50ms 간격으로 6초)
{
  const frames = [];
  const A = [118, 2, 60, 52], B = [76, 204, 60, 36];
  for (let t = 0; t < 6000; t += 50) {
    const top = crop(compose(START, t), A), bot = crop(compose(GROUND, t), B);
    const img = new Image(A[2] * 2 + 2, A[3], C.ink);
    img.blit(top, 0, 0); img.blit(bot, A[2] + 2, (A[3] - B[3]) / 2);
    frames.push({ img, ms: 50 });
  }
  // 같은 그림이 이어지면 합친다(파일 크기)
  const merged = [];
  for (const f of frames) {
    const last = merged[merged.length - 1];
    if (last && last.img.c.every((v, i) => v === f.img.c[i])) last.ms += f.ms;
    else merged.push({ ...f });
  }
  writeFileSync(join(HERE, 'magpie_nest-objects-loop-3x.png'), animatedPng(merged, 3));
}

// 바구니 앞판: 바구니 안(발 235) 실루엣 사람 + 앞을 지나는(발 244) 실루엣 사람
{
  const person = (x, footY, col) => ({ footY, draw: (img) => { for (let y = footY - 40; y <= footY; y++) for (let dx = -6; dx <= 6; dx++) img.set(x + dx, y, y < footY - 32 ? C.woodL : col); } });
  const img = compose(START, 0, [person(160, 235, C.red), person(174, 244, C.teal)]);
  writeFileSync(join(HERE, 'magpie_nest-objects-basket-4x.png'), indexedPng(crop(img, [132, 190, 64, 60]), 4));
}

// 흑백 2배
{
  const S = 2, w = W * S, h = H * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[start.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'magpie_nest-objects-gray-2x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

if (problems.length) { console.error(`검사 실패 ${problems.length}건`); process.exit(1); }
