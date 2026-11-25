// 화면 1 `laundromat` 3번 건조기 정지 그림 한 장 (#764, m2-art-split.md "건조기"는 L칸).
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 물건 시트가 생기는 순간 hotspot-coverage 검사가 켜져서(결정 2026-11-22) 셔터·세탁기와 같은 원칙이다.
// #802 재료 목록: 건조기를 "그럴듯한 첫 시도가 빗나가는 곳"으로 올려도 생김새는 그대로라, **정지 그림만** 먼저 그린다.
//   반응 칸(U5 덜컹·문 끼익, `dryer_stretch` 빨려 들어감)은 Kai 다시 보기 뒤에 그린다. 자리(x, y)는 호출 쪽 숫자라 옮겨도 공짜다.
// 배경 물건이라 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 3-1). 광원은 왼쪽 위 형광등(결정 3-3). 이 자리 위 형광등은 꺼져 있어서 한 단 어둡게 둔다.
// 빨강은 이 화면에서 걸쇠와 プピ 장화만 쓴다(laundromat.md X4) → 건조기에 빨강 없음.
//
// 색: 몸 주색 purL(Y177) 라일락. 세탁기(민트 grnL)와 색상이 달라서 "줄에서 혼자 다른 기계 = 오늘의 범인"으로 읽힌다.
//   명도 띠 결정(2026-11-23): 뒤 벽 cotton(Y222)과 45, 아래 벽 띠 plum(Y54)과 123 차.
//   세 사람 주색(빨강 Y104, 바지 dusk Y87, 멜빵 teal Y86, 셔츠 white Y249, 우비 yel Y208)과 모두 30 이상(우비 31이 가장 가깝다).
//   lint(Y178)는 우비와 30 딱 경계이고 위 배기 덕트와 한 덩어리가 돼서 안 골랐다.
// 단서처럼 보이는 것(이 그림이 말하는 것): 문에 X자 테이프(고장), 문틈에 낀 분홍 양말 한 짝(U5 `dryer_stomp` 따끈한 양말의 앞 그림),
//   새벽에 다 꺼진 가게에서 이 기계 표시등 하나만 노랗게 켜져 있다(아직 살아 있다, `dryer_squeak`).
// 미리보기·검사: node docs/design/screens/laundromat-dryer-preview.mjs
//
// 물건 시트 2/2-a(#764, 설계 9-2 O4·O5):
//   O4 드럼 회전(`spin`): 유리 너머 드럼 안에 똑같은 무리 셋(턱 + 빨래 덩어리)을 120° 간격으로 두고 통째로 돌린다.
//      세 무리가 같아서 40° 칸 세 장이 끊김 없이 돈다. 같은 세 장을 거꾸로 이으면 반대 방향이라, 정회전(시계 방향)·역회전이 칸을 나눠 쓴다.
//      눈은 짧은 쪽(40°)으로 움직임을 읽어서 방향이 안 헷갈린다(2칸이면 앞뒤를 못 가른다).
//   O5 문 벌컥(`door: 'open'`): 문이 경첩(왼쪽)을 축으로 활짝 열려 몸 왼쪽 밖으로 튀어나온다(실루엣이 커진다, 8-1 ②).
//      X자 테이프는 가운데가 찢겨 몸 위 끝 토막만 남고, 문틈 양말은 빠져나가 없다(그 양말이 날아가는 양말이다).

import { C } from '../lib/pixel.mjs';
import { hash, bay, fill, ellipse } from '../lib/texture.mjs';

/** 히트 상자 크기(content/screens/laundromat.json `dryer_3` 48×72). 아래 끝이 바닥(y 236)에 닿는다. */
export const DRYER_W = 48, DRYER_H = 72;
/** 배기 덕트가 꽂히는 자리(몸 왼쪽에서). room.mjs DUCT x 360 − 건조기 x 344 = 16, 폭 14 */
export const DRYER_DUCT = { dx: 16, w: 14 };
/** 문(둥근 창) 가운데와 반지름(몸 기준). 검사·반응 그림이 같이 쓴다 */
export const DRYER_DOOR = { cx: 24, cy: 33, ro: 16, ri: 12 };
/** 열린 문이 몸 왼쪽 밖으로 나가는 폭(px). 시트가 이만큼 넓힌 상자로 잘라 외곽선을 두른다 */
export const DRYER_DOOR_SWING = 8;
/** 드럼 회전 한 칸의 각도. 무리 셋이 120° 간격이라 3칸이면 한 무리 자리로 돌아온다 */
export const DRUM_STEP = 40;

