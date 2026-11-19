// 화면 2 `park_fountain` 물건 시트 원본 (#380, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md).
// 모든 그림은 480×270 투명 화면에 **제자리로** 그린다. 빌드(art/scene-build.mjs)가 잘라서 `at`을 적는다.
// 만질 수 있는 것이라 바깥 1px ink 외곽선을 두른다(ADR-0007 결정 3-1). 물방울·땀 같은 효과 픽셀만 외곽선 밖이다.
// 광원은 배경과 같은 왼쪽 위 하나. 좌표 근거: content/screens/park_fountain.json 히트 박스, docs/design/screens/park_fountain.md 1·7·8절.
//
// 아직 빌드(art/build.mjs)에 연결하지 않았다. 배경 완성 밀도·나머지 물건(관리인·재킷·자명종·오리·분수대)이 다 그려지면
// art/scenes/park_fountain.mjs `SCENE`에서 이 파일을 불러 연결한다. 그 전까지 확인은 미리보기 스크립트로 한다:
//   node docs/design/screens/park_fountain-objects-preview.mjs
//
// 뼈대 1: 손님 P8 4칸(설계 7절)과 멈춘 모습 2개, anim 4개(`guest.wait`·`run_in`·`cheer`·`soaked`).
// 뼈대 2: 관리인 P1 4칸 + P2 3칸, anim 3개(`keeper.wake`·`clean_time`·`swat`). 커튼 P3·자명종 P7은 다음 판.

import { C, Image, EMPTY } from '../lib/pixel.mjs';
import { stamp, outlined, line, fill, bay } from '../lib/texture.mjs';

const W = 480, H = 270;

/** body(im)를 따로 그려 바깥 ink 외곽선을 두르고, fx(im)는 외곽선 없이 위에 얹는다. */
const pic = (body, fx) => (img) => {
  const t = new Image(W, H);
  body(t);
  img.blit(outlined(t), 0, 0);
  if (fx) fx(img);
};

// ═════════════ 손님 (guest, 히트 438,176 24×56 / 그림 440,176 20×56) ═════════════
// 내일 결혼하는 사람. 재킷이 동상 위에 있어서 흰 셔츠 바람이다. 성별은 정하지 않는다(설계 5-4 `お客さん`).
// 세 사람과 같은 "큰 머리" 비율(머리 16 / 키 56). 넥타이는 재킷과 같은 분홍이라 "저 분홍 재킷이 이 사람 것"이
// 처음 화면에서 바로 이어진다(설계 0절 목표가 한눈에, 10-1절 1행). 은색 손목시계(금색은 쓰지 않는다).
// 왼쪽(분수대·세 사람 쪽)을 본다. 칸 기준: 20×56 상자의 왼쪽 위 (ox, oy), 발 맨 아랫줄 = oy + 55.
const GUEST_LEGEND = {
  h: C.plum, H: C.dusk, // 머리카락(검정에 가까운 자주) + 결 빛
  s: C.tan, S: C.woodL, z: C.wood, // 피부 밝음·그늘·코/귀 안쪽
  e: C.ink, b: C.plum, m: C.woodD, M: C.redD, t: C.white, // 눈·눈썹·입선·입 안·이
  w: C.white, c: C.cotton, l: C.lint, // 셔츠
  p: C.pink, P: C.pinkL, r: C.red, // 넥타이(재킷과 같은 분홍)·재킷 그늘
  u: C.dusk, U: C.plum, // 바지
  o: C.plum, O: C.lav, // 구두
  a: C.lint, A: C.dusk, // 손목시계 알·줄
  x: C.redD, // 볼 홍조(만세)
};

