// 스테이지 3 `laundromat` 물건 그림 (#764, 설계 docs/design/screens/laundromat.md 9-2). 시트(art/scenes/laundromat.mjs)가 부른다.
// 만질 수 있는 것이라 바깥 1px ink 외곽선(ADR-0007 결정 3-1). 광원은 배경과 같은 왼쪽 위. 금색(yel 계열)은 열쇠 전용(magpie_nest와 같은 약속).
//
// 지금 있는 것:
//   O1 열쇠 + 나무 패(1칸): 길바닥·둥지·혹 속에서 같은 물건. 패가 넓어서 덕트 아래 끝에 걸린다(S5). 길바닥에서는 금색 열쇠가 패보다 넓게(블라인드 11/25).
//   O2 후드 위 빈 둥지(1칸) + 열쇠 든 둥지·반짝(2칸, `NEST_KEY`: 대기 반복, `magpie.key_in`·`key_out`).
//   O3 틈 속 까치 머리·부리(2칸, `gap.snatch`) + 앉은 까치·내려다보기(1칸, `MAGPIE_SIT`: 대기 반복은 magpie_nest 포즈 재사용, `magpie.peek`)
//      + 부리에 문 열쇠(1칸 합성, `magpie.beak_suck` 첫 칸, 3-2 정답 길).
//   O6 덕트 혹(3칸, `DUCT_LUMP`: 가로 1 + 세로 걸림·끙끙 2. lump_travel·stuck·lump_back·lump_pop).
// 미리보기·검사: node docs/design/screens/laundromat-bg-sketch.mjs (들창·틈·열쇠), node docs/design/screens/laundromat-gap-snatch-preview.mjs (틈 속 머리),
//   node docs/design/screens/laundromat-nest-key-preview.mjs (둥지 속 열쇠), node docs/design/screens/laundromat-duct-lump-preview.mjs (덕트 혹),
//   node docs/design/screens/laundromat-magpie-peek-preview.mjs (앉은 까치·내려다보기, 포즈 전부 가림),
//   node docs/design/screens/laundromat-beak-suck-preview.mjs (부리에 문 열쇠, 3-2)

import { C, Image, EMPTY } from '../lib/pixel.mjs';
import { stamp, outlined } from '../lib/texture.mjs';
import { SHUTTER, gapLift } from './laundromat.shutter.mjs';
import { MAGPIE, MAGPIE_LEGEND } from './magpie_nest.objects.mjs';

/** 열쇠 + 나무 패 크기(외곽선 포함). (x, y) = 왼쪽 위 */
export const KEY_TAG = { w: 30, h: 8 };
/**
 * 길바닥 열쇠 자리(셔터 찌그러진 틈 밑, laundromat.shutter.mjs DENT). 아래 끝 y 243 = 가장 가까운 판석 줄.
 * 고리(구멍 2×2)가 틈 꼭짓점 바로 왼쪽 아래에 와서, 까치 부리 끝(reach 106,239)이 고리 구멍을 겨눈다.
 */
export const KEY_ON_STREET = { x: 90, y: 236 };
/** 나무 패 몸(외곽선 안) — KEY_ON_STREET 기준 상대 자리. 색 검사용 */
export const KEY_PLATE = { x: 2, y: 3, w: 7, h: 4 };
/** 고리 구멍 왼쪽 위 — KEY_ON_STREET 기준 상대 자리(2×2). 부리 검사용 */
export const KEY_RING_HOLE = { x: 16, y: 3 };

// 블라인드(#764 9-3, 11/25)에서 "갈색 상자 + 노란 병아리"로 읽혀 다시 그렸다. 전에는 누운 열쇠가 6×4 노란 덩어리로 뭉치고
// 고리 구멍 ink 1px이 눈처럼 찍혔고, 패(10×8)가 열쇠보다 커서 눈이 패로 먼저 갔다.
// 지금: 왼쪽부터 나무 패(9×6, 둥지 속 패 O2와 같은 크기) → 끈(redD 3px, 길바닥 빛 띠 lint·lav 위라 lint 끈은 안 보였다) → 둥근 금색 고리(8×8, 가운데 구멍 2×2는 비워 길바닥이 비친다)
//   → 긴 몸(8px) → 위로 솟은 이 두 개(높이 2·1). 금색이 갈색보다 넓다(금 52 : 나무 28, 검사 있음).
// 패: tan 윗면·woodL 몸·wood 그늘, 새긴 홈 한 줄(글자 없음). 광원 왼쪽 위(고리 왼쪽 위 white 1px).
// 틈 삼각형 안에 들어가게 높은 것(고리·이)은 꼭짓점(x 111~112) 가까이, 낮은 것(패 6px)은 틈이 얕은 왼쪽에 둔다.
const KEY_ROWS = [
  '.' + '.........' + '...' + '..kkkk..' + '.kkkk....',
  '.' + '.........' + '...' + '.kWYYyk.' + '.kYykkkk.',
  '.' + '.kkkkkkk.' + '...' + 'kYYyyyyk' + 'kkYykYyk.',
  '.' + 'kTTTTTLwk' + '.rr' + 'kYy..yyy' + 'YYYYyyyyk',
  '.' + 'kTLLLLLwk' + 'r..' + 'kyy..yyy' + 'yyyyyyyyk',
  '.' + 'kTLwwwLwk' + '...' + 'kyyyyyok' + 'kkkkkkkk.',
  '.' + 'kLLLLLwwk' + '...' + '.kyyyok.' + '.........',
  '.' + '.kkkkkkk.' + '...' + '..kkkk..' + '.........',
];
const KEY_LEGEND = { k: C.ink, T: C.tan, L: C.woodL, w: C.wood, r: C.redD, W: C.white, Y: C.yelL, y: C.yel, o: C.yelD };

