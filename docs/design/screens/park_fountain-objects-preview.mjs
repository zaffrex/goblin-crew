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
//     순서: 졸기 | 꾸벅(대기 loop) | wake(벌떡·탁·갸웃) | clean_time(벽시계·꾹·털썩) | swat(졸면서 탁)
//   park_fountain-objects-clock-5x.png  커튼 P3 2칸 + 자명종 P7 3칸을 5배로, 판잣집 창 아래 흙길까지(배경 시안 위)
//     순서: 커튼 확 | 커튼 닫힘 | 자명종 창턱 | ビヨーン | 출렁 | 흙길에 거꾸로 | 떨어지는 중 | 되감기 들림·벽·퐁(#542 끈)
//   park_fountain-objects-jacket-4x.png  재킷 P5를 4배로, 동상·돌우산(배경 시안)과 함께
//     순서: 꼭대기(멈춤) | 움찔 | 미끄러짐 | 떨어짐(위) | 떨어짐(아래) | 손에 턱(= on_hand 멈춘 모습)
//   park_fountain-objects-pigeons-4x.png  비둘기 셋(#526)을 4배로, **완성 배경** 위에(테두리·연못 앞 대비를 보려고)
//     테두리 앞면(물건)도 엔진 순서대로 깐다. 순서: 쉬기 | pigeons_up 8칸(놀람 → 퍼덕 → 꼭대기 → 내려옴 → 놀람) | pigeons_turn 돌아보기
//   park_fountain-objects-pigeons-top-2x.png  S2 돌우산 꼭대기(#802)를 2배로, 완성 배경 + 재킷 위에. 순서: perch 놀람 | 상승 3·6·9칸 | 툭 내려앉음 |
//     꼭대기(재킷 앞) | 재킷 미끄러지는 중 | 재킷 손에 턱 | splash 맞는 칸(앉기 직전) | 밀려 내려감 3·6칸 | 땅 놀람
//   park_fountain-objects-pigeons-top-4x.png  꼭대기만 4배: 재킷 앞에 앉음 | 재킷 미끄러지는 중 | 손에 턱(클리어 뒤 그림, 물줄기 빼고)
//   park_fountain-objects-duck-4x.png  오리 P9(#529)를 4배로, 완성 배경 + 테두리 앞면 위에. 순서: 떠 있기 | 콕 | 퍼덕 | lap 왼쪽 12px | 돌아섬
// 검사(어기면 종료 코드 1): buildScene 문제 0건(배경 시안의 ink는 빼고 센다), 손님 주색과 뒤 배경(입구 기둥·흙길)의 명도 차 ≥ 30,
//   넥타이 = 재킷 같은 분홍, 금색(yel 계열) 없음, 재회 자리 칸이 ノビー 칸(기준점 ±24)과 겹치지 않음,
//   달려오기 칸이 입구 → 재회 자리로 x가 줄고 발 y가 늘어남(뒷걸음·튐 없음).
//   관리인: 피부·작업복과 창 안 실내 명도 차 ≥ 30, 창 밖으로 나가는 칸은 탁(swat) 두 칸뿐, 탁 손바닥이 자명종 볏 바로 위(2px 안),
//   제어판 빨간 단추는 꾹 칸에만(설계 7절 P2), 대기 꾸벅은 고개만 떨어진다(책상·포갠 팔 y ≥ 139는 졸기와 같고, 머리 맨 위가 2px 아래, #477).
//   커튼(P3): 닫힘 칸은 창 안에 피부가 0픽셀, 확 칸은 얼굴 오른쪽만 보인다(피부 > 0, 왼쪽 절반은 0), 둘 다 창 밖으로 안 나간다.
//   자명종(P7): 창턱 그림 = 구도 시안 그림(84,140) 그대로, 튄 칸의 몸통(y ≥ 145)은 창턱 그림과 같다(머리만 튄다),
//   거꾸로 칸 몸통(끈·효과 점 뺌)은 창 아래 흙길(아래 끝 ≥ 198)에 있고 창(관리인 히트)과 안 겹친다, 화면 JSON의 자명종·커튼 anim 이름이 시트에 다 있다.
//   끈(#542): fall·reel_up 칸마다 끈이 포갠 손(64,145)에서 한 줄로 이어진다, 되감기는 위로만 올라가고 마지막 칸은 창턱 그림 바로 위,
//   들림·벽 칸 몸통은 창과 안 겹친다.
//   재킷(P5): 꼭대기 그림 = 구도 시안 그림(213,32) 그대로(#530에서 앞판이 보이게 둘 다 고침), 대기 loop의 움찔 칸 = twitch anim 첫 칸(같은 그림 재사용),
//   slide 마지막 칸 = 손 멈춘 모습(도착 순간 튀지 않음), slide가 오른쪽·아래로만 간다, 떨어지는 칸은 처마(y ≤ 52) 아래,
//   손 칸 아래 끝 y 123~125(소매 끝 124)이고 집게 자리(x 252~270, y 116~124) 안에 4×4 불투명 덩어리가 있다(설계 1-3 집기 조건),
//   손 칸에서 손바닥 가운데(x 257~260, y 119~121)가 보인다, 재킷 주색과 뒤 배경(하늘·나무)의 명도 차 ≥ 60.

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
import { OBJECTS, ANIMS, PIGEONS_AT, PIGEONS_TOP_AT, PIGEON_TRACKS, GUEST_AT, GUEST_REUNION_AT, KEEPER_WINDOW, CLOCK_AT, JACKET_TOP_AT, CORD_COLOR } from '../../../art/scenes/park_fountain.objects.mjs';
import { bg, fg } from './park_fountain-bg-sketch.mjs';
import { SCENE as PARK } from '../../../art/scenes/park_fountain.mjs';

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
const keeperFrames = [K.default.frame, K.default.loop.frames[1], ...A['keeper.wake'].frames, ...A['keeper.clean_time'].frames, ...A['keeper.swat'].frames];
const keeperNames = ['doze', 'nod', 'jolt', 'swat', 'tilt', 'look', 'press', 'plop', 'swatAsleep'];
// 창턱 닭 자명종(물건 시트의 멈춘 모습). 구도 시안 그림(84,140 12×12)과 같은 자리·같은 픽셀인지 아래에서 검사한다
const CLOCK = { x: CLOCK_AT[0], y: CLOCK_AT[1] };
const KC = meta.objects.find((o) => o.key === 'alarm_clock');
const clock = (im) => put(im, KC.default.frame);
const SKETCH_CLOCK = ['....rr......', '...rrr......', '..wwww......', '.wwkwwww....', 'yywwwwwwww..', '.wwwccccwww.', '.wwcwwwwcww.', '.wwcwwkwcww.', '.wwcwwwwcww.', '..wwccccww..', '...ww..ww...', '...yy..yy...'];
const SKETCH_JACKET = ['........rrLLrr........', '......rrLLwwLLrr......', '....rrPLLrwwrLLPrr....', '..rrPPPLLrwwrLLPPPrr..', '.rLPPPPPLrwwrLPPPPPPr.', 'rLPPrPPPPLrwrPPPPrPPPr', 'rLPrrPPPPPLrPPPPPrrPPr', 'rPPr.rPPPPPwPPPPr.rPPr', 'rPPr.rPPPPPrPPPPr.rPPr', 'rPPr.rPPPPPwPPPPr.rPPr', '.ww..rPPPPPrPPPPr.rPPr', '.....rPPPPr.rPPPr.rPPr', '.....rrrrr...rrrr.rPPr', '..................rwwr'];
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

