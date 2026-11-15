// 화면 1 `magpie_nest` 배치도 + 기하 검사 (#66). 외부 이미지 없이 코드로만 그린다.
// 실행: node docs/design/screens/magpie_nest-layout.mjs
// 출력: 같은 폴더에 magpie_nest-layout-2x.png (960×540, 보송 팔레트 인덱스 PNG)
// 검사: 히트 영역 최소 크기, 서는 자리-핫스팟 간격, 장대 도달 거리 같은 설계 숫자를 확인하고
//       하나라도 어기면 종료 코드 1로 끝난다. 이 파일은 빌드에 들어가지 않는 설계 자료다.
// 좌표의 진실은 magpie_nest.md 표다. 둘이 다르면 둘 다 고친다. JSON은 #65 머지 뒤 만든다.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PALETTE = readFileSync(join(HERE, '../art/bosong-32.hex'), 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);

const C = {
  ink: 0, plum: 1, dusk: 2, lav: 3, lint: 4, cotton: 5, white: 6,
  redD: 7, red: 8, redL: 9, woodD: 10, wood: 11, woodL: 12, tan: 13,
  yelD: 14, yel: 15, yelL: 16, pink: 17, pinkL: 18,
  grnD: 19, grn: 20, grnL: 21, grnP: 22, tealD: 23, teal: 24, tealM: 25, tealL: 26, aqua: 27,
  purD: 28, pur: 29, purL: 30, hint: 31,
};

const W = 480;
const H = 270;

// ───────────── 설계 숫자 (magpie_nest.md "배치" 절과 같다) ─────────────
const FLOOR_Y = 236; // 바닥 소품·서는 자리의 발 기준선
const MAX_REACH = 80; // 장대 최대 길이(제안값). 이 화면이 성립하는 범위는 아래 검사가 출력한다(56 ≤ maxReach < 112)
const GRIP_STAND = 32; // 서서 뻗을 때 장대 잡은 손 높이(발에서 위로, ADR-0007 결정 11 실측)
const MIN_HIT = 24; // ADR-0007 결정 6
const COOP_GAP = 32; // ADR-0007 결정 6: 협동 위치와 다른 핫스팟 사이 간격

/** 핫스팟 히트 영역 (x, y, w, h). 그림 크기는 아래 draw에서 따로 그린다. */
const HOTSPOTS = {
  magpie: { x: 134, y: 6, w: 24, h: 24 }, // 둥지 위 (magpie.on_ground = false)
  magpie_ground: { x: 88, y: 212, w: 24, h: 24 }, // 바닥 (magpie.on_ground = true). 같은 핫스팟 `magpie`의 다른 위치
  nest: { x: 128, y: 30, w: 36, h: 24 },
  hook: { x: 150, y: 84, w: 24, h: 24 },
  basket: { x: 144, y: 212, w: 32, h: 24 },
  seesaw_left: { x: 208, y: 196, w: 38, h: 24 },
  seesaw_right: { x: 250, y: 196, w: 38, h: 24 },
  long_johns: { x: 372, y: 112, w: 32, h: 40 },
};

/** 서는 자리 (발 기준점). hook은 매달린 자세의 발 위치, grip은 고리를 잡은 손. */
const SPOTS = {
  seesaw_left: { x: 220, y: 214, own: ['seesaw_left'] },
  seesaw_right: { x: 284, y: 214, own: ['seesaw_right'] },
  hook: { x: 160, y: 160, grip: { x: 158, y: 100 }, own: ['hook'] },
};

const START = { jjuk: { x: 360, y: 244 }, mukjik: { x: 400, y: 244 }, ppik: { x: 440, y: 244 } };

/** 장대 도달 지점(위로 곧게 뻗는다, ADR-0003: 직선만). 쭉이는 그 x 아래로 걸어가 뻗는다. */
const REACH = {
  nest: { x: 156, y: 44 }, // 둥지 아래 오른쪽 가장자리
  hook: { x: 160, y: 100 }, // 고리 아래쪽
  long_johns: { x: 388, y: 152 }, // 내복 밑단
};
const STAND_FRONT_Y = 244; // 바구니 앞(바닥 앞쪽 줄)에 설 때 발 높이

