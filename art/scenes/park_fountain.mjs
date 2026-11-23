// 화면 2 `park_fountain` 그림 원본 (#380, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md).
// 배경(bg)에는 만질 수 없는 것만 그린다. ink(0)·hint(31) 금지(ADR-0007 결정 3-1), 광원은 왼쪽 위 하나(아침 7시 57분).
// 구도·색은 구도 시안(docs/design/screens/park_fountain-bg-sketch.mjs)에서 정한 그대로 옮기고, 밀도를 화면 1(magpie_nest.mjs)만큼 올렸다.
//   시안에서 정한 것 셋(설계 park_fountain.md 12절 아래 "배경 구도 시안"): 물줄기 뒤는 짙은 나무·거뭇한 동상,
//   재킷은 분홍(꼭대기 = 밝은 하늘 앞, 손 = 짙은 나무 앞), 흙길 주색 woodL(Y149).
// 물건·일시 연출은 art/scenes/park_fountain.objects.mjs에 그린다. 그 파일을 고치면 `node art/build.mjs`로 시트를 다시 만들어 같이 커밋한다(npm test가 --check로 막는다).
// 미리보기·검사: node docs/design/screens/park_fountain-bg-preview.mjs

import { C } from '../lib/pixel.mjs';
import { hash, rng, bay, fill, ellipse, line, stamp, darker, tuft, daisy, clover, pebble } from '../lib/texture.mjs';
import { OBJECTS, ANIMS } from './park_fountain.objects.mjs';
import { statue, statueDrips } from './park_fountain.statue.mjs';

export const W = 480, H = 270;
/** 흙길 시작(걷기 영역 위 끝 200보다 2px 위). 아래로는 다 걷는 바닥이다. */
export const PATH_TOP = 198;
/** 생울타리 위 끝(대략). 그 위는 하늘·먼 거리·나무 띠다. */
export const HEDGE_TOP = 152;
const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);

// ═════════════ ① 하늘 ═════════════
/** 아침. 위는 옅은 물색, 지평선 쪽은 해 뜬 지 얼마 안 된 크림빛. 구름 셋(왼쪽 위 빛, 아래는 그늘), 먼 새 둘. */
function sky(bg) {
  fill(bg, 0, 0, W, 160, (x, y) => (y < 40 ? C.aqua : y < 90 ? bay(x, y, (y - 40) / 50, C.aqua, C.cotton) : bay(x, y, (y - 90) / 60, C.cotton, C.yelL)));
  // 구름: 덩어리 몇 개를 겹친다. 윗면 흰색, 아래 1~2줄 cotton, 맨 아래 lint 점선(아침 해가 낮아 아래가 그늘)
  const cloud = (cx, cy, parts) => {
    for (const [dx, dy, rx, ry] of parts) {
      ellipse(bg, cx + dx, cy + dy, rx, ry, (x, y, ex, ey) => (ey > 0.55 ? (hash(x, y, 3) < 0.5 ? C.lint : C.cotton) : ey > 0.15 ? C.cotton : C.white));
    }
    for (let x = cx - 30; x < cx + 30; x++) if (bg.get(x, cy + 4) === C.cotton && bg.get(x, cy + 5) !== C.cotton && hash(x, 0, 4) < 0.4) bg.set(x, cy + 4, C.lint);
  };
  cloud(70, 26, [[0, 2, 24, 4], [-8, -1, 10, 5], [6, -3, 9, 5], [16, 0, 7, 4]]);
  cloud(398, 40, [[0, 2, 30, 4], [-12, -2, 11, 5], [4, -4, 12, 6], [18, -1, 8, 4]]);
  cloud(300, 16, [[0, 1, 12, 2.5], [-3, -1, 6, 3]]); // 작은 조각(돌우산 x 192~256 바깥)
  // 먼 새 둘(V자 한 획). 비둘기와 헷갈리지 않게 아주 작다
  for (const [x, y] of [[132, 22], [141, 18]]) { bg.set(x, y, C.lav); bg.set(x + 1, y + 1, C.lav); bg.set(x + 2, y, C.lav); }
}