// ── 1c. 커튼 P3 2칸 + 자명종 P7 (창턱 | 튐 | 출렁 | 거꾸로) 5배
const curtainFrames = A['keeper.curtain'].frames;
const clockFrames = [KC.default.frame, A['alarm_clock.spring'].frames[0], A['alarm_clock.spring'].frames[1], A['alarm_clock.fall'].frames.at(-1)]; // 거꾸로 = fall 마지막(붙드는) 칸. 앞 칸은 굴러떨어지는 중(#539)
{
  // 흙길(y 236~248)까지 보이게 아래로 늘렸다(#542 전에는 거꾸로 칸이 잘려 빈 칸으로 찍혔다). 뒤에 떨어지는 중 + 되감기 3칸(#542)
  const S = 5, cw = 84, ch = 146, x0 = 30, y0 = 108;
  const shots = [...curtainFrames.map((f) => [f, null]), ...clockFrames.map((f) => [K.default.frame, f]),
    [K.default.frame, A['alarm_clock.fall'].frames[0]], ...A['alarm_clock.reel_up'].frames.map((f) => [K.default.frame, f])];
  const out = new Image(cw * shots.length, ch);
  shots.forEach(([kf, cf], n) => {
    const im = new Image(W, H); im.blit(bg, 0, 0); put(im, kf);
    if (cf === null) clock(im); else put(im, cf);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out.set(n * cw + x, y, im.get(x0 + x, y0 + y));
  });
  writeFileSync(join(HERE, 'park_fountain-objects-clock-5x.png'), indexedPng(out, S));
}