/**
 * 3번 건조기 정지 그림을 (x, y) 왼쪽 위에 그린다.
 * @param {object} [o]
 * @param {boolean} [o.duct=true] 위에 배기 덕트 받침(목)을 그린다. 덕트를 지우면 false
 */
export function dryer(img, x, y, { duct = true, spin, door = 'closed' } = {}) {
  const W = DRYER_W, H = DRYER_H;
  const P = (dx, dy, c) => img.set(x + dx, y + dy, c);

  // ── 몸통: 위·왼쪽 1px 밝게(형광등 쪽), 오른쪽 3px 그늘(pur 디더 → lav → dusk 끝선). 위 형광등이 꺼져 세탁기보다 그늘이 넓다
  fill(img, x, y, W, H, (px, py) => {
    const dx = px - x, dy = py - y;
    if (dx === W - 1) return C.dusk;
    if (dx === W - 2) return C.pur;
    if (dx >= W - 4) return bay(px, py, 0.5, C.purL, C.pur);
    if (dy === 0 || dx === 0) return C.pinkL;
    return C.purL;
  });
  for (const dx of [0, W - 1]) img.set(x + dx, y, img.get(x + dx, y - 1)); // 위 두 귀 둥글게

  // ── 덕트 목: 천장에서 내려온 덕트(room.mjs)가 몸 위에 꽂히는 dusk 깃 2줄
  if (duct) fill(img, x + DRYER_DUCT.dx - 1, y, DRYER_DUCT.w + 2, 2, (px, py) => (py === y ? C.lav : C.dusk));

  // ── 위 조작판(y 3~12): 어두운 dusk 판(세탁기는 밝은 판이라 반대) + 동전 투입구 + 꺼진 표시창 + 다이얼 + 노란 표시등
  const PY0 = 3, PH = 10;
  fill(img, x + 2, y + PY0, W - 6, PH, (px, py) => (py === y + PY0 ? C.lav : py === y + PY0 + PH - 1 ? C.plum : C.dusk));
  fill(img, x + 5, y + PY0 + 2, 5, 6, C.lav); // 동전 투입구 판
  fill(img, x + 7, y + PY0 + 3, 1, 4, C.plum);
  fill(img, x + 13, y + PY0 + 3, 12, 4, C.plum); // 표시창(꺼짐)
  P(13, PY0 + 3, C.dusk);
  ellipse(img, x + 34.5, y + PY0 + 4.5, 3, 3, (px, py, ex, ey) => (ex + ey < -0.6 ? C.lint : ex + ey > 0.7 ? C.dusk : C.lav)); // 다이얼
  P(34, PY0 + 2, C.plum); P(34, PY0 + 3, C.plum);
  // 표시등: 2×2 노랑 + 왼쪽 위 한 점 더 밝게. 꺼진 가게에서 여기만 켜져 있다
  fill(img, x + 40, y + PY0 + 3, 2, 2, C.yel);
  P(40, PY0 + 3, C.yelL);

  if (door === 'open') openDoor(img, x, y);
  else closedDoor(img, x, y, spin);

  // ── 아래: 보풀 필터 창(가로 홈 4줄) + 번호표 "3" + 발판
  const FY = 57;
  fill(img, x + 14, y + FY, 26, 9, (px, py) => (py === y + FY ? C.dusk : (py - y - FY) % 2 === 0 ? C.pur : C.lav));
  fill(img, x + 14, y + FY + 9, 26, 1, C.pinkL); // 필터 창 아래 턱(빛 받는 쪽)
  // 번호표: cotton 판 5×7에 dusk 숫자 3 (세탁기 번호표와 같은 글꼴)
  fill(img, x + 4, y + FY, 5, 7, C.cotton);
  fill(img, x + 4, y + FY, 5, 1, C.white);
  ['##.', '..#', '.#.', '..#', '##.'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') P(5 + i, FY + 1 + j, C.dusk); }));
  // 발판: 아래 3줄 한 단 어둡게
  fill(img, x + 1, y + H - 3, W - 5, 2, (px, py) => (py === y + H - 3 ? C.pur : C.purL));
  fill(img, x, y + H - 1, W, 1, C.pur);

  // ── 바닥 그림자(바닥 쪽 한 줄). 세탁기와 같은 방식
  for (let dx = 1; dx < W + 1; dx++) img.set(x + dx, y + H, hash(x + dx, y + H, 5) < 0.85 ? C.lav : img.get(x + dx, y + H));
}

/** 닫힌 둥근 문 + 손잡이 + X자 테이프 + 문틈 양말. spin(도)이 있으면 드럼 안이 돈다(O4). */
function closedDoor(img, x, y, spin) {
  // ── 둥근 문: 바깥 링(금속), 안은 어두운 드럼(보라 유리). 세탁기 유리는 청록이라 색으로도 다른 기계다
  const { cx: dcx, cy: dcy, ro: RO, ri: RI } = DRYER_DOOR;
  const cx = x + dcx, cy = y + dcy;
  ellipse(img, cx, cy, RO, RO, (px, py, ex, ey) => (ex + ey < -0.9 ? C.white : ex + ey < -0.2 ? C.lint : ex + ey < 0.8 ? C.lav : C.dusk));
  ellipse(img, cx, cy, RI, RI, (px, py, ex, ey) => {
    const r = Math.hypot(ex, ey);
    if (ex + ey < -0.55 && ex + ey > -0.95 && r > 0.35) return C.lav; // 꺼진 형광등 쪽이라 반사가 약하다(세탁기는 tealM)
    if (r > 0.82) return C.plum;
    return bay(px, py, 0.3, C.purD, C.dusk);
  });
  if (spin !== undefined) drumSpin(img, cx, cy, spin);
  // 드럼 안 빨래 덩어리(아래쪽에 몰림): 유리 너머라 어두운 색만. 멈춘 그림(배경)만 쓴다
  else for (let i = 0; i < 7; i++) {
    const bx = cx - 7 + hash(3, i, 1) * 14, by = cy + 4 + hash(3, i, 2) * 4;
    ellipse(img, bx, by, 2.4, 1.6, (px, py) => (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) < RI - 1.5 ? [C.pur, C.dusk, C.grn][i % 3] : undefined));
  }
  // 손잡이: 링 오른쪽 세로 막대
  fill(img, cx + RO - 1, cy - 4, 2, 8, C.lav);
  img.set(cx + RO - 1, cy - 4, C.lint);

  // ── X자 테이프(고장 표시): 2px 폭 tan 띠 두 줄, 문 링보다 2px 더 나가서 몸에 붙는다. 끝은 찢긴 듯 한 줄 들쭉날쭉
  const T = RO + 2;
  for (let t = -T; t <= T; t++) {
    const ragged = Math.abs(t) === T && hash(cx, t, 7) < 0.5;
    if (ragged) continue;
    for (const sy of [1, -1]) {
      const px = cx + t, py = cy + sy * t;
      img.set(px, py, Math.abs(t) % 5 === 2 ? C.yelD : C.tan); // 5px마다 접힌 주름
      img.set(px + 1, py, C.tan);
      // 아래쪽 그늘 한 줄(테이프 두께). 다음 t가 덮지 않는 칸: ↘ 띠는 바로 아래, ↗ 띠는 오른쪽 아래
      if (Math.abs(t) < T) img.set(sy === 1 ? px : px + 2, py + 1, C.woodL);
    }
  }
  fill(img, cx - 1, cy - 1, 3, 3, C.tan); // 교차점에 한 겹 더
  img.set(cx - 1, cy - 1, C.yelL);

  // ── 문틈에 낀 양말: 문 아래 이음매(6시 방향)에서 축 늘어진 분홍 양말 한 짝(목 3×6 + 발끝 4×2).
  //    X자 테이프가 네 귀를 다 지나가서, 양말은 테이프와 안 겹치는 6시 자리에 둔다
  const sx0 = cx + 3, sy0 = cy + RO - 2;
  fill(img, sx0, sy0, 3, 6, (px, py) => (px === sx0 + 2 ? C.pink : (py - sy0) % 3 === 1 ? C.white : C.pinkL)); // 목 부분 줄무늬
  fill(img, sx0 - 1, sy0 + 6, 4, 2, (px, py) => (py === sy0 + 7 || px === sx0 + 2 ? C.pink : C.pinkL)); // 발끝(왼쪽으로 꺾임)
  fill(img, sx0, sy0, 3, 1, C.dusk); // 문틈에 눌린 자리
}

