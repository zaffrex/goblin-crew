// 화면 2 `park_fountain` 물건 시트 원본 (#380, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md).
// 모든 그림은 480×270 투명 화면에 **제자리로** 그린다. 빌드(art/scene-build.mjs)가 잘라서 `at`을 적는다.
// 만질 수 있는 것이라 바깥 1px ink 외곽선을 두른다(ADR-0007 결정 3-1). 물방울·땀 같은 효과 픽셀만 외곽선 밖이다.
// 광원은 배경과 같은 왼쪽 위 하나. 좌표 근거: content/screens/park_fountain.json 히트 박스, docs/design/screens/park_fountain.md 1·7·8절.
//
// 빌드(art/build.mjs)에 연결돼 있다(#505). 고치면 `node art/build.mjs`로 시트를 다시 만들어 같이 커밋한다. 미리보기·검사:
//   node docs/design/screens/park_fountain-objects-preview.mjs (물건), node docs/design/screens/park_fountain-bg-preview.mjs (배경과 합친 판)
//
// 뼈대 1: 손님 P8 4칸(설계 7절)과 멈춘 모습 2개, anim 4개(`guest.wait`·`run_in`·`cheer`·`soaked`).
// 뼈대 2: 관리인 P1 4칸 + P2 3칸, anim 3개(`keeper.wake`·`clean_time`·`swat`), 대기 꾸벅 `loop`(#477).
// 뼈대 3: 커튼 P3 2칸(`keeper.curtain`·`curtain_open`) + 자명종 P7 3칸과 멈춘 모습(`alarm_clock.spring`·`fall`·`ring_late`).
// 뼈대 4: 재킷 P5 4칸(꼭대기·손 멈춘 모습, 대기 움찔 `loop`, `jacket.twitch`·`slide`).
// 뼈대 5: 분수대 테두리 앞면(`fountain` 멈춘 모습 1장). 물줄기는 효과 자리(scene-art-format 11절)라 여기 없다.

import { C, Image, EMPTY } from '../lib/pixel.mjs';
import { stamp, outlined, line, fill, bay, hash } from '../lib/texture.mjs';

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
  v: C.lav, // 젖은 재킷 그늘(분홍이 물을 먹어 탁해진 쪽, #529)
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
 * 그래서 입은 재킷은 빛 받는 앞판을 pinkL(Y217)로 칠한다. 동상 위 재킷과 같은 분홍 계열이다.
 * 젖은 재킷은 통째로 진하게 칠하지 않는다. red(Y104)로 칠했더니 블라인드에서 "빨간 재킷(다른 옷)"으로 읽혔다(#529, ノビー 셔츠와 같은 색).
 * 대신 물이 위에서 쏟아진 자국으로 보인다: 어깨·가슴은 젖어 한 단 어두운 pink, 아래로 갈수록 젖은 줄이 흘러내리고
 * 밑단 앞판은 마른 pinkL 그대로, 뒤쪽 그늘만 lav(탁해진 분홍). 젖은 자리와 마른 자리의 들쭉날쭉한 경계가 "젖었다"를 말한다.
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
    '...pppwppwpppp......',
    '..pppppwppppppp.....',
    '.ppppppwpppppppv....',
    '.ppppppppppppppv....',
    '.ppPpp.ppPpppppv....',
    '.PpPpp.PpPppPppv....',
    '.PpPPp.PpPPpPppv....',
    '.PPPPp.PpPPpPppv....',
    '.PPPPp.PpPPpPPpv....',
    '.PPPPP.PPPPpPPpp....',
    '.PPPPP.PPPPpPPPp....',
    '.SSPP..PPPPPPPP.....',
    '.SS....PPPPPPPP.....',
    '.......PPPPPPP......',
    '.......PPPPPPP......',
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
  // 젖은 천 반들거림. 젖어서 어두워진 어깨·가슴(pink) 위에만 흰 점을 둔다(마른 pinkL 위에서는 안 보인다)
  for (const [dx, dy] of [[4, 18], [5, 19], [11, 18], [10, 20], [2, 20]]) im.set(ox + dx, oy + dy, C.white);
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
    // 커튼(맨 앞). p.curtain 없음 = 반쯤 묶음(기본), 'closing' = 끈이 풀려 2/3 덮음, 'closed' = 창 전체(설계 7절 P3)
    curtain(im, p.curtain);
    if (p.curtain === 'closing') {
      // 커튼 앞 끝을 쥔 관리인 손(눈은 감은 채 끌어당긴다). 손만 보이고 팔은 커튼 뒤
      const hnd = new Image(W, H);
      fill(hnd, CURTAIN_EDGE - 1, 127, 3, 4, (x, y) => (x === CURTAIN_EDGE + 1 || y === 130 ? C.woodL : C.tan));
      im.blit(outlined(hnd), 0, 0);
    }
  }, p.fx);
}

/** 'closing' 칸에서 커튼 앞 끝 x(창 왼쪽에서 27px). 관리인 얼굴 왼쪽 절반이 가려진다 */
const CURTAIN_EDGE = WIN.x + 27;
/**
 * 커튼. 기본: 위는 넓게, 끈 묶은 곳(y 134)에서 좁게, 아래는 다시 퍼짐. pinkL/pink 세로 주름.
 * closing: 끈이 풀려 아래까지 곧게 내려오고 앞 끝이 살짝 물결친다(앞 끝 한 줄은 pink 그늘).
 * closed: 창 전체. 위 2줄은 커튼봉에 모인 주름(pink), 끈은 왼쪽 아래에 늘어진다.
 */
function curtain(im, kind) {
  const wave = (y) => [0, 1, 1, 0, -1, -1][(y >> 2) % 6];
  fill(im, WIN.x, WIN.y, WIN.w, WIN.h, (x, y) => {
    const dx = x - WIN.x;
    if (!kind) {
      const reach = y < 134 ? 13 - Math.round((y - 114) * 0.38) : 6 + Math.round((y - 134) * 0.3);
      if (dx >= reach) return undefined;
      if (y === 134 || y === 135) return C.redL; // 묶은 끈
      return dx % 3 === 2 ? C.pink : C.pinkL;
    }
    if (kind === 'closing') {
      const reach = CURTAIN_EDGE - WIN.x + wave(y);
      if (dx >= reach) return undefined;
      if (dx === reach - 1) return C.pink;
      return dx % 3 === 2 ? C.pink : C.pinkL;
    }
    if (y < WIN.y + 2) return dx % 2 ? C.pink : C.pinkL; // 커튼봉에 모인 주름
    if (dx < 2 && y >= 136 && y < 146) return C.redL; // 풀린 끈이 늘어짐
    return dx % 3 === 2 ? C.pink : C.pinkL;
  });
}