// 머리 4종(16줄). 왼쪽이 얼굴 앞, 오른쪽이 뒷머리·귀.
const HEADS = {
  // 0칸: 고개를 숙여 손목시계를 내려다본다(눈꺼풀 반, 입 꾹)
  watch: [
    '......hhhhhh........',
    '....hhhhhhhhhh......',
    '...hhHHHhhhhhhh.....',
    '..hhHHhhhhhhhhhh....',
    '..hhhhhhhhhhhhhhh...',
    '..hhssshhhhhhhhhh...',
    '..sssssssshhhhhhh...',
    '.sbbbsbbbsssShhhh...',
    '.ssssssssssSzShhh...',
    '.seeessee.sSzzShh...',
    'zssssssssssSSShh....',
    '.ssssssssssSShh.....',
    '.ssmmmmssssSS.......',
    '..sssssssSSS........',
    '...SSSSSSSS.........',
    '.....SSSS...........',
  ],
  // 1칸: 앞(왼쪽)을 노려보며 초조(눈썹 팔자, 입 삐죽)
  fret: [
    '......hhhhhh........',
    '....hhhhhhhhhh......',
    '...hhHHHhhhhhhh.....',
    '..hhHHhhhhhhhhhh....',
    '..hhhhhhhhhhhhhhh...',
    '..hhssshhhhhhhhhh...',
    '..sbbsssbbshhhhhh...',
    '.ssssbsbsssShhhh....',
    '.sesssesssSzShhh....',
    '.sesssesssSzzShh....',
    'zssssssssssSSShh....',
    '.ssssssssssSShh.....',
    '.sssmmmsssSS........',
    '..ssmsssssSS........',
    '...SSSSSSSS.........',
    '.....SSSS...........',
  ],
  // 2칸: 만세. 눈 꼭 감고(^ ^) 입 크게, 볼 홍조
  joy: [
    '......hhhhhh........',
    '....hhhhhhhhhh......',
    '...hhHHHhhhhhhh.....',
    '..hhHHhhhhhhhhhh....',
    '..hhhhhhhhhhhhhhh...',
    '..hhssshhhhhhhhhh...',
    '..ssssssssshhhhhh...',
    '.ssssssssssShhhh....',
    '.sesssessssSzShh....',
    'es.esesesssSzzShh...',
    'zsxsssssxssSSShh....',
    '.sMMMMMsssSSShh.....',
    '.sMttMMssSSS........',
    '..sMMMssSSS.........',
    '...SSSSSSSS.........',
    '.....SSSS...........',
  ],
  // 3칸: 흠뻑 젖음. 머리카락이 이마에 납작 붙고(앞머리 끝이 뾰족하게 늘어짐), 웃음 반 체념 반(처진 눈 + 한쪽만 올라간 입)
  wet: [
    '....................',
    '....................',
    '....................',
    '.....hhhhhhhhh......',
    '...hhhhhhhhhhhhh....',
    '..hhhhhhhhhhhhhhh...',
    '.hhhhhhhhhhhhhhhh...',
    '.hshhshhshhhShhhh...',
    '.hsshsshsssSzShhh...',
    '.seeesseee.SzzShhh..',
    'zssssssssssSSShhh...',
    '.ssssssssssSShhhh...',
    '.ssssssmmssSS.hh....',
    '..smmmmsssSSS..h....',
    '...SSSSSSSS.........',
    '.....SSSS...........',
  ],
};

// 몸(목 아래 28줄, 16~43줄). 셔츠 + 분홍 넥타이 + 벨트까지.
const BODIES = {
  // 0칸: 앞팔(왼팔)을 가슴 앞으로 들어 손목시계를 얼굴 쪽으로. 뒤팔은 허리에.
  watch: [
    '......SSSS..........',
    '....wwwppwww........',
    '...wwwwpPwwwwc......',
    '..wwwwwppwwwwcc.....',
    '..wwsAaAwwwwwccc....',
    '..wsSAaAwwwwwwccl...',
    '..wwsSssppwwwwccl...',
    '..wwwwwwppwwwwcclS..',
    '..wwwwwwppwwwwcclSS.',
    '..wwwwwwppwwwwccl...',
    '..wwwwwwppwwwwccl...',
    '..cwwwwwppwwwwcc....',
    '..cwwwwwwpwwwwcc....',
    '..ccwwwwwwwwwwcc....',
    '..ccwwwwwwwwwwcc....',
    '..cccwwwwwwwwccc....',
    '...UUUUUUUUUUUU.....',
  ],
  // 1칸: 팔짱. 어깨가 올라가고 팔이 가슴 앞에 포개진다
  cross: [
    '......SSSS..........',
    '...wwwwppwwwww......',
    '..wwwwwpPwwwwwc.....',
    '..wwwwwppwwwwwcc....',
    '..wwwwwppwwwwwcc....',
    '..wccccccccccwcc....',
    '..wwwwwwwwwwwwcl....',
    '..SSwwwwwwwwwSSl....',
    '..wccccccccccccc....',
    '..wwwwwwppwwwwcc....',
    '..wwwwwwppwwwwcc....',
    '..cwwwwwppwwwwcc....',
    '..cwwwwwwpwwwwcc....',
    '..ccwwwwwwwwwwcc....',
    '..ccwwwwwwwwwwcc....',
    '..cccwwwwwwwwccc....',
    '...UUUUUUUUUUUU.....',
  ],
};

