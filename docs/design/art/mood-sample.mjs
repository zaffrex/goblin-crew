// 무드 샘플 생성기 (#7, ADR-0007). 외부 이미지 없이 코드로만 그린다.
// 실행: node docs/design/art/mood-sample.mjs
// 출력: 같은 폴더에 mood-1x.png(480×270, 인덱스 팔레트), mood-3x.png, mood-gray-3x.png, silhouettes-4x.png, characters-6x.png
// 이 파일은 빌드에 들어가지 않는 디자인 자료다. 실제 에셋 파이프라인은 M1에서 Theo와 정한다.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PALETTE = readFileSync(join(HERE, 'bosong-32.hex'), 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);

// 팔레트 인덱스 이름 (bosong-32.hex 순서와 같다)
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

const W = 480;
const H = 270;
const EMPTY = -1;

class Layer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Int16Array(w * h).fill(EMPTY);
    this.ox = 0;
    this.ax = Math.floor(w / 2); // 기준점 x (캐릭터는 다리 가운데로 덮어쓴다)
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
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n);
      const y = Math.round(y0 + ((y1 - y0) * s) / n);
      this.rect(x, y, t, t, c);
    }
  }
  // 채워진 픽셀 바깥 4방향 이웃에 1px 외곽선을 두른다 (상호작용 대상 전용 규칙).
  outline(c = C.ink) {
    const add = [];
    for (let y = -1; y <= this.h; y++)
      for (let x = -1; x <= this.w; x++) {
        if (this.get(x, y) !== EMPTY) continue;
        if (this.get(x + 1, y) !== EMPTY || this.get(x - 1, y) !== EMPTY || this.get(x, y + 1) !== EMPTY || this.get(x, y - 1) !== EMPTY)
          add.push([x, y]);
      }
    const grown = new Layer(this.w + 2, this.h + 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) grown.set(x + 1, y + 1, this.get(x, y));
    for (const [x, y] of add) grown.set(x + 1, y + 1, c);
    grown.ox = -1;
    grown.ax = this.ax + 1;
    return grown;
  }
  // 좌우 반전 (캐릭터는 오른쪽을 보는 그림 1벌만 그리고 뒤집는다).
  // 축은 그림 박스 가운데가 아니라 기준점 ax(다리 가운데)다. 그래야 돌아서도 다리가 제자리에 있다 (ADR-0007 결정 4).
  // 칸 크기는 그대로 두고 ax만 w - ax로 옮긴다: 그림 전체를 거울에 비춘 것과 같다.
  flip() {
    const f = new Layer(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) f.set(this.w - 1 - x, y, this.get(x, y));
    f.ox = this.ox;
    f.ax = this.w - this.ax;
    return f;
  }
  // 기준점으로 붙인다. ax = 다리 가운데(픽셀 경계), ay = 걷기 좌표 y. 발 맨 아랫줄은 ay - 1행에 그려진다.
  blitAnchor(dst, ax, ay) {
    this.blit(dst, ax - this.ax, ay - this.h);
  }
  blit(dst, x0, y0) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c !== EMPTY) dst.set(x0 + x, y0 + y, c);
      }
  }
  map(fn) {
    const m = new Layer(this.w, this.h);
    m.ox = this.ox;
    m.ax = this.ax;
    for (let i = 0; i < this.px.length; i++) m.px[i] = this.px[i] === EMPTY ? EMPTY : fn(this.px[i]);
    return m;
  }
}

// 4×4 Bayer 디더. 배경 그라데이션에만 쓴다 (캐릭터·오브젝트에는 쓰지 않는다).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x, y, t) => BAYER[(y & 3) * 4 + (x & 3)] / 16 < t;

// ───────────────────────── 캐릭터 ─────────────────────────
// 모두 오른쪽을 본다. 발끝이 오른쪽. 광원은 왼쪽 위.

