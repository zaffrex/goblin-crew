// 빨래방 v2 (`docs/design/screens/laundromat-v2.md` 9-2절, #1031) 수건 사슬 물건 칸.
// 이번 조각: N4 세탁기 1번 열린 통 속 마른 수건, N5 동전 넣는 곳에 반쯤 낀 동전.
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 화면 JSON PR이 `washer`·`towel`·`coin` 핫스팟을 만들면 물건 시트에 붙인다
// (시트가 있는 화면은 핫스팟을 전부 그려야 해서, 핫스팟보다 먼저 시트에 넣으면 순서가 꼬인다).
//
// 세탁기 몸(`laundromat.washer.mjs`)은 배경이라 ink를 안 쓰지만, 수건·동전은 쭉이가 집는 물건이라 ink 외곽선을 두른다(ADR-0007 결정 3-1).
// 색: 마른 수건 tealL(Y188) 몸 + tealM(Y132) 접힌 골 + aqua(Y233) 형광등 반사(왼쪽 위). 젖으면 한 단씩 내린다(N 칸 0, 색 바꿈):
//   tealL → teal(Y86), tealM → tealD(Y53), aqua → tealM. 마름 ↔ 젖음 명도 차 102(#1061 리뷰).
//   통 속은 dusk(Y87)·plum(Y54)이라 마른 수건과 101 이상 떨어진다. 젖은 수건은 통 속에 안 남는다(`washer_go`가 `washer.towel`을 끈다).
// 미리보기·검사: node docs/design/screens/laundromat-v2-washer-preview.mjs

import { C, EMPTY, Image } from '../lib/pixel.mjs';
import { stamp, outlined } from '../lib/texture.mjs';
import { WASHER_W } from './laundromat.washer.mjs';

const DRY = { L: C.tealL, M: C.tealM, A: C.aqua };
const WET = { L: C.teal, M: C.tealD, A: C.tealM };

// N4 통 속 수건 더미. 세탁기 몸 기준(dx, dy) 10,30에 찍는다. 통 안쪽 원(가운데 18.5,30.5, 반지름 10.5) 아래 반쪽에 앉고,
// 한 자락이 통 입구 왼쪽 아래 테두리 너머(열린 문 쪽)로 비스듬히 늘어져 세탁기 앞판(grnL Y155, 마른 수건과 33 차 + ink)까지 내려온다.
// 자락을 가운데로 내리면 더미와 합쳐 티셔츠·버섯 실루엣이 돼서(둘째 시안) 한쪽으로 비켜 기울였다.
// 1배에서 더미만 있으면 "하늘색 구름·만두"로 읽혀서(첫 시안), 늘어진 자락의 네모 끝과 단 줄(M 한 줄)로 "천, 수건"을 말한다.
// 위 윤곽은 울퉁불퉁(구겨짐), 골(M)은 오른쪽 아래로 흐르고, 반사(A)는 왼쪽 위 몇 점뿐이다.
const DRUM_TOWEL_AT = { dx: 10, dy: 30 };
const DRUM_TOWEL_ROWS = [
  '......LL.........',
  '...AALLLL..LL....',
  '..ALLLLLMLLLLL...',
  '.ALLLMLLLLLLLLL..',
  '.LLLLLMMLLLLMLL..',
  'LLLMLLLLLLLMLLLL.',
  'LLLLMMLLLLLLMLLL.',
  '.LLLLLLLMLLLLLL..',
  '..LLLLLLLLLLL....',
  '..ALLLLLM........',
  '.ALLLLLM.........',
  '.LLLLLLM.........',
  'LLLLLLM..........',
  'MMMMMMM..........',
  'LLLLLM...........',
];

/**
 * N4 세탁기 1번(문 열림) 통 속 마른 수건. (x, y) = 세탁기 몸 왼쪽 위(`washer()`에 준 자리와 같다).
 * 문 열린 세탁기를 먼저 그린 뒤 위에 얹는다. 외곽선은 통 속 어두운 색 위에서도 둘러서 물건 테두리를 지킨다.
 * @param {object} [o]
 * @param {boolean} [o.wet] 젖은 색(테스트·미리보기용. 정답 길에서는 젖은 수건이 통에 안 남는다)
 */