// ═════════════ ② 먼 거리(오른쪽): 공원 담 너머 낮은 건물 ═════════════
/** 하늘보다 한 단계만 어둡게(대비 낮게 뒤로 물러나게). 지붕 끝 한 줄, 창 몇 개는 아침 해를 받아 크림·노랑. */
function town(bg) {
  const blocks = [[318, 34, 112, 'flat'], [352, 26, 100, 'tank'], [378, 40, 118, 'roof'], [430, 50, 106, 'flat']];
  for (const [x0, w, top, kind] of blocks) {
    fill(bg, x0, top, w, 150 - top, (x, y) => {
      if (x === x0 + w - 1) return C.lav; // 오른쪽 그늘
      if (x === x0) return C.cotton; // 왼쪽 위 빛
      if (y === top) return C.cotton;
      return hash(x >> 2, y >> 2, x0) < 0.08 ? bay(x, y, 0.5, C.lint, C.purL) : C.lint;
    });
    for (let y = top + 5; y < 146; y += 9) {
      for (let x = x0 + 4; x < x0 + w - 5; x += 8) {
        const lit = hash(x, y, 5) < 0.3;
        R(bg, x, y, 3, 4, lit ? C.yelL : C.cotton);
        R(bg, x, y, 3, 1, C.purL); // 창 위 그늘
        if (!lit && hash(x, y, 6) < 0.4) R(bg, x + 1, y + 1, 2, 3, C.purL); // 커튼 친 창
      }
    }
    if (kind === 'roof') { // 낮은 박공 지붕
      for (let i = 0; i < 6; i++) R(bg, x0 + i * 2, top - 1 - i, w - i * 4, 1, i === 0 ? C.lav : C.purL);
    }
    if (kind === 'tank') { // 옥상 물탱크 + 다리
      R(bg, x0 + 7, top - 9, 12, 7, C.purL); R(bg, x0 + 7, top - 9, 12, 1, C.cotton); R(bg, x0 + 18, top - 9, 1, 7, C.lav);
      for (const lx of [x0 + 8, x0 + 17]) R(bg, lx, top - 2, 1, 2, C.lav);
    }
    if (kind === 'flat') { // 난간 + 안테나
      for (let x = x0 + 2; x < x0 + w - 2; x += 3) bg.set(x, top - 1, C.lint);
      line(bg, x0 + w - 8, top - 1, x0 + w - 8, top - 8, C.lav); line(bg, x0 + w - 11, top - 6, x0 + w - 5, top - 6, C.lav);
    }
  }
}

// ═════════════ ③ 큰 나무 무리 ═════════════
/**
 * 분수 기둥 바로 뒤를 진한 초록으로 막는다. 물(밝은 물색·흰 물보라)이 이 위에서 뜬다(물 뒤 주색 검사).
 * 꼭대기는 y 60 아래로 둬서 돌우산·꼭대기 재킷(y 32~52)은 하늘 위에 남긴다.
 * 잎 덩어리마다 왼쪽 위에 빛(grnL·grnP 점), 아래·오른쪽은 grnD, 덩어리 사이 틈은 더 어둡게 + 가지가 비친다.
 */
