// 화면 `laundromat` 방 껍데기 (#764, m2-art-split.md "구도·바닥 타일 붓"은 L칸). 천장·형광등·벽·아래 벽 띠·바닥·인방·벽시계·빈 열쇠 걸이,
//   그리고 스테이지 3 B 설계(laundromat.md 2-1, 9-2 R1+R2)의 덕트 길 + 들창(판자 + 바깥 배기 후드).
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 세탁기(laundromat.washer.mjs)·셔터(laundromat.shutter.mjs)와 같이
//   배경 시트를 만들 때 부른다(시트가 생기는 순간 hotspot-coverage 검사가 켜진다).
// 퍼즐과 상관없는 방 껍데기라(#802 재료 목록 1절 "그대로 두는 것") `laundromat` 다시 보기 전에 먼저 그린다.
//   3번 건조기·세제 자판기는 물건 그림(laundromat.dryer.mjs, laundromat.vending.mjs)이라 여기서 안 그린다. 걸쇠는 B 설계에서 없어졌다.
// 배경이라 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 3-1). 광원은 왼쪽 위 형광등 하나(결정 3-3, 새벽 4시 10분 가게 안).
//   오른쪽 형광등은 꺼져 있다(가게 오른쪽이 한 단 어둡다 = 오늘의 범인 3번 건조기 쪽이 수상해 보인다).
//
// 명도 띠(위 → 아래): 천장 dusk(Y87) / 벽 cotton(Y222) / 아래 벽 띠 plum(Y54) / 바닥 woodL(Y149).
//   - 아래 벽 띠는 세탁기 몸(grnL Y155) 바로 뒤라 101 차로 세탁기 줄이 한 덩어리로 뜬다.
//     세 사람 주색(red 104, dusk 87, teal 86, white 249, yel 208)과도 모두 30 이상이라, 시작 줄(2~4번 앞)에서 몸이 묻히지 않는다.
//   - 벽은 셔터 판(lint Y178)·덕트(lint)와 44 차.
//   - 바닥은 세 사람 주색과 모두 30 이상(결정 3-4).
// 미리보기·검사: node docs/design/screens/laundromat-bg-sketch.mjs

import { C } from '../lib/pixel.mjs';
import { hash, bay, fill, ellipse, line } from '../lib/texture.mjs';

export const W = 480, H = 270;
/** 천장 띠 아래 끝(이 줄부터 벽) */
export const CEIL_Y = 12;
/** 아래 벽 띠 위 끝(걸레받이 위 몰딩 줄 포함) */
export const WAINSCOT_Y = 172;
/** 바닥 위 끝 = 세탁기·건조기·자판기 아래 끝 */
export const FLOOR_Y = 236;
/** 셔터 통 위 인방. 윗선 y 118~119가 설계 1절 "천장선 y 120"이다 */
export const LINTEL = { x: 14, y: 118, w: 148, h: 6 };
/** 빈 열쇠 걸이(laundromat.md 1-1 배경, 클리어 컷 `clear_hook`) */
export const KEY_HOOK = { x: 176, y: 150, w: 12, h: 10 };
/** 벽시계 4시 10분. 세탁기 줄 위 선반보다 높이(사람 말풍선이 뜨는 높이 y 128~186을 피한다) */
export const CLOCK = { cx: 268, cy: 100, r: 9 };
/** 세탁기 줄 위 선반(세제 상자·바구니). 열쇠 걸이(176~188)를 피해 200부터 */
export const SHELF = { x: 200, y: 160, w: 136 };
/**
 * 건조기 배기 덕트(laundromat.md 2-1 "덕트 길 + 들창", 9-2 R1). 3번 건조기 뒤(위 끝 164)에서 세로로 올라가 runY에서 꺾이고,
 * 위쪽 벽을 가로질러 왼쪽 들창까지 간다. 끝(endX)에서 판자를 뚫고 밖으로 나간다.
 *   가로 구간 y 52~63은 바깥 배기 후드(HOOD)와 같은 높이다: 덕트 → 판자 → (창살 뒤) → 후드 → 둥지가 한 줄로 읽힌다.
 *   세로 구간(x 360~373, y 64~163)이 `duct` 핫스팟(352,120 30×44)이고, 열쇠패가 걸리는 자리(367, 150)도 여기다.
 */
