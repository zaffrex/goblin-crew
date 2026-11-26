// 스테이지 3 `laundromat` 배경 구도 시안 (#764). 방 껍데기(art/scenes/laundromat.room.mjs) + 세탁기 줄(#853) + 셔터(#856) + 3번 건조기(#879)·세제 자판기(#882)
// + B 설계(laundromat.md 2-1, 9-2) 덕트 길·들창(R1+R2), 셔터 찌그러진 틈(R3), 열쇠 + 나무 패(O1), 후드 위 빈 둥지(O2 1칸).
// 들창 안 까치는 magpie_nest 앉음 그림(`smug`)을 자리만 옮겨 얹었다(9-1 재사용, 0칸). 모두 진짜 그림이고 자리 표시는 없다.
// 실행: node docs/design/screens/laundromat-bg-sketch.mjs
// 출력(같은 폴더):
//   laundromat-bg-sketch-2x.png       시작 3초 화면(잠긴 셔터 + 세 사람 시작 위치 240·280·320). 세 사람은 배포 시트 0칸
//   laundromat-bg-sketch-gray-2x.png  같은 장면 명도(흑백) (ADR-0007 결정 3-6)
//   laundromat-bg-sketch-1x.png       같은 장면 1배(9-3 그림 블라인드용: 글·표시 없이 이 한 장만 보여 준다)
//   laundromat-bg-sketch-4x.png       왼쪽: 들창(덕트 끝·판자·후드·둥지·까치) / 오른쪽: 셔터 찌그러진 틈과 열쇠 4배
// 검사(어기면 종료 코드 1):
//   - 방 껍데기에 ink(0)·hint(31) 없음, 빨강 계열 없음 (결정 3-1, X4)
//   - 바닥 주색과 세 사람 주색 명도 차 ≥ 30 (결정 3-4)
//   - 아래 벽 띠 주색과 세 사람 주색·세탁기 몸 주색 차 ≥ 30 (시작 줄에서 몸이 세탁기·벽에 묻히지 않게)
//   - 벽 주색과 셔터 판·세탁기 몸 주색 차 ≥ 30
//   - 덕트 lint와 벽·천장 차 ≥ 30, 덕트 세로 구간이 `duct` 핫스팟(352,120 30×44)과 걸림 자리(367,150)를 덮음 (2-1)
//   - 들창 바깥 주색과 까치 ink·둥지 주색 차 ≥ 30, 까치·둥지·후드가 들창 틀 안 (2-1 "창 안에 32px")
//   - 셔터 틈: 가장 큰 틈 14px, 열쇠 패가 틈 안에 다 보임(판에 안 가려짐), 패·열쇠 주색과 길바닥 주색 차 ≥ 30, `gap` 핫스팟(80,222 40×24) 안
//   - 빈 열쇠 걸이 판 주색과 둘레 벽 차 ≥ 30 (클리어 컷 `clear_hook`이 가리키는 물건)
//   - 벽시계 판과 벽 차 ≥ 20(흰 판이 벽보다 밝게) — 숫자 대신 테두리·바늘로 읽힌다
//   - 꺼진 오른쪽 구석(x ≥ 340)의 켜진 불은 3번 건조기 표시등 하나: 건조기 상자 밖 yel 2×2 덩어리 0(세제 상자 6개는 뺀다)
//   - 건조기·자판기 바닥 그림자(y 236, 상자 밖 한 줄)가 장면에 남아 있다 — 물건 시트로 옮길 때 배경에 구워야 하는 줄(#882 Theo 리뷰)

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { stamp, outlined } from '../../../art/lib/texture.mjs';
import { room, W, H, FLOOR_Y, WAINSCOT_Y, CEIL_Y, KEY_HOOK, CLOCK, DUCT, TRANSOM, HOOD } from '../../../art/scenes/laundromat.room.mjs';
import { washer, WASHER_H } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter, SHUTTER, gapLift } from '../../../art/scenes/laundromat.shutter.mjs';
import { keyTag, KEY_TAG, KEY_ON_STREET, KEY_PLATE, KEY_RING_HOLE, nestEmpty, NEST } from '../../../art/scenes/laundromat.objects.mjs';
import { MAGPIE, MAGPIE_LEGEND } from '../../../art/scenes/magpie_nest.objects.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending, VEND_BOX } from '../../../art/scenes/laundromat.vending.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const ROW = { x0: 176, y: 180, pitch: 40 }; // 설계 1-1 메모: 세탁기 4대 176~336, y 180~236
const ROW_DOORS = ['open', 'load', 'empty', 'empty']; // #853: 문 열린 칸은 사람에게 안 가리는 1번. #935 후보 11: 빨래 든 통은 2번 하나뿐(art/scenes/laundromat.mjs와 같은 값)
// B 설계 핫스팟 제안(laundromat.md 2-1). 화면 JSON은 아직 이전 초안이라 여기 적는다(Kai·Theo 화면 JSON PR에서 옮긴다)
const GAP_BOX = [80, 222, 40, 24], DUCT_BOX = [352, 120, 30, 44], STUCK = [367, 150];
const MAGPIE_AT = [61, 27]; // smug 20×18, 앞발(열 12~15)이 둥지 위 끝(y 43~44)을 밟는다
if (ROW.y + WASHER_H !== FLOOR_Y) throw new Error(`세탁기 아래 끝 ${ROW.y + WASHER_H} ≠ 바닥 ${FLOOR_Y}`);