/** O1 열쇠 + 나무 패를 (x, y)에 그린다(외곽선은 격자에 들어 있다). */
export function keyTag(img, x, y) {
  const t = new Image(KEY_TAG.w, KEY_TAG.h);
  stamp(t, 0, 0, KEY_ROWS, KEY_LEGEND);
  img.blit(t, x, y);
}

// ═════════════ O2 후드 위 둥지 (빈 둥지 1칸 + 열쇠 든 둥지·반짝 2칸) ═════════════
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

// 열쇠 든 둥지(1칸) + 반짝(1칸). 3-1 `fly_in` 뒤·2-2 혹이 거꾸로 달려 나간 뒤의 둥지, 1-2에서 빨려 사라지기 전 둥지.
// 까치가 둥지 위에 앉아 있어도 가리지 않는 두 자리에 나눠 그렸다(앉은 까치 자리 60,27 20×18 · 배 오른쪽 끝 x 78 · 발 아래 끝 y 44가 전제. O3 앉음 PR에서 지킨다):
//   ① 금색 고리: 둥지 오른쪽 끝 잔가지에 꽂혀 x 80~84, y 37~45로 하늘(purD)에 솟는다. magpie_nest와 같은 금색 = 열쇠 약속.
//      고리 구멍은 외곽선이 메워 ink로 보인다. 왼쪽 위 1px white = 광원.
//   ② 나무 패: 둥지 앞면에 걸려 늘어진다(70,46 9×6). O1 길바닥 패와 같은 tan 윗면·woodL 몸·새긴 홈 → "길바닥에 있던 그 패".
//      패가 둥지 앞(까치 발 아래)이라 앉은 까치와 안 겹치고, 혹 속에 걸리는 S5 패와도 같은 물건으로 읽힌다.
//   끈(lint) 4px이 패 오른쪽 위에서 고리 자루로 이어진다.
// 반짝 칸은 고리 위에 큰 별(magpie_nest `sparkle` 2번과 같은 모양: yel 팔 + white 가운데)과 자루 빛 1px. 효과라 외곽선 없음.
const NEST_KEY_BOW = { x: 80, y: 37 };
const NEST_KEY_BOW_ROWS = [
  '.YYy.',
  'YW.yy',
  'Y...y',
  'yy.yy',
  '.yYy.',
  '..Yy.',
  '..Yy.',
  '..Yy.',
  '..Yy.',
];
const NEST_TAG = { x: 70, y: 46 };
const NEST_TAG_ROWS = [
  'kkkkkkkkk',
  'kTTTTTTwk',
  'kLkLLLLwk',
  'kLLwwwLwk',
  'kLLLLLLwk',
  'kkkkkkkkk',
];
const NEST_STRING = [[79, 45], [79, 44], [80, 43], [81, 42]];
/** 반짝 별 가운데(고리 오른쪽 위 하늘). 팔 x 79~85, y 30~36 */
export const NEST_SPARK = { x: 82, y: 33 };

/** O2 열쇠 든 둥지. shine: true면 반짝 칸(별 + 자루 빛). */
export function nestWithKey(img, { shine = false } = {}) {
  const t = new Image(img.w, img.h);
  stamp(t, NEST.x, NEST.y, NEST_ROWS, NEST_LEGEND);
  stamp(t, NEST_KEY_BOW.x, NEST_KEY_BOW.y, NEST_KEY_BOW_ROWS, { Y: C.yelL, y: C.yel, W: C.white });
  stamp(t, NEST_TAG.x, NEST_TAG.y, NEST_TAG_ROWS, { k: C.ink, T: C.tan, L: C.woodL, w: C.wood });
  for (const [x, y] of NEST_STRING) t.set(x, y, C.lint);
  img.blit(outlined(t), 0, 0);
  if (!shine) return;
  sparkStar(img, NEST_SPARK.x, NEST_SPARK.y);
  img.set(82, 41, C.white); // 자루 빛
}

/**
 * 반짝 별(magpie_nest `sparkle` 2번과 같은 모양: yel 팔 + white 가운데). 효과라 외곽선 없음. (cx, cy) = 가운데.
 * size 'big' 7×7(팔 3), 'small' 3×3(white 가운데 + yelL 팔 1). 둥지 열쇠 반짝(O2)과 길바닥 열쇠 반짝(`gap.glint`)이 같이 쓴다.
 */
export function sparkStar(img, cx, cy, size = 'big') {
  if (size === 'small') {
    stamp(img, cx - 1, cy - 1, ['.l.', 'lWl', '.l.'], { l: C.yelL, W: C.white });
    return;
  }
  stamp(img, cx - 3, cy - 3, ['...l...', '...y...', '..yWy..', 'lyWWWyl', '..yWy..', '...y...', '...l...'], { y: C.yel, l: C.yelL, W: C.white });
}

/**
 * O2 둥지 열쇠 anim(그림 물건 `nest`, 대상 `magpie`. 설계 4절 "그림 물건과 바뀌는 시점").
 *   loop  : 열쇠 든 둥지의 대기 반짝(첫 칸 = 멈춘 모습, 형식 개정 3).
 *   key_in: 3-1 `fly_in` 뒤·2-2 혹이 돌아간 뒤. 빈 둥지 → 반짝 → 열쇠 든 둥지(4-2 (a) 첫 칸 출발, 마지막 칸 도착).
 *   key_out: 1-2 역회전. 열쇠 든 둥지 → 반짝 → 빈 둥지("반짝이 쏙 사라짐"). 새 칸 0(같은 세 그림 재사용).
 */
export const NEST_KEY = {
  loop: { ms: [1600, 160], frames: [(img) => nestWithKey(img), (img) => nestWithKey(img, { shine: true })] },
  key_in: { ms: [100, 160, 120], frames: [nestEmpty, (img) => nestWithKey(img, { shine: true }), (img) => nestWithKey(img)] },
  key_out: { ms: [100, 140, 120], frames: [(img) => nestWithKey(img), (img) => nestWithKey(img, { shine: true }), nestEmpty] },
};

