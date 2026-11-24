// 스테이지 3 `laundromat` 물건 그림 (#764, 설계 docs/design/screens/laundromat.md 9-2). 아직 빌드(art/build.mjs)에 연결하지 않았다.
// 시트를 만드는 PR에서 부른다(시트가 생기는 순간 hotspot-coverage 검사가 켜진다, 결정 2026-11-22-scene-sheet-covers-all-targets).
// 만질 수 있는 것이라 바깥 1px ink 외곽선(ADR-0007 결정 3-1). 광원은 배경과 같은 왼쪽 위. 금색(yel 계열)은 열쇠 전용(magpie_nest와 같은 약속).
//
// 지금 있는 것:
//   O1 열쇠 + 나무 패(1칸): 길바닥·둥지·혹 속에서 같은 그림. 패가 넓어서 덕트 아래 끝에 걸린다(S5). 패가 열쇠보다 크고 밝게.
// 미리보기·검사: node docs/design/screens/laundromat-gap-transom-preview.mjs

import { C, Image } from '../lib/pixel.mjs';
import { stamp, outlined } from '../lib/texture.mjs';

/** 열쇠 + 나무 패 크기(외곽선 포함). (x, y) = 왼쪽 위 */
export const KEY_TAG = { w: 19, h: 8 };
/** 길바닥 열쇠 자리(셔터 찌그러진 틈 밑, laundromat.shutter.mjs DENT). 아래 끝 y 243 = 가장 가까운 판석 줄 */
export const KEY_ON_STREET = { x: 97, y: 236 };

// 패: 나무(woodL, 위 tan 빛, 오른쪽·아래 wood 그늘) 9×6 + 끈 구멍 + 새긴 홈 한 줄(글자 없음).
// 고리: 쇠 링(lint). 열쇠: 금색 머리(동그라미, 구멍) + 몸 + 이 두 개. 누워 있어 오른쪽을 본다.
const KEY_ROWS = [
  '.kkkkkkkk..........',
  'kTTTTTTLwk..kkkk...',
  'kTLLLLLLwkk.kYYyk..',
  'kTLkLLLLwklkYk.ykkkk',
  'kTLLwwwLwkkkYk.yyyyk',
  'kLLLLLLLwk..kyyykyk.',
  '.kwwwwwwk....kkk.k..',
  '..kkkkkk............',
];
const KEY_LEGEND = { k: C.ink, T: C.tan, L: C.woodL, w: C.wood, l: C.lint, Y: C.yelL, y: C.yel };

/** O1 열쇠 + 나무 패를 (x, y)에 그린다(외곽선은 격자에 들어 있다). */
export function keyTag(img, x, y) {
  const t = new Image(KEY_TAG.w + 1, KEY_TAG.h);
  stamp(t, 0, 0, KEY_ROWS, KEY_LEGEND);
  img.blit(t, x, y);
}

// ═════════════ O2 후드 위 둥지 (빈 둥지 1칸. 열쇠 든 반짝 2칸은 다음 PR) ═════════════
// 들창 왼쪽 칸 안, 배기 후드(laundromat.room.mjs HOOD) 위에 얹힌다. magpie_nest 둥지(36×13)보다 작은 22×11:
// 창 칸 높이 48 안에 까치 18 + 둥지 11 + 후드 9가 들어가야 한다(laundromat.md 2-1).
// 이번 둥지는 잔가지 반, **날아간 손님 양말 반**으로 지었다: 테두리에 줄무늬 양말이 감겨 있고, 분홍 양말 한 귀퉁이가
// 후드 갓 쪽으로 늘어져 있다(S3 D, 3번 건조기 문틈 양말과 같은 pinkL/pink, 펄럭 루프 없는 정지 그림). 병뚜껑 하나(반짝이 수집가).
export const NEST = { x: 63, y: 43, w: 22, h: 11 };
const NEST_ROWS = [
  '...wLw.TwLwT.wLw......',
  '.wTLwTsSsSsSwLTwLw....',
  'wLwwLsSsSsSsSwwLwTw...',
  'wwLwwwLwwcwLwwLwwLww..',
  '.DwwLwwwccCwwLwwwDw...',
  '.DwDwwLwwcwwwDwwDwD...',
  '..DDwDwwDwwDwwDwDD....',
  'ppP..DDDwDDwDDDD......',
  'pPp...DDDDDDDD........',
  'pPp...................',
  '.pp...................',
];
const NEST_LEGEND = { w: C.wood, L: C.woodL, T: C.tan, D: C.woodD, s: C.tealL, S: C.cotton, c: C.lint, C: C.white, p: C.pinkL, P: C.pink };

/** O2 빈 둥지(후드 위). 외곽선 포함. */
export function nestEmpty(img) {
  const t = new Image(img.w, img.h);
  stamp(t, NEST.x, NEST.y, NEST_ROWS, NEST_LEGEND);
  img.blit(outlined(t), 0, 0);
}
