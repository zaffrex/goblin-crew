// 3차 캐릭터 샘플 (#3, ADR-0003 3차). 외부 이미지 없이 코드로만 그린다.
// 실행: node docs/design/art/crew-v3.mjs
// 출력(같은 폴더):
//   crew-v3a-4x.png      ① 32×48 칸 안에서 캐리커처 비율 + 명암 (위: 색 / 가운데: 명도 / 아래: 실루엣)
//   crew-v3b-4x.png      ② 칸을 48×64로 키운 버전 (같은 4배)
//   crew-v3-screen-2x.png  480×270 화면 전체에 놓았을 때 크기 비교 (왼쪽 ①, 오른쪽 ②)
// 4배 = 480×270 화면을 1080p 전체 화면에 띄웠을 때의 실제 크기다.
//
// 그리는 방식: 몸을 공(ball)과 캡슐(capsule) 부품으로 조립하고, 부품마다 왼쪽 위 빛으로 2~4단 명암을 넣는다.
// 그다음 얼굴·손·주름 같은 세부 픽셀을 손으로 찍는다. 부품 좌표는 ① 기준이고 ②는 같은 좌표를 4/3배 해서 그린 뒤
// ②에서만 세부를 더한다. 그래서 포즈(관절 좌표)를 바꾸면 명암은 자동으로 따라온다.
// 참고한 것은 그 시절 장르의 화풍 관습(큰 머리·코·손발, 긴 팔다리, 명암 단계)뿐이다. 특정 작품 화면은 열지 않았다.
// 팔레트는 ADR-0007 초안(PR #42)의 보송 32색과 같은 값이다.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HEX = [
  '1b1720', '3a3142', '5e5068', '8a7d8f', 'b9adb5', 'e6dcd6', 'fff8ee',
  '7a2c3a', 'c2404a', 'f0766b',
  '5a3a2e', '8e5c3b', 'c48a52', 'e8bd7e',
  'b8953a', 'f2d65c', 'fff1a8',
  'e88fb0', 'ffc6d6',
  '2f4a3a', '4f7a52', '86b06a', 'c4dd8f',
  '23394d', '36607a', '5a93a8', '9cc9cf', 'd8f0ee',
  '4b3a72', '7c64b0', 'b9a3e3',
  'ff9f43',
];
const PALETTE = HEX.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const C = {
  ink: 0, plum: 1, dusk: 2, lav: 3, lint: 4, cotton: 5, white: 6,
  redD: 7, red: 8, redL: 9,
  woodD: 10, wood: 11, woodL: 12, tan: 13,
  yelD: 14, yel: 15, yelL: 16,
  pink: 17, pinkL: 18,
  grnD: 19, grn: 20, grnL: 21, grnP: 22,
  tealD: 23, teal: 24, tealM: 25, tealL: 26, aqua: 27,
  purD: 28, pur: 29, purL: 30,
  hint: 31,
};
const EMPTY = -1;

// 명암 단계: 어두운 쪽 → 밝은 쪽
const R = {
  skin: [C.wood, C.woodL, C.tan],
  hair: [C.ink, C.woodD, C.wood],
  hairBlk: [C.ink, C.plum, C.dusk],
  shirtRed: [C.redD, C.red, C.redL],
  stripe: [C.lint, C.cotton, C.white],
  pants: [C.plum, C.dusk, C.lav],
  shoe: [C.ink, C.woodD, C.wood],
  metal: [C.dusk, C.lav, C.lint, C.white],
  teal: [C.tealD, C.teal, C.tealM],
  white: [C.lint, C.cotton, C.white],
  yellow: [C.yelD, C.yel, C.yelL],
  boot: [C.redD, C.red, C.redL],
  chick: [C.lint, C.cotton, C.white],
};

