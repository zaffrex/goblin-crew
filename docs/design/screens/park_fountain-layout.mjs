// 엔딩 화면 `park_fountain` 회색 배치 검사 + 스케치 (#380). 외부 이미지 없이 코드로만 그린다.
// 실행: node docs/design/screens/park_fountain-layout.mjs
// 입력: 서는 자리·핫스팟 좌표는 화면 JSON content/screens/park_fountain.json(좌표의 진실),
//       도달 기대값(reachExpect)·물 효과 자리(effects)는 같은 폴더 park_fountain-layout.json. 이 파일은 숫자를 따로 갖지 않는다.
// 출력: park_fountain-layout-2x.png (960×540, 보송 팔레트 인덱스 PNG)
// 검사: 하나라도 어기면 종료 코드 1. 엔진 숫자는 아래 ENGINE에 출처와 같이 적었다(바뀌면 같이 고친다).
// 빌드에 들어가지 않는 설계 자료다. layout.json은 그림 빌드 연결 PR(#468)에서 effects를 art/scenes로 옮기며 지운다.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = JSON.parse(readFileSync(join(HERE, '../../../content/screens/park_fountain.json'), 'utf8'));
const L = { ...JSON.parse(readFileSync(join(HERE, 'park_fountain-layout.json'), 'utf8')), spots: SCREEN.spots, hotspots: SCREEN.hotspots };
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

// ───────────── 엔진 숫자 (출처) ─────────────
const ENGINE = {
  WALK_AREA: { left: 16, top: 200, right: 463, bottom: 252 }, // src/core/config.ts
  MIN_HIT: 24, // ADR-0007 결정 6
  APPROACH_GAP: 2, // src/core/scene.ts approachPoint
  // src/core/characters.ts 몸 히트 상자. CHARACTERS 순서 = 시작 배치 순서(floor.x + (i − 1) × 40, createScene)
  CHARS: [
    { id: 'jjuk', hit: { dx: -13, width: 28 } },
    { id: 'mukjik', hit: { dx: -22, width: 39 } },
    { id: 'ppik', hit: { dx: -14, width: 33 } },
  ],
  CELL_TOP: 64, // jjuk 칸 48×64, 기준점 (25, 64): 칸 위 끝 = 발 − 64. 장대 tip은 0행(public/sprites/jjuk-base.json)
  CELL_W: 48,
  ANCHOR_X: 25,
  CLAW_MAX: 64, // art/sprites/jjuk-v4.mjs CLAW.max: 칸 위로 늘어나는 최대 px
  CLAW_W: 8, // 집게 칸 8×8, 기준점 (4, 8): 집게 x = tip 화면 x − 4 .. + 4
  CLAW_H: 8,
  SHORT: [0, 10], // 닿음/못 닿음을 가르는 anim short 범위(reach_wobble 10, reach_hang_up 0)
  WOBBLE_TIP_X: 40, // reach_wobble tip x(38~42). 못 닿을 때 집게가 어디 가는지 스케치용
};
// 집기(P6) 새 칸 조건(PR #424 Theo 리뷰): tip 0행, short 0, |tip x − 25| ≤ 5.
// 장대는 tip x에서 수직으로 올라가고(대상 점 x는 안 쓴다), 바라보는 방향으로 tip x − 25만큼 옆에 선다.
const GRAB = { short: 0, tipDx: 5 };
const MIN_CLAW_OVERLAP = 4; // 닿음이면 집게 칸이 재킷 그림과 가로·세로 둘 다 이만큼 이상 겹친다(4×4 이상)
const MIN_GAP_MISS = 16; // 못 닿을 때 집게 끝과 재킷 그림 사이 최소 틈(1-3 "아슬아슬하면 조금만 더로 읽힌다", F2)

// 그림 상자(히트 상자와 다른 것만). JSON note와 같다.
const ART = {
  fountain: [128, 180, 192, 18],
  jacket_top: [214, 32, 20, 14],
  jacket_hand: [252, 106, 18, 18], // 내민 손에 걸쳐 늘어진 재킷. 소매 끝이 히트 아래 끝(대상 점 y 124)까지 처진다
  keeper: [40, 118, 36, 30],
  alarm_clock: [84, 140, 12, 12],
  duck: [180, 158, 14, 12],
  guest: [440, 176, 20, 56],
};

