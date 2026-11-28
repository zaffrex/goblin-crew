// 성질 효과 시트 (#1053, ADR-1031 5절 "공통 한 번만", 특기 성질 표 #1052 5·7절). art/build.mjs가 부른다.
// 성질(젖음·따뜻함·반짝)은 물건마다 상태 그림을 그리지 않고 이 효과를 물건 위에 얹는다. 바람(`sound.puff`)은 부는 쪽에서 나간다.
// 출력: public/ui/prop-fx.png(칸 가로 한 줄, 위 맞춤) + prop-fx.json({ anims: { 이름: { frames, ms, loop, anchor, pin } } }).
//   frames = 칸마다 [x, y, w, h], anchor = 칸 안 기준점, pin = 기준점을 붙일 물건 상자 자리.
//     'bottom'    상자 아래 가운데(젖음: 위 4행은 물건 아래쪽에 겹치고 그 아래로 물이 듣는다)
//     'top'       상자 위 가운데(김이 물건 위로 오른다)
//     'top-right' 상자 오른쪽 위 꼭짓점(반짝 별 가운데)
//     'source'    부는 사람 쪽 시작점(삑삑이 부리). 칸은 오른쪽으로 부는 모양이고, 왼쪽으로 불면 anchor x 경계로 뒤집는다.
// 효과라 외곽선 없음(ADR-0007 결정 3-1: 검은 테두리 = 만질 수 있음).
// 색은 두 단으로 짝을 지어 빨래방 명도 띠 네 개(dusk 87 / cotton 222 / plum 54 / woodL 149) 어디서나 한 단은 30 이상 차가 난다
// (띠 결정 2026-11-23, tests/art/prop-fx.test.ts가 지킨다).
//   젖음 = 기존 `drops`와 같은 tealM·tealL·white(물 = 청록, 화면 사이 같음)
//   따뜻함 = pink·pinkL 김(빨래방 `duct.warm_puff` 따뜻한 바람이 pink 물결이라 "따뜻함 = pink"를 맞춘다)
//   반짝 = 둥지 열쇠 별 모양 + 끝을 yelD로(밝은 벽 cotton 위에서 yel·yelL만으로는 14~15 차라 안 보인다)
//   바람 = 화면 1 내복 `gust`의 곧은 선 + 끝 1px 꺾임, white 위 줄 + lint 아래 줄(김 = 물결과 곧은 선으로 갈린다)

import { Image, C } from '../lib/pixel.mjs';
import { stamp } from '../lib/texture.mjs';

function fail(msg) {
  throw new Error(`[art] 성질 효과 ${msg}`);
}

/** 물방울 3×3(왼쪽이 반짝) — art/lib/fx.mjs `drops` 크기 2와 같은 모양 */
const DROP = ['.L.', 'WLM', '.M.'];
/** 매달린 방울 1×2 — `drops` 크기 1 */
const DRIP = ['L', 'M'];
const WATER = { W: C.white, L: C.tealL, M: C.tealM };

/** 젖음: 물건 아래쪽에 맺힌 방울(두 칸 그대로) + 아래로 듣는 방울(0 매달림 → 1 떨어짐). 20×12, 4행 = 상자 아래 끝 */
function wet(k) {
  const img = new Image(20, 12);
  for (const [x, y] of [[2, 0], [13, 0], [7, 2]]) stamp(img, x, y, DROP, WATER);
  if (k === 0) {
    stamp(img, 3, 4, DRIP, WATER);
    stamp(img, 14, 4, DRIP, WATER);
  } else {
    stamp(img, 3, 8, DRIP, WATER);
    stamp(img, 14, 7, DRIP, WATER);
    stamp(img, 8, 5, DRIP, WATER); // 가운데 방울이 새로 맺힘
    img.set(2, 11, C.tealM); img.set(4, 11, C.tealL); // 튐
  }
  return img;
}

/** 김 한 줄기: 2px 획(왼쪽 pinkL, 오른쪽 pink), 아래에서 위로 흔들리며 오르고 맨 위 1행은 한 점으로 옅어진다 */
const SWAY = [0, 0, 1, 1, 0, 0, -1, -1];
function wisp(img, x0, top, bottom, phase) {
  for (let y = bottom; y >= top; y--) {
    const x = x0 + SWAY[(y + phase) % SWAY.length];
    if (y === top) { img.set(x + 1, y, C.pink); continue; }
    img.set(x, y, C.pinkL);
    img.set(x + 1, y, C.pink);
  }
}

/** 따뜻함: 김 두 줄기 + 짧은 한 줄기. k마다 물결 위상이 바뀌고 1px 올라간다. 16×14, 기준 = 아래 가운데 */
function warm(k) {
  const img = new Image(16, 14);
  const ph = k * 2;
  wisp(img, 3, 2 - k, 11 - k, ph);
  wisp(img, 10, 2 - k, 10 - k, ph + 3);
  wisp(img, 7, 6 - k, 12 - k, ph + 5);
  return img;
}

/** 반짝: 0 작은 별(5×5) → 1 큰 별(7×7). 9×9, 기준 = 가운데 */
function shine(k) {
  const img = new Image(9, 9);
  const legend = { d: C.yelD, y: C.yel, W: C.white };
  if (k === 0) stamp(img, 2, 2, ['..d..', '..y..', 'dyWyd', '..y..', '..d..'], legend);
  else stamp(img, 1, 1, ['...d...', '...y...', '..dWd..', 'dyWWWyd', '..dWd..', '...y...', '...d...'], legend);
  return img;
}