const LIGHT = (() => {
  const v = [-0.55, -0.7, 0.55];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

function rampIndex(ramp, d, x, y, dither) {
  const t = (d + 1) / 2;
  const cuts = ramp.length === 4 ? [0.22, 0.4, 0.88] : [0.38, 0.86];
  let i = 0;
  while (i < cuts.length && t >= cuts[i]) i++;
  // ②에서만: 단계 경계 근처는 체크무늬 디더로 섞는다 (그 시절 장르의 명암 관습)
  if (dither) {
    for (let k = 0; k < cuts.length; k++) {
      if (Math.abs(t - cuts[k]) < 0.025 && (x + y) % 2 === 0) i = t >= cuts[k] ? k : k + 1;
    }
  }
  return ramp[Math.max(0, Math.min(ramp.length - 1, i))];
}

class Canvas {
  constructor(w, h, s, ox = 0, oy = 0) {
    this.w = w;
    this.h = h;
    this.s = s; // ① 좌표 → 이 캔버스 좌표 배율
    this.ox = ox;
    this.oy = oy;
    this.big = s > 1;
    this.c = new Int16Array(w * h).fill(EMPTY);
    this.p = new Int16Array(w * h).fill(EMPTY);
    this.parts = [];
  }
  X(x) { return x * this.s + this.ox; }
  Y(y) { return y * this.s + this.oy; }
  idx(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : y * this.w + x; }
  get(x, y) { const i = this.idx(x, y); return i < 0 ? EMPTY : this.c[i]; }
  part(ramp, line = true) {
    this.parts.push({ ramp, line });
    return this.parts.length - 1;
  }
  // 공: 중심·반지름은 ① 좌표
  ball(cx, cy, rx, ry, ramp, opt = {}) {
    const pid = this.part(ramp, opt.line ?? true);
    const s = this.s;
    const X = this.X(cx), Y = this.Y(cy), RX = rx * s, RY = ry * s;
    for (let y = Math.floor(Y - RY - 1); y <= Math.ceil(Y + RY + 1); y++)
      for (let x = Math.floor(X - RX - 1); x <= Math.ceil(X + RX + 1); x++) {
        const nx = (x + 0.5 - X) / RX, ny = (y + 0.5 - Y) / RY;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        if (opt.clip && !opt.clip((x + 0.5 - this.ox) / s, (y + 0.5 - this.oy) / s)) continue;
        const nz = Math.sqrt(1 - r2);
        const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + (opt.bias ?? 0);
        const r = opt.pattern ? opt.pattern((x + 0.5 - this.ox) / s, (y + 0.5 - this.oy) / s) ?? ramp : ramp;
        this.put(x, y, rampIndex(r, d, x, y, this.big), pid);
      }
    return pid;
  }
  // 캡슐: 점 여러 개를 잇는 굵은 선(관절). pts = [[x, y, r], ...] (① 좌표)
  limb(pts, ramp, opt = {}) {
    const pid = this.part(ramp, opt.line ?? true);
    const s = this.s;
    const P = pts.map(([x, y, r]) => [this.X(x), this.Y(y), r * s]);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y, r] of P) {
      x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
      y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
    }
    for (let y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++)
      for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let best = null;
        for (let k = 0; k + 1 < P.length; k++) {
          const [ax, ay, ar] = P[k], [bx, by, br] = P[k + 1];
          const vx = bx - ax, vy = by - ay;
          const L2 = vx * vx + vy * vy || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
          const cx = ax + vx * t, cy = ay + vy * t, r = ar + (br - ar) * t;
          const dx = px - cx, dy = py - cy;
          const q = (dx * dx + dy * dy) / (r * r);
          if (q <= 1 && (!best || q < best.q)) best = { q, dx: dx / r, dy: dy / r, t: k + t };
        }
        if (!best) continue;
        const nz = Math.sqrt(Math.max(0, 1 - best.dx * best.dx - best.dy * best.dy));
        const d = best.dx * LIGHT[0] + best.dy * LIGHT[1] + nz * LIGHT[2] + (opt.bias ?? 0);
        const r = opt.pattern ? opt.pattern((px - this.ox) / s, (py - this.oy) / s, best.t) ?? ramp : ramp;
        this.put(x, y, rampIndex(r, d, x, y, this.big), pid);
      }
    return pid;
  }
  put(x, y, col, pid) {
    const i = this.idx(x, y);
    if (i < 0) return;
    this.c[i] = col;
    this.p[i] = pid;
  }
  // 세부 픽셀: 이 캔버스 좌표 그대로 (부품 번호는 바꾸지 않는다)
  dot(x, y, col) {
    const i = this.idx(Math.round(x), Math.round(y));
    if (i >= 0) this.c[i] = col;
  }
  // 문자 그림 찍기 (이 캔버스 좌표)
  stamp(x0, y0, rows, legend) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (legend[ch] !== undefined) this.dot(x0 + i, y0 + j, legend[ch]);
      }),
    );
  }
  // 부품 경계선: 앞 부품과 맞닿은 뒤 부품 픽셀을 그 부품의 가장 어두운 색으로 칠한다.
  innerLines() {
    const out = this.c.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const a = this.p[i];
        if (a < 0) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = this.idx(x + dx, y + dy);
          if (j < 0) continue;
          const b = this.p[j];
          if (b > a && this.parts[b].line && this.parts[b].ramp !== this.parts[a].ramp) {
            out[i] = this.parts[a].ramp[0] === C.ink ? C.ink : C.plum;
            break;
          }
        }
      }
    this.c = out;
  }
  outline() {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== EMPTY) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) !== EMPTY)) add.push([x, y]);
      }
    for (const [x, y] of add) this.c[y * this.w + x] = C.ink;
  }
  bbox() {
    let x0 = this.w, x1 = -1, y0 = this.h, y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.get(x, y) !== EMPTY) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
}