// 다리(23줄, 33~55줄. 벨트 바로 아래부터). 'stand' 두 발, 'tap' 앞발(왼발) 무릎을 앞으로 들어 동동.
const LEG_BODY = '...uuuuu..uuuUU.....';
const LEGS = {
  stand: [
    '...uuuuuuuuuuuu.....',
    '...uuuuuuuuuUUU.....',
    '...uuuuuu.uuUUU.....',
    ...Array(18).fill(LEG_BODY),
    '..ooooo...oooooo....',
    '.oOoooo...ooOooo....',
  ],
  tap: [
    '...uuuuuuuuuuuu.....',
    '...uuuuuuuuuUUU.....',
    '...uuuuuu.uuUUU.....',
    '...uuuuu..uuuUU.....',
    '...uuuuu..uuuUU.....',
    '...uuuuu..uuuUU.....',
    '..uuuuuu..uuuUU.....',
    '..uuuuu...uuuUU.....',
    '.uuuuuu...uuuUU.....',
    '.uuuuu....uuuUU.....',
    '..uuuu....uuuUU.....',
    '..uuuu....uuuUU.....',
    '..uuuu....uuuUU.....',
    '..uuuu....uuuUU.....',
    '.ooooo....uuuUU.....',
    'oOoooo....uuuUU.....',
    '..........uuuUU.....',
    '..........uuuUU.....',
    '..........uuuUU.....',
    '..........uuuUU.....',
    '..........uuuUU.....',
    '..........oooooo....',
    '..........ooOooo....',
  ],
};

/**
 * 분홍 재킷을 입힌 몸. 만세(cheer)는 두 팔이 머리 위로, 젖음(wet)은 팔이 늘어지고 색이 한 단 진하다.
 * 흙길(woodL Y149) 앞에 서므로 재킷 주색 pink(Y173)로는 명도 차가 24라 모자란다(결정 3-4 ≥ 30).
 * 그래서 입은 재킷은 빛 받는 앞판을 pinkL(Y217)로, 젖은 재킷은 red(Y104)로 칠한다. 동상 위 재킷과 같은 분홍 계열이다.
 */
const JACKET = {
  cheer: [
    '......SSSS..........',
    '..PPPwppwwpppr......',
    '..PPPPwpPwPppr......',
    '..PPPPwppwPpprr.....',
    '..PPPPPppPPpprr.....',
    '..PPPPPPPPPpprr.....',
    '..PPPPPPPPPpprr.....',
    '..PPPPPPPPPppr......',
    '..PPPPPPrPPpprr.....',
    '..PPPPPPPPPpprr.....',
    '..PPPPPPPPPppr......',
    '..PPPPPPrPPpprr.....',
    '..pPPPPPPPPppprr....',
    '..pPPPPPPPPpprr.....',
    '..ppPPPPPPpprrr.....',
    '..pprrppprrrrr......',
    '...UUUUUUUUUUUU.....',
  ],
  wet: [
    '......SSSS..........',
    '...rrrwrrwrrrr......',
    '..rrrrrwrrrrrrr.....',
    '.rrrprrwrrrrrrrr....',
    '.rrprrrrrrrrrrrr....',
    '.rrprr.rrrrrrrrr....',
    '.rrprr.rrprrrrrr....',
    '.rrprr.rrrrrrrrr....',
    '.rrprr.rrrrrrrrr....',
    '.rrrrr.rrprrrrrr....',
    '.rrrrr.rrrrrrrrr....',
    '.rrrrr.rrrrrrrrr....',
    '.SSrr..rrprrrrr.....',
    '.SS....rrrrrrrr.....',
    '.......rrrrrrr......',
    '.......rrrrrrr......',
    '...UUUUUUUUUUUU.....',
  ],
};

