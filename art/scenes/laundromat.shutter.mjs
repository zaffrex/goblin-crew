// 화면 1 `laundromat` 앞문 철제 셔터 (#764, m2-art-split.md "셔터"는 L칸). 상태 그림 3벌: 잠김 / 풀림 / 올라감.
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 배경·물건 시트가 생기면 거기서 부른다(시트가 생기는 순간 hotspot-coverage 검사가 켜진다).
// #802 재료 목록 1절 "그대로 두는 것": 셔터에 갇힘 → 문밖 까치는 이야기 고리라 남는다. 여는 방법은 Kai 몫이라
//   감기는 애니(U4)·매달림(U6·U7)은 여기서 안 그린다. 상태 그림 세 장만 그린다.
// 배경이라 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 3-1). 광원은 왼쪽 위 형광등 하나(결정 3-3, 새벽 4시 10분 가게 안).
// 빨강은 이 화면에서 걸쇠와 プピ 장화만 쓴다(laundromat.md X4) → 셔터에 빨강 없음.
//
// 자리: 히트 상자 24, 140, 128×104 (content/screens/laundromat.json). 손잡이 = 맨 아래 가로 막대 24, 238, 128×4.
//   셔터 통(감는 상자)은 히트 상자 위 y 124~139에 붙는 배경이다(천장선 y 120).
// 색: 판 주색 lint(Y178). 걸쇠 빨강(Y104)과 74 차라 걸쇠가 먼저 눈에 들어온다(lav Y131이면 27 차라 걸쇠가 묻힌다).
//   손잡이 앞에 서는 ズッシー(셔츠 white Y249, 멜빵 teal Y86)·걸쇠 밑 ノビー(셔츠 red Y104, 바지 dusk Y87)와 모두 70 이상.
// 미리보기·검사: node docs/design/screens/laundromat-shutter-preview.mjs

import { C } from '../lib/pixel.mjs';
import { hash, bay, fill } from '../lib/texture.mjs';

/** 히트 상자와 같은 자리(화면 좌표). */
export const SHUTTER = { x: 24, y: 140, w: 128, h: 104 };
/** 셔터 통(배경): 히트 상자 위 */
export const HOUSING = { x: 20, y: 124, w: 136, h: 16 };
const RAIL = 6; // 가이드 레일 폭(양쪽)

/**
 * 셔터 통 + 레일 + 판 + 손잡이를 그린다. 좌표는 화면 좌표 그대로(SHUTTER 기준).
 * @param {'locked'|'loose'|'up'} state
 *   locked: 잠김. 판이 바닥까지 꽉.
 *   loose : 풀림. 판이 1px 내려앉아 통 밑에 어두운 틈 한 줄, 바닥 고무가 눌려 그 줄에 문밖 가로등 빛이 샌다(아래 틈 빛줄).
 *           바닥으로 번지는 빛 두 줄(y 244~245)도 같이 그린다(바닥 위에 덮어 그림).
 *   up    : 올라감. 판은 통 안으로 감기고 손잡이 막대만 통 밑(y 140~143)에 남는다. 문밖 새벽 거리가 보인다.
 */
