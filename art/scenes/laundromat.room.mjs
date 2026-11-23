// 화면 1 `laundromat` 방 껍데기 (#764, m2-art-split.md "구도·바닥 타일 붓"은 L칸). 천장·형광등·벽·아래 벽 띠·바닥·인방·벽시계·빈 열쇠 걸이.
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 세탁기(laundromat.washer.mjs)·셔터(laundromat.shutter.mjs)와 같이
//   배경 시트를 만들 때 부른다(시트가 생기는 순간 hotspot-coverage 검사가 켜진다).
// 퍼즐과 상관없는 방 껍데기라(#802 재료 목록 1절 "그대로 두는 것") `laundromat` 다시 보기 전에 먼저 그린다.
//   3번 건조기·세제 자판기·걸쇠는 Kai 다시 보기에 따라 바뀔 수 있어 여기서 안 그린다.
// 배경이라 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 3-1). 광원은 왼쪽 위 형광등 하나(결정 3-3, 새벽 4시 10분 가게 안).
//   오른쪽 형광등은 꺼져 있다(가게 오른쪽이 한 단 어둡다 = 오늘의 범인 3번 건조기 쪽이 수상해 보인다).
//
// 명도 띠(위 → 아래): 천장 dusk(Y87) / 벽 cotton(Y222) / 아래 벽 띠 plum(Y54) / 바닥 woodL(Y149).
//   - 아래 벽 띠는 세탁기 몸(grnL Y155) 바로 뒤라 101 차로 세탁기 줄이 한 덩어리로 뜬다.
//     세 사람 주색(red 104, dusk 87, teal 86, white 249, yel 208)과도 모두 30 이상이라, 시작 줄(2~4번 앞)에서 몸이 묻히지 않는다.
//   - 벽은 셔터 판(lint Y178)과 44, 걸쇠(red Y104)와 118 차. 셔터 오른쪽 벽(x 152~158, y 140~152)에 빨강·갈색 없음(laundromat.md 9-1).
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
/** 건조기 배기 덕트(3번 건조기 뒤 → 천장). 건조기 그림 상자(344~392, 위 끝 164) 뒤에서 올라간다 */
export const DUCT = { x: 360, w: 14, bottom: 164 };
/** 형광등: 켜진 것(왼쪽, 광원)과 꺼진 것(오른쪽) */
export const LAMP_ON = { x: 160, w: 96 };
export const LAMP_OFF = { x: 372, w: 80 };
/** 게시판(코르크, 셔터 위 왼쪽: 문 옆 안내판 자리). 종이에 글자는 없다(대사는 Kai, 배경 글자는 단서로 읽힐까 봐 안 쓴다) */
export const BOARD = { x: 44, y: 62, w: 36, h: 28 };

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
//    셔터 오른쪽 걸쇠 자리(x 152~158)는 형광등 가까운 쪽이라 깨끗한 cotton(걸쇠 빨강이 먼저 보인다)
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
    img.set(px0 + (pw >> 1), py0, C.dusk); // 압정(dusk). 빨강은 걸쇠·장화 전용(X4)이라 안 쓴다
  }
  for (let py = y + 1; py <= y + h; py++) img.set(x + w, py, C.lav); // 벽 그림자(어두운 쪽이라 lav)
}

// ── 건조기 배기 덕트: 은색 주름관(lint 몸, 왼쪽 1px cotton 빛, 오른쪽 2px lav 그늘, 8px마다 주름 lav).
//    천장에 붙는 곳에 dusk 띠. 3번 건조기가 폭주한 이유("오늘의 범인")를 배경에서 거들어 주는 정도이고, 핫스팟이 아니라 외곽선이 없다
function duct(img) {
  const { x, w, bottom } = DUCT;
  fill(img, x, CEIL_Y, w, bottom - CEIL_Y, (px, py) => {
    const dx = px - x;
    if (py < CEIL_Y + 3) return py === CEIL_Y + 2 ? C.lav : C.dusk; // 천장 쇠띠
    if (dx === 0) return C.lav;
    if (dx === 1) return C.cotton;
    if (dx >= w - 2) return C.lav;
    return (py - CEIL_Y) % 8 === 0 ? C.lav : C.lint;
  });
  // 고정 밴드 두 개
  for (const by of [60, 120]) fill(img, x - 1, by, w + 2, 2, (px, py) => (py === by ? C.lint : C.dusk));
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
