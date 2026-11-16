// 묵직이 기본 시트 (#143, 새 밀도 — 사장님 #156 "우스꽝스러운게 좋아", 11/16).
// 기준: 쭉이 새 밀도(jjuk-v4.mjs). 같은 칸 48×64, 같은 마감 패스(art/lib/finish.mjs), 같은 세기의 과장.
// 디자인은 ADR-0003 3차 샘플(crew-v3.mjs mukjik) 그대로: 전직 씨름부 덩치, 흰 머리띠, 청록 멜빵 작업복, 흰 반팔.
//
// 과장 (쭉이의 코·벌린 입과 같은 세기)
//   - 덩치·손발을 더 크게: 공 같은 배가 작업복 가슴받이를 밀어낸다, 짧고 굵은 다리, 주먹은 머리 절반만 하다.
//   - 얼굴: 일자로 붙은 굵은 눈썹, 콩알만 한 눈, 납작한 주먹코, 앞으로 나온 턱(아랫니 두 개가 윗입술 위로 올라온다), 수염 자국.
//     씨름하다 뭉개진 귀. 진지한 얼굴이 웃음 포인트다(쭉이는 헤벌쭉, 묵직이는 비장).
//   - 머리띠 매듭 꼬리 두 가닥이 뒤로 늘어진다.
// 움직임 (성격은 걸음 모양·박자로, ADR-0007 결정 5)
//   - 걸음 주기 24px(걸음폭 12px), 짧은 다리로 쿵쿵. 발 딛는 칸이 가장 낮다(쭉이는 딛은 다음 칸이 가장 낮다).
//   - 상체를 뒤로 젖히고 배를 내민다(쭉이는 앞으로 구부정).
//   - 딸린 것: 배와 머리띠 꼬리는 몸보다 한 프레임 늦게 따라온다. 주먹은 팔을 크게 흔든다.
// 마감: 바깥 외곽선 ink(ADR-0007 결정 3-1), 안쪽 경계는 부품 색별, 외곽 안쪽 한 단 내림, 손은 손가락 마디가 보이는 격자.

import { Canvas, C } from '../lib/pixel.mjs';
import { colorLines, rimShade, soles } from '../lib/finish.mjs';

export const CELL = [48, 64];
const S = 4 / 3;
const OX = 2.6;
const u = (px) => px / S;

// 명암 단계(어두운 쪽 → 밝은 쪽), 보송 32색 안에서.
const R4 = {
  skin: [C.wood, C.woodL, C.tan, C.tan],
  shirt: [C.lint, C.cotton, C.white, C.white],
  overall: [C.tealD, C.teal, C.teal, C.tealM],
  // 뒷다리: 한 단 어둡게 + 다른 ramp라 앞다리와 맞닿는 곳에 선이 생긴다(걷기에서 두 다리가 뭉치지 않게)
  overallBack: [C.tealD, C.tealD, C.teal, C.teal],
  boot: [C.ink, C.woodD, C.wood, C.woodL],
};
// 안쪽 경계선 색: 뒤에 있는 부품 ramp 첫 색 → 선 색
const LINE = new Map([
  [C.wood, C.woodD], // 피부
  [C.lint, C.lav], // 흰 셔츠
  [C.tealD, C.ink], // 작업복
  [C.ink, C.ink], // 장화
]);
// 외곽선 안쪽 한 단 내리기
const DOWN = new Map([
  [C.tan, C.woodL], [C.woodL, C.wood],
  [C.white, C.cotton], [C.cotton, C.lint],
  [C.tealM, C.teal], [C.teal, C.tealD],
  [C.wood, C.woodD],
]);

const HIP_Y = 37.6; // ① 골반(다리 시작)
const ANKLE_Y = 43.8;
const LEG = 6.5; // 골반 → 발목 최대 길이
const HIP_X = { back: 12.2, front: 19.6 };
const STEP_PX = 4; // ② px, 걸음 주기 24 / 6
const CONTACT_PX = 6;

function walkAnkle(phase) {
  const p = ((phase % 6) + 6) % 6;
  if (p <= 3) return { x: u(CONTACT_PX - STEP_PX * p), lift: 0, toe: p === 3 };
  const x = -CONTACT_PX + (2 * CONTACT_PX * (p - 3)) / 3;
  return { x: u(x), lift: p === 4 ? 2.2 : 1.4, toe: false };
}