const CANOPY = [[176, 104, 52, 42], [236, 92, 46, 34], [294, 102, 48, 40], [140, 128, 34, 26], [328, 128, 34, 24], [262, 134, 26, 16], [414, 118, 44, 34]];
function trees(bg) {
  // 줄기 몇 개(울타리 뒤로 사라짐). 왼쪽 빛 1줄 + 껍질 결
  for (const [x, w] of [[120, 4], [356, 5], [404, 6], [188, 5], [276, 5]]) {
    fill(bg, x, 136, w, 34, (px, py) => (px === x ? C.wood : px === x + w - 1 ? C.woodD : (py + px * 3) % 7 === 0 ? C.woodD : C.wood));
  }
  // 나무 밑 덤불: 덩어리 아래와 생울타리 사이로 하늘이 비치지 않게(나무가 떠 보이지 않게) 짙은 덤불 띠를 깐다
  fill(bg, 124, 132, 236, 24, (x, y) => {
    const top = 138 + Math.round(3 * Math.sin(x / 9) + 2 * Math.sin(x / 4.3) + hash(x >> 2, 0, 33) * 3);
    if (y < top) return undefined;
    return y < top + 2 && hash(x, y, 34) < 0.5 ? C.grn : hash(x >> 1, y >> 1, 35) < 0.2 ? C.grn : C.grnD;
  });
  // 덩어리 틈으로 비치는 가지: 짙은 잎 위에만 찍는다(밝은 잎 위로 긁힌 선처럼 보이지 않게)
  const branch = (x0, y0, x1, y1) => line(bg, x0, y0, x1, y1, (x, y) => (bg.get(x, y) === C.grnD ? C.woodD : undefined));
  for (const [cx, cy, rx, ry] of CANOPY) {
    const zone = (x, y) => { const v = (x - cx) / rx + (y - cy) / ry; return v < -0.55 ? 2 : v < 0.25 ? 1 : 0; }; // 큰 덩어리의 빛 단계
    // 바탕: 빛 단계 사이를 디더로 잇는다
    ellipse(bg, cx, cy, rx, ry, (x, y, dx, dy) => {
      const v = dx + dy;
      if (v < -0.75) return C.grnL;
      if (v < -0.4) return bay(x, y, (v + 0.75) / 0.35, C.grnL, C.grn);
      if (v < 0.15) return C.grn;
      if (v < 0.5) return bay(x, y, (v - 0.15) / 0.35, C.grn, C.grnD);
      return C.grnD;
    });
    for (const [x0, y0, x1, y1] of [[cx - 2, cy + ry - 4, cx - 8, cy + 6], [cx - 6, cy + 10, cx - 14, cy + 2], [cx + 1, cy + ry - 6, cx + 9, cy + 8]]) branch(x0, y0, x1, y1);
    // 잎 뭉치: 지름 4~7px 둥근 덩이를 흩뿌린다. 덩이마다 왼쪽 위 2~3px가 한 단 밝고, 오른쪽 아래 끝이 한 단 어둡다.
    //   덩이 색은 그 자리의 빛 단계를 따른다(밝은 쪽 grnL/grnP, 가운데 grn/grnL, 그늘 grnD/grn).
    const r = rng(cx * 13 + cy * 3);
    const n = Math.round((rx * ry) / 9);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.92;
      const bx = Math.round(cx + Math.cos(a) * d * rx), by = Math.round(cy + Math.sin(a) * d * ry);
      const br = 2 + r() * 1.6;
      const z = zone(bx, by);
      const [body, hi, lo] = z === 2 ? [C.grnL, C.grnP, C.grn] : z === 1 ? [C.grn, C.grnL, C.grnD] : [C.grnD, C.grn, C.grnD];
      ellipse(bg, bx, by, br, br * 0.85, (x, y, ex, ey) => {
        if ((x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2 > 1) return undefined; // 큰 덩어리 바깥으로 안 나감
        if (ex + ey < -0.7) return hi;
        if (ex + ey > 0.9 && z !== 0) return lo;
        if (z === 0 && ex + ey > 0.6) return undefined; // 그늘 쪽 덩이는 아래 바탕(grnD)에 녹인다
        return body;
      });
      if (z === 2 && r() < 0.3) bg.set(bx - 1, by - 1, C.grnP); // 반짝 잎
    }
    // 바깥 가장자리 잎 몇 장이 삐져나온다(둥근 테두리가 매끈하지 않게)
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, px = Math.round(cx + Math.cos(a) * (rx + 1)), py = Math.round(cy + Math.sin(a) * (ry + 1));
      if (py > 146) continue;
      const c = Math.cos(a) + Math.sin(a) < -0.3 ? C.grnL : Math.cos(a) + Math.sin(a) < 0.4 ? C.grn : C.grnD;
      bg.set(px, py, c); bg.set(px + (Math.cos(a) > 0 ? 1 : -1), py, c); bg.set(px, py - 1, c);
    }
  }
}

// ═════════════ ④ 생울타리 + 잔디 띠 ═════════════
/** 공원 뒤쪽 경계. 분수 연못 뒤를 가로지른다. 위 끝은 둥글게 다듬은 덩어리, 아래로 갈수록 그늘. */
function hedge(bg) {
  fill(bg, 0, HEDGE_TOP, W, 32, (x, y) => { // 관리실 왼쪽(x < 16)에도 이어진다. 집이 나중에 덮는다
    const top = HEDGE_TOP + Math.round(2 + 2 * Math.sin(x / 7) + hash(x >> 1, 0, 9) * 2);
    if (y < top) return undefined;
    const lx = ((x % 7) + 7) % 7;
    if (y < top + 2) return lx < 3 ? C.grnP : C.grnL; // 다듬은 윗면에 아침 빛
    if (y < top + 4) return hash(x, y, 10) < 0.5 ? C.grnL : C.grn;
    // 잎 결: 작은 쐐기 무늬가 줄지어 있다
    const leaf = (x + (y >> 1) * 2) % 5 === 0 && hash(x >> 1, y >> 1, 11) < 0.6;
    if (leaf) return y < 168 ? C.grnL : C.grn;
    return bay(x, y, (y - 160) / 26, C.grn, C.grnD);
  });
  // 밑동 그늘 1줄
  for (let x = 0; x < W; x++) if (hash(x, 1, 12) < 0.7) bg.set(x, 183, C.grnD);
  // 잔디 띠(울타리 앞 ~ 흙길 위 끝): 앞으로 올수록 밝다
  fill(bg, 0, 182, W, PATH_TOP - 182, (x, y) => {
    if (y < 185 && x >= 120) return bay(x, y, (y - 182) / 4, C.grn, C.grnL);
    if (hash(x, y, 12) < 0.12) return C.grnP;
    if (hash(x, y, 13) < 0.1) return C.grn;
    return C.grnL;
  });
  const r = rng(31);
  for (let i = 0; i < 46; i++) tuft(bg, Math.floor(r() * W), 188 + Math.floor(r() * 9), r, 0);
  for (let i = 0; i < 9; i++) { const x = 340 + i * 13 + (i % 3) * 3, y = 186 + (i % 2) * 5; daisy(bg, x, y); }
  for (const x of [8, 22, 112]) daisy(bg, x, 192);
  // 잔디가 흙길로 넘어오는 가장자리(들쭉날쭉)
  for (let x = 0; x < W; x++) if (hash(x, 2, 14) < 0.35) bg.set(x, PATH_TOP - 1, C.grn);
}