// ── 1d. 재킷 P5 4배(동상·돌우산 배경 시안 위). 꼭대기 | 움찔 | 미끄러짐 | 떨어짐 둘 | 손
const JK = meta.objects.find((o) => o.key === 'jacket');
const slideFrames = A['jacket.slide'].frames;
const jacketShots = [JK.default.frame, ...slideFrames];
{
  const S = 4, cw = 84, ch = 104, x0 = 194, y0 = 24;
  const out = new Image(cw * jacketShots.length, ch);
  jacketShots.forEach((f, n) => {
    const im = new Image(W, H); im.blit(bg, 0, 0); put(im, f);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out.set(n * cw + x, y, im.get(x0 + x, y0 + y));
  });
  writeFileSync(join(HERE, 'park_fountain-objects-jacket-4x.png'), indexedPng(out, S));
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
  for (const n of [3, 8]) {
    const im = only2(keeperFrames[n]);
    let bottom = -1;
    for (let y = wy; y < CLOCK.y; y++) for (let x = CLOCK.x; x < CLOCK.x + 12; x++) if ([C.tan, C.woodL].includes(im.get(x, y))) bottom = Math.max(bottom, y);
    check(bottom >= CLOCK.y - 3 && bottom < CLOCK.y, `${keeperNames[n]}: 손바닥 아래 끝 y ${bottom}이 자명종 위 끝 ${CLOCK.y} 바로 위(2px 안)`);
  }
  const hasRed = keeperNames.filter((_, n) => { const im = only2(keeperFrames[n]); return im.c.includes(C.red); });
  {
    // 대기 꾸벅(#477): 몸·팔·책상은 졸기 그대로, 고개만 내려간다. 칸 전체를 옮기는 오프셋이면 이 검사가 깨진다
    const nod = only2(keeperFrames[1]);
    let same = true;
    for (let y = 139; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) if (doze.get(x, y) !== nod.get(x, y)) same = false;
    check(same, '꾸벅: 책상·포갠 팔(y ≥ 139)이 졸기와 같다');
    const top = (im) => { for (let y = wy; y < wy + wh; y++) for (let x = wx + 13; x < 70; x++) if ([C.tan, C.woodL].includes(im.get(x, y))) return y; return -1; };
    check(top(nod) - top(doze) === 4, `꾸벅: 머리 맨 위 y ${top(doze)} → ${top(nod)}(4px 아래, #530)`);
  }
  check(hasRed.join() === 'press', `제어판 빨간 단추는 꾹 칸에만: ${hasRed.join(', ')}`);
}

