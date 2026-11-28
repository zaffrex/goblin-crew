// 빨래방 v2 (`docs/design/screens/laundromat-v2.md` 9-2절, #1031·#1067) 덕트 위 수건과 조는 까치.
// 이번 조각: N1 덕트 위 마른 수건 + 귀퉁이가 덕트 윗면을 따라 둥지로(까치 밑) / 까치가 간 뒤 귀퉁이 늘어짐(2칸),
//            N2 조는 까치(고개 떨군 앉음 + 작은 z, 1칸).
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 화면 JSON PR이 `towel`·`magpie` 핫스팟을 만들면 물건 시트에 붙인다
// (시트가 있는 화면은 핫스팟을 전부 그려야 해서, 핫스팟보다 먼저 시트에 넣으면 순서가 꼬인다. N4·N5와 같은 이유).
//
// 수건은 쭉이가 집는 물건이라 ink 외곽선을 두른다(ADR-0007 결정 3-1). 색은 N4 통 속 수건(`laundromat.towel.mjs`)과 같다:
//   마름 tealL(Y188) 몸 + tealM(Y132) 골·단 + aqua(Y233) 형광등 반사(왼쪽 위). 젖은 수건은 덕트 위에 안 올라가서 젖은 색은 없다.
//   뒤 벽 cotton(Y222)과 34, 들창 판자 woodL(Y149)과 39, 덕트 은색 lav(Y131)과 57 떨어지고 ink가 한 번 더 가른다.
// 자리: 수건 몸은 `towel` 상자(116, 40, 32×36) 안, 덕트 가로 구간(y 52~63, laundromat.room.mjs DUCT) 위에 걸친다.
//   귀퉁이 띠는 그림에만 있다(상자 밖, 9-2절 N1). 덕트 윗면(y 49~50)을 따라 왼쪽으로 가다가 들창 앞에서 비스듬히 올라
//   둥지 윗줄(y 42~43)에 눕고, 까치 몸 밑으로 들어가 꼬리 앞에서 끝이 삐죽 나온다. "깔고 있다"는 이 끝 2~3px이 말한다.
// 미리보기·검사: node docs/design/screens/laundromat-v2-duct-preview.mjs

import { C, Image } from '../lib/pixel.mjs';
import { stamp, outlined } from '../lib/texture.mjs';
import { MAGPIE_LEGEND } from './magpie_nest.objects.mjs';

const DRY = { L: C.tealL, M: C.tealM, A: C.aqua };

// ═════════════ N1 덕트 위 수건 ═════════════
// 수건 몸: 덕트 윗면에 두툼하게 걸친 접힘(y 47~51) + 앞으로 늘어진 면(y 52~72). 늘어진 면은 덕트 앞을 가린다.
// 1배에서 "천"으로 읽히게 하는 것 셋: 세로 골 두 줄(M), 아래쪽 단 띠(M·L·M), 맨 아래 술(한 칸 걸러 비움).
// 오른쪽 아래 귀퉁이가 1px 더 내려와 한쪽으로 처진다(빳빳한 판으로 안 보이게).
export const DUCT_TOWEL_AT = { x: 119, y: 47 };
const DUCT_TOWEL_ROWS = [
  '..AALLLLLLLLLLLLLLLLLLL...',
  '.AALLLLLLLLLLLLLLLLLLLLL..',
  'ALLLLLLLLLLLLLLLLLLLLLLLL.',
  'LLLLLLLLLLLLLLLLLLLLLLLLLL',
  'MMMMMMMMMMMMMMMMMMMMMMMMMM',
  'LLLLLLMLLLLLLLLLLMLLLLLLLL',
  'ALLLLLMLLLLLLLLLLMLLLLLLLL',
  'LLLLLLMLLLLLLLLLLMLLLLLLLL',
  'LLLLLLLMLLLLLLLLLMLLLLLLLL',
  'LLLLLLLMLLLLLLLLLLMLLLLLLL',
  'LLLLLLLMLLLLLLLLLLMLLLLLLL',
  'LLLLLLLMLLLLLLLLLLMLLLLLLL',
  'LLLLLLLMLLLLLLLLLLMLLLLLLL',
  'LLLLLLLLMLLLLLLLLLMLLLLLLL',
  'LLLLLLLLMLLLLLLLLLLMLLLLLL',
  'LLLLLLLLMLLLLLLLLLLMLLLLLL',
  'LLLLLLLLMLLLLLLLLLLMLLLLLL',
  'MMMMMMMMMMMMMMMMMMMMMMMMMM',
  'LLLLLLLLLLLLLLLLLLLLLLLLLL',
  'MMMMMMMMMMMMMMMMMMMMMMMMMM',
  'LLLLLLLLLLLLLLLLLLLLLLLLLL',
  'L.L.L.L.L.L.L.L.L.L.L.LLLL',
  '......................L.L.',
];

