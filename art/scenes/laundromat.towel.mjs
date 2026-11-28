// 빨래방 v2 (`docs/design/screens/laundromat-v2.md` 9-2절, #1031) 수건 사슬 물건 칸.
// 이번 조각: N4 세탁기 1번 열린 통 속 마른 수건, N5 세탁기 윗선 투입 홈에 반쯤 낀 동전.
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

// N5 반쯤 낀 동전. 세탁기 윗선(몸 dy 0)에 난 투입 홈에 은색 동전이 세로로 서서 윗부분이 윗선 위로 솟는다(저금통 투입구처럼).
// 둘째 시안(#1068)은 조작판 lav 판 홈 위 반달 5×3이었는데, 블라인드 두 번(PM·Theo, 1배)에서 동전 언급이 0이었고 3배로 봐도
// ink 아치가 "세탁기에 걸린 자물쇠 고리"로 읽혔다. 원인은 둘: 몸이 13px로 작고, 뒤가 밝은 조작판(cotton Y222)이라 은색(lint Y178)이 묻히고
// 어두운 ink 아치만 남았다. 그래서 (1) 윗선 위로 올려 실루엣을 깨고(눈은 윤곽이 튀어나온 데로 먼저 간다),
// (2) 뒤를 기계 줄 뒤 아래 벽 띠 plum(Y54, 명도 띠 결정)으로 바꿔 은색 몸이 어두운 배경 위에 서게 하고, (3) 몸을 13px에서 47px로 키웠다.
// ink 외곽선은 plum 위에서 거의 안 보여서 아치로 읽히지 않는다. 몸이 먼저 보인다.
// (3)에서 지름 8 원의 위 6줄 + 오른쪽 두께 1줄(9×6)로 키웠다. 위 4·5줄 반달은 공처럼 음영이 져서 "종·돌·버튼"으로 읽혔다.
// 그래서 공 음영 대신 동전 문법을 쓴다: lav 테두리 한 바퀴 + lint 면 + 왼쪽 위에서 내려오는 white 사선 반사(납작한 금속) + 오른쪽 dusk 두께(원판 옆면).
// 바닥 동전(`COIN` 5×3)보다 크게 그렸다. 낀 동전은 읽는 것이 목적이라 크기 맞춤보다 먼저다.
// 색: 면 lint(Y178), 반사 white(Y249), 테두리 lav(Y131), 두께 dusk(Y87). 금색은 열쇠 전용이라 은색(100円玉)을 지킨다.
// 투입 홈은 윗선 위 dusk 9px 한 줄이다. 배경 세탁기에는 없고 동전과 같이만 그린다(`coin.stuck`이 꺼지면 홈도 같이 사라진다. 1px 줄이라 눈에 안 띈다).
// 가로 자리는 조작판 동전 투입구(dx 6 세로 홈) 바로 위라 "여기에 넣는 기계"로 이어 읽힌다.
const SLOT_COIN_AT = { dx: 2, dy: -6 };
const SLOT_COIN_ROWS = ['..rrrr...', '.rcWccrd.', 'rcWccccrd', 'rWcccccrd', 'rccccccrd', 'rcccccrrd'];
const SLOT_COIN_LEGEND = { c: C.lint, W: C.white, r: C.lav, d: C.dusk };
const COIN_SLIT = { dx: 1, dy: 0, w: 11 };

/** N5 세탁기 윗선 홈에 반쯤 낀 동전. (x, y) = 세탁기 몸 왼쪽 위. 동전은 몸 위로 6줄(외곽선 7줄) 나간다. `nudge`는 1px 떨림(0칸, 시트 anim이 쓴다)으로 가로만 민다. */
export function slotCoin(img, x, y, { nudge = 0 } = {}) {
  const t = new Image(img.w, img.h);
  const cx = x + SLOT_COIN_AT.dx + nudge, cy = y + SLOT_COIN_AT.dy;
  stamp(t, cx, cy, SLOT_COIN_ROWS, SLOT_COIN_LEGEND);
  const o = outlined(t);
  // 외곽선 중 몸 아래 줄보다 아래(홈 속)는 지우고, 그 자리에 투입 홈을 긋는다(홈은 떨리지 않는다)
  for (let px = cx - 1; px <= cx + SLOT_COIN_ROWS[0].length; px++) o.set(px, cy + SLOT_COIN_ROWS.length, EMPTY);
  for (let i = 0; i < COIN_SLIT.w; i++) o.set(x + COIN_SLIT.dx + i, y + COIN_SLIT.dy, C.dusk);
  img.blit(o, 0, 0);
}

/** N5 동전 몸 픽셀 수(외곽선·홈 빼고). 검사용. */
export const SLOT_COIN_BODY_PX = SLOT_COIN_ROWS.join('').replace(/\./g, '').length;

/** N5 동전이 그리는 상자(세탁기 몸 기준, 외곽선·홈 포함, nudge 0). dy가 음수다(몸 위로 나간다). */
export const SLOT_COIN_BOX = {
  dx: Math.min(SLOT_COIN_AT.dx - 1, COIN_SLIT.dx),
  dy: SLOT_COIN_AT.dy - 1,
  w: Math.max(SLOT_COIN_ROWS[0].length + 2, COIN_SLIT.w),
  h: SLOT_COIN_ROWS.length + 2,
};

/** 세탁기 한 대 폭(문 열림 때 왼쪽으로 나오는 8px 포함). 물건 시트에 1번을 자를 때 쓴다. */
export const WASHER_OPEN_SPAN = { dx: -7, w: WASHER_W + 7 };