{
  // 커튼 P3
  const only3 = (i) => { const im = new Image(W, H); put(im, i); return im; };
  const { x: wx, y: wy, w: ww, h: wh } = KEEPER_WINDOW;
  const skin = (im, xa, xb) => { let n = 0; for (let y = wy; y < wy + wh; y++) for (let x = xa; x < xb; x++) if ([C.tan, C.woodL].includes(im.get(x, y)) && y < 147) n++; return n; };
  const [closing, closed] = curtainFrames.map(only3);
  check(skin(closed, wx, wx + ww) === 0, `커튼 닫힘: 창 안 피부 ${skin(closed, wx, wx + ww)}픽셀 = 0 (얼굴이 안 보이고 말풍선만)`);
  check(skin(closing, 54, 62) === 0 && skin(closing, 64, wx + ww) > 0, `커튼 확: 얼굴 왼쪽(x 54~61) 피부 ${skin(closing, 54, 62)} = 0, 오른쪽 ${skin(closing, 64, wx + ww)} > 0`);
  for (const [name, f] of [['확', curtainFrames[0]], ['닫힘', curtainFrames[1]]]) {
    const { at: [ax, ay], src: [, , sw, sh] } = meta.frames[f];
    check(ax >= wx - 1 && ay >= wy - 1 && ax + sw <= wx + ww + 1 && ay + sh <= wy + wh + 1, `커튼 ${name} 칸이 창 안(외곽선 1px 포함): ${ax},${ay} ${sw}×${sh}`);
  }
  const ca = A['keeper.curtain_open'];
  check(ca && ca.frames.every((f) => curtainFrames.includes(f)), 'curtain_open은 커튼 두 칸을 다시 튼다(새 칸 0)');

  // 자명종 P7
  const rest = only3(KC.default.frame);
  const sk = new Image(W, H); stamp(sk, CLOCK.x, CLOCK.y, SKETCH_CLOCK, { r: C.red, w: C.white, k: C.plum, y: C.yel, c: C.redL });
  let same = true;
  for (let y = CLOCK.y; y < CLOCK.y + 12; y++) for (let x = CLOCK.x; x < CLOCK.x + 12; x++) if (sk.get(x, y) !== EMPTY && sk.get(x, y) !== rest.get(x, y)) same = false;
  check(same, `자명종 창턱 그림 = 구도 시안 그림(${CLOCK.x},${CLOCK.y})`);
  for (const [name, f] of [['ビヨーン', clockFrames[1]], ['출렁', clockFrames[2]]]) {
    const im = only3(f);
    let body = true;
    for (let y = CLOCK.y + 5; y < CLOCK.y + 13; y++) for (let x = CLOCK.x - 1; x < CLOCK.x + 13; x++) if (rest.get(x, y) !== im.get(x, y)) body = false;
    const { at: [, ay] } = meta.frames[f];
    check(body && ay < CLOCK.y - 5, `${name}: 몸통(y ≥ ${CLOCK.y + 5})은 창턱 그림과 같고 머리만 위로 튐(칸 위 끝 ${ay})`);
  }
  // 몸통 상자: 끈(CORD_COLOR, #542)은 창 안 관리인 손까지 이어지니 빼고 센다
  const bodyBox = (f) => {
    const im = only3(f);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = im.get(x, y);
      if (c === EMPTY || c === CORD_COLOR || c === C.white || c === C.wood) continue; // 효과 점(흰 선·흙 튐)도 뺀다
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1, im };
  };
  const hitWin = (b) => b.x0 < wx + ww && b.x1 >= wx && b.y0 < wy + wh && b.y1 >= wy;
  {
    const b = bodyBox(clockFrames[3]);
    check(b.y1 >= 198 && !hitWin(b), `거꾸로: 몸통 ${b.x0}..${b.x1} × ${b.y0}..${b.y1}, 아래 끝 ${b.y1} ≥ 198(흙길), 창과 안 겹침`);
  }
  // #542 끈 되감기: 떨어진 칸부터 되감기 칸까지 끈 한쪽 끝이 포갠 손(64,145)에 있고, 이어진 한 줄이다(끊기면 "끈"이 아니라 점선)
  {
    const cordFrames = [...A['alarm_clock.fall'].frames, ...A['alarm_clock.reel_up'].frames];
    for (const f of cordFrames) {
      const im = only3(f);
      const seen = new Set(), stack = [[64, 145]];
      while (stack.length) {
        const [x, y] = stack.pop();
        const k = `${x},${y}`;
        if (seen.has(k) || im.get(x, y) !== CORD_COLOR) continue;
        seen.add(k);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) stack.push([x + dx, y + dy]);
      }
      let total = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (im.get(x, y) === CORD_COLOR) total++;
      check(total > 0 && seen.size === total, `끈(칸 ${f}): 손(64,145)에서 이어진 끈 ${seen.size}/${total}픽셀`);
    }
    // 되감기 칸은 위로만 올라가고(몸통 위 끝이 줄어듦), 마지막 칸은 창턱 그림 바로 위(몸통 x가 같고 위 끝이 10px 안)
    const boxes = A['alarm_clock.reel_up'].frames.map(bodyBox);
    const fallen = bodyBox(clockFrames[3]);
    const tops = [fallen.y0, ...boxes.map((b) => b.y0)];
    const rest = bodyBox(KC.default.frame);
    const last = boxes.at(-1);
    check(tops.every((t, i) => i === 0 || t < tops[i - 1]), `되감기는 위로만: 몸통 위 끝 ${tops.join(' → ')} → 창턱 ${rest.y0}`);
    check(last.x0 === rest.x0 && last.y0 < rest.y0 && rest.y0 - last.y0 <= 10, `되감기 마지막 칸은 창턱 그림 바로 위(x ${last.x0} = ${rest.x0}, 위 끝 ${last.y0} → ${rest.y0})`);
    // 들림·벽 중간 칸은 창(관리인)을 가리지 않는다
    check(boxes.slice(0, -1).every((b) => !hitWin(b)), '되감기 들림·벽 칸 몸통이 창과 안 겹친다');
  }
  // 화면 JSON의 모든 { anim: [물건, 이름] } 중 관리인·자명종 것
  const used = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (Array.isArray(v.anim) && ['keeper', 'alarm_clock'].includes(v.anim[0])) used.add(v.anim.join('.'));
      Object.values(v).forEach(walk);
    }
  };
  walk(screen);
  const missing = [...used].filter((k) => !A[k]);
  check(missing.length === 0, `화면 JSON의 keeper·alarm_clock anim이 시트에 다 있다${missing.length ? `: 없음 ${missing.join(', ')}` : ''}`);
}

