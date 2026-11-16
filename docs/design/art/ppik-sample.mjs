// 삑삑이 새 밀도 시트 미리보기 (#144). 원본은 art/sprites/ppik.mjs, 엔진 시트는 node art/build.mjs가 만든다.
// 화면 1 밀도 배경 샘플(#154) 위에 새 쭉이(jjuk-v4)·묵직이(mukjik)와 셋을 나란히 세운다 = 사장님께 보여 드릴 "세 사람 같이 선 그림"(#142).
// 실행: node docs/design/art/ppik-sample.mjs
// 출력(같은 폴더):
//   crew-scene-1x.png / -2x.png  배경 샘플 영역(256×270)에 쭉이·묵직이·삑삑이 서 있기. 1배가 게임에서 보이는 크기
//   crew-gray-2x.png             scene의 명도(흑백) 버전 (ADR-0007 결정 3-6)
//   ppik-walk-2x.png             삑삑이가 같은 배경 앞을 걷는 애니메이션(APNG, 90px/s, walkCycle 24)
//   ppik-sheet-4x.png            시트 8장: 위 색 / 아래 실루엣, 왼쪽 끝은 크기 비교용 쭉이·묵직이 서 있기
// 검사(어기면 종료 코드 1): 칸 48×64, 서 있기 0번 두 발 폭 짝수, 모든 프레임 발 맨 아랫줄 = 63행,
//   바깥 외곽선 ink(결정 3-1), 바닥 주색과 주색 명도 차 ≥ 30(결정 3-4), 실루엣에서 둘과 구별(키 차 ≥ 10px).

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
import { SHEET as JJUK } from '../../../art/sprites/jjuk-v4.mjs';
import { SHEET as MUK } from '../../../art/sprites/mukjik.mjs';
import { SHEET as PPIK, HEAD_BOX } from '../../../art/sprites/ppik.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const CROP = [52, 0, 256, 270]; // 배경 샘플과 같은 영역
const FLOOR_Y = 244; // 배경 샘플에서 세 사람을 세운 바닥 y
const STAND_X = 214; // 배경 샘플의 쭉이 자리
const MUK_X = 262; // 묵직이는 쭉이 오른쪽
const PPIK_X = 112; // 삑삑이는 기둥 왼쪽(바구니에 안 가리게)

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
const tmp = mkdtempSync(join(tmpdir(), 'ppik-'));
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
const jj = build(JJUK);
const mk = build(MUK);
const pk = build(PPIK);

const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
check(pk.frames.every((f) => f.K.w === 48 && f.K.h === 64), '칸 48×64');
check(pk.span % 2 === 0, `서 있기 0번 두 발 폭 ${pk.span}px 짝수 → 기준점 ax ${pk.ax}`);
const lowRows = pk.frames.map((f) => { const b = f.K.bbox(); return b.y + b.h; });
check(lowRows.every((r) => r === 64), `발 맨 아랫줄이 모든 프레임에서 63행 (${lowRows.join(',')})`);
{
  let bad = 0;
  for (const f of pk.frames)
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
for (const [name, c] of Object.entries({ 우비: C.yel, 장화: C.red, 얼굴: C.tan, 고무닭: C.white, 앞머리: C.plum }))
  check(Math.abs(Y[c] - Y[floorMain]) >= 30, `바닥 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name}(Y${Y[c]}) 차 ${Math.abs(Y[c] - Y[floorMain])}`);
check(jj.hit.h - pk.hit.h >= 10 && mk.hit.h - pk.hit.h >= 10, `실루엣 키: 쭉이 ${jj.hit.h} / 묵직이 ${mk.hit.h} / 삑삑이 ${pk.hit.h}px, 폭: ${jj.hit.w} / ${mk.hit.w} / ${pk.hit.w}px`);
console.log(`삑삑이 히트 박스(서 있기 0번 그림 박스) [${Object.values(pk.hit)}], 기준점 ax ${pk.ax}, 머리 박스 [${HEAD_BOX}]`);
{
  const colors = new Set();
  let filled = 0;
  for (const f of pk.frames) for (const c of f.K.c) if (c !== EMPTY) { colors.add(c); filled++; }
  const chest = [];
  for (const a of PPIK.anims) for (let k = 0; k < a.frames; k++) chest.push(PPIK.pose(a.name, k).chest);
  console.log(`삑삑이: 색 ${colors.size}개, 프레임당 칠한 픽셀 평균 ${Math.round(filled / pk.frames.length)}, 상체 내림(서기·걷기) ${chest.join(',')}`);
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

// ── 1) 배경 + 세 사람 서 있기
const standing = crop(scene((img) => { put(img, jj, jj.frames[0], STAND_X); put(img, mk, mk.frames[0], MUK_X); put(img, pk, pk.frames[0], PPIK_X); }), CROP);
writeFileSync(join(HERE, 'crew-scene-1x.png'), indexedPng(standing, 1));
writeFileSync(join(HERE, 'crew-scene-2x.png'), indexedPng(standing, 2));
writeFileSync(join(HERE, 'crew-gray-2x.png'), grayPng(standing, 2));

// ── 2) 걷기: 숨쉬기 → 왼쪽에서 오른쪽으로 걷기 → 돌아서서 서 있기 (엔진 규칙: 90px/s, 프레임 = floor(거리 / (walkCycle/6)) % 6)
{
  const R = [CROP[0] + 40, FLOOR_Y - 84, 200, 96];
  const idle = pk.frames.filter((f) => f.anim === 'idle');
  const walk = pk.frames.filter((f) => f.anim === 'walk');
  const out = [];
  const x0 = R[0] + 24, x1 = R[0] + R[2] - 24;
  idle.forEach((f, i) => out.push({ img: crop(scene((img) => put(img, pk, f, x0)), R), ms: PPIK.anims[0].ms[i] }));
  for (let t = 0, x = x0; x <= x1; t += 50, x = x0 + (90 * t) / 1000) {
    const k = Math.floor((x - x0) / (PPIK.walkCycle / 6)) % 6;
    out.push({ img: crop(scene((img) => put(img, pk, walk[k], Math.round(x))), R), ms: 50 });
  }
  out.push({ img: crop(scene((img) => put(img, pk, idle[0], x1, true)), R), ms: 900 });
  out.push({ img: crop(scene((img) => put(img, pk, idle[1], x1, true)), R), ms: 600 });
  writeFileSync(join(HERE, 'ppik-walk-2x.png'), animatedPng(out, 2));
}

// ── 3) 시트: 위 색 / 아래 실루엣. 왼쪽 두 칸은 쭉이·묵직이 서 있기(크기 비교)
{
  const gap = 6, rowH = 74;
  const list = [jj.frames[0], mk.frames[0], ...pk.frames];
  const img = new Image(gap + list.length * (48 + gap), rowH * 2, C.cotton);
  [null, () => C.ink].forEach((map, r) => {
    const y0 = r * rowH + 4;
    img.rect(0, y0 + 64, img.w, rowH - 68, C.grnL);
    list.forEach((f, i) => {
      const x = gap + i * (48 + gap);
      for (let k = 0; k < 64; k += 2) { img.set(x - 1, y0 + k, C.lint); img.set(x + 48, y0 + k, C.lint); }
      img.blit(f.K, x, y0, map ? { map } : {});
    });
  });
  writeFileSync(join(HERE, 'ppik-sheet-4x.png'), indexedPng(img, 4));
}

console.log(`scene 1배 인덱스 PNG ${indexedPng(standing, 1).length} bytes`);
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