/** 바람 줄 하나: 위 white + 아래 lint 두 줄 선, 끝은 1px 위로 꺾인다(화면 1 `gust` 문법) */
function gustLine(img, x, y, len) {
  for (let i = 0; i < len; i++) { img.set(x + i, y, C.white); img.set(x + i, y + 1, C.lint); }
  img.set(x + len, y - 1, C.white);
  img.set(x + len, y, C.lint);
}

/** 바람(`sound.puff`): 0 훅(짧은 선 2) → 1 퍼짐(긴 선 3). 24×12, 기준 = 왼쪽 가운데(부리), 오른쪽으로 분다 */
function wind(k) {
  const img = new Image(24, 12);
  if (k === 0) {
    gustLine(img, 1, 4, 5);
    gustLine(img, 2, 7, 4);
  } else {
    gustLine(img, 5, 2, 12);
    gustLine(img, 3, 5, 17);
    gustLine(img, 6, 9, 11);
  }
  return img;
}

/** 이름 → 칸 그리기·재생·기준. 새 칸 합 8(ADR-1031 5절 6 + 바람 2, #1052 리뷰). */
export const PROP_FX = [
  { name: 'wet', draw: wet, ms: [600, 300], loop: true, anchor: [10, 4], pin: 'bottom', property: '젖음 ぬれた' },
  { name: 'warm', draw: warm, ms: [360, 360], loop: true, anchor: [8, 14], pin: 'top', property: '따뜻함 あったかい' },
  { name: 'shine', draw: shine, ms: [900, 220], loop: true, anchor: [4, 4], pin: 'top-right', property: '반짝 ピカピカ' },
  { name: 'wind', draw: wind, ms: [100, 260], loop: false, anchor: [0, 6], pin: 'source', property: 'sound.puff 바람' },
];

const ALLOWED = new Set([C.white, C.lint, C.tealL, C.tealM, C.pink, C.pinkL, C.yelD, C.yel]);

export function buildPropFx() {
  const items = [];
  for (const fx of PROP_FX) {
    if (fx.ms.length !== 2) fail(`${fx.name}: 칸은 2칸이다`);
    fx.ms.forEach((_, k) => {
      const img = fx.draw(k);
      let n = 0;
      for (const c of img.c) {
        if (c === -1) continue;
        n++;
        if (!ALLOWED.has(c)) fail(`${fx.name} ${k}: 효과에 안 쓰는 색 ${c}(ink 외곽선 금지)`);
      }
      if (!n) fail(`${fx.name} ${k}: 빈 칸`);
      const [ax, ay] = fx.anchor;
      if (ax < 0 || ay < 0 || ax > img.w || ay > img.h) fail(`${fx.name}: anchor가 칸 밖`);
      items.push({ name: fx.name, k, img });
    });
  }
  const W = items.reduce((s, it) => s + it.img.w, 0);
  const H = Math.max(...items.map((it) => it.img.h));
  const sheet = new Image(W, H);
  const anims = {};
  let x = 0;
  for (const it of items) {
    sheet.blit(it.img, x, 0);
    const fx = PROP_FX.find((f) => f.name === it.name);
    anims[it.name] ??= { frames: [], ms: fx.ms, loop: fx.loop, anchor: fx.anchor, pin: fx.pin };
    anims[it.name].frames.push([x, 0, it.img.w, it.img.h]);
    x += it.img.w;
  }
  const meta = {
    '//': 'node art/build.mjs로 만든 파일. 직접 고치지 않는다. 원본: art/ui/prop-fx.mjs(pin 뜻은 그 파일 머리). 효과라 외곽선 없음. wind는 오른쪽으로 부는 칸이고 왼쪽이면 anchor x로 뒤집는다.',
    image: 'prop-fx.png',
    anims,
  };
  return { items, sheet, meta };
}

/** 미리보기: 행 = 빨래방 명도 띠(천장 dusk / 벽 cotton / 아래 벽 plum / 바닥 woodL), 열 = 칸. 효과마다 기준 상자(lav 테두리 20×16)를 같이 그린다. */
export function previewPropFx(items) {
  const BG = [C.dusk, C.cotton, C.plum, C.woodL];
  const colW = 44, rowH = 44;
  const img = new Image(colW * items.length, rowH * BG.length);
  BG.forEach((bg, r) => {
    img.rect(0, r * rowH, img.w, rowH, bg);
    items.forEach((it, i) => {
      const fx = PROP_FX.find((f) => f.name === it.name);
      const bx = i * colW + 12, by = r * rowH + 16, bw = 20, bh = 16; // 물건 상자 자리
      if (fx.pin !== 'source') {
        for (let u = 0; u < bw; u++) { img.set(bx + u, by, C.lav); img.set(bx + u, by + bh - 1, C.lav); }
        for (let v = 0; v < bh; v++) { img.set(bx, by + v, C.lav); img.set(bx + bw - 1, by + v, C.lav); }
      }
      const pin = { bottom: [bx + bw / 2, by + bh], top: [bx + bw / 2, by], 'top-right': [bx + bw, by], source: [i * colW + 6, by + bh / 2] }[fx.pin];
      img.blit(it.img, pin[0] - fx.anchor[0], pin[1] - fx.anchor[1]);
    });
  });
  return img;
}