function sock({ legW, legH, footW, footH, cuffH, base, shade, hi, cuff, cuffShade }) {
  const w = Math.max(legW, footW) + 1;
  const h = legH + footH;
  const L = new Layer(w, h);
  // 기준점 x = 다리 가운데. 다리 폭은 짝수여야 축이 픽셀 경계에 와서 반전해도 1px도 안 움직인다.
  if (legW % 2 !== 0) throw new Error(`legW ${legW}: 다리 폭은 짝수여야 한다`);
  L.ax = legW / 2;
  // 다리
  L.rect(0, 0, legW, legH + 2, base);
  // 발 (발끝은 둥글게)
  L.rect(0, legH, footW - footH / 2, footH, base);
  L.ellipse(footW - footH / 2 - 1, legH + footH / 2 - 0.5, footH / 2, footH / 2 - 0.01, base);
  // 뒤꿈치 둥글림
  L.set(0, h - 1, EMPTY);
  // 그림자: 오른쪽 가장자리와 발바닥
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (L.get(x, y) === EMPTY) continue;
      const rightEdge = L.get(x + 1, y) === EMPTY || L.get(x + 2, y) === EMPTY;
      const bottom = L.get(x, y + 1) === EMPTY;
      if (bottom || (rightEdge && y < legH)) L.set(x, y, shade);
    }
  // 하이라이트: 다리 왼쪽 1열
  for (let y = cuffH + 1; y < legH - 1; y++) L.set(1, y, hi);
  // 커프(목 부분)
  L.rect(0, 0, legW, cuffH, cuff);
  for (let x = 1; x < legW; x += 2) L.set(x, cuffH - 1, cuffShade);
  L.rect(legW - 1, 0, 1, cuffH, cuffShade);
  return L;
}

function eyes(L, x, y, { size = 2, gap = 2, pupil = 1, look = 1 }) {
  for (const ex of [x, x + size + gap]) {
    L.rect(ex, y, size, size + 1, C.white);
    L.rect(ex + size - pupil + (look > 0 ? 0 : -size + pupil), y + 1, pupil, pupil, C.ink);
  }
}

// 쭉이: 고무줄이 늘어난 줄무늬 니삭스. 키가 크고 가늘다. 목이 늘어나 물결친다.
function drawJjuk() {
  const L = sock({ legW: 10, legH: 32, footW: 17, footH: 8, cuffH: 4, base: C.red, shade: C.redD, hi: C.redL, cuff: C.cotton, cuffShade: C.lint });
  // 줄무늬: 3px 빨강 / 3px 크림 (몸통 타일 한 주기 = 6px, ADR-0003 늘이기 3조각과 맞춤)
  for (let y = 5; y < 34; y++) {
    if (Math.floor((y - 5) / 3) % 2 === 1) {
      for (let x = 0; x < L.w; x++) {
        const c = L.get(x, y);
        if (c === C.red) L.set(x, y, C.cotton);
        else if (c === C.redD) L.set(x, y, C.lint);
        else if (c === C.redL) L.set(x, y, C.white);
      }
    }
  }
  // 늘어난 목: 위 가장자리가 물결친다
  for (const x of [1, 2, 6, 7]) L.set(x, 0, EMPTY);
  L.set(-1 + 10, 1, C.lint);
  // 발끝·뒤꿈치 덧댐
  for (let y = 32; y < 40; y++) for (let x = 12; x < 18; x++) if (L.get(x, y) !== EMPTY) L.set(x, y, y === 39 || x >= 16 ? C.redD : C.red);
  // 눈은 빨간 줄(11~13행) 위에 둔다. 크림 줄 위의 흰 눈은 1배에서 사라진다
  eyes(L, 2, 11, { size: 2, gap: 2 });
  L.rect(4, 15, 2, 1, C.ink); // 입
  return L.outline();
}

// 묵직이: 발가락에 동전이 든 두꺼운 울 양말. 뭉툭하고 넓다. 졸린 눈.
function drawMukjik() {
  const L = sock({ legW: 20, legH: 16, footW: 27, footH: 12, cuffH: 5, base: C.teal, shade: C.tealD, hi: C.tealM, cuff: C.tealM, cuffShade: C.teal });
  // 울 골지: 커프에 세로 줄
  for (let x = 1; x < 20; x += 3) for (let y = 0; y < 5; y++) L.set(x, y, C.teal);
  // 발끝 덧댐 + 동전 불룩
  for (let y = 16; y < 28; y++) for (let x = 20; x < 28; x++) if (L.get(x, y) !== EMPTY) L.set(x, y, C.tealD);
  L.ellipse(23, 22, 3, 3, C.yelD);
  L.ellipse(23, 21.5, 2, 2, C.tan);
  L.set(22, 20, C.yelL);
  // 졸린 눈: 눈꺼풀이 반쯤 덮인다
  for (const ex of [6, 12]) {
    L.rect(ex, 8, 4, 2, C.white);
    L.rect(ex, 7, 4, 1, C.ink);
    L.rect(ex + 2, 9, 2, 1, C.ink);
  }
  L.rect(9, 13, 3, 1, C.tealD); // 무표정한 입
  return L.outline();
}