// ═════════════ O3 틈 속 까치 머리·부리 (2칸, `gap.snatch`, 설계 laundromat.md 4절 3-1·3-2, 9-2 O3) ═════════════
// 까치는 셔터 바깥 길바닥에 서서 고개를 숙이고, 찌그러진 틈(laundromat.shutter.mjs DENT, 꼭짓점 x 111~112에서 14px)으로
// 머리를 들이민다. 가게 안에서는 틈 삼각형 안만 보인다 → 판 아래 끝보다 위 픽셀은 잘라 낸다(목은 판 뒤로 이어진 것처럼 읽힌다).
// 까치 몸(창 안 날기)은 벽 뒤라 안 그린다(설계 E3, Luna ②안). "누가 가져갔나"는 이 머리 하나가 말한다(S4, 빼면 안 되는 칸).
// 머리는 magpie_nest 까치와 같은 흑백 + 청록 광택(정수리 tealM/teal), 흰 눈 1px. 부리는 ink + lav 빛줄(같은 약속).
//   머리 오른쪽 뒤로 어깨 흰 깃(white)이 조금 보인다. 검은 머리 하나로는 "까만 덩어리"라서 흑백이 붙어야 까치로 읽힌다.
//   reach: 꼭짓점에서 머리가 쑥 내려와 부리를 벌리고 열쇠 고리 구멍(106,239)을 겨눈다. 눈은 동그랗게(흰 눈).
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
/** bite 때 열쇠가 들리는 양: 고리 구멍(106,238)이 부리 끝(108,238) 바로 왼쪽에 와서 부리가 고리 오른쪽 테를 문다 */
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

// ═════════════ O6 덕트 혹 (3칸: 가로 1 + 세로 걸림 끙끙 2, 설계 laundromat.md 4절 1-2·3-2·2-2·6, 9-2 O6, E2) ═════════════
// 열쇠 + 나무 패(O1)가 은색 주름관(laundromat.room.mjs DUCT) 속을 지나며 관을 밀어 부풀린 혹. 관은 찢어지지 않아 패는 안 보이고,
// **모양으로만** 말한다: 둥근 공이 아니라 어깨가 각진 상자 모양 = "속에 넓적한 게 들었다"(S5 "패가 넓다").
// 가운데 부푼 곳은 주름이 늘어나 간격이 넓어진다(관 주름 8px → 혹 위 5~6px 두세 줄이 휘어 벌어짐).
// 만질 수 있는 것이라 ink 외곽선(ADR-0007 결정 3-1). 단 관과 이어지는 양 끝(관 안쪽 픽셀)은 외곽선을 지운다: 관 자체엔 외곽선이 없어서
// 거기 세로 ink 줄이 남으면 "관 위에 붙인 스티커"로 보인다. 그래서 혹은 관에서 튀어나온 부분만 테두리가 있다.
// 색은 관과 같은 은색 단(cotton 빛 / lint 몸 / lav·dusk 그늘). 뒤 벽 cotton(Y222)과는 ink 외곽선이 가른다.
// 움직임은 그리지 않는다(E2): 칸 하나를 자리 여러 곳에 찍고(`at`만 다름) 보간 없이 80ms씩 건너뛴다. 빌드가 시트 칸으로 복사한다.
//   가로 칸 `lumpH(cx)`: 가로 구간(y 52~63) 위를 왼쪽 판자 → 오른쪽 꺾임으로. 위아래로 3px씩 부푼 24×18.
//   세로 칸 `lumpV(cy, { strain })`: 세로 구간(x 360~373). 좌우로 4px씩 부푼 22×22. 걸린 자리는 cy 150(= `duct` reachPoint 367,150,
//     건조기 위 끝 164 바로 위). 세로 구간을 내려오는 자리도 같은 칸(0칸).
//   strain(끙끙): 혹이 좌우 1px 더 부풀고, 바로 위 관(y 122~137)이 압력으로 1px씩 불룩, 양옆에 힘쓰는 금 둘씩.
// 건조기(위 끝 164)보다 아래 픽셀은 잘라 낸다: 혹이 건조기 뒤 입구로 쑥 빠지는 `lump_pop`이 건조기 그림 앞에 그려지면 안 된다.
const DUCT_GEO = { x: 360, w: 14, runY: 52, runH: 12, endX: 92, bottom: 164 }; // laundromat.room.mjs DUCT와 같은 값(검사가 대조한다)
/** 걸린 자리(세로 칸 가운데). `duct` reachPoint와 같다 */
export const LUMP_STUCK = { x: 367, y: 150 };
/** lump_travel 자리: 가로 넷(cx) → 세로 하나(cy, 꺾인 뒤 내려오는 중) → 걸림(cy 150) */
export const LUMP_PATH = { h: [110, 188, 268, 330], v: [96], stuck: LUMP_STUCK.y }; // 가로 자리는 걸이 줄(x 150·236·316)을 피한다

const lumpExt = (c, half) => (Math.abs(c) <= half - 5 ? 3 : Math.abs(c) <= half - 3 ? 2 : Math.abs(c) <= half - 1.5 ? 1 : 0);

/** 관 속 픽셀이면 참(외곽선을 지울 자리) */
function insideDuct(x, y) {
  const { x: vx, w, runY, runH, endX, bottom } = DUCT_GEO;
  return (y >= runY && y < runY + runH && x >= endX && x < vx + w) || (x >= vx && x < vx + w && y >= runY && y < bottom);
}

/** 외곽선을 붙이고, 관 속 외곽선은 지우고, 건조기 위 끝 아래는 잘라 img에 겹친다 */
function placeLump(img, t) {
  const o = outlined(t);
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++) {
      const c = o.get(x, y);
      if (c === EMPTY || y >= DUCT_GEO.bottom) continue;
      if (c === C.ink && t.get(x, y) === EMPTY && insideDuct(x, y)) continue;
      img.set(x, y, c);
    }
}