// ═════════════ ⑤ 관리실(왼쪽) ═════════════
/**
 * 매점만 한 작은 집. 크림빛 가로 판벽, 진한 빨강 줄무늬 차양. 창(관리인 핫스팟 36,114 44×36) 안쪽은 물건이 그린다.
 * 벽시계는 7시 57분에 멈춰 있다("8시 청소"의 확인, 설계 1-1 배경 / 9절 벽시계). 간판은 글자 없이 빗자루·물방울.
 * 아래 벽: 물뿌리개 + 양동이·대걸레(관리인이 분수를 청소한다는 것).
 */
function keeperHouse(bg) {
  const X0 = 16, X1 = 120, TOP = 94;
  // 판벽: 10px 판마다 아랫줄 그늘, 윗줄 빛, 나뭇결 몇 줄, 오른쪽 끝은 모서리 기둥 그늘
  fill(bg, X0, TOP, X1 - X0, PATH_TOP - TOP, (x, y) => {
    const ly = (y - TOP) % 10, board = Math.floor((y - TOP) / 10);
    if (x >= X1 - 6) return x >= X1 - 2 ? C.wood : x === X1 - 6 ? C.tan : C.woodL; // 모서리 기둥
    if (x <= X0 + 1) return x === X0 ? C.woodL : C.tan;
    if (ly === 9) return C.woodL; // 판 아래 그림자
    if (ly === 0) return hash(x, board, 15) < 0.8 ? C.cotton : C.tan; // 판 윗모서리 빛
    if (ly === 4 && hash(x >> 3, board, 16) < 0.18 && hash(x, y, 17) < 0.6) return C.cotton; // 결(드문드문)
    if (hash(x, y, 18) < 0.025) return C.woodL; // 옹이 점
    return C.tan;
  });
  // 판 이음매(판마다 다른 자리) + 못
  for (let b = 0; b < 10; b++) {
    const jx = X0 + 10 + Math.floor(hash(b, 0, 19) * 70), y = TOP + b * 10;
    if (y + 9 >= PATH_TOP) break;
    R(bg, jx, y + 1, 1, 8, C.woodL);
    bg.set(jx - 2, y + 4, C.lint); bg.set(jx + 2, y + 4, C.lint);
  }
  // 차양 그늘(벽 위 4줄, 줄무늬 끝 따라 들쭉날쭉)
  for (let x = X0; x < X1; x++) for (let y = TOP; y < TOP + 3 + ((x - 12) % 8 < 4 ? 1 : 0); y++) bg.set(x, y, darker(bg.get(x, y)));
  // 지붕(차양 위 납작한 처마 + 환기통)
  R(bg, 12, 80, 112, 4, C.dusk); R(bg, 12, 80, 112, 1, C.lav); R(bg, 100, 72, 6, 8, C.lav); R(bg, 100, 72, 1, 8, C.lint); R(bg, 98, 71, 10, 2, C.dusk);
  // 차양: 진한 빨강 바탕 + 빨강·흰 줄무늬, 아래 끝은 반원 물결
  R(bg, 10, 84, 116, 3, C.redD);
  for (let x = 10; x < 126; x++) {
    const stripe = Math.floor((x - 10) / 8) % 2 === 0;
    for (let y = 87; y < 94; y++) bg.set(x, y, stripe ? (x % 8 === 2 && y < 90 ? C.redL : C.red) : (y === 87 ? C.white : C.cotton));
    const lx = (x - 10) % 8; // 물결 끝: 칸마다 가운데가 2px 더 내려온다
    if (lx >= 2 && lx <= 5) bg.set(x, 94, stripe ? C.redD : C.lint);
  }
  for (let x = 10; x < 126; x++) bg.set(x, 84, x < 60 ? C.redL : C.red); // 차양 윗모서리 빛
  // 간판(빗자루와 물방울 그림: 글자 없이 "관리실"로 읽히게)
  // 간판 아래 끝(y 106)은 창 위 인방(y 108) 위에 걸린다
  R(bg, 33, 96, 42, 11, C.woodD); R(bg, 34, 97, 40, 9, C.wood); R(bg, 34, 97, 40, 1, C.woodL);
  line(bg, 42, 103, 52, 98, C.tan); line(bg, 42, 104, 52, 99, C.woodL);
  stamp(bg, 38, 101, ['.yy', 'yyY', 'yY.'], { y: C.yelD, Y: C.yel }); // 빗자루 솔
  stamp(bg, 60, 98, ['..a..', '.aAa.', 'aAwaa', '.aaa.'], { a: C.tealL, A: C.aqua, w: C.white }); // 물방울
  bg.set(36, 98, C.lint); bg.set(72, 98, C.lint); // 간판 못
  // 벽시계 7시 57분: 나무 테 + 바랜 판 + 12·3·6·9 점, 왼쪽 위 빛
  // 판은 white가 아니라 cotton: 흰 판이 화면에서 가장 밝은 점이라 "누르는 물건"처럼 보였다(#601 모바일 1회).
  // 관리인 `keeper.clean_time`이 돌아보는 확인 단서라 지우지 않고 한 톤만 내린다.
  ellipse(bg, 98, 105, 6.5, 6.5, (x, y) => {
    const d = Math.hypot(x + 0.5 - 98, y + 0.5 - 105);
    if (d > 5.4) return x + y < 98 + 105 - 2 ? C.wood : C.woodD;
    return d > 4.6 && x + y > 98 + 105 + 2 ? C.lint : C.cotton;
  });
  for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) bg.set(98 + dx, 105 + dy, C.lav);
  {
    const hand = (deg, len, c) => { const a = (deg - 90) * Math.PI / 180; line(bg, 98, 105, Math.round(98 + Math.cos(a) * len), Math.round(105 + Math.sin(a) * len), c); };
    hand(7 * 30 + 57 * 0.5, 3, C.plum); // 시침: 8 바로 앞
    hand(57 * 6, 5, C.dusk); // 분침: 12 바로 앞
  }
  bg.set(98, 97, C.lav); // 걸이 못
  // 창틀(배경): 핫스팟 창 36,114 44×36을 두르는 나무 틀 + 위 인방 + 창턱(자명종이 앉는 곳)
  R(bg, 33, 111, 50, 42, C.wood); R(bg, 33, 111, 50, 1, C.woodL); R(bg, 33, 111, 1, 42, C.woodL); R(bg, 82, 111, 1, 42, C.woodD);
  R(bg, 31, 108, 54, 3, C.woodD); R(bg, 31, 108, 54, 1, C.wood);
  R(bg, 28, 150, 80, 4, C.woodL); R(bg, 28, 150, 80, 1, C.tan); R(bg, 28, 153, 80, 1, C.wood);
  for (let x = 29; x < 108; x++) bg.set(x, 154, darker(bg.get(x, 154))); // 창턱 그늘
  for (const bx of [32, 102]) { R(bg, bx, 154, 3, 3, C.wood); bg.set(bx + 2, 156, C.woodD); } // 창턱 받침
  // 창턱 위 화분 하나(자명종 자리 x 80~104 밖, 왼쪽)
  stamp(bg, 28, 143, ['..g.g.', '.gGgg.', 'gGgGgg', '.gggG.', 'rrrrrr', '.rRrr.', '.rrrr.'], { g: C.grn, G: C.grnL, r: C.redL, R: C.pinkL });
  // 아래 벽: 물뿌리개 + 양동이·대걸레
  // (호스 걸이는 지웠다: 초록 고리 + 쇠 꼭지가 "물 잠그는 곳"으로 읽히는데 반응이 없어서 불공정한 미끼였다. #601 모바일 1회)
  stamp(bg, 84, 184, ['......t..', '..tttt.t.', '.tTTttt.t', 'tTTtttttt', 'tTttttt.t', '.ttttt..t', '.ttttt...', '.dddd....'], { t: C.tealM, T: C.tealL, d: C.teal });
  // 대걸레(벽에 기대 비스듬히) + 양동이
  // (오른쪽 창턱 아래 x 92~110 흙길 가장자리는 자명종이 떨어지는 자리(objects `fallen` 96,189)라 비워 둔다)
  line(bg, 28, 160, 23, 190, C.wood); line(bg, 29, 160, 24, 190, C.woodD);
  stamp(bg, 19, 187, ['.cll.', 'clclc', 'lclcl', 'clclc', 'l.l.l'], { l: C.lint, c: C.cotton }); // 대걸레 술
  stamp(bg, 66, 186, ['.lllll.', 'lcccccl', 'lclllll', '.llllll', '.lllll.', '..lll..'], { l: C.lint, c: C.cotton });
  R(bg, 68, 186, 5, 1, C.tealM); // 양동이 안 물
  for (let x = 66; x < 73; x++) bg.set(x, 192, C.lav);
  // 집 아래 받침돌 1줄 + 홈통(오른쪽 모서리)
  fill(bg, X0, 194, X1 - X0, 4, (x, y) => (y === 194 ? C.cotton : (x - X0) % 13 === 12 ? C.lav : C.lint));
  R(bg, X1 - 4, 84, 2, 110, C.lint); R(bg, X1 - 4, 84, 1, 110, C.cotton);
  for (const y of [110, 140, 170]) R(bg, X1 - 5, y, 4, 1, C.lav);
  R(bg, X1 - 6, 192, 6, 2, C.lint); // 홈통 끝
}