/** 효과 글자·선(외곽선 없음) */
const zz = (im) => stamp(im, 71, 116, ['zzzz', '..z.', '.z..', 'zzzz', '.....', '....zzz', '.....z.', '....zzz'], { z: C.white });
const KEEPER_POSES = {
  // P1 0칸: 졸기(대기). 고개가 앞으로 2px 떨구고 팔은 창턱 안쪽 책상에 포갠다. 입가에 침 한 방울
  doze: { at: [54, 120], bodyDy: -2, head: { eyes: 'closed', mouth: 'drool' }, arms: [], folded: true,
    fx: (im) => { zz(im); im.set(61, 135, C.tealL); } },
  // 9절 대기 꾸벅(졸기 덧그림, 칸으로 안 센다): 몸·포갠 팔은 그대로, 고개만 4px 떨어지며 창턱 자명종(오른쪽)으로 기운다.
  // 시선이 자명종으로 가는 보조 단서(설계 9절). 턱이 깃에 묻혀 침 방울은 안 보인다.
  // #530: 2px로는 처음 보는 사람이 못 봤다(#468 블라인드). 4px + 꾸벅 순간 `Zz`가 끊기고 정수리 위에 떨어지는 선 2줄
  nod: { at: [54, 124], bodyDy: -6, head: { eyes: 'closed', mouth: 'drool', tilt: true }, arms: [], folded: true,
    fx: (im) => { for (const [x, y] of [[58, 118], [58, 119], [66, 118], [66, 119], [66, 120]]) im.set(x, y, C.white); } },
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
  // P3 0칸: 장대로 창을 톡톡 → 졸던 그대로 손만 뻗어 커튼을 확 끈다(얼굴 왼쪽 절반이 가려짐). 앞 끝 옆 바람선 2줄
  curtainClosing: { at: [54, 120], bodyDy: -2, head: { eyes: 'closed', mouth: 'drool' }, arms: [], folded: true, curtain: 'closing',
    fx: (im) => { zz(im); for (const [x, y] of [[CURTAIN_EDGE + 2, 121], [CURTAIN_EDGE + 3, 122], [CURTAIN_EDGE + 2, 139], [CURTAIN_EDGE + 3, 140]]) im.set(x, y, C.white); } },
  // P3 1칸: 닫힘. 얼굴이 안 보이고 잠꼬대 말풍선(keeper_poke)만 이 칸 상자에 붙는다(hold). Zz도 커튼 뒤
  curtainClosed: { at: [54, 120], bodyDy: -2, head: { eyes: 'closed', mouth: 'drool' }, arms: [], folded: true, curtain: 'closed' },
};

export const KEEPER_WINDOW = WIN;
const keeper = Object.fromEntries(Object.keys(KEEPER_POSES).map((k) => [k, keeperPic(k)]));

OBJECTS.keeper = {
  draw: keeper.doze,
  // 9절 대기: 약 15초 졸다가 0.4초 꾸벅. anim(`keeper.wake` 등)이 끝나면 0부터 다시 센다(형식 개정 3, #237)
  loop: { ms: [15000, 400], frames: [keeper.doze, keeper.nod] },
};
// 1번★·8절 ③: 벌떡 → 탁 → 갸웃. 말풍선(keeper_wake)이 갸웃 칸 상자에 붙도록 hold
ANIMS['keeper.wake'] = { ms: [260, 340, 600], frames: [keeper.jolt, keeper.swat, keeper.tilt], hold: true };
// 1번★·8절 ③: 벽시계 → 제어판 꾹 → 털썩. 대기열이 비면 졸기(draw)로 돌아간다
ANIMS['keeper.clean_time'] = { ms: [520, 420, 480], frames: [keeper.look, keeper.press, keeper.plop], hold: true };
// 2번(이미 끔): 졸면서 손만 탁
ANIMS['keeper.swat'] = { ms: [500], frames: [keeper.swatAsleep] };
// P3 `keeper` × ノビー(단서 ③): 확 → 닫힘. 닫힌 칸을 붙든 채 잠꼬대 말풍선, 그 뒤 `curtain_open`이 거꾸로 연다
ANIMS['keeper.curtain'] = { ms: [160, 300], frames: [keeper.curtainClosing, keeper.curtainClosed], hold: true };
// P3 거꾸로(새 칸 0): 닫힘 → 확 → (대기열이 비면) 졸기. 설계 7절 "거꾸로 재생해서 다시 연다"
ANIMS['keeper.curtain_open'] = { ms: [200, 160], frames: [keeper.curtainClosed, keeper.curtainClosing] };

// ═════════════ 닭 자명종 (alarm_clock, 히트 80,134 24×24 / 그림 84,140 12×12) ═════════════
// 창턱(y 150) 위 하얀 닭. 몸통이 시계판(redL 테두리 + plum 바늘), 노란 부리·발, 빨간 볏. 구도 시안 그림을 그대로 옮겼다.
// 고장의 정체(설계 7절 P7): 머리가 용수철에 달린 장난감 같은 시계라, 태엽을 감으면 머리가 "ビヨーン" 튀어 올라 출렁인다.
// 같은 두 칸을 번갈아 8절 ③ "이제야 コケーッ 하고 덜덜 우는" 그림으로 다시 쓴다(`ring_late`, 새 칸 0).
const CLOCK_LEGEND = { r: C.red, w: C.white, k: C.plum, y: C.yel, c: C.redL, m: C.lint, M: C.lav };
const CLOCK_REST = [
  '....rr......',
  '...rrr......',
  '..wwww......',
  '.wwkwwww....',
  'yywwwwwwww..',
  '.wwwccccwww.',
  '.wwcwwwwcww.',
  '.wwcwwkwcww.',
  '.wwcwwwwcww.',
  '..wwccccww..',
  '...ww..ww...',
  '...yy..yy...',
];
// 튀어나온 머리(볏·눈·부리 + 목 아랫단)와 머리가 빠진 몸통(위가 뚫린 시계판)
const CLOCK_HEAD = ['....rr..', '...rrr..', '..wwww..', '.wwkwwww', 'yywwwwww', '..wwwww.'];
const CLOCK_HEAD_SHOCK = ['.r..rr.r', '...rrr..', '..wwww..', '.wkwkwww', 'yywwwwww', 'yy.wwww.']; // 놀라 벌린 부리·두 눈(출렁)
const CLOCK_BODY = ['..wwMMwwww..', ...CLOCK_REST.slice(5)];
/** 창턱 위 몸통 왼쪽 위(쉬는 그림 84,140의 5줄 아래 = 몸통 윗단 144) */
export const CLOCK_AT = [84, 140];
const [CX, CY] = CLOCK_AT;

/** 용수철: from(목 아래) → to(몸통 구멍) 사이를 2px 폭 지그재그로. 밝은 lint와 그늘 lav가 번갈아 감긴 철사로 보인다 */
function spring(t, x0, y0, x1, y1) {
  const n = y1 - y0;
  for (let i = 0; i <= n; i++) {
    const y = y0 + i, x = Math.round(x0 + ((x1 - x0) * i) / n) + (i % 2 ? 1 : 0);
    t.set(x, y, i % 2 ? C.lint : C.lav);
    t.set(x + 1, y, i % 2 ? C.lav : C.lint);
  }
}

/** 시계 방향 90° 돌린 줄 묶음(옆으로 누운 칸, `tumble`). */
const rotateCW = (rows) => [...rows[0]].map((_, i) => rows.map((r) => r[i]).reverse().join(''));

