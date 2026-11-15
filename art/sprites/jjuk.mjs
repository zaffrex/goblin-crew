// 쭉이 기본 시트 (ADR-0007 결정 4·5, 칸 ② 48×64). 오른쪽을 보는 그림 1벌만 그린다.
// 몸은 3차 샘플(docs/design/art/crew-v3.mjs의 jjuk)과 같은 부품·명암이고, 포즈만 관절 좌표로 바꾼다.
// 좌표는 ① 좌표(① 칸 32×48 기준)이고 ② 칸에는 4/3배 + 가로 OX만큼 밀어서 그린다.
//
// 프레임
//   idle 0, 1 : 서 있기(숨쉬기). 1번은 상체만 1px 내려간다. 장대는 그대로, 손이 장대를 따라 미끄러진다.
//   walk 0~5  : 걷기 6장. 0 = 앞다리 딛기, 1 = 내려앉기, 2 = 올라서기, 3~5 = 다리를 바꿔 같은 순서.
//               딛은 발은 프레임마다 정확히 6px(② 좌표)씩 뒤로 간다 → 걸음 주기 36px(walkCycle)일 때 발이 미끄러지지 않는다.
//               골반 높이는 "딛은 다리가 닿는 높이"로 정해서 위아래 출렁임이 저절로 생긴다(성큼성큼).

import { Canvas, C, R } from '../lib/pixel.mjs';

export const CELL = [48, 64];
const S = 4 / 3;
const OX = 2.6;

/** ② 좌표 px → ① 좌표 */
const u = (px) => px / S;

// 다리 길이(① 좌표). 서 있을 때 골반 y=30, 발목 y=43.5.
const THIGH = 7.0;
const SHIN = 6.75;
const HIP_Y = 30;
const ANKLE_Y = 43.5;
const HIP_X = 14.45; // 두 다리 골반 가운데
// 골반 가운데에서 각 다리 골반까지. 서 있을 때는 3차 샘플대로 벌리고, 걸을 때는 옆모습이라 거의 겹친다
// (벌린 채 걸으면 한쪽 다리만 멀리 닿아야 해서 출렁임이 좌우 걸음마다 달라진다).
const LEG_DX = { idle: 1.85, walk: 0.5 };
const legDx = (kind, side) => (side === 'back' ? -1 : 1) * LEG_DX[kind];

// 걷기: 딛은 발 위치(골반 가운데 기준, ② px). 한 프레임에 6px씩 뒤로.
const STEP_PX = 6;
const CONTACT_PX = 9; // 딛는 순간 앞발이 골반보다 9px 앞 (걸음폭 18px)

/** 두 마디 IK. 무릎은 앞(+x)으로 굽는다. 닿지 않으면 쭉 편다. */
function knee(hx, hy, ax, ay) {
  const dx = ax - hx, dy = ay - hy;
  const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 1e-6);
  const a = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const base = Math.atan2(dy, dx);
  // 화면 좌표(y 아래)에서 앞(+x)으로 굽히려면 각도를 빼준다
  const t = base - a;
  return [hx + THIGH * Math.cos(t), hy + THIGH * Math.sin(t)];
}

/** 걷기 k(0~5)에서 다리 하나의 발목 위치. phase 0 = 이 다리가 앞에서 딛는 순간. */
function walkAnkle(phase) {
  const p = ((phase % 6) + 6) % 6;
  if (p <= 3) {
    // 딛고 있는 4프레임: 앞 9px → 뒤 9px
    return { x: u(CONTACT_PX - STEP_PX * p), lift: 0, toe: p === 3 };
  }
  // 떠서 앞으로 가는 2프레임 (뒤 9 → 앞 9 사이를 3등분)
  const x = -CONTACT_PX + (2 * CONTACT_PX * (p - 3)) / 3;
  return { x: u(x), lift: p === 4 ? 2.1 : 1.3, toe: false };
}