// ═════════════ ⑥ 연못(뒤쪽) ═════════════
/** 테두리 뒤쪽 가장자리 + 물. 테두리 앞면(물건 `fountain`)이 아래를 덮는다. 물에는 동상과 나무가 비친다. */
function pond(bg) {
  ellipse(bg, 224, 182, 100, 16, (x, y) => {
    if (y >= 172) return undefined;
    if (y <= 167) return C.cotton; // 뒤 가장자리 윗면에 빛
    return (x - 124) % 16 === 15 ? C.lav : C.lint;
  });
  ellipse(bg, 224, 182, 96, 13, (x, y) => {
    if (y < 171) return C.tealM; // 뒤 가장자리 그늘에 붙은 물
    if (Math.abs(x - 224) < 10 && y < 178) return bay(x, y, 0.5, C.teal, C.tealM); // 동상 그림자 비침
    if (y < 176) return bay(x, y, 0.3, C.tealM, C.tealL);
    return hash(x >> 2, y, 41) < 0.2 ? C.tealM : C.teal;
  });
  for (const [x, y, w] of [[160, 174, 5], [196, 176, 4], [270, 173, 6], [300, 176, 4], [142, 178, 3], [252, 178, 5]]) { R(bg, x, y, w, 1, C.aqua); bg.set(x + w, y, C.tealL); }
  // 뒤 가장자리 이끼 몇 점
  for (const x of [150, 171, 262, 288]) { bg.set(x, 169, C.grn); bg.set(x + 1, 169, C.grnL); }
}