// #542 끈: 자명종 오른발에 빨간 끈이 묶여 있고, 다른 끝은 조는 관리인이 책상에 포갠 손(졸기·꾸벅 둘 다 x 59..64, y 142..145)에 쥐고 있다.
// 떨어질 때(`tumble`·`fallen`) 처음 보이고, 대사가 끝나면 관리인이 자면서 끈을 당겨 거꾸로 매달린 채 벽을 타고 올라와 창턱에 퐁(`reel_up`).
// 손을 뻗어 주워 올리는 안(PM 1안)은 팔이 약 90px 늘어나야 해서 쭉이의 특기(늘어나기)와 겹친다. 끈이면 몸은 졸기 그대로다.
// 끈은 효과 픽셀(외곽선 없음, redD 한 줄). 시계 그림 색(red·redL)과 다른 색이라 미리보기 검사에서 몸통만 따로 셀 수 있다.
export const CORD_COLOR = C.redD;
const CORD_HAND = [64, 145];
/** 손 → pts… → 끝 점을 꺾은선 끈으로 */
function cord(im, ...pts) {
  let [x0, y0] = CORD_HAND;
  for (const [x1, y1] of pts) { line(im, x0, y0, x1, y1, CORD_COLOR); [x0, y0] = [x1, y1]; }
}
/** 잡아당김 선(효과): 포갠 손 오른쪽 위 흰 점 둘. 눈은 감은 채, 손만 끈을 당긴다 */
const tug = (im) => { for (const [x, y] of [[67, 141], [68, 140], [67, 144], [68, 145]]) im.set(x, y, C.white); };
/** 거꾸로 선 자명종(다리가 위). 왼쪽 위 (x, y), 오른발 끝 = (x + 8, y). */
const CLOCK_FLIP = [...CLOCK_REST.slice(2)].reverse();
/**
 * #547 쉬는 끈: 떨어질 때 갑자기 생기던 끈(#468 재판정 2 S02)을 대기 때부터 보인다.
 * 오른발(92,151) 아래에서 창턱 앞면 밑으로 처졌다가(세로 5px, 판벽 크림 위라 1배에서도 보임) 창틀 오른쪽 아랫귀퉁이를 넘어
 * 창 안 아랫단(76,148)에서 끝난다. 관리인 손까지는 잇지 않는다: 관리인 포즈 9개마다 손 자리가 달라 끈이 허공에 뜬다.
 * 떨어질 때(`tumble`부터)는 지금처럼 손에서 나와 "창 안으로 들어간 끈이 관리인 손에 있었다"가 드러난다.
 * `rest`·`boing`·`sway`(= `spring`·`ring_late`) 모두 몸통 아랫단이 같은 자리라 같은 끈을 쓴다(새 칸 0).
 */
const restCord = (im) => {
  const pts = [[93, 152], [91, 155], [88, 156], [85, 156], [82, 154], [80, 151], [78, 149], [76, 148]];
  for (let i = 1; i < pts.length; i++) line(im, ...pts[i - 1], ...pts[i], CORD_COLOR);
};

/** pose: 'rest' 창턱 / 'boing' 머리가 왼쪽 위로 튐 / 'sway' 오른쪽으로 출렁(놀란 얼굴) / 'tumble' 떨어지는 중 / 'fallen' 땅에 거꾸로 처박힘
 *  / 'reel1'·'reel2' 끈에 거꾸로 매달려 올라옴 / 'reel3' 창턱 위로 퐁 뒤집혀 섬(#542) */
function clockPic(pose) {
  if (pose === 'rest') return pic((t) => stamp(t, CX, CY, CLOCK_REST, CLOCK_LEGEND), restCord);
  if (pose === 'reel1' || pose === 'reel2') {
    // 1: 흙에서 22px 들림(몸 상자 왼쪽 끝 70보다 왼쪽) / 2: 창 아래 벽, ズッシー 머리 위(몸 상자 위 끝 183 위)
    const [X, Y] = pose === 'reel1' ? [54, 214] : [62, 172];
    return pic(
      (t) => stamp(t, X, Y, CLOCK_FLIP, CLOCK_LEGEND),
      (im) => {
        cord(im, [X + 8, Y - 1]);
        tug(im);
        // 올라가는 속도선(아래로 남음)
        for (const [dx, dy] of [[2, 12], [2, 13], [9, 12], [9, 14]]) im.set(X + dx, Y + dy, C.white);
      },
    );
  }
  if (pose === 'reel3') {
    // 창턱 위 10px에서 똑바로 뒤집혀 섬 → 다음 틱에 멈춘 모습(창턱)으로 툭 내려앉는다. 양옆 흰 점 넷은 착지 직전 선(끈과 안 겹치게 몸 바깥)
    const [X, Y] = [CX, CY - 10];
    return pic(
      (t) => stamp(t, X, Y, CLOCK_REST, CLOCK_LEGEND),
      (im) => {
        cord(im, [72, 149], [X + 8, Y + 12]);
        tug(im);
        for (const [x, y] of [[82, Y + 12], [82, Y + 13], [97, Y + 12], [97, Y + 13]]) im.set(x, y, C.white);
      },
    );
  }
  // #527: 처음 자리(92,188 판잣집 벽 아래)는 ズッシー가 서는 곳(x 92, 몸 70..109 × 183..244) 바로 뒤라 몸에 다 가려졌다.
  // 그래서 창턱에서 벽을 타고 떨어져 **쿵 한 발 왼쪽 앞 흙**으로 튕겨 나온 자리로 옮긴다. ズッシー가 왼쪽을 보고 서니
  // 시선이 닿는 곳이고(`…すまん` 이 자명종에게 하는 말로 읽힌다), 창 바로 아래라 "창턱에서 떨어졌다"가 이어진다.
  // 떨어지는 길은 칸 하나(옆으로 누워 벽 앞을 지나는 중)로만 보인다. 엔진 이동 없음, 설계 7절 P7.
  if (pose === 'tumble') {
    // 창턱(84,140) → 땅(54,236) 길 중간, 벽 밑동 앞. 몸 상자 왼쪽 끝 70보다 왼쪽(외곽선 포함 x 55..68). 위쪽 흰 점 3개는 떨어진 자리에서 남은 빠름 선(효과)
    const TX = 56, TY = 178;
    return pic(
      (t) => stamp(t, TX, TY, rotateCW(CLOCK_REST), CLOCK_LEGEND),
      (im) => {
        // 끈(#542): 포갠 손 → 책상 앞판 → 창턱 끝 → 옆으로 누운 오른발(왼쪽 x 56, y 185)
        cord(im, [72, 149], [74, 152], [62, 176], [55, 185]);
        for (const [x, y] of [[66, 172], [67, 170], [62, 173], [63, 171], [58, 174]]) im.set(x, y, C.white);
      },
    );
  }
  if (pose === 'fallen') {
    // 쿵 한 발 왼쪽 앞 흙(외곽선 포함 x 50..68, y 235..248)에 거꾸로: 다리·발이 위로, 볏은 흙에 묻혀 안 보인다. 흙 튄 자국 5점은 효과
    const FX = 54, FY = 236;
    return pic(
      (t) => stamp(t, FX, FY, CLOCK_FLIP, CLOCK_LEGEND),
      (im) => {
        // 늘어진 끈(#542): 포갠 손 → 창턱 끝 → 벽을 따라 처져 → 위로 선 오른발 끝(62,235)
        cord(im, [72, 149], [74, 152], [72, 172], [67, 196], [63, 216], [62, 235]);
        for (const [dx, dy] of [[-2, 9], [-3, 7], [13, 8], [14, 6], [-4, 10]]) im.set(FX + dx, FY + dy, C.wood);
      },
    );
  }
  const boing = pose === 'boing';
  // 머리 자리: boing = 원래 자리에서 왼쪽 2·위 10 / sway = 오른쪽 3·위 7(용수철이 눌리며 기운다)
  const [hx, hy] = boing ? [CX - 2, CY - 10] : [CX + 3, CY - 7];
  return pic((t) => {
    stamp(t, CX, CY + 4, CLOCK_BODY, CLOCK_LEGEND);
    spring(t, hx + 3, hy + 6, CX + 4, CY + 4);
    stamp(t, hx, hy, boing ? CLOCK_HEAD : CLOCK_HEAD_SHOCK, CLOCK_LEGEND);
  }, (im) => {
    // 튄 방향 반대쪽 떨림선(효과): boing은 머리 오른쪽, sway는 머리 왼쪽
    const pts = boing ? [[hx + 10, hy + 1], [hx + 11, hy + 2], [hx + 10, hy + 5], [hx + 11, hy + 6]]
      : [[hx - 3, hy + 1], [hx - 4, hy + 2], [hx - 3, hy + 5], [hx - 4, hy + 6]];
    for (const [x, y] of pts) im.set(x, y, C.white);
    restCord(im);
  });
}
const clock = Object.fromEntries(['rest', 'boing', 'sway', 'tumble', 'fallen', 'reel1', 'reel2', 'reel3'].map((k) => [k, clockPic(k)]));