// 삑삑이: 뒤꿈치에 삑삑이 장난감이 박힌 아기 양말. 작고 동그랗다. 큰 눈.
function drawPpik() {
  const L = sock({ legW: 10, legH: 10, footW: 15, footH: 8, cuffH: 3, base: C.yel, shade: C.yelD, hi: C.yelL, cuff: C.pinkL, cuffShade: C.pink });
  // 프릴: 커프 위쪽이 톱니
  for (let x = 0; x < 10; x += 2) L.set(x, 0, EMPTY);
  // 뒤꿈치 장난감 (분홍 동그라미 + 숨구멍)
  L.ellipse(1.5, 14, 2.2, 2.2, C.pink);
  L.set(1, 13, C.white);
  // 큰 눈 + 볼터치
  for (const ex of [2, 6]) {
    L.rect(ex, 4, 3, 3, C.white);
    L.rect(ex + 1, 5, 2, 2, C.ink);
    L.set(ex + 1, 5, C.white);
  }
  L.set(1, 8, C.pink);
  L.set(9, 8, C.pink);
  L.rect(5, 8, 2, 1, C.ink);
  // 방울: 실루엣만으로도 묵직이(뭉툭한 사각)와 구별되게 머리 위에 털방울을 단다
  const P = new Layer(L.w, L.h + 5);
  L.blit(P, 0, 5);
  P.ax = L.ax;
  P.ellipse(4.5, 2.5, 2.6, 2.4, C.pinkL);
  P.set(4, 1, C.white);
  P.set(6, 4, C.pink);
  return P.outline();
}

// ───────────────────────── 상호작용 오브젝트 (외곽선 있음) ─────────────────────────

function drawSeesaw() {
  // 나무 자 + 실패
  const L = new Layer(78, 20);
  // 실패(실 감는 통)
  L.rect(32, 8, 14, 3, C.woodD);
  L.rect(34, 11, 10, 6, C.pur);
  for (let y = 11; y < 17; y += 2) L.rect(34, y, 10, 1, C.purL);
  L.rect(43, 11, 1, 6, C.purD);
  L.rect(32, 17, 14, 3, C.woodD);
  L.rect(33, 17, 12, 1, C.wood);
  // 자 판
  L.rect(0, 3, 78, 5, C.woodL);
  L.rect(0, 7, 78, 1, C.wood);
  L.rect(0, 3, 78, 1, C.tan);
  for (let x = 3; x < 76; x += 4) L.rect(x, 4, 1, x % 20 === 3 ? 3 : 2, C.woodD);
  return L.outline();
}

function drawButton() {
  // 단추 협곡의 거대한 단추. 반쯤 땅에 박혀 있다.
  const L = new Layer(44, 34);
  L.ellipse(21.5, 21, 21, 20, C.pur);
  L.ellipse(21.5, 21, 16, 15, C.purD);
  L.ellipse(20.5, 20, 15, 14, C.pur);
  L.ellipse(16, 12, 6, 3, C.purL);
  for (const [hx, hy] of [[16, 18], [27, 18], [16, 27], [27, 27]]) {
    L.ellipse(hx, hy, 2.6, 2.6, C.plum);
    L.set(hx - 1, hy - 1, C.purD);
  }
  // 아래쪽은 땅에 묻혀 잘린다
  for (let y = 31; y < 34; y++) for (let x = 0; x < 44; x++) L.set(x, y, EMPTY);
  return L.outline();
}

function drawHanger() {
  // 옷걸이 고리 (위에서 매달려 내려온다)
  const L = new Layer(60, 46);
  L.line(30, 0, 30, 10, C.lint, 2);
  L.line(30, 10, 34, 14, C.lint, 2);
  L.line(34, 14, 34, 18, C.lint, 2);
  L.line(33, 19, 30, 21, C.lint, 2);
  L.line(30, 21, 2, 40, C.lint, 2);
  L.line(30, 21, 57, 40, C.lint, 2);
  L.line(2, 40, 57, 40, C.lint, 2);
  L.line(31, 0, 31, 10, C.cotton, 1);
  L.line(4, 40, 30, 22, C.cotton, 1);
  return L.outline();
}

// ───────────────────────── 배경 (외곽선 없음, 낮은 대비) ─────────────────────────