const shell = new Image(W, H); // 방 껍데기만(검사용)
room(shell);

const scene = new Image(W, H);
room(scene);
for (let i = 0; i < 4; i++) washer(scene, ROW.x0 + i * ROW.pitch + 1, ROW.y, { n: i + 1, door: ROW_DOORS[i] });
shutter(scene, 'locked');
dryer(scene, SCREEN.hotspots.dryer_3.box[0], SCREEN.hotspots.dryer_3.box[1]); // 정지 그림(검사: laundromat-dryer-preview.mjs)
vending(scene, SCREEN.hotspots.soap_vending.box[0], SCREEN.hotspots.soap_vending.box[1]); // 정지 그림(검사: laundromat-vending-preview.mjs)
// 물건(외곽선): 길바닥 열쇠, 후드 위 빈 둥지, 그 위 까치
const shutterOnly = new Image(W, H); // 열쇠가 판에 가려지는지 보려고 셔터만 따로
shutter(shutterOnly, 'locked');
keyTag(scene, KEY_ON_STREET.x, KEY_ON_STREET.y);
nestEmpty(scene);
{ const t = new Image(W, H); stamp(t, MAGPIE_AT[0], MAGPIE_AT[1], MAGPIE.smug, MAGPIE_LEGEND); scene.blit(outlined(t), 0, 0); }

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
const props = new Image(W, H); // 사람 올리기 전(켜진 불·그림자 검사용)
props.c.set(scene.c);
const START = { jjuk: 240, mukjik: 280, ppik: 320 }; // 화면 JSON note: 시작 좌표 floor ±40
for (const [id, sx] of Object.entries(START)) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'public/sprites', `${id}-base.json`), 'utf8'));
  const sheet = readIndexedPng(join(ROOT, 'public/sprites', meta.image));
  const [cw, ch] = meta.cell, [ax, ay] = meta.anchor;
  const cell = new Image(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cell.set(x, y, sheet.get(x, y));
  scene.blit(cell, sx - ax, 244 - ay);
}

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (img, x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY) m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const main = (img, x0, y0, w, h) => [...count(img, x0, y0, w, h)].sort((a, b) => b[1] - a[1])[0][0];
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const name = (c) => `#${c}(Y${Y[c]})`;
const PEOPLE = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };
const WASHER_BODY = C.grnL, PANEL = C.lint; // #853·#856 검사의 주색