export function shutter(img, state = 'locked') {
  const { x, y, w, h } = SHUTTER;
  const X0 = x + RAIL, X1 = x + w - RAIL; // 판 안쪽 [X0, X1)
  const BAR_Y = y + h - 6; // 238: 손잡이 막대 4줄 238~241, 고무 242~243
  const drop = state === 'loose' ? 1 : 0;

  // ── 문밖(올라감 때만 보인다): 새벽 4시 10분. 하늘 위 purD → 아래 pur(동이 트기 직전이라 건물보다 밝다),
  //    맞은편 건물 실루엣 dusk, 불 켜진 창 하나, 보도. 건물·하늘 모두 까치(ink)보다 60 이상 밝아서 날아가는 까치가 묻히지 않는다
  //    (plum Y54 건물이면 ink Y25와 29 차라 묻힌다).
  if (state === 'up') {
    const SKY_LOW = y + 14, CURB = y + h - 16;
    fill(img, X0, y, X1 - X0, h, (px, py) => {
      if (py >= CURB) return py === CURB ? C.lav : py === CURB + 1 ? C.lint : (px + (py >> 1)) % 7 === 0 ? C.dusk : C.lav; // 보도: 연석 밝은 줄 + 판석 줄눈
      if (py >= SKY_LOW) return bay(px, py, (py - SKY_LOW) / 22, C.purD, C.pur);
      return C.purD;
    });
    // 맞은편 건물 셋(지붕 높이만 다르게). 창 하나만 불이 켜졌다(새벽에 깬 사람이 하나 더 있다)
    const BLD = [[X0, 40, y + 34], [X0 + 40, 36, y + 50], [X0 + 76, X1 - X0 - 76, y + 28]];
    for (const [bx, bw, top] of BLD) {
      fill(img, bx, top, bw, CURB - top, (px, py) => (py === top ? C.lav : C.dusk));
      for (let wy = top + 8; wy < CURB - 10; wy += 14)
        for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) fill(img, wx, wy, 5, 6, C.purD);
    }
    fill(img, X0 + 82, y + 50, 5, 6, (px, py) => (py === y + 50 ? C.yelL : C.yel));
    // 가로등 한 개(왼쪽 앞): 기둥 dusk + 등 yelL, 보도에 노란 점 몇 개
    fill(img, X0 + 18, y + 30, 2, CURB - y - 30, C.plum);
    fill(img, X0 + 15, y + 28, 8, 3, C.plum);
    fill(img, X0 + 16, y + 31, 6, 1, C.yelL);
    // 가로등 빛 웅덩이: 보도 위 납작한 타원 두 겹(tan 안 / 바깥 yelD 점무늬, 등 색과 같은 따뜻한 쪽)
    for (let py = CURB + 2; py < y + h; py++) for (let px = X0; px < X0 + 40; px++) {
      const d = Math.hypot((px - (X0 + 19)) / 16, (py - (CURB + 7)) / 5);
      if (d < 0.6) img.set(px, py, C.tan);
      else if (d < 1 && bay(px, py, 0.5, 0, 1)) img.set(px, py, C.yelD);
    }
  }

  // ── 가이드 레일(양쪽 6px): 왼쪽 레일은 빛 쪽이라 한 단 밝다. 안쪽 홈은 dusk 한 줄
  const rail = (rx, lit) => fill(img, rx, y, RAIL, h, (px, py) => {
    const d = px - rx;
    if (py >= y + h - 2) return C.dusk; // 바닥 고정 쇠
    if (d === (lit ? RAIL - 1 : 0)) return C.dusk; // 판 쪽 홈
    if (d === (lit ? 0 : RAIL - 1)) return lit ? C.cotton : C.lav; // 바깥 모서리
    return lit || py < y + 16 ? C.lint : C.lav;
  });
  rail(x, true);
  rail(X1, false);

  // ── 판(골판 슬랫 4px 간격): 위 1줄 cotton(빛 받는 면) / 2줄 lint / 1줄 lav(골). 아래로 갈수록 형광등에서 멀어 lav가 섞인다
  if (state !== 'up') {
    const TOP = y + drop;
    if (drop) fill(img, X0, y, X1 - X0, drop, C.plum); // 통 밑에 생긴 틈
    fill(img, X0, TOP, X1 - X0, BAR_Y + drop - TOP, (px, py) => {
      const k = (py - TOP) % 4;
      const far = (py - y) / h; // 0 위 ~ 1 아래
      if (k === 3) return C.lav;
      if (k === 0) return far > 0.8 ? C.lint : C.cotton; // 아래 1/5은 빛 받는 면이 없어진다
      return k === 2 && far > 0.6 ? C.lav : C.lint; // 아래 2/5는 골이 두 줄(점무늬 없이 줄 굵기로 어둡게)
    });
    // 오른쪽 끝 4px 그늘(레일 그림자). 위 16px(걸쇠 자리 140~151)는 형광등에 가까워 그늘이 없다:
    //   걸쇠 둘레가 lav(Y131)면 빨강(Y104)과 27 차라 걸쇠가 묻힌다
    fill(img, X1 - 4, TOP + 16, 4, BAR_Y + drop - TOP - 16, (px, py) => ((py - TOP) % 4 === 3 ? C.dusk : C.lav));
    // 긁힌 자국 몇 줄(오래 쓴 가게): 슬랫 골 사이 짧은 밝은 점
    for (let i = 0; i < 7; i++) {
      const sx = X0 + 8 + Math.floor(hash(i, 3, 41) * (X1 - X0 - 24)), sy = TOP + 6 + Math.floor(hash(i, 4, 41) * 80);
      if ((sy - TOP) % 4 === 1) { img.set(sx, sy, C.white); img.set(sx + 1, sy, C.cotton); }
    }
  }

  // ── 손잡이 막대(맨 아래 가로 막대 전체, 24~151): 위 lint 빛줄 / lav 2줄 / dusk 그늘. 올라감이면 통 바로 밑
  const by = state === 'up' ? y : BAR_Y + drop;
  fill(img, x, by, w, 4, (px, py) => {
    const k = py - by;
    if (k === 0) return px - x < w * 0.6 ? C.cotton : C.lint;
    if (k === 3) return C.dusk;
    return C.lav;
  });
  // 손 닿는 자리 두 군데만 칠이 벗겨져 한 단 밝다(어디든 잡는다는 걸 막지 않는 정도로 작게)
  for (const hx of [x + 40, x + 84]) fill(img, hx, by + 1, 6, 1, C.lint);

  // ── 바닥 고무(242~243): 잠김은 plum 두 줄. 풀림은 고무가 눌려 아래 줄에 빛이 샌다
  if (state !== 'up') {
    const gy = BAR_Y + 4 + drop;
    fill(img, X0, gy, X1 - X0, y + h - gy, (px, py) => {
      if (state === 'loose' && py === y + h - 1) return bay(px, py, 0.25, C.yelL, C.tan); // 틈 빛줄
      return C.plum;
    });
    if (state === 'loose') {
      // 바닥으로 번지는 빛 두 줄(가운데가 길고 끝은 점점이)
      for (let px = X0; px < X1; px++) {
        const t = Math.abs((px - (X0 + X1) / 2) / ((X1 - X0) / 2));
        if (t < 0.9 && bay(px, y + h, t * 0.8, 1, 0)) img.set(px, y + h, C.yelL);
        if (t < 0.6 && bay(px, y + h + 1, 0.2 + t, 1, 0)) img.set(px, y + h + 1, C.tan);
      }
    }
  }

  // ── 셔터 통: lav 상자, 위 1줄 lint(빛), 아래 1줄 dusk, 오른쪽 끝 그늘. 앞면에 나사 둘
  const { x: hx0, y: hy0, w: hw, h: hh } = HOUSING;
  fill(img, hx0, hy0, hw, hh, (px, py) => {
    const dx = px - hx0, dy = py - hy0;
    if (dy === 0) return C.lint;
    if (dy === hh - 1) return C.dusk;
    if (dx === 0) return C.lint;
    if (dx >= hw - 3) return C.dusk;
    return dy < 4 ? C.lint : C.lav;
  });
  fill(img, hx0 + 1, hy0 + hh - 3, hw - 4, 1, C.dusk); // 아래 테두리 접은 선
  for (const sx of [hx0 + 6, hx0 + hw - 9]) { img.set(sx, hy0 + 6, C.dusk); img.set(sx, hy0 + 5, C.cotton); }
}
