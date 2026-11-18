// 시소 올라서기·기울기 미리보기 (#397, 설계 docs/design/screens/magpie_nest.md 1-5절).
// 배포 그림(배경 PNG, 캐릭터 시트 PNG)과 물건 원본의 널빤지 함수(seesawTilt)로 그린다. 올라서기 전용 자세 칸은 아직 없어서
// 서 있기 0번 칸을 궤적 위에 놓는다(자세 칸은 후속 그림 PR). 궤적·시간·기울기·발 높이를 보는 용도다.
// 실행: node docs/design/art/seesaw-board-preview.mjs
// 출력(같은 폴더):
//   seesaw-tilt-states-3x.png   멈춘 기울기 6가지(빈 판, 혼자 탄 셋, 둘이 탄 둘). 발이 널빤지 윗면에 붙는지 본다
//   seesaw-board-hop-3x.png     APNG: 쭉이 왼쪽 끝 올라서기 → 묵직이 오른쪽 끝 올라서기 → 묵직이 내려서기 (실제 ms)
//   seesaw-board-hop-frames-2x.png  위 APNG의 낱장 모음(6열, 왼쪽 위부터 순서대로)
// 검사(어기면 종료 코드 1): 서 있는 사람 발 y = 그 열 널빤지 윗면 y, 올라서기 궤적이 착지 직전에 위에서 내려온다.
// 이 미리보기의 facing은 전부 -1(왼쪽을 봄, 오른쪽에서 걸어와 탄 경우)이다.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { seesawTilt } from '../../../art/scenes/magpie_nest.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');

// ── 설계 1-5절 수치 (엔진이 같은 값을 쓴다)
const PIVOT_X = 248; // 받침 가운데(물건 원본 PIVOT_X와 같다)
const PLANK_TOP = 214; // 수평일 때 널빤지 윗면 = 서는 자리 발 y
const SPOTS = { left: 220, right: 284 };
const WEIGHT = { jjuk: 1, ppik: 1, mukjik: 2 };
const STEP = 3; // 무게 차 1당 오른쪽 끝이 내려가는 px
const GROUND_Y = 240; // 올라서기 바닥 점 y(받침 바닥선 236보다 앞)
const GROUND_DX = 6; // 바닥 점 board = 서는 자리에서 오른쪽(시작 위치 쪽)으로 6px, 두 끝 모두 한 점
const HOP = { // 올라서기: 웅크림 → 공중 → 착지 웅크림(ms, 캐릭터 시트 규칙대로 50ms 배수, ADR-0007), H = 직선 위로 솟는 높이(px)
  jjuk: { crouch: 100, air: 150, land: 50, H: 10 },
  ppik: { crouch: 50, air: 150, land: 50, H: 12 },
  mukjik: { crouch: 150, air: 150, land: 50, H: 8 },
};
const DOWN = { air: 100, land: 50, H: 8 }; // 내려서기(셋 같음)

const tiltOf = (on) => STEP * ((on.right ? WEIGHT[on.right] : 0) - (on.left ? WEIGHT[on.left] : 0));
/** 물건 원본 plank()와 같은 식: 열 x가 내려가는 px */
const colDy = (x, d) => Math.round((d * (x - PIVOT_X + 0.5)) / 40);
const footY = (side, d) => PLANK_TOP + colDy(SPOTS[side], d);

// ── PNG 읽기(필터 0 인덱스 PNG만, 우리 빌드 출력)
function readPng(file) {
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
  for (let y = 0; y < h; y++) {
    if (raw[y * (w + 1)] !== 0) throw new Error(`${file}: 필터 0만 읽는다`);
    for (let x = 0; x < w; x++) {
      const v = raw[y * (w + 1) + 1 + x];
      img.c[y * w + x] = v >= 32 ? EMPTY : v;
    }
  }
  return img;
}

const bg = readPng(join(ROOT, 'public/scenes/magpie_nest-bg.png'));
const SHEETS = Object.fromEntries(['jjuk', 'ppik', 'mukjik'].map((id) => {
  const meta = JSON.parse(readFileSync(join(ROOT, `public/sprites/${id}-base.json`), 'utf8'));
  return [id, { meta, img: readPng(join(ROOT, 'public/sprites', meta.image)) }];
}));

