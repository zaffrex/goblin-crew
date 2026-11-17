// HUD 아이콘 시트 만들기·검사·미리보기 (#255). art/build.mjs가 부른다.
// 출력: public/ui/hud-icons.png(20×20 칸 가로 한 줄) + hud-icons.json({ cell, icons: { id: 칸 번호 } }).
// 검사(어기면 오류): 칸 20×20, 채움이 1~18 안(외곽선 자리), 팔레트 글자만, 아이콘 id 중복 없음.

import { Image, EMPTY, C } from '../lib/pixel.mjs';
import { ICONS } from './hud-icons.mjs';

export const CELL = 20;
const BTN = 28;

function fail(msg) {
  throw new Error(`[art] HUD 아이콘 ${msg}`);
}

/** 문자 격자 → 20×20 Image. 채움 둘레에 1px ink 외곽선(4방향)을 붙인다. */
function drawIcon(def) {
  if (def.rows.length !== CELL) fail(`${def.id}: ${def.rows.length}행이다(${CELL}행이어야 한다)`);
  const img = new Image(CELL, CELL);
  def.rows.forEach((row, y) => {
    if (row.length !== CELL) fail(`${def.id} ${y}행: ${row.length}열이다(${CELL}열이어야 한다)`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const col = def.legend[ch];
      if (col === undefined) fail(`${def.id} (${x},${y}): legend에 없는 글자 '${ch}'`);
      if (x < 1 || y < 1 || x > CELL - 2 || y > CELL - 2) fail(`${def.id} (${x},${y}): 채움이 칸 가장자리에 있어 외곽선이 잘린다`);
      img.set(x, y, col);
    });
  });
  const add = [];
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++)
      if (img.get(x, y) === EMPTY && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => img.get(x + dx, y + dy) !== EMPTY)) add.push([x, y]);
  for (const [x, y] of add) img.set(x, y, C.ink);
  return img;
}

export function buildIcons() {
  const ids = ICONS.map((d) => d.id);
  if (new Set(ids).size !== ids.length) fail(`id가 겹친다: ${ids}`);
  const cells = ICONS.map(drawIcon);
  const sheet = new Image(CELL * cells.length, CELL);
  cells.forEach((c, i) => sheet.blit(c, i * CELL, 0));
  const meta = {
    '//': 'node art/build.mjs로 만든 파일. 직접 고치지 않는다. 원본: art/ui/hud-icons.mjs. 칸은 가로 한 줄, 버튼 28×28 가운데(4px 여백)에 그린다.',
    image: 'hud-icons.png',
    cell: [CELL, CELL],
    icons: Object.fromEntries(ids.map((id, i) => [id, i])),
  };
  return { cells, sheet, meta };
}

/** 흑백판: 팔레트 색을 밝기 순 회색 7단(ink~white)에 맞춘다. */
const GRAY = [C.ink, C.plum, C.dusk, C.lav, C.lint, C.cotton, C.white];
function luma(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 미리보기(배율 없이 만든 뒤 indexedPng 배율로 키운다). 버튼 모양은 src/engine/hud.ts와 같다.
 * 1행: 평소 버튼(plum 바탕 + dusk 테두리) / 2행: 무장 중(white 바탕 + ink 테두리, 아이콘 1px 아래) / 3행: 1행 흑백 / 4행: 실루엣(흰 바탕에 ink만).
 */
export function previewIcons(cells, hex) {
  const gap = 4;
  const n = cells.length;
  const W = gap + n * (BTN + gap);
  const H = gap + 4 * (BTN + gap);
  const img = new Image(W, H, C.lint);
  const grayOf = new Map();
  const L = GRAY.map((c) => luma(hex[c]));
  for (let c = 0; c < 32; c++) {
    const l = luma(hex[c]);
    let best = 0;
    L.forEach((g, i) => { if (Math.abs(g - l) < Math.abs(L[best] - l)) best = i; });
    grayOf.set(c, GRAY[best]);
  }
  for (let r = 0; r < 4; r++) {
    const y0 = gap + r * (BTN + gap);
    cells.forEach((cell, i) => {
      const x0 = gap + i * (BTN + gap);
      const armed = r === 1;
      const bg = armed ? C.white : C.plum, edge = armed ? C.ink : C.dusk;
      const box = new Image(BTN, BTN, edge);
      box.rect(1, 1, BTN - 2, BTN - 2, bg);
      if (r === 3) box.rect(1, 1, BTN - 2, BTN - 2, C.white); // 실루엣은 흰 바탕에 ink만
      box.blit(cell, 4, 4 + (armed ? 1 : 0), r === 3 ? { map: () => C.ink } : {});
      img.blit(box, x0, y0, r === 2 ? { map: (c) => grayOf.get(c) } : {});
    });
  }
  return img;
}