// ── 머리는 손으로 찍는다 (얼굴이 캐릭터의 정이다). 크기별로 따로 그린다.
const HL = {
  s: C.tan, d: C.woodL, D: C.wood, H: C.woodD, h: C.wood, k: C.ink, K: C.plum, g: C.dusk,
  W: C.white, P: C.ink, m: C.redD, r: C.red, c: C.pink, Y: C.yel, y: C.yelD, L: C.yelL,
  l: C.lint, e: C.cotton, a: C.tealM,
};
const HEADS = {
  jjuk: {
    a: [9, 0, [
      '....H.H..H....',
      '..HHHHHHHHH...',
      '.HHhhHHHHHHH..',
      'HHhHHHHHHHHHH.',
      'HHHHHHsHHsHHH.',
      'HHHHssssssssH.',
      'HHHHskksskkss.',
      'HHHdsWWsWWsss.',
      'HHdDsWPsWPsss.',
      'HHdDsWPsWPssss',
      '.HHdscssdsssss',
      '..dssssssdsssd',
      '...dsmsssdDDD.',
      '...dssmmmmms..',
      '....dsssssss..',
      '.....dddd.....',
    ]],
    b: [14, 0, [
      '.......H..H..H.....',
      '.....HHH.HHHHHH....',
      '...HHHHHHHHHHHHH...',
      '..HHhhhHHHHHHHHHH..',
      '.HHhHHHHHHHHhHHHHH.',
      'HHhHHHHHHHHHHHHHHH.',
      'HHHHHHHHHsHHHsHHHH.',
      'HHHHHHssssssssssHH.',
      'HHHHHsssssssssssss.',
      'HHHHssssssssssssss.',
      'HHHdssssssssssssss.',
      'HHddssssssssssssss.',
      'HdDDdsssssssssssss.',
      'HdDDdssssssssssssss',
      '.Hdddssssssssssssss',
      '..Hdsssssssssssssss',
      '...dssssssssssssss.',
      '...dssssssssssss...',
      '....dssssssssss....',
      '....ddsssssssss....',
      '......ddddddd......',
    ], [
      [6, 7, ['.kkk.kkkk']],
      [6, 9, ['.WW.', 'WWPP', 'WWPP', '.WW.']],
      [11, 9, ['.WW.', 'WWPP', 'WWPP', '.WW.']],
      [14, 12, ['.dss.', 'dsLss', 'dssss', 'dsssD', '.DDD.']],
      [7, 14, ['cc']],
      [5, 17, ['m........m', '.mWWWWWWm.', '..mmrrmm..']],
    ]],
  },
  mukjik: {
    a: [8, 4, [
      '......KKKKKK....',
      '....KKKKKKKKKK..',
      '...KKKKKKKKKKKK.',
      '..WWWWWWWWWWWWWW',
      'WWWllllllllllll.',
      'll.Kssssssssss..',
      '...dsskkkksskkk.',
      '...dssssWPssWPs.',
      '..dDdsssssssssss',
      '..dDdccsssssdsss',
      '...dssssssssdsss',
      '...dssssssssDDD.',
      '...ddsssssmmmm..',
      '....ddssssssss..',
      '.....dddddddd...',
    ]],
    b: [13, 5, [
      '.......KKKKKKK.......',
      '.....KKKKKKKKKKKK....',
      '....KKKgKKKKKgKKKK...',
      '...KKKKKKKKKKKKKKKK..',
      '..eWWWWWWWWWWWWWWWWW.',
      '.eWWWWWWWWWWWWWWWWWWW',
      'WWWlllllllllllllllll.',
      'Wll.Kdssssssssssssss.',
      'll..dsssssssssssssss.',
      '....dsssssssssssssss.',
      '...ddsssssssssssssss.',
      '..dDddssssssssssssss.',
      '..dDDdsssssssssssssss',
      '..ddDdsssssssssssssss',
      '...ddssssssssssssssss',
      '...dssssssssssssssss.',
      '...ddsssssssssssssss.',
      '....ddssssssssssssss.',
      '.....dddssssssssssd..',
      '.......ddddddddddd...',
    ], [
      [8, 8, ['kkkkk.kkkkkk']],
      [9, 10, ['dddd.dddd', 'WWPP.WWPP', '.WP...WP.']],
      [15, 12, ['.dsss.', 'dsLsss', 'dsssss', 'dssssD', '.DDDD.']],
      [8, 14, ['cc']],
      [10, 16, ['mmmmmm']],
      [9, 17, ['d.d.d.d.d']],
      [3, 12, ['D']],
    ]],
  },
  ppik: {
    a: [9, 14, [
      '....yYYYYYy....',
      '..yYLLYYYYYYy..',
      '.yYLYYYYYYYYYy.',
      '.YYYYYyyyyyyyYy',
      'yYYYYyKKKKKKKKy',
      'yYYYyKKKKKKKKK.',
      'yYYYydsgggsggg.',
      'yYYYdssgWPgWPgs',
      'yYYYdssgggsgggs',
      '.yYYyddsssssss.',
      '.yYYyydsmWWm...',
      '..yYYyydssss...',
      '...yyyyyddd....',
    ]],
    b: [14, 18, [
      '......yYYYYYYy......',
      '....yYYLLLYYYYYy....',
      '..yYYLLYYYYYYYYYYy..',
      '.yYYLYYYYYYYYYYYYYy.',
      '.YYYYYYyyyyyyyyyyYy.',
      'yYYYYYyKKKKKKKKKKKyY',
      'yYYYYyKKKKgKKKKKKKKy',
      'yYYYYyKKKKKKKKKKKKKs',
      'yYYYYydsssssssssssss',
      'yYYYYdssssssssssssss',
      'yYYYYdssssssssssssss',
      'yYYYYdssssssssssssss',
      '.yYYYydssssssssssss.',
      '.yYYYyydsssssssss...',
      '..yYYYyydssssssd....',
      '...yYYYyyddddddd....',
      '....yyyyyyy.........',
    ], [
      [8, 8, ['.ggg..ggg.', 'gWWWggWWWg', 'gWPPggWPPg', 'gWPPggWPPg', '.ggg..ggg.']],
      [6, 10, ['gg']],
      [18, 12, ['D']],
      [10, 13, ['mWWWm', '.mmm.']],
    ]],
  },
};
function head(K, name) {
  const v = HEADS[name][K.big ? 'b' : 'a'];
  if (!v) return;
  const [x, y, rows, over = []] = v;
  K.stamp(x, y, rows, HL);
  for (const [dx, dy, r] of over) K.stamp(x + dx, y + dy, r, HL);
  // 머리도 부품으로 등록해서 바깥 외곽선이 둘러싸게 한다
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (HL[ch] !== undefined) { const k = K.idx(x + i, y + j); if (k >= 0) K.p[k] = 999; }
  }));
}