/** 손님 한 칸을 (ox, oy)에 그린다. pose: 0 시계 / 1 동동 / 2 만세 / 3 젖음 (설계 7절 P8) */
function guestBody(im, ox, oy, pose) {
  if (pose === 2) {
    stamp(im, ox, oy, HEADS.joy, GUEST_LEGEND);
    stamp(im, ox, oy + 16, JACKET.cheer, GUEST_LEGEND);
    // 만세: 어깨(18줄)에서 머리 옆을 비켜 V자로 뻗은 두 팔, 손은 머리 위 끝 높이. 앞팔(왼쪽)은 빛 받는 pinkL, 뒤팔은 pink
    for (const [x0, x1, c] of [[2, -3, C.pinkL], [14, 19, C.pink]]) for (const w of [0, 1]) line(im, ox + x0 + w, oy + 19, ox + x1 + w, oy + 1, c);
    for (const [dx, dy] of [[-3, -1], [-2, -1], [-3, 0], [-2, 0], [19, -1], [20, -1], [19, 0], [20, 0]]) im.set(ox + dx, oy + dy, C.tan);
    stamp(im, ox, oy + 33, LEGS.stand, GUEST_LEGEND);
    return;
  }
  if (pose === 3) {
    stamp(im, ox, oy, HEADS.wet, GUEST_LEGEND);
    stamp(im, ox, oy + 16, JACKET.wet, GUEST_LEGEND);
    stamp(im, ox, oy + 33, LEGS.stand, GUEST_LEGEND);
    return;
  }
  stamp(im, ox, oy, pose === 0 ? HEADS.watch : HEADS.fret, GUEST_LEGEND);
  stamp(im, ox, oy + 16, pose === 0 ? BODIES.watch : BODIES.cross, GUEST_LEGEND);
  stamp(im, ox, oy + 33, pose === 0 ? LEGS.stand : LEGS.tap, GUEST_LEGEND);
}

/** 효과(외곽선 없음): 젖은 칸의 물방울. 소매 끝·앞머리 끝·턱에서 떨어진다. */
function guestDrips(im, ox, oy) {
  for (const [dx, dy] of [[1, 31], [1, 34], [2, 37], [14, 29], [14, 33], [-1, 13], [16, 46]]) im.set(ox + dx, oy + dy, C.tealL);
  for (const [dx, dy] of [[1, 32], [14, 30], [-1, 14]]) im.set(ox + dx, oy + dy, C.white);
  // 젖은 천 반들거림(재킷 어깨·앞판). 진한 red 위 흰 점이라 "젖어서 진해졌다"로 읽힌다
  for (const [dx, dy] of [[4, 18], [5, 19], [11, 18], [9, 23], [3, 25]]) im.set(ox + dx, oy + dy, C.white);
}
/** 효과: 동동 칸의 바닥 먼지 두 점(발을 굴렀다) */
const tapDust = (ox, oy) => (im) => { for (const [dx, dy] of [[-2, 53], [-3, 55], [5, 55]]) im.set(ox + dx, oy + dy, C.lint); };

/** 그림 한 장(외곽선 + 효과) */
const guest = (pose, ox, oy) => pic(
  (im) => guestBody(im, ox, oy, pose),
  pose === 3 ? (im) => guestDrips(im, ox, oy) : pose === 1 ? tapDust(ox, oy) : undefined,
);

/** 입구 자리(히트 박스 그림 440,176). 발 맨 아랫줄 231. */
export const GUEST_AT = [440, 176];
/**
 * 재회 자리: 재킷(손) 밑 ノビー(x 261) 오른쪽 옆. 발 맨 아랫줄 243(세 사람 시작 발 y 244와 같은 줄).
 * ノビー 칸 오른쪽 끝(기준점 + 24 = 285)과 겹치지 않는다(설계 8절 ②).
 */
export const GUEST_REUNION_AT = [290, 188];
/** 달려오기 칸 자리(설계 7절 P8 `run_in`): 입구 → 재회 자리. 1칸(동동)을 칸마다 다른 자리에 찍는다. */
export const GUEST_RUN = [[412, 179], [378, 182], [344, 185], [312, 187]];