OBJECTS.alarm_clock = { draw: clock.rest };
// P7 0·1칸, `alarm_clock` × ノビー(단서 ①): ビヨーン → 출렁 → 다시 튐. 마지막 칸을 붙든 채 `clock_broken` 대사
ANIMS['alarm_clock.spring'] = { ms: [220, 200, 260], frames: [clock.boing, clock.sway, clock.boing], hold: true };
// P7 2칸, `alarm_clock` × ズッシー(단서 ②): 옆으로 누워 떨어지는 중(#527) → 쿵 한 발 앞 흙에 거꾸로. 붙든 채 `clock_fall` 대사, 대기열이 비면 창턱(장난감, 13절 Q4)
ANIMS['alarm_clock.fall'] = { ms: [160, 540], frames: [clock.tumble, clock.fallen], hold: true };
// #542: 대사가 닫히면 바닥에서 창턱으로 툭 순간이동하던 길. 조는 관리인이 끈을 당겨 거꾸로 매달린 채 올라와(들림 → 벽 중간) 창턱 위로 퐁.
// 끝나면 멈춘 모습(창턱)으로 내려앉는다. 새 칸 3, 540ms. 관리인 칸은 늘리지 않는다(손은 졸기 그림의 포갠 손 그대로).
ANIMS['alarm_clock.reel_up'] = { ms: [200, 160, 180], frames: [clock.reel1, clock.reel2, clock.reel3] };
// 8절 ③ (새 칸 0): 늦게 우는 자명종. 0·1칸을 빠르게 번갈아 덜덜. 끝나면 창턱 그림으로 돌아가 관리인이 탁 친다
ANIMS['alarm_clock.ring_late'] = { ms: [120, 120, 120, 120, 120, 120], frames: [clock.boing, clock.sway, clock.boing, clock.sway, clock.boing, clock.sway] };

// ═════════════ 재킷 (jacket, 히트 꼭대기 212,27 24×24 / 손 249,100 24×24) ═════════════
// 손님의 분홍 정장 재킷(pink Y173, 넥타이와 같은 색).
// 설계 7절 P5: 0 소매 움찔 → 1 돌우산 경사를 타고 미끄러짐 → 2 우산 끝에서 떨어지는 중 → 3 동상 손에 턱.
// 미끄러지는 쪽은 오른쪽(내민 손 위 처마 끝 x 255)이다. 떨어지는 칸은 같은 그림을 두 자리에 찍어 64px 낙하를 끊김 없이 보인다(손님 run_in과 같은 방식, 새 칸 0).
const JACKET_LEGEND = { r: C.red, P: C.pink, L: C.pinkL, w: C.white };
/**
 * 꼭대기: 돌우산 꼭지(x 222~225)에 옷걸이처럼 걸쳐 **앞판이 보인다**. 깃이 꼭지 위로 솟고(A자 어깨),
 * 흰 V 깃 사이 안감 + 단추 둘 + 갈라진 밑단 + 양쪽 소매(소매 끝 흰 안감)로 1배에서 "재킷"이 읽힌다(떨어지는 칸과 같은 표지).
 * 왼소매는 짧게 돔에 얹히고 오른소매(처마 쪽)만 길게 늘어져서, 처마 쪽으로 쏠려 있다 = "미끄러질 것 같다".
 * #530: 예전 그림은 등판이 덮인 뭉친 모양이라 #468 재판정에서 1배 꼭대기가 "생물"로 읽혔다
 */
export const JACKET_TOP_AT = [213, 32];
const JACKET_TOP = [
  '........rrLLrr........',
  '......rrLLwwLLrr......',
  '....rrPLLrwwrLLPrr....',
  '..rrPPPLLrwwrLLPPPrr..',
  '.rLPPPPPLrwwrLPPPPPPr.',
  'rLPPrPPPPLrwrPPPPrPPPr',
  'rLPrrPPPPPLrPPPPPrrPPr',
  'rPPr.rPPPPPwPPPPr.rPPr',
  'rPPr.rPPPPPrPPPPr.rPPr',
  'rPPr.rPPPPPwPPPPr.rPPr',
  '.ww..rPPPPPrPPPPr.rPPr',
  '.....rPPPPr.rPPPr.rPPr',
  '.....rrrrr...rrrr.rPPr',
  '..................rwwr',
];
const [JX, JY] = JACKET_TOP_AT;
const JACKET_W = JACKET_TOP[0].length;

/**
 * 0칸 소매 움찔: 바람이 왼쪽 밑단으로 들어가 재킷이 꼭지에서 **처마 쪽(오른쪽 아래) 경사로 6px·3px 미끄러지며** 왼쪽이 들려 기운다
 * (열마다 들림: 왼끝 7px → 오른끝 1px). 그래서 오른쪽 아래(앞판 밑단·늘어진 오른소매)가 돔 윗선을 넘어 **어두운 돔 오른쪽(plum) 위에 얹힌다**.
 * 꼭대기 그림에서는 재킷 전체가 돔 윗선 위 하늘 앞에 있으니, 이 칸만 분홍이 어두운 돔을 먹는다 = 1배에서 실루엣이 바뀐다.
 * 소매는 늘어진 그대로라 몸 밖으로 뻗는 부분이 없다. 왼쪽(바람이 오는 쪽)에 바람선 3줄(재킷을 따라 옮긴다).
 * #530: 예전엔 몸판 1px라 처음 보는 사람이 못 봤다(#468 블라인드). 소매만 옆으로 뻗게 키운 판은 "코·다리 달린 분홍 짐승"으로 읽혔다(소매 = 코).
 * 2~4px 기울기 판(#537)은 PM 재판정 2(2배)에서 "움직인 걸 못 봄"이었다. 실루엣이 그대로였기 때문이다.
 * 소매를 경사 따라 길게 늘어뜨려 처마까지 닿게 한 판도 그려 봤지만, 소매 길이가 몸통만 해져서 "코끼리 코·팔"로 읽혀 버렸다(PR 본문 비교)
 */