// ── 쭉이: 키다리 낙천가. 줄무늬 셔츠, 접이식 빨래 장대(집게 갈고리). 오른쪽을 본다.
function jjuk(K) {
  const big = K.big;
  // 장대 (몸 뒤, 앞손이 잡는다)
  K.limb([[24.2, 5, 0.95], [24.2, 45.5, 0.95]], R.metal, {
    pattern: (x, y) => (Math.abs(((y - 5) % 9) - 0) < 0.6 ? R.pants : undefined), // 마디 이음매
  });
  // 집게 갈고리
  const hx = Math.round(K.X(22.6)), hy = Math.round(K.Y(0.6));
  if (big) K.stamp(hx, hy, ['.DDDD.', 'D....D', 'D...DD', '.D..D.', '..DD..', '..DD..', '..DD..'], { D: C.dusk });
  else K.stamp(hx, hy, ['.DDD', 'D..D', '.D.D', '..D.', '..DD'], { D: C.dusk });
  // 뒷다리 + 뒷발
  K.limb([[12.6, 30, 1.5], [12.2, 37, 1.35], [12.4, 43.5, 1.3]], R.pants, { bias: -0.35 });
  K.ball(13.4, 45.6, 3.4, 1.9, R.shoe, { bias: -0.2 });
  // 뒷팔 (축 늘어진 긴 팔)
  K.limb([[13, 20, 1.5], [11.2, 26.5, 1.3]], R.shirtRed, { bias: -0.3 });
  K.limb([[11.2, 26.5, 1.15], [11.4, 32.5, 1.05]], R.skin, { bias: -0.3 });
  K.ball(11.6, 34.2, 1.9, 2.1, R.skin, { bias: -0.2 }); // 큰 손
  // 앞다리 + 앞발 (큰 신발)
  K.limb([[16.3, 30, 1.6], [17, 37, 1.45], [17.3, 43.5, 1.35]], R.pants);
  K.ball(19.3, 45.5, 4.3, 2.0, R.shoe);
  // 몸통: 좁고 긴 줄무늬 셔츠, 살짝 구부정
  K.limb([[15.2, 19.5, 3.4], [14.8, 25, 3.5], [14.6, 30, 3.3]], R.shirtRed, {
    pattern: (x, y) => (Math.floor(y) % 3 === 0 && y > 20 ? R.stripe : undefined),
  });
  K.limb([[11.8, 30.6, 0.6], [17.6, 30.6, 0.6]], R.shoe, { line: false }); // 허리띠
  K.limb([[15.0, 14, 1.15], [15.2, 18.5, 1.2]], R.skin, { bias: -0.15 }); // 긴 목
  // 앞팔: 어깨 → 팔꿈치 → 장대를 잡은 손
  K.limb([[16.6, 20, 1.55], [19.4, 25.2, 1.35]], R.shirtRed);
  K.limb([[19.4, 25.2, 1.15], [22.6, 23.6, 1.05]], R.skin);
  K.ball(24.0, 23.4, 2.0, 2.2, R.skin); // 큰 손 (장대를 쥠)
  K.innerLines();
  head(K, 'jjuk');

  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  if (big) {
    const [cx, cy] = P(14.3, 18.6);
    K.stamp(cx, cy, ['W..W', 'WW.W'], { W: C.white }); // 셔츠 깃
    const [bx, by] = P(16.2, 22.3);
    K.stamp(bx, by, ['AAA', 'AWA'], { A: C.aqua, W: C.tealM }); // 직원 명찰
    const [fx, fy] = P(23.1, 22.1);
    K.stamp(fx, fy, ['.S.', 'S.S'], { S: C.wood }); // 손가락
    const [sx, sy] = P(18.2, 44.0);
    K.stamp(sx, sy, ['W.W'], { W: C.lint }); // 신발 끈
  } else {
    K.dot(...P(16.4, 22.6), C.aqua); // 명찰
  }
  return K;
}