{
  // 재킷 P5
  const one = (i) => { const im = new Image(W, H); put(im, i); return im; };
  const [jx, jy] = JACKET_TOP_AT;
  const top = one(JK.default.frame);
  const sk = new Image(W, H); stamp(sk, jx, jy, SKETCH_JACKET, { r: C.red, P: C.pink, L: C.pinkL, w: C.white });
  let same = true;
  for (let y = jy; y < jy + 14; y++) for (let x = jx; x < jx + 22; x++) if (sk.get(x, y) !== EMPTY && sk.get(x, y) !== top.get(x, y)) same = false;
  check(same, `재킷 꼭대기 그림 = 구도 시안 그림(${jx},${jy})`);
  const tw = A['jacket.twitch'];
  check(JK.default.loop?.frames[1] === tw.frames[0] && slideFrames[0] === tw.frames[0], '대기 움찔 = tap 움찔 = slide 첫 칸(P5 0칸 하나를 다시 쓴다)');
  const handState = JK.states?.find((st) => st.when.flags['jacket.on_hand'] === true);
  check(handState && !handState.loop && slideFrames.at(-1) === handState.frame, 'slide 마지막 칸 = 손 멈춘 모습, 손 state에는 대기 움찔이 없다');
  const box = (i) => { const { at: [ax, ay], src: [, , sw, sh] } = meta.frames[i]; return { x: ax, y: ay, w: sw, h: sh, cx: ax + sw / 2, bottom: ay + sh - 1 }; };
  const path = slideFrames.map(box);
  check(path.every((b, i) => i === 0 || (b.cx > path[i - 1].cx && b.bottom >= path[i - 1].bottom)),
    `slide가 오른쪽·아래로만: 가운데 x ${path.map((b) => b.cx).join(' → ')}, 아래 끝 ${path.map((b) => b.bottom).join(' → ')}`);
  for (const i of [2, 3]) {
    const im = one(slideFrames[i]);
    let topBody = H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ([C.pink, C.pinkL, C.red].includes(im.get(x, y))) topBody = Math.min(topBody, y);
    check(topBody > 52, `떨어짐 ${i - 1}: 재킷 위 끝 y ${topBody} > 처마 52`);
  }
  const hand = one(handState.frame);
  const hb = box(handState.frame);
  check(hb.bottom >= 123 && hb.bottom <= 125, `손 칸 아래 끝 y ${hb.bottom} (소매 끝 124 ±1)`);
  const solid = (x0, y0) => { for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) if (hand.get(x, y) === EMPTY) return false; return true; };
  let claw = false;
  for (let y = 116; y <= 121; y++) for (let x = 252; x <= 267; x++) if (solid(x, y)) claw = true;
  check(claw, '손 칸: 집게 자리(x 252~270, y 116~124) 안에 4×4 불투명 덩어리');
  let palm = 0;
  for (let y = 119; y <= 121; y++) for (let x = 257; x <= 260; x++) if (hand.get(x, y) === EMPTY) palm++;
  check(palm >= 8, `손 칸: 손바닥 가운데(x 257~260, y 119~121)가 ${palm}/12픽셀 보인다(≥ 8)`);
  for (const [name, f, x0, y0, w, h] of [['꼭대기', JK.default.frame, 214, 18, 20, 12], ['손', handState.frame, 248, 100, 26, 26]]) {
    const back = mainColor(bg, x0, y0, w, h);
    const main = mainColor(one(f), 0, 0, W, H, [C.ink]);
    check(main === C.pink && dY(main, back) >= 60, `재킷 ${name}: 주색 #${main}(Y${Y[main]}) vs 뒤 #${back}(Y${Y[back]}) 차 ${dY(main, back)} ≥ 60`);
  }
  const missing = ['jacket.twitch', 'jacket.slide'].filter((k) => !A[k]);
  check(missing.length === 0, `화면 JSON의 재킷 P5 anim이 시트에 있다${missing.length ? `: 없음 ${missing.join(', ')}` : ''}`);
}