/** 포즈 정의: { hipDrop, chest, legs: { back, front }, armSwing, poleLift } (전부 ① 좌표, chest는 ② px 정수) */
export function pose(kind, k) {
  if (kind === 'idle') {
    return {
      hipDrop: 0,
      chest: k, // 숨 들이쉬기(0) / 내쉬기(1): 상체 1px
      legs: {
        back: { x: -2.05, lift: 0, toe: false },
        front: { x: 2.85, lift: 0, toe: false },
      },
      armSwing: 0,
      pole: 'ground',
      legDx: { back: legDx('idle', 'back'), front: legDx('idle', 'front') },
    };
  }
  const front = walkAnkle(k);
  const back = walkAnkle(k + 3);
  // 골반 높이: 딛은 다리(들 다 딛고 있으면 둘 다)가 닿도록 내린다
  let hipY = HIP_Y;
  for (const a of [back, front]) {
    if (a.lift > 0) continue;
    const dx = a.x; // 골반 가운데 기준(좌우 걸음 출렁임이 같아지게)
    const reach = (THIGH + SHIN) * 0.985;
    const need = ANKLE_Y - Math.sqrt(Math.max(0, reach * reach - dx * dx));
    hipY = Math.max(hipY, need);
  }
  // 상체는 정수 px로만 움직인다(손으로 찍은 머리가 반 픽셀에 걸리지 않게)
  const chest = Math.round((hipY - HIP_Y) * S);
  return {
    hipDrop: u(chest),
    chest,
    legs: { back, front },
    // 뒷팔은 앞다리와 같은 쪽으로 흔든다(앞다리가 앞이면 뒷팔도 앞)
    armSwing: front.x / u(CONTACT_PX),
    pole: 'carry',
    legDx: { back: legDx('walk', 'back'), front: legDx('walk', 'front') },
  };
}

// ── 머리: 3차 샘플 ② 머리 그대로(손으로 찍은 격자)
const HL = {
  s: C.tan, d: C.woodL, D: C.wood, H: C.woodD, h: C.wood, k: C.ink,
  W: C.white, P: C.ink, m: C.redD, r: C.red, c: C.pink, L: C.yelL,
};
const HEAD = [14, 0, [
  '.......H..H..H.....',
  '.....HHH.HHHHHH....',
  '...HHHHHHHHHHHHH...',
  '..HHhhhHHHHHHHHHH..',
  '.HHhHHHHHHHHhHHHHH.',
  'HHhHHHHHHHHHHHHHHH.',
  'HHHHHHHHHsHHHsHHHH.',
  'HHHHHHssssssssssHH.',
  'HHHHHsssssssssssss.',
  'HHHHssssssssssssss.',
  'HHHdssssssssssssss.',
  'HHddssssssssssssss.',
  'HdDDdsssssssssssss.',
  'HdDDdssssssssssssss',
  '.Hdddssssssssssssss',
  '..Hdsssssssssssssss',
  '...dssssssssssssss.',
  '...dssssssssssss...',
  '....dssssssssss....',
  '....ddsssssssss....',
  '......ddddddd......',
], [
  [6, 7, ['.kkk.kkkk']],
  [6, 9, ['.WW.', 'WWPP', 'WWPP', '.WW.']],
  [11, 9, ['.WW.', 'WWPP', 'WWPP', '.WW.']],
  [14, 12, ['.dss.', 'dsLss', 'dssss', 'dsssD', '.DDD.']],
  [7, 14, ['cc']],
  [5, 17, ['m........m', '.mWWWWWWm.', '..mmrrmm..']],
]];
/** 머리 박스(② 칸 좌표, 서 있기 0번 기준). UI 초상화는 이 박스를 24×24로 자른다(ADR-0007 결정 4). */
export const HEAD_BOX = [HEAD[0], HEAD[1], 19, 21];

function drawLeg(K, side, hx, hy, a, bias) {
  const ax = HIP_X + a.x;
  const ay = ANKLE_Y - a.lift;
  const [kx, ky] = knee(hx, hy, ax, ay);
  const thick = side === 'front' ? [1.6, 1.45, 1.35] : [1.5, 1.35, 1.3];
  K.limb([[hx, hy, thick[0]], [kx, ky, thick[1]], [ax, ay, thick[2]]], R.pants, { bias });
  // 신발: 큰 발. 뒤로 차는 발(toe)은 뒤꿈치가 들려 앞코만 닿는다.
  const fr = side === 'front' ? [4.3, 2.0] : [3.4, 1.9];
  const fx = ax + (side === 'front' ? 2.0 : 1.0) + (a.toe ? 0.8 : 0);
  const fy = ay + 2.0 - (a.toe ? 0.5 : 0);
  return K.ball(fx, fy, fr[0], a.toe ? fr[1] * 0.8 : fr[1], R.shoe, { bias: bias + 0.15 });
}