/** 가로 칸(새 칸 1). cx = 혹 가운데 x. 가로 구간 y 52~63에서 위아래로 3px 부푼다. */
export function lumpH(img, cx) {
  const { runY, runH } = DUCT_GEO;
  const t = new Image(img.w, img.h);
  const half = 12;
  for (let dx = -half; dx < half; dx++) {
    const c = dx + 0.5, e = lumpExt(c, half);
    const y0 = runY - e, y1 = runY + runH - 1 + e; // 몸 위·아래 끝
    for (let y = y0; y <= y1; y++) {
      let col = C.lint;
      if (y === y0) col = C.cotton; // 윗면 빛
      else if (y === y0 + 1 && c < 0 && e >= 2) col = C.cotton; // 왼쪽 위 어깨 빛(광원)
      else if (y === y1) col = e >= 2 ? C.dusk : C.lav; // 아래 그늘
      else if (y >= y1 - 2) col = C.lav;
      else if ([-9, -4, 2, 8].includes(dx) && y > y0 + 1) col = C.lav; // 늘어난 주름(가운데일수록 벌어짐)
      t.set(cx + dx, y, col);
    }
  }
  t.set(cx - 7, runY - 2, C.white); // 왼쪽 어깨 반짝 1px = 패 모서리가 관을 민 자리
  placeLump(img, t);
}

/**
 * 세로 칸(새 칸 2: strain 거짓/참). cy = 혹 가운데 y. 세로 구간 x 360~373에서 좌우로 4px(strain 5px) 부푼다.
 * glint 참 = 왼쪽 위 어깨(반짝 1px 옆 몸 위)에 둥지와 같은 반짝 별(`sparkStar`)을 얹는다(0칸 합성, #935 묶음 2 Luna 안 (다)).
 */
export function lumpV(img, cy, { strain = false, glint = false } = {}) {
  const { x, w } = DUCT_GEO;
  const t = new Image(img.w, img.h);
  const half = 11;
  for (let dy = -half; dy < half; dy++) {
    const c = dy + 0.5;
    let e = lumpExt(c, half);
    if (e === 3) e = strain ? 5 : 4;
    else if (strain && e > 0) e += 1;
    const x0 = x - e, x1 = x + w - 1 + e;
    for (let px = x0; px <= x1; px++) {
      let col = C.lint;
      if (px === x0) col = C.lav; // 왼쪽 끝 한 줄 그늘(관 dx 0과 같은 약속)
      if (px === x0 + 1) col = C.cotton; // 왼쪽 빛
      else if (px === x0 + 2 && c < 0 && e >= 3) col = C.cotton;
      else if (px === x1) col = e >= 2 ? C.dusk : C.lav;
      else if (px >= x1 - 2) col = C.lav;
      else if ([-8, -3, 3, 8].includes(dy) && px > x0 + 1) col = C.lav; // 늘어난 주름
      t.set(px, cy + dy, col);
    }
  }
  t.set(x - 2, cy - 6, C.white); // 왼쪽 위 어깨 반짝(패 모서리)
  if (strain) {
    // 위 관이 압력으로 불룩(y 122~137, 좌우 1px. duct 핫스팟 위 끝 120 안)
    for (let py = 122; py < cy - half; py++) {
      if (py === 132 || py === 133) continue; // 고정 밴드는 안 부푼다(밴드가 허리띠처럼 조인다)
      t.set(x - 1, py, C.lav);
      t.set(x + w, py, C.lav);
    }
    // 힘쓰는 금(양옆 둘씩, 2px 사선, 혹 어깨 위아래). 외곽선 없이 ink 그대로. 핫스팟(x 352~381) 안
    for (const [ax, ay, sx, sy] of [[-7, -8, -1, -1], [-7, 8, -1, 1]]) {
      for (const side of [-1, 1]) {
        const bx = side < 0 ? x + ax : x + w - 1 - ax, k = side;
        img.set(bx, cy + ay, C.ink);
        img.set(bx + sx * k, cy + ay + sy, C.ink);
      }
    }
  }
  placeLump(img, t);
  // 별 가운데는 어깨 반짝 1px(x - 2)보다 4px 안쪽 몸 위: 벽(cotton) 위에 얹으면 노랑이 묻힌다(명도 차가 작다). 효과라 외곽선 없음(둥지 O2와 같은 약속)
  if (glint) sparkStar(img, x + 2, cy - 6);
}

// ── 말랑한 양말 혹(새 칸 2: 가로 1 + 세로 1, #935 S3, PM 결정 (나)) ──
// 쿵(★① 첫 판) 뒤 둥지 쪽 양말이 덕트를 타고 건조기로 빨려 오는 혹. 열쇠 혹(패가 든 각진 혹)과 **모양으로 대비**한다:
//   어깨가 둥글고(부풂 2 → 1 → 0으로 천천히 줄어듦) 위아래(세로 칸은 좌우)로 2px만 부푼다. 반짝 1px(패 모서리)이 없다.
//   "말랑한 건 지나가고 각진 건 걸린다"가 S5(패가 넓다)를 오히려 세게 한다.
// 늘어난 주름은 두 줄만(가운데가 덜 밀려서). 외곽선·관 속 외곽선 지우기·건조기 위 끝 자르기는 열쇠 혹과 같다(placeLump).
const softExt = (c) => (Math.abs(c) <= 5 ? 2 : Math.abs(c) <= 9 ? 1 : 0);
const SOFT_HALF = 11;

