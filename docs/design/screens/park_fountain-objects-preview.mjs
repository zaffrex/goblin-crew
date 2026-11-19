// 화면 2 `park_fountain` 물건 시트 미리보기·검사 (#380). 원본: art/scenes/park_fountain.objects.mjs
// 빌드와 같은 buildScene()으로 시트를 만든 뒤, **시트에서 잘라 `at`에 붙여** 화면을 다시 조립한다(엔진이 할 일과 같은 경로).
// 배경은 아직 구도 시안(park_fountain-bg-sketch.mjs)이다. 물건 시트가 다 그려지면 완성 배경으로 바꾼다.
// 실행: node docs/design/screens/park_fountain-objects-preview.mjs
// 출력(같은 폴더):
//   park_fountain-objects-guest-6x.png   손님 P8 4칸(시계·동동·만세·젖음)을 6배로, 칸마다 회색 판 위에
//   park_fountain-objects-guest-2x.png   화면 위 손님: 왼쪽 = 입구 대기, 오른쪽 = 재회 자리(만세, ノビー가 재킷 손 밑 x 261에 섬)
//   park_fountain-objects-run-2x.png     달려오기(run_in) 4칸 + 만세를 한 장에 겹친 궤적(엔진은 한 칸씩 그린다)
//   park_fountain-objects-guest-gray-2x.png  위 화면 위 손님·관리인의 명도(흑백) (ADR-0007 결정 3-6)
//   park_fountain-objects-keeper-5x.png  관리인 P1·P2 7칸 + 2번 규칙 `swat`을 5배로, 창·창턱·자명종(구도 시안 그림)과 함께
//     순서: 졸기 | wake(벌떡·탁·갸웃) | clean_time(벽시계·꾹·털썩) | swat(졸면서 탁)
// 검사(어기면 종료 코드 1): buildScene 문제 0건(배경 시안의 ink는 빼고 센다), 손님 주색과 뒤 배경(입구 기둥·흙길)의 명도 차 ≥ 30,
//   넥타이 = 재킷 같은 분홍, 금색(yel 계열) 없음, 재회 자리 칸이 ノビー 칸(기준점 ±24)과 겹치지 않음,
//   달려오기 칸이 입구 → 재회 자리로 x가 줄고 발 y가 늘어남(뒷걸음·튐 없음).
//   관리인: 피부·작업복과 창 안 실내 명도 차 ≥ 30, 창 밖으로 나가는 칸은 탁(swat) 두 칸뿐, 탁 손바닥이 자명종 볏 바로 위(2px 안),
//   제어판 빨간 단추는 꾹 칸에만(설계 7절 P2).

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { stamp } from '../../../art/lib/texture.mjs';
import { buildScene } from '../../../art/scene-build.mjs';
import { OBJECTS, ANIMS, GUEST_AT, GUEST_REUNION_AT, KEEPER_WINDOW } from '../../../art/scenes/park_fountain.objects.mjs';
import { bg, fg } from './park_fountain-bg-sketch.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const W = 480, H = 270;
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const screen = JSON.parse(readFileSync(join(ROOT, 'content', 'screens', 'park_fountain.json'), 'utf8'));
const r = buildScene({ id: 'park_fountain', bg(img) { img.blit(bg, 0, 0); }, objects: OBJECTS, anims: ANIMS }, screen);

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
check(r.problems.length === 0, `buildScene 검사 문제 0건${r.problems.length ? `: ${r.problems.join(' / ')}` : ''}`);
if (!r.meta) { console.error('물건 시트가 없다'); process.exit(1); }
const { meta, sheet } = r;

/** 시트의 프레임 i를 dst에 `at`(+ 옮김)으로 붙인다 */
function put(dst, i, dx = 0, dy = 0) {
  const [sx, sy, sw, sh] = meta.frames[i].src, [ax, ay] = meta.frames[i].at;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const c = sheet.get(sx + x, sy + y);
    if (c !== EMPTY) dst.set(ax + x + dx, ay + y + dy, c);
  }
}
const G = meta.objects.find((o) => o.key === 'guest');
const A = meta.anims;
const K = meta.objects.find((o) => o.key === 'keeper');
const keeperFrames = [K.default.frame, ...A['keeper.wake'].frames, ...A['keeper.clean_time'].frames, ...A['keeper.swat'].frames];
const keeperNames = ['doze', 'jolt', 'swat', 'tilt', 'look', 'press', 'plop', 'swatAsleep'];
// 창턱 닭 자명종: 아직 물건 시트에 없어서 구도 시안의 그림(84,140 12×12)을 그대로 찍어 탁 자리를 본다
const CLOCK = { x: 84, y: 140 };
const clock = (im) => stamp(im, CLOCK.x, CLOCK.y, ['....rr......', '...rrr......', '..wwww......', '.wwkwwww....', 'yywwwwwwww..', '.wwwccccwww.', '.wwcwwwwcww.', '.wwcwwkwcww.', '.wwcwwwwcww.', '..wwccccww..', '...ww..ww...', '...yy..yy...'], { r: C.red, w: C.white, k: C.plum, y: C.yel, c: C.redL });
const frameOf = { watch: G.default.loop.frames[0], tap: G.default.loop.frames[1], cheer: A['guest.cheer'].frames[0], wet: A['guest.soaked'].frames[0] };