// ── 비둘기 (#526): 바닥 자리 `floor`가 맡는 물건. 화면 JSON은 fx가 아니라 anim으로 부른다.
{
  const P = meta.objects.find((o) => o.key === 'pigeons');
  check(Boolean(P) && P.ids.length === 1 && P.ids[0] === 'floor', '비둘기 물건은 바닥 자리 floor 하나만 맡는다(핫스팟이 아니라 클릭 대상 아님)');
  const up = A['floor.pigeons_up'], turn = A['floor.pigeons_turn'];
  check(Boolean(up && turn), '시트에 floor.pigeons_up·floor.pigeons_turn이 있다');
  const raw = JSON.stringify(screen);
  const asFx = /"fx":\["pigeons_(up|turn)"/.test(raw);
  const asAnim = raw.includes('"anim":["floor","pigeons_up"]') && raw.includes('"anim":["floor","pigeons_turn"]');
  check(!asFx && asAnim, '화면 JSON이 비둘기를 fx(임시 별)가 아니라 floor anim으로 부른다');
  if (P && up && turn) {
    const real = new Image(W, H);
    PARK.bg(real);
    const rest = P.default.frame;
    const rim = meta.objects.find((o) => o.key === 'fountain').default.frame;
    const top = (f) => meta.frames[f].at[1];
    check(up.frames[0] === up.frames.at(-1), 'pigeons_up 첫 칸 = 마지막 칸(놀람 칸으로 내려앉고 쉬는 그림으로 이어짐)');
    const rise = top(rest) - Math.min(...up.frames.map(top));
    check(rise >= 30, `pigeons_up 꼭대기가 쉬는 자리보다 ${rise}px 위(≥ 30, 흰 테두리를 지나 연못 앞까지)`);
    // 배경에 비둘기가 남지 않았는지: 쉬는 그림 자리의 배경에 비둘기 목 청록(tealM)이 없다
    const [rx, ry] = meta.frames[rest].at, [, , rw, rh] = meta.frames[rest].src;
    let teal = 0;
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) if (real.get(x, y) === C.tealM) teal++;
    check(teal === 0, `배경에 비둘기가 남지 않았다(쉬는 자리 배경의 청록 목 ${teal}픽셀 = 0)`);
    const S = 4, x0 = 176, y0 = 150, cw = 104, ch = 74;
    const shots = [rest, ...up.frames, turn.frames[0]];
    const out = new Image(cw * shots.length + shots.length - 1, ch);
    shots.forEach((f, n) => {
      // 엔진 순서대로: 배경 → 테두리 앞면(물건) → 비둘기
      const im = new Image(W, H); im.blit(real, 0, 0); put(im, rim); put(im, f);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out.set(n * (cw + 1) + x, y, im.get(x0 + x, y0 + y));
      if (n > 0) for (let y = 0; y < ch; y++) out.set(n * (cw + 1) - 1, y, C.ink);
    });
    writeFileSync(join(HERE, 'park_fountain-objects-pigeons-4x.png'), indexedPng(out, S));
  }
}