/** 한 프레임을 그린다. 반환: { K, feet, grip } (feet = 신발 부품 번호, grip = 장대 잡은 손, ② 칸 좌표) */
export function drawFrame(p) {
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  const d = u(p.chest); // 상체 내림(① 좌표, ② 정수 px에 맞춘 값)
  const hipY = HIP_Y + p.hipDrop; // 숨쉬기는 상체만 내리고 골반은 그대로
  const body = (y) => y + d;
  const hipCx = HIP_X;

  // 장대: 서 있을 때는 땅을 짚고, 걸을 때는 손에 들려 상체와 함께 오르내린다.
  // 걸을 때는 아랫마디를 하나 접어(3.0) 출렁여도 땅에 박히지 않게 한다. 위로 들면 갈고리가 칸 밖으로 잘린다.
  const poleTop = p.pole === 'ground' ? 5 : body(5);
  const poleBot = p.pole === 'ground' ? 45.5 : body(45.5) - 3.0;
  K.limb([[24.2, poleTop, 0.95], [24.2, poleBot, 0.95]], R.metal, {
    pattern: (x, y) => (Math.abs(((y - poleTop) % 9) - 0) < 0.6 ? R.pants : undefined), // 마디 이음매
  });
  const hx = Math.round(K.X(22.6)), hy = Math.round(K.Y(poleTop - 4.4));
  K.stamp(hx, hy, ['.DDDD.', 'D....D', 'D...DD', '.D..D.', '..DD..', '..DD..', '..DD..'], { D: C.dusk });

  // 뒷다리
  const feet = [drawLeg(K, 'back', hipCx + p.legDx.back, hipY, p.legs.back, -0.35)];
  // 뒷팔: 어깨 고정, 팔꿈치·손이 흔들린다
  {
    const sw = p.armSwing * 0.42; // 라디안
    const [sx, sy] = [13, body(20)];
    const up = 6.7, lo = 6.0;
    const a0 = Math.atan2(26.5 - 20, 11.2 - 13) - sw; // 기본 각도에서 앞(+x)으로
    const ex = sx + up * Math.cos(a0), ey = sy + up * Math.sin(a0);
    const a1 = a0 - sw * 0.5;
    const wx = ex + lo * Math.cos(a1), wy = ey + lo * Math.sin(a1);
    K.limb([[sx, sy, 1.5], [ex, ey, 1.3]], R.shirtRed, { bias: -0.3 });
    K.limb([[ex, ey, 1.15], [wx, wy, 1.05]], R.skin, { bias: -0.3 });
    K.ball(wx + 0.2 * Math.cos(a1), wy + 1.7, 1.9, 2.1, R.skin, { bias: -0.2 }); // 큰 손
  }
  // 앞다리
  feet.push(drawLeg(K, 'front', hipCx + p.legDx.front, hipY, p.legs.front, 0));
  // 몸통: 좁고 긴 줄무늬 셔츠, 살짝 구부정. 줄무늬는 몸을 따라 움직인다.
  K.limb([[15.2, body(19.5), 3.4], [14.8, body(25), 3.5], [14.6, hipY, 3.3]], R.shirtRed, {
    pattern: (x, y) => {
      const yy = Math.round((y - d) * S) / S; // 몸 기준 y
      return Math.floor(yy) % 3 === 0 && yy > 20 ? R.stripe : undefined;
    },
  });
  K.limb([[11.8, hipY + 0.6, 0.6], [17.6, hipY + 0.6, 0.6]], R.shoe, { line: false }); // 허리띠
  K.limb([[15.0, body(14), 1.15], [15.2, body(18.5), 1.2]], R.skin, { bias: -0.15 }); // 긴 목
  // 앞팔: 어깨 → 팔꿈치 → 장대를 잡은 손. 걸을 때는 장대와 함께 움직인다.
  const handY = body(23.4);
  K.limb([[16.6, body(20), 1.55], [19.4, body(25.2), 1.35]], R.shirtRed);
  K.limb([[19.4, body(25.2), 1.15], [22.6, handY + 0.2, 1.05]], R.skin);
  K.ball(24.0, handY, 2.0, 2.2, R.skin); // 큰 손 (장대를 쥠)
  K.innerLines();

  // 머리(손으로 찍은 격자). 상체와 같은 정수 px만큼 내린다.
  const [x0, y0, rows, over] = HEAD;
  const headPart = K.part(R.skin);
  K.stamp(x0, y0 + p.chest, rows, HL, headPart);
  for (const [dx, dy, r] of over) K.stamp(x0 + dx, y0 + p.chest + dy, r, HL);

  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  K.stamp(...P(14.3, body(18.6)), ['W..W', 'WW.W'], { W: C.white }); // 셔츠 깃
  K.stamp(...P(16.2, body(22.3)), ['AAA', 'AWA'], { A: C.aqua, W: C.tealM }); // 직원 명찰
  K.stamp(...P(23.1, handY - 1.3), ['.S.', 'S.S'], { S: C.wood }); // 손가락
  K.outline();
  return { K, feet, grip: P(24.0, handY) };
}

export const SHEET = {
  name: 'jjuk-base',
  character: 'jjuk',
  // 걸음 주기(px): 쭉이 36 = 걸음폭 18 × 2 (ADR-0007 결정 5)
  walkCycle: 36,
  anims: [
    { name: 'idle', frames: 2, ms: [700, 500] },
    { name: 'walk', frames: 6, by: 'distance' },
  ],
  pose,
  drawFrame,
};