export const DUCT = { x: 360, w: 14, bottom: 164, runY: 52, runH: 12, endX: 92 };
/**
 * 들창(셔터 위, 두 칸, 바깥 틀 기준). 왼쪽 칸(paneL)은 열려 있어 바깥 새벽 하늘과 배기 후드·둥지가 보이고(까치가 드나드는 칸),
 * 오른쪽 칸(paneR)은 판자로 막았는데 덕트가 그 판자를 뚫고 나간다. `magpie` 핫스팟은 이 틀 상자 그대로 쓰면 된다(58,22 56×52).
 */
export const TRANSOM = { x: 58, y: 22, w: 56, h: 52, paneL: { x: 60, w: 26 }, paneR: { x: 88, w: 24 }, inY: 24, inH: 48 };
/** 바깥 배기 후드(왼쪽 칸 안에 보임). 관 끝(stub)이 창살 뒤에서 나와 왼쪽으로, 끝에 갓(cap). 둥지는 top 위에 얹힌다 */
export const HOOD = { stubX0: 70, stubX1: 86, y: 54, h: 9, capX: 62, top: 54 };
/** 형광등: 켜진 것(왼쪽, 광원)과 꺼진 것(오른쪽) */
export const LAMP_ON = { x: 160, w: 96 };
export const LAMP_OFF = { x: 372, w: 80 };
/** 게시판(코르크). 셔터 위는 들창 자리가 되어 들창 오른쪽 아래로 옮겼다(#764). 종이에 글자는 없다(배경 글자는 단서로 읽힐까 봐 안 쓴다) */
export const BOARD = { x: 150, y: 76, w: 36, h: 28 };

const LIGHT = { x: LAMP_ON.x + LAMP_ON.w / 2, y: CEIL_Y + 6 };

/** 방 껍데기 전부를 그린다(뒤 → 앞, laundromat.md 1-4 1번 줄의 세탁기 줄 전까지). */
export function room(img) {
  ceiling(img);
  wall(img);
  wainscot(img);
  floor(img);
  lintel(img);
  lamp(img, LAMP_ON.x, LAMP_ON.w, true);
  lamp(img, LAMP_OFF.x, LAMP_OFF.w, false);
  transom(img);
  duct(img);
  shelf(img);
  clock(img);
  keyHook(img);
  board(img);
}

// ── 천장: 어두운 띠. 형광등 위만 한 단 밝게(빛이 천장에 번짐). 아래 끝 한 줄은 벽과 만나는 그늘
function ceiling(img) {
  fill(img, 0, 0, W, CEIL_Y, (x, y) => {
    if (y === CEIL_Y - 1) return C.plum;
    if (x % 48 === 0) return C.plum; // 천장 판 이음매
    const near = Math.abs(x - LIGHT.x) < LAMP_ON.w / 2 + 16;
    return near && y >= CEIL_Y - 5 ? bay(x, y, 0.5, C.dusk, C.lav) : C.dusk;
  });
}

// ── 벽: 칠한 벽 cotton. 형광등에서 멀수록(오른쪽·위 구석) lint 디더가 늘어 한 단 어두워진다.
function wall(img) {
  fill(img, 0, CEIL_Y, W, WAINSCOT_Y - CEIL_Y, (x, y) => {
    const d = Math.hypot((x - LIGHT.x) / 1.6, y - LIGHT.y);
    const t = Math.max(0, Math.min(1, (d - 120) / 150)); // 120px 안은 0, 바깥으로 갈수록 1
    if (y === CEIL_Y) return C.lint; // 천장 그늘 한 줄
    if (hash(x, y, 31) < 0.012) return C.lint; // 칠 얼룩(아주 드물게)
    return bay(x, y, t * 0.55, C.cotton, C.lint);
  });
}