// ═════════════ ⑧ 가로등 ═════════════
/** 분수 오른쪽 뒤. 아침이라 꺼져 있다. 기둥 왼쪽 빛, 받침, 등갓. */
function lamp(bg) {
  R(bg, 307, 96, 3, 86, C.plum); R(bg, 307, 96, 1, 86, C.dusk);
  for (const y of [120, 150]) { R(bg, 306, y, 5, 2, C.plum); R(bg, 306, y, 5, 1, C.dusk); } // 마디 테
  stamp(bg, 304, 176, ['..ddddd..', '.dcccccd.', 'dccccccdd', 'ddddddddd'], { d: C.plum, c: C.dusk });
  stamp(bg, 302, 84, ['....ddd....', '..ddddddd..', '.dcccccccd.', 'dcaaaaaaacd', '.ddddddddd.', '..dllld....'], { d: C.plum, c: C.dusk, a: C.lint, l: C.cotton });
  R(bg, 305, 90, 5, 4, C.cotton); R(bg, 305, 90, 1, 4, C.white); R(bg, 309, 90, 1, 4, C.lint); // 꺼진 유리
  stamp(bg, 302, 94, ['.ddddddd.', '..ddddd..'], { d: C.plum });
}

// ═════════════ ⑨ 입구·벤치 ═════════════
/** 오른쪽 끝 돌기둥 + 낮은 철 울타리(창끝). 손님이 들어온 쪽. 벤치는 비어 있다(손님은 앉지 않고 서서 기다린다). */
function entrance(bg) {
  // 철 울타리: 위·아래 가로대, 세로 창살(끝이 창 모양), 왼쪽 빛
  for (let x = 332; x < 462; x += 6) {
    R(bg, x, 166, 1, 17, C.dusk);
    bg.set(x, 164, C.dusk); bg.set(x - 1, 165, C.dusk); bg.set(x + 1, 165, C.dusk); bg.set(x, 165, C.lav);
  }
  R(bg, 330, 168, 132, 1, C.dusk); R(bg, 330, 176, 132, 1, C.dusk); R(bg, 330, 167, 132, 1, C.lav);
  for (let x = 335; x < 462; x += 12) { bg.set(x, 171, C.dusk); bg.set(x, 172, C.dusk); bg.set(x - 1, 172, C.dusk); bg.set(x + 1, 172, C.dusk); } // 고리 장식
  // 돌기둥(벽돌 덩이 3단) + 머릿돌 + 공 장식
  const X = 462;
  fill(bg, X, 140, 16, 58, (x, y) => {
    const lx = x - X, ly = (y - 140) % 14;
    if (ly === 13) return C.lav; // 단 사이 줄눈
    if (lx < 2) return C.cotton;
    if (lx > 13) return C.lav;
    if (ly === 0) return C.cotton;
    return hash(x, y, 43) < 0.03 ? C.lav : C.lint;
  });
  for (let y = 190; y < 198; y++) for (let x = X; x < X + 16; x++) if (hash(x, y, 44) < (y - 189) * 0.08) bg.set(x, y, C.grn); // 밑동 이끼
  R(bg, X - 2, 134, 20, 6, C.cotton); R(bg, X - 2, 134, 20, 1, C.white); R(bg, X - 2, 139, 20, 1, C.lav); R(bg, X + 16, 134, 2, 6, C.lint);
  ellipse(bg, X + 8, 130, 5, 4, (x, y, ex, ey) => (ex + ey < -0.5 ? C.white : ex + ey > 0.6 ? C.lav : C.lint));
  // 벤치: 등받이 판 2장 + 앉는 판 + 쇠 다리. 등받이는 울타리 앞, 다리 그림자는 잔디
  for (const [y, c, cl] of [[176, C.wood, C.woodL], [180, C.wood, C.woodL]]) { R(bg, 360, y, 40, 2, c); R(bg, 360, y, 40, 1, cl); }
  R(bg, 358, 184, 44, 3, C.wood); R(bg, 358, 184, 44, 1, C.tan); R(bg, 358, 186, 44, 1, C.woodD);
  for (const lx of [362, 396]) { R(bg, lx, 175, 2, 21, C.plum); R(bg, lx, 175, 1, 21, C.dusk); }
  for (let x = 360; x < 402; x++) if (hash(x, 0, 45) < 0.8) bg.set(x, 196, C.grn);
  // 벤치 위에 누가 두고 간 신문(접힌 흰 종이, 글자 없음) — 볼거리
  stamp(bg, 380, 181, ['wwwwc', 'wlwlc', 'ccccc'], { w: C.white, l: C.lint, c: C.cotton });
  // 휴지통(벤치 오른쪽, 철망)
  fill(bg, 410, 180, 10, 16, (x, y) => (x === 410 ? C.lint : x === 419 ? C.dusk : (x + y) % 3 === 0 ? C.dusk : C.lav));
  R(bg, 409, 179, 12, 2, C.dusk); R(bg, 409, 179, 12, 1, C.lint);
  // 휴지통 옆 화분(빨간 꽃). 입구 기둥 앞은 손님(438~462)이 서는 자리라 비운다
  stamp(bg, 424, 186, ['.r.R.r.', 'rRgrgRr', '.grgrg.', 'ttttttt', '.tTttt.', '.ttttt.', '..ttt..'], { r: C.red, R: C.redL, g: C.grn, t: C.wood, T: C.woodL });
}