/** 말랑한 가로 칸(새 칸 1). cx = 혹 가운데 x. 22×16(외곽선 포함 22×18) + 창 쪽 꼬리(관 속, `tail: false`는 미리보기 비교용) */
export function lumpSoftH(img, cx, { tail = true } = {}) {
  const { runY, runH } = DUCT_GEO;
  const t = new Image(img.w, img.h);
  for (let dx = -SOFT_HALF; dx < SOFT_HALF; dx++) {
    const c = dx + 0.5, e = softExt(c);
    const y0 = runY - e, y1 = runY + runH - 1 + e;
    for (let y = y0; y <= y1; y++) {
      let col = C.lint;
      if (y === y0) col = C.cotton;
      else if (y === y1) col = e >= 2 ? C.dusk : C.lav;
      else if (y >= y1 - 1) col = C.lav;
      else if ([-5, 4].includes(dx) && y > y0 + 1 && y < y1 - 2) col = C.lav;
      t.set(cx + dx, y, col);
    }
  }
  placeLump(img, t);
  if (tail) softTail(img, (k, d) => [cx - SOFT_HALF - 1 - d, DUCT_GEO.runY + SOFT_TAIL[k].at], (x) => x >= DUCT_GEO.endX + 5);
}

// 혹 꼬리(#935 묶음 2 판정 ② Luna 안 (가)): 말랑한 혹 **뒤쪽(창 쪽)** 관 속에 관 그늘색(lav) 짧은 줄 셋.
// Mia 2-1 정지 화면 두 장이 다 가로 마지막 자리(cx 330)를 찍어 "건조기가 덕트로 밀어 올렸다"로 읽혔다(방향 거꾸로).
// 꼬리가 있으면 한 장만 봐도 "창 쪽에서 왔다". 꼬리 없는 각진 열쇠 혹과 대비도 커진다(S5).
// 관 속에만 그린다(외곽선 없음, 관 윤곽 안 바꿈). 가운데 줄이 가장 길고 혹에 붙는다. 판자 구멍 쪽(x < endX + 5)은 자른다:
// 첫 칸(cx 110)은 창에서 막 나와서 꼬리 자리가 없다(자리 자체가 방향을 말한다).
// at = 관 위 끝(가로)/왼쪽 끝(세로)에서 잰 줄 자리, gap = 혹 끝과 띄운 칸, len = 길이
const SOFT_TAIL = [
  { at: 3, gap: 3, len: 10 },
  { at: 6, gap: 0, len: 20 },
  { at: 8, gap: 6, len: 8 },
];
function softTail(img, at, keep) {
  SOFT_TAIL.forEach(({ gap, len }, k) => {
    for (let d = gap; d < gap + len; d++) {
      const [x, y] = at(k, d);
      if (keep(x, y)) img.set(x, y, C.lav);
    }
  });
}

/** 말랑한 세로 칸(새 칸 1). cy = 혹 가운데 y. 18×22(외곽선 포함 20×22) + 위쪽 꼬리(관 속) */
export function lumpSoftV(img, cy, { tail = true } = {}) {
  const { x, w } = DUCT_GEO;
  const t = new Image(img.w, img.h);
  for (let dy = -SOFT_HALF; dy < SOFT_HALF; dy++) {
    const c = dy + 0.5, e = softExt(c);
    const x0 = x - e, x1 = x + w - 1 + e;
    for (let px = x0; px <= x1; px++) {
      let col = C.lint;
      if (px === x0) col = C.lav;
      if (px === x0 + 1) col = C.cotton;
      else if (px === x1) col = e >= 2 ? C.dusk : C.lav;
      else if (px >= x1 - 1) col = C.lav;
      else if ([-5, 4].includes(dy) && px > x0 + 1 && px < x1 - 2) col = C.lav;
      t.set(px, cy + dy, col);
    }
  }
  placeLump(img, t);
  // 세로 칸 꼬리는 위쪽(꺾인 모서리 쪽). 가로 구간과 잇는 모서리(y < runY + runH)와 건조기 위 끝 아래는 자른다.
  // 혹이 걸린 자리(★③ 열쇠 혹 자리)를 지난 칸은 그 자리(cy 150 ± 8)에 꼬리를 안 남긴다: 거기 양말 흔적이 보이면 ★③과 섞인다.
  const pastStuck = cy > LUMP_STUCK.y;
  if (tail) softTail(
    img,
    (k, d) => [DUCT_GEO.x + SOFT_TAIL[k].at + 1, cy - SOFT_HALF - 1 - d],
    (_, y) => y >= DUCT_GEO.runY + DUCT_GEO.runH && y < DUCT_GEO.bottom && (!pastStuck || y >= LUMP_STUCK.y + 8),
  );
}

/**
 * O6 덕트 혹 anim(그림 물건 `duct`). 형식 4-2 (a): 그 물건 anim 시작 때 `key.stuck` 그림으로 바뀐다.
 *   lump_travel: 1-2·3-2. 창 쪽 판자 앞에서 한 박자 머문 뒤(200ms, PR #900 재리뷰 1) 가로 넷 → 세로 하나 → 걸림 덜컥(100ms, 재리뷰 2: 80~120).
 *                마지막 칸 = 걸린 멈춘 모습(`stuck` 첫 칸).
 *   stuck      : `key.stuck` 참일 때 대기 반복(첫 칸 = 멈춘 모습, 형식 개정 3). 쉬었다가 두 번 끙끙.
 *   lump_back  : 2-2. lump_travel 칸 거꾸로(0칸). 끝나면 `key.stuck` 거짓 = 혹 없음.
 *   lump_pop   : 6(클리어 1번). 쿡에 한 번 더 끙 → 건조기 뒤 입구로 쑥(건조기 위 끝 아래는 잘림). 끝나면 혹 없음.
 * 빈 칸(0px)은 두지 않는다: 빌드 `picture()`가 "아무것도 그리지 않았다"로 실패한다(Theo, PR #917 리뷰).
 */