const [GX, GY] = GUEST_AT, [RX, RY] = GUEST_REUNION_AT;

export const OBJECTS = {
  guest: {
    draw: guest(0, GX, GY),
    // 대기(설계 9절): 시계 보기 1400 → 발 동동 220 → 시계 300 → 동동 220. 급하다는 것만 보여 준다(단서 아님).
    loop: { ms: [1400, 220, 300, 220], frames: [guest(0, GX, GY), guest(1, GX, GY), guest(0, GX, GY), guest(1, GX, GY)] },
    // 클리어 뒤(대기열이 비어 hold가 풀린 뒤): 재회 자리에서 젖은 채 남는다. 입구로 순간이동하지 않게(설계 12절 ④).
    states: [{ when: { flags: { 'jacket.taken': true } }, draw: guest(3, RX, RY) }],
  },
};

export const ANIMS = {
  // 진입(onEnter): 대기 반복을 한 번 크게 보여 준다. 시계 → 동동 → 시계(멈춘 모습과 같은 그림으로 끝남)
  'guest.wait': { ms: [400, 200, 200, 200, 300], frames: [guest(0, GX, GY), guest(1, GX, GY), guest(0, GX, GY), guest(1, GX, GY), guest(0, GX, GY)] },
  // 8절 ② 달려오기. 엔진 이동 없이 칸마다 자리(설계 12절 ④). 마지막 칸을 붙든다(형식 13절)
  'guest.run_in': { ms: [120, 120, 120, 120], frames: GUEST_RUN.map(([x, y]) => guest(1, x, y)), hold: true },
  // 8절 ② 재킷 입고 만세(P8 2칸). guest_thanks 말풍선이 이 칸 상자에 붙는다
  'guest.cheer': { ms: [600], frames: [guest(2, RX, RY)], hold: true },
  // 8절 ③ 물보라 뒤 흠뻑(P8 3칸). guest_hand 말풍선. 클리어 뒤 멈춘 모습과 같은 그림
  'guest.soaked': { ms: [600], frames: [guest(3, RX, RY)], hold: true },
};

// ═════════════ 관리인 (keeper, 히트 = 창 36,114 44×36) ═════════════
// 졸린 할아버지(ja-text 3절). 정수리는 벗어지고 옆머리·눈썹·콧수염이 하얗다. 청록 작업복 + 하얀 이름표.
// 그림 한 칸 = 창 안 전체(어두운 실내 + 반쯤 묶은 커튼 + 관리인 상반신). 창 밖으로 나가는 건 자명종을 치는 팔(P1 2칸)뿐이다.
// 실내 벽은 lav(Y131)로 어둡게 둔다. 바깥 판벽(tan)보다 어두워야 "창 안"으로 읽히고, 피부 tan(Y195)과 64 차이가 난다.
// 그리는 순서(앞으로 올수록 나중): 실내 → 관리인 몸·머리 → 제어판(P2 1칸만) → 팔 → 커튼.
// 머리 16×15, 몸 22폭. 칸마다 머리 왼쪽 위 (hx, hy)만 바꿔 자세를 만든다. 기준(앉은 자리) hx 54, hy 118.
const WIN = { x: 36, y: 114, w: 44, h: 36 };
const KEEPER_LEGEND = {
  s: C.tan, S: C.woodL, z: C.wood, // 피부 밝음·그늘·귀 안
  h: C.white, H: C.lint, // 흰머리·눈썹·콧수염 + 그늘
  n: C.redL, // 코(술은 안 마신다. 30년 졸음에 늘 발그레)
  k: C.ink, w: C.white, // 눈·입 안, 흰자
  c: C.teal, C: C.tealD, L: C.white, // 작업복·그늘·이름표
};

