// 배경·물건용 질감 붓 (#145 도트 밀도 기준). 화면 아트 스크립트가 같이 쓴다.
// - 면을 한 색 + 망점으로 채우지 않고, 벽돌 한 장·판자 한 장·풀 한 포기 단위로 찍는다.
// - 무작위는 전부 좌표 해시라서 같은 입력이면 같은 그림이 나온다(PNG 재생성 결정적).
// - 배경 붓은 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 2·3-1). 질감은 서로 붙은 명암 단 2개 안에서 찍는다(낮은 대비, 결정 3-2).
// - 광원은 왼쪽 위(결정 3-3): 하이라이트는 왼쪽·위 가장자리, 그림자는 오른쪽·아래.

import { C, EMPTY, Image } from './pixel.mjs';

/** 좌표 해시 → [0, 1). */
export function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 시드 고정 난수(mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** 4×4 Bayer: t(0~1) 비율만큼 b. 배경 전용. */
export const bay = (x, y, t, a, b) => (BAYER[y & 3][x & 3] < t * 16 ? b : a);

export function fill(img, x0, y0, w, h, f) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const c = typeof f === 'function' ? f(x, y) : f;
      if (c !== undefined) img.set(x, y, c);
    }
}

export function ellipse(img, cx, cy, rx, ry, f) {
  fill(img, Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1 ? (typeof f === 'function' ? f(x, y, dx, dy) : f) : undefined;
  });
}

/** Bresenham 선. c는 색 또는 (x, y, t) => 색. */
export function line(img, x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  let err = dx + dy, x = x0, y = y0, i = 0;
  for (;;) {
    const col = typeof c === 'function' ? c(x, y, i / n) : c;
    if (col !== undefined) img.set(x, y, col);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    i++;
  }
}

/** 문자 격자를 찍는다. legend: 문자 → 색. '.'과 ' '는 건너뛴다. */
export function stamp(img, x0, y0, rows, legend) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.' || ch === ' ') return;
    const c = legend[ch];
    if (c === undefined) throw new Error(`stamp: 모르는 문자 '${ch}'`);
    img.set(x0 + i, y0 + j, c);
  }));
}

/** 만질 수 있는 것의 바깥쪽 1px ink 외곽선(결정 3-1). */
export function outlined(im) {
  const out = new Image(im.w, im.h);
  out.blit(im, 0, 0);
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      if (im.get(x, y) !== EMPTY) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => im.get(x + dx, y + dy) !== EMPTY)) out.set(x, y, C.ink);
    }
  return out;
}

// ───────────── 벽돌 ─────────────
const SHADE = {
  [C.white]: C.cotton, [C.cotton]: C.lint, [C.pinkL]: C.pink, [C.pink]: C.lav, [C.lint]: C.lav, [C.lav]: C.dusk,
  [C.woodL]: C.wood, [C.wood]: C.woodD, [C.tan]: C.woodL, [C.grnL]: C.grn, [C.grnP]: C.grnL, [C.grn]: C.grnD,
  [C.tealL]: C.tealM, [C.aqua]: C.tealL, [C.purL]: C.lav, [C.yelL]: C.yel, [C.yel]: C.yelD,
};
/** 한 단 어둡게(그늘). 표에 없으면 그대로. */
export const darker = (c) => SHADE[c] ?? c;

/**
 * 벽돌 벽. 한 장마다 색·모서리 하이라이트·깨진 자국이 다르다.
 * shade(x, y) → true면 한 단 어둡게(처마 그늘, 홈통 얼룩 등).
 */
export function bricks(img, x0, y0, w, h, { bw = 12, bh = 6, seed = 1, shade = () => false } = {}) {
  fill(img, x0, y0, w, h, (x, y) => {
    const row = Math.floor((y - y0) / bh);
    const off = row % 2 ? bw >> 1 : 0;
    const bx = Math.floor((x - x0 + off) / bw);
    const lx = (x - x0 + off) % bw, ly = (y - y0) % bh;
    const r = hash(bx, row, seed);
    let c;
    if (ly === bh - 1 || lx === bw - 1) {
      c = C.lint; // 줄눈
      if (hash(x, y, seed + 9) < 0.08) c = C.cotton;
    } else {
      const base = r < 0.62 ? C.pinkL : r < 0.86 ? C.cotton : C.pink;
      c = base;
      if (ly === 0 && lx < bw - 3 && hash(x, row, seed + 3) > 0.25) c = base === C.pink ? C.pinkL : C.white; // 윗모서리 빛
      else if (ly === bh - 2 || lx === bw - 2) c = darker(base); // 아래·오른쪽 그늘
      if (hash(x, y, seed + 5) < 0.035) c = C.lint; // 깨진 자국
      // 몇 장은 모서리가 떨어져 나갔다
      if (r > 0.93 && lx < 3 && ly < 2) c = C.lint;
    }
    return shade(x, y) ? darker(c) : c;
  });
}

// ───────────── 나무 판자 담장 ─────────────
/**
 * 세로 판자 담장. 판자마다 높이·나뭇결·옹이·못·이끼가 다르다.
 * 주색은 wood(11): 담장 앞에 서는 세 사람 피부(12~13)와 명도 차를 벌린다(#145 리스크 2).
 * broken: 부러진 판자 번호 목록 → 그 자리는 behind(x, y)로 칠한다(뒤쪽 이웃집 덤불).
 */