const TWITCH_SHIFT = [6, 3];
const TWITCH_LIFT = 6;
function jacketTwitch(t) {
  const [dx, dy] = TWITCH_SHIFT;
  for (let c = 0; c < JACKET_W; c++) {
    const lift = 1 + Math.round(((JACKET_W - 1 - c) * TWITCH_LIFT) / (JACKET_W - 1));
    JACKET_TOP.forEach((row, j) => stamp(t, JX + dx + c, JY + dy + j - lift, [row[c]], JACKET_LEGEND));
  }
}
const twitchFx = (im) => {
  const [dx, dy] = TWITCH_SHIFT;
  for (const [x, y, n] of [[204, 39, 3], [202, 42, 4], [205, 45, 2]]) for (let i = 0; i < n; i++) im.set(x + dx + i, y + dy, C.white);
};

/** 1칸 미끄러짐: 돔 오른쪽 경사(x 234 → 252, 윗면 y 41 → 45)에 배를 대고 오른쪽 아래로. 깃과 두 소매가 뒤(왼쪽 위)로 끌린다 */
const JACKET_SLIDE_AT = [230, 30];
const JACKET_SLIDE = [
  '..rr......................',
  '.rPPr.....................',
  '.rPPPr....................',
  '..rPPPrrrr................',
  '...rPLLLLLrr..............',
  '....rLLPPPPPrr............',
  '...rLLPPPPPPPPrr..........',
  '..rLLPPPPPPPPPPPrr........',
  '..rLPPPPPPPPPPPPPPrr......',
  '...rPPPPPrPPPPPPPPPPr.....',
  '....rrPPPPrPPPPPPPPPPr....',
  '......rrPPPPPPPPPPPPPr....',
  '........rrPPPPPPPPPPPPr...',
  '..........rrrPPPPPPPPPr...',
  '.............rrrPPPPPPr...',
  '................rrrrrrPrr.',
  '.....................rPPr.',
  '......................ww..',
];
const slideFx = (im) => { for (const [x, y] of [[227, 33], [226, 34], [229, 37], [228, 38], [230, 42]]) im.set(x, y, C.white); };

/** 2칸 떨어지는 중: 앞판이 보이게 뒤집혀 활짝, 두 소매는 바람에 위로 뻗는다(만세 모양, 소매 끝 흰 안감). V 깃·단추 하나·갈라진 밑단으로 재킷이 읽힌다. 위쪽에 낙하선 */
const JACKET_FALL = [
  'ww..................ww',
  'rPr................rPr',
  '.rPr..............rPr.',
  '..rPr..rrr..rrr..rPr..',
  '...rPrrLLLrrLLLrrPr...',
  '....rPLLLLwwLLLLPr....',
  '....rPPLLLwwLLLPPr....',
  '....rPPPLLwwLLPPPr....',
  '....rPPPPLrrLPPPPr....',
  '....rPPPPPrPPPPPPr....',
  '....rPPPPPwPPPPPPr....',
  '....rPPPPPrPPPPPPr....',
  '....rPPPPPrPPPPPPr....',
  '....rPPPPr.rPPPPPr....',
  '....rrrrr...rrrrrr....',
];
/** 낙하 두 자리: 처마 끝 바로 아래 → 손 바로 위. 손(손바닥 윗면 y 119)까지 끊김 없이 */
export const JACKET_FALL_AT = [[246, 60], [248, 88]];
const fallFx = (x, y) => (im) => { for (const [dx, dy] of [[4, -6], [4, -5], [10, -8], [10, -7], [10, -6], [16, -5], [16, -4]]) im.set(x + dx, y + dy, C.white); };

/** 3칸 동상 손에 턱(멈춘 모습, `jacket.on_hand`): 손바닥 위에 뭉쳐 얹히고, 왼앞판이 손바닥 앞으로, 오른소매가 손끝 너머로 늘어진다.
 *  손바닥 가운데(x 257~261, y 119~121)는 보인다("손이 쥐었다"). 소매 끝 y 124(설계 1-3 집기 조건) */
export const JACKET_HAND_AT = [250, 107];
const JACKET_HAND = [
  '....rrrrrr..........',
  '..rrLLLLPPrr........',
  '.rLLLPPPPPPPrr......',
  'rLLPPPPPPPPPPPrr....',
  'rLPPPPrPPPPPPPPPr...',
  'rPPPPPrPPPPPPPPPPr..',
  'rPPPPrrPPPPPPPPPPPr.',
  'rPPPPrPPPPPPPPPrPPPr',
  'rPPPPrPPPPPPPPPrrPPr',
  'rPPPPrPPPPPPPPr.rPPr',
  'rPPPPrrrrrrrrr..rPPr',
  'rPPPPr..........rPPr',
  'rPPPr...........rPPr',
  '.rPPr...........rPPr',
  '.rPPr...........rPPr',
  '.rPr............rPPr',
  '..r.............rwwr',
  '.................ww.',
];

/**
 * P6 덮어쓰기 두 자리(#529, 설계 1-3·7절). 집게는 발 y와 상관없이 대상 점 y 124에서 8px 위(116..124), x는 바라보는 방향에 따라
 * 253..269 안이다(tip 29). 0 활짝: 집게가 문 밑단이 집게 위 끝(116)에 오게 손 위로 확 펼쳐진다(낙하산, 앞판·두 소매 위로).
 * 1 떨어짐: 집게 아래로 빠져 ノビー 쪽으로. 발 y 200이면 칸 위 끝 136이라 이 칸이 머리에 막 닿고, 252면 아직 위에 있다.
 * 머리에 덮인 모습은 ノビー 시트 `take_up` 2번 칸이 그린다(발 y를 따라가야 해서 물건 칸이 아니다).
 */
export const JACKET_COVER_AT = [[250, 101], [250, 124]];
/** 활짝 칸 양옆 펄럭선(바람이 재킷 안으로 들어감). 외곽선 없음 */
const coverOpenFx = (im) => {
  for (const [x, y, n] of [[245, 104, 3], [244, 107, 3], [274, 104, 3], [275, 107, 3]]) for (let i = 0; i < n; i++) im.set(x + i, y, C.white);
};

const jacket = {
  top: pic((t) => stamp(t, JX, JY, JACKET_TOP, JACKET_LEGEND)),
  twitch: pic(jacketTwitch, twitchFx),
  slide: pic((t) => stamp(t, ...JACKET_SLIDE_AT, JACKET_SLIDE, JACKET_LEGEND), slideFx),
  fallHigh: pic((t) => stamp(t, ...JACKET_FALL_AT[0], JACKET_FALL, JACKET_LEGEND), fallFx(...JACKET_FALL_AT[0])),
  fallLow: pic((t) => stamp(t, ...JACKET_FALL_AT[1], JACKET_FALL, JACKET_LEGEND), fallFx(...JACKET_FALL_AT[1])),
  hand: pic((t) => stamp(t, ...JACKET_HAND_AT, JACKET_HAND, JACKET_LEGEND)),
  // P6 덮어쓰기(#529): 2칸 낙하 그림(JACKET_FALL)을 두 자리에 다시 찍는다(새 칸 0).
  coverOpen: pic((t) => stamp(t, ...JACKET_COVER_AT[0], JACKET_FALL, JACKET_LEGEND), coverOpenFx),
  coverDrop: pic((t) => stamp(t, ...JACKET_COVER_AT[1], JACKET_FALL, JACKET_LEGEND), fallFx(...JACKET_COVER_AT[1])),
};