// ═════════════ ⑩ 흙길 + 아래 화단 ═════════════
/**
 * 걷는 바닥. 분수대 둘레를 돈다. 주색 woodL(Y149)은 세 사람 주색과 모두 30 이상 떨어진다(결정 3-4).
 * 테두리 흰 돌(cotton)과 73 차이(단서 ② "돌 / 흙"). 결: 바퀴 자국 두 줄, 자갈, 발자국, 테두리 그림자.
 */
function path(bg) {
  fill(bg, 0, PATH_TOP, W, 60, (x, y) => {
    if (y === PATH_TOP) return C.wood; // 잔디와 맞닿는 그늘
    if (y < PATH_TOP + 3 && x >= 128 && x < 322) return y === PATH_TOP + 1 ? C.wood : bay(x, y, 0.5, C.woodL, C.wood); // 분수대 테두리 그림자
    if (y < PATH_TOP + 3 && x >= 16 && x < 120) return bay(x, y, 0.5, C.woodL, C.wood); // 관리실 그림자
    const h = hash(x, y, 20);
    // 손수레 바퀴 자국 두 줄(물결): 관리인이 물뿌리개·양동이를 끌고 다닌 길
    const rut = Math.abs(y - (232 + Math.round(Math.sin(x / 40) * 3))) <= 0 || Math.abs(y - (238 + Math.round(Math.sin(x / 40) * 3))) <= 0;
    if (rut && hash(x >> 1, 0, 21) < 0.8) return C.wood;
    // 아주 옅은 얼룩(마른 곳·그늘진 곳)
    const n = Math.sin(x / 23 + Math.sin(y / 6)) + Math.sin(y / 9 - x / 31);
    if (n > 1.45 && hash(x, y, 23) < 0.35) return C.tan; // 마른 곳(옅게, 격자 무늬가 안 보이게 흩뿌림)
    if (n < -1.6 && hash(x, y, 24) < 0.18) return C.wood; // 그늘진 곳
    return h < 0.04 ? C.tan : h > 0.975 ? C.wood : C.woodL;
  });
  const r = rng(51);
  // 자갈(빛 받는 왼쪽 위, 아래 그림자)
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * W), y = 204 + Math.floor(r() * 50), w = 2 + Math.floor(r() * 2);
    R(bg, x, y, w, 1, C.tan); bg.set(x, y + 1, C.wood); if (w > 2) bg.set(x + w - 1, y + 1, C.wood);
  }
  for (const [x, y] of [[70, 246], [150, 214], [452, 222], [36, 228]]) pebble(bg, x, y, 4);
  // 발자국 몇 개(입구 쪽에서 분수대로: 손님이 왔다 갔다 한 자국)
  for (let i = 0; i < 6; i++) {
    const x = 452 - i * 14, y = 222 + (i % 2) * 4;
    stamp(bg, x, y, ['ww', 'ww', '..', 'w.'], { w: C.wood });
  }
  // 물 튄 자국: 분수대 테두리 앞(물줄기가 처마에서 떨어진 곳), 짙은 흙 + 반짝
  for (const [cx, cy, rx] of [[166, 206, 9], [282, 207, 8]]) {
    ellipse(bg, cx, cy, rx, 2.5, (x, y, ex, ey) => (Math.hypot(ex, ey) > 0.8 ? (hash(x, y, 52) < 0.5 ? C.wood : undefined) : C.wood));
    bg.set(cx - 2, cy - 1, C.tealM); bg.set(cx - 1, cy - 1, C.tealL);
  }
  // 길가 풀 몇 포기(관리실 앞·입구 앞)
  for (const [x, y] of [[6, 204], [12, 252], [124, 210], [330, 212], [474, 206], [470, 248]]) tuft(bg, x, y, r, 1);
}