export function drumTowel(img, x, y, { wet = false } = {}) {
  const t = new Image(img.w, img.h);
  stamp(t, x + DRUM_TOWEL_AT.dx, y + DRUM_TOWEL_AT.dy, DRUM_TOWEL_ROWS, wet ? WET : DRY);
  img.blit(outlined(t), 0, 0);
}

/** N4 수건 그림이 차지하는 상자(외곽선 포함, 세탁기 몸 기준). 검사·물건 상자 계산용. */
export const DRUM_TOWEL_BOX = {
  dx: DRUM_TOWEL_AT.dx - 1,
  dy: DRUM_TOWEL_AT.dy - 1,
  w: DRUM_TOWEL_ROWS[0].length + 2,
  h: DRUM_TOWEL_ROWS.length + 2,
};

// N5 동전 넣는 곳(세탁기 몸 dx 4~8, dy 3~7 lav 판, 세로 홈 dx 6 dy 4~6)에 반쯤 낀 동전.
// 자판기 동전(은색, 금색은 열쇠 전용)을 앞에서 본 반달로 그린다: 동전 윗반쪽 5×3이 홈 위로 솟고 아랫반쪽은 홈 속이다.
// 첫 시안은 옆에서 본 테두리(stand 3×5) 위 세 줄이었는데 3배로 봐도 "손잡이·꼭지"로 읽혀서, 저금통 투입구처럼 누구나 아는 반달로 바꿨다.
// 홈(dusk)은 아래로 그대로 비친다. 동전 몸 lint(Y178)·white와 조작판 cotton(Y222)은 44 이상 떨어지고, ink 외곽선이 한 번 더 가른다.
// 외곽선 아래 줄은 그리지 않는다(동전이 홈 안으로 이어진다). 위 끝은 몸 dy 0(세탁기 윗선)까지라 상자 밖으로 안 나간다.
const SLOT_COIN_AT = { dx: 4, dy: 1 };
const SLOT_COIN_ROWS = ['.cWc.', 'cWWcd', 'cWccd'];
const SLOT_COIN_LEGEND = { c: C.lint, W: C.white, d: C.lav };

/** N5 동전 넣는 곳에 반쯤 낀 동전. (x, y) = 세탁기 몸 왼쪽 위. `nudge`는 1px 떨림(0칸, 시트 anim이 쓴다)으로 가로만 민다. */
export function slotCoin(img, x, y, { nudge = 0 } = {}) {
  const t = new Image(img.w, img.h);
  const cx = x + SLOT_COIN_AT.dx + nudge, cy = y + SLOT_COIN_AT.dy;
  stamp(t, cx, cy, SLOT_COIN_ROWS, SLOT_COIN_LEGEND);
  const o = outlined(t);
  // 외곽선 중 몸 아래 줄보다 아래(홈 속)는 지운다
  for (let px = cx - 1; px <= cx + SLOT_COIN_ROWS[0].length; px++) o.set(px, cy + SLOT_COIN_ROWS.length, EMPTY);
  img.blit(o, 0, 0);
}

/** N5 동전이 그리는 상자(세탁기 몸 기준, 외곽선 포함, nudge 0). */
export const SLOT_COIN_BOX = { dx: SLOT_COIN_AT.dx - 1, dy: SLOT_COIN_AT.dy - 1, w: SLOT_COIN_ROWS[0].length + 2, h: SLOT_COIN_ROWS.length + 1 };

/** 세탁기 한 대 폭(문 열림 때 왼쪽으로 나오는 8px 포함). 물건 시트에 1번을 자를 때 쓴다. */
export const WASHER_OPEN_SPAN = { dx: -7, w: WASHER_W + 7 };
