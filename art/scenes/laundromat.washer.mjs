// 화면 1 `laundromat` 배경 세탁기 한 대 (#764, m2-art-split.md "세탁기 한 대와 문 열린 모습"은 L칸, 줄 세우기는 D칸).
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 배경 그림(art/scenes/laundromat.mjs)이 생기면 거기서 불러 줄 세운다.
// 퍼즐과 상관없는 방 껍데기라(#802 재료 목록 1절 "그대로 두는 것") `laundromat` 다시 보기 전에 먼저 그린다.
// 배경이라 ink(0)·hint(31)를 쓰지 않는다(ADR-0007 결정 3-1). 광원은 왼쪽 위 형광등 하나(결정 3-3, 새벽 4시 10분 가게 안).
//
// 색: 몸 주색 grnL(Y155) 민트. 게임을 시작하면 세 사람이 세탁기 줄 바로 앞(x 240·280·320)에 서서,
//   몸 주색이 세 사람 주색(빨강 Y104, 바지 dusk Y87, 멜빵 teal Y86, 셔츠 white Y249, 우비 yel Y208)과 모두 30 이상 떨어져야 한다.
//   흰 법랑(cotton·white)은 ズッシー 셔츠·ノビー 줄무늬와 붙고, 회색 lint(Y178)는 우비와 30 딱 경계라 안 골랐다.
// 미리보기·검사: node docs/design/screens/laundromat-washer-preview.mjs

import { C } from '../lib/pixel.mjs';
import { hash, bay, fill, ellipse } from '../lib/texture.mjs';

/** 한 대 크기(px). 줄 간격은 40(176~336에 4대), 사이 2px. */
export const WASHER_W = 38, WASHER_H = 56;

// 3×5 숫자(번호표). 1~4만 쓴다.
const DIGIT = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
};

/**
 * 세탁기 한 대를 (x, y) 왼쪽 위에 그린다.
 * @param {object} o
 * @param {number} o.n 번호표 숫자(1~4)
 * @param {'empty'|'load'|'open'} [o.door] 닫힘·빈 통 / 닫힘·빨래 든 통 / 문 열림(경첩 왼쪽, 문이 왼쪽 앞으로 8px 나온다)
 */