export function planks(img, x0, x1, top, bottom, { pw = 16, seed = 2, broken = [], behind } = {}) {
  for (let x = x0; x < x1; x++) {
    const k = Math.floor((x - x0) / pw), lx = (x - x0) % pw;
    const jit = Math.floor(hash(k, 0, seed) * 3) - 1; // 판자마다 ±1px
    const peak = top + jit + Math.round(Math.abs(lx - (pw - 1) / 2) * 0.55);
    const isBroken = broken.includes(k);
    const bTop = isBroken ? top + 14 + Math.round(Math.abs(Math.sin(lx * 1.7)) * 4) : peak; // 부러진 끝은 들쭉날쭉
    const knotY = top + 12 + Math.floor(hash(k, 1, seed) * (bottom - top - 24));
    const knotX = 4 + Math.floor(hash(k, 2, seed) * (pw - 9));
    const hasKnot = hash(k, 3, seed) < 0.55;
    for (let y = Math.min(peak, bTop); y < bottom; y++) {
      if (y < peak) continue;
      if (isBroken && y < bTop) { if (behind) { const b = behind(x, y); if (b !== undefined) img.set(x, y, b); } continue; }
      let c;
      if (lx === pw - 1) c = C.woodD; // 틈
      else if (lx === 0) c = y < peak + 2 ? C.tan : C.woodL; // 왼쪽 모서리 빛
      else if (lx === pw - 2) c = hash(x, y, seed) < 0.6 ? C.woodD : C.wood; // 오른쪽 그늘
      else {
        c = C.wood;
        // 나뭇결: 흔들리는 세로줄, 군데군데 끊김
        const wob = Math.round(Math.sin((y + k * 13) / 7) * 1.2);
        if ((lx + wob) % 5 === 2 && hash(k * 7 + lx, Math.floor(y / 5), seed) > 0.3) c = C.woodD;
        // 위쪽은 햇빛에 바랬다
        if (y < peak + 5 && hash(x, y, seed + 1) < 0.35) c = C.woodL;
        if (lx === 1 && hash(x, y, seed + 2) < 0.5) c = C.woodL;
      }
      // 옹이: 가운데 어둡고 테두리 밝음, 결이 휘어 돈다
      if (hasKnot && lx > 0 && lx < pw - 2) {
        const d = Math.hypot((lx - knotX) / 2, (y - knotY) / 1.4);
        if (d < 1) c = C.woodD;
        else if (d < 1.6) c = C.woodL;
        else if (d < 2.6 && (lx + y) % 2 === 0) c = C.wood;
      }
      // 못 두 줄(뒤쪽 가로대 자리) + 못 아래 녹물
      for (const ny of [top + 9, bottom - 11]) {
        for (const nx of [3, pw - 5]) {
          if (lx === nx && y === ny) c = C.lint;
          else if (lx === nx && y === ny + 1) c = C.lav;
          else if (lx === nx && y > ny + 1 && y < ny + 4 && hash(k, nx, seed + 4) < 0.5) c = C.woodD;
        }
      }
      // 아래쪽 이끼·흙 튄 자국
      const m = (y - (bottom - 7)) / 7;
      if (m > 0 && hash(x, y, seed + 6) < m * 0.7) c = hash(x, y, seed + 7) < 0.5 ? C.grn : C.woodD;
      img.set(x, y, c);
    }
  }
}

// ───────────── 풀밭 ─────────────
/** 바닥 바탕: grnL 주색(걷는 바닥 명도 검사 기준), 아주 옅은 얼룩. */
export function grassBase(img, x0, y0, w, h, { shadeTop = 6 } = {}) {
  fill(img, x0, y0, w, h, (x, y) => {
    if (y < y0 + shadeTop) return bay(x, y, 0.75 - (y - y0) / (shadeTop * 1.6), C.grnL, C.grn); // 담장 밑 그늘
    const n = Math.sin(x / 17 + Math.sin(y / 5)) + Math.sin(y / 7 - x / 29);
    if (n > 1.35) return bay(x, y, 0.25, C.grnL, C.grnP); // 햇빛 받은 얼룩
    if (n < -1.45) return bay(x, y, 0.25, C.grnL, C.grn);
    return C.grnL;
  });
}

/** 풀 한 포기: 잎 3~5장. 빛 받는 왼쪽 잎 끝은 grnP, 몸통은 grn. */
export function tuft(img, x, y, r, size = 1) {
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const bx = x + i - (n >> 1);
    const hgt = 2 + Math.floor(r() * (2 + size));
    const lean = r() < 0.5 ? -1 : r() < 0.6 ? 1 : 0;
    for (let j = 0; j < hgt; j++) {
      const px = bx + (j >= hgt - 1 ? lean : 0);
      const tip = j === hgt - 1;
      img.set(px, y - j, tip && lean <= 0 ? C.grnP : C.grn);
    }
  }
}

export function daisy(img, x, y) {
  img.set(x, y - 1, C.white); img.set(x - 1, y, C.white); img.set(x + 1, y, C.cotton); img.set(x, y + 1, C.cotton);
  img.set(x, y, C.yel);
}

export function clover(img, x, y) {
  img.set(x, y, C.grnP); img.set(x - 1, y + 1, C.grnP); img.set(x + 1, y + 1, C.grn); img.set(x, y + 1, C.grn);
}

export function pebble(img, x, y, w = 3) {
  for (let i = 0; i < w; i++) { img.set(x + i, y, i === 0 ? C.cotton : C.lint); img.set(x + i, y + 1, i === w - 1 ? C.lav : C.lint); }
}
