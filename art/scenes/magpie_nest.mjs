// 화면 1 `magpie_nest` 그림 원본 (#145, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md).
// 배경(bg)에는 만질 수 없는 것만 그린다. ink(0)·hint(31) 금지(ADR-0007 결정 3-1), 광원은 왼쪽 위 하나.
// 밀도 기준은 사장님 OK를 받은 완성 밀도 샘플(#154, docs/design/screens/magpie_nest-density-sample.mjs)이다.
// 그 샘플의 배경 코드를 여기로 옮기고, 띠별 PR로 나머지를 채운다.
//   띠 ②(a) 하늘·먼 지붕·왼쪽 건물  ← 이 파일 첫 PR
//   띠 ②(b) 담장·화단(해바라기 셋·화단 상자)  ← #142 묶음 ② 뒤 PR
//   띠 ②(c) 바닥·오른쪽 빨랫줄·시소 받침(세제 통)·볼거리 소품  ← 같은 PR
// 물건(`objects`)은 art/scenes/magpie_nest.objects.mjs에 그린다(물건 시트 ③). 일시 연출(`anims`)은 ③-2에서 채운다.
// 미리보기·검사: node docs/design/screens/magpie_nest-bg-preview.mjs (배경), node docs/design/screens/magpie_nest-objects-preview.mjs (물건)

import { C } from '../lib/pixel.mjs';
import { OBJECTS, GRIPS } from './magpie_nest.objects.mjs';
import {
  hash, rng, bay, fill, ellipse, line, stamp, darker,
  bricks, planks, grassBase, tuft, daisy, clover, pebble,
} from '../lib/texture.mjs';

export const W = 480, H = 270;
export const FENCE_TOP = 150, FLOOR_TOP = 196, POLE_FOOT = 236;
const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);

/**
 * ②(a) 빨래방 뒷창 ③: 안쪽에 세탁기 문 두 개가 보여서 "여기가 빨래방"이 한눈에 읽힌다.
 * 창 안 빨랫줄에 양말 한 짝, 창턱엔 말리다 잊은 양말과 선인장. 유리는 하늘을 비추고 왼쪽 위에 빛줄.
 */
function backWindow(bg) {
  const X = 12, Y0 = 42, WW = 34, WH = 30;
  // 위 인방돌(왼쪽 위 빛) + 벽돌 위 그늘 한 줄
  R(bg, X - 2, Y0 - 4, WW + 4, 3, C.lint); R(bg, X - 2, Y0 - 4, WW + 4, 1, C.cotton); R(bg, X + WW + 1, Y0 - 4, 1, 3, C.lav);
  // 창틀(흰 칠, 오른쪽·아래 그늘)
  R(bg, X, Y0 - 1, WW, WH + 1, C.cotton); R(bg, X, Y0 - 1, WW, 1, C.white); R(bg, X, Y0 - 1, 1, WH + 1, C.white);
  R(bg, X + WW - 1, Y0 - 1, 1, WH + 1, C.lint);
  // 유리 네 칸
  const panes = [[X + 2, Y0 + 1], [X + 18, Y0 + 1], [X + 2, Y0 + 15], [X + 18, Y0 + 15]];
  for (const [px, py] of panes) {
    fill(bg, px, py, 14, 12, (x, y) => {
      const ly = y - py, lx = x - px;
      if (ly === 0) return C.lav; // 위 틀 그늘
      if (lx + ly >= 3 && lx + ly <= 4 && ly < 6) return C.white; // 빛줄
      if (lx + ly === 6 && ly < 7) return C.aqua;
      return py < Y0 + 10 ? bay(x, y, ly / 14, C.aqua, C.tealL) : bay(x, y, 0.5, C.tealL, C.tealM);
    });
  }
  // 안쪽: 위 칸 왼쪽에 반쯤 걷힌 커튼(물결 주름)
  fill(bg, X + 2, Y0 + 1, 5, 12, (x, y) => ((x + (y >> 1)) % 3 === 0 ? C.lint : C.cotton));
  fill(bg, X + 7, Y0 + 1, 2, 7, (x, y) => (y - Y0 < 7 - (x - X - 7) * 3 ? C.cotton : undefined));
  // 안쪽 빨랫줄에 걸린 양말 한 짝(빨간 줄무늬, 오른쪽 위 칸)
  line(bg, X + 18, Y0 + 3, X + 31, Y0 + 4, C.lav);
  stamp(bg, X + 24, Y0 + 4, ['l.l', 'ww.', 'rr.', 'ww.', 'rrr', '.ww'], { l: C.woodL, w: C.white, r: C.redL });
  // 아래 칸: 세탁기 문 두 개(동그란 유리 + 빛 한 점)
  for (const cx of [X + 9, X + 25]) {
    ellipse(bg, cx, Y0 + 22, 4.5, 4.5, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.72 ? C.lint : dx + dy < -0.5 ? C.aqua : C.tealM));
    bg.set(cx - 2, Y0 + 20, C.white);
  }
  // 가운데 창살(십자)
  R(bg, X + 16, Y0 + 1, 2, WH - 2, C.cotton); R(bg, X + 17, Y0 + 1, 1, WH - 2, C.lint);
  R(bg, X + 2, Y0 + 13, WW - 4, 2, C.cotton); R(bg, X + 2, Y0 + 14, WW - 4, 1, C.lint);
  // 창턱(튀어나온 돌) + 아래 그늘
  R(bg, X - 3, Y0 + WH, WW + 6, 3, C.lint); R(bg, X - 3, Y0 + WH, WW + 6, 1, C.white); R(bg, X - 3, Y0 + WH + 2, WW + 6, 1, C.lav);
  for (let x = X - 2; x < X + WW + 4; x++) bg.set(x, Y0 + WH + 3, darker(bg.get(x, Y0 + WH + 3)));
  // 창턱 위: 선인장 화분(왼쪽), 말리다 잊은 줄무늬 양말(오른쪽, 턱 밖으로 늘어짐. 분홍 벽돌에 안 묻히게 청록)
  stamp(bg, X + 1, Y0 + WH - 7, ['.g.', 'gGg', 'gGg.g', 'gGgGg', '.Gg.', 'tttt', '.wt.'], { g: C.grn, G: C.grnL, t: C.woodL, w: C.wood });
  stamp(bg, X + 25, Y0 + WH - 2, ['qQqQqq', 'pqQqQq..', '....pQq', '.....pq', '......p'], { q: C.tealM, Q: C.white, p: C.teal });
}