const travelFrames = [
  ...LUMP_PATH.h.map((cx) => (img) => lumpH(img, cx)),
  ...LUMP_PATH.v.map((cy) => (img) => lumpV(img, cy)),
  (img) => lumpV(img, LUMP_PATH.stuck),
];
const travelMs = [200, 80, 80, 80, 80, 100];
export const DUCT_LUMP = {
  lump_travel: { ms: travelMs, frames: travelFrames },
  // stuck 끝 칸(#935 묶음 2 Luna 안 (다)): 두 번 끙끙한 뒤 어깨가 한 번 반짝(160ms, 둥지 대기 반짝 NEST_KEY.loop과 같은 길이·같은 별).
  //   Mia 2-2가 걸린 혹을 "소리에 놀란 파이프"(관 부품)로 읽었다. "둥지에서 반짝이 빠짐 → 덕트에서 반짝"을 같은 낱말로 잇는다.
  //   양말 혹(sock_through)에는 반짝이 없어서 열쇠 혹과 대비가 커진다(S5). 대기 반복만 바뀌고 show 길이·H5·H6 변화 0.
  stuck: {
    ms: [1400, 120, 120, 120, 160],
    frames: [
      (img) => lumpV(img, LUMP_STUCK.y),
      (img) => lumpV(img, LUMP_STUCK.y, { strain: true }),
      (img) => lumpV(img, LUMP_STUCK.y),
      (img) => lumpV(img, LUMP_STUCK.y, { strain: true }),
      (img) => lumpV(img, LUMP_STUCK.y, { glint: true }),
    ],
  },
  lump_back: { ms: [100, 80, 80, 80, 80, 160], frames: [...travelFrames].reverse() },
  lump_pop: {
    ms: [160, 100, 100, 100],
    frames: [(img) => lumpV(img, LUMP_STUCK.y, { strain: true }), (img) => lumpV(img, 158), (img) => lumpV(img, 166), (img) => lumpV(img, 173)],
  },
  // sock_through: ★① 첫 판(#935 S3). 말랑한 양말 혹이 lump_travel과 같은 길(창 쪽 → 가로 넷 → 세로 96)을 지나
  //   걸림 자리에서 멈추지 않고 lump_pop 꼬리 자리(158·173)로 건조기 뒤에 쑥 들어간다. 끝나면 혹 없음(`key.stuck` 그대로 거짓).
  //   마지막 칸이 건조기 위 끝 바로 위라서 걸린 혹 자리(★③)에 혹이 남았다 사라지는 일이 없다. 새 칸 2.
  //   합 580ms: 같은 show의 burst 570 + sock_head 330과 더해 1480 ≤ H5 1500(tests/art/laundromat-timing.test.ts).
  //   첫 칸은 열쇠 혹(200ms)보다 짧은 100ms다. 양말은 가볍게 휙 지나가고, 패가 든 열쇠 혹만 창 쪽에서 버틴다.
  sock_through: {
    ms: [100, 80, 80, 80, 80, 80, 80],
    frames: [
      ...LUMP_PATH.h.map((cx) => (img) => lumpSoftH(img, cx)),
      ...LUMP_PATH.v.map((cy) => (img) => lumpSoftV(img, cy)),
      ...[158, 173].map((cy) => (img) => lumpSoftV(img, cy)),
    ],
  },
};

// ═════════════ O3 앉은 까치 + 내려다보기 (1칸, `magpie.peek`, 설계 laundromat.md 4절 5-1·8, 9-2 O3) ═════════════
// 앉음·대기 반복은 magpie_nest 까치 포즈(`smug`·`flick`·`puff`) 재사용(0칸). 자리는 후드 위 둥지 윗줄에 발이 닿는 60,27(20×18):
//   발 아래 끝 y 44 = 둥지 윗줄, 배 오른쪽 끝 x 78. 그보다 오른쪽은 열쇠 고리 자리(결정 2026-11-24-laundromat-nest-key-bow-tag-magpie-sit).
// 내려다보기(새 칸 1): 5-1 `gap_poke` 뒤 "창 너머 까치가 고개를 쑥 내밀어 아래를 봄", 8 두 번째 `snub#2`, R2 대기 힐끔에 다시 쓴다.
//   smug는 부리를 오른쪽 위로 치켜든 세로 실루엣이다. 내려다보기는 그 반대로 몸을 앞으로 기울여 꼬리가 왼쪽 위로 들리고,
//   머리는 둥지 앞 끝 위로 내려와 부리가 아래(길바닥 = 틈 쪽)를 겨눈다. 1배 20px에서 "고개 1px"(#530 교훈)로는 안 읽혀서
//   실루엣 전체를 눕혔다: 부리 끝이 smug보다 15px 아래(y 27 → 42), 꼬리 끝이 15px 위(y 44 → 28).
//   눈은 반쯤 감은 눈꺼풀(dusk) 없이 흰 눈 2px로 동그랗게 뜬다(뻔뻔한 smug → "어, 뭐지?" 궁금한 눈). 틈 속 머리 `reach` 눈과 같은 약속.
//   발(dusk)은 smug와 같은 자리(x 72·75)라 앉은 채 몸만 기울인 것으로 읽힌다. 부리(x 77~78)는 앞발과 1px 띄워 안 붙는다.
// 고리(x 79~85 외곽선 포함)를 안 가리게 오른쪽 끝 x 78 안. 좌우 뒤집어도(snub) 꼬리 끝이 y 28~29라 끈(y 42~45)에 안 닿는다(비움 마스크에 안 걸림).
export const MAGPIE_SIT_AT = { x: 60, y: 27 };
export const MAGPIE_PEEK = [
  '....................',
  'Tk..................',
  'tTk.................',
  '.tTk................',
  '..ktTkk.............',
  '...ktTTkkk..........',
  '....ktmTTkkkk.......',
  '....ktTmmTkkkkk.....',
  '.....ktTmTtkkkkkk...',
  '......kttkkwwwwkkk..',
  '.......kwwwwwwwkkkk.',
  '.......kcwwwwwkkkek.',
  '........kcwwwwkkkek.',
  '.........kcllwkkkkb.',
  '..........kkd..d.kb.',
  '............d..d..k.',
  '............d..d....',
  '...........dd.dd....',
];
/** 이 화면 앉은 까치 포즈 전부(대기 반복 셋 재사용 + 내려다보기). 가림 검사가 이 목록 전부와 좌우 뒤집은 것을 본다 */
export const MAGPIE_SIT_POSES = { ...MAGPIE, peek: MAGPIE_PEEK };