// ── 아래 벽 띠: 어두운 plum 타일(8×8). 위에 몰딩 두 줄(lav 빛, dusk 그늘). 줄눈은 purD,
//    타일 왼쪽 위 한 점만 dusk로 반짝인다(광원이 왼쪽 위). 세탁기 줄이 이 위에 떠서 읽힌다
function wainscot(img) {
  fill(img, 0, WAINSCOT_Y, W, FLOOR_Y - WAINSCOT_Y, (x, y) => {
    const dy = y - WAINSCOT_Y;
    if (dy === 0) return C.lav;
    if (dy === 1) return C.dusk;
    const ty = (dy - 2) % 8, tx = x % 8;
    if (ty === 7 || tx === 7) return C.purD;
    if (ty === 0 && tx === 0) return C.dusk;
    return C.plum;
  });
  // 걸레받이(바닥에 닿는 2줄)
  fill(img, 0, FLOOR_Y - 2, W, 2, (x, y) => (y === FLOOR_Y - 2 ? C.dusk : C.plum));
}

// ── 바닥: 큰 비닐 타일(24×8) woodL. 줄눈 wood. 형광등 아래 타일 윗줄에 tan 반사 한 줄(디더로 번지면 모래처럼 보여서 줄로만)
function floor(img) {
  fill(img, 0, FLOOR_Y, W, H - FLOOR_Y, (x, y) => {
    const dy = y - FLOOR_Y;
    if (dy === 0) return C.wood; // 벽과 만나는 그늘
    const row = Math.floor((dy - 1) / 8);
    const ox = row % 2 ? 12 : 0; // 줄마다 반 칸 어긋남
    if ((dy - 1) % 8 === 7 || (x + ox) % 24 === 23) return C.wood;
    if ((dy - 1) % 8 === 0 && Math.abs(x - LIGHT.x) < 40 - row * 8) return C.tan; // 형광등 반사: 타일 윗줄 한 줄씩, 앞으로 갈수록 짧게
    if (hash(x >> 1, y, 34) < 0.04) return C.yelD; // 오래된 바닥 얼룩
    return C.woodL;
  });
}

// ── 인방: 셔터 통을 받치는 들보. 천장선 y 120
function lintel(img) {
  const { x, y, w, h } = LINTEL;
  fill(img, x, y, w, h, (px, py) => (py === y ? C.lav : px === x + w - 1 ? C.plum : C.dusk));
}

// ── 형광등: 천장에 붙은 갓(lint) + 관. 켜진 관은 white/yelL, 꺼진 관은 lav. 관 양 끝 마개 dusk
function lamp(img, x0, w, on) {
  const y = CEIL_Y;
  fill(img, x0, y, w, 2, (px, py) => (py === y ? C.lav : C.lint)); // 갓
  fill(img, x0 + 2, y + 2, w - 4, 2, (px, py) => (on ? (py === y + 2 ? C.white : C.yelL) : (py === y + 2 ? C.lint : C.lav)));
  for (const ex of [x0 + 2, x0 + w - 3]) fill(img, ex, y + 2, 1, 2, C.dusk);
  if (on) {
    // 관 아래 벽에 번지는 빛 한 띠(white 디더). 벽 cotton 위라 명도 차는 작고, "켜져 있다"만 알린다
    fill(img, x0 - 6, y + 4, w + 12, 6, (px, py) => (bay(px, py, 0.45 - (py - y - 4) * 0.08, C.cotton, C.white) === C.white ? C.white : undefined));
  }
}

