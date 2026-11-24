// 타이틀 로고 원본 (#792, 자리: docs/design/title-and-map.md 2절 표, 5절 "로고 그림은 Luna 다음 PR").
// 일본어 제목 「せんたくもの大脱走」(300×36 자리)과 영어 부제 `Laundry Runaways`(160×14 자리) 두 칸이다.
// 정식 이름 결정 기록(docs/decisions/2026-11-22-official-title-laundry-runaways.md)의 우려대로 둥근 손글씨 꼴은 피한다:
// 획은 꺾인 직선(폴리라인)을 2px 네모 붓으로 찍는다. 곡선 대신 모서리가 있어서 그림책 글씨가 아니라 간판 글씨로 읽힌다.
// 글자는 빨랫줄에 빨래집게로 매달려 있다(빨래가 도망치는 게임이라). 글자마다 아래로 0~2px 흔들려 매달린 무게가 보인다.
// 외부 글꼴을 쓰지 않는다. 글자 획 좌표는 전부 여기서 새로 정했다(IP 가드레일, 라이선스 기록 대상 아님).

import { Image, EMPTY, C } from '../lib/pixel.mjs';

/** 붓 크기(px). 1배 휴대폰(약 1.76배)에서 획이 3.5 CSS px라 글자가 뭉개지지 않는다. */
const BRUSH = 2;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * 일본어 글자 획. size = 속 칸 크기(정사각), 좌표 = 붓 왼쪽 위(0 ~ size - BRUSH), drop = 빨랫줄에서 더 처진 px.
 * 가나 22px, 한자 26px: 한자를 크게 해서 「大脱走」가 제목의 박자(せんたくもの / 大脱走)로 읽힌다.
 */
export const JA = [
  { ch: 'せ', size: 22, drop: 1, strokes: [
    [[0, 8], [20, 6]],
    [[14, 1], [14, 12], [11, 14]],
    [[5, 1], [5, 17], [7, 20], [20, 20]],
  ] },
  { ch: 'ん', size: 22, drop: 0, strokes: [
    [[11, 0], [2, 20]],
    [[5, 14], [8, 10], [11, 10], [12, 13], [12, 18], [14, 20], [17, 20], [20, 16]],
  ] },
  { ch: 'た', size: 22, drop: 2, strokes: [
    [[0, 5], [12, 4]],
    [[7, 0], [2, 20]],
    [[11, 10], [19, 9]],
    [[11, 15], [11, 18], [13, 20], [20, 20]],
  ] },
  { ch: 'く', size: 22, drop: 0, strokes: [
    [[15, 0], [5, 10], [15, 20]],
  ] },
  { ch: 'も', size: 22, drop: 1, strokes: [
    [[8, 0], [6, 15], [8, 20], [14, 20], [17, 17], [17, 13]],
    [[1, 6], [17, 6]],
    [[1, 12], [15, 12]],
  ] },
  { ch: 'の', size: 22, drop: 2, strokes: [
    [[11, 4], [10, 12], [6, 19], [3, 19], [1, 14], [2, 8], [6, 3], [11, 1], [16, 2], [20, 7], [20, 13], [17, 18], [12, 20]],
  ] },
  { ch: '大', size: 26, drop: 0, gapBefore: 4, strokes: [
    [[1, 8], [23, 8]],
    [[12, 0], [12, 10], [1, 24]],
    [[13, 11], [24, 24]],
  ] },
  { ch: '脱', size: 26, drop: 1, strokes: [
    [[1, 1], [1, 20], [0, 24]],
    [[1, 1], [9, 1], [9, 24], [7, 24]],
    [[1, 8], [9, 8]],
    [[1, 15], [9, 15]],
    [[14, 0], [16, 4]],
    [[23, 0], [21, 4]],
    [[13, 6], [23, 6], [23, 13], [13, 13], [13, 6]],
    [[16, 13], [16, 18], [12, 24]],
    [[20, 13], [20, 22], [22, 24], [24, 24], [24, 21]],
  ] },
  { ch: '走', size: 26, drop: 0, strokes: [
    [[4, 4], [20, 4]],
    [[12, 0], [12, 11]],
    [[1, 11], [23, 11]],
    [[12, 11], [12, 20]],
    [[12, 15], [19, 15]],
    [[6, 14], [6, 20], [2, 24]],
    [[4, 21], [10, 23], [24, 24]],
  ] },
];