/** 엔진 drawSprite와 같은 배치(서 있기 0번 칸). facing 1 = 시트 그대로, -1 = 기준점 축 반전. 그림자는 엔진 흉내(plum, 히트 폭-8, 높이 2). */
function put(img, id, x, y, facing) {
  const { meta, img: sheet } = SHEETS[id];
  const [cw, ch] = meta.cell, [ax, ay] = meta.anchor;
  const sx = meta.anims.idle.frames[0] * cw;
  const sw = meta.hit[2] - 8;
  img.rect(x - (sw >> 1), y - 1, sw, 2, C.plum);
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) {
      const c = sheet.get(sx + i, j);
      if (c === EMPTY) continue;
      const px = facing === 1 ? x - ax + i : x + ax - i - 1;
      img.set(px, y - ay + j, c);
    }
}

const CROP = [176, 150, 160, 100];
function frame(d, people, extra) {
  const img = new Image(480, 270);
  img.blit(bg, 0, 0);
  seesawTilt(d)(img);
  // 발 y 순서로(엔진 4번 층)
  for (const p of [...people].sort((a, b) => a.y - b.y)) put(img, p.id, Math.round(p.x), Math.round(p.y), p.facing);
  if (extra) extra(img);
  const o = new Image(CROP[2], CROP[3]);
  for (let y = 0; y < CROP[3]; y++) for (let x = 0; x < CROP[2]; x++) o.set(x, y, img.get(CROP[0] + x, CROP[1] + y));
  return o;
}

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };

// ── 1. 멈춘 기울기 6가지
const STATES = [
  ['빈 판', {}],
  ['쭉이 왼쪽', { left: 'jjuk' }],
  ['묵직이 왼쪽', { left: 'mukjik' }],
  ['삑삑이 오른쪽', { right: 'ppik' }],
  ['쭉이 + 묵직이', { left: 'jjuk', right: 'mukjik' }],
  ['쭉이 + 삑삑이', { left: 'jjuk', right: 'ppik' }],
];
const tiles = [];
for (const [name, on] of STATES) {
  const d = tiltOf(on);
  const people = Object.entries(on).map(([side, id]) => ({ id, x: SPOTS[side], y: footY(side, d), facing: -1 }));
  // 발 y = 그 열 널빤지 윗면: 같은 그림을 다시 그려 윗면 첫 칠한 픽셀 행을 찾는다
  for (const p of people) {
    const t = new Image(480, 270);
    seesawTilt(d)(t);
    let top = -1;
    for (let y = 200; y < 240 && top < 0; y++) if (t.get(p.x, y) !== EMPTY) top = y;
    // 외곽선 1px 위가 첫 칠 → 윗면 = top + 1
    check(p.y === top + 1, `${name} d=${d}: ${p.id} 발 y ${p.y} = 널빤지 윗면 ${top + 1}`);
  }
  tiles.push(frame(d, people));
  console.log(`${name}: d=${d} (오른쪽 끝 +${d}px), 발 y ${people.map((p) => `${p.id} ${p.y}`).join(', ') || '-'}`);
}
{
  const G = 4, cols = 3, rows = 2;
  const sheet = new Image(cols * CROP[2] + (cols - 1) * G, rows * CROP[3] + (rows - 1) * G, C.ink);
  tiles.forEach((t, i) => sheet.blit(t, (i % cols) * (CROP[2] + G), Math.floor(i / cols) * (CROP[3] + G)));
  writeFileSync(join(HERE, 'seesaw-tilt-states-3x.png'), indexedPng(sheet, 3));
}