// 얼굴 가운데 10칸(x 3~12)을 바꿔 끼운다: 눈썹 1줄, 눈 2줄, 입 1줄.
const K_EYES = {
  closed: ['ssssssssSS', 'skkksskkkS'], // 감음(졸기)
  wide: ['swwwsswwwS', 'swkwsswkwS'], // 휘둥그레(벌떡)
  downR: ['swwwsswwwS', 'swwksswwkS'], // 오른쪽 아래(창턱 자명종)를 본다(갸웃)
  upR: ['swwksswwkS', 'swwwsswwwS'], // 오른쪽 위(바깥 벽시계)를 본다
  squeeze: ['kkssssskkS', 'sskksskkSS'], // 질끈(>  <): 탁·꾹
  half: ['skkksskkkS', 'swkwsswkwS'], // 반쯤 감김(털썩)
};
const K_MOUTH = {
  drool: '.ssskkSSS.', shut: '.sssssSSS.', open: '.sskkkkSS.', o: '.ssskkSSS.', grit: '.skwwwwkS.',
};
/** 머리 15줄. eyes·mouth는 위 표 이름. raised = 눈썹이 한 줄 올라감, spiky = 옆머리가 곤두섬, tilt = 위가 오른쪽으로 기움 */
function keeperHead({ eyes, mouth, raised = false, spiky = false, tilt = false }) {
  const [e1, e2] = K_EYES[eyes];
  const brow = 'hhhhsshhhh';
  const rows = [
    '.....ssssss.....',
    spiky ? 'h..sssssssssS..h' : '...sssssssssS...',
    spiky ? 'hh.ssssssssssShh' : '..ssssssssssSS..',
    spiky ? '.hhssssssssssShh' : '..sssssssssSSS..',
    spiky ? 'hhhsssssssssSShh' : '.hhsssssssssShh.',
    raised ? `hhH${brow}Hhh` : 'hhHssssssssssHhh',
    `hHs${raised ? 'ssssssssSS' : brow}SHh`,
    `hHs${e1}SHh`,
    `Szs${e2}SzS`,
    'SzssssnnssssSSzS',
    '.sssssnnnnsSSSS.',
    '.shhhhnnhhhhSSS.',
    '..hhhhhhhhhhhS..',
    `...${K_MOUTH[mouth]}...`,
    '....sSSSSSS.....',
  ];
  if (!tilt) return rows;
  // 갸웃: 위 5줄은 2칸, 다음 5줄은 1칸 오른쪽으로 민다(고개가 오른쪽으로 기운다)
  return rows.map((r, i) => (i < 5 ? '..' + r.slice(0, 14) : i < 10 ? '.' + r.slice(0, 15) : r));
}
const KEEPER_BODY = [
  '........ssSSS.........',
  '.....cccLLLLLccC......',
  '...ccccccLLLccccCC....',
  '..cccccccLLLcccccCCC..',
  '.cccccccccLccccccCCCC.',
  '.ccLLLccccccccccccCCC.',
  '.ccLLLcccccccccccCCCC.',
  ...Array(10).fill('ccccccccccccccccccCCCC'),
];

/** 팔: 소매(2px) 어깨 → 손, 손은 3×3 피부. 바깥 외곽선은 따로 두른다 */
function keeperArm(t, x0, y0, x1, y1) {
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) line(t, x0 + dx, y0 + dy, x1 + dx, y1 + dy, C.teal);
  fill(t, x1 - 1, y1 - 1, 3, 3, (x, y) => (x === x1 + 1 || y === y1 + 1 ? C.woodL : C.tan));
}