// 귀퉁이 띠(까치 밑으로 끌려간 쪽). 열마다 [x, 위 y, 두께]. 맨 아래 칸은 M(띠 밑면 그늘), 나머지는 L.
//   x 64~67: 꼬리 앞에서 삐죽 나온 끝(1 → 2px). x 68~84: 둥지 윗줄 위(y 42~43), 까치 몸이 x 69~77을 덮는다.
//   x 85~92: 들창 앞에서 덕트 윗면까지 비스듬히 내려온다(팽팽히 당겨진 대각선). x 93~103: 덕트 윗면(y 49~50)에 눕는다.
function cornerStrip() {
  const cols = [];
  cols.push([64, 43, 1], [65, 42, 2], [66, 42, 2], [67, 42, 2]);
  for (let x = 68; x <= 84; x++) cols.push([x, 42, 2]);
  const diag = [[85, 43], [86, 44], [87, 45], [88, 45], [89, 46], [90, 47], [91, 48], [92, 48]];
  for (const [x, y] of diag) cols.push([x, y, 2]);
  for (let x = 93; x <= 103; x++) cols.push([x, 49, 2]);
  // x 104~118: 수건 왼쪽 위 귀퉁이가 당겨져 생긴 쐐기. 윗선은 덕트 윗면(y 49) 그대로, 수건 쪽으로 갈수록 아래로 넓어져(2 → 6px)
  // 덕트 앞을 비스듬히 덮으며 몸과 이어진다. 굵기가 끝까지 같으면 1배에서 "호스·관"으로 읽혀서(첫 시안) 삼각형으로 바꿨다.
  // 윗선을 올리면 수건 몸 둥근 귀퉁이(y 47~48)와 사이에 1px 홈이 생겨 따로 떨어진 덩어리로 보인다(둘째 시안).
  for (let x = 104; x <= 118; x++) cols.push([x, 49, 2 + Math.round((x - 104) / 3.5)]);
  return cols;
}
export const CORNER_STRIP = cornerStrip();

// 까치가 간 뒤: 끌려가던 왼쪽 위 귀퉁이가 툭 풀려 수건 왼쪽 옆으로 처진다(삼각형 자락, 끝이 아래 왼쪽).
// "이제 아무도 안 붙들고 있다"를 보여 줘서 쿵(3번 고리)을 추론하게 한다. 수건 몸 왼쪽 끝(x 119)에 붙는다.
const LOOSE_FLAP_AT = { x: 114, y: 49 };
const LOOSE_FLAP_ROWS = [
  '....A',
  '...AL',
  '..ALL',
  '..LLL',
  '.LLLM',
  '.LLLM',
  '.LLM.',
  'LLLM.',
  'LLM..',
  'LLM..',
  'LM...',
  'L....',
];

/**
 * N1 덕트 위 마른 수건. 둥지를 먼저 그린 뒤, 까치보다 먼저 그린다(까치 몸이 귀퉁이 띠를 덮어 "깔고 있다"가 된다).
 * @param {Image} img
 * @param {object} [o]
 * @param {'pinned'|'loose'} [o.corner] pinned = 귀퉁이가 둥지로 끌려감(까치가 깔고 앉음), loose = 까치가 간 뒤 처진 귀퉁이
 */
export function ductTowel(img, { corner = 'pinned' } = {}) {
  const t = new Image(img.w, img.h);
  stamp(t, DUCT_TOWEL_AT.x, DUCT_TOWEL_AT.y, DUCT_TOWEL_ROWS, DRY);
  if (corner === 'pinned') {
    for (const [x, y, n] of CORNER_STRIP) {
      for (let k = 0; k < n; k++) t.set(x, y + k, k === n - 1 && n > 1 ? DRY.M : DRY.L);
    }
  } else {
    stamp(t, LOOSE_FLAP_AT.x, LOOSE_FLAP_AT.y, LOOSE_FLAP_ROWS, DRY);
  }
  img.blit(outlined(t), 0, 0);
}