// ── 벽시계 4시 10분(설계 1-1). 흰 판 + lav 테두리 + dusk 바늘. 작은 바늘은 4를 조금 지남(125°), 긴 바늘은 2(60°)
function clock(img) {
  const { cx, cy, r } = CLOCK;
  ellipse(img, cx, cy, r, r, (px, py, ex, ey) => {
    const d = Math.hypot(ex, ey);
    if (d > 0.82) return ex + ey < -0.3 ? C.lint : C.lav; // 테두리, 왼쪽 위가 밝다
    return C.white;
  });
  for (let k = 0; k < 12; k += 3) { // 12·3·6·9시 눈금
    const a = (k / 12) * Math.PI * 2;
    img.set(Math.round(cx + Math.sin(a) * (r - 2.5)), Math.round(cy - Math.cos(a) * (r - 2.5)), C.lav);
  }
  const hand = (deg, len) => {
    const a = (deg * Math.PI) / 180;
    line(img, Math.round(cx), Math.round(cy), Math.round(cx + Math.sin(a) * len), Math.round(cy - Math.cos(a) * len), C.dusk);
  };
  hand(125, 4); // 4시 10분: (4 + 10/60) × 30°
  hand(60, 6.5); // 10분
  img.set(Math.round(cx), Math.round(cy), C.plum);
  // 벽에 지는 그림자(오른쪽 아래 1px)
  ellipse(img, cx + 1, cy + 1, r, r, (px, py) => (img.get(px, py) === C.cotton || img.get(px, py) === C.lint ? (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) > r - 0.5 ? C.lint : undefined) : undefined));
}

// ── 빈 열쇠 걸이: 나무판 + 고리 두 개. 왼쪽 고리엔 아무것도 없고, 판에 열쇠 모양 그림자(오래 걸려 있던 자국)가 남았다.
//    오른쪽 고리에는 작은 태그만 걸려 있다(열쇠 없이). "원래 여기 열쇠가 있었다"를 그림으로 말한다
function keyHook(img) {
  const { x, y, w, h } = KEY_HOOK;
  fill(img, x, y, w, h, (px, py) => {
    if (py === y || px === x) return C.woodL; // 왼쪽 위 빛
    if (py === y + h - 1 || px === x + w - 1) return C.woodD;
    return C.wood;
  });
  // 고리(lav, 위 한 점 lint)
  for (const hx of [x + 3, x + 8]) { img.set(hx, y + 2, C.lint); img.set(hx, y + 3, C.lav); }
  // 왼쪽: 열쇠 자국(판보다 한 단 밝은 woodL 자리 = 햇빛 안 받은 자리). 머리 동그라미 + 몸
  for (const [dx, dy] of [[2, 4], [3, 4], [4, 4], [2, 5], [4, 5], [3, 6], [3, 7], [3, 8], [4, 7]]) img.set(x + dx, y + dy, C.woodL);
  // 오른쪽: 빈 태그(cotton 2×3)만 고리에 달려 있다
  fill(img, x + 8, y + 4, 2, 3, (px, py) => (py === y + 4 ? C.white : C.cotton));
  // 벽 그림자
  for (let py = y + 1; py <= y + h; py++) img.set(x + w, py, C.lint);
  for (let px = x + 1; px <= x + w; px++) img.set(px, y + h, C.lint);
}

// ── 게시판(셔터 위 왼쪽). 코르크 woodL + 종이 넷. 글자 없음, 종이마다 줄(lav)만
function board(img) {
  const { x, y, w, h } = BOARD;
  fill(img, x, y, w, h, (px, py) => {
    if (px === x || py === y) return C.wood;
    if (px === x + w - 1 || py === y + h - 1) return C.woodD;
    return hash(px, py, 35) < 0.18 ? C.yelD : C.woodL;
  });
  const PAPERS = [[x + 3, y + 3, 10, 12, C.cotton], [x + 15, y + 4, 9, 8, C.pinkL], [x + 26, y + 3, 7, 11, C.white], [x + 14, y + 15, 12, 10, C.aqua]];
  for (const [px0, py0, pw, ph, c] of PAPERS) {
    fill(img, px0, py0, pw, ph, (px, py) => (px === px0 + pw - 1 || py === py0 + ph - 1 ? C.lint : (py - py0) % 3 === 2 && px > px0 && px < px0 + pw - 2 ? C.lav : c));
    img.set(px0 + (pw >> 1), py0, C.dusk); // 압정(dusk). 빨강은 장화 전용(X4)이라 안 쓴다
  }
  for (let py = y + 1; py <= y + h; py++) img.set(x + w, py, C.lav); // 벽 그림자(어두운 쪽이라 lav)
}