/**
 * 열쇠 자리 비움(x ≥ 79, y ≥ 36): 고리 외곽선(x 79)·끈(79,44~45) 자리. 재사용 포즈 중 `puff` 배 끝(x 79, y 36~39)과
 * 뒤집은 포즈의 꼬리 끝(x 79, y 42~44)만 여기 걸린다(포즈당 ≤ 4px, 대기 0.3초·snub 때만). 둥지가 비어도 늘 비워서 그림이 안 튄다.
 * 둥지를 까치 앞에 그리는 안은 버렸다: 둥지 윗줄(y 43~44)이 발과 내려다보기 부리 끝을 먹어서 "둥지 속을 쪼는" 그림이 된다.
 */
export const MAGPIE_KEY_ZONE = { x: 79, y: 36 };
/**
 * 앉은 까치 한 장. flip: 20px 상자 가운데 세로줄로 좌우 뒤집기(8 `snub`, 0칸). 열쇠 자리(MAGPIE_KEY_ZONE)는 안 그린다.
 * dx·dy: 자리만 옮겨 찍기(0칸). `ruffle` 부르르(±2), 클리어 `perch_drop` 털썩(둥지가 빨려 나가 후드 윗면까지 9px). 비움 자리는 화면 좌표 그대로다.
 */
export function magpieSit(img, pose, { flip = false, dx = 0, dy = 0 } = {}) {
  const t = new Image(20, 18);
  stamp(t, 0, 0, MAGPIE_SIT_POSES[pose], MAGPIE_LEGEND);
  const placed = new Image(img.w, img.h);
  placed.blit(t, MAGPIE_SIT_AT.x + dx, MAGPIE_SIT_AT.y + dy, flip ? { flipAx: 10 } : {});
  for (let y = MAGPIE_KEY_ZONE.y; y < img.h; y++) for (let x = MAGPIE_KEY_ZONE.x; x < img.w; x++) placed.set(x, y, EMPTY);
  img.blit(placed, 0, 0);
}

// 부리에 문 열쇠(새 칸 1, 합성. 3-2 `beak_suck` 첫 칸, PR #932 Theo 리뷰): 커밋된 정답 길은 쿵 → プピッ → 쿡이라 3-2 길이다.
// 이 길에서는 열쇠가 둥지로 안 가서(`key_in` 없음) 앉음 칸만 재사용하면 "까치가 열쇠를 가졌다"가 한 번도 안 보인다.
// 그래서 smug 앉음 위에 O2 고리(둥지 속 열쇠와 같은 금색 고리 5×5 + 자루)를 부리 끝에 매단다. 손그림은 이 두 줄 이(톱니)뿐이다.
//   고리 윗테가 부리 끝(78~79, 27~28) 바로 밑에 붙고, 부리 ink를 고리 위에 찍어 "물고 있다"로 읽힌다(그리는 순서 열쇠 → 까치).
//   자루는 길바닥 열쇠처럼 이 두 개(x 82, y 35·37)를 달아 둥지 속 고리보다 "열쇠"로 읽히게 했다. 패·끈은 까치 가슴 뒤로 숨는다(1배에서 안 보임).
//   전부 들창 왼쪽 칸(x 60~85) 하늘 안이고 둥지 윗줄(y 43)보다 위라 빈 둥지와 안 겹친다. 3-2 둥지는 늘 비어 있어 열쇠 자리 비움과도 안 부딪힌다.
const BEAK_KEY = { x: 78, y: 28 };
const BEAK_KEY_ROWS = [
  '.YYy.',
  'YW.yy',
  'Y...y',
  'yy.yy',
  '.yYy.',
  '..Yy.',
  '..Yy.',
  '..Yyo',
  '..Yy.',
  '..Yyo',
];
/**
 * 부리에 열쇠를 문 앉은 까치(smug + 고리). 열쇠를 먼저 외곽선째 그리고 까치를 위에 찍는다.
 * 열쇠 자루 아래 끝(x 79~83, y 36~38)은 MAGPIE_KEY_ZONE 안이다. 비움 마스크는 까치(magpieSit)에만 걸고 이 열쇠에는 안 건다:
 * 3-2 길에서는 둥지가 늘 비어 있어 둥지 고리와 부딪히지 않는다(PR #934 Theo nit).
 */
export function magpieSitKey(img) {
  const t = new Image(img.w, img.h);
  stamp(t, BEAK_KEY.x, BEAK_KEY.y, BEAK_KEY_ROWS, { Y: C.yelL, y: C.yel, o: C.yelD, W: C.white });
  img.blit(outlined(t), 0, 0);
  magpieSit(img, 'smug');
}

/**
 * O3 앉은 까치 anim(그림 물건·대상 `magpie`).
 *   loop: 대기 반복(magpie_nest와 같은 smug 2500 → flick 150 → puff 300, 첫 칸 = 멈춘 모습).
 *   peek: 5-1. smug(출발) → 내려다보기 900ms → smug(도착). 형식 4-2 (a) 첫 칸 출발·마지막 칸 도착. 합 1080ms.
 *   beak_suck: 3-2. 부리에 문 열쇠(출발) → 빈 부리 smug(도착). "쏙"은 칸 바뀜 한 번이고, 바로 뒤 `huh_text`(？)와 `duct.lump_travel`이 받는다.
 */
export const MAGPIE_SIT = {
  loop: { ms: [2500, 150, 300], frames: ['smug', 'flick', 'puff'].map((p) => (img) => magpieSit(img, p)) },
  peek: { ms: [80, 900, 100], frames: ['smug', 'peek', 'smug'].map((p) => (img) => magpieSit(img, p)) },
  beak_suck: { ms: [420, 160], frames: [magpieSitKey, (img) => magpieSit(img, 'smug')] },
};