/** 아래 끝 화단(화면 맨 아래 띠): 낮은 경계석 + 풀 + 들꽃. */
function bed(bg) {
  fill(bg, 0, 256, W, 2, (x, y) => (y === 256 ? ((x % 18) === 17 ? C.lav : C.cotton) : (x % 18) === 17 ? C.dusk : C.lint)); // 경계석
  fill(bg, 0, 258, W, 12, (x, y) => {
    if (y === 258) return hash(x, y, 53) < 0.4 ? C.grn : C.grnL;
    if (hash(x >> 1, y, 22) < 0.3) return C.grnL;
    return hash(x, y, 54) < 0.15 ? C.grnD : C.grn;
  });
  const r = rng(61);
  for (let i = 0; i < 30; i++) tuft(bg, Math.floor(r() * W), 262 + Math.floor(r() * 7), r, 1);
  for (let i = 0; i < 12; i++) daisy(bg, 8 + Math.floor(r() * 464), 262 + Math.floor(r() * 6));
  for (let i = 0; i < 8; i++) clover(bg, Math.floor(r() * W), 260 + Math.floor(r() * 8));
  for (let i = 0; i < 6; i++) { const x = Math.floor(r() * W), y = 262 + Math.floor(r() * 6); bg.set(x, y, C.pinkL); bg.set(x, y + 1, C.grn); } // 분홍 들꽃
}

// ═════════════ 볼거리: 풍선 ═════════════
// 비둘기 셋은 물건 시트로 옮겼다(#526, `park_fountain.objects.mjs` `pigeons`). 단서 ②에서 날아올랐다 내려앉아야 해서 배경에 박아 둘 수 없다.
/** 풍선 장수가 놓친 풍선 하나가 오른쪽 나무에 걸렸다(공원 분위기 볼거리). 줄은 가지에 감긴다. */
function balloon(bg) {
  line(bg, 418, 86, 419, 100, C.lav);
  ellipse(bg, 418, 82, 4, 5, (x, y, ex, ey) => (ex + ey < -0.6 ? C.pinkL : ex + ey > 0.7 ? C.pink : C.pink));
  bg.set(416, 79, C.white); bg.set(418, 87, C.pink);
}

export const SCENE = {
  id: 'park_fountain',
  draft: false,
  bg(img) {
    sky(img);
    town(img);
    trees(img);
    hedge(img);
    keeperHouse(img);
    pond(img);
    statue(img);
    statueDrips(img);
    lamp(img);
    entrance(img);
    path(img);
    bed(img);
    balloon(img);
  },
  objects: OBJECTS,
  anims: ANIMS,
};