/** 실내 + 커튼(앞) 사이에 관리인 한 칸. pose 이름은 아래 KEEPER_POSES */
function keeperPic(pose) {
  const p = KEEPER_POSES[pose];
  const [hx, hy] = p.at;
  return pic((im) => {
    // 실내: 어두운 lav 벽, 오른쪽 아래로 갈수록 dusk 그늘(빛은 창 왼쪽 위에서 들어온다)
    fill(im, WIN.x, WIN.y, WIN.w, WIN.h, (x, y) => bay(x, y, Math.max(0, (x - 40 + (y - 114) * 1.2) / 90 - 0.25), C.lav, C.dusk));
    // 관리인(몸 + 머리)을 따로 그려 외곽선을 두르고 창 안만 남긴다
    const k = new Image(W, H);
    stamp(k, hx - 3, hy + 14 + (p.bodyDy ?? 0), KEEPER_BODY, KEEPER_LEGEND);
    stamp(k, hx, hy, keeperHead(p.head), KEEPER_LEGEND);
    const ko = outlined(k);
    for (let y = WIN.y; y < WIN.y + WIN.h; y++) for (let x = WIN.x; x < WIN.x + WIN.w; x++) { const c = ko.get(x, y); if (c !== EMPTY) im.set(x, y, c); }
    // 책상 앞판(창 맨 아래 3줄): 관리인은 책상 뒤에 앉아 있다
    fill(im, WIN.x, 147, WIN.w, 3, (x, y) => (y === 147 ? C.woodL : C.wood));
    if (p.panel) {
      // 제어판(P2 1칸에서만 보인다): 책상 위 철판 + 큰 빨간 단추(눌려서 납작) + 불 2개
      const q = new Image(W, H);
      fill(q, 43, 140, 16, 7, (x, y) => (y === 140 ? C.lint : x > 56 ? C.dusk : C.lav));
      fill(q, 44, 137, 6, 3, (x, y) => (y === 137 && x < 47 ? C.redL : C.red)); // 큰 단추(손 밑)
      q.set(53, 142, C.grnL); q.set(55, 142, C.yel); fill(q, 52, 144, 5, 1, C.dusk);
      im.blit(outlined(q), 0, 0);
    }
    if (p.arms) {
      const a = new Image(W, H);
      for (const arm of p.arms) keeperArm(a, ...arm);
      if (p.folded) {
        // 책상에 포갠 두 팔: 아래팔 소매 두 개가 가운데서 만나고, 손 두 개가 겹친다
        fill(a, hx - 5, 143, 13, 4, (x, y) => (y === 146 ? C.tealD : C.teal));
        fill(a, hx + 8, 143, 13, 4, (x, y) => (y === 146 || x > hx + 17 ? C.tealD : C.teal));
        fill(a, hx + 5, 142, 4, 4, (x, y) => (x === hx + 8 || y === 145 ? C.woodL : C.tan));
        fill(a, hx + 8, 143, 3, 3, (x, y) => (y === 145 ? C.woodL : C.tan));
      }
      const ao = outlined(a);
      // 창 안에 있는 팔은 창 안만, 바깥으로 나가는 팔(p.out)은 그대로
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = ao.get(x, y);
        if (c === EMPTY) continue;
        if (p.out || (x >= WIN.x && x < WIN.x + WIN.w && y >= WIN.y && y < WIN.y + WIN.h)) im.set(x, y, c);
      }
    }
    // 커튼(맨 앞): 위는 넓게, 끈 묶은 곳(y 134)에서 좁게, 아래는 다시 퍼짐. pinkL/pink 세로 주름
    fill(im, WIN.x, WIN.y, 13, WIN.h, (x, y) => {
      const reach = y < 134 ? 13 - Math.round((y - 114) * 0.38) : 6 + Math.round((y - 134) * 0.3);
      if (x - WIN.x >= reach) return undefined;
      if (y === 134 || y === 135) return C.redL; // 묶은 끈
      return (x - WIN.x) % 3 === 2 ? C.pink : C.pinkL;
    });
  }, p.fx);
}