function drawBackground(S) {
  // 하늘: 보풀나라의 라벤더 안개. 위 → 아래로 밝아진다.
  const bands = [C.lav, C.purL, C.lint, C.cotton];
  for (let y = 0; y < 196; y++) {
    const t = (y / 196) * (bands.length - 1);
    const i = Math.min(Math.floor(t), bands.length - 2);
    const f = t - i;
    for (let x = 0; x < W; x++) S.set(x, y, dither(x, y, f) ? bands[i + 1] : bands[i]);
  }
  // 멀리 보이는 건조기 문(우리가 떨어진 구멍)
  S.ellipse(70, 58, 42, 42, C.lint);
  S.ellipse(70, 58, 34, 34, C.lav);
  S.ellipse(70, 58, 30, 30, C.purL);
  for (let y = 28; y < 90; y++) for (let x = 40; x < 100; x++) if (S.get(x, y) === C.purL && dither(x, y, ((x - 40) / 60) * 0.6)) S.set(x, y, C.aqua);
  S.ellipse(58, 44, 8, 4, C.cotton);
  // 보풀 구름
  for (const [cx, cy, s] of [[210, 34, 1], [330, 60, 0.8], [430, 28, 1.1], [150, 96, 0.6]]) {
    S.ellipse(cx, cy, 26 * s, 9 * s, C.cotton);
    S.ellipse(cx - 14 * s, cy + 2, 14 * s, 8 * s, C.cotton);
    S.ellipse(cx + 16 * s, cy + 1, 15 * s, 7 * s, C.cotton);
    S.ellipse(cx + 2, cy - 5 * s, 12 * s, 7 * s, C.white);
    S.rect(cx - 30 * s, cy + 6 * s, 60 * s, 2, C.lint);
  }
  // 먼 언덕 (보풀 더미)
  for (let x = 0; x < W; x++) {
    const top = 168 + Math.round(8 * Math.sin(x / 37) + 5 * Math.sin(x / 13 + 1));
    for (let y = top; y < 196; y++) S.set(x, y, y < top + 2 ? C.lint : C.lav);
  }
  // 보풀 나무 (가운데 층)
  for (const [tx, s] of [[150, 1], [250, 0.8], [390, 1.15], [455, 0.7]]) {
    const ground = 192;
    S.rect(tx - 3 * s, ground - 50 * s, 6 * s, 50 * s, C.wood);
    S.rect(tx + 1 * s, ground - 50 * s, 2 * s, 50 * s, C.woodD);
    const cy = ground - 62 * s;
    S.ellipse(tx, cy + 4, 24 * s, 16 * s, C.grn);
    S.ellipse(tx - 12 * s, cy + 6, 13 * s, 10 * s, C.grn);
    S.ellipse(tx + 12 * s, cy + 8, 12 * s, 9 * s, C.grn);
    S.ellipse(tx - 4 * s, cy - 2, 18 * s, 12 * s, C.grnL);
    S.ellipse(tx - 9 * s, cy - 6, 8 * s, 5 * s, C.grnP);
  }
  // 바닥: 짜임 천 (걷는 영역 y 200~258 과 맞춘다).
  // 밝은 연두를 쓴다. 캐릭터 주색과 명도(Y) 차이 30 이상 규칙 (ADR-0007): 묵직이 teal Y86 vs 바닥 Y155
  for (let y = 192; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = C.grnL;
      if (y < 196) c = C.grnP;
      else if ((y - 196) % 8 === 0) c = C.grn;
      else if ((x + (Math.floor((y - 196) / 8) % 2) * 3) % 6 === 0 && (y - 196) % 8 === 4) c = C.grnP;
      if (y > 250 && dither(x, y, (y - 250) / 20)) c = C.grn;
      S.set(x, y, c);
    }
}

// ───────────────────────── UI (캔버스 픽셀 스프라이트) ─────────────────────────

function drawGauge(S, filled, total) {
  // 보송 게이지: 양말 모양 칸. 왼쪽 위.
  S.rect(4, 4, total * 14 + 6, 16, C.plum);
  S.rect(5, 5, total * 14 + 4, 14, C.dusk);
  for (let i = 0; i < total; i++) {
    const x = 8 + i * 14;
    const on = i < filled;
    const L = new Layer(10, 10);
    L.rect(0, 0, 6, 7, on ? C.tealL : C.plum);
    L.rect(0, 6, 9, 4, on ? C.tealL : C.plum);
    L.set(0, 9, EMPTY);
    if (on) {
      L.rect(0, 0, 6, 2, C.aqua);
      L.rect(5, 2, 1, 5, C.tealM);
    }
    L.outline().blit(S, x - 1, 6);
  }
}