// ── 세 사람 시트(ノビー 0칸)를 읽어 재회 자리 옆에 세운다
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
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = raw[y * (w + 1) + 1 + x]; img.c[y * w + x] = i >= 32 ? EMPTY : i; }
  return img;
}
function person(dst, id, fx, fy) {
  const m = JSON.parse(readFileSync(join(ROOT, 'public/sprites', `${id}-base.json`), 'utf8'));
  const s = readIndexedPng(join(ROOT, 'public/sprites', m.image));
  const [cw, ch] = m.cell, [ax, ay] = m.anchor;
  const cell = new Image(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cell.set(x, y, s.get(x, y));
  dst.blit(cell, fx - (cw - ax), fy - ay, { flipAx: cw / 2 }); // 왼쪽을 본다(시트는 오른쪽)
}

const base = () => { const im = new Image(W, H); im.blit(bg, 0, 0); im.blit(fg, 0, 0); return im; };

// ── 1. 칸 4개 6배
{
  const S = 6, cw = 30, ch = 76, keys = ['watch', 'tap', 'cheer', 'wet'];
  const sheetImg = new Image(cw * keys.length, ch, C.cotton);
  keys.forEach((k, n) => {
    const tmp = new Image(W, H);
    put(tmp, frameOf[k]);
    const at = n === 2 || n === 3 ? GUEST_REUNION_AT : GUEST_AT;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = tmp.get(at[0] - 5 + x, at[1] - 14 + y);
      if (c !== EMPTY) sheetImg.set(n * cw + x, y, c);
    }
  });
  writeFileSync(join(HERE, 'park_fountain-objects-guest-6x.png'), indexedPng(sheetImg, S));
}

// ── 1b. 관리인 칸 5배(창 + 창턱 + 자명종)
{
  const S = 5, cw = 66, ch = 50, x0 = 33, y0 = 104;
  const out = new Image(cw * keeperFrames.length, ch);
  keeperFrames.forEach((f, n) => {
    const im = new Image(W, H); im.blit(bg, 0, 0); put(im, f); clock(im);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out.set(n * cw + x, y, im.get(x0 + x, y0 + y));
  });
  writeFileSync(join(HERE, 'park_fountain-objects-keeper-5x.png'), indexedPng(out, S));
}

// ── 2. 화면 위: 입구 대기 + 재회 자리(만세, ノビー 재킷 밑) + 조는 관리인
const onScene = base();
put(onScene, K.default.frame);
clock(onScene);
put(onScene, frameOf.watch);
put(onScene, frameOf.cheer);
person(onScene, 'jjuk', 261, 244);
writeFileSync(join(HERE, 'park_fountain-objects-guest-2x.png'), indexedPng(onScene, 2));

// ── 3. 달려오기 궤적
const run = base();
for (const f of A['guest.run_in'].frames) put(run, f);
put(run, frameOf.cheer);
person(run, 'jjuk', 261, 244);
writeFileSync(join(HERE, 'park_fountain-objects-run-2x.png'), indexedPng(run, 2));