/** 효과 글자·선(외곽선 없음) */
const zz = (im) => stamp(im, 71, 116, ['zzzz', '..z.', '.z..', 'zzzz', '.....', '....zzz', '.....z.', '....zzz'], { z: C.white });
const KEEPER_POSES = {
  // P1 0칸: 졸기(대기). 고개가 앞으로 2px 떨구고 팔은 창턱 안쪽 책상에 포갠다. 입가에 침 한 방울
  doze: { at: [54, 120], bodyDy: -2, head: { eyes: 'closed', mouth: 'drool' }, arms: [], folded: true,
    fx: (im) => { zz(im); im.set(61, 135, C.tealL); } },
  // P1 1칸: 벌떡. 몸째 2px 솟고 옆머리가 곤두서고 두 손바닥을 머리 옆으로
  jolt: { at: [54, 116], head: { eyes: 'wide', mouth: 'open', raised: true, spiky: true },
    arms: [[51, 133, 47, 121], [71, 133, 74, 121]],
    fx: (im) => { for (const [x, y] of [[50, 115], [49, 117], [76, 115], [77, 117], [52, 114]]) im.set(x, y, C.white); im.set(72, 117, C.tealL); im.set(72, 118, C.tealL); } },
  // P1 2칸: 자명종을 탁. 눈 질끈, 오른팔이 창 밖 창턱으로 뻗어 손바닥이 자명종 볏 바로 위(바닥 y 138, 자명종 위 끝 140)
  swat: { at: [55, 118], head: { eyes: 'squeeze', mouth: 'grit' }, arms: [[69, 133, 87, 137]], out: true,
    fx: (im) => { for (const [x, y] of [[84, 133], [85, 132], [90, 132], [91, 131], [94, 135], [95, 134]]) im.set(x, y, C.white); } },
  // 2번 규칙(이미 껐다): 졸던 자세 그대로 눈도 안 뜨고 팔만 뻗어 탁. 칸으로 안 센다(설계 7절 P1 "눈 감은 덧그림")
  swatAsleep: { at: [54, 120], bodyDy: -2, head: { eyes: 'closed', mouth: 'drool' }, arms: [[69, 135, 87, 137]], out: true,
    fx: (im) => { zz(im); for (const [x, y] of [[84, 133], [85, 132], [90, 132], [91, 131]]) im.set(x, y, C.white); } },
  // P1 3칸: 갸웃. 조용한 자명종을 내려다보며 고개를 오른쪽으로 기울이고 왼손으로 머리를 긁는다. 머리 위 "?"
  tilt: { at: [54, 118], head: { eyes: 'downR', mouth: 'shut', tilt: true }, arms: [[52, 133, 54, 120]],
    fx: (im) => stamp(im, 73, 115, ['.ww.', 'w..w', '...w', '..w.', '..w.', '....', '..w.'], { w: C.white }) },
  // P2 0칸: 벽시계(창 밖 오른쪽 위)를 돌아본다. 몸이 오른쪽으로 3px 쏠리고 오른손 손가락으로 위를 가리킨다. 식은땀 한 방울
  look: { at: [57, 117], head: { eyes: 'upR', mouth: 'o', raised: true }, arms: [[74, 133, 77, 117]],
    fx: (im) => { im.set(56, 121, C.tealL); im.set(56, 122, C.tealL); im.set(55, 123, C.tealL); } },
  // P2 1칸: 제어판 꾹. 몸이 왼쪽으로 기울고 왼손이 빨간 단추를 누른다(제어판은 이 칸에만). 눈 질끈
  press: { at: [52, 119], head: { eyes: 'squeeze', mouth: 'grit' }, arms: [[50, 133, 47, 136]], panel: true,
    fx: (im) => { for (const [x, y] of [[42, 135], [41, 134], [51, 134], [52, 133]]) im.set(x, y, C.white); } },
  // P2 2칸: 털썩. 몸째 3px 내려앉고 눈이 반쯤 감긴다. 어깨 옆으로 먼지 두 점. 끝나면 졸기로 돌아간다
  plop: { at: [54, 121], bodyDy: -1, head: { eyes: 'half', mouth: 'shut' }, arms: [], folded: true,
    fx: (im) => { for (const [x, y] of [[47, 140], [46, 141], [77, 140], [78, 141]]) im.set(x, y, C.lint); } },
};

export const KEEPER_WINDOW = WIN;
const keeper = Object.fromEntries(Object.keys(KEEPER_POSES).map((k) => [k, keeperPic(k)]));

OBJECTS.keeper = { draw: keeper.doze };
// 1번★·8절 ③: 벌떡 → 탁 → 갸웃. 말풍선(keeper_wake)이 갸웃 칸 상자에 붙도록 hold
ANIMS['keeper.wake'] = { ms: [260, 340, 600], frames: [keeper.jolt, keeper.swat, keeper.tilt], hold: true };
// 1번★·8절 ③: 벽시계 → 제어판 꾹 → 털썩. 대기열이 비면 졸기(draw)로 돌아간다
ANIMS['keeper.clean_time'] = { ms: [520, 420, 480], frames: [keeper.look, keeper.press, keeper.plop], hold: true };
// 2번(이미 끔): 졸면서 손만 탁
ANIMS['keeper.swat'] = { ms: [500], frames: [keeper.swatAsleep] };