// 걷기 출렁임(② px). 0 = 발 딛기(쿵, 가장 낮음), 1 = 받치기, 2 = 밀어 올리기(가장 높음)
const BOB = [4, 3, 1, 4, 3, 1];
const lag = (arr, k) => arr[(k + 5) % 6];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function pose(kind, k) {
  if (kind === 'idle') {
    return {
      chest: k, // 숨 들이쉬기(배가 나온다) / 내쉬기
      belly: k === 0 ? 0.6 : 0, // 들이쉬면 배가 앞으로
      jiggle: 0,
      lean: 0,
      legs: { back: { x: -0.4, lift: 0, toe: false }, front: { x: 1.4, lift: 0, toe: false } },
      armSwing: { back: 0, front: 0 },
      tails: k === 0 ? 2 : 1,
    };
  }
  const front = walkAnkle(k);
  const back = walkAnkle(k + 3);
  let need = 0;
  for (const a of [back, front]) {
    if (a.lift > 0) continue;
    need = Math.max(need, ANKLE_Y - Math.sqrt(Math.max(0, LEG * LEG - a.x * a.x)) - HIP_Y);
  }
  const chest = Math.max(BOB[k], Math.ceil(need * S));
  const prevFront = walkAnkle(k - 1), prevBack = walkAnkle(k + 2);
  return {
    chest,
    belly: 0.6,
    jiggle: clamp(lag(BOB, k) - BOB[k], -1, 1) * -1, // 몸이 내려갈 때 배는 아직 위, 올라갈 때 배는 아직 아래
    lean: -1, // 상체를 뒤로 젖힌다
    legs: { back, front },
    // 팔은 반대쪽 다리를 따라 흔들고, 무거운 주먹이라 한 프레임 늦는다
    armSwing: { back: prevFront.x / u(CONTACT_PX), front: prevBack.x / u(CONTACT_PX) },
    tails: lag(BOB, k) >= 3 ? 0 : lag(BOB, k) >= 2 ? 1 : 2,
  };
}

// ── 머리 (② 격자, 오른쪽을 본다). 크고 각진 머리, 짧게 깎은 머리 위에 흰 머리띠.
// K plum(머리) g dusk(머리 빛) k ink(머리 그늘)
// W white(머리띠) e cotton(머리띠 그늘) l lint(머리띠 깊은 그늘)
// D wood(피부 선) d woodL(피부 그늘) s tan(피부) t yelL(피부 빛) x lav(수염 자국)
// B ink(눈썹) w white(흰자) P ink(눈동자) m redD(입 선) T white(이) c pink(볼)
const HL = {
  K: C.plum, g: C.dusk, k: C.ink,
  W: C.white, e: C.cotton, l: C.lint,
  D: C.wood, d: C.woodL, s: C.tan, t: C.yelL, x: C.lav,
  B: C.ink, w: C.white, P: C.ink, m: C.redD, T: C.white, c: C.pink, r: C.red,
};
const HEAD = [
  '....KKKgKKgKKK........',
  '..KKKgKKKKKgKKKK......',
  '.kKKKKKKKKKKKKKKKK....',
  '.kKKKKKKKKKKKKKKKKK...',
  'eWWWWWWWWWWWWWWWWWWW..',
  'eWWWWWWWWWWWWWWWWWWWW.',
  'leeeeeeeeeeeeeeeeeeee.',
  '.kKdssstttsssssttsss..',
  '.kKdsBBBBBBBBBBBBBBBs.',
  '.kdssBBBBBsssssBBBBBs.',
  '.kdsssswwPssssswwPsss.',
  '..dsssswwPssssswwPss..',
  '..ddsscccsssssssssss..',
  '..dDssccsssssssssssss.',
  '..dDssssssssssssssss..',
  '...dsssssssmmmmmmmm...',
  '...ddsssxsxTsssssTms..',
  '....dsssxsxsTsssssTss.',
  '....ddsxsxsxdddddddd..',
  '......ddsxsxsxsxsdd...',
  '........dddddddddd....',
];
// 납작한 주먹코: 눈 아래에서 오른쪽으로 튀어나온다(쭉이 코보다 짧고 넓다)
const NOSE = [14, 11, [
  '...tts..',
  '..tsssss',
  '.tssssss',
  '.dDsDdd.',
]];
// 씨름하다 뭉개진 귀(머리 뒤쪽)
const EAR = [1, 9, ['.dsd.', 'dssDd', 'dsDsd', 'dDssd', '.dDd.', '..d..']];
// 머리띠 매듭 꼬리(머리 뒤 왼쪽): 0 날림 / 1 중간 / 2 처짐
const TAILS = [
  ['WW....', 'eWWW..', '.lWWWe', '..leeW', '....le'],
  ['.W....', 'WWW...', 'eWWe..', '.lWWe.', '..leW.', '...le.'],
  ['.W...', 'WWe..', 'WWe..', 'eWe..', 'lWWe.', '.lWe.', '..le.'],
];
const HEAD_X = 13, HEAD_Y = 4;
/** 머리 박스(② 칸 좌표, 서 있기 0번 기준). UI 초상화가 24×24로 자른다. */
export const HEAD_BOX = [HEAD_X - 1, 2, 24, 24];