/** 영어 부제 글자: 속만 '#'. 9행(위 7행 + 내림 2행). 외곽선은 build가 붙인다. */
export const EN = {
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####', '.....', '.....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#', '.....', '.....'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####', '.....', '.....'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#', '.....', '.....'],
  n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#', '.....', '.....'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####', '.....', '.....'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....', '.....', '.....'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#', '....#', '####.'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.', '.....', '.....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.', '.....', '.....'],
};
export const EN_TEXT = 'Laundry Runaways';

/** 문서 2절 자리(내부 px). 로고 칸은 이 크기를 넘으면 안 된다. */
export const SLOT = { ja: { w: 300, h: 36 }, en: { w: 160, h: 14 } };

const LINE_Y = 3; // 빨랫줄 높이(칸 안 y)
const HANG_Y = 7; // 처짐 0인 글자 속의 맨 윗줄
const GAP = 4; // 글자 속 사이(외곽선·그림자 포함하면 1px 남는다)

function fail(msg) {
  throw new Error(`[art] 타이틀 로고 ${msg}`);
}

/** 폴리라인을 BRUSH×BRUSH 붓으로 찍은 속 마스크 */
function strokeMask(size, strokes) {
  const m = new Uint8Array(size * size);
  const stamp = (x, y) => {
    for (let j = 0; j < BRUSH; j++)
      for (let i = 0; i < BRUSH; i++) {
        const px = x + i, py = y + j;
        if (px < 0 || py < 0 || px >= size || py >= size) fail(`붓이 칸 밖이다 (${px}, ${py}) / ${size}`);
        m[py * size + px] = 1;
      }
  };
  for (const pts of strokes)
    for (let k = 1; k < pts.length; k++) {
      let [x0, y0] = pts[k - 1];
      const [x1, y1] = pts[k];
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        stamp(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  return m;
}

/**
 * 속 마스크 → 칠한 글자. 속 = yel, 속의 윗가장자리 = yelL(빛), 아랫가장자리 = yelD(그늘),
 * 아래·오른쪽 1px 그림자 = plum, 그 바깥 8방향 1px = ink. 어두운 타이틀 배경(ink 55% 덮개)에서도, 밝은 하늘에서도 테두리로 읽힌다.
 */
function paintGlyph(img, ox, oy, size, mask) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < size && y < size && mask[y * size + x] === 1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!inside(x, y)) continue;
      const col = !inside(x, y - 1) ? C.yelL : !inside(x, y + 1) ? C.yelD : C.yel;
      img.set(ox + x, oy + y, col);
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (inside(x, y) && img.get(ox + x + 1, oy + y + 1) === EMPTY) img.set(ox + x + 1, oy + y + 1, C.plum);
}

function outlineAll(img) {
  const add = [];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.get(x, y) === EMPTY && N8.some(([dx, dy]) => { const c = img.get(x + dx, y + dy); return c !== EMPTY && c !== C.ink; }))
        add.push([x, y]);
  for (const [x, y] of add) img.set(x, y, C.ink);
}

/** 빨래집게: 3×5, 나무색. 줄을 가운데에 문다. */
function pin(img, cx, yTop) {
  const rows = ['.o.', 'oWo', 'oWo', 'oWo', 'oDo'];
  const col = { o: C.ink, W: C.woodL, D: C.wood };
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col[ch] !== undefined) img.set(cx - 1 + x, yTop + y, col[ch]); }));
}

export function buildJa() {
  for (const g of JA) if (g.size % 1 || g.size < BRUSH) fail(`${g.ch}: 칸 크기 ${g.size}`);
  const inner = JA.reduce((s, g, i) => s + g.size + (i ? GAP + (g.gapBefore ?? 0) : 0), 0);
  const w = inner + 4; // 왼쪽 외곽선 1 + 오른쪽 그림자 1 + 외곽선 1, 여유 1
  if (w > SLOT.ja.w) fail(`일본어 칸 폭 ${w} > ${SLOT.ja.w}`);
  const img = new Image(w, SLOT.ja.h);
  // 글자 먼저, 외곽선, 그다음 줄과 집게(줄은 글자 뒤로 지나가고 집게는 위에 얹힌다)
  let x = 1;
  const pins = [];
  for (const [i, g] of JA.entries()) {
    if (i) x += GAP + (g.gapBefore ?? 0);
    const y = HANG_Y + g.drop;
    if (y + g.size + 2 > SLOT.ja.h) fail(`${g.ch}: 아래로 칸 밖`);
    paintGlyph(img, x, y, g.size, strokeMask(g.size, g.strokes));
    // 집게 자리: 글자 속 맨 윗줄 중 가운데에 가장 가까운 칠한 칸
    const mask = strokeMask(g.size, g.strokes);
    let top = Infinity, best = null;
    for (let yy = 0; yy < g.size && best === null; yy++)
      for (let xx = 0; xx < g.size; xx++)
        if (mask[yy * g.size + xx] && (best === null || Math.abs(xx - g.size / 2) < Math.abs(best - g.size / 2))) { best = xx; top = yy; }
    pins.push({ cx: x + best, glyphTop: y + top });
    x += g.size;
  }
  outlineAll(img);
  // 빨랫줄: 1px 실 + 아래 1px 그늘. 집게 사이에서 1px 처진다.
  for (let xx = 0; xx < img.w; xx++) {
    const sag = pins.some((p, k) => k && xx > pins[k - 1].cx + 3 && xx < p.cx - 3) ? 1 : 0;
    if (img.get(xx, LINE_Y + sag) === EMPTY) img.set(xx, LINE_Y + sag, C.lint);
    if (img.get(xx, LINE_Y + sag + 1) === EMPTY) img.set(xx, LINE_Y + sag + 1, C.dusk);
  }
  for (const p of pins) pin(img, p.cx, Math.min(LINE_Y - 1, p.glyphTop - 5));
  return trimBottom(img);
}

