// 쭉이 새 밀도 샘플 (#142, 사장님 결정 11/16 "세 사람 그림도 같이 더"). 원본은 art/sprites/jjuk-v4.mjs.
// 화면 1 완성 밀도 배경 샘플(#154, docs/design/screens/magpie_nest-density-sample.mjs) 위에 새 쭉이를 세워
// 배경과 사람의 밀도를 같은 그림에서 비교한다. 엔진 시트(public/sprites/)는 아직 바꾸지 않는다(사장님 OK 뒤 교체).
// 실행: node docs/design/art/jjuk-v4-sample.mjs
// 출력(같은 폴더):
//   jjuk-v4-scene-1x.png / -2x.png  배경 샘플 영역(256×270)에 새 쭉이 서 있기. 1배가 게임에서 보이는 크기
//   jjuk-v4-walk-2x.png             같은 배경 앞을 걸어가는 애니메이션(APNG, 90px/s, 거리로 프레임 넘김)
//   jjuk-v4-vs-4x.png               같은 자리, 왼쪽 옛 쭉이(#114) / 오른쪽 새 쭉이
//   jjuk-v4-sheet-4x.png            시트 8장: 위 옛 쭉이 / 가운데 새 쭉이 / 아래 새 쭉이 실루엣
//   jjuk-v4-gray-2x.png             scene의 명도(흑백) 버전 (ADR-0007 결정 3-6)
// 검사(어기면 종료 코드 1): 서 있기 0번 두 발 폭 짝수, 모든 프레임 발 맨 아랫줄 = 칸 마지막 행(art/build.mjs와 같은 규칙),
//   바깥 외곽선은 ink(결정 3-1), 바닥 주색과 쭉이 주색 명도 차 ≥ 30(결정 3-4), 칸 48×64.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { SHEET as OLD } from '../../../art/sprites/jjuk.mjs';
import { SHEET as NEW, HEAD_BOX } from '../../../art/sprites/jjuk-v4.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const CROP = [52, 0, 256, 270]; // 배경 샘플과 같은 영역
const FLOOR_Y = 244; // 배경 샘플에서 세 사람을 세운 바닥 y
const STAND_X = 214; // 배경 샘플의 쭉이 자리

// ── 배경 층(#154 스크립트가 만든다)
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
    if (raw[y * (w + 1)] !== 0) throw new Error('필터 0만 읽는다');
    for (let x = 0; x < w; x++) {
      const v = raw[y * (w + 1) + 1 + x];
      img.c[y * w + x] = v >= 32 ? EMPTY : v;
    }
  }
  return img;
}
const tmp = mkdtempSync(join(tmpdir(), 'jjuk-v4-'));
execFileSync(process.execPath, [join(HERE, '../screens/magpie_nest-density-sample.mjs')], { env: { ...process.env, DENSITY_LAYERS: tmp } });
const under = readPng(join(tmp, 'under.png'));
const over = readPng(join(tmp, 'over.png'));
rmSync(tmp, { recursive: true });