OBJECTS.jacket = {
  draw: jacket.top,
  // 9절 재킷 대기(#477): 약 12초마다 바람에 소매가 움찔(P5 0칸 재사용). 손으로 내려온 뒤(state)에는 loop가 없어서 멈춘다
  loop: { ms: [12000, 300], frames: [jacket.top, jacket.twitch] },
  states: [
    // 클리어(#529, 형식 기록 14절 개정 9): 재킷은 ノビー 머리 → 손님 만세 칸으로 갔다. 동상 손은 비운다.
    // 클리어 때 `jacket.on_hand`가 참으로 남으니까 첫 일치가 되게 이 줄이 on_hand보다 앞이어야 한다.
    // 히트 상자는 그대로 둔다: taken부터는 컷(busy)·클리어(`scene.cleared`)라 호버·클릭이 꺼져 닿지 않는다(PR #552 Luna 리뷰).
    { when: { flags: { 'jacket.taken': true } }, draw: null },
    { when: { flags: { 'jacket.on_hand': true } }, draw: jacket.hand },
  ],
};
// 9번 `fountain_tap`(단서 ①): カーン에 소매가 움찔 → 제자리 → 한 번 더. 상태는 안 바뀌어서 끝나면 꼭대기 그림
ANIMS['jacket.twitch'] = { ms: [160, 90, 420], frames: [jacket.twitch, jacket.top, jacket.twitch] };
// 3번★(주 아하): ゴォン 뒤 움찔 → 경사를 타고 미끄러짐 → 처마에서 떨어짐(두 자리) → 손에 턱. 끝나면 state 그림(손)과 같은 그림
ANIMS['jacket.slide'] = { ms: [200, 260, 90, 90, 400], frames: [jacket.twitch, jacket.slide, jacket.fallHigh, jacket.fallLow, jacket.hand] };
// 8번★ P6(#529): ノビー `take_up` 1번 칸(확 당김)의 cue로 겹쳐 뜬다. 활짝 → 떨어짐, 합 350ms = take_up 1번 칸 길이라
// 끝나는 틱에 ノビー가 2번 칸(머리에 덮임)으로 넘어간다. hold 없음: 끝나면 `jacket.taken` 멈춘 모습(안 그림)으로
ANIMS['jacket.cover'] = { ms: [200, 150], frames: [jacket.coverOpen, jacket.coverDrop] };

// ═════════════ 분수대 테두리 (fountain, 히트 128,180 192×24 / 그림 앞면 128,180 192×18) ═════════════
// 흰 돌 블록(주색 cotton Y222). 둘레 흙길(woodL Y149)과 73 차이라 "돌 / 흙"이 1배에서 갈린다(단서 ②, 설계 1-1).
// 윗면(갓돌)은 아침 빛을 받아 흰색 2줄, 앞면은 24px 블록 두 단 + 줄눈. 오른쪽 끝과 아랫단은 그늘, 아랫단 줄눈에 물때·이끼.
// 쿵 자리(x 339)는 테두리 오른쪽 끝(320) 바깥이라 테두리 그림은 흔들림 연출을 따로 갖지 않는다(엔진 화면 흔들림).
const RIM = { x: 128, y: 180, w: 192, h: 18 };
const rimPic = pic((t) => {
  const { x: X, y: Y0, w: RW, h: RH } = RIM;
  fill(t, X, Y0, RW, RH, (x, y) => {
    const lx = x - X, ly = y - Y0;
    if (ly === 0) return C.white; // 갓돌 윗면 빛
    if (ly === 1) return lx > RW - 14 ? C.cotton : C.white;
    if (ly === 2) return C.lint; // 갓돌 아래 그늘 줄
    const row = ly < 10 ? 0 : 1; // 블록 두 단(윗단 3~9, 아랫단 10~17)
    const off = row ? 12 : 0;
    const bx = Math.floor((lx + off) / 24), bl = (lx + off) % 24;
    if (ly === 9 || bl === 23) return C.lint; // 줄눈
    if (row === 1 && (ly === 10 || bl === 0) && hash(bx, row, 81) < 0.8) return C.white; // 아랫단 블록 모서리 빛
    if (row === 0 && bl === 0) return C.white;
    if (bl === 22 || ly === 8 || ly === RH - 1) return C.lint; // 블록 아래·오른쪽 그늘
    if (lx > RW - 5) return C.lint; // 오른쪽 끝 둥글게 돌아가는 그늘
    if (lx > RW - 9 && (x + y) % 2 === 0) return C.lint;
    if (row === 1 && ly > 14 && hash(x, y, 82) < 0.25) return C.lint; // 아랫단 물때
    if (hash(x >> 1, y >> 1, 83 + bx) < 0.05) return C.lint; // 돌 결
    return C.cotton;
  });
  // 줄눈 이끼(아랫단, 몇 군데만) + 금 간 블록 하나
  for (const x of [151, 199, 247, 271]) { t.set(x, RIM.y + 16, C.grn); t.set(x, RIM.y + 15, C.grnL); }
  line(t, 186, RIM.y + 4, 189, RIM.y + 7, C.lint); t.set(190, RIM.y + 7, C.lav);
});
OBJECTS.fountain = { draw: rimPic };

// ═════════════ 물줄기 효과 자리 (water, scene-art-format 개정 4·11절) ═════════════
// 그림 없음. 엔진 입자 효과 `fountain_water`가 area 안에 colors 4색(물 밝음 26·물 중간 25·물보라 흰색 6·그림자 24)으로 그린다.
// 좌표·색은 회색 배치 JSON(docs/design/screens/park_fountain-layout.json `effects.water`)에서 옮겼다. 위쪽 여유는 burst 1.5배 높이 몫이다.
// 물 뒤 대비(물 밝음·물보라 vs 뒤 주색 ≥ 60)는 배경 미리보기(park_fountain-bg-preview.mjs)가 본다.
OBJECTS.water = {
  effect: 'fountain_water',
  area: [152, 8, 144, 172],
  colors: [C.tealL, C.tealM, C.white, C.teal],
  mode: 'on',
  states: [{ when: { flags: { 'fountain.off': true } }, mode: 'off' }],
};
// 1번★ 관리인 제어판 꾹 뒤 아래부터 꺼짐 / 8번★ 클리어 컷 ③ 크게 솟았다 다시 뿜음(끝난 뒤 모드는 states가 정한다, 11-3절)
ANIMS['fountain.water_off'] = { effect: 'water', mode: 'stop', ms: 900 };
ANIMS['fountain.water_burst'] = { effect: 'water', mode: 'burst', ms: 1200 };