/**
 * ②(a) 빨래방 뒷문 ④: 철문 + 큰 자물쇠. 문에 붙은 쪽지에는 열쇠 그림만 있다(글자 없음).
 * "이 문을 열려면 열쇠"라는 목표 표시까지만 하고, 열쇠가 어디 있는지는 말하지 않는다(답은 둥지 쪽 시선이 맡는다).
 * 금색은 열쇠 전용이라 자물쇠는 쇠색(lint·lav)이다. 핫스팟으로 올리면 이 함수를 objects로 옮긴다(#145, PR #149 리뷰).
 */
function backDoor(bg) {
  const X = 10, Y0 = 144, DW = 36, BOT = FLOOR_TOP - 1;
  // 문틀(쇠, 왼쪽 위 빛) + 문 위 작은 차양
  R(bg, X - 2, Y0 - 2, DW + 4, BOT - Y0 + 3, C.lav); R(bg, X - 2, Y0 - 2, 1, BOT - Y0 + 3, C.lint); R(bg, X - 2, Y0 - 2, DW + 4, 1, C.lint);
  R(bg, X - 5, Y0 - 7, DW + 10, 3, C.purL); R(bg, X - 5, Y0 - 5, DW + 10, 2, C.lav); R(bg, X - 5, Y0 - 4, DW + 10, 1, C.dusk);
  for (let x = X - 4; x < X + DW + 6; x++) if (hash(x, 1, 71) < 0.5) bg.set(x, Y0 - 3, darker(bg.get(x, Y0 - 3))); // 차양 그늘
  // 문짝: 세로 판 3장 느낌의 눌린 골, 오른쪽으로 갈수록 그늘
  fill(bg, X, Y0, DW, BOT - Y0, (x, y) => {
    const lx = x - X, ly = y - Y0;
    if (lx === DW - 1 || ly === BOT - Y0 - 1) return C.lav;
    if (lx === 0) return C.cotton;
    if (lx % 12 === 11) return C.lav; // 골
    if (lx % 12 === 0) return C.cotton;
    if (ly > BOT - Y0 - 8) return hash(x, y, 72) < 0.25 ? C.lav : C.lint; // 발로 찬 자국 많은 아랫단
    return lx > DW - 4 ? C.lav : hash(x, y, 73) < 0.04 ? C.cotton : C.lint;
  });
  // 위쪽 철망 유리
  R(bg, X + 12, Y0 + 5, 12, 9, C.lav);
  fill(bg, X + 13, Y0 + 6, 10, 7, (x, y) => ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0 ? C.lav : y < Y0 + 8 ? C.aqua : C.tealM));
  // 손잡이(오른쪽) + 걸쇠 + 큰 자물쇠(살짝 기울어 매달림)
  R(bg, X + DW - 7, Y0 + 26, 5, 2, C.dusk); R(bg, X + DW - 7, Y0 + 26, 4, 1, C.cotton);
  R(bg, X + DW - 5, Y0 + 30, 7, 3, C.dusk); R(bg, X + DW - 5, Y0 + 30, 6, 1, C.lint);
  stamp(bg, X + DW - 3, Y0 + 31, ['.ll.', 'l..l', 'l..l', 'WCCL', 'CCCL', 'CdCL', 'CdCL', 'LLLL'], { l: C.lint, W: C.white, C: C.cotton, L: C.lav, d: C.dusk });
  // 쪽지(테이프 두 조각): 열쇠 그림 + 물음표 대신 눈동자 두 개 = "어디 갔지?"
  const sx = X + 3, sy = Y0 + 17;
  R(bg, sx, sy, 9, 11, C.white); R(bg, sx + 8, sy + 1, 1, 10, C.cotton); R(bg, sx + 1, sy + 10, 8, 1, C.cotton);
  bg.set(sx + 1, sy - 1, C.cotton); bg.set(sx + 2, sy - 1, C.cotton); bg.set(sx + 6, sy - 1, C.cotton); bg.set(sx + 7, sy - 1, C.cotton);
  stamp(bg, sx + 2, sy + 2, ['.dd....', 'd..d...', '.dd.ddd', '....d.d'], { d: C.dusk });
  stamp(bg, sx + 2, sy + 7, ['d..d', 'L..L'], { d: C.dusk, L: C.lav });
  // 문턱(시멘트, 이끼 몇 점)
  R(bg, X - 3, BOT, DW + 6, 1, C.cotton);
  for (let x = X - 3; x < X + DW + 3; x++) if (hash(x, 0, 74) < 0.15) bg.set(x, BOT, C.grnL);
  // 문 옆 벽에 기대 둔 대걸레(빨래방 뒷문다운 물건, 판정 대상 아님)
  line(bg, X + DW + 6, Y0 + 8, X + DW + 9, BOT - 6, C.woodL); line(bg, X + DW + 7, Y0 + 8, X + DW + 10, BOT - 6, C.wood);
  stamp(bg, X + DW + 6, BOT - 6, ['.cccc.', 'ccccc', 'cLcLcc', 'c.c.c.c', 'L.L..L'], { c: C.cotton, L: C.lint });
}

/**
 * ②(b) 담장 밑 화단 상자: 판자로 짠 낮은 상자에 흙 + 분홍·보라 꽃 + 새싹 팻말. 옆에 물뿌리개가 넘어져 물이 샌다.
 * 노란 꽃은 쓰지 않는다(금색은 열쇠 전용). 시소 오른쪽 끝(288)과 빨랫줄 기둥(336) 사이 빈 담장 밑을 채운다.
 */