// ── 들창(셔터 위 두 칸). 틀은 쇠 lav(벽 cotton과 91 차), 왼쪽 위 빛 lint, 오른쪽 아래 dusk. 아래에 창턱.
//    왼쪽 칸: 열려 있다(위 경첩에 버팀쇠 한 줄). 바깥은 새벽 하늘 purD → 아래로 pur(까치 ink와 44 차, 둥지 wood와 34 차).
//      바깥 배기 후드가 창살 뒤에서 나와 왼쪽으로 뻗고 끝에 갓이 있다. 둥지(물건)는 그 위에 얹힌다.
//    오른쪽 칸: 판자 세 장으로 막았다(woodL/wood, 못 dusk). 덕트가 판자 가운데를 뚫고 나간다(뚫린 구멍 둘레 plum, duct()에서).
function transom(img) {
  const { x, y, w, h, paneL, paneR, inY, inH } = TRANSOM;
  // 바깥(왼쪽 칸)
  fill(img, paneL.x, inY, paneL.w, inH, (px, py) => bay(px, py, Math.max(0, (py - inY - 18) / 34), C.purD, C.pur));
  // 먼 맞은편 지붕선(아래 6줄, dusk). 하늘보다 어둡고 둥지·후드 뒤라 거의 가려진다
  fill(img, paneL.x, inY + inH - 6, paneL.w, 6, (px, py) => (py === inY + inH - 6 ? C.lav : C.dusk));
  hood(img);
  // 판자(오른쪽 칸): 세 장, 가운데 장은 조금 비뚤다(급하게 막았다)
  const PL = [[inY, 15, 0], [inY + 15, 17, 1], [inY + 32, 16, 0]];
  for (const [py0, ph, tilt] of PL) {
    fill(img, paneR.x, py0, paneR.w, ph, (px, py) => {
      const t = tilt ? Math.floor((px - paneR.x) / 12) : 0; // 비뚤어진 장: 오른쪽 절반이 1px 내려감
      const dy = py - py0 - t;
      if (dy < 0) return C.woodD; // 비뚤어져 생긴 틈
      if (dy === 0) return C.tan; // 윗면 빛
      if (dy === ph - 1 - t || py === py0 + ph - 1) return C.woodD;
      // 나뭇결: 가로 줄 두 개만(점을 흩뿌리면 1배에서 글자처럼 보인다)
      if ((dy === 5 || dy === 10) && hash(px >> 2, py0 + dy, 37) < 0.7) return C.wood;
      return px > paneR.x + paneR.w - 3 ? C.wood : C.woodL;
    });
    for (const nx of [paneR.x + 2, paneR.x + paneR.w - 3]) img.set(nx, py0 + 2 + (tilt && nx > paneR.x + 12 ? 1 : 0), C.dusk);
  }
  // 틀: 바깥 테두리 2px + 가운데 창살 2px
  const frame = (fx, fy, fw, fh) => fill(img, fx, fy, fw, fh, (px, py) => {
    if (py === y || px === x) return C.lint;
    if (py === y + h - 1 || px === x + w - 1) return C.dusk;
    return C.lav;
  });
  frame(x, y, w, 2); frame(x, y + h - 2, w, 2); frame(x, y, 2, h); frame(x + w - 2, y, 2, h);
  fill(img, paneL.x + paneL.w, inY, 2, inH, (px) => (px === paneL.x + paneL.w ? C.lint : C.dusk));
  // 열린 칸 버팀쇠(왼쪽 위 경첩에서 대각선, lav)
  line(img, paneL.x, inY + 1, paneL.x + 5, inY + 6, C.lav);
  // 창턱 + 벽 그림자
  fill(img, x - 2, y + h, w + 4, 2, (px, py) => (py === y + h ? C.lint : C.dusk));
  fill(img, x - 1, y + h + 2, w + 3, 1, C.lint);
  for (let py = y + 1; py < y + h; py++) img.set(x + w, py, C.lint);
}