// ── 비둘기 S2 돌우산 꼭대기 (#802, park_fountain-s2.md 3절 7·8번·7-1절, PR #810 Luna 리뷰 R3)
// 검사: anim 셋이 시트에 있다, perch·splash_up은 hold(다음 anim·fx까지 마지막 칸을 붙듦), splash_down은 hold 없음이고 놀람 칸으로 끝난다(쉬는 그림으로 이어짐),
//   splash 둘은 perch 칸만 다시 쓴다, 새 한 마리가 한 칸에 21px 넘게 안 간다(1배에서 "사라졌다 나타남" 막기, R3), 꼭대기 칸이 오른 경사(재킷 slide 길, x ≥ 230)를 비운다,
//   꼭대기 칸 외곽선(dusk)과 뒤 하늘의 명도 차 ≥ 60, 꼭대기 칸에 땅 그림자(wood)가 없다.
{
  const names = ['floor.pigeons_perch', 'floor.pigeons_splash_up', 'floor.pigeons_splash_down'];
  const missing = names.filter((n) => !A[n]);
  check(missing.length === 0, `시트에 S2 비둘기 anim 3개가 있다${missing.length ? `: 없음 ${missing.join(', ')}` : ''}`);
  if (missing.length === 0) {
    const [perch, sUp, sDown] = names.map((n) => A[n]);
    check(perch.hold === true && sUp.hold === true && !sDown.hold, 'perch·splash_up은 hold, splash_down은 hold 없음');
    check(sDown.frames.at(-1) === A['floor.pigeons_up'].frames[0], 'splash_down 마지막 칸 = 땅 놀람 칸(쉬는 그림으로 이어짐)');
    const bb = (f) => { const { at: [x, y], src: [, , w, h] } = meta.frames[f]; return [x, y, x + w - 1, y + h - 1]; };
    // 새마다 칸당 이동(대각 거리). 오르기 = 땅 놀람(쉬는 자리 2px 위) → 9칸 → 내려앉음, 떨어지기 = 꼭대기 → 7칸 → 땅 놀람
    const hop = PIGEONS_AT.map(([x, y]) => [x, y - 2]);
    const landed = PIGEONS_TOP_AT.map(([x, y]) => [x, y - 2]);
    const climbPath = PIGEON_TRACKS.perch;
    const paths = {
      perch: [hop, ...climbPath, landed, PIGEONS_TOP_AT.map(([x, y]) => [x, y])],
      splash_up: [hop, ...climbPath],
      splash_down: [...climbPath.slice().reverse(), hop],
    };
    check(sUp.frames.every((f) => perch.frames.includes(f)) && sDown.frames.every((f) => perch.frames.includes(f)), 'splash_up·splash_down은 perch 칸만 다시 쓴다(새 칸 0)');
    for (const [name, path] of Object.entries(paths)) {
      let worst = 0;
      for (let k = 1; k < path.length; k++) for (let i = 0; i < 3; i++) worst = Math.max(worst, Math.hypot(path[k][i][0] - path[k - 1][i][0], path[k][i][1] - path[k - 1][i][1]));
      check(worst <= 21, `${name}: 새 한 마리가 한 칸에 간 거리 최대 ${worst.toFixed(1)}px ≤ 21`);
    }
    const topF = perch.frames.at(-1);
    const [, , right] = bb(topF);
    check(right < 230, `꼭대기 칸 오른쪽 끝 x ${right} < 230(오른 경사는 재킷 slide 길이라 비움)`);
    const real = new Image(W, H);
    PARK.bg(real);
    const only = new Image(W, H); put(only, topF);
    let wood = 0, worstDy = 999;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = only.get(x, y);
      if (c === C.wood) wood++;
      // 외곽선 픽셀 바로 뒤(배경)와의 명도 차
      if (c === C.dusk) worstDy = Math.min(worstDy, dY(c, real.get(x, y)));
    }
    check(wood === 0, `꼭대기 칸에 땅 그림자 ${wood}픽셀 = 0`);
    check(worstDy >= 60, `꼭대기 칸 외곽선(dusk)과 바로 뒤 배경의 명도 차 최소 ${worstDy} ≥ 60`);
    // 그림: 배경 → 재킷(그 순간 그림) → 테두리 앞면 → 비둘기. 물줄기는 엔진 입자라 여기 없다(replay 캡처는 화면 JSON PR에서).
    const rim = meta.objects.find((o) => o.key === 'fountain').default.frame;
    const jTop = JK.default.frame, jHand = JK.states.find((st) => st.when.flags['jacket.on_hand'] === true).frame;
    const slideLast = A['jacket.slide'].frames;
    const shots = [
      [jTop, perch.frames[0]], [jTop, perch.frames[3]], [jTop, perch.frames[6]], [jTop, perch.frames[9]], [jTop, perch.frames.at(-2)], [jTop, topF],
      [slideLast[1], topF], [jHand, topF],
      [jTop, sUp.frames.at(-1)], [jTop, sDown.frames[3]], [jTop, sDown.frames[6]], [jTop, sDown.frames.at(-1)],
    ];
    const S = 2, x0 = 176, y0 = 14, cw = 100, ch = 210;
    const out = new Image(cw * shots.length + shots.length - 1, ch);
    shots.forEach(([jf, pf], n) => {
      const im = new Image(W, H); im.blit(real, 0, 0); put(im, jf); put(im, rim); put(im, pf);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out.set(n * (cw + 1) + x, y, im.get(x0 + x, y0 + y));
      if (n > 0) for (let y = 0; y < ch; y++) out.set(n * (cw + 1) - 1, y, C.ink);
    });
    writeFileSync(join(HERE, 'park_fountain-objects-pigeons-top-2x.png'), indexedPng(out, S));
    // 꼭대기만 크게(4배): 재킷 위 앉음 | 재킷 미끄러지는 중 | 손에 턱(= 클리어 뒤 그림, 물줄기 빼고)
    const S4 = 4, tx = 186, ty = 18, tw = 76, th = 40;
    const zoom = new Image(tw * 3 + 2, th);
    [[jTop, topF], [slideLast[1], topF], [jHand, topF]].forEach(([jf, pf], n) => {
      const im = new Image(W, H); im.blit(real, 0, 0); put(im, jf); put(im, pf);
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) zoom.set(n * (tw + 1) + x, y, im.get(tx + x, ty + y));
      if (n > 0) for (let y = 0; y < th; y++) zoom.set(n * (tw + 1) - 1, y, C.ink);
    });
    writeFileSync(join(HERE, 'park_fountain-objects-pigeons-top-4x.png'), indexedPng(zoom, S4));
  }
}