export function washer(img, x, y, { n, door = 'empty' }) {
  const W = WASHER_W, H = WASHER_H;
  const P = (dx, dy, c) => img.set(x + dx, y + dy, c);

  // ── 몸통: 왼쪽·위 가장자리 1px 밝게, 오른쪽 2px·아래 그늘. 법랑이라 면은 거의 한 색(낮은 대비)
  fill(img, x, y, W, H, (px, py) => {
    const dx = px - x, dy = py - y;
    if (dx === 0 || dy === 0) return C.grnP;
    if (dx >= W - 2) return dx === W - 1 ? C.grn : bay(px, py, 0.5, C.grnL, C.grn);
    return C.grnL;
  });
  // 모서리 둥글게(배경색이 비치게 지운다 = 아무것도 안 찍은 자리는 호출 쪽 벽이 남는다): 네 귀 1px
  for (const [dx, dy] of [[0, 0], [W - 1, 0]]) img.set(x + dx, y + dy, img.get(x + dx, y + dy - 1));

  // ── 위 조작판(높이 10): 밝은 cotton 판, 동전 투입구·표시창·다이얼
  fill(img, x + 1, y + 1, W - 3, 9, (px, py) => (py === y + 1 ? C.white : py === y + 9 ? C.lint : C.cotton));
  fill(img, x + 1, y + 10, W - 3, 1, C.grn); // 판 아래 이음매 그늘
  // 동전 투입구: lav 판 위 dusk 세로 홈
  fill(img, x + 4, y + 3, 5, 5, C.lav);
  fill(img, x + 6, y + 4, 1, 3, C.dusk);
  P(4, 3, C.lint);
  // 표시창: 새벽이라 꺼짐(tealD), 왼쪽 위 유리 반사 한 점
  fill(img, x + 12, y + 3, 10, 5, C.tealD);
  P(12, 3, C.teal); P(13, 3, C.teal);
  // 다이얼: 동그라미 + 눈금
  ellipse(img, x + 29.5, y + 5.5, 3, 3, (px, py, ex, ey) => (ex + ey < -0.6 ? C.white : ex + ey > 0.7 ? C.lav : C.lint));
  P(29, 3, C.dusk); P(29, 4, C.dusk);

  // ── 아래 발판(높이 7): 한 단 어두운 띠 + 통풍 줄 셋 + 번호표
  const KY = H - 7;
  fill(img, x + 1, y + KY, W - 3, 6, (px, py) => (py === y + KY ? C.grn : (px - x) % 4 === 1 && px - x > 18 && py > y + KY + 1 && py < y + H - 2 ? C.grnD : C.grnL));
  fill(img, x, y + H - 1, W, 1, C.grn); // 바닥에 닿는 줄
  // 번호표: cotton 판 5×7에 dusk 숫자(Mia가 "3번이 없다"를 보진 않는다, 건조기가 3번이라 세탁기는 1~4 따로 센다)
  fill(img, x + 4, y + KY, 5, 7, C.cotton);
  fill(img, x + 4, y + KY, 5, 1, C.white);
  (DIGIT[n] ?? DIGIT[1]).forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') P(5 + i, KY + 1 + j, C.dusk); }));

  // ── 둥근 문(가운데 아래쪽). 바깥 링은 금속, 유리 안은 어두운 통
  const cx = x + 18.5, cy = y + 30.5, RO = 13, RI = 10;
  const ring = (px, py, ex, ey) => (ex + ey < -0.9 ? C.white : ex + ey < -0.2 ? C.lint : ex + ey < 0.8 ? C.lav : C.dusk);
  const glass = (px, py, ex, ey) => {
    const r = Math.hypot(ex, ey);
    if (ex + ey < -0.55 && ex + ey > -0.95 && r > 0.35) return C.tealM; // 형광등 반사 띠(왼쪽 위 사선)
    if (r > 0.82) return C.tealD;
    return bay(px, py, 0.25, C.tealD, C.teal);
  };
  if (door !== 'open') {
    ellipse(img, cx, cy, RO, RO, ring);
    ellipse(img, cx, cy, RI, RI, glass);
    if (door === 'load') {
      // 통 바닥에 빨래 더미: 색 덩어리 몇 개(유리 너머라 한 단 어둡게 보이는 색만)
      const LAUNDRY = [C.red, C.yelD, C.pink, C.pur, C.lint];
      for (let i = 0; i < 9; i++) {
        const bx = cx - 7 + hash(n, i, 1) * 14, by = cy + 3 + hash(n, i, 2) * 4;
        ellipse(img, bx, by, 2.6, 1.8, (px, py) => (Math.hypot(px + 0.5 - cx, py + 0.5 - cy) < RI - 1 ? LAUNDRY[(i + n) % 5] : undefined));
      }
      // 반사 띠는 빨래 위에도 남는다
      ellipse(img, cx, cy, RI, RI, (px, py, ex, ey) => (ex + ey < -0.55 && ex + ey > -0.95 && Math.hypot(ex, ey) > 0.35 ? C.tealM : undefined));
    }
    // 손잡이: 링 오른쪽에 세로 막대
    fill(img, Math.round(cx + RO - 1), Math.round(cy - 3), 2, 7, C.lav);
    img.set(Math.round(cx + RO - 1), Math.round(cy - 3), C.lint);
  } else {
    // 구멍: 링 자리만 남고 안은 드럼(어둡고 구멍 무늬)
    ellipse(img, cx, cy, RO, RO, (px, py, ex, ey) => (Math.hypot(ex, ey) > 0.8 ? ring(px, py, ex, ey) : undefined));
    ellipse(img, cx, cy, RI + 0.5, RI + 0.5, (px, py, ex, ey) => {
      if (ey < -0.55) return C.plum; // 위쪽은 깊어서 더 어둡다
      return px % 3 === 0 && py % 3 === 0 ? C.plum : C.dusk; // 드럼 구멍(3px 간격 점)
    });
    // 열린 문: 경첩이 왼쪽. 앞으로 열려서 옆에서 보면 좁은 타원, 몸통 왼쪽 끝 밖으로 8px 나온다
    const ox = x + 1, oy = cy;
    ellipse(img, ox, oy, 7, RO, (px, py, ex, ey) => (Math.hypot(ex, ey) > 0.72 ? (ex < -0.2 ? C.lint : C.lav) : ey < -0.3 && ex < 0.2 ? C.tealM : C.tealD));
    fill(img, x + 1, Math.round(oy - 4), 2, 8, C.dusk); // 경첩
  }

  // ── 몸통 아래 그림자(바닥 쪽, 호출 쪽 바닥 위에 2줄)
  for (let dx = 1; dx < W + 1; dx++) img.set(x + dx, y + H, hash(x + dx, y + H, 5) < 0.85 ? C.lav : img.get(x + dx, y + H));
}