function flowerBed(bg) {
  const X0 = 288, X1 = 318, TOP = 188, BOT = 201; // 물뿌리개(X1+2~X1+14)가 빨랫줄 기둥(335)에 가리지 않게
  // 상자 판자 두 장(위 판은 빛, 아래 판은 그늘) + 모서리 기둥
  fill(bg, X0, TOP + 4, X1 - X0, BOT - TOP - 4, (x, y) => {
    const ly = y - TOP - 4, lx = x - X0;
    if (lx === 0) return C.tan;
    if (lx === X1 - X0 - 1) return C.woodD;
    if (ly === 0) return C.tan;
    if (ly === 4) return C.woodD; // 판자 사이 틈
    if (ly === BOT - TOP - 5) return C.wood;
    if ((lx + (ly > 4 ? 7 : 0)) % 11 === 5 && hash(lx, ly, 91) < 0.7) return C.wood; // 결
    return ly > 4 ? C.wood : C.woodL;
  });
  for (const px of [X0 + 1, X1 - 2]) { bg.set(px, TOP + 6, C.lint); bg.set(px, TOP + 11, C.lint); } // 못
  // 흙(위에서 살짝 보임)
  R(bg, X0 + 1, TOP + 3, X1 - X0 - 2, 1, C.woodD);
  // 꽃: 줄기 + 꽃송이(분홍·보라·흰), 왼쪽 위가 밝다. 키를 들쭉날쭉하게
  const r = rng(92);
  // 잎 덤불(흙을 덮는다)
  for (let x = X0 + 1; x < X1 - 1; x++) { const h = 1 + Math.floor(r() * 3); for (let j = 0; j < h; j++) bg.set(x, TOP + 3 - j, j === h - 1 && x % 3 === 0 ? C.grnP : C.grn); }
  for (let x = X0 + 2; x < X1 - 3; x += 4 + Math.floor(r() * 2)) {
    const h = 4 + Math.floor(r() * 5), top = TOP + 2 - h;
    R(bg, x, top + 2, 1, h - 1, C.grn);
    bg.set(x + (r() < 0.5 ? 1 : -1), top + 3 + Math.floor(r() * 2), C.grnL); // 잎
    const k = r(), [lit, mid] = k < 0.45 ? [C.pinkL, C.pink] : k < 0.8 ? [C.purL, C.pur] : [C.white, C.cotton];
    // 꽃송이 3×3 십자 + 가운데, 왼쪽 위가 밝다
    bg.set(x, top, lit); bg.set(x - 1, top + 1, lit); bg.set(x + 1, top + 1, mid); bg.set(x, top + 2, mid); bg.set(x, top + 1, C.redL);
  }
  // 새싹 팻말(막대 + 빈 판, 글자 없음): 씨앗 봉투를 꽂아 뒀다
  R(bg, X1 - 7, TOP - 4, 1, 7, C.woodL);
  R(bg, X1 - 9, TOP - 8, 5, 5, C.white); R(bg, X1 - 9, TOP - 4, 5, 1, C.cotton); R(bg, X1 - 5, TOP - 8, 1, 5, C.cotton);
  bg.set(X1 - 8, TOP - 7, C.pink); bg.set(X1 - 7, TOP - 6, C.grn); bg.set(X1 - 7, TOP - 7, C.pinkL);
  // 접지 그림자(오른쪽 아래)
  for (let x = X0 + 2; x < X1 + 3; x++) for (const y of [BOT, BOT + 1]) if (y === BOT || x > X0 + 4) bg.set(x, y, darker(bg.get(x, y)));
  // 넘어진 물뿌리개(청록 함석, 꼭지에서 물이 졸졸 = 바닥에 작은 물자국)
  stamp(bg, X1 + 2, BOT - 8, ['...lll....', '..l...l...', '.lQQQQQl..', 'lQQqqqqqlL.', 'lQqqqqqqq.LL', 'lqqqqqqqp..aL', '.qqqqqqpp...a', '..ppppp......'],
    { l: C.lint, Q: C.aqua, q: C.tealM, p: C.teal, L: C.lav, a: C.aqua });
  for (const [dx, dy] of [[14, 0], [15, 1], [16, 1], [17, 2], [13, 1]]) bg.set(X1 + dx, BOT + dy, dx % 2 ? C.tealL : C.aqua); // 샌 물
}

/**
 * ②(c) 오른쪽 빨랫줄(만질 수 없음): 쇠 기둥 둘(336·464) + 처진 줄(내복 집게 자리 y 110).
 * 기둥은 빨랫대 기둥(나무, 굵고 따뜻함)과 헷갈리지 않게 3px 차가운 쇠색. 바닥엔 시멘트 받침.
 * 줄에는 내복(물건) 말고 장식 빨래 둘: 납작한 줄무늬 수건, 크기가 전혀 다른 양말 한 켤레(짝짝이).
 * 장식은 내복보다 약하게(차가운 색, 작게) 둬서 만질 수 있는 내복이 먼저 읽힌다(ADR-0007 읽기 규칙).
 */