// ── 시트 만들기 (art/build.mjs buildSheet와 같은 규칙)
function build(def) {
  const frames = [];
  for (const a of def.anims) for (let k = 0; k < a.frames; k++) frames.push({ anim: a.name, k, ...def.drawFrame(def.pose(a.name, k)) });
  const f0 = frames[0];
  let x0 = Infinity, x1 = -Infinity;
  for (let y = 0; y < f0.K.h; y++)
    for (let x = 0; x < f0.K.w; x++)
      if (f0.feet.includes(f0.K.p[y * f0.K.w + x]) && f0.K.get(x, y) !== EMPTY) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const span = x1 - x0 + 3; // 외곽선 1px씩
  return { def, frames, span, ax: x0 - 1 + span / 2, hit: f0.K.bbox() };
}
const oldS = build(OLD);
const newS = build(NEW);

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
check(newS.frames.every((f) => f.K.w === 48 && f.K.h === 64), '칸 48×64 (#150 엔진 연결 그대로)');
check(newS.span % 2 === 0, `서 있기 0번 두 발 폭 ${newS.span}px 짝수 → 기준점 ax ${newS.ax} (옛 쭉이 ${oldS.ax})`);
const lowRows = newS.frames.map((f) => { const b = f.K.bbox(); return b.y + b.h; });
check(lowRows.every((r) => r === 64), `발 맨 아랫줄이 모든 프레임에서 63행 (${lowRows.join(',')})`);
{
  // 바깥 외곽선 = 투명과 4방향으로 맞닿은 가장 바깥 픽셀. 바닥(64행)에 닿은 발바닥 줄은 칸 밖이라 뺀다.
  let bad = 0;
  for (const f of newS.frames)
    for (let y = 0; y < 63; y++)
      for (let x = 0; x < 48; x++) {
        const c = f.K.get(x, y);
        if (c === EMPTY) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f.K.get(x + dx, y + dy) === EMPTY) && c !== C.ink) bad++;
      }
  check(bad === 0, `바깥 외곽선이 모두 ink (어긋난 픽셀 ${bad})`);
}
const floorMain = (() => {
  const m = new Map();
  for (let y = FLOOR_Y - 30; y < FLOOR_Y + 14; y++) for (let x = CROP[0]; x < CROP[0] + CROP[2]; x++) m.set(under.get(x, y), (m.get(under.get(x, y)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1])[0][0];
})();
for (const [name, c] of Object.entries({ 셔츠: C.red, '셔츠 줄무늬': C.white, 바지: C.dusk, 양말: C.cotton, 신발: C.wood, 얼굴: C.tan }))
  check(Math.abs(Y[c] - Y[floorMain]) >= 30, `바닥 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[floorMain])}`);
console.log(`히트 박스(서 있기 0번 그림 박스): 옛 [${Object.values(oldS.hit)}] → 새 [${Object.values(newS.hit)}], 머리 박스 [${HEAD_BOX}]`);
for (const s of [oldS, newS]) {
  const colors = new Set(), chest = [];
  let filled = 0;
  for (const f of s.frames) { for (const c of f.K.c) if (c !== EMPTY) { colors.add(c); filled++; } }
  for (const a of s.def.anims) for (let k = 0; k < a.frames; k++) chest.push(s.def.pose(a.name, k).chest);
  console.log(`${s === oldS ? '옛' : '새'} 쭉이: 색 ${colors.size}개, 프레임당 칠한 픽셀 평균 ${Math.round(filled / s.frames.length)}, 상체 내림(서기·걷기) ${chest.join(',')}`);
}

// ── 그리기 도우미
/** 엔진 그림자 흉내(#150: 보송 1번 plum, 너비 = 히트 폭 - 8, 높이 2) + 기준점 맞춰 프레임 놓기 */
function put(img, s, f, x, flip = false) {
  const sw = s.hit.w - 8;
  img.rect(x - (sw >> 1), FLOOR_Y - 1, sw, 2, C.plum);
  img.blit(f.K, x - s.ax, FLOOR_Y - 64, flip ? { flipAx: s.ax } : {});
}
const crop = (img, [x0, y0, w, h]) => { const o = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(x, y, img.get(x0 + x, y0 + y)); return o; };
function scene(draw) {
  const img = new Image(under.w, under.h);
  img.blit(under, 0, 0);
  draw(img);
  img.blit(over, 0, 0);
  return img;
}
function grayPng(img, S) {
  const w = img.w * S, h = img.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[img.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── 1) 배경 + 새 쭉이 서 있기
const standing = crop(scene((img) => put(img, newS, newS.frames[0], STAND_X)), CROP);
writeFileSync(join(HERE, 'jjuk-v4-scene-1x.png'), indexedPng(standing, 1));
writeFileSync(join(HERE, 'jjuk-v4-scene-2x.png'), indexedPng(standing, 2));
writeFileSync(join(HERE, 'jjuk-v4-gray-2x.png'), grayPng(standing, 2));

// ── 2) 같은 자리 옛/새 (사람 주변 96×84, 가운데 4px 레터박스색)
{
  const R = [STAND_X - 48, FLOOR_Y - 74, 96, 84];
  const a = crop(scene((img) => put(img, oldS, oldS.frames[0], STAND_X)), R);
  const b = crop(scene((img) => put(img, newS, newS.frames[0], STAND_X)), R);
  const vs = new Image(R[2] * 2 + 4, R[3], C.ink);
  vs.blit(a, 0, 0); vs.blit(b, R[2] + 4, 0);
  writeFileSync(join(HERE, 'jjuk-v4-vs-4x.png'), indexedPng(vs, 4));
}

// ── 3) 걷기 애니메이션: 숨쉬기 → 오른쪽으로 걷기 → 돌아서서 서 있기 (#150 엔진과 같은 규칙: 90px/s, 프레임 = floor(거리 / (walkCycle/6)) % 6)
{
  const R = [CROP[0] + 40, FLOOR_Y - 84, 200, 96];
  const idle = newS.frames.filter((f) => f.anim === 'idle');
  const walk = newS.frames.filter((f) => f.anim === 'walk');
  const out = [];
  const x0 = R[0] + 24, x1 = R[0] + R[2] - 24;
  idle.forEach((f, i) => out.push({ img: crop(scene((img) => put(img, newS, f, x0)), R), ms: NEW.anims[0].ms[i] }));
  for (let t = 0, x = x0; x <= x1; t += 50, x = x0 + (90 * t) / 1000) {
    const k = Math.floor((x - x0) / (NEW.walkCycle / 6)) % 6;
    out.push({ img: crop(scene((img) => put(img, newS, walk[k], Math.round(x))), R), ms: 50 });
  }
  out.push({ img: crop(scene((img) => put(img, newS, idle[0], x1, true)), R), ms: 900 });
  out.push({ img: crop(scene((img) => put(img, newS, idle[1], x1, true)), R), ms: 500 });
  writeFileSync(join(HERE, 'jjuk-v4-walk-2x.png'), animatedPng(out, 2));
}

// ── 4) 시트 비교: 옛 / 새 / 새 실루엣
{
  const gap = 6, n = newS.frames.length, rowH = 74;
  const img = new Image(gap + n * (48 + gap), rowH * 3, C.cotton);
  const rows = [[oldS, null], [newS, null], [newS, () => C.ink]];
  rows.forEach(([s, map], r) => {
    const y0 = r * rowH + 4;
    img.rect(0, y0 + 64, img.w, rowH - 68, C.grnL);
    s.frames.forEach((f, i) => {
      const x = gap + i * (48 + gap);
      for (let k = 0; k < 64; k += 2) { img.set(x - 1, y0 + k, C.lint); img.set(x + 48, y0 + k, C.lint); }
      img.blit(f.K, x, y0, map ? { map } : {});
    });
  });
  writeFileSync(join(HERE, 'jjuk-v4-sheet-4x.png'), indexedPng(img, 4));
}

console.log(`scene 1배 인덱스 PNG ${indexedPng(standing, 1).length} bytes`);
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