export function buildEn() {
  const chars = [...EN_TEXT];
  const SP = 3, LGAP = 2; // 글자 사이 2px ≈ 문서의 0.1em
  let w = 0;
  chars.forEach((ch, i) => { w += (ch === ' ' ? SP : (EN[ch] ?? fail(`영어 '${ch}' 글자가 없다`))[0].length) + (i ? LGAP : 0); });
  const h = EN.L.length;
  const img = new Image(w + 2, h + 2);
  let x = 1;
  for (const [i, ch] of chars.entries()) {
    if (i) x += LGAP;
    if (ch === ' ') { x += SP; continue; }
    const rows = EN[ch];
    if (rows.length !== h || rows.some((r) => r.length !== rows[0].length || /[^#.]/.test(r))) fail(`영어 '${ch}' 격자 모양`);
    rows.forEach((r, y) => [...r].forEach((c, xx) => { if (c === '#') img.set(x + xx, 1 + y, C.cotton); }));
    x += rows[0].length;
  }
  outlineAll(img);
  if (img.w > SLOT.en.w || img.h > SLOT.en.h) fail(`영어 칸 ${img.w}×${img.h} > ${SLOT.en.w}×${SLOT.en.h}`);
  return img;
}

function trimBottom(img) {
  let last = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.get(x, y) !== EMPTY) last = y;
  const out = new Image(img.w, last + 1);
  out.blit(img, 0, 0);
  return out;
}

/** 시트: 가로 한 줄 [ja | en], 위 맞춤. 메타는 칸 자리와 문서 자리 안에서 가운데 놓을 때 쓰는 크기. */
export function buildTitleLogo() {
  const ja = buildJa();
  const en = buildEn();
  const sheet = new Image(ja.w + en.w, Math.max(ja.h, en.h));
  sheet.blit(ja, 0, 0);
  sheet.blit(en, ja.w, 0);
  for (const c of sheet.c) if (c !== EMPTY && (c < 0 || c > 31)) fail(`팔레트 밖 색 ${c}`);
  const meta = {
    '//': 'node art/build.mjs로 만든 파일. 직접 고치지 않는다. 원본: art/ui/title-logo.mjs. 칸을 docs/design/title-and-map.md 2절 자리(ja 300×36, en 160×14) 가운데에 1배로 놓는다.',
    image: 'title-logo.png',
    cells: { ja: [0, 0, ja.w, ja.h], en: [ja.w, 0, en.w, en.h] },
  };
  return { ja, en, sheet, meta };
}

/** 미리보기: 행 = 바탕(타이틀 덮개에 가까운 plum / ink / 밝은 하늘 tealL), 실제 자리 간격(ja y 46, en y 88)으로 480 폭 가운데. */
export function previewTitleLogo({ ja, en }) {
  const BG = [C.plum, C.ink, C.tealL];
  const rowH = 70;
  const img = new Image(480, rowH * BG.length);
  BG.forEach((bg, r) => {
    img.rect(0, r * rowH, 480, rowH, bg);
    const y0 = r * rowH + 4;
    img.blit(ja, 90 + Math.floor((300 - ja.w) / 2), y0 + Math.floor((36 - ja.h) / 2));
    img.blit(en, 160 + Math.floor((160 - en.w) / 2), y0 + 42 + Math.floor((14 - en.h) / 2));
  });
  return img;
}
