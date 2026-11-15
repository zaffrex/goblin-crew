// 코드로 그리는 픽셀아트 공용 도구 (ADR-0007 결정 7).
// - 보송 32색 팔레트(docs/design/art/bosong-32.hex)를 읽는다. 팔레트 원본은 그 파일 하나다.
// - Canvas: 몸을 공(ball)·캡슐(limb) 부품으로 조립하고 왼쪽 위 빛으로 명암을 넣는다. 머리·손은 문자 격자(stamp)로 찍는다.
//   좌표는 3차 샘플(crew-v3.mjs)과 같은 "① 좌표"이고 ② 칸(48×64)에는 4/3배 해서 그린다.
// - PNG: 8비트 인덱스 PNG(보송 인덱스 0~31 그대로, 투명은 32번 + tRNS). 미리보기용 APNG도 만든다.
// crew-v3.mjs에서 옮겨 왔다. 그 파일은 3차 샘플 기록이라 그대로 둔다.

import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PALETTE_FILE = join(ROOT, 'docs', 'design', 'art', 'bosong-32.hex');

export const HEX = readFileSync(PALETTE_FILE, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
if (HEX.length !== 32) throw new Error(`보송 팔레트는 32색이어야 한다: ${HEX.length}`);
export const PALETTE = HEX.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));

export const C = {
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
export const EMPTY = -1;
/** PNG 안에서 투명을 뜻하는 인덱스. 보송 32색 바로 뒤. */
export const CLEAR = 32;

// 명암 단계: 어두운 쪽 → 밝은 쪽
export const R = {
  skin: [C.wood, C.woodL, C.tan],
  hair: [C.ink, C.woodD, C.wood],
  shirtRed: [C.redD, C.red, C.redL],
  stripe: [C.lint, C.cotton, C.white],
  pants: [C.plum, C.dusk, C.lav],
  shoe: [C.ink, C.woodD, C.wood],
  metal: [C.dusk, C.lav, C.lint, C.white],
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
  // 단계 경계 근처는 체크무늬 디더로 섞는다
  if (dither) {
    for (let k = 0; k < cuts.length; k++) {
      if (Math.abs(t - cuts[k]) < 0.025 && (x + y) % 2 === 0) i = t >= cuts[k] ? k : k + 1;
    }
  }
  return ramp[Math.max(0, Math.min(ramp.length - 1, i))];
}

export class Canvas {
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
        const nz = Math.sqrt(1 - r2);
        const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + (opt.bias ?? 0);
        this.put(x, y, rampIndex(ramp, d, x, y, this.big), pid);
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
  // 문자 그림 찍기 (이 캔버스 좌표). part를 주면 그 픽셀을 그 부품으로 등록한다(바깥 외곽선이 둘러싸게).
  stamp(x0, y0, rows, legend, part) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (legend[ch] === undefined) return;
        this.dot(x0 + i, y0 + j, legend[ch]);
        if (part !== undefined) {
          const k = this.idx(x0 + i, y0 + j);
          if (k >= 0) this.p[k] = part;
        }
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
  bbox(rowFrom = 0, rowTo = this.h - 1) {
    let x0 = this.w, x1 = -1, y0 = this.h, y1 = -1;
    for (let y = rowFrom; y <= rowTo; y++)
      for (let x = 0; x < this.w; x++)
        if (this.get(x, y) !== EMPTY) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
}

/** 팔레트 인덱스 그림(미리보기·시트 공용). EMPTY 칸은 투명. */
export class Image {
  constructor(w, h, fill = EMPTY) {
    this.w = w;
    this.h = h;
    this.c = new Int16Array(w * h).fill(fill);
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? EMPTY : this.c[y * this.w + x]; }
  set(x, y, col) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.c[y * this.w + x] = col;
  }
  rect(x, y, w, h, col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }
  /** src(Canvas 또는 Image)를 (x0, y0)에 겹친다. flipAx를 주면 x = flipAx 경계를 축으로 좌우 반전한다. map으로 색을 바꿀 수 있다. */
  blit(src, x0, y0, { map, flipAx } = {}) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c === EMPTY) continue;
        const dx = flipAx === undefined ? x : 2 * flipAx - 1 - x;
        this.set(x0 + dx, y0 + y, map ? map(c) : c);
      }
  }
}

// ── PNG
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
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdr(w, h) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0);
  b.writeUInt32BE(h, 4);
  b[8] = 8; // 비트 깊이
  b[9] = 3; // 인덱스 색
  return chunk('IHDR', b);
}
function paletteChunks(withClear) {
  const plte = Buffer.from(PALETTE.flat().concat(withClear ? [0, 0, 0] : []));
  const out = [chunk('PLTE', plte)];
  if (withClear) {
    const trns = Buffer.alloc(CLEAR + 1, 0xff);
    trns[CLEAR] = 0;
    out.push(chunk('tRNS', trns));
  }
  return out;
}
function scanlines(img, scale, gray) {
  const w = img.w * scale, h = img.h * scale;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = img.c[Math.floor(y / scale) * img.w + Math.floor(x / scale)];
      raw[y * (w + 1) + 1 + x] = c === EMPTY ? CLEAR : gray ? gray(c) : c;
    }
  }
  return raw;
}
function hasClear(img) {
  return img.c.some((c) => c === EMPTY);
}

/** 8비트 인덱스 PNG. 색 인덱스 = 보송 인덱스. 투명 칸이 있으면 32번을 투명으로 쓴다. 출력은 입력에 대해 결정적이다. */
export function indexedPng(img, scale = 1) {
  const clear = hasClear(img);
  return Buffer.concat([
    SIGNATURE,
    ihdr(img.w * scale, img.h * scale),
    ...paletteChunks(clear),
    chunk('IDAT', deflateSync(scanlines(img, scale), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 미리보기용 애니메이션 PNG(APNG). frames = [{ img, ms }], 모든 img 크기가 같아야 한다. 브라우저·GitHub에서 움직인다. */
export function animatedPng(frames, scale = 1) {
  const { w, h } = frames[0].img;
  const clear = frames.some((f) => hasClear(f.img));
  const out = [SIGNATURE, ihdr(w * scale, h * scale), ...paletteChunks(clear)];
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(0, 4); // 무한 반복
  out.push(chunk('acTL', actl));
  let seq = 0;
  frames.forEach((f, i) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(w * scale, 4);
    fctl.writeUInt32BE(h * scale, 8);
    fctl.writeUInt32BE(0, 12);
    fctl.writeUInt32BE(0, 16);
    fctl.writeUInt16BE(f.ms, 20);
    fctl.writeUInt16BE(1000, 22);
    fctl[24] = 0; // dispose: none
    fctl[25] = 0; // blend: source
    out.push(chunk('fcTL', fctl));
    const data = deflateSync(scanlines(f.img, scale), { level: 9 });
    if (i === 0) out.push(chunk('IDAT', data));
    else {
      const sq = Buffer.alloc(4);
      sq.writeUInt32BE(seq++);
      out.push(chunk('fdAT', Buffer.concat([sq, data])));
    }
  });
  out.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(out);
}