// ═════════════ 비둘기 셋 (pigeons, 바닥 자리 `floor`가 맡는다 / 그림 196..266, 204..219) ═════════════
// #526: 예전엔 배경에 박혀 있어서 단서 ②(`pigeons_up`)가 임시 별로 떴고, 날아오를 칸을 그려도 땅에 셋이 그대로 남았다.
// 그래서 물건으로 옮겼다. 핫스팟이 아니라 클릭 대상이 아니다(픽셀 헌팅 미끼가 되지 않게). anim 대상 ID가 있어야 해서
// 바닥 자리 `floor`가 맡는다(형식 기록: 물건 ids는 hotspot·spot ID). 바닥은 상자가 없어서 히트 박스 검사·호버가 없다.
// 외곽선 없음: 배경 소품(볼거리)이고, 만질 수 있는 것처럼 보이면 안 된다(ADR-0007 결정 3-1의 반대쪽).
// 색: lint 몸·cotton 날개 빛·lav 윤곽·청록 목·plum 눈·redL 발. 1배 8×7이라 날 때는 날개(위/아래 4px)로 "퍼덕"을 읽힌다.
const PIGEON_LEGEND = { l: C.lint, L: C.cotton, k: C.plum, d: C.lav, t: C.tealM, p: C.redL };
// 나는 칸은 윤곽을 dusk로 한 단 진하게: 테두리 흰 돌·연못 물빛 앞을 지나갈 때 lav 윤곽은 몸(lint)과 함께 묻혔다(로컬 2배 캡처).
const PIGEON_FLY_LEGEND = { ...PIGEON_LEGEND, d: C.dusk };
// 왼쪽을 보는 모양. 오른쪽을 보는 새는 행을 뒤집는다(폭이 다른 칸은 머리 자리가 같게 x를 맞춘다).
const PIGEON_REST = ['.dd......', 'dlkd.....', '.dtl.....', '.dtlllld.', '.dlLllldd', '..dllll..', '...p..p..'];
// 놀람(땅에서 2px 펄쩍): 날개 반쯤 들고 다리 벌림. 날기 전·내려앉은 직후 칸.
const PIGEON_STARTLE = ['.dd..d...', 'dlkddLd..', '.dtldLd..', '.dtlllld.', '.dlLllldd', '..dllll..', '..p....p.'];
// 날개 위 / 날개 아래(폭 11). 몸은 쉬는 모양과 같은 줄에 두어 칸이 바뀌어도 새가 튀지 않는다.
const PIGEON_UP = ['.....d.d...', '....dLdLd..', '.dd..dLd...', 'dlkd.dLd...', '.dtllllllld', '..dllllldd.', '....pp.....'];
const PIGEON_DOWN = ['.dd........', 'dlkd.......', '.dtllllllld', '..dlLLLlldd', '...dLLLd...', '....dLd....', '.....d.....'];
const PIGEON_SHAPES = { rest: PIGEON_REST, startle: PIGEON_STARTLE, up: PIGEON_UP, down: PIGEON_DOWN };
/** 셋의 쉬는 자리 [x, y, 오른쪽을 보나, 날 때 옆으로 가는 방향]. 쿵 자리(x 224)에서 멀어지는 쪽으로 난다. 셋째는 거의 제자리에서 퍼덕(무리 가운데). */
export const PIGEONS_AT = [[196, 206, false, -1], [240, 212, true, 1], [258, 204, false, 0]];

/** 한 마리. `shape`는 왼쪽 보기 기준 행, `right`면 뒤집어 머리 자리(오른쪽 끝)를 쉬는 모양과 맞춘다. 땅에 있으면 발밑 그림자. */
function pigeon(im, x, y, right, shape, grounded) {
  const rows = right ? shape.map((r) => [...r].reverse().join('')) : shape;
  const x0 = right ? x + PIGEON_REST[0].length - shape[0].length : x;
  stamp(im, x0, y, rows, grounded ? PIGEON_LEGEND : PIGEON_FLY_LEGEND);
  if (grounded) for (let i = 2; i < 7; i++) im.set(x + i, y + 7 + (grounded === 'hop' ? 2 : 0), C.wood);
}
/** 셋을 한 칸에. `pose(i)` → [모양 이름, 위로 뜬 px, 옆으로 간 칸 수, 오른쪽 보기 뒤집기]. */
const flock = (pose) => (im) => {
  PIGEONS_AT.forEach(([x, y, right, side], i) => {
    const [shape, up, steps, turn] = pose(i);
    const face = turn ? !right : right;
    // 땅에 있는 칸만 그림자. 2px 뜬 놀람 칸은 그림자가 발에서 떨어져 "떴다"가 읽힌다.
    const grounded = up === 0 ? true : up <= 2 ? 'hop' : false;
    pigeon(im, x + side * steps, y - up, face, PIGEON_SHAPES[shape], grounded);
  });
};
const pigeonsPic = {
  rest: flock(() => ['rest', 0, 0]),
  // 단서 ② 날아오름(설계 2절 7번 "비둘기가 날았다 내려앉음"): 놀람 → 퍼덕퍼덕 40px까지 → 다시 내려와 놀람 칸으로 착지.
  // 꼭대기는 셋째 새(y 204) 기준 164: 흰 테두리(180~198)를 지나 그 위 연못 뒤 어두운 덤불 앞에서 회색 몸이 갈린다.
  // 26px 판은 꼭대기가 흰 돌 위라 1배에서 새가 돌에 묻혔다(로컬 캡처).
  hop: flock(() => ['startle', 2, 0]),
  up1: flock(() => ['up', 10, 1]),
  down1: flock(() => ['down', 21, 2]),
  up2: flock(() => ['up', 32, 3]),
  down2: flock(() => ['down', 40, 4]),
  up3: flock(() => ['up', 30, 3]),
  down3: flock(() => ['down', 15, 2]),
  // 돌아보기(재킷 프피, 설계 3절 jacket 행 "물줄기가 꺼졌으면 비둘기만 돌아본다"): 셋 다 반대로 고개를 돌린다.
  turn: flock(() => ['rest', 0, 0, true]),
};
OBJECTS.pigeons = { ids: ['floor'], draw: pigeonsPic.rest };
// 7번 `jacket_ground_stomp`(단서 ②): ぼふっ 뒤 셋이 퍼덕 날았다가 제자리에 내려앉는다. 흙길 쿵은 "새가 잠깐 놀랄" 만큼만 울린다.
// 끝나면 쉬는 그림(같은 자리)이라 따로 붙들지 않는다.
ANIMS['floor.pigeons_up'] = {
  ms: [100, 80, 90, 90, 120, 100, 100, 100],
  frames: [pigeonsPic.hop, pigeonsPic.up1, pigeonsPic.down1, pigeonsPic.up2, pigeonsPic.down2, pigeonsPic.up3, pigeonsPic.down3, pigeonsPic.hop],
};
// 재킷 × プピ 폴백: 소리 쪽을 두리번(돌아봄 → 원래 → 다시 돌아봄). 날지는 않는다(프피는 쿵보다 약하다).
ANIMS['floor.pigeons_turn'] = { ms: [300, 150, 350], frames: [pigeonsPic.turn, pigeonsPic.rest, pigeonsPic.turn] };