// ───────────── 검사 ─────────────
const problems = [];
const ok = (cond, msg) => {
  if (!cond) problems.push(msg);
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
};
const box = (b) => ({ x: b[0], y: b[1], w: b[2], h: b[3] });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const WA = ENGINE.WALK_AREA;

// 1. 히트 상자 크기·화면 안·서로 안 겹침
const boxes = [];
const afterClear = new Set(); // exitFlag가 참일 때만 쓰는 위치: 클리어 컷 중이라 입력이 없고, 끝나면 클리어 카드가 덮는다
for (const [id, h] of Object.entries(L.hotspots)) {
  boxes.push([id, box(h.box)]);
  for (const v of h.variants ?? []) {
    const name = `${id}(${Object.keys(v.when.flags).join(',')})`;
    boxes.push([name, box(v.box)]);
    if (v.when.flags[SCREEN.exitFlag] === true) afterClear.add(name);
  }
}
for (const [id, b] of boxes) {
  ok(b.w >= ENGINE.MIN_HIT && b.h >= ENGINE.MIN_HIT, `${id} 히트 ${b.w}×${b.h} ≥ ${ENGINE.MIN_HIT}×${ENGINE.MIN_HIT}`);
  ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${id} 화면 안`);
}
for (let i = 0; i < boxes.length; i++)
  for (let j = i + 1; j < boxes.length; j++) {
    const [a, ba] = boxes[i];
    const [b, bb] = boxes[j];
    if (a.split('(')[0] === b.split('(')[0]) continue; // 같은 핫스팟의 두 위치
    if ((afterClear.has(a) || afterClear.has(b)) && overlap(ba, bb)) {
      console.log(`skip ${a} ↔ ${b} 겹침: 클리어 뒤(${SCREEN.exitFlag})에만 있는 위치라 누를 수 없다`);
      continue;
    }
    ok(!overlap(ba, bb), `${a} ↔ ${b} 히트 상자 안 겹침`);
  }
// 그림 상자는 히트 상자 안
const artIn = { fountain: 'fountain', jacket_top: 'jacket', keeper: 'keeper', alarm_clock: 'alarm_clock', duck: 'duck', guest: 'guest' };
for (const [a, h] of Object.entries(artIn)) {
  const g = box(ART[a]);
  const t = box(L.hotspots[h].box);
  ok(g.x >= t.x && g.y >= t.y && g.x + g.w <= t.x + t.w && g.y + g.h <= t.y + t.h, `${a} 그림이 히트 상자 안`);
}
{
  const g = box(ART.jacket_hand);
  const t = box(L.hotspots.jacket.variants[0].box);
  ok(g.x >= t.x && g.y >= t.y && g.x + g.w <= t.x + t.w && g.y + g.h <= t.y + t.h, 'jacket_hand 그림이 손 위치 히트 상자 안');
}

// 2. 바닥 대상 / 높은 대상 (approachPoint)
const isFloorTarget = (b) => b.y + b.h > WA.top;
ok(isFloorTarget(box(L.hotspots.fountain.box)), 'fountain = 바닥 대상(모서리 옆에 선다, 1-3)');
ok(!isFloorTarget(box(L.hotspots.jacket.box)), 'jacket(꼭대기) = 높은 대상(가운데 x 아래에 선다)');
ok(!isFloorTarget(box(L.hotspots.jacket.variants[0].box)), 'jacket(손) = 높은 대상');

// 3. 시작 배치: floor ± 40, 걷기 영역 안, 분수대·손님 히트와 몸이 안 겹침
const floor = L.spots.floor;
const start = Object.fromEntries(ENGINE.CHARS.map((c, i) => [c.id, { x: floor.x + (i - 1) * 40, y: floor.y }]));
for (const c of ENGINE.CHARS) {
  const p = start[c.id];
  ok(p.x >= WA.left && p.x <= WA.right && p.y >= WA.top && p.y <= WA.bottom, `${c.id} 시작 ${p.x},${p.y} 걷기 영역 안`);
  // 왼쪽(분수대)을 본다 → 몸 왼쪽 = x − (dx + width), 오른쪽 = x − dx
  const body = { x: p.x - (c.hit.dx + c.hit.width), y: p.y - 64, w: c.hit.width, h: 64 };
  for (const t of ['fountain', 'guest']) ok(!overlap(body, box(L.hotspots[t].box)), `${c.id} 시작 몸 ↔ ${t} 히트 안 겹침`);
}

// 4. ズッシー × 분수대: 오른쪽에서 오면 모서리 옆
const fb = box(L.hotspots.fountain.box);
const mk = ENGINE.CHARS[1].hit;
const stompX = fb.x + fb.w + ENGINE.APPROACH_GAP + mk.dx + mk.width;
const stompBodyLeft = stompX - (mk.dx + mk.width);
ok(stompBodyLeft - (fb.x + fb.w) === ENGINE.APPROACH_GAP, `ズッシー × fountain 설 곳 x ${stompX} (몸 왼쪽 ${stompBodyLeft}, 모서리 ${fb.x + fb.w})`);
const jb = box(L.hotspots.jacket.box);
const jhb = box(L.hotspots.jacket.variants[0].box);
const jacketMid = jb.x + jb.w / 2;
ok(jacketMid > fb.x + 32 && jacketMid < fb.x + fb.w - 32, `재킷(꼭대기) 아래 흙길 x ${jacketMid}가 테두리 가운데 쪽(모서리에서 32px 넘게, "돌 / 흙" 대비)`);
ok(Math.abs(jacketMid - stompX) >= 64, `쿵 자리 둘이 ${Math.abs(jacketMid - stompX)}px 떨어짐 ≥ 64 (단서 ②가 그림으로 갈린다)`);

// 5. 장대 도달: 발 y가 걷기 영역 어디든(approachPoint는 x만 바꾼다) 결과가 같아야 한다
const reachY = (b) => b.y + b.h; // reachPoint 없음 → 상자 아래 끝
const clawTop = (foot, target, short) => {
  // spritePole: full = (칸 위 끝 − 대상 y − short), max로 자름. 집게(8)는 그 끝 위에 붙는다
  const cellTop = foot - ENGINE.CELL_TOP;
  const full = Math.min(cellTop - target - short, ENGINE.CLAW_MAX);
  return { reaches: cellTop - target - short <= ENGINE.CLAW_MAX, top: cellTop - Math.max(full, 0) - ENGINE.CLAW_H };
};
for (const e of L.reachExpect) {
  const b = e.flags['jacket.on_hand'] ? jhb : jb;
  const art = box(e.flags['jacket.on_hand'] ? ART.jacket_hand : ART.jacket_top);
  const ty = reachY(b);
  for (const foot of [e.footY[0], e.footY[1]])
    for (const short of ENGINE.SHORT) {
      const r = clawTop(foot, ty, short);
      const tag = `발 y ${foot}, short ${short}: 재킷(${e.flags['jacket.on_hand'] ? '손' : '꼭대기'}) 대상 y ${ty}`;
      if (e.reach) ok(r.reaches, `${tag} → 닿음`);
      else {
        const gap = r.top - (art.y + art.h);
        ok(!r.reaches && gap >= MIN_GAP_MISS, `${tag} → 못 닿음, 집게 끝 ${r.top}과 재킷 그림 사이 ${gap}px ≥ ${MIN_GAP_MISS}`);
      }
    }
}
// 집기 칸: 양쪽 방향 × tip x 25±5 × 발 y 두 끝에서 집게 칸이 재킷(손) 그림과 겹쳐야 "집었다"로 읽힌다
// (spritePole: 오른쪽이면 tip 화면 x = 발 x − 25 + tip x, 왼쪽이면 발 x − (48 − 25) + (48 − tip x))
const tipScreenX = (footX, tx, facing) =>
  facing === 1 ? footX - ENGINE.ANCHOR_X + tx : footX - (ENGINE.CELL_W - ENGINE.ANCHOR_X) + (ENGINE.CELL_W - tx);
const span = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
{
  const art = box(ART.jacket_hand);
  const footX = jhb.x + jhb.w / 2; // 높은 대상 → 상자 가운데 x 아래에 선다
  const ty = reachY(jhb);
  for (const foot of [WA.top, WA.bottom])
    for (const tx of [ENGINE.ANCHOR_X - GRAB.tipDx, ENGINE.ANCHOR_X, ENGINE.ANCHOR_X + GRAB.tipDx])
      for (const facing of [1, -1]) {
        const r = clawTop(foot, ty, GRAB.short);
        const cx = tipScreenX(footX, tx, facing) - ENGINE.CLAW_W / 2;
        const ox = span(cx, cx + ENGINE.CLAW_W, art.x, art.x + art.w);
        const oy = span(r.top, r.top + ENGINE.CLAW_H, art.y, art.y + art.h);
        ok(
          r.reaches && ox >= MIN_CLAW_OVERLAP && oy >= MIN_CLAW_OVERLAP,
          `집기 칸 발 y ${foot}, tip x ${tx}, ${facing === 1 ? '오른쪽' : '왼쪽'}: 집게 ${cx}..${cx + ENGINE.CLAW_W} × ${r.top}..${r.top + ENGINE.CLAW_H}, 재킷 그림과 ${ox}×${oy} 겹침 ≥ ${MIN_CLAW_OVERLAP}×${MIN_CLAW_OVERLAP}`,
        );
      }
}
// 손 위 재킷은 어느 발 y에서도 칸 위에 있어야 장대가 보인다(대상 점이 칸 안이면 잇지 않는다)
ok(reachY(jhb) < WA.top - ENGINE.CELL_TOP, `손 위 재킷 대상 y ${reachY(jhb)} < 맨 뒤 줄 칸 위 끝 ${WA.top - ENGINE.CELL_TOP} (장대가 보인다)`);

// 6. 물줄기 효과 자리
const water = L.effects.water;
const wa = box(water.area);
ok(wa.x >= 0 && wa.y >= 0 && wa.x + wa.w <= W && wa.y + wa.h <= H, '물줄기 area 화면 안');
ok(wa.y + wa.h <= fb.y, `물줄기 area 아래 끝 ${wa.y + wa.h} ≤ 테두리 위 끝 ${fb.y} (테두리 앞면이 물 앞)`);
for (const [n, b] of [['꼭대기', jb], ['손', jhb]])
  ok(b.x >= wa.x && b.x + b.w <= wa.x + wa.w && wa.y <= b.y, `재킷(${n})이 물줄기 area 안 (뿜는 동안 장대가 물에 닿는다, 5번)`);
ok(new Set(water.colors).size === 4 && water.colors.every((c) => c > 0 && c < 31), `물 4색 ${water.colors.join(',')} 서로 다르고 0·31 아님`);

// ───────────── 그리기 ─────────────
const px = new Uint8Array(W * H).fill(C.cotton);
const set = (x, y, c) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c;
};
const rect = (x, y, w, h, c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
};
const R = (b, c) => rect(b[0], b[1], b[2], b[3], c);
const outline = (b, c) => {
  for (let i = 0; i < b.w; i += 2) {
    set(b.x + i, b.y, c);
    set(b.x + i, b.y + b.h - 1, c);
  }
  for (let j = 0; j < b.h; j += 2) {
    set(b.x, b.y + j, c);
    set(b.x + b.w - 1, b.y + j, c);
  }
};
const cross = (x, y, c) => {
  for (let i = -3; i <= 3; i++) {
    set(x + i, y, c);
    set(x, y + i, c);
  }
};

// 배경: 하늘, 나무 덩어리, 흙길(걷기 영역), 아래 띠
for (let x = 104; x < W; x += 56) rect(x, 96, 40, 84, C.grnL);
rect(0, 180, W, WA.top - 180, C.grnL); // 잔디 띠
rect(0, WA.top, W, H - WA.top, C.tan); // 흙길
rect(0, 258, W, H - 258, C.lav);
// 관리실(벽·지붕·창) + 벽시계
rect(16, 92, 104, 108, C.woodL);
rect(10, 84, 116, 10, C.redD);
rect(34, 112, 48, 40, C.dusk);
R(ART.keeper, C.lint);
rect(30, 152, 76, 4, C.wood); // 창턱
R(ART.alarm_clock, C.red);
rect(92, 100, 12, 12, C.white); // 벽시계(배경)
// 분수: 수반 물, 동상(받침·몸·돌우산·내민 손), 재킷 두 위치, 오리
rect(128, 170, 192, 10, C.tealM); // 수반 물 윗면
rect(212, 120, 24, 50, C.lint); // 동상 몸
rect(206, 160, 36, 12, C.lint); // 받침
rect(218, 104, 12, 14, C.lint); // 머리
rect(222, 46, 3, 60, C.dusk); // 우산대
rect(194, 46, 60, 6, C.lint); // 돌우산 갓
rect(204, 42, 40, 4, C.lint);
rect(236, 120, 20, 6, C.lint); // 내민 오른팔
R(ART.jacket_top, C.ink);
rect(252, 118, 10, 8, C.lint); // 손(재킷 뒤)
for (let j = 0; j < ART.jacket_hand[3]; j++)
  for (let i = 0; i < ART.jacket_hand[2]; i++) if ((i + j) % 2 === 0) set(ART.jacket_hand[0] + i, ART.jacket_hand[1] + j, C.ink); // 손 위치 유령
R(ART.duck, C.yel);
// 물줄기 area(그림 아님): 물 중간 색 점 기둥
for (let y = wa.y; y < wa.y + wa.h; y += 3) {
  for (const x of [wa.x + 8, wa.x + 24, wa.x + wa.w - 25, wa.x + wa.w - 9]) set(x, y, water.colors[1]);
  if (y % 9 === 0) for (const x of [wa.x + 16, wa.x + wa.w - 17]) set(x, y, water.colors[0]);
}
// 테두리 앞면(물 앞)
R(ART.fountain, C.dusk);
rect(ART.fountain[0], ART.fountain[1], ART.fountain[2], 2, C.lav);
// 손님
R(ART.guest, C.purD);
// 캐릭터 시작 실루엣 + 쿵 자리 둘 + 쭉이 뻗기 표시
const sil = (x, y, w, h, c) => rect(x - Math.floor(w / 2), y - h, w, h, c);
sil(start.jjuk.x, start.jjuk.y, 20, 64, C.redD);
sil(start.mukjik.x, start.mukjik.y, 30, 60, C.tealD);
sil(start.ppik.x, start.ppik.y, 18, 47, C.yelD);
for (const x of [stompX, jacketMid]) cross(x, WA.top, C.purD);
// 장대: 맨 뒤 줄(발 200)에서 꼭대기로(못 닿음, 빨강) / 맨 앞 줄(발 252)에서 손으로(닿음, 초록)
{
  // 못 닿음: reach_wobble tip x 40, 양쪽 방향(집게 칸은 빨간 테두리)
  const r = clawTop(WA.top, reachY(jb), 10);
  for (const facing of [1, -1]) {
    const sx = tipScreenX(jacketMid, ENGINE.WOBBLE_TIP_X, facing);
    for (let y = WA.top - ENGINE.CELL_TOP; y >= r.top + ENGINE.CLAW_H; y -= 2) set(sx, y, C.red);
    outline(box([sx - ENGINE.CLAW_W / 2, r.top, ENGINE.CLAW_W, ENGINE.CLAW_H]), C.red);
  }
  // 닿음: 집기 칸 tip x 25, short 0(집게 칸은 초록 칸)
  const g = clawTop(WA.bottom, reachY(jhb), GRAB.short);
  const gx = tipScreenX(jhb.x + jhb.w / 2, ENGINE.ANCHOR_X, 1);
  for (let y = WA.bottom - ENGINE.CELL_TOP; y >= g.top + ENGINE.CLAW_H; y--) set(gx, y, C.grn);
  rect(gx - ENGINE.CLAW_W / 2, g.top, ENGINE.CLAW_W, ENGINE.CLAW_H, C.grn);
}
// 히트 상자(점선), 서는 자리(+), 물 area(테두리 점선)
for (const [, b] of boxes) outline(b, C.hint);
outline(wa, C.teal);
cross(floor.x, floor.y, C.plum);
// 걷기 영역 위 끝 선
for (let x = WA.left; x <= WA.right; x += 4) set(x, WA.top, C.wood);

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
  join(HERE, 'park_fountain-layout-2x.png'),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(PALETTE.flat())),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log('wrote park_fountain-layout-2x.png');
if (problems.length) {
  console.error(`\n${problems.length}개 검사 실패`);
  process.exit(1);
}