// ── 2. 올라서기 APNG (틱 = 1000/60ms, 미리보기는 2틱 = 33ms 단위로 끊는다)
const TICK = 1000 / 60;
const frames = [];
const push = (img, ms) => frames.push({ img, ms: Math.max(1, Math.round(ms)) });
/** 바닥 점 → 판 위 궤적. t 0~1. y는 직선 + 위로 H·4t(1−t). */
const arc = (a, b, H, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - H * 4 * t * (1 - t) });
function hop(people, mover, from, to, spec, dBefore, dAfter, label) {
  const others = people.filter((p) => p !== mover);
  const draw = (d, m) => frame(d, [...others, m]);
  if (spec.crouch) push(draw(dBefore, { ...mover, ...from }), spec.crouch); // 웅크림(자세 칸 대신 서 있기)
  const n = Math.round(spec.air / (2 * TICK));
  let ok = true;
  for (let k = 1; k <= n; k++) {
    const p = arc(from, to, spec.H, k / n);
    const up = to.y < from.y;
    // 올라설 때: 판 윗면보다 아래(앞)에 있는 동안엔 가로로 판 안쪽에 들어가지 않는다 = 마지막 칸 직전에 이미 윗면 위
    if (up && k === n - 1 && p.y > to.y) ok = false;
    // 공중 칸에서 기울기: 올라서기는 착지 전까지 이전, 내려서기는 뜨는 순간 다음
    push(draw(up ? dBefore : dAfter, { ...mover, x: p.x, y: p.y }), spec.air / n);
  }
  if (to.y < from.y) check(ok, `${label}: 착지 직전 칸이 판 윗면 위(위에서 내려와 선다)`);
  push(draw(dAfter, { ...mover, ...to }), spec.land); // 착지 웅크림
  Object.assign(mover, to);
}
{
  const jj = { id: 'jjuk', x: 300, y: GROUND_Y, facing: -1 };
  const mk = { id: 'mukjik', x: 330, y: GROUND_Y + 4, facing: -1 };
  const people = [jj, mk];
  push(frame(0, people), 500);
  // 쭉이: 오른쪽에서 걸어와 왼쪽 끝 바닥 점(220+6, 240)에 선다(걷기는 생략)
  Object.assign(jj, { x: SPOTS.left + GROUND_DX, y: GROUND_Y });
  push(frame(0, people), 300);
  const dJ = tiltOf({ left: 'jjuk' });
  hop(people, jj, { x: jj.x, y: jj.y }, { x: SPOTS.left, y: footY('left', dJ) }, HOP.jjuk, 0, dJ, '쭉이 왼쪽 올라서기');
  push(frame(dJ, people), 500);
  // 묵직이: 오른쪽 끝 바닥 점(284+6, 240)
  Object.assign(mk, { x: SPOTS.right + GROUND_DX, y: GROUND_Y });
  push(frame(dJ, people), 300);
  const dB = tiltOf({ left: 'jjuk', right: 'mukjik' });
  // 다른 사람 발도 새 기울기를 따른다
  const follow = (d) => { jj.y = footY('left', d); };
  hop(people, mk, { x: mk.x, y: mk.y }, { x: SPOTS.right, y: footY('right', dB) }, HOP.mukjik, dJ, dB, '묵직이 오른쪽 올라서기');
  follow(dB);
  frames[frames.length - 1] = { img: frame(dB, people), ms: HOP.mukjik.land };
  push(frame(dB, people), 700);
  // 묵직이 내려서기: 같은 board 점으로
  hop(people, mk, { x: mk.x, y: mk.y }, { x: SPOTS.right + GROUND_DX, y: GROUND_Y }, { ...DOWN, crouch: 0 }, dB, dJ, '묵직이 내려서기');
  follow(dJ);
  push(frame(dJ, people), 900);
  writeFileSync(join(HERE, 'seesaw-board-hop-3x.png'), animatedPng(frames, 3));
  // 낱장 모음(정지 화면에서 궤적 확인용): 칸마다 왼쪽 위에 ms 눈금(2ms당 1px 아님, 칸 순서만)
  const G = 2, cols = 6, rows = Math.ceil(frames.length / cols);
  const strip = new Image(cols * CROP[2] + (cols - 1) * G, rows * CROP[3] + (rows - 1) * G, C.ink);
  frames.forEach((f, i) => strip.blit(f.img, (i % cols) * (CROP[2] + G), Math.floor(i / cols) * (CROP[3] + G)));
  writeFileSync(join(HERE, 'seesaw-board-hop-frames-2x.png'), indexedPng(strip, 2));
  console.log(`APNG ${frames.length}칸, 합계 ${frames.reduce((a, f) => a + f.ms, 0)}ms`);
  const sum = (s) => (s.crouch ?? 0) + s.air + s.land;
  console.log(`올라서기 ms: 쭉이 ${sum(HOP.jjuk)}, 삑삑이 ${sum(HOP.ppik)}, 묵직이 ${sum(HOP.mukjik)} / 내려서기 ${sum(DOWN)}`);
}

if (problems.length) {
  console.log(`\n${problems.length}개 실패`);
  process.exit(1);
}