// ═════════════ 오리 (duck, 히트 175,156 24×24 / 그림 181,167 14×9 + 외곽선, P9) ═════════════
// 공원 연못의 カモ(설계 6절 이름표). 집오리·장난감 오리가 아니라 갈색 암컷 청둥오리: 몸은 woodL·wood에 woodD 얼룩,
// 눈선 woodD, 노랑 부리, 날개 끝 보라 거울깃 + 흰 테두리(작아도 "오리"를 나르는 표시). 녹색 머리 수컷은 뒤 덤불(grn)에 머리가 묻혀서 뺐다.
// 물에 뜬 높이: 연못 뒤 가장자리(lint, y 168~171) 앞, 물(y 172~179) 위. 배 아랫줄(y 175)과 외곽선(y 176)을 물빛 점선(tealL)이 끊어
// "물에 잠겼다"로 읽힌다. 처음 좌표(180,158)는 뒤 덤불 앞이라 떠 있지 않고 서 있는 것처럼 보여서 9px 내렸다(히트 상자도 같이).
// 만질 수 있는 물건이라 외곽선을 두른다. 물방울·물빛 점선만 외곽선 밖 효과 픽셀이다.
// 칸 3개(설계 7절 P9): 0 떠 있기 / 1 콕(머리를 물 쪽으로 내리꽂고 꽁지가 들림) / 2 퍼덕(앞 날개를 높이 치켜들고 3px 뜸).
// 나머지는 다시 찍기다: 뒤집기(오른쪽 보기)와 자리 옮기기(손님 run_in과 같은 방식, 새 칸 0).
const DUCK_LEGEND = { b: C.woodL, B: C.wood, d: C.woodD, t: C.tan, y: C.yel, Y: C.yelD, k: C.ink, p: C.pur, w: C.white };
/** 떠 있기 왼쪽 위(외곽선 안쪽). 배 아랫줄 = y + 8 = 175. */
export const DUCK_AT = [181, 167];
const DUCK_SHAPES = {
  // 왼쪽을 본다(세 사람이 오는 흙길 쪽이 아니라 연못 왼쪽 끝: 콕 쪼고 그쪽으로 헤엄쳐 떠난다).
  rest: ['..BBB.........', '.Bbttb........', 'yybkdtb.......', 'yYbbbbb.......', '...bbB.....BB.', '...tbbbbbbBBdB', '..tbbbBpwBBdBB', '..bbbBBBBBBBB.', '...BdBBdBBdBB.'],
  // 콕: 머리가 몸 앞 아래(x 181~184, y 172~175)로 내려가 부리가 물 높이에 닿는다. 장대 집게가 오는 쪽(상자 아래 끝)이다.
  peck: ['...........BB.', '.........bBBdB', '......bbbbBBB.', '..BBbbbbBpwBB.', '.Bttbbbbbbbbb.', 'Bbkdb.BdBBdBB.', 'bbbb..........', 'yYb...........', '.Yy...........'],
  // 퍼덕: 앞 날개 하나를 등 위로 세운다. 밑동 woodD 줄이 몸과 날개를 가른다(같은 갈색이라 줄이 없으면 한 덩어리로 묻혔다).
  // 첫 시안의 작은 두 날개는 1배에서 "고양이 귀"로 읽혀서 버렸다.
  flap: ['..........B...', '.........BbB..', '........Bbbp..', '..BBB..Bbbpw..', '.Bbttb.Bbbpw..', 'yybkdtbdBddBBB', 'yYbbbbbbBBBBdB', '...tbbbbBBBBB.', '...BdBBdBBdB..'],
};
/** 물빛 점선: 배 아래 외곽선 줄을 끊는다(떠 있음). 폭 14, 세 칸에 한 번 비운다. */
const duckWaterline = (x) => (im) => { for (let i = 0; i < 14; i++) if ((x + i) % 3) im.set(x + i, 176, C.tealL); };
/** 물방울(효과 픽셀). 콕 = 부리 끝 작은 튐, 퍼덕 = 양옆으로 튀는 물. */
const DUCK_DROPS = {
  peck: [[-2, 10, C.white], [2, 10, C.white], [-1, 11, C.aqua], [1, 11, C.aqua]],
  flap: [[-3, 3, C.white], [-4, 1, C.aqua], [-5, 5, C.aqua], [-2, 7, C.white], [16, 2, C.white], [17, 0, C.aqua], [18, 4, C.aqua], [15, 7, C.white]],
};
/** 한 칸. `dx`만큼 옆에, `right`면 오른쪽을 본다(행 뒤집기, 폭이 같아 자리 보정 없음). 퍼덕은 3px 뜬다. */
function duckPic(shape, { dx = 0, right = false } = {}) {
  const x = DUCK_AT[0] + dx, y = DUCK_AT[1] + (shape === 'flap' ? -3 : 0);
  const rows = right ? DUCK_SHAPES[shape].map((r) => [...r].reverse().join('')) : DUCK_SHAPES[shape];
  const drops = DUCK_DROPS[shape] ?? [];
  return pic((im) => stamp(im, x, y, rows, DUCK_LEGEND), (im) => {
    duckWaterline(x)(im);
    for (const [ddx, ddy, c] of drops) im.set(x + (right ? 13 - ddx : ddx), DUCK_AT[1] + ddy, c);
  });
}
const duck = {
  rest: duckPic('rest'),
  peck: duckPic('peck'),
  flap: duckPic('flap'),
  restRight: duckPic('rest', { right: true }),
};
OBJECTS.duck = { draw: duck.rest };
// duck × stretch(설계 4절): 집게를 콕, 한 번 더 콕. 쪼임 대사(`duck_peck`)는 콕 바로 뒤에 떠야 해서 헤엄은 따로 뺐다(`duck.lap`).
ANIMS['duck.peck'] = { ms: [140, 160, 140, 200], frames: [duck.peck, duck.rest, duck.peck, duck.rest] };
// 쪼고 나서 "연못을 한 바퀴 돌아 제자리로"(설계 4절): 왼쪽으로 12px 헤엄쳐 가다 돌아서 온다. 엔진 이동이 아니라 칸마다 자리(새 칸 0).
ANIMS['duck.lap'] = {
  ms: [220, 220, 260, 220, 220],
  frames: [duckPic('rest', { dx: -6 }), duckPic('rest', { dx: -12 }), duckPic('rest', { dx: -12, right: true }), duckPic('rest', { dx: -6, right: true }), duck.rest],
};
// duck × stomp: 쿵에 놀라 퍼덕퍼덕. 날개 든 칸(뜸) ↔ 떠 있기(날개 내림)를 번갈아 친다. 물벼락은 화면 JSON의 `splash` fx가 ズッシー 머리에 맡는다.
ANIMS['duck.flap'] = { ms: [110, 90, 110, 90, 110, 160], frames: [duck.flap, duck.rest, duck.flap, duck.rest, duck.flap, duck.rest] };
// duck × squeak: 소리 난 쪽을 홱 돌아봤다가 다시 앞으로(제자리 한 바퀴), 그 뒤 クワッ(화면 JSON `quack_text`).
ANIMS['duck.turn'] = { ms: [260, 160], frames: [duck.restRight, duck.rest] };

// ═════════════ 그리는 순서 (설계 1-4절, 뒤 → 앞) ═════════════
// back 목록은 OBJECTS 키 순서다(형식 6절). 오리(연못 물 위, 동상보다 앞이지만 물줄기·테두리 뒤) → 재킷 → 물줄기(재킷 앞을 지나감) → 테두리 앞면 → 비둘기(흙길이라 테두리 앞, 날아오르면 흰 돌 앞) → 창(관리인·커튼) → 자명종 → 손님.
// 손님이 맨 앞이어야 재회 자리(290,188)에서 테두리(y 180~198)가 손님 머리를 덮지 않는다. 파일에서 그린 순서와 달라서 여기서 다시 줄 세운다.
for (const k of ['duck', 'jacket', 'water', 'fountain', 'pigeons', 'keeper', 'alarm_clock', 'guest']) {
  const v = OBJECTS[k];
  delete OBJECTS[k];
  OBJECTS[k] = v;
}