// 주먹: 손가락 네 마디가 보인다. s tan t yelL d woodL D wood(마디 선)
const FIST_L = { s: C.tan, t: C.yelL, d: C.woodL, D: C.wood };
const FIST = {
  // 앞주먹(몸 앞쪽, 손등이 보인다)
  front: ['.ttss..', 'tsssssd', 'tssssdd', 'sssssdd', 'DsDsDdd', 'sDsDsdd', '.ddddd.'],
  // 뒷주먹(몸 뒤, 엄지 쪽)
  back: ['.tss..', 'tssssd', 'sssssd', 'sDsDsd', 'sDsDsd', '.dddd.'],
};

function drawLeg(K, side, a, d, bias) {
  const hx = HIP_X[side], hy = HIP_Y + d;
  const ax = hx + a.x;
  const ay = ANKLE_Y - a.lift;
  // 짧고 굵은 다리: 무릎은 가운데에서 살짝 앞으로
  const kx = (hx + ax) / 2 + 0.5, ky = (hy + ay) / 2;
  const r = side === 'front' ? [3.1, 2.8, 2.6] : [2.9, 2.6, 2.5];
  const ramp = side === 'front' ? R4.overall : R4.overallBack;
  const leg = K.limb([[hx, hy, r[0]], [kx, ky, r[1]], [ax, ay - 0.6, r[2]]], ramp, { bias });
  // 바짓단(접어 올림)
  K.limb([[ax - 0.2, ay - 0.9, r[2] + 0.35], [ax + 0.1, ay - 0.3, r[2] + 0.3]], ramp, { bias: bias + 0.15 });
  const fr = side === 'front' ? [5.0, 2.1] : [4.5, 2.0];
  const fx = ax + (side === 'front' ? 1.9 : 1.2) + (a.toe ? 0.6 : 0);
  const fy = ay + 1.8 - (a.toe ? 0.4 : 0);
  const shoe = K.ball(fx, fy, fr[0], a.toe ? fr[1] * 0.8 : fr[1], R4.boot, { bias: bias + 0.15 });
  return { leg, shoe };
}

function drawArm(K, side, sx, sy, swing, bias) {
  // 어깨 → 팔꿈치 → 손목. 짧은 소매(흰) 아래 굵은 팔뚝.
  const dir = side === 'front' ? 1 : -1;
  const a0 = Math.atan2(6.2, 2.0 * dir) - swing * 0.22 * dir;
  const up = 6.2, lo = 5.0;
  const ex = sx + up * Math.cos(a0), ey = sy + up * Math.sin(a0);
  const a1 = a0 - swing * 0.16 * dir;
  const wx = ex + lo * Math.cos(a1), wy = ey + lo * Math.sin(a1);
  K.limb([[sx, sy, 3.0], [sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55, 2.8]], R4.shirt, { bias });
  K.limb([[sx + (ex - sx) * 0.5, sy + (ey - sy) * 0.5, 2.4], [ex, ey, 2.5], [wx, wy, 2.3]], R4.skin, { bias });
  return [wx, wy];
}