// ── 4. 명도
{
  const S = 2, w = W * S, h = H * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[onScene.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'park_fountain-objects-guest-gray-2x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// ── 검사
const mainColor = (img, x0, y0, w, h, skip = []) => {
  const n = new Map();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY && !skip.includes(c)) n.set(c, (n.get(c) ?? 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0][0];
};
const only = (i) => { const im = new Image(W, H); put(im, i); return im; };
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
for (const [name, k, at] of [['입구 대기', 'watch', GUEST_AT], ['재회 만세', 'cheer', GUEST_REUNION_AT], ['재회 젖음', 'wet', GUEST_REUNION_AT]]) {
  const fig = only(frameOf[k]);
  const shirt = mainColor(fig, at[0], at[1] + 16, 20, 28, [C.ink]);
  const back = mainColor(bg, at[0], at[1] + 16, 20, 28);
  check(dY(shirt, back) >= 30, `${name}: 몸 주색 #${shirt}(Y${Y[shirt]}) vs 뒤 배경 #${back}(Y${Y[back]}) 차 ${dY(shirt, back)} ≥ 30`);
}
{
  const fig = only(frameOf.watch);
  const tie = mainColor(fig, GUEST_AT[0] + 7, GUEST_AT[1] + 17, 3, 12, [C.ink, C.white, C.cotton, C.lint, C.tan, C.woodL]);
  check(tie === C.pink, `넥타이 주색 #${tie} = 재킷 분홍 #${C.pink} (이 재킷이 이 사람 것)`);
}
{
  const gold = [C.yelD, C.yel, C.yelL];
  const used = new Set();
  const guestFrames = [G.default.frame, ...G.default.loop.frames, ...G.states.map((st) => st.frame),
    ...Object.entries(A).filter(([k]) => k.startsWith('guest.')).flatMap(([, a]) => a.frames)];
  for (const i of guestFrames) {
    const [sx, sy, sw, sh] = meta.frames[i].src;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) used.add(sheet.get(sx + x, sy + y));
  }
  check(!gold.some((c) => used.has(c)), '손님 칸에 금색(yel 계열) 없음(시계는 은색)');
}
{
  const [cx, cy, cw2] = meta.frames[frameOf.cheer].at.concat(meta.frames[frameOf.cheer].src[2]);
  check(cx >= 261 + 24, `재회 만세 칸 왼쪽 끝 x ${cx} ≥ ノビー 칸 오른쪽 끝 285 (y ${cy}, 폭 ${cw2})`);
}
{
  const xs = A['guest.run_in'].frames.map((f) => meta.frames[f].at[0]);
  const feet = A['guest.run_in'].frames.map((f) => meta.frames[f].at[1] + meta.frames[f].src[3]);
  const cheer = meta.frames[frameOf.cheer];
  xs.push(cheer.at[0]); feet.push(cheer.at[1] + cheer.src[3]);
  check(xs.every((x, i) => i === 0 || x < xs[i - 1]), `달려오기 x가 줄어든다: ${xs.join(' → ')}`);
  check(feet.every((y, i) => i === 0 || y >= feet[i - 1]), `달려오기 발 아래 끝이 줄지 않는다: ${feet.join(' → ')}`);
}

{
  const fr = (i) => meta.frames[i];
  const only2 = (i) => { const im = new Image(W, H); put(im, i); return im; };
  const doze = only2(K.default.frame);
  const { x: wx, y: wy, w: ww, h: wh } = KEEPER_WINDOW;
  const wall = mainColor(doze, wx + 30, wy + 2, 10, 8, [C.ink, C.white]);
  for (const [name, c] of [['피부', C.tan], ['작업복', C.teal]]) check(dY(c, wall) >= 30, `관리인 ${name} #${c}(Y${Y[c]}) vs 창 안 실내 #${wall}(Y${Y[wall]}) 차 ${dY(c, wall)} ≥ 30`);
  const outside = keeperNames.filter((_, n) => {
    const { at: [ax, ay], src: [, , sw, sh] } = fr(keeperFrames[n]);
    return ax < wx - 1 || ay < wy - 1 || ax + sw > wx + ww + 1 || ay + sh > wy + wh + 1;
  });
  check(outside.join() === 'swat,swatAsleep', `창 밖으로 나가는 칸은 탁 두 칸뿐: ${outside.join(', ')}`);
  for (const n of [2, 7]) {
    const im = only2(keeperFrames[n]);
    let bottom = -1;
    for (let y = wy; y < CLOCK.y; y++) for (let x = CLOCK.x; x < CLOCK.x + 12; x++) if ([C.tan, C.woodL].includes(im.get(x, y))) bottom = Math.max(bottom, y);
    check(bottom >= CLOCK.y - 3 && bottom < CLOCK.y, `${keeperNames[n]}: 손바닥 아래 끝 y ${bottom}이 자명종 위 끝 ${CLOCK.y} 바로 위(2px 안)`);
  }
  const hasRed = keeperNames.filter((_, n) => { const im = only2(keeperFrames[n]); return im.c.includes(C.red); });
  check(hasRed.join() === 'press', `제어판 빨간 단추는 꾹 칸에만: ${hasRed.join(', ')}`);
}

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