/**
 * O4 유리 너머 드럼 안: 턱(lint 2×2) + 그 뒤를 따라 올라가는 빨래 덩어리 무리 셋. a도(시계 방향 +).
 * 멈춘 그림 색(pur·dusk·grn)이나 lav는 유리 반사 띠(lav)와 X자 테이프에 묻혀 돌아도 안 보였다(8배로 확인).
 * 그래서 도는 덩어리는 문틈 양말과 같은 분홍(pinkL 몸 · pink 그늘)이다. 어두운 유리(purD) 위에서 가장 먼저 눈에 걸리고,
 * "이 건조기 속은 양말 천지"라 둥지 양말(S3 D)·날아가는 양말(O5)과 이어진다. 반사는 내용물 뒤에 둔다(앞에 두면 다시 묻힌다).
 */
function drumSpin(img, cx, cy, a) {
  const { ri: RI } = DRYER_DOOR;
  for (let i = 0; i < 3; i++) {
    const th = ((a + i * 120 - 90) * Math.PI) / 180;
    // 덩어리: 턱보다 20° 뒤, 반지름 6. 같은 무리라 색도 같다(다르면 3칸 뒤 자리가 안 맞아 튄다)
    const tb = th - (20 * Math.PI) / 180;
    const lx = cx + Math.cos(tb) * 6, ly = cy + Math.sin(tb) * 6;
    ellipse(img, lx, ly, 2.6, 2.0, (px, py, ex, ey) => (ex + ey > 0.5 ? C.pink : C.pinkL));
    // 턱: 드럼 벽(반지름 9.5)에 붙은 밝은 돌기
    const bx = Math.round(cx + Math.cos(th) * 9.5 - 0.5), by = Math.round(cy + Math.sin(th) * 9.5 - 0.5);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = bx + dx, py = by + dy;
      if (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) < RI - 0.5) img.set(px, py, dx + dy === 0 ? C.lint : C.lav);
    }
  }
}

