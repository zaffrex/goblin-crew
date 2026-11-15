// 사람 3인조 실루엣·색 샘플 (#3, ADR-0003 재작성). 외부 이미지 없이 코드로만 그린다.
// 실행: node docs/design/art/crew-humans.mjs
// 출력: 같은 폴더에 crew-humans-4x.png (위: 색 / 가운데: 명도 / 아래: 검은 실루엣)
// 4배 = 480×270 화면을 1080p 전체 화면에 띄웠을 때의 실제 크기다.
// 이 파일은 빌드에 들어가지 않는 디자인 자료다. 팔레트는 ADR-0007 초안(PR #42)의 보송 32색과 같은 값이다.

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

class Layer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Int16Array(w * h).fill(EMPTY);
    this.ax = Math.floor(w / 2);
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return EMPTY;
    return this.px[y * this.w + x];
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  // 문자 그림: 범례의 글자를 팔레트 색으로 찍는다. '.'은 비움.
  stamp(x0, y0, rows, legend) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch !== '.' && ch !== ' ') this.set(x0 + i, y0 + j, legend[ch]);
      }),
    );
  }
  outline(c = C.ink) {
    const g = new Layer(this.w + 2, this.h + 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(x + 1, y + 1, this.get(x, y));
    const add = [];
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (g.get(x, y) !== EMPTY) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.get(x + dx, y + dy) !== EMPTY)) add.push([x, y]);
      }
    for (const [x, y] of add) g.set(x, y, c);
    g.ax = this.ax + 1;
    return g;
  }
  blitAnchor(dst, ax, ay) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c !== EMPTY) dst.set(ax - this.ax + x, ay - this.h + y, c);
      }
  }
  map(fn) {
    const m = new Layer(this.w, this.h);
    m.ax = this.ax;
    for (let i = 0; i < this.px.length; i++) m.px[i] = this.px[i] === EMPTY ? EMPTY : fn(this.px[i]);
    return m;
  }
}

// 공통 얼굴: 오른쪽을 본다. 눈 2개(1×2), 입. 피부는 tan, 그림자는 woodL.
function face(L, x, y, w, h, mouth) {
  L.ellipse(x + w / 2 - 0.5, y + h / 2 - 0.5, w / 2, h / 2, C.tan);
  const ex = x + Math.round(w * 0.45);
  const ey = y + Math.round(h * 0.42);
  L.rect(ex, ey, 1, 2, C.ink);
  L.rect(ex + 3, ey, 1, 2, C.ink);
  L.set(ex + 4, ey + 3, C.woodL); // 코
  if (mouth === 'grin') L.rect(ex + 1, ey + 4, 3, 1, C.redD);
  if (mouth === 'flat') L.rect(ex + 1, ey + 4, 2, 1, C.wood);
  if (mouth === 'o') L.rect(ex + 2, ey + 4, 1, 1, C.redD);
  L.set(x + 1, ey + 1, C.woodL); // 귀
}

// ── 쭉이: 키다리. 접이식 빨래 장대(끝에 집게 갈고리)를 들고 다닌다. 능력 stretch = 장대를 쭉 뻗기.
function drawJjuk() {
  const L = new Layer(20, 46);
  // 장대(접힌 상태): 몸 오른쪽에 세로로 든다. 맨 위에 집게 갈고리.
  L.rect(16, 6, 2, 34, C.lint);
  L.rect(16, 6, 1, 34, C.cotton);
  L.stamp(14, 0, ['.KKK', 'K...', 'K..K', '.KK.', '..KK', '..KK'], { K: C.dusk });
  // 다리: 길고 가늘다 (짙은 바지). 다리 폭 6 → 기준점 x=6
  L.rect(3, 30, 2, 13, C.dusk);
  L.rect(7, 30, 2, 13, C.dusk);
  L.rect(3, 30, 6, 3, C.dusk);
  L.rect(2, 43, 4, 3, C.woodD);
  L.rect(7, 43, 5, 3, C.woodD);
  // 몸통: 빨강 줄무늬 셔츠, 가늘고 길다
  L.rect(2, 15, 8, 16, C.red);
  for (let y = 17; y < 31; y += 3) L.rect(2, y, 8, 1, C.cotton);
  L.rect(9, 15, 1, 16, C.redD);
  // 팔: 길다. 오른팔은 장대를 잡는다
  L.rect(0, 16, 2, 12, C.red);
  L.rect(0, 28, 2, 2, C.tan);
  L.rect(10, 16, 6, 2, C.red);
  L.rect(14, 18, 2, 2, C.tan);
  // 목
  L.rect(5, 13, 2, 2, C.tan);
  // 머리 + 삐죽 솟은 머리카락
  face(L, 1, 3, 10, 11, 'grin');
  L.stamp(1, 0, ['..W.W.W..', '.WWWWWWWW', 'WWWWWWWWWW', 'WWW.......', 'WW........'], { W: C.woodD });
  L.ax = 6;
  return L;
}