const used = count(shell, 0, 0, W, H);
const bad = [C.ink, C.hint, C.redD, C.red, C.redL].filter((c) => used.has(c));
check(bad.length === 0, `방 껍데기에 ink·hint·빨강 없음${bad.length ? ` (${bad.join(',')})` : ''}`);
const floorMain = main(shell, 0, FLOOR_Y, W, H - FLOOR_Y);
for (const [n, c] of Object.entries(PEOPLE)) check(dY(floorMain, c) >= 30, `바닥 ${name(floorMain)} vs ${n} ${name(c)} 차 ${dY(floorMain, c)} ≥ 30`);
const band = main(shell, 0, WAINSCOT_Y + 2, W, FLOOR_Y - WAINSCOT_Y - 4);
for (const [n, c] of Object.entries({ ...PEOPLE, '세탁기 몸': WASHER_BODY })) check(dY(band, c) >= 30, `아래 벽 띠 ${name(band)} vs ${n} ${name(c)} 차 ${dY(band, c)} ≥ 30`);
const wallMain = main(shell, 0, CEIL_Y + 1, W, WAINSCOT_Y - CEIL_Y - 1);
check(dY(wallMain, PANEL) >= 30, `벽 ${name(wallMain)} vs 셔터 판 ${name(PANEL)} 차 ${dY(wallMain, PANEL)} ≥ 30`);
check(dY(wallMain, WASHER_BODY) >= 30, `벽 ${name(wallMain)} vs 세탁기 몸 ${name(WASHER_BODY)} 차 ${dY(wallMain, WASHER_BODY)} ≥ 30`);
// 덕트 길(R1)
const ductMain = main(shell, DUCT.endX + 8, DUCT.runY + 2, 200, DUCT.runH - 4);
check(dY(ductMain, wallMain) >= 30, `덕트 ${name(ductMain)} vs 벽 ${name(wallMain)} 차 ${dY(ductMain, wallMain)} ≥ 30`);
check(dY(ductMain, C.dusk) >= 30, `덕트 ${name(ductMain)} vs 천장 dusk 차 ${dY(ductMain, C.dusk)} ≥ 30`);
{
  const [bx, by, bw, bh] = DUCT_BOX;
  check(DUCT.x >= bx && DUCT.x + DUCT.w <= bx + bw && DUCT.runY + DUCT.runH <= by && DUCT.bottom >= by + bh, `덕트 세로 구간 x ${DUCT.x}~${DUCT.x + DUCT.w - 1}, y ${DUCT.runY + DUCT.runH}~${DUCT.bottom - 1}이 duct 핫스팟 ${DUCT_BOX.join(',')}를 채움`);
  check(STUCK[0] >= DUCT.x && STUCK[0] < DUCT.x + DUCT.w && STUCK[1] > DUCT.runY + DUCT.runH && STUCK[1] < DUCT.bottom, `걸림 자리 ${STUCK.join(',')}가 덕트 세로 구간 위`);
}
// 들창(R2) + 둥지(O2) + 까치
const outside = main(shell, TRANSOM.paneL.x, TRANSOM.inY, TRANSOM.paneL.w, 20);
check(dY(outside, C.ink) >= 30, `들창 바깥 ${name(outside)} vs 까치 ink 차 ${dY(outside, C.ink)} ≥ 30`);
const nestImg = new Image(W, H); nestEmpty(nestImg);
const nestMain = main(nestImg, NEST.x + 2, NEST.y + 2, NEST.w - 6, 5);
check(dY(outside, nestMain) >= 30, `들창 바깥 ${name(outside)} vs 둥지 ${name(nestMain)} 차 ${dY(outside, nestMain)} ≥ 30`);
{
  const { x, y, w, h } = TRANSOM;
  const ins = (px, py) => px >= x && px < x + w && py >= y && py < y + h;
  const parts = { 까치: [MAGPIE_AT[0], MAGPIE_AT[1], 20, 18], 둥지: [NEST.x, NEST.y, NEST.w, NEST.h], 후드: [HOOD.capX, HOOD.y - 1, 86 - HOOD.capX, HOOD.h + 3] };
  for (const [n, [px, py, pw, ph]] of Object.entries(parts)) check(ins(px, py) && ins(px + pw - 1, py + ph - 1), `${n} ${px},${py} ${pw}×${ph}가 들창 틀 ${x},${y} ${w}×${h} 안`);
}
// 셔터 틈(R3) + 열쇠(O1)
{
  const bottom = SHUTTER.y + SHUTTER.h;
  let maxGap = 0; for (let px = SHUTTER.x; px < SHUTTER.x + SHUTTER.w; px++) maxGap = Math.max(maxGap, gapLift(px));
  check(maxGap === 14, `가장 큰 틈 ${maxGap}px = 14 (laundromat.md 2-1)`);
  const { x: kx, y: ky } = KEY_ON_STREET, { w: kw, h: kh } = KEY_TAG;
  const keyImg = new Image(W, H); keyTag(keyImg, kx, ky);
  let drawn = 0, under = 0; for (let px = kx; px < kx + kw; px++) for (let py = ky; py < ky + kh; py++) if (keyImg.get(px, py) !== EMPTY) { drawn++; if (py < bottom - gapLift(px)) under++; }
  check(under === 0, `열쇠 ${drawn}칸 중 셔터 판 아래 끝보다 위(판 앞에 겹침) ${under}칸 = 0`);
  const street = main(shutterOnly, kx, bottom - 3, kw, 3);
  const tagMain = main(keyImg, kx + KEY_PLATE.x, ky + KEY_PLATE.y, KEY_PLATE.w, KEY_PLATE.h), keyMain = C.yel;
  // 블라인드 11/25 "갈색 상자 + 노란 병아리": 금색이 패보다 넓어야 열쇠가 먼저 보이고, 고리 구멍이 1px이면 눈으로 읽힌다
  let gold = 0, wood = 0; for (let px = kx; px < kx + kw; px++) for (let py = ky; py < ky + kh; py++) { const c = keyImg.get(px, py); if ([C.yelL, C.yel, C.yelD, C.white].includes(c)) gold++; if ([C.tan, C.woodL, C.wood].includes(c)) wood++; }
  check(gold >= wood, `길바닥 열쇠 금색 ${gold}px ≥ 나무 패 ${wood}px`);
  const hx = kx + KEY_RING_HOLE.x, hy = ky + KEY_RING_HOLE.y;
  const hole = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => keyImg.get(hx + a, hy + b) === EMPTY);
  const rim = [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]].every(([a, b]) => [C.yelL, C.yel, C.yelD].includes(keyImg.get(hx + a, hy + b)));
  check(hole && rim, `고리 구멍 ${hx},${hy} 2×2가 비어 있고(길바닥이 비침) 둘레 8px이 금색`);
  check(dY(tagMain, street) >= 30, `나무 패 ${name(tagMain)} vs 길바닥 ${name(street)} 차 ${dY(tagMain, street)} ≥ 30`);
  check(dY(keyMain, street) >= 30, `열쇠 ${name(keyMain)} vs 길바닥 ${name(street)} 차 ${dY(keyMain, street)} ≥ 30`);
  const [gx, gy, gw, gh] = GAP_BOX;
  check(kx >= gx && kx + kw <= gx + gw && ky >= gy && ky + kh <= gy + gh, `열쇠 ${kx},${ky} ${kw}×${kh}가 gap 핫스팟 ${GAP_BOX.join(',')} 안`);
}
const hookMain = main(shell, KEY_HOOK.x, KEY_HOOK.y, KEY_HOOK.w, KEY_HOOK.h);
const hookAround = main(shell, KEY_HOOK.x - 4, KEY_HOOK.y - 4, 2, KEY_HOOK.h + 8);
check(dY(hookMain, hookAround) >= 30, `열쇠 걸이 판 ${name(hookMain)} vs 둘레 벽 ${name(hookAround)} 차 ${dY(hookMain, hookAround)} ≥ 30`);
const faceMain = main(shell, CLOCK.cx - 4, CLOCK.cy - 4, 8, 8);
const clockAround = main(shell, CLOCK.cx - CLOCK.r - 4, CLOCK.cy - 2, 2, 4);
check(Y[faceMain] - Y[clockAround] >= 20, `시계 판 ${name(faceMain)}이 벽 ${name(clockAround)}보다 ${Y[faceMain] - Y[clockAround]} 밝음 ≥ 20`);
// 참고(검사 아님): 쿵 글자(teal, 묵직이 약속) 자리 뒤 배경. 설계 13절 Q5(머리 위 vs 발치) 판단 재료
const HEAD = { '셔터 앞 머리 위(171, 176)': [166, 172, 10, 8], '건조기 앞 머리 위(409, 176)': [404, 172, 10, 8], '자판기 앞 머리 위(417, 176)': [412, 172, 10, 8] };
for (const [n, [x, y, w, h]] of Object.entries(HEAD)) { const m = main(scene, x, y, w, h); console.log(`참고 쿵 글자 teal vs ${n} ${name(m)} 차 ${dY(C.teal, m)}`); }
console.log(`참고 쿵 글자 teal vs 바닥(발치) ${name(floorMain)} 차 ${dY(C.teal, floorMain)}`);
// 켜진 불: 형광등이 꺼진 오른쪽(x ≥ 340, 건조기·자판기 구석)의 노랑(yel) 2×2 덩어리. 사람 올리기 전 그림에서,
// 건조기 상자 안(표시등)과 자판기 세제 상자 줄은 뺀다. 왼쪽 선반의 큰 세제 상자(room.mjs)는 불이 아니라 범위 밖이다
const DARK_X0 = 340;
{
  const [dx, dy, dw, dh] = SCREEN.hotspots.dryer_3.box;
  const [vx, vy] = SCREEN.hotspots.soap_vending.box;
  const inBox = (x, y, [bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh;
  const soapBoxes = VEND_BOX.rows.flatMap((ry) => VEND_BOX.cols.map((cx) => [vx + cx, vy + ry, VEND_BOX.w, VEND_BOX.h]));
  const lit = [];
  for (let y = 0; y < H - 1; y++) for (let x = DARK_X0; x < W - 1; x++) {
    if (![[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => props.get(x + a, y + b) === C.yel)) continue;
    if (inBox(x, y, [dx, dy, dw, dh]) || soapBoxes.some((b) => inBox(x, y, b))) continue;
    lit.push(`${x},${y}`);
  }
  check(lit.length === 0, `오른쪽 구석 켜진 불은 건조기 표시등 하나(그 밖 yel 2×2 ${lit.length}곳${lit.length ? `: ${lit.slice(0, 4).join(' ')}` : ''})`);
  const shadowRow = (x0, w) => { let n = 0; for (let x = x0 + 1; x < x0 + w + 1; x++) if (props.get(x, FLOOR_Y) === C.lav) n++; return n; };
  check(shadowRow(dx, dw) >= dw * 0.7, `건조기 바닥 그림자 y ${FLOOR_Y} lav ${shadowRow(dx, dw)}/${dw}칸 (배경에 구울 줄)`);
  check(shadowRow(vx, SCREEN.hotspots.soap_vending.box[2]) >= SCREEN.hotspots.soap_vending.box[2] * 0.7, `자판기 바닥 그림자 y ${FLOOR_Y} lav ${shadowRow(vx, SCREEN.hotspots.soap_vending.box[2])}/${SCREEN.hotspots.soap_vending.box[2]}칸 (배경에 구울 줄)`);
}
console.log(`방 껍데기 쓴 색 ${used.size}개, 장면 ${count(scene, 0, 0, W, H).size}개`);

// ── 4배: 작은 것 셋(걸쇠 자리·열쇠 걸이·시계) 둘레
const crop = (img, x0, y0, w, h) => { const c = new Image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.set(x, y, img.get(x0 + x, y0 + y)); return c; };
const zoom = new Image(140, 64);
zoom.blit(crop(scene, TRANSOM.x - 6, TRANSOM.y - 4, 70, 64), 0, 0); // 들창: 덕트 끝·판자·후드·둥지·까치
zoom.blit(crop(scene, 72, 206, 70, 44), 70, 10); // 셔터 찌그러진 틈·열쇠·바닥 빛 띠

// ── 출력
const gray = (img, S, file) => {
  const w = img.w * S, h = img.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[img.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, file), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
};
writeFileSync(join(HERE, 'laundromat-bg-sketch-2x.png'), indexedPng(scene, 2));
writeFileSync(join(HERE, 'laundromat-bg-sketch-4x.png'), indexedPng(zoom, 4));
writeFileSync(join(HERE, 'laundromat-bg-sketch-1x.png'), indexedPng(scene, 1));
gray(scene, 2, 'laundromat-bg-sketch-gray-2x.png');
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
