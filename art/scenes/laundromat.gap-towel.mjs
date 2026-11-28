// 빨래방 v2 (`docs/design/screens/laundromat-v2.md` 9-2절, #1031·#1067) 셔터 밑 틈으로 나가는 수건.
// 이번 조각: N8 바닥에 납작 미끄러지는 수건 띠(1칸). 한 칸을 세 자리에서 쓴다(자리·들뜸·색은 코드, 새 칸 0):
//   slip  : T5 `gap.towel_slip`. 마른 수건이 틈 밖 열쇠 위를 지나가는데, 가벼워서 오른쪽 반이 **아치로 들떠** 열쇠에 안 닿는다.
//           아치 밑으로 금색 고리가 그대로 보인다. "덮었는데 안 잡혔다"를 정지 그림 한 장이 말하는 자리다.
//   back  : 빈 수건이 가게 바닥으로 돌아온 자리. 끝이 조금 들려 팔랑거리고, 열쇠는 틈 밖에 그대로 있다.
//   cover : 클리어 첫 박자(`gap_drag`). 젖은 수건은 무거워서 들뜨지 않고(들뜸 0) 열쇠를 납작하게 다 덮는다.
//           젖은 색은 N4와 같은 한 단 내림(tealL → teal, tealM → tealD, aqua → tealM).
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 화면 JSON PR이 `towel` 핫스팟을 만들면 물건 시트에 붙인다(N1·N4·N5와 같은 이유).
//
// 틈이 6~14px뿐이라(laundromat.shutter.mjs DENT) 열쇠 "위로 날아가는" 그림은 들어갈 자리가 없다(첫 시안: 열쇠 위 빈 줄이 3~6px,
// 수건이 이를 가려 파도처럼 읽힘). 그래서 수건이 열쇠를 **덮는 자리 그대로** 들뜸만 다르게 해서 마름(들뜸) ↔ 젖음(착 붙음)을 가른다.
// 수건은 셔터 바깥에 있으므로 셔터 판 아래 끝(244 − gapLift)보다 위 픽셀은 그리지 않는다(판 뒤로 숨는다). 가게 바닥(y ≥ 244)은 그대로 그린다.
// 쭉이가 집는 물건이라 ink 외곽선을 두른다(ADR-0007 결정 3-1). 외곽선도 같은 규칙으로 잘린다.
// 미리보기·검사: node docs/design/screens/laundromat-v2-gap-preview.mjs

import { C, EMPTY, Image } from '../lib/pixel.mjs';
import { outlined } from '../lib/texture.mjs';
import { SHUTTER, gapLift } from './laundromat.shutter.mjs';

const DRY = { L: C.tealL, M: C.tealM, A: C.aqua };
const WET = { L: C.teal, M: C.tealD, A: C.tealM };

// 땅에 누운 수건을 낮은 앞에서 본 띠(31×5). 먼 쪽(위) 가장자리는 물결(팔랑), 가까운 쪽(아래)은 곧은 단(M, N4 통 속 수건 단 줄과 같은 문법).
// 반사(A)는 왼쪽 위 몇 점뿐이다(광원 왼쪽 위 형광등).
const GAP_TOWEL_ROWS = [
  '..AAAL.LLLL...LLLLL..LLLLL.....',
  '.ALLLLLLLLLLLLLLLLLLLLLLLLLLL..',
  'LLLLLLMLLLLLLLLLLLMLLLLLLLLLLL.',
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
];
// 열마다 들뜨는 높이(px, `lift` 1일 때). 오른쪽 반(열 11~29, 꼭대기 13~26)이 아치로 들린다. 왼쪽 반은 땅에 붙어 "밀려 나가는 중"을 남긴다.
const GAP_TOWEL_ARCH = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1, 0];

export const GAP_TOWEL = { w: GAP_TOWEL_ROWS[0].length, h: GAP_TOWEL_ROWS.length };

/**
 * 세 자리(화면 좌표, 띠 왼쪽 위). 움직임 중간 칸은 이 사이를 코드로 옮긴다(0칸).
 * slip: 들뜸 2 → 아치 꼭대기가 6px 떠서 아치 밑 y 238~243에 열쇠 고리·몸이 보인다.
 * cover: 열쇠(90,236 30×8) 전체를 덮는 자리(띠 + 외곽선 y 236~244, x 87~119).
 * back: 가게 바닥(틈 왼쪽 앞, 열쇠와 가로 18px 이상 떨어짐), 끝만 살짝 들림. 첫 블라인드에서 수건 끝이 열쇠 바로 밑(x 102)이라 "열쇠를 끌어왔다"로 읽혀서 떼어 놓았다.
 */
export const GAP_TOWEL_POSE = {
  slip: { x: 86, y: 239, lift: 2, wet: false },
  back: { x: 40, y: 252, lift: 0.7, wet: false },
  cover: { x: 88, y: 237, lift: 0, wet: true },
};

/** 셔터 바깥(틈 너머) 픽셀이 보이는가. 셔터 판 x 범위에서 판 아래 끝보다 위면 판 뒤라 안 보인다. */
export const gapVisible = (x, y) => {
  const bottom = SHUTTER.y + SHUTTER.h;
  if (y >= bottom || x < SHUTTER.x || x >= SHUTTER.x + SHUTTER.w) return true;
  return y >= bottom - gapLift(x);
};

/**
 * N8 수건 띠를 그린다. 잠긴 셔터(`shutter(img, 'locked')`)와 길바닥 열쇠를 먼저 그린 뒤 위에 얹는다.
 * @param {{ x: number, y: number, lift?: number, wet?: boolean }} pose 띠 왼쪽 위(화면 좌표), 들뜸 배수, 젖음
 */
export function gapTowel(img, { x, y, lift = 0, wet = false }) {
  const legend = wet ? WET : DRY;
  const t = new Image(img.w, img.h);
  GAP_TOWEL_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    t.set(x + i, y + j - Math.round(GAP_TOWEL_ARCH[i] * lift), legend[ch]);
  }));
  const o = outlined(t);
  for (let py = 0; py < img.h; py++) for (let px = 0; px < img.w; px++) {
    const c = o.get(px, py);
    if (c !== EMPTY && gapVisible(px, py)) img.set(px, py, c);
  }
}