// ── 묵직이: 전직 씨름부 덩치. 멜빵 작업복, 흰 머리띠. 무게로 쿵.
function mukjik(K) {
  const big = K.big;
  // 뒷팔
  K.limb([[8, 22.5, 2.9], [5.6, 29, 2.6]], R.white, { bias: -0.3 });
  K.limb([[5.6, 29, 2.4], [5.2, 33, 2.3]], R.skin, { bias: -0.3 });
  K.ball(5.4, 35.4, 3.0, 2.8, R.skin, { bias: -0.2 }); // 주먹
  // 다리 (짧고 굵다)
  K.limb([[12, 38, 3.0], [11.6, 43.6, 2.7]], R.teal, { bias: -0.3 });
  K.ball(11.2, 45.5, 4.2, 2.0, R.shoe, { bias: -0.2 });
  K.limb([[19.4, 38, 3.1], [20, 43.6, 2.8]], R.teal);
  K.ball(21.8, 45.5, 4.6, 2.0, R.shoe);
  // 몸통: 셔츠(흰) 위에 큰 배를 감싼 작업복
  K.ball(16, 26.5, 10.6, 9.6, R.white);
  K.ball(16.4, 32.4, 11.2, 8.6, R.teal, { clip: (x, y) => y > 27.2 });
  // 가슴받이 + 멜빵
  K.ball(17.2, 28.2, 5.2, 4.2, R.teal, { clip: (x, y) => y > 24.6 });
  K.limb([[11.4, 18.6, 1.0], [12.6, 26, 1.0]], R.teal, { bias: 0.2 });
  K.limb([[20.6, 18.6, 1.0], [21.2, 26, 1.0]], R.teal, { bias: 0.2 });
  K.ball(16.6, 17.6, 4.8, 2.4, R.skin, { bias: -0.2 }); // 굵은 목
  // 앞팔 (굵다, 주먹)
  K.limb([[24.2, 22.4, 3.0], [26.6, 28.6, 2.7]], R.white);
  K.limb([[26.6, 28.6, 2.4], [27.0, 32.6, 2.3]], R.skin);
  K.ball(27.2, 35.0, 3.2, 3.0, R.skin);
  K.innerLines();
  head(K, 'mukjik');

  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  K.dot(...P(13.0, 25.4), C.yel); // 작업복 단추
  K.dot(...P(20.8, 25.4), C.yel);
  if (big) {
    const [px, py] = P(15.0, 27.0);
    K.stamp(px, py, ['DDDDD', 'D...D', 'DDDDD'], { D: C.tealD }); // 가슴 주머니
    const [bx, by] = P(18.8, 21.0);
    K.stamp(bx, by, ['AAA', 'AWA'], { A: C.aqua, W: C.tealM }); // 명찰
    const [fx, fy] = P(27.4, 34.4);
    K.stamp(fx, fy, ['S.S', '.S.'], { S: C.wood }); // 주먹 마디
    const [lx, ly] = P(17.6, 42.6);
    K.stamp(lx, ly, ['DDDDD'], { D: C.tealD }); // 바짓단
  }
  return K;
}