// ── 오리 P9 (#529): 연못 물 위에 떠 있는지, 테두리(y 180~)에 안 걸리는지, 화면 JSON의 오리 anim이 시트에 다 있는지.
{
  const D = meta.objects.find((o) => o.key === 'duck');
  const names = ['duck.peck', 'duck.lap', 'duck.flap', 'duck.turn'];
  const missing = names.filter((n) => !A[n]);
  check(Boolean(D) && missing.length === 0, `오리 물건과 anim 4개가 시트에 있다${missing.length ? `: 없음 ${missing.join(', ')}` : ''}`);
  const raw = JSON.stringify(screen);
  check(names.every((n) => raw.includes(`"anim":["duck","${n.slice(5)}"]`)), '화면 JSON이 오리 anim 4개를 다 부른다');
  if (D && missing.length === 0) {
    const frames = [D.default.frame, ...names.flatMap((n) => A[n].frames)];
    const bottom = (f) => meta.frames[f].at[1] + meta.frames[f].src[3] - 1;
    // 물(y 172~179) 위에 떠 있다: 아래 끝(물방울 포함)이 물 띠 안, 테두리 앞면(y 180)보다 위
    check(frames.every((f) => bottom(f) >= 174 && bottom(f) <= 179), `오리 칸 아래 끝이 물 띠 안(174~179): ${[...new Set(frames.map(bottom))].join(', ')}`);
    const hot = screen.hotspots.duck.box;
    const [rx, ry] = meta.frames[D.default.frame].at, [, , rw, rh] = meta.frames[D.default.frame].src;
    check(rx >= hot[0] && ry >= hot[1] && rx + rw <= hot[0] + hot[2] && ry + rh <= hot[1] + hot[3], '떠 있는 그림이 히트 상자 안');
    const real = new Image(W, H);
    PARK.bg(real);
    const rim = meta.objects.find((o) => o.key === 'fountain').default.frame;
    const S = 4, x0 = 160, y0 = 152, cw = 48, ch = 34;
    const shots = [D.default.frame, A['duck.peck'].frames[0], A['duck.flap'].frames[0], ...A['duck.lap'].frames.slice(1, 3)];
    const out = new Image(cw * shots.length + shots.length - 1, ch);
    shots.forEach((f, n) => {
      const im = new Image(W, H); im.blit(real, 0, 0); put(im, f); put(im, rim);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out.set(n * (cw + 1) + x, y, im.get(x0 + x, y0 + y));
      if (n > 0) for (let y = 0; y < ch; y++) out.set(n * (cw + 1) - 1, y, C.ink);
    });
    writeFileSync(join(HERE, 'park_fountain-objects-duck-4x.png'), indexedPng(out, S));
  }
}

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