// ───────────── 검사 ─────────────
const problems = [];
const ok = (cond, msg) => {
  if (!cond) problems.push(msg);
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
};

for (const [id, b] of Object.entries(HOTSPOTS)) {
  ok(b.w >= MIN_HIT && b.h >= MIN_HIT, `${id} 히트 영역 ${b.w}×${b.h} ≥ ${MIN_HIT}×${MIN_HIT}`);
  ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${id} 화면 안`);
}

const distToBox = (p, b) => {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w));
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h));
  return Math.hypot(dx, dy);
};
for (const [sid, s] of Object.entries(SPOTS)) {
  for (const [hid, b] of Object.entries(HOTSPOTS)) {
    if (s.own.includes(hid)) continue;
    if (sid.startsWith('seesaw') && hid.startsWith('seesaw')) continue; // 시소 두 끝은 한 물건
    const d = Math.round(distToBox(s, b));
    if (d < COOP_GAP) ok(false, `서는 자리 ${sid} ↔ ${hid} 간격 ${d}px ≥ ${COOP_GAP}`);
  }
}
ok(true, `서는 자리-핫스팟 간격 검사 (${COOP_GAP}px)`);
ok(SPOTS.seesaw_right.x - SPOTS.seesaw_left.x >= 64, 'ADR-0007 결정 11: 시소 양 끝 서는 자리 64px 이상');

const standGripY = STAND_FRONT_Y - GRIP_STAND;
const fromGround = (t) => standGripY - REACH[t].y;
const fromHook = (t) => SPOTS.hook.grip.y - REACH[t].y;
ok(fromGround('nest') > MAX_REACH, `땅에서 둥지까지 ${fromGround('nest')}px > maxReach ${MAX_REACH} (부들부들 실패)`);
ok(fromGround('hook') > MAX_REACH, `땅에서 고리까지 ${fromGround('hook')}px > maxReach ${MAX_REACH} (한 뼘 모자람)`);
ok(fromHook('nest') <= MAX_REACH, `고리에서 둥지까지 ${fromHook('nest')}px ≤ maxReach ${MAX_REACH} (정답)`);
ok(fromGround('long_johns') <= MAX_REACH, `땅에서 내복까지 ${fromGround('long_johns')}px ≤ maxReach ${MAX_REACH} (장난감)`);
ok(Math.abs(REACH.nest.x - SPOTS.hook.grip.x) <= 8, '고리에 매달린 손과 둥지 도달점이 거의 같은 세로줄(직선 뻗기)');
const hookGap = Math.min(fromGround('hook'), fromGround('nest')) - fromHook('nest');
const lo = fromHook('nest');
const hi = Math.min(fromGround('hook'), fromGround('nest'));
ok(lo < hi, `이 화면이 성립하는 maxReach 범위: ${lo} ≤ maxReach < ${hi} (여유 ${hookGap}px)`);

// ───────────── 그리기 ─────────────
const px = new Uint8Array(W * H).fill(C.white);
const set = (x, y, c) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c;
};
const rect = (x, y, w, h, c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
};
const outline = (b, c) => {
  for (let i = 0; i < b.w; i++) {
    if (i % 2 === 0) {
      set(b.x + i, b.y, c);
      set(b.x + i, b.y + b.h - 1, c);
    }
  }
  for (let j = 0; j < b.h; j++) {
    if (j % 2 === 0) {
      set(b.x, b.y + j, c);
      set(b.x + b.w - 1, b.y + j, c);
    }
  }
};
const cross = (x, y, c) => {
  for (let i = -3; i <= 3; i++) {
    set(x + i, y, c);
    set(x, y + i, c);
  }
};

// 하늘·담장·바닥 (만질 수 없는 배경)
rect(0, 0, W, 150, C.cotton);
for (let x = 0; x < W; x += 24) rect(x, 150, 22, 50, C.woodL);
rect(0, 196, W, H - 196, C.lint);
rect(0, 258, W, H - 258, C.lav);

// 빨랫대 기둥 + 둥지 + 열쇠 반짝임 + 까치(둥지)
rect(140, 40, 12, FLOOR_Y - 40, C.wood);
rect(150, 40, 2, FLOOR_Y - 40, C.woodD);
rect(128, 30, 36, 14, C.woodD);
rect(130, 32, 32, 4, C.wood);
rect(150, 33, 4, 3, C.yelL);
rect(139, 18, 14, 12, C.ink);
rect(149, 21, 6, 2, C.white);
// 고리
rect(152, 92, 10, 3, C.dusk);
rect(159, 92, 3, 8, C.dusk);
// 빨래 바구니
rect(144, 220, 32, 16, C.tan);
rect(144, 220, 32, 2, C.woodL);
// 시소 (널빤지 80×6 + 세제 통 받침 12×14)
rect(208, 214, 80, 6, C.wood);
rect(242, 220, 12, 16, C.teal);
// 빨랫줄 기둥 2개 + 줄 + 내복(장난감) + 수건(장식)
rect(332, 108, 4, FLOOR_Y - 108, C.dusk);
rect(464, 108, 4, FLOOR_Y - 108, C.dusk);
rect(336, 110, 128, 1, C.plum);
rect(372, 112, 32, 40, C.redL);
for (let y = 116; y < 152; y += 6) rect(372, y, 32, 2, C.red);
rect(420, 112, 20, 24, C.tealL);
// 까치(바닥) 유령: 내려온 뒤 위치
for (let j = 0; j < 12; j++) for (let i = 0; i < 14; i++) if ((i + j) % 2 === 0) set(93 + i, 224 + j, C.ink);

// 캐릭터: 시작 위치(실루엣 기둥) + 고리에 매달린 쭉이 유령
const silhouette = (x, y, w, h, c) => rect(x - Math.floor(w / 2), y - h, w, h, c);
silhouette(START.jjuk.x, START.jjuk.y, 20, 64, C.redD);
silhouette(START.mukjik.x, START.mukjik.y, 30, 60, C.tealD);
silhouette(START.ppik.x, START.ppik.y, 18, 47, C.yelD);
for (let j = 0; j < 64; j++)
  for (let i = 0; i < 20; i++) if ((i + j) % 2 === 0) set(SPOTS.hook.x - 10 + i, SPOTS.hook.y - 64 + j, C.redD);

// 장대 도달 표시: 고리 → 둥지(정답, 초록), 땅 → 둥지(모자람, 빨강)
for (let y = REACH.nest.y; y <= SPOTS.hook.grip.y; y++) set(SPOTS.hook.grip.x + 2, y, C.grn);
for (let y = standGripY; y >= standGripY - MAX_REACH; y -= 2) set(REACH.nest.x + 14, y, C.red);

// 히트 영역(점선, hint 색)과 서는 자리(+)
for (const b of Object.values(HOTSPOTS)) outline(b, C.hint);
for (const s of Object.values(SPOTS)) cross(s.x, s.y, C.purD);
for (const p of Object.values(START)) cross(p.x, p.y, C.plum);

// ───────────── PNG ─────────────
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const S = 2;
const raw = Buffer.alloc((W * S + 1) * H * S);
for (let y = 0; y < H * S; y++) {
  raw[y * (W * S + 1)] = 0;
  for (let x = 0; x < W * S; x++) raw[y * (W * S + 1) + 1 + x] = px[Math.floor(y / S) * W + Math.floor(x / S)];
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W * S, 0);
ihdr.writeUInt32BE(H * S, 4);
ihdr[8] = 8;
ihdr[9] = 3;
writeFileSync(
  join(HERE, 'magpie_nest-layout-2x.png'),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(PALETTE.flat())),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log('wrote magpie_nest-layout-2x.png');
if (problems.length) {
  console.error(`\n${problems.length}개 검사 실패`);
  process.exit(1);
}