function drawSelector(S, portraits, selected) {
  // 캐릭터 선택: 오른쪽 위 칸 3개. 칸마다 능력 아이콘.
  portraits.forEach((p, i) => {
    const x = 384 + i * 31;
    const y = 4;
    S.rect(x, y, 28, 28, i === selected ? C.yelL : C.plum);
    S.rect(x + 1, y + 1, 26, 26, C.dusk);
    // 얼굴만 잘라 보여 준다
    const crop = p.face;
    for (let j = 0; j < 20; j++) for (let k = 0; k < 20; k++) {
      const c = crop.layer.get(crop.x + k, crop.y + j);
      if (c !== EMPTY) S.set(x + 4 + k, y + 4 + j, c);
    }
    // 능력 아이콘 (7×7, 오른쪽 아래)
    S.rect(x + 18, y + 18, 9, 9, C.ink);
    const ix = x + 19;
    const iy = y + 19;
    if (p.icon === 'stretch') {
      S.line(ix + 3, iy, ix + 3, iy + 6, C.white);
      S.line(ix + 1, iy + 2, ix + 3, iy, C.white);
      S.line(ix + 5, iy + 2, ix + 3, iy, C.white);
      S.line(ix + 1, iy + 4, ix + 3, iy + 6, C.white);
      S.line(ix + 5, iy + 4, ix + 3, iy + 6, C.white);
    } else if (p.icon === 'stomp') {
      S.rect(ix + 1, iy + 2, 5, 4, C.white);
      S.rect(ix + 2, iy, 3, 2, C.white);
      S.rect(ix, iy + 6, 7, 1, C.white);
    } else {
      S.rect(ix, iy + 2, 2, 3, C.white);
      S.line(ix + 3, iy + 1, ix + 3, iy + 5, C.white);
      S.line(ix + 5, iy, ix + 5, iy + 6, C.white);
    }
  });
}

function drawBubble(S, x, y, w, h, tailX) {
  // 말풍선 틀만 캔버스에 그린다. 본문 글자는 DOM 오버레이 (ADR-0004 결정 3).
  S.rect(x + 1, y, w - 2, h, C.white);
  S.rect(x, y + 1, w, h - 2, C.white);
  S.rect(x + 1, y - 1, w - 2, 1, C.ink);
  S.rect(x + 1, y + h, w - 2, 1, C.ink);
  S.rect(x - 1, y + 1, 1, h - 2, C.ink);
  S.rect(x + w, y + 1, 1, h - 2, C.ink);
  S.set(x, y, C.ink);
  S.set(x + w - 1, y, C.ink);
  S.set(x, y + h - 1, C.ink);
  S.set(x + w - 1, y + h - 1, C.ink);
  // 꼬리: 아래로 4px 좁아지는 삼각형
  S.rect(tailX, y + h, 6, 1, C.white);
  for (let i = 0; i < 4; i++) {
    S.rect(tailX + i, y + h + i, 6 - i * 2 > 0 ? 6 - i * 2 : 1, 1, C.white);
    S.set(tailX + i - 1, y + h + i, C.ink);
    S.set(tailX + Math.max(6 - i * 2, 1) + i, y + h + i, C.ink);
  }
  S.set(tailX - 1, y + h, C.ink);
  S.rect(tailX + 3, y + h + 4, 1, 1, C.ink);
  // 자리표시: 회색 줄 2개 (실제 글자는 DOM이 그 위에 얹는다)
  S.rect(x + 6, y + 6, w - 12, 2, C.lint);
  S.rect(x + 6, y + 12, Math.round((w - 12) * 0.6), 2, C.lint);
}

function drawCursor(S, x, y) {
  const shape = [
    'k.........',
    'kk........',
    'kwk.......',
    'kwwk......',
    'kwwwk.....',
    'kwwwwk....',
    'kwwwwwk...',
    'kwwwwwwk..',
    'kwwwkkkk..',
    'kwkwk.....',
    'kk.kwk....',
    '....kk....',
  ];
  shape.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === 'k') S.set(x + i, y + j, C.ink);
    if (ch === 'w') S.set(x + i, y + j, C.white);
  }));
}

// 호버한 대상: 가장 바깥 불투명 픽셀(투명과 4방향으로 맞닿은 픽셀)만 힌트색으로 바꾼다.
// 색(0번 ink)이 아니라 위치로 고르므로 눈동자·입 같은 안쪽 ink는 그대로 남는다 (ADR-0007 결정 2).
const highlight = (L) => {
  const m = L.map((c) => c);
  for (let y = 0; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      if (L.get(x, y) === EMPTY) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => L.get(x + dx, y + dy) === EMPTY)) m.set(x, y, C.hint);
    }
  return m;
};