// ── 바깥 배기 후드(왼쪽 칸 안, 배경). 관 끝이 창살 뒤에서 나와 왼쪽으로 뻗고, 끝에 아래로 벌어진 갓. 바깥이라 형광등 빛이 없어
//    안 덕트보다 한 단 어둡다(몸 lav, 윗면 lint, 아래 dusk). 갓 입은 plum(어두운 구멍). 위 끝 top 줄에 둥지가 얹힌다
function hood(img) {
  const { stubX0, stubX1, y, h, capX } = HOOD;
  fill(img, stubX0, y, stubX1 - stubX0, h, (px, py) => {
    if (py === y) return C.lint;
    if (py >= y + h - 2) return C.dusk;
    return (px - stubX0) % 5 === 4 ? C.dusk : C.lav; // 주름
  });
  // 갓: 위는 관과 같은 높이, 아래로 3px 더 벌어진다(왼쪽 끝이 입)
  for (let px = capX; px < stubX0; px++) {
    const k = px - capX; // 0 = 입
    const y0 = y - (k < 2 ? 1 : 0), y1 = y + h + 2 - Math.floor(k / 3);
    for (let py = y0; py <= y1; py++) {
      let c = py === y0 ? C.lint : py >= y1 - 1 ? C.dusk : C.lav;
      if (k === 0 && py > y0 && py < y1) c = C.dusk; // 입 테두리
      if (k === 1 && py > y0 + 1 && py < y1 - 1) c = C.plum; // 입 속 그늘
      img.set(px, py, c);
    }
  }
}

// ── 건조기 배기 덕트: 은색 주름관(lint 몸, 빛 쪽 1px cotton, 그늘 쪽 2px lav, 8px마다 주름 lav).
//    세로: 3번 건조기 뒤에서 runY까지. 가로: runY에서 왼쪽으로 위쪽 벽을 가로질러 들창 판자까지(약 270px).
//    가로 구간은 천장에서 내린 걸이 셋으로 매달았다. 왼쪽 끝은 판자를 뚫고 나가며 둘레에 뜯긴 구멍(plum)과 은색 테이프.
//    덕트 lint(Y178)는 벽 cotton(222)과 44, 천장 dusk(87)와 91 차(laundromat.md 2-1 "명도 차 30").
function duct(img) {
  const { x, w, bottom, runY, runH, endX } = DUCT;
  const x1 = x + w; // 세로 구간 오른쪽 끝(제외)
  // 걸이(가로 구간 위)
  for (const hx of [150, 236, 316]) {
    fill(img, hx, CEIL_Y, 1, runY - CEIL_Y, C.lav);
    fill(img, hx - 1, CEIL_Y, 3, 1, C.dusk);
  }
  // 판자에 뚫린 구멍 둘레(덕트보다 위아래로 2px 큰 뜯긴 자국)
  for (let py = runY - 2; py < runY + runH + 2; py++) for (let px = endX - 3; px < endX + 6; px++) {
    const edge = py < runY || py >= runY + runH || px < endX;
    if (edge && hash(px, py, 39) < 0.75) img.set(px, py, C.plum);
  }
  // 가로 구간
  fill(img, endX, runY, x1 - endX, runH, (px, py) => {
    const dy = py - runY;
    if (dy === 0) return C.cotton;
    if (dy >= runH - 2) return C.lav;
    if (px < endX + 4) return px === endX ? C.dusk : C.lav; // 판자 속으로 꺾여 들어가는 끝(그늘)
    return (px - endX) % 8 === 0 ? C.lav : C.lint;
  });
  // 세로 구간(꺾이는 모서리부터 아래로)
  fill(img, x, runY, w, bottom - runY, (px, py) => {
    const dx = px - x;
    if (py < runY + runH && dx >= 2 && dx < w - 2) return py === runY ? C.cotton : C.lint; // 모서리(가로 구간과 이음)
    if (dx === 0) return C.lav;
    if (dx === 1) return C.cotton;
    if (dx >= w - 2) return C.lav;
    return (py - runY) % 8 === 0 ? C.lav : C.lint;
  });
  img.set(x1 - 1, runY, C.lint); // 모서리 바깥 둥글게
  // 꺾이는 곳 이음 띠(dusk) + 세로 구간 고정 밴드 둘
  fill(img, x - 1, runY + runH, w + 2, 2, (px, py) => (py === runY + runH ? C.lint : C.dusk));
  for (const by of [100, 132]) fill(img, x - 1, by, w + 2, 2, (px, py) => (py === by ? C.lint : C.dusk));
  // 판자 앞 은색 테이프 두 조각(구멍을 급히 막은 자국)
  fill(img, endX - 3, runY - 2, 6, 2, (px, py) => (py === runY - 2 ? C.cotton : C.lint));
  fill(img, endX - 2, runY + runH, 5, 2, (px, py) => (py === runY + runH ? C.lint : C.lav));
}