// ═════════════ O5 날아가는 양말(1칸) + 병뚜껑(1칸) (물건 시트 2/2-a) ═════════════
// 양말: 3번 건조기 문틈 양말과 같은 분홍(pinkL 몸 · pink 그늘 · white 줄무늬 목). L자라 날 때는 "양말", 머리 위에서는
//   목이 정수리를 가로지르고 발이 옆으로 늘어진 모습이 된다(한 칸으로 둘 다). 12×7, 외곽선 포함 14×9.
// 병뚜껑: 둥지 병뚜껑과 같은 은색(lint · white 반짝 · lav 그늘). 톱니는 위·아래·옆으로 한 칸씩 튀어나온 이로 보인다(외곽선이 톱니 모양을 만든다).
//   7×7, 외곽선 포함 9×9(설계 9-3 "6×6 톱니 테두리 + 반짝 1점"보다 1px 크다: 6이면 톱니가 안 생긴다).
const SOCK_ROWS = [
  'wPwPpppppp..',
  'wPwPppppppp.',
  '........pPpp',
  '.........pPp',
  '.........pPp',
  '........ppP.',
  '........PP..',
];
const CAP_ROWS = [
  '..c.c..',
  '.ccccc.',
  'cWWcccc',
  '.Wccccd',
  'cccccdd',
  '.ccddd.',
  '..d.d..',
];
const SOCK_LEGEND = { w: C.white, p: C.pinkL, P: C.pink };
const CAP_LEGEND = { c: C.lint, W: C.white, d: C.lav };
/** 양말 몸(외곽선 안) 크기 */
export const SOCK = { w: 12, h: 7 };
/** 병뚜껑 몸(외곽선 안) 크기 */
export const CAP = { w: 7, h: 7 };

function stampOutlined(img, x, y, rows, legend, flip) {
  const t = new Image(img.w, img.h);
  const r = flip ? rows.map((row) => [...row].reverse().join('')) : rows;
  stamp(t, x, y, r, legend);
  img.blit(outlined(t), 0, 0);
}
/** O5 날아가는 양말. (x, y) = 몸 왼쪽 위(외곽선은 1px 바깥). flip이면 좌우 뒤집어 공중에서 뒤집힌 것처럼 */
export function flySock(img, x, y, { flip = false } = {}) {
  stampOutlined(img, x, y, SOCK_ROWS, SOCK_LEGEND, flip);
}
/** O5 병뚜껑. (x, y) = 몸 왼쪽 위 */
export function bottleCap(img, x, y) {
  stampOutlined(img, x, y, CAP_ROWS, CAP_LEGEND, false);
}

// ═════════════ 자판기 동전(2칸, 물건 시트 2/2-c2 `soap_vending.spill_coin`) ═════════════
// 은색 동전(금색은 열쇠 전용 약속이라 안 쓴다). 병뚜껑과 같은 lint · white 반짝 · lav 그늘이지만 톱니가 없고 납작해서 다르게 읽힌다.
//   서서 굴러가는 모습 3×5(옆에서 본 테두리)와 누운 모습 5×3(바닥에 납작). 외곽선은 stampOutlined가 두른다.
//   바닥 woodL(Y149)과 lint(Y178)는 29라 누운 동전 윗면은 white(Y249)로 채워 바닥에서 뜨게 한다.
const COIN_ROWS = {
  stand: ['.c.', 'cWc', 'cWd', 'cWd', '.d.'],
  flat: ['.WWW.', 'cWWWd', '.ddd.'],
};
const COIN_LEGEND = { c: C.lint, W: C.white, d: C.lav };
/** 동전 몸(외곽선 안) 크기 */
export const COIN = { stand: { w: 3, h: 5 }, flat: { w: 5, h: 3 } };
/** 자판기 동전. pose 'stand'(굴러감) | 'flat'(누움). (x, y) = 몸 왼쪽 위 */
export function coin(img, x, y, pose = 'flat') {
  stampOutlined(img, x, y, COIN_ROWS[pose], COIN_LEGEND, false);
}

// ═════════════ O8 머리 위에 꽂힌 깃털(1칸, 물건 시트 2/2-b) ═════════════
// 날아오는 깃털은 magpie_nest `feather`(4×4 대각선) 재사용이고, 꽂힌 모습만 새로 그린다.
// 4×4 그대로 머리에 얹으면 "먼지 한 점"이라 8-1 ②(몸 크기 이상)도 ④(몸에 남음)도 못 채운다. 그래서 세워서 길게 늘였다:
//   깃대(tealM)가 털모자에 박히고, 깃(white)이 뒤쪽(−x)으로 젖혀 선다. 모자에 꽂은 장식 깃털 실루엣이라 1배에서 "꽂혔다"로 읽힌다.
//   깃 끝 두 칸은 ink 대신 tealD로 까치 꼬리 끝(magpie_nest 까치 꼬리 t/T)과 색을 잇는다. "까치 깃털"이 색으로 이어진다.
// 5×10, 외곽선 포함 7×12. (x, y) = 몸 왼쪽 위. 깃대 끝(아래 오른쪽 열 3, y + 9)이 꽂히는 점이다.
const HEAD_FEATHER_ROWS = [
  'tt...',
  'twt..',
  'wwwt.',
  'wwmw.',
  '.wmww',
  '.wwmw',
  '..wmw',
  '...m.',
  '...m.',
  '...m.',
];
/** 꽂힌 깃털 몸(외곽선 안) 크기와 깃대 끝(몸 기준) */
export const HEAD_FEATHER = { w: 5, h: 10, quill: { x: 3, y: 9 } };
/** O8 털모자에 꽂힌 깃털. (x, y) = 몸 왼쪽 위 */
export function headFeather(img, x, y) {
  stampOutlined(img, x, y, HEAD_FEATHER_ROWS, { t: C.tealD, w: C.white, m: C.tealM }, false);
}
