// 화면 1 `laundromat` 세제 자판기 정지 그림 한 장 (#764, 건조기 #879 다음 L칸).
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 물건 시트가 생기는 순간 hotspot-coverage 검사가 켜져서(결정 2026-11-22) 셔터·세탁기·건조기와 같은 원칙이다.
// #802 재료 목록: 자판기를 "그럴듯한 첫 시도가 빗나가는 곳"으로 올려도 생김새는 그대로라, **정지 그림만** 먼저 그린다.
//   반응 칸(U8 상자 쏟아짐·동전 굴러 나옴, `pipit_text` 맞받기)은 Kai 다시 보기 뒤에 그린다. 자리(x, y)는 호출 쪽 숫자라 옮겨도 공짜다.
// 배경 물건이라 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 3-1). 광원은 왼쪽 위 형광등(결정 3-3). 이 자리 위 형광등도 꺼져 있다.
// 빨강은 이 화면에서 걸쇠와 プピ 장화만 쓴다(laundromat.md X4) → 자판기에 빨강 없음. 세제 상자도 빨강 없이 고른다.
//
// 색: 몸 주색 lint(Y178) 밝은 회색 금속. 민트 세탁기 줄, 라일락 건조기와 색상이 다르다(줄 끝 구석의 "가게 비품").
//   명도 띠 결정(2026-11-23): 뒤 벽 cotton(Y222)과 44, 아래 벽 띠 plum(Y54)과 124 차.
//   세 사람 주색(빨강 Y104, 바지 dusk Y87, 멜빵 teal Y86, 셔츠 white Y249, 우비 yel Y208)과 모두 30 이상.
//   우비와 30 딱 경계다. 134~178 사이에서 쓸 수 있는 색이 grnL(세탁기)·woodL(바닥)·yelD(바닥과 같은 명도)·pink(건조기 양말)·lint뿐이라 lint를 골랐다.
//   사람은 자판기 왼쪽 설 곳(415~419)에만 서고 자판기와 겹치지 않는다(미리보기 검사). 경계 30은 나란히 섰을 때만 만난다.
// 단서처럼 보이는 것(이 그림이 말하는 것): 진열창에 색색 세제 상자 6개와 그 아래 버튼 한 줄(ノビー 집게가 "한꺼번에" 누를 줄),
//   오른쪽 동전 투입구·반환구(ズッシー 쿵에 동전이 굴러 나올 곳), 위 스피커 구멍(プピ 소리에 `ピピッ`으로 맞받을 입).
//   진열창 불은 꺼져 있다. 새벽에 다 꺼진 가게에서 켜진 건 3번 건조기 표시등 하나뿐이어야 그쪽이 "아직 살아 있다"로 읽힌다.
// 미리보기·검사: node docs/design/screens/laundromat-vending-preview.mjs

import { C } from '../lib/pixel.mjs';
import { hash, bay, fill, ellipse } from '../lib/texture.mjs';

/** 히트 상자 크기(content/screens/laundromat.json `soap_vending` 40×88). 아래 끝이 바닥(y 236)에 닿는다. */
export const VEND_W = 40, VEND_H = 88;
/** 진열창(몸 기준). 검사·반응 그림이 같이 쓴다 */
export const VEND_WINDOW = { x: 3, y: 16, w: 27, h: 36 };
/** 세제 상자 6개(2줄 × 3) 왼쪽 위(몸 기준)와 크기. 반응 `spill_boxes`가 이 중 세 개를 떨어뜨린다 */
export const VEND_BOX = { w: 6, h: 8, cols: [6, 14, 22], rows: [19, 36] };
/** 버튼 줄(상자 줄마다 아래 하나씩, 몸 기준 y). 집게가 누르는 줄 */
export const VEND_BUTTON_Y = [29, 46];
/** 동전 반환구(몸 기준). 반응 `spill_coin`이 여기서 동전을 굴린다 */
export const VEND_COIN_RETURN = { x: 31, y: 47, w: 5, h: 4 };
/** 꺼내는 곳(몸 기준). 반응 `spill_boxes`의 상자가 여기서 튀어나온다 */
export const VEND_CHUTE = { x: 5, y: 60, w: 26, h: 12 };

// 세제 상자 색 [몸, 그늘, 띠]. 빨강 없음(X4). 노랑·민트·하늘·분홍이 섞여 "골라 사는 것"으로 읽힌다
const BOXES = [
  [C.yel, C.yelD, C.white],
  [C.grnP, C.grnL, C.white],
  [C.tealL, C.tealM, C.white],
  [C.pinkL, C.pink, C.white],
  [C.yel, C.yelD, C.tealM],
  [C.tealL, C.tealM, C.yel],
];