// ── 선반: 세탁기 줄 위. 판(lav 윗면 + dusk 앞면) + 받침 두 개 + 물건(세제 상자, 빈 바구니, 병, 접힌 수건 더미).
//    물건은 전부 배경색(외곽선 없음). 빨강 없음(X4)
function shelf(img) {
  const { x, y, w } = SHELF;
  fill(img, x, y, w, 3, (px, py) => (py === y ? C.lint : py === y + 1 ? C.lav : C.dusk));
  for (const bx of [x + 10, x + w - 12]) fill(img, bx, y + 3, 2, 5, (px) => (px === bx ? C.lav : C.dusk)); // 받침
  const items = [
    // [x, w, h, 몸색, 윗면/띠색]
    [x + 4, 12, 10, C.yel, C.yelL], // 큰 세제 상자
    [x + 17, 9, 7, C.tealL, C.aqua], // 작은 세제 상자
    [x + 30, 22, 8, C.purL, C.lint], // 빈 바구니(아래에서 그물 줄)
    [x + 58, 5, 12, C.pinkL, C.white], // 섬유유연제 병
    [x + 64, 5, 9, C.aqua, C.white], // 병
    [x + 78, 18, 6, C.cotton, C.white], // 접힌 수건 더미
    [x + 80, 14, 4, C.pinkL, C.pinkL], //  └ 위 한 장
    [x + 104, 12, 10, C.grnP, C.white], // 세제 상자(초록)
  ];
  for (const [ix, iw, ih, body, top] of items) {
    const iy = y - ih;
    fill(img, ix, iy, iw, ih, (px, py) => {
      if (py === iy) return top;
      if (px === ix + iw - 1) return body === C.cotton ? C.lint : C.lav; // 오른쪽 그늘
      if (body === C.purL && (px - ix) % 3 === 1 && py > iy + 1) return C.lav; // 바구니 그물
      if (body === C.cotton && (py - iy) % 2 === 0) return C.lint; // 수건 접힌 줄
      return body;
    });
  }
  // 세제 상자 앞 띠(그림 표시 = 거품 동그라미, 글자 없음)
  fill(img, x + 6, y - 6, 8, 3, (px, py) => ((px + py) % 3 === 0 ? C.white : C.teal));
  fill(img, x + 106, y - 6, 8, 3, (px, py) => ((px + py) % 3 === 0 ? C.white : C.grn));
}