// ── 삑삑이: 겁 많은 막내(성인). 노란 우비, 빨간 장화, 동그란 안경. 고무 닭을 꼭 쥔다.
function ppik(K) {
  const big = K.big;
  // 장화 + 다리
  K.limb([[13.4, 37, 1.2], [13.4, 41, 1.2]], R.pants, { bias: -0.3 });
  K.limb([[13.4, 41.5, 1.6], [13.4, 44.2, 1.6]], R.boot, { bias: -0.3 });
  K.ball(14.4, 45.6, 2.9, 1.8, R.boot, { bias: -0.2 });
  K.limb([[17, 37, 1.25], [17.2, 41, 1.25]], R.pants);
  K.limb([[17.2, 41.5, 1.7], [17.2, 44.2, 1.7]], R.boot);
  K.ball(18.6, 45.6, 3.2, 1.9, R.boot);
  // 우비 몸통: 아래로 퍼지는 A라인
  K.limb([[15.2, 27.2, 3.6], [15.0, 33.4, 5.2], [15.0, 36.2, 5.4]], R.yellow);
  // 고무 닭: 두 손으로 앞에 쥔다
  K.ball(24.4, 28.6, 3.4, 2.8, R.chick);
  K.ball(26.6, 24.6, 1.8, 2.0, R.chick);
  K.limb([[26.0, 26.4, 1.1], [25.6, 27.4, 1.3]], R.chick, { line: false });
  // 팔: 우비 소매 → 손이 닭 몸을 꽉 쥔다
  K.limb([[17.4, 27.4, 1.5], [20.6, 29.6, 1.4]], R.yellow);
  K.ball(22.2, 29.6, 1.7, 1.7, R.skin);
  K.innerLines();
  head(K, 'ppik');

  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  // 땀방울
  {
    const [x, y] = P(25.0, 15.6);
    if (big) K.stamp(x, y, ['.A.', 'AAA', 'AWA', '.A.'], { A: C.tealM, W: C.white });
    else K.stamp(x, y, ['A', 'A'], { A: C.tealM });
  }
  // 닭: 볏, 부리, 눈, 다리
  {
    const [x, y] = P(25.6, 21.8);
    K.stamp(x, y, big ? ['.R.R', 'RRRR'] : ['RR'], { R: C.red });
    const [bx, by] = P(28.0, 24.2);
    K.stamp(bx, by, big ? ['OO', 'OOO', 'O'] : ['OO'], { O: C.hint });
    K.dot(...P(26.9, 23.8), C.ink);
    const [lx, ly] = P(23.6, 31.2);
    K.stamp(lx, ly, big ? ['O.O', 'O.O'] : ['O.O'], { O: C.hint });
  }
  K.dot(...P(17.6, 30.0), C.yelD); // 우비 단추
  K.dot(...P(17.6, 33.0), C.yelD);
  if (big) {
    const [px, py] = P(12.0, 31.4);
    K.stamp(px, py, ['DDDD', 'D..D'], { D: C.yelD }); // 주머니
    const [bx, by] = P(13.6, 28.0);
    K.stamp(bx, by, ['AAA', 'AWA'], { A: C.aqua, W: C.tealM }); // 명찰
    const [sx, sy] = P(16.4, 46.7);
    K.stamp(sx, sy, ['DDDDDD'], { D: C.redD }); // 장화 밑창
  }
  return K;
}