/**
 * O5 문 벌컥: 둥근 입(고무 패킹 링 + 어두운 속 + 바닥에 몰린 빨래) + 찢긴 테이프 토막 + 왼쪽으로 활짝 열린 문.
 * 문은 거의 옆에서 본 모습이라 좁은 세로 타원이고, 몸 왼쪽 끝에서 DRYER_DOOR_SWING px 밖까지 나간다.
 */
function openDoor(img, x, y) {
  const { cx: dcx, cy: dcy, ro: RO } = DRYER_DOOR;
  const cx = x + dcx, cy = y + dcy;
  // 입: 패킹(밝은 왼쪽 위 → 어두운 오른쪽 아래), 그 안은 깊은 속(plum → purD)
  ellipse(img, cx, cy, RO - 1, RO - 1, (px, py, ex, ey) => {
    const r = Math.hypot(ex, ey);
    if (r > 0.84) return ex + ey < -0.4 ? C.lint : ex + ey > 0.6 ? C.dusk : C.lav;
    if (r > 0.62) return C.plum;
    return bay(px, py, 0.25, C.purD, C.plum);
  });
  // 속 바닥에 몰린 빨래(문이 열려 빛이 들어 유리 너머보다 한 단 밝다). 양말 색은 안 쓴다: 날아가는 양말만 분홍이다
  for (let i = 0; i < 5; i++) {
    const bx = cx - 6 + hash(5, i, 1) * 12, by = cy + 6 + hash(5, i, 2) * 3;
    ellipse(img, bx, by, 2.6, 1.7, (px, py, ex, ey) => (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) < RO - 4 ? (ey > 0.3 ? C.dusk : [C.pur, C.lav, C.grn][i % 3]) : undefined));
  }
  // X자 테이프: 문과 같이 찢겨 몸 위 끝 토막(대각선 t ≥ 12)만 남는다. 찢긴 쪽 끝은 한 칸 들쭉날쭉
  const T = RO + 2;
  for (let t = 12; t <= T; t++)
    for (const sx of [1, -1])
      for (const sy of [1, -1]) {
        if (t === 12 && hash(sx, sy, 9) < 0.5) continue;
        if (t === T && hash(cx + sx * t, sy * t, 7) < 0.5) continue;
        const px = cx + sx * t, py = cy + sy * t * sx;
        img.set(px, py, C.tan);
        img.set(px + 1, py, C.tan);
        if (t < T) img.set(sx * sy === 1 ? px : px + 2, py + 1, C.woodL);
      }
  // 열린 문: 경첩 두 개(몸 왼쪽 끝) + 좁은 세로 타원. 바깥 링 lint/lav, 안쪽 유리 띠 purD, 테이프가 접혀 tan 두 점, 손잡이는 맨 왼쪽
  const hx = x - DRYER_DOOR_SWING / 2;
  for (const dy of [-10, 8]) fill(img, x - 1, cy + dy, 4, 2, (px, py) => (py === cy + dy ? C.lint : C.dusk));
  ellipse(img, hx, cy, DRYER_DOOR_SWING / 2, RO, (px, py, ex) => (ex < -0.55 ? C.white : ex < 0.1 ? C.lint : ex < 0.6 ? C.purD : C.lav));
  for (const dy of [-6, 5]) { img.set(Math.floor(hx), cy + dy, C.tan); img.set(Math.floor(hx), cy + dy + 1, C.tan); }
  fill(img, x - DRYER_DOOR_SWING, cy - 4, 1, 8, C.lav);
}