const LINE_X0 = 336, LINE_X1 = 464;
const lineY = (x) => 107 + Math.round(12 * ((x - LINE_X0) / (LINE_X1 - LINE_X0)) * (1 - (x - LINE_X0) / (LINE_X1 - LINE_X0)));
function clothesline(bg) {
  const FOOT = 238;
  for (const px of [LINE_X0 - 1, LINE_X1 - 1]) {
    // 기둥(왼쪽 빛, 오른쪽 그늘) + 꼭대기 갓 + 줄 거는 고리
    R(bg, px, 100, 3, FOOT - 100, C.lav); R(bg, px, 100, 1, FOOT - 100, C.lint); R(bg, px + 2, 100, 1, FOOT - 100, C.dusk);
    R(bg, px - 1, 98, 5, 2, C.lint); R(bg, px - 1, 98, 5, 1, C.cotton);
    for (let y = 120; y < FOOT - 6; y += 29) bg.set(px + 1, y, C.dusk); // 이음매
    for (let y = 166; y < 190; y++) if (hash(px, y, 93) < 0.35) bg.set(px + 1, y, C.woodD); // 녹물
    // 시멘트 받침 + 그림자(오른쪽 아래)
    R(bg, px - 3, FOOT - 4, 9, 4, C.lint); R(bg, px - 3, FOOT - 4, 9, 1, C.cotton); R(bg, px + 5, FOOT - 4, 1, 4, C.lav); R(bg, px - 3, FOOT - 1, 9, 1, C.lav);
    ellipse(bg, px + 7, FOOT, 7, 1.6, (x, y) => darker(bg.get(x, y)));
    const r = rng(px); tuft(bg, px - 4, FOOT, r, 0); tuft(bg, px + 6, FOOT + 1, r, 0);
  }
  // 줄(살짝 처짐). 내복 집게(377~399)에서 y 110이 되게 맞췄다
  for (let x = LINE_X0 + 2; x < LINE_X1 - 1; x++) bg.set(x, lineY(x), C.dusk);
  // 왼쪽 기둥에 걸린 빨래집게 주머니(꽃무늬 천, 집게 몇 개가 삐져나옴)
  stamp(bg, LINE_X0 + 2, 118, ['l', 'l', 'l.', 'pPpPpp', 'PpqpPp', 'pPpPqp', 'PppPpP', '.pPpp.'], { l: C.lint, p: C.purL, P: C.pur, q: C.white });
  stamp(bg, LINE_X0 + 3, 119, ['.t.t', '.w.w'], { t: C.tan, w: C.woodL });
  // 수건(만질 수 없음): 차가운 청록 줄무늬, 바람에 아래 끝이 오른쪽으로 들림
  {
    const X = 410, top = lineY(410) + 1;
    fill(bg, X, top, 16, 22, (x, y) => {
      const ly = y - top, lx = x - X - Math.round((ly / 22) ** 2 * 3);
      if (lx < 0 || lx > 15) return undefined;
      if (ly === 21) return lx % 2 ? C.lint : undefined; // 술
      if (lx === 0) return C.white;
      if (lx === 15) return C.tealM;
      return ly % 6 < 2 ? C.tealM : ly % 6 === 2 ? C.tealL : C.cotton;
    });
    for (const px of [X + 1, X + 13]) stamp(bg, px, top - 2, ['tw', 'tw', '.w'], { t: C.tan, w: C.woodL });
  }
  // 짝짝이 양말: 무릎까지 오는 긴 양말 하나 + 아기 양말 하나(같은 줄무늬라 한 켤레라고 우긴다)
  {
    const X = 436, top = lineY(436) + 1;
    stamp(bg, X, top, ['ww', 'll', 'ww', 'll', 'ww', 'll', 'ww', 'll', 'ww', 'llL', 'wwwL', 'cccc'], { w: C.white, l: C.lav, L: C.lav, c: C.lint });
    const X2 = 446, t2 = lineY(446) + 1;
    stamp(bg, X2, t2, ['ww', 'll', 'wwl', 'ccc'], { w: C.white, l: C.lav, c: C.lint });
    for (const [px, py] of [[X, top - 2], [X2, t2 - 2]]) stamp(bg, px, py, ['t', 't'], { t: C.tan });
  }
}

/**
 * ②(c) 시소 받침 = 세제 통(242,220 12×16, 설계 1-1절). 널빤지(물건)가 그 위 y 214~219에 얹힌다.
 * 큰 청록 통 + 흰 라벨(거품 그림, 글자 없음) + 뚜껑 + 옆구리로 흘러내린 세제 자국. 넓어서 시소가 안 기운다는 설정(1-3절).
 */
function detergentTub(bg) {
  const X = 242, Y = 220, TW = 12, TH = 16;
  fill(bg, X, Y, TW, TH, (x, y) => {
    const lx = x - X, ly = y - Y;
    if (ly < 2) return ly === 0 ? C.lint : C.lav; // 뚜껑 테(널빤지 그늘이 덮는다)
    if (lx === 0) return C.tealL;
    if (lx >= TW - 2) return lx === TW - 1 ? C.tealD : C.teal;
    if (ly === TH - 1) return C.tealD;
    return C.tealM;
  });
  // 라벨: 흰 판 + 거품 세 알
  R(bg, X + 2, Y + 5, 8, 7, C.white); R(bg, X + 9, Y + 5, 1, 7, C.cotton); R(bg, X + 2, Y + 11, 8, 1, C.cotton);
  stamp(bg, X + 3, Y + 6, ['.a..', 'aAa.', '.a.a', '..aA'], { a: C.aqua, A: C.tealL });
  // 흘러내린 세제(분홍 반투명 대신 pinkL 줄 두 가닥)
  R(bg, X + 1, Y + 2, 1, 4, C.pinkL); bg.set(X + 1, Y + 6, C.pink); R(bg, X + 4, Y + 2, 1, 2, C.pinkL);
  // 널빤지 그늘(통 위 1줄) + 접지 그림자(오른쪽 아래)
  for (let x = X; x < X + TW; x++) bg.set(x, Y, C.lav);
  ellipse(bg, X + TW / 2 + 4, Y + TH, 9, 1.8, (x, y) => (y >= Y + TH ? darker(bg.get(x, y)) : undefined));
}

/**
 * ②(c) 바닥 소품: 빨랫줄 아래에서 시소 쪽으로 이어진 납작한 디딤돌 셋(사람 발 기준점 y 244·214를 피해 그 사이),
 * 디딤돌 하나 옆 풀 속에 잃어버린 양말 한 짝(빨래방다운 볼거리, 작게).
 */
function yardProps(bg) {
  const stone = (cx, cy, rx) => ellipse(bg, cx, cy, rx, 2.4, (x, y, dx, dy) => {
    if (Math.hypot(dx, dy) > 0.9 && hash(x, y, 94) < 0.5) return undefined; // 풀이 가장자리를 먹었다
    if (dy > 0.45) return C.lav; // 아래 두께
    if (dx + dy < -0.6) return C.white;
    return hash(x, y, 95) < 0.15 ? C.lint : C.cotton;
  });
  stone(302, 232, 6); stone(320, 238, 5.5); stone(338, 254, 6);
  // 잃어버린 양말(뒤집혀 발가락이 하늘을 본다)
  stamp(bg, 312, 251, ['..rr', '.wwr', 'wwr.', 'rr..'], { r: C.redL, w: C.white });
}