// ── 캐릭터 만들기: ①은 32×48 칸, ②는 48×64 칸. 둘 다 바깥 외곽선(잉크 1px) 포함.
const CELL = { a: [32, 48, 1, 0, 0], b: [48, 64, 4 / 3, 2.6, 0] };
const DRAW = [jjuk, mukjik, ppik];
const NAMES = ['쭉이', '묵직이', '삑삑이'];
function build(ver) {
  return DRAW.map((fn) => {
    const [w, h, s, ox, oy] = CELL[ver];
    const K = fn(new Canvas(w, h, s, ox, oy));
    K.outline();
    return K;
  });
}

// ── 시트: 칸 테두리(점선)를 보여 주고, 색 / 명도 / 실루엣 3줄로 놓는다.
class Sheet {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.c = new Int16Array(w * h).fill(C.cotton);
    this.gray = new Uint8Array(w * h);
  }
  set(x, y, col, gray = false) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.c[y * this.w + x] = col;
    this.gray[y * this.w + x] = gray ? 1 : 0;
  }
  rect(x, y, w, h, col, gray) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col, gray);
  }
  blit(K, x0, y0, map, gray) {
    for (let y = 0; y < K.h; y++)
      for (let x = 0; x < K.w; x++) {
        const c = K.get(x, y);
        if (c !== EMPTY) this.set(x0 + x, y0 + y, map ? map(c) : c, gray);
      }
  }
  cellGuide(x0, y0, w, h, gray) {
    for (let i = 0; i < w; i += 2) {
      this.set(x0 + i, y0 - 1, C.lint, gray);
    }
    for (let j = 0; j < h; j += 2) {
      this.set(x0 - 1, y0 + j, C.lint, gray);
      this.set(x0 + w, y0 + j, C.lint, gray);
    }
  }
}

function sheetFor(crew, cw, ch) {
  const gap = 8;
  const W = 3 * cw + 4 * gap;
  const rowH = ch + 10;
  const S = new Sheet(W, rowH * 3);
  for (let r = 0; r < 3; r++) {
    const y0 = r * rowH + 4;
    const gray = r === 1;
    S.rect(0, r * rowH, W, rowH, C.cotton, gray);
    S.rect(0, y0 + ch, W, rowH - ch - 4, C.grnL, gray);
    crew.forEach((K, i) => {
      const x0 = gap + i * (cw + gap);
      S.cellGuide(x0, y0, cw, ch, gray);
      S.blit(K, x0, y0, r === 2 ? () => C.ink : null, gray);
    });
  }
  return S;
}

