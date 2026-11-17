// 소리 글자 시트 만들기·검사·미리보기 (#284). art/build.mjs가 부른다.
// 출력: public/ui/fx-text.png(칸 가로 한 줄, 위 맞춤) + fx-text.json({ anchor, cells: { fx 이름: [x, y, w, h] } }).
// 칸 = 단어 속 + 사방 외곽선 1px. 기준점은 칸의 아래 가운데(floor(w/2), h)다. 엔진은 대상 위치에 이 점을 맞춘다.
// 검사(어기면 오류): 글자 행 수 = 크기, 행 길이 같음, 없는 글자 없음, fx 이름 중복 없음, 팔레트 색만.

import { Image, EMPTY, C } from '../lib/pixel.mjs';
import { GLYPHS, WORDS, PARTS } from './fx-text.mjs';

const GAP = 1;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function fail(msg) {
  throw new Error(`[art] 소리 글자 ${msg}`);
}

function checkRows(name, rows, h) {
  if (rows.length !== h) fail(`${name}: ${rows.length}행이다(${h}행이어야 한다)`);
  const w = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== w) fail(`${name} ${y}행: ${r.length}열이다(${w}열이어야 한다)`);
    if (/[^#.]/.test(r)) fail(`${name} ${y}행: '#'와 '.'만 쓴다`);
  });
  return w;
}

/** 속 격자(여러 개를 가로로 이어 붙임) → 외곽선 1px을 두른 Image */
function outlined(pieces, h, color) {
  const w = pieces.reduce((s, p, i) => s + p[0].length + (i ? GAP : 0), 0);
  const img = new Image(w + 2, h + 2);
  let x0 = 1;
  for (const rows of pieces) {
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') img.set(x0 + x, 1 + y, color); }));
    x0 += rows[0].length + GAP;
  }
  const add = [];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.get(x, y) === EMPTY && N8.some(([dx, dy]) => img.get(x + dx, y + dy) !== EMPTY)) add.push([x, y]);
  for (const [x, y] of add) img.set(x, y, C.ink);
  return img;
}

export function buildFxText() {
  for (const [size, set] of Object.entries(GLYPHS))
    for (const [ch, rows] of Object.entries(set)) checkRows(`${size}px '${ch}'`, rows, Number(size));
  const names = [...WORDS.map((w) => w.fx), ...PARTS.map((p) => p.id)];
  if (new Set(names).size !== names.length) fail(`이름이 겹친다: ${names}`);
  const items = [
    ...WORDS.map((w) => {
      const set = GLYPHS[w.size];
      if (!set) fail(`${w.fx}: ${w.size}px 글자가 없다`);
      const pieces = [...w.text].map((ch) => set[ch] ?? fail(`${w.fx}: ${w.size}px '${ch}' 글자가 없다`));
      return { name: w.fx, img: outlined(pieces, w.size, w.color) };
    }),
    ...PARTS.map((p) => {
      checkRows(p.id, p.rows, p.rows.length);
      return { name: p.id, img: outlined([p.rows], p.rows.length, p.color) };
    }),
  ];
  for (const it of items) for (const c of it.img.c) if (c !== EMPTY && (c < 0 || c > 31)) fail(`${it.name}: 팔레트 밖 색 ${c}`);
  const W = items.reduce((s, it) => s + it.img.w, 0);
  const H = Math.max(...items.map((it) => it.img.h));
  const sheet = new Image(W, H);
  const cells = {};
  let x = 0;
  for (const it of items) {
    sheet.blit(it.img, x, 0);
    cells[it.name] = [x, 0, it.img.w, it.img.h];
    x += it.img.w;
  }
  const meta = {
    '//': 'node art/build.mjs로 만든 파일. 직접 고치지 않는다. 원본: art/ui/fx-text.mjs. 칸 = 글자 속 + 외곽선 1px. 기준점은 칸 아래 가운데 (floor(w/2), h). ting_spark는 fx가 아니라 キン 옆에 찍는 반짝 부품이다.',
    image: 'fx-text.png',
    anchor: 'bottom-center',
    cells,
  };
  return { items, sheet, meta };
}

/**
 * 미리보기(배율 없이 만든 뒤 indexedPng 배율로 키운다). 행 = 바탕(하늘 tealL / 흙벽 tan / 그늘 plum / 흰 빨래 white),
 * 열 = 칸. 실제 화면에서 어떤 바탕 위에 떠도 외곽선으로 읽히는지 본다.
 */
export function previewFxText(items) {
  const BG = [C.tealL, C.tan, C.plum, C.white];
  const pad = 3;
  const W = pad + items.reduce((s, it) => s + it.img.w + pad, 0);
  const rowH = Math.max(...items.map((it) => it.img.h)) + pad * 2;
  const img = new Image(W, rowH * BG.length);
  BG.forEach((bg, r) => {
    img.rect(0, r * rowH, W, rowH, bg);
    let x = pad;
    for (const it of items) {
      img.blit(it.img, x, r * rowH + rowH - pad - it.img.h);
      x += it.img.w + pad;
    }
  });
  return img;
}