/**
 * 세제 자판기 정지 그림을 (x, y) 왼쪽 위에 그린다.
 * @param {object} [o]
 * @param {boolean[]} [o.boxes] 상자 6개를 그릴지(반응 뒤 빈 칸을 보여 줄 때). 기본은 다 있음
 */
export function vending(img, x, y, { boxes = [true, true, true, true, true, true] } = {}) {
  const W = VEND_W, H = VEND_H;
  const P = (dx, dy, c) => img.set(x + dx, y + dy, c);

  // ── 몸통: 위·왼쪽 1px 밝게(형광등 쪽), 오른쪽 3px 그늘(lint 디더 → lav → dusk 끝선). 위 형광등이 꺼져 건조기와 같은 너비
  fill(img, x, y, W, H, (px, py) => {
    const dx = px - x, dy = py - y;
    if (dx === W - 1) return C.dusk;
    if (dx === W - 2) return C.lav;
    if (dx >= W - 4) return bay(px, py, 0.5, C.lint, C.lav);
    if (dy === 0 || dx === 0) return C.cotton;
    return C.lint;
  });
  for (const dx of [0, W - 1]) img.set(x + dx, y, img.get(x + dx, y - 1)); // 위 두 귀 둥글게

  // ── 머리 간판(y 3~12): 불 꺼진 하늘색 판 + 비누 거품 세 알. 글자는 없다(배경 글자는 단서로 읽힐까 봐 안 쓴다)
  fill(img, x + 3, y + 3, W - 8, 10, (px, py) => (py === y + 3 ? C.aqua : py === y + 12 ? C.tealM : C.tealL));
  for (const [bx, by, r] of [[10, 8, 3], [17, 7, 2], [22, 9, 1.6]]) {
    ellipse(img, x + bx, y + by, r, r, (px, py, ex, ey) => (ex + ey < -0.5 ? C.white : Math.hypot(ex, ey) > 0.7 ? C.tealM : C.aqua));
  }
  // 간판 오른쪽 스피커: 가로 틈 3줄(4px, 가운데 줄만 5px). プピ 소리에 `ピピッ`으로 맞받는 입.
  //   처음엔 점 5개(주사위 5)였는데 4배에서 "×" 표시로 읽혀서 틈으로 바꿨다
  for (const [sy, sw] of [[5, 4], [7, 5], [9, 4]]) fill(img, x + 27 + (5 - sw), y + sy, sw, 1, C.teal);

  // ── 진열창: 어두운 유리(불 꺼짐). 테두리는 dusk, 왼쪽 위 대각 반사 두 줄
  const { x: wx, y: wy, w: ww, h: wh } = VEND_WINDOW;
  fill(img, x + wx, y + wy, ww, wh, (px, py) => {
    const dx = px - x - wx, dy = py - y - wy;
    if (dx === 0 || dy === 0 || dx === ww - 1 || dy === wh - 1) return C.dusk;
    return bay(px, py, 0.15, C.tealD, C.teal);
  });
  // 칸 선반 두 줄(상자가 올라앉은 판, 버튼 바로 위)
  for (const by of VEND_BUTTON_Y) fill(img, x + wx + 1, y + by - 2, ww - 2, 1, C.lav);
  // 세제 상자: 앞면 + 오른쪽 그늘 1px + 가운데 띠(상표 대신 색 띠) + 위 1px 밝게
  const { cols, rows } = VEND_BOX;
  rows.forEach((ry, j) => cols.forEach((cx0, i) => {
    const k = j * 3 + i;
    if (boxes[k]) soapBox(img, x + cx0, y + ry, k); // 아래 끝이 선반(VEND_BUTTON_Y − 2) 바로 위
  }));
  // 유리 반사: 왼쪽 위 귀퉁이에 짧은 대각선 두 줄, 빈 유리 위에만(상자 위에 얹으면 4배에서 노란 상자가 긁힌 것처럼 보였다)
  const isGlass = (c) => c === C.tealD || c === C.teal;
  for (let t = 0; t < 8; t++) {
    for (const off of [2, 5]) {
      const px = x + wx + off + t, py = y + wy + 1 + t;
      if (isGlass(img.get(px, py))) img.set(px, py, C.tealM);
    }
  }
  // 버튼 줄: 상자마다 아래 2×2 버튼(흰 + 그늘). 줄 하나가 집게 한 번에 다 눌리는 폭이다
  for (const by of VEND_BUTTON_Y) {
    fill(img, x + wx + 1, y + by - 1, ww - 2, 3, C.plum); // 버튼 받침 띠
    for (const cx0 of cols) {
      const bx = x + cx0 + 2;
      img.set(bx, y + by, C.white); img.set(bx + 1, y + by, C.aqua);
      img.set(bx, y + by + 1, C.lint); img.set(bx + 1, y + by + 1, C.lav);
    }
  }

  // ── 오른쪽 돈 받는 판(x 31~35): 동전 투입구 + 지폐 없음 + 반환 레버 + 반환구
  const MX = 31;
  fill(img, x + MX, y + 18, 5, 24, (px, py) => (px === x + MX ? C.lav : py === y + 18 ? C.cotton : C.lint));
  fill(img, x + MX + 2, y + 21, 2, 6, C.dusk); // 동전 투입구(세로 틈)
  P(MX + 2, 21, C.plum);
  fill(img, x + MX + 1, y + 21, 1, 6, C.cotton); // 투입구 왼쪽 테 반짝
  // 반환 레버: 짧은 가로 막대 + 노란 동그라미 손잡이(위 동전 색과 같은 노랑은 쓰지 않고 yelD로 한 단 낮춤)
  fill(img, x + MX + 1, y + 32, 4, 2, C.lav);
  P(MX + 3, 31, C.yelD); P(MX + 4, 31, C.yelD); P(MX + 4, 32, C.yelD);
  // 반환구: 작고 어두운 입(동전이 굴러 나올 곳)
  const R = VEND_COIN_RETURN;
  fill(img, x + R.x, y + R.y, R.w, R.h, (px, py) => (py === y + R.y ? C.lav : py === y + R.y + R.h - 1 ? C.lint : C.plum));

  // ── 꺼내는 곳: 가로로 긴 어두운 입 + 위 경첩이 달린 투명 덮개(밝은 테 한 줄) + 안쪽 그늘
  const K = VEND_CHUTE;
  fill(img, x + K.x - 1, y + K.y - 1, K.w + 2, K.h + 2, C.lav); // 테
  fill(img, x + K.x, y + K.y, K.w, K.h, (px, py) => {
    const dy = py - y - K.y;
    if (dy === 0) return C.dusk; // 경첩 그늘
    if (dy === 1) return C.tealM; // 덮개 위 끝 반사
    return bay(px, py, 0.25 + dy * 0.04, C.plum, C.dusk);
  });
  fill(img, x + K.x - 1, y + K.y + K.h + 1, K.w + 2, 1, C.cotton); // 아래 턱(빛 받는 쪽)

  // ── 발판: 아래 4줄 한 단 어둡게 + 바닥 쪽 한 줄 더
  fill(img, x + 1, y + H - 5, W - 5, 3, (px, py) => (py === y + H - 5 ? C.lav : (px - x) % 6 === 3 ? C.lav : C.lint)); // 통풍 홈
  fill(img, x, y + H - 1, W, 1, C.lav);
  fill(img, x + 1, y + H - 2, W - 2, 1, C.lint);

  // ── 바닥 그림자(바닥 쪽 한 줄). 세탁기·건조기와 같은 방식
  for (let dx = 1; dx < W + 1; dx++) img.set(x + dx, y + H, hash(x + dx, y + H, 6) < 0.85 ? C.lav : img.get(x + dx, y + H));
}

/**
 * 세제 상자 하나(VEND_BOX 6×8, 색은 진열창 k번과 같다). 앞면 + 오른쪽 그늘 1px + 가운데 띠(상표 대신 색 띠) + 위 1px 밝게.
 * 진열창 상자와 `spill_boxes`로 쏟아지는 상자(시트 2/2-c2, 시트가 외곽선을 두른다)가 같이 쓴다. (x, y) = 왼쪽 위.
 */
export function soapBox(img, x, y, k) {
  const { w: bw, h: bh } = VEND_BOX;
  const [body, shade, band] = BOXES[k % BOXES.length];
  fill(img, x, y, bw, bh, (px, py) => {
    const dx = px - x, dy = py - y;
    if (dx === bw - 1) return shade;
    if (dy === 3 || dy === 4) return band;
    if (dy === 0) return C.white;
    return body;
  });
}