/** N1 수건 몸이 그리는 상자(외곽선 포함, 귀퉁이 띠·처진 자락 제외). `towel` 핫스팟 상자(116, 40, 32×36) 안이어야 한다. */
export const DUCT_TOWEL_BOX = {
  x: DUCT_TOWEL_AT.x - 1,
  y: DUCT_TOWEL_AT.y - 1,
  w: DUCT_TOWEL_ROWS[0].length + 2,
  h: DUCT_TOWEL_ROWS.length + 2,
};

// ═════════════ N2 조는 까치 ═════════════
// 앉은 자리는 O3와 같은 60,27 20×18(`MAGPIE_SIT_AT`). smug(부리를 오른쪽 위로 치켜든 세로 실루엣)의 반대로,
// 고개를 가슴 앞으로 떨궈 머리 꼭대기가 smug보다 5px 낮다(y 30 → 32 이하, 부리 끝 y 27 → 37).
// 몸은 둥지에 푹 주저앉아 발이 안 보이고(자는 새는 발을 깃털 속에 넣는다), 배 아래 끝이 y 43(둥지 윗줄)에 닿는다.
// 눈은 흰 눈 대신 감은 눈 lav 2px 가로줄. 부리 끝 lav 빛줄은 smug와 같은 약속. 꼬리는 둥지 왼쪽 끝으로 축 처진다.
// 1배에서 "고개 1px"(#530 교훈)로는 잠이 안 읽혀서 실루엣 전체(머리 높이 + 둥근 등)로 말한다(9-2절 N2).
export const MAGPIE_DOZE = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '...........kkkk.....',
  '.........kkkkkkkk...',
  '........kkkkkkkkkk..',
  '.......kkkkkkbbkkkk.',
  '.......kttkkkkkkkkkk',
  '......ktTTkkwwkkkkbk',
  '.....ktTmTtkwwwkkkk.',
  '....ktTmTtkkwwwwwk..',
  '...ktTmTtkkwwwwwwwc.',
  '..ktTmtkkkcwwwwwwcc.',
  '.ktTtk...kcwwwwwccl.',
  'ktTk.....kkcllllkk..',
  'tTk.................',
];
export const MAGPIE_DOZE_AT = { x: 60, y: 27 };

// 작은 z 두 개(효과라 외곽선 없음, white). 머리 오른쪽 위 하늘(들창 왼쪽 칸 purD)에 큰 z 5×5, 그 위 오른쪽에 작은 z 4×4.
// 4×4·3×3(첫 시안)은 대각선이 가운데 1~2px라 1배에서 "I"로 읽혔다. 5×5부터 대각선이 세 칸 걸쳐 z가 된다.
// 위로 떠오르는 움직임은 코드 이동(0칸, 9-2절 N2). 여기서는 멈춘 모습 자리만 정한다. 들창 왼쪽 칸 하늘(x 60~85, y 24~) 안.
export const DOZE_Z = { x: 75, y: 27 };
const Z_BIG = ['wwwww', '...w.', '..w..', '.w...', 'wwwww'];
const Z_SMALL = ['wwww', '..w.', '.w..', 'wwww'];

/**
 * N2 조는 까치 + z. (dx, dy)는 자리만 옮겨 찍기(0칸). zLift는 z만 위로 올리기(떠오름, 0칸).
 * @param {Image} img
 * @param {object} [o]
 * @param {boolean} [o.z] z를 그릴지
 */
export function magpieDoze(img, { dx = 0, dy = 0, z = true, zLift = 0 } = {}) {
  stamp(img, MAGPIE_DOZE_AT.x + dx, MAGPIE_DOZE_AT.y + dy, MAGPIE_DOZE, MAGPIE_LEGEND);
  if (!z) return;
  stamp(img, DOZE_Z.x + dx, DOZE_Z.y + dy - zLift, Z_BIG, { w: C.white });
  stamp(img, DOZE_Z.x + dx + 6, DOZE_Z.y + dy - zLift - 3, Z_SMALL, { w: C.white });
}