// ── 묵직이: 덩치. 몸무게로 쿵. 능력 stomp = 엉덩방아·발 구르기로 누르고 튕기고 깔고 앉기.
function drawMukjik() {
  const L = new Layer(28, 38);
  // 다리: 짧고 굵다. 기준점 = 다리 사이 가운데 x=14
  L.rect(8, 30, 5, 5, C.tealD);
  L.rect(15, 30, 5, 5, C.tealD);
  L.rect(7, 35, 7, 3, C.woodD);
  L.rect(15, 35, 8, 3, C.woodD);
  // 몸통: 크고 둥근 멜빵 작업복(teal)
  L.ellipse(13.5, 21, 13.5, 11, C.teal);
  L.ellipse(15.5, 23, 10.5, 8.5, C.tealM);
  L.rect(8, 11, 2, 8, C.tealD);
  L.rect(18, 11, 2, 8, C.tealD);
  L.rect(10, 11, 8, 4, C.white); // 셔츠 목
  // 팔: 굵다. 양쪽으로 늘어뜨림
  L.ellipse(1.5, 22, 2, 6, C.teal);
  L.ellipse(26, 22, 2, 6, C.teal);
  L.rect(0, 27, 3, 3, C.tan);
  L.rect(25, 27, 3, 3, C.tan);
  // 머리: 몸에 비해 작다. 짧은 머리 + 흰 머리띠
  face(L, 8, 1, 11, 11, 'flat');
  L.rect(9, 0, 9, 2, C.plum);
  L.rect(8, 2, 11, 2, C.white);
  L.rect(8, 4, 2, 2, C.plum);
  L.ax = 14;
  return L;
}

// ── 삑삑이: 작고 겁 많은 막내. 고무 닭 장난감을 꼭 쥐고 다닌다. 능력 squeak = 고무 닭을 눌러 꽥.
function drawPpik() {
  const L = new Layer(22, 31);
  // 다리 + 빨간 장화. 기준점 x=7
  L.rect(4, 24, 2, 3, C.dusk);
  L.rect(8, 24, 2, 3, C.dusk);
  L.rect(3, 27, 4, 4, C.red);
  L.rect(8, 27, 5, 4, C.red);
  // 노란 우비 몸통(사다리꼴)
  for (let j = 0; j < 11; j++) L.rect(3 - Math.floor(j / 5), 13 + j, 8 + 2 * Math.floor(j / 5), 1, C.yel);
  L.rect(10, 15, 1, 9, C.yelD);
  // 노란 우비 모자가 큰 얼굴을 감싼다
  L.ellipse(6.5, 6.5, 6.5, 6.5, C.yel);
  L.ellipse(6.5, 7, 5.5, 5.5, C.yelD); // 모자 안쪽 테: 흑백에서도 얼굴과 우비가 갈린다
  face(L, 2, 2, 10, 10, 'o');
  L.rect(2, 1, 10, 2, C.yel);
  L.rect(1, 0, 11, 1, C.yel);
  L.set(12, 1, C.yelD);
  // 땀 한 방울 (겁쟁이)
  L.set(13, 4, C.tealL);
  L.set(13, 5, C.tealL);
  // 팔을 앞으로 뻗어 고무 닭을 쥔다
  L.rect(10, 16, 4, 2, C.yel);
  L.stamp(13, 9, [
    '..RR....',
    '.RWW....',
    '.WWKW...',
    'WWWWWYY.',
    'WWWWWYY.',
    'WWWWW...',
    'TTWWWW..',
    'TTWWWWW.',
    '.WWWWW..',
    '..WWW...',
    '..Y.Y...',
    '..Y.Y...',
  ], { R: C.red, W: C.white, K: C.ink, Y: C.yelD, T: C.tan });
  L.ax = 7;
  return L;
}

const crew = [drawJjuk(), drawMukjik(), drawPpik()].map((L) => L.outline());
const PANEL_W = 120;
const PANEL_H = 56;
const FLOOR = 52;
const xs = [20, 58, 96];

function panel(dst, y0, bg, recolor) {
  dst.rect(0, y0, PANEL_W, PANEL_H, bg);
  dst.rect(0, y0 + FLOOR, PANEL_W, PANEL_H - FLOOR, C.grnL);
  crew.forEach((L, i) => (recolor ? L.map(recolor) : L).blitAnchor(dst, xs[i], y0 + FLOOR));
}
const sheet = new Layer(PANEL_W, PANEL_H * 3);
panel(sheet, 0, C.cotton);
panel(sheet, PANEL_H, C.cotton); // 명도는 저장할 때 회색 팔레트로 바꾼다
panel(sheet, PANEL_H * 2, C.cotton, () => C.ink);

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
// RGB PNG. 가운데 패널만 명도(Y)로 바꾼다.
function png(layer, scale) {
  const w = layer.w * scale;
  const h = layer.h * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const ly = Math.floor(y / scale);
    const gray = ly >= PANEL_H && ly < PANEL_H * 2;
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = layer.get(Math.floor(x / scale), ly);
      let [r, g, b] = PALETTE[c === EMPTY ? C.white : c];
      if (gray) r = g = b = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
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

writeFileSync(join(HERE, 'crew-humans-4x.png'), png(sheet, 4));
const names = ['쭉이', '묵직이', '삑삑이'];
crew.forEach((L, i) => console.log(`${names[i]} ${L.w}x${L.h} (외곽선 포함), anchorX ${L.ax}`));