// ───────────────────────── 장면 조립 ─────────────────────────

const jjuk = drawJjuk();
const mukjik = drawMukjik();
const ppik = drawPpik();

const scene = new Layer(W, H);
drawBackground(scene);
drawHanger().blit(scene, 270, 0);
drawSeesaw().blit(scene, 160, 200);
highlight(drawButton()).blit(scene, 392, 186);
// 그림자 (바닥 위 납작한 타원)
for (const [x, w] of [[96, 12], [134, 16], [70, 9]]) scene.ellipse(x, 233, w, 2, C.grn);
jjuk.blitAnchor(scene, 92, 234);
mukjik.blitAnchor(scene, 130, 234);
ppik.flip().blitAnchor(scene, 73, 234);
drawGauge(scene, 4, 5);
drawSelector(scene, [
  { face: { layer: jjuk, x: 0, y: 2 }, icon: 'stretch' },
  { face: { layer: mukjik, x: 1, y: 2 }, icon: 'stomp' },
  { face: { layer: ppik, x: 0, y: 1 }, icon: 'squeak' },
], 0);
drawBubble(scene, 40, 150, 80, 20, 64);
drawCursor(scene, 418, 206);

// 실루엣 비교: 색을 빼고 실제 크기에서 셋이 구별되는지 (ADR-0003 통과 조건)
const sil = new Layer(120, 50);
sil.rect(0, 0, 120, 50, C.cotton);
const ink = (L) => L.map(() => C.ink);
ink(jjuk).blitAnchor(sil, 18, 47);
ink(mukjik).blitAnchor(sil, 58, 47);
ink(ppik).blitAnchor(sil, 97, 47);

// ───────────────────────── PNG 저장 ─────────────────────────

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
function png(layer, scale = 1, gray = false) {
  const w = layer.w * scale;
  const h = layer.h * scale;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = layer.get(Math.floor(x / scale), Math.floor(y / scale));
      raw[y * (w + 1) + 1 + x] = c === EMPTY ? 0 : c;
    }
  }
  const pal = PALETTE.map(([r, g, b]) => {
    if (!gray) return [r, g, b];
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return [l, l, l];
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // 인덱스 컬러
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(pal.flat())),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 캐릭터 확대 비교 (색 있음): 리뷰용
const lineup = new Layer(120, 50);
lineup.rect(0, 0, 120, 50, C.cotton);
jjuk.blitAnchor(lineup, 18, 47);
mukjik.blitAnchor(lineup, 58, 47);
ppik.blitAnchor(lineup, 97, 47);

writeFileSync(join(HERE, 'characters-6x.png'), png(lineup, 6));
writeFileSync(join(HERE, 'mood-1x.png'), png(scene, 1));
writeFileSync(join(HERE, 'mood-3x.png'), png(scene, 3));
writeFileSync(join(HERE, 'mood-gray-3x.png'), png(scene, 3, true));
writeFileSync(join(HERE, 'silhouettes-4x.png'), png(sil, 4));

const used = new Set(scene.px);
console.log(`mood-1x.png ${W}x${H}, 사용 색 ${used.size}/32`);
console.log(`쭉이 ${jjuk.w}x${jjuk.h} anchorX ${jjuk.ax}, 묵직이 ${mukjik.w}x${mukjik.h} anchorX ${mukjik.ax}, 삑삑이 ${ppik.w}x${ppik.h} anchorX ${ppik.ax} (외곽선 포함, 그림 왼쪽 끝 기준)`);
// 돌아설 때 다리가 움직이는 거리: 기준점 축으로 뒤집으면 0이어야 한다. row = 다리만 있는 행(외곽선 포함 좌표).
const legOffset = (layer, row) => {
  const xs = [];
  for (let x = 0; x < layer.w; x++) if (layer.get(x, row) !== EMPTY) xs.push(x);
  return (xs[0] + xs[xs.length - 1] + 1) / 2 - layer.ax;
};
for (const [n, L, row] of [['쭉이', jjuk, 2], ['묵직이', mukjik, 2], ['삑삑이', ppik, 7]])
  console.log(`${n} 다리 가운데 - 기준점: 오른쪽 ${legOffset(L, row)}, 왼쪽(반전) ${legOffset(L.flip(), row)}`);