// ── 480×270 화면 비교: 빨래방 안 (벽, 바닥, 세탁기 3대, 계산대). 왼쪽 반은 ①, 오른쪽 반은 ②.
function screen(crewA, crewB) {
  const S = new Sheet(480, 270);
  S.rect(0, 0, 480, 200, C.aqua);
  for (let x = 0; x < 480; x += 16) S.rect(x, 0, 1, 200, C.tealL);
  S.rect(0, 150, 480, 4, C.tealL);
  S.rect(0, 200, 480, 70, C.cotton);
  for (let y = 200; y < 270; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < 480; x += 20) S.rect(x, y, 10, 10, C.lint);
  S.rect(0, 200, 480, 1, C.lav);
  // 세탁기: 32×40, 동그란 문
  const washer = (x, y) => {
    S.rect(x - 1, y - 1, 34, 42, C.ink);
    S.rect(x, y, 32, 40, C.white);
    S.rect(x, y, 32, 7, C.cotton);
    S.rect(x + 3, y + 2, 6, 2, C.lav);
    for (let j = -10; j <= 10; j++)
      for (let i = -10; i <= 10; i++) {
        const r = Math.hypot(i, j);
        if (r <= 10.5) S.set(x + 16 + i, y + 23 + j, r > 9 ? C.dusk : r > 7.5 ? C.lint : j + i < -4 ? C.tealL : C.tealM);
      }
  };
  for (const x of [40, 80, 120, 280, 320, 360]) washer(x, 160);
  S.rect(239, 0, 2, 270, C.ink);
  const feet = [[66, 228], [116, 236], [160, 226], [300, 228], [362, 236], [418, 226]];
  crewA.forEach((K, i) => S.blit(K, feet[i][0] - 16, feet[i][1] - K.h));
  crewB.forEach((K, i) => S.blit(K, feet[i + 3][0] - 24, feet[i + 3][1] - K.h));
  // 라벨 막대: ①은 1칸, ②는 2칸
  S.rect(8, 8, 6, 6, C.hint);
  S.rect(248, 8, 6, 6, C.hint);
  S.rect(256, 8, 6, 6, C.hint);
  return S;
}

// ── PNG 저장 (RGB). 명도 칸은 Y로 바꾼다.
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(S, scale) {
  const w = S.w * scale;
  const h = S.h * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = Math.floor(y / scale) * S.w + Math.floor(x / scale);
      let [r, g, b] = PALETTE[S.c[i]];
      if (S.gray[i]) r = g = b = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 프레임 비용 지표: 칠한 픽셀 수, 외곽선 길이, 쓴 색 수
function stats(K) {
  let filled = 0, edge = 0;
  const cols = new Set();
  for (let y = 0; y < K.h; y++)
    for (let x = 0; x < K.w; x++) {
      const c = K.get(x, y);
      if (c === EMPTY) continue;
      filled++;
      cols.add(c);
      if (c === C.ink) edge++;
    }
  return { filled, edge, colors: cols.size };
}

const A = build('a');
const B = build('b');
writeFileSync(join(HERE, 'crew-v3a-4x.png'), png(sheetFor(A, 32, 48), 4));
writeFileSync(join(HERE, 'crew-v3b-4x.png'), png(sheetFor(B, 48, 64), 4));
writeFileSync(join(HERE, 'crew-v3-screen-2x.png'), png(screen(A, B), 2));
for (const [label, crew] of [['① 32x48', A], ['② 48x64', B]]) {
  console.log(label);
  crew.forEach((K, i) => {
    const b = K.bbox();
    const s = stats(K);
    console.log(`  ${NAMES[i]} 그림 ${b.w}x${b.h} (x ${b.x0}~${b.x0 + b.w - 1}, y ${b.y0}~${b.y0 + b.h - 1}) 칠한 픽셀 ${s.filled}, 잉크 픽셀 ${s.edge}, 색 ${s.colors}`);
  });
}