/** 480×270 배경. 순서 = 뒤 → 앞. */
function drawBg(bg) {
  // ═════════════ 하늘 ═════════════
  fill(bg, 0, 0, W, 160, (x, y) => (y < 56 ? bay(x, y, y / 56, C.white, C.aqua) : bay(x, y, Math.min(1, (y - 56) / 96), C.aqua, C.tealL)));

  /** 뭉게구름: 원 여러 개, 위·왼쪽은 white, 아래는 cotton, 밑단은 망점으로 하늘에 녹는다. */
  function cloud(puffs, baseY) {
    const inside = (x, y) => puffs.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.25) <= r);
    const xs = puffs.flatMap(([cx, , r]) => [cx - r, cx + r]), ys = puffs.flatMap(([, cy, r]) => [cy - r, cy + r]);
    fill(bg, Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs) - Math.min(...xs)) + 2, Math.ceil(Math.max(...ys) - Math.min(...ys)) + 2, (x, y) => {
      if (!inside(x, y) || y > baseY) return undefined;
      const lit = !inside(x - 2, y - 2); // 왼쪽 위 가장자리
      if (y > baseY - 2) return bay(x, y, 0.5, C.cotton, bg.get(x, y));
      if (lit) return C.white;
      if (!inside(x + 1, y + 2) || y > baseY - 5) return C.cotton;
      return hash(x, y, 40) < 0.06 ? C.cotton : C.white;
    });
  }
  cloud([[236, 30, 9], [248, 24, 11], [262, 27, 9], [274, 32, 7], [226, 34, 6]], 37);
  cloud([[96, 70, 6], [106, 66, 8], [116, 70, 5]], 73);
  // ②(a) 오른쪽 하늘: 구도 시안 ① 자리의 큰 구름 + 지붕 위 낮은 조각구름(빈 하늘 줄이기)
  cloud([[392, 40, 5], [400, 36, 8], [411, 31, 10], [423, 35, 8], [433, 40, 5]], 43);
  cloud([[438, 84, 4], [445, 81, 6], [453, 84, 4]], 87);
  cloud([[330, 92, 3], [336, 90, 4], [342, 92, 3]], 94);
  // 먼 새 두 마리(V자)
  for (const [bx, by] of [[200, 18], [209, 23]]) { bg.set(bx, by, C.lav); bg.set(bx + 1, by + 1, C.lav); bg.set(bx + 2, by, C.lav); bg.set(bx - 1, by - 1, C.lint); bg.set(bx + 3, by - 1, C.lint); }

  // ═════════════ 먼 동네 지붕 ═════════════
  // ②(a): 360 오른쪽은 빨랫줄 뒤로 지붕을 이어 화면 끝까지(높이를 번갈아 바꿔 띠가 한 줄로 안 보이게)
  const roofs = [[76, 128, 40, 0], [116, 118, 36, 1], [176, 124, 52, 0], [240, 112, 30, 1], [270, 120, 38, 0], [300, 126, 60, 1],
    [358, 116, 40, 0], [396, 108, 34, 1], [428, 120, 54, 0]];
  for (const [x0, top, w, chim] of roofs) {
    const mid = x0 + w / 2;
    fill(bg, x0, top - 9, w, 162 - top, (x, y) => {
      const ridge = top - 9 + Math.abs(x + 0.5 - mid) * (18 / w);
      if (y < ridge) return undefined;
      const eave = top + 1;
      if (y < eave) {
        // 기와 줄: 3px마다 한 단 어두운 줄, 줄마다 반 칸 어긋난 세로 이음
        const row = Math.floor((y - ridge) / 3);
        const leftSlope = x < mid;
        const base = leftSlope ? C.purL : C.lav;
        if (y - ridge < 1) return C.lint; // 용마루 빛
        if ((y - Math.floor(ridge)) % 3 === 2) return darker(base);
        if ((x + row * 2) % 5 === 0) return darker(base);
        return base;
      }
      if (y < eave + 2) return C.lav; // 처마 그늘
      // 벽: 하늘과 섞인 낮은 대비 + 창문
      const wx = (x - x0) % 12, wy = (y - eave - 4) % 14;
      const lit = hash(x0 + Math.floor((x - x0) / 12), Math.floor((y - eave - 4) / 14), 9) < 0.45; // 창문은 듬성듬성
      if (lit && wx >= 4 && wx < 8 && wy >= 0 && wy < 5 && y < 156) return wy === 0 || wx === 4 ? C.lav : hash(x0, y, 8) < 0.3 ? C.yelL : C.aqua;
      return bay(x, y, 0.5, C.purL, C.tealL);
    });
    if (chim) {
      const cx = Math.round(x0 + w * 0.7), cy = top - 10;
      R(bg, cx, cy, 5, 8, C.lav); R(bg, cx, cy, 1, 8, C.purL); R(bg, cx - 1, cy - 1, 7, 2, C.lint);
      ellipse(bg, cx + 3, cy - 5, 3, 2, (x, y) => bay(x, y, 0.5, C.white, C.cotton));
      ellipse(bg, cx + 6, cy - 9, 2, 2, (x, y) => bay(x, y, 0.3, C.white, bg.get(x, y)));
    }
  }
  // TV 안테나 + 비둘기 셋 ② (한 마리는 반대로 앉았다)
  R(bg, 256, 94, 1, 18, C.lav); R(bg, 249, 98, 15, 1, C.lav); R(bg, 251, 102, 11, 1, C.lav); R(bg, 253, 106, 7, 1, C.lav);
  const pigeon = (px, py, flip) => {
    const rows = ['.hh..', 'hhbbb', '.cbbbt', '..ff.'];
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const col = { h: C.lav, b: C.lint, c: C.cotton, t: C.dusk, f: C.pink }[ch];
      if (col !== undefined) bg.set(flip ? px + 5 - i : px + i, py + j, col);
    }));
  };
  pigeon(248, 94, false); pigeon(254, 94, false); pigeon(259, 94, true);
  // 지붕에서 지붕으로 건너간 전깃줄 + 걸려 버린 양말 한 짝(바람에 날아간 빨래)
  const wireY = (x) => Math.round(58 + (x - 188) * 0.03 + 0.0022 * (x - 188) * (308 - x)); // 처진 줄
  for (let x = 188; x < 308; x++) bg.set(x, wireY(x), C.lav);
  {
    const sx = 268, sy = wireY(268) + 1;
    stamp(bg, sx - 1, sy - 1, ['.ll.', '.qq.', 'qQq.', 'qQq.', 'qqq.', 'pqq.', 'ppqq', '.ppp'], { l: C.woodL, q: C.pinkL, Q: C.white, p: C.pink });
  }
  for (const bx of [220, 232]) { // 전깃줄 참새
    const by = wireY(bx) - 3;
    stamp(bg, bx, by, ['.dd.', 'dlld', '.ll.'], { d: C.dusk, l: C.lint });
  }
  // ②(a) 먼 전봇대 둘: 샘플에서 허공에 떠 있던 전깃줄 양 끝을 잡는다. 빨랫대 기둥(가까운 나무, 굵고 따뜻한 색)과
  // 헷갈리지 않게 2px 폭·차가운 lav로, 담장 위(y < FENCE_TOP)만 보인다
  const farPole = (px, top) => {
    R(bg, px, top, 2, FENCE_TOP - top, C.lav); R(bg, px, top, 1, FENCE_TOP - top, C.purL);
    R(bg, px - 5, top + 3, 12, 1, C.lav); R(bg, px - 5, top + 2, 12, 1, C.purL); // 가로대
    for (const ix of [px - 5, px + 6]) bg.set(ix, top + 1, C.lint); // 애자
  };
  farPole(187, wireY(188) - 3);
  farPole(308, wireY(307) - 3);
  // 오른쪽 전봇대에서 화면 밖으로 나가는 줄 두 가닥(하나는 더 처진다)
  for (let x = 310; x < W; x++) {
    const t = (x - 310) / (W - 310);
    bg.set(x, Math.round(wireY(307) + 6 * t + 14 * t * (1 - t)), C.lav);
    if (x > 316) bg.set(x, Math.round(wireY(307) + 4 + 3 * t + 24 * t * (1 - t)), bay(x, 0, 0.5, C.lav, C.purL));
  }
  // 그 줄에 나란히 앉은 비둘기 셋 중 하나만 거꾸로 매달렸다(구석의 작은 개그, 1배에서 점 셋 + 하나)
  for (const [bx, flip] of [[384, false], [392, false], [400, true]]) {
    const t = (bx + 2 - 310) / (W - 310), wy = Math.round(wireY(307) + 6 * t + 14 * t * (1 - t));
    if (flip) stamp(bg, bx, wy + 1, ['.ll.', 'dlld', '.dd.'], { d: C.dusk, l: C.lint });
    else stamp(bg, bx, wy - 3, ['.dd.', 'dlld', '.ll.'], { d: C.dusk, l: C.lint });
  }
  // 오른쪽 지붕 하나에 위성 안테나(접시는 왼쪽 위 빛)
  ellipse(bg, 414, 100, 4, 4, (x, y, dx, dy) => (dx + dy < -0.4 ? C.white : dx + dy < 0.5 ? C.cotton : C.lint));
  line(bg, 414, 100, 418, 96, C.lav); R(bg, 413, 104, 2, 4, C.lav);

  // ═════════════ 왼쪽: 빨래방 뒷벽(벽돌) ═════════════
  const PIPE_X = 72;
  bricks(bg, 0, 22, 78, FLOOR_TOP - 22 + 2, {
    seed: 11,
    shade: (x, y) => y < 30 || (x > PIPE_X + 3 && x < PIPE_X + 8 && hash(x, Math.floor(y / 3), 12) < 0.55) || x >= 76,
  });
  // 벽돌 위 얼룩: 홈통 받침 아래 녹물, 바닥 쪽 습기
  for (const by of [60, 120, 180]) for (let y = by + 3; y < by + 14; y++) if (hash(y, by, 13) < 0.7) bg.set(PIPE_X - 1, y, darker(bg.get(PIPE_X - 1, y)));
  for (let x = 0; x < 78; x++) for (let y = FLOOR_TOP - 8; y < FLOOR_TOP + 2; y++) if (hash(x, y, 14) < (y - FLOOR_TOP + 8) / 14) bg.set(x, y, darker(bg.get(x, y)));
  // 처마: 두 단 + 빗물받이
  R(bg, 0, 15, 82, 2, C.purL); R(bg, 0, 17, 82, 4, C.lav); R(bg, 0, 21, 82, 2, C.dusk);
  for (let x = 2; x < 82; x += 6) bg.set(x, 19, C.purL);
  // 건조기 배기구(빨래방 뒷벽 = 건조기가 김을 내뿜는다) + 김 하나가 양말 모양 ③
  R(bg, 52, 84, 16, 12, C.lint); R(bg, 52, 84, 16, 1, C.cotton); R(bg, 67, 84, 1, 12, C.lav); R(bg, 52, 95, 16, 1, C.lav);
  for (let y = 86; y < 94; y += 2) { R(bg, 54, y, 12, 1, C.dusk); R(bg, 54, y + 1, 12, 1, C.lav); }
  ellipse(bg, 61, 77, 6, 4, (x, y) => (y < 76 ? C.white : bay(x, y, 0.4, C.white, C.cotton)));
  ellipse(bg, 66, 67, 4, 3, (x, y) => bay(x, y, 0.2, C.white, C.cotton));
  stamp(bg, 66, 48, ['.www', 'wwww', 'wwwc', 'wwwc', 'wwwc', 'wwwwww.', 'wwwwwwc', '.cccccc'], { w: C.white, c: C.cotton });
  // 홈통(왼쪽 빛, 오른쪽 그늘) + 받침 + 아래로 꺾여 웅덩이로
  R(bg, PIPE_X, 22, 4, 206, C.lint); R(bg, PIPE_X, 22, 1, 206, C.cotton); R(bg, PIPE_X + 3, 22, 1, 206, C.lav);
  for (const by of [60, 120, 180]) { R(bg, PIPE_X - 1, by, 6, 2, C.lav); bg.set(PIPE_X - 1, by, C.lint); }
  for (let y = 40; y < 228; y += 23) bg.set(PIPE_X + 1, y, C.lav); // 이음매
  R(bg, PIPE_X, 226, 10, 4, C.lint); R(bg, PIPE_X, 226, 10, 1, C.cotton); R(bg, PIPE_X, 229, 10, 1, C.lav); R(bg, PIPE_X + 9, 226, 1, 4, C.lav);
  backWindow(bg);
  backDoor(bg);

  // ═════════════ 담장 ═════════════
  const behindFence = (x, y) => (hash(x >> 1, y >> 1, 21) < 0.5 ? C.grn : y % 3 === 0 ? C.grnL : C.grnD);
  planks(bg, 78, W, FENCE_TOP, FLOOR_TOP + 2, { pw: 16, seed: 22, broken: [7], behind: behindFence });
  // 부러진 판자 틈으로 이웃집 고양이가 눈만 내밀고 있다 (구석의 작은 사연)
  { const kx = 78 + 7 * 16 + 5, ky = FENCE_TOP + 21; stamp(bg, kx, ky, ['ll.ll', 'ly.yl'], { l: C.lint, y: C.yel }); }

  // 담장 위 이웃집 해바라기 ⑥ (한 송이는 고개를 꺾어 빨래 쪽을 본다)
  function sunflower(cx, cy, tilt) {
    line(bg, cx, cy + 4, cx + (tilt ? -1 : 0), FENCE_TOP + 4, C.grn);
    stamp(bg, cx + 1, cy + 12, ['gg', 'Ggg', '.G'], { g: C.grn, G: C.grnL });
    stamp(bg, cx - 3, cy + 18, ['.gg', 'ggG', 'G'], { g: C.grn, G: C.grnL });
    ellipse(bg, cx, cy, 6.5, tilt ? 5 : 6.5, (x, y, dx, dy) => {
      const a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
      if (r > 0.8 + 0.2 * Math.cos(a * 6)) return undefined; // 꽃잎 끝 들쭉날쭉
      if (r < 0.45) return (x + y) % 2 ? C.woodD : C.wood; // 씨
      return dx + dy < -0.3 ? C.yelL : dy > 0.4 ? C.yelD : C.yel;
    });
  }
  sunflower(292, 140, false);
  // ②(b) 해바라기 셋 중 오른쪽 하나가 고개를 꺾어 빨랫줄(내복) 쪽을 본다
  sunflower(306, 134, false);
  sunflower(320, 143, true);

  // 담장에 걸린 엉킨 호스 ⑦: 못에 걸린 고리 셋 + 놋쇠 꼭지
  R(bg, 103, 163, 3, 2, C.lint); bg.set(103, 165, C.lav);
  for (let k = 0; k < 3; k++) {
    const rx = 8 + k * 1.5, ry = 10 + k * 1.2, cx = 104 + (k - 1) * 2, cy = 166 + ry;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const x = Math.round(cx + Math.sin(a) * rx), y = Math.round(cy - Math.cos(a) * ry);
      const lit = Math.sin(a) < -0.2 && Math.cos(a) > -0.3; // 왼쪽 위
      bg.set(x, y, C.grn); bg.set(x, y + 1, lit ? C.grnP : C.grnD);
    }
  }
  line(bg, 112, 188, 122, 196, C.grn); line(bg, 112, 189, 122, 197, C.grnD);
  R(bg, 122, 196, 4, 3, C.yelD); R(bg, 122, 196, 4, 1, C.yel); bg.set(126, 197, C.woodD);

  // ═════════════ 바닥(풀밭) ═════════════
  grassBase(bg, 0, FLOOR_TOP, W, H - FLOOR_TOP);
  // 담장 밑에 붙은 풀 덩어리(담장 아랫단을 가린다)
  {
    const r = rng(32);
    for (let x = 78; x < W; x += 3 + Math.floor(r() * 4)) tuft(bg, x, FLOOR_TOP + 1 + Math.floor(r() * 2), r, 1);
  }
  // 기둥 밑과 바구니 앞은 사람이 밟아 흙이 드러났다
  ellipse(bg, 154, 240, 22, 5, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.8 && hash(x, y, 33) < 0.6 ? undefined : Math.hypot(dx, dy) > 0.6 ? C.woodL : hash(x, y, 36) < 0.12 ? C.woodL : C.tan));
  for (let i = 0; i < 6; i++) pebble(bg, 138 + Math.floor(hash(i, 0, 34) * 32), 238 + Math.floor(hash(i, 1, 34) * 5), 2 + (i % 2));
  // 홈통 아래 웅덩이 + 고무 오리 ⑤ (오리 그림자가 물에 비친다)
  ellipse(bg, 88, 249, 17, 4.5, (x, y, dx, dy) => {
    if (Math.hypot(dx, dy) > 0.85) return C.grn; // 젖은 테두리
    if (y === 247 && x > 76 && x < 86) return C.aqua; // 하늘 반사
    if (y === 250 && x > 92 && x < 100) return C.tealL;
    return dy < 0 ? C.tealL : C.tealM;
  });
  stamp(bg, 84, 240, ['..YY.', '.YYdr', '.YYY.', 'YYYYY', 'yYYYy', '.yyy.'], { Y: C.yel, y: C.yelD, d: C.dusk, r: C.redL });
  R(bg, 84, 246, 5, 1, C.yelL); R(bg, 85, 247, 3, 1, C.tealM); // 물에 비친 오리
  // 웅덩이로 떨어지는 물방울
  bg.set(78, 233, C.tealL); bg.set(79, 237, C.aqua);

  // 풀 포기·데이지·클로버·조약돌을 흩뿌린다(세 사람 발밑과 바구니 자리는 덜 찍는다)
  {
    const r = rng(35);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(r() * W), y = FLOOR_TOP + 6 + Math.floor(r() * (H - FLOOR_TOP - 8));
      const busy = (x > 140 && x < 180 && y > 214 && y < 244) || (x > 70 && x < 108 && y > 240 && y < 256);
      if (busy) continue;
      const k = r();
      if (k < 0.62) tuft(bg, x, y, r, y > 240 ? 1 : 0);
      else if (k < 0.75) daisy(bg, x, y);
      else if (k < 0.9) clover(bg, x, y);
      else pebble(bg, x, y, 2 + Math.floor(r() * 2));
    }
  }

  // ②(b)·(c) 담장 밑 화단, 바닥 소품, 빨랫줄, 시소 받침
  flowerBed(bg);
  yardProps(bg);
  clothesline(bg);
  detergentTub(bg);

  // ═════════════ 빨랫대 기둥(배경: 외곽선 없음) ═════════════
  const PX = 140, PW = 12, PTOP = 46;
  fill(bg, PX, PTOP, PW, POLE_FOOT - PTOP, (x, y) => {
    const lx = x - PX;
    const wob = Math.round(Math.sin(y / 11) * 0.8);
    if (lx === 0) return C.woodL;
    if (lx <= 2) return hash(x, y, 51) < 0.18 ? C.tan : C.woodL; // 빛 받는 면
    if (lx >= PW - 2) return hash(x, y, 52) < 0.25 ? C.wood : C.woodD; // 그늘 면
    if (lx === PW - 3) return hash(x, y, 53) < 0.5 ? C.woodD : C.wood;
    // 가운데: 결 두 줄 + 갈라진 틈
    if ((lx + wob === 5 || lx + wob === 8) && hash(lx, Math.floor(y / 4), 54) > 0.25) return C.woodD;
    if (lx === 6 && y > 150 && y < 186) return y % 9 === 0 ? C.wood : C.woodD; // 길게 간 금
    return hash(x, y, 55) < 0.08 ? C.woodL : C.wood;
  });
  // 쇠띠 두 개(위·아래) + 녹
  for (const by of [62, 206]) {
    R(bg, PX - 1, by, PW + 2, 3, C.lint); R(bg, PX - 1, by, 3, 3, C.cotton); R(bg, PX + PW - 1, by, 2, 3, C.lav); R(bg, PX - 1, by + 2, PW + 2, 1, C.lav);
    bg.set(PX + 4, by + 1, C.lav); bg.set(PX + 8, by + 1, C.lav);
    for (let y = by + 3; y < by + 7; y++) if (hash(y, by, 56) < 0.6) bg.set(PX + 7, y, C.woodD);
  }
  // 둥지 받침 가로대(꼭대기)
  R(bg, 130, PTOP - 2, 32, 4, C.wood); R(bg, 130, PTOP - 2, 32, 1, C.woodL); R(bg, 130, PTOP + 1, 32, 1, C.woodD);
  R(bg, 132, PTOP + 2, 2, 4, C.woodD); R(bg, 158, PTOP + 2, 2, 4, C.woodD); // 받침 쐐기
  // 기둥에 물려 둔 빨래집게 둘(누가 깜빡했다)
  for (const [cy, lean] of [[116, 0], [122, 1]]) stamp(bg, PX + PW, cy, lean ? ['.tt', 'tl.', 'tl.'] : ['tt.', 'tl.', 'tl.', '.l.'], { t: C.tan, l: C.woodL });
  // 찢어진 전단 자국(스테이플 두 개 + 남은 종이 조각)
  stamp(bg, PX + 2, 172, ['c.c..', 'cc.cc', '.cl.c', '..cc.', '...c.'], { c: C.cotton, l: C.lint });
  bg.set(PX + 2, 172, C.lav); bg.set(PX + 6, 173, C.lav);
  // "까치 주의" 표지 ⑨: 못 두 개로 박은 판, 아래 모서리가 들려 있다. 글자 없이 그림으로만
  {
    const sx = 130, sy = 128;
    R(bg, sx, sy, 20, 16, C.lint); R(bg, sx, sy, 20, 1, C.cotton); R(bg, sx, sy, 1, 16, C.cotton);
    R(bg, sx + 1, sy + 1, 18, 14, C.white); R(bg, sx + 19, sy + 1, 1, 15, C.lav); R(bg, sx + 1, sy + 15, 19, 1, C.lav);
    bg.set(sx + 2, sy + 2, C.dusk); bg.set(sx + 17, sy + 2, C.dusk); // 못
    ellipse(bg, sx + 10, sy + 8, 6, 6, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.72 ? C.redL : undefined));
    stamp(bg, sx + 6, sy + 5, ['....dd', '.dddwd', 'ddddw.', 'dddww.', '.d.d..'], { d: C.dusk, w: C.cotton });
    line(bg, sx + 6, sy + 4, sx + 14, sy + 12, C.redL); line(bg, sx + 7, sy + 4, sx + 15, sy + 12, C.red);
    stamp(bg, sx + 16, sy + 12, ['..l', '.ll', 'lll'], { l: C.cotton }); bg.set(sx + 19, sy + 15, C.aqua); // 들린 모서리
  }
  // 기둥 밑동: 풀이 덮고, 그림자는 오른쪽 아래(광원 왼쪽 위)
  ellipse(bg, PX + PW + 6, POLE_FOOT + 1, 12, 2.2, (x, y) => darker(bg.get(x, y)));
  { const r = rng(57); for (let x = PX - 3; x < PX + PW + 4; x += 2) tuft(bg, x, POLE_FOOT + 1, r, 1); }

  // 바구니 접지 그림자(오른쪽 아래). 바구니는 움직이지 않아서 그림자는 배경에 둔다
  ellipse(bg, 164, 237, 18, 2, (x, y) => darker(bg.get(x, y)));
}

export const SCENE = {
  id: 'magpie_nest',
  // 띠 (a)·(b)·(c)는 다 그렸다. 배포 전환(draft 해제)은 replay.ts --require-art로 배포본을 다시 재생하는 별도 PR에서 한다(#145).
  draft: true,
  bg(img) { drawBg(img); },
  objects: OBJECTS,
  grips: GRIPS,
  anims: {},
};
