// 스테이지 3 `laundromat` 물건 그림 (#764, 설계 docs/design/screens/laundromat.md 9-2). 아직 빌드(art/build.mjs)에 연결하지 않았다.
// 시트를 만드는 PR에서 부른다(시트가 생기는 순간 hotspot-coverage 검사가 켜진다, 결정 2026-11-22-scene-sheet-covers-all-targets).
// 만질 수 있는 것이라 바깥 1px ink 외곽선(ADR-0007 결정 3-1). 광원은 배경과 같은 왼쪽 위. 금색(yel 계열)은 열쇠 전용(magpie_nest와 같은 약속).
//
// 지금 있는 것:
//   O1 열쇠 + 나무 패(1칸): 길바닥·둥지·혹 속에서 같은 그림. 패가 넓어서 덕트 아래 끝에 걸린다(S5). 패가 열쇠보다 크고 밝게.
//   O2 후드 위 빈 둥지(1칸).
//   O3 틈 속 까치 머리·부리(2칸, `gap.snatch`).
// 미리보기·검사: node docs/design/screens/laundromat-bg-sketch.mjs (들창·틈·열쇠), node docs/design/screens/laundromat-gap-snatch-preview.mjs (틈 속 머리)

import { C, Image, EMPTY } from '../lib/pixel.mjs';
import { stamp, outlined } from '../lib/texture.mjs';
import { SHUTTER, gapLift } from './laundromat.shutter.mjs';

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

// ═════════════ O3 틈 속 까치 머리·부리 (2칸, `gap.snatch`, 설계 laundromat.md 4절 3-1·3-2, 9-2 O3) ═════════════
// 까치는 셔터 바깥 길바닥에 서서 고개를 숙이고, 찌그러진 틈(laundromat.shutter.mjs DENT, 꼭짓점 x 111~112에서 14px)으로
// 머리를 들이민다. 가게 안에서는 틈 삼각형 안만 보인다 → 판 아래 끝보다 위 픽셀은 잘라 낸다(목은 판 뒤로 이어진 것처럼 읽힌다).
// 까치 몸(창 안 날기)은 벽 뒤라 안 그린다(설계 E3, Luna ②안). "누가 가져갔나"는 이 머리 하나가 말한다(S4, 빼면 안 되는 칸).
// 머리는 magpie_nest 까치와 같은 흑백 + 청록 광택(정수리 tealM/teal), 흰 눈 1px. 부리는 ink + lav 빛줄(같은 약속).
//   머리 오른쪽 뒤로 어깨 흰 깃(white)이 조금 보인다. 검은 머리 하나로는 "까만 덩어리"라서 흑백이 붙어야 까치로 읽힌다.
//   reach: 꼭짓점에서 머리가 쑥 내려와 부리를 벌리고 열쇠 고리(107,239)를 겨눈다. 눈은 동그랗게(흰 눈).
//   bite : 부리를 다물어 고리를 물고 열쇠를 1px 들어 올린다. 눈꺼풀 반 감김(dusk, magpie_nest `smug`와 같은 뻔뻔한 눈).
// 빠지는 칸은 bite를 오른쪽 위로 옮겨 찍는다(0칸, 판에 거의 다 가려지고 패 끝만 보인다). 그다음 빈 틈.
// 바깥 외곽선은 안 붙인다: 머리가 ink라 외곽선이 틈 가장자리에 검은 테로 남는다. 틈 너머 길바닥(purD Y69·dusk Y87)과 ink(Y25) 차 44 이상.
/** 머리 격자 왼쪽 위(화면 좌표). 13×10 */
export const GAP_HEAD_AT = { x: 105, y: 230 };
const GAP_HEAD_ROWS = {
  reach: [
    '.............',
    '......kk.....',
    '.....kmTk....',
    '....kmTkkk...',
    '....kTkekkkw.',
    '....kkkkkkww.',
    '...bkkkkkkw..',
    '..bk.kkkk....',
    '.bk..k.......',
    '.k..k........',
  ],
  bite: [
    '.............',
    '......kk.....',
    '.....kmTk....',
    '....kmTgkk...',
    '....kTkekkkw.',
    '....kkkkkkww.',
    '...bkkkkkkw..',
    '..bkkkk......',
    '...k.........',
    '.............',
  ],
};
const GAP_HEAD_LEGEND = { k: C.ink, T: C.teal, m: C.tealM, e: C.white, g: C.dusk, b: C.lav, w: C.white };
/** bite 때 열쇠가 들리는 양: 고리(107,239)가 부리 끝(108,238) 바로 왼쪽에 온다 */
export const KEY_BITE_LIFT = 1;
/** 빠지는 칸: bite를 옮겨 찍는 양(0칸) */
export const GAP_HEAD_WITHDRAW = { dx: 3, dy: -7 };

/**
 * 틈 속 머리(와 bite면 물린 열쇠)를 그린다. 셔터 잠김 그림의 판 아래 끝(244 − gapLift)보다 위, 가게 바닥(244 이상)은 잘라 낸다.
 * @param {'reach'|'bite'} pose
 * @param {{ dx?: number, dy?: number, key?: boolean }} [opt] key: false면 bite에서 물린 열쇠를 빼고 머리만(검사용)
 */
export function gapHead(img, pose, { dx = 0, dy = 0, key = true } = {}) {
  const t = new Image(img.w, img.h);
  if (pose === 'bite' && key) keyTag(t, KEY_ON_STREET.x + dx, KEY_ON_STREET.y - KEY_BITE_LIFT + dy);
  stamp(t, GAP_HEAD_AT.x + dx, GAP_HEAD_AT.y + dy, GAP_HEAD_ROWS[pose], GAP_HEAD_LEGEND);
  const bottom = SHUTTER.y + SHUTTER.h;
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = t.get(x, y);
      if (c !== EMPTY && y >= bottom - gapLift(x) && y < bottom) img.set(x, y, c);
    }
}

/**
 * `gap.snatch` 칸(형식 4-2 (a): 첫 칸 = 출발 자리(길바닥 열쇠), 마지막 칸 = 도착 자리(빈 틈)).
 * 칸 그리기만 여기 두고, 시트에 붙일 때(빌드 연결 PR) 빈 틈 칸을 `gap` 물건의 빈 모습으로 바꾼다.
 */
export const GAP_SNATCH = {
  ms: [120, 220, 260, 120, 100],
  frames: [
    (img) => keyTag(img, KEY_ON_STREET.x, KEY_ON_STREET.y),
    (img) => { keyTag(img, KEY_ON_STREET.x, KEY_ON_STREET.y); gapHead(img, 'reach'); },
    (img) => gapHead(img, 'bite'),
    (img) => gapHead(img, 'bite', GAP_HEAD_WITHDRAW),
    () => {},
  ],
};