export function drawFrame(p) {
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  const d = u(p.chest);
  const lean = u(p.lean);
  const body = (y) => y + d;
  // 상체 기울기: 위로 갈수록 lean(① y 16에서 lean, 골반에서 0)
  const bx = (x, y) => x + lean * clamp((HIP_Y + d - y) / (HIP_Y - 16), 0, 1);
  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];

  const feet = [];
  // 뒷팔(몸 뒤)
  const bw = drawArm(K, 'back', bx(8.6, body(22.6)), body(22.6), p.armSwing.back, -0.3);
  // 뒷다리
  feet.push(drawLeg(K, 'back', p.legs.back, d, -0.3).shoe);
  // 앞다리
  feet.push(drawLeg(K, 'front', p.legs.front, d, 0).shoe);

  // 몸통: 흰 셔츠 위에 공 같은 배를 감싼 작업복. 배는 한 프레임 늦게 출렁인다.
  const jig = u(p.jiggle);
  const bel = p.belly;
  K.ball(bx(16, body(26.4)), body(26.4), 10.4, 9.4, R4.shirt);
  const belly = K.ball(bx(16.8 + bel, body(31.2 + jig)), body(31.2 + jig), 11.4 + bel * 0.4, 7.9, R4.overall, {
    clip: (x, y) => y > body(27.4 + jig) - 0.3 * (x - 16 - lean),
  });
  // 가슴받이 + 주머니
  K.ball(bx(18.2 + bel, body(28.6)), body(28.6), 5.4, 4.4, R4.overall, { clip: (x, y) => y > body(24.4) });
  // 멜빵(어깨 → 가슴받이), 단추
  K.limb([[bx(11.6, body(18.6)), body(18.6), 1.05], [bx(13.2, body(25.4)), body(25.4), 1.05]], R4.overall, { bias: 0.2 });
  K.limb([[bx(20.4, body(18.4)), body(18.4), 1.05], [bx(21.6, body(25.4)), body(25.4), 1.05]], R4.overall, { bias: 0.2 });
  // 굵은 목
  K.ball(bx(16.8, body(17.4)), body(17.4), 5.0, 2.6, R4.skin, { bias: -0.2 });
  // 앞팔
  const fw = drawArm(K, 'front', bx(24.0, body(22.4)), body(22.4), p.armSwing.front, 0);
  colorLines(K, LINE);

  // 주먹(격자)
  const handPart = K.part(R4.skin);
  {
    const [x, y] = P(bw[0], bw[1]);
    K.stamp(x - 3, y - 1, FIST.back, FIST_L, handPart);
  }
  {
    const [x, y] = P(fw[0], fw[1]);
    K.stamp(x - 3, y - 2, FIST.front, FIST_L, handPart);
  }

  // 머리: 상체와 같은 정수 px만큼 내리고 lean만큼
  const hx0 = HEAD_X + p.lean, hy0 = HEAD_Y + p.chest;
  const headPart = K.part(R4.skin);
  K.stamp(hx0 - 5, hy0 + 4, TAILS[clamp(p.tails, 0, 2)], HL, headPart);
  K.stamp(hx0, hy0, HEAD, HL, headPart);
  K.stamp(hx0 + NOSE[0], hy0 + NOSE[1], NOSE[2], HL, headPart);
  K.stamp(hx0 + EAR[0], hy0 + EAR[1], EAR[2], HL, headPart);

  // 단추·명찰·주머니·무릎 기운 자국
  const bt = [{ C: C.yel, c: C.yelD }];
  K.stamp(...P(bx(13.2, body(25.4)), body(25.4)), ['C'], bt[0]);
  K.stamp(...P(bx(21.6, body(25.4)), body(25.4)), ['C'], bt[0]);
  K.stamp(...P(bx(16.4 + bel, body(27.2)), body(27.2)), ['ddddd', 'd...d', 'ddddd'], { d: C.tealD });
  K.stamp(...P(bx(19.6, body(20.6)), body(20.6)), ['AAA', 'AtA'], { A: C.aqua, t: C.tealM });

  rimShade(K, new Set([headPart, handPart]), DOWN);
  soles(K, feet, C.woodL);
  K.outline();
  return { K, feet, belly };
}

export const SHEET = {
  name: 'mukjik-base',
  character: 'mukjik',
  walkCycle: 24,
  anims: [
    { name: 'idle', frames: 2, ms: [800, 600] },
    { name: 'walk', frames: 6, by: 'distance' },
  ],
  pose,
  drawFrame,
};
