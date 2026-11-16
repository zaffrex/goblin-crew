// 쭉이 기본 시트 — 새 밀도 (#142, 사장님 결정 11/16 "세 사람 그림도 같이 더", #156 OK "우스꽝스러운게 좋아").
// 엔진 시트(public/sprites/jjuk-base.*)의 원본이다(art/build.mjs). 옛 쭉이 jjuk.mjs(#114)는 비교 미리보기용으로만 남긴다.
//
// #156 리뷰 반영(시트 교체 때): 지나가는 칸(걷기 1·4번) 다리 뭉침 → 뒷발 들림 2.6 → 1.2, 골반은 상체 출렁임의 절반만 내려간다.
//   서 있기 1번(내쉬기)은 입을 다문다(두 칸 모두 입 벌림이던 것).
// 칸 48×64, 시트 이름·애니 이름·walkCycle은 jjuk.mjs와 같다 → #150 엔진 연결은 json·png 교체만으로 붙는다.
//
// jjuk.mjs(#114)에서 바꾼 것 (PM 지적 3가지, #142 코멘트)
//   1. 과장: 크고 처진 코, 앞니 하나 튀어나온 웃음, 높이 올라간 눈썹, 바람에 뻗친 머리(정수리 한 가닥), 큰 귀.
//      키다리라 바지가 짧다(복사뼈 위) → 빨강·흰 줄무늬 양말이 보인다. 신발은 앞코가 긴 운동화(밑창 줄).
//   2. 움직임: 걷기 출렁임 3px(상체 1~4px 내림, 전에는 0~2px), 상체가 앞으로 기운다. 머리 가닥과 장대는 몸보다 한 프레임 늦게 따라온다
//      (뒤따름). 장대 끝 집게는 걸음마다 앞뒤로 1px 흔들린다. 뒷손은 흔들림 방향마다 다른 손 모양.
//   3. 마감: 바깥 외곽선은 ink 유지(ADR-0007 결정 3-1 "검은 테두리 = 만질 수 있음"). 대신 안쪽 경계선을 부품 색별로
//      (피부 → 진갈색, 셔츠 → 진빨강, 바지 → plum) 바꾸고, 외곽선 바로 안쪽 어두운 쪽(오른쪽·아래)을 한 단 내려
//      명암을 3~4단으로 만든다. 손은 손가락이 보이게 격자로 찍는다.

import { Canvas, C, EMPTY } from '../lib/pixel.mjs';
import { colorLines, rimShade, soles } from '../lib/finish.mjs';
import { squash } from '../lib/squash.mjs';
import { drops, puff, shadow, streaks } from '../lib/fx.mjs';

export const CELL = [48, 64];
const S = 4 / 3;
const OX = 2.6;
const u = (px) => px / S;

// 명암 단계(어두운 쪽 → 밝은 쪽). pixel.mjs의 R보다 한 단씩 넓다(같은 보송 32색 안에서).
const R4 = {
  skin: [C.wood, C.woodL, C.tan, C.tan],
  shirt: [C.redD, C.red, C.red, C.redL],
  stripe: [C.lint, C.cotton, C.white, C.white],
  pants: [C.plum, C.dusk, C.dusk, C.lav],
  sock: [C.lint, C.cotton, C.white],
  sockRed: [C.redD, C.red, C.redL],
  shoe: [C.ink, C.woodD, C.wood, C.woodL],
  metal: [C.dusk, C.lav, C.lint, C.white],
};
// 안쪽 경계선 색: 뒤에 있는 부품의 "선 색". ramp 첫 색으로 찾는다.
const LINE = new Map([
  [C.wood, C.woodD], // 피부
  [C.redD, C.plum], // 셔츠
  [C.lint, C.lav], // 줄무늬·양말
  [C.plum, C.ink], // 바지
  [C.ink, C.ink], // 신발
  [C.dusk, C.plum], // 장대
]);
// 외곽선 안쪽 한 단 내리기(어두운 쪽): 색 → 한 단 어두운 색. 같은 부품 안에서만 의미 있는 쌍만 둔다.
const DOWN = new Map([
  [C.tan, C.woodL], [C.woodL, C.wood],
  [C.redL, C.red], [C.red, C.redD],
  [C.white, C.cotton], [C.cotton, C.lint],
  [C.lav, C.dusk], [C.dusk, C.plum],
  [C.wood, C.woodD], [C.lint, C.lav],
]);

const THIGH = 7.0;
const SHIN = 6.75;
const HIP_Y = 30;
const ANKLE_Y = 43.5;
const HIP_X = 14.45;
const LEG_DX = { idle: 1.85, walk: 0.5 };
const legDx = (kind, side) => (side === 'back' ? -1 : 1) * LEG_DX[kind];
const STEP_PX = 6;
const CONTACT_PX = 9;
// 지나가는 칸(뒷발이 디딤발 옆을 지날 때) 발 들림(①). #156에서 2.6이라 무릎 아래가 바지 한 덩어리로 뭉쳤다 → 1.2.
const LIFT_PASS = 1.2;
// 걷기 때 골반은 상체 출렁임의 이만큼만 내려간다. 나머지는 몸통이 눌려서 받는다(쭈그려 앉은 다리 방지).
const HIP_BOB = 0.5;

function knee(hx, hy, ax, ay) {
  const dx = ax - hx, dy = ay - hy;
  const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 1e-6);
  const a = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const t = Math.atan2(dy, dx) - a;
  return [hx + THIGH * Math.cos(t), hy + THIGH * Math.sin(t)];
}

function walkAnkle(phase) {
  const p = ((phase % 6) + 6) % 6;
  if (p <= 3) return { x: u(CONTACT_PX - STEP_PX * p), lift: 0, toe: p === 3 };
  const x = -CONTACT_PX + (2 * CONTACT_PX * (p - 3)) / 3;
  return { x: u(x), lift: p === 4 ? LIFT_PASS : 1.5, toe: false };
}

// 걷기 출렁임(② px, 상체가 내려가는 양). 0 = 딛기(다리 벌어짐), 1 = 내려앉기(가장 낮음), 2 = 올라서기(가장 높음).
// 무릎을 살짝 굽힌 채 걷는 덜렁이 걸음이라 가장 높을 때도 서 있기보다 1px 낮다.
const BOB = [3, 4, 1, 3, 4, 1];
// 머리 가닥·장대가 따라오는 양: 몸 출렁임을 한 프레임 늦게 받는다.
const lag = (arr, k) => arr[(k + 5) % 6];

export function pose(kind, k) {
  if (POSES[kind]) return POSES[kind](k);
  if (kind === 'idle') {
    return {
      chest: k, // 숨 들이쉬기 / 내쉬기
      hipDrop: 0, // 숨쉬기는 상체만
      lean: 0,
      legs: { back: { x: -2.05, lift: 0, toe: false }, front: { x: 2.4, lift: 0, toe: false } },
      armSwing: 0,
      pole: 'ground',
      poleDy: 0,
      poleTilt: 0,
      mouth: k === 0 ? 'open' : 'shut', // 내쉴 때 입을 다문다(#156 리뷰: 서 있기 두 칸 모두 입 벌림)
      tuft: k === 0 ? 2 : 1, // 칸 맨 윗줄(0행)엔 외곽선을 못 달아서 들이쉴 때는 눌린 가닥, 내쉴 때 처진 가닥
      legDx: { back: legDx('idle', 'back'), front: legDx('idle', 'front') },
    };
  }
  const front = walkAnkle(k);
  const back = walkAnkle(k + 3);
  let need = 0;
  for (const a of [back, front]) {
    if (a.lift > 0) continue;
    const reach = (THIGH + SHIN) * 0.985;
    need = Math.max(need, ANKLE_Y - Math.sqrt(Math.max(0, reach * reach - a.x * a.x)) - HIP_Y);
  }
  const chest = Math.max(BOB[k], Math.ceil(need * S));
  return {
    chest,
    hipDrop: Math.max(need, u(chest) * HIP_BOB), // 벌린 다리가 바닥에 닿을 만큼은 꼭 내려간다
    mouth: 'open',
    lean: 1, // 상체·머리가 앞으로 1px
    legs: { back, front },
    armSwing: front.x / u(CONTACT_PX),
    pole: 'carry',
    poleDy: lag(BOB, k), // 장대는 손보다 한 프레임 늦게 오르내린다
    poleTilt: k % 3 === 1 ? 1 : k % 3 === 2 ? -1 : 0, // 내려앉을 때 앞으로, 올라설 때 뒤로
    tuft: lag(BOB, k) - 1, // 가닥은 몸이 내려간 다음 프레임에 처진다
    legDx: { back: legDx('walk', 'back'), front: legDx('walk', 'front') },
  };
}

// ── 머리 (② 좌표 격자, 오른쪽을 본다). 22×23 + 코가 오른쪽으로 튀어나온다.
// X plum(머리 그늘) H woodD(머리) h wood(머리 결) j woodL(머리 빛)
// D woodD(피부 선) d wood(피부 그늘) s woodL(피부) t tan(피부 빛)
// W white l lint(흰자 그늘) P ink(눈동자) B plum(눈썹) m redD(입술 선) k ink(입 안) T white(이) r red(혀) c pink(볼)
const HL = {
  X: C.woodD, x: C.plum, H: C.woodD, h: C.wood, j: C.woodL,
  D: C.wood, d: C.woodL, s: C.tan, t: C.yelL,
  W: C.white, l: C.lint, P: C.ink, B: C.plum, m: C.redD, k: C.ink, T: C.white, r: C.red, c: C.pink,
};
const HEAD_OPEN = [
  '.....XHHHH.HHH........',
  '...XHHHhhHHHHhHH......',
  '.XHHhjHHHHHHHHHhHHH...',
  'XHHhHHHHHHHHHHHHHHHHH.',
  'XHHHHHHHHHHsHHHHHsHHH.',
  'XHHHHHHHHtssstHHtsssH.',
  'XHHHHHHHtBBBBstBBBBsH.',
  'XHHHhHHDsssssssssssss.',
  'XHHHhHHDsWWWWssWWWWss.',
  'XHHdsdHDWWWPPWWWWPPWs.',
  'XHdsDdsDWWWPPWlWWPPWs.',
  'XHdsDdsdslWWlsslWWlss.',
  '.xHdsdsssssssssssssss.',
  '..xHddscccsssssssss...',
  '...xdssssmmmmmmmmm....',
  '....dssssmkkTkkkkkm...',
  '....ddssssmkkrrkkm....',
  '.....ddsssmmmmmmm.....',
  '......ddssssssssd.....',
  '........dddddddd......',
];
// 입 다문 얼굴(서 있기 1번): 14~17행만 바꾼다. 입꼬리는 올라가고 튀어나온 앞니 하나는 입술 아래로 그대로 보인다.
const MOUTH_SHUT = [
  '...xdsssmssssssssm....',
  '....dssssmmmmmmmm.....',
  '....ddssssssTsssss....',
  '.....ddssssssssss.....',
];
const HEAD = {
  open: HEAD_OPEN,
  shut: [...HEAD_OPEN.slice(0, 14), ...MOUTH_SHUT, ...HEAD_OPEN.slice(18)],
};
// 코: 크고 처져서 얼굴 밖으로 튀어나온다(가장 웃긴 곳). 먼 쪽 눈 아래에서 시작한다. 머리 왼쪽 위 기준 위치.
const NOSE = [16, 11, [
  '..ttss..',
  '.tsssss.',
  'tssssssd',
  'tsssssdd',
  '.sssssdd',
  '.dsssdD.',
  '..DDDD..',
]];
// 정수리 가닥: 뒤따름으로 0(뻗침) / 1(처짐) / 2(눌림) 세 모양
const TUFT = [
  ['.HHj..', 'HHh...'],
  ['..HHH.', 'HHHh..'],
  ['......', 'HHHHh.'],
];const HEAD_X = 13, HEAD_Y = 1;
/** 머리 박스(② 칸 좌표, 서 있기 0번 기준). UI 초상화가 24×24로 자른다. */
export const HEAD_BOX = [HEAD_X, 0, 24, 24];

// 손 격자. s woodL t tan d wood D woodD(손가락 사이 선)
const HAND = { s: C.tan, t: C.yelL, d: C.woodL, D: C.wood };
// 장대를 쥔 앞손: 엄지가 위, 손가락 네 마디가 장대 앞을 감싼다. 가운데 열이 장대 축.
const GRIP = ['.tts..', 'tsssd.', 'DDDDsd', 'tssssd', 'DDDDsd', 'tssssd', '.dddd.'];
// 뒷손: 흔들림 방향마다 모양이 다르다(앞으로 / 가운데 / 뒤로)
const BACK_HAND = {
  fwd: ['.ts..', 'tssd.', 'sssdd', 'sDsDd', '.sDd.'],
  mid: ['.ts.', 'tssd', 'ssds', 'sDsd', 'sDsd', '.dd.'],
  back: ['..ts.', '.tssd', 'tssdd', 'sDsDd', '.dDd.'],
};

function drawLeg(K, side, hx, hy, a, bias) {
  const ax = HIP_X + a.x;
  const ay = ANKLE_Y - a.lift;
  const [kx, ky] = knee(hx, hy, ax, ay);
  const thick = side === 'front' ? [1.7, 1.5, 1.45] : [1.6, 1.4, 1.35];
  // 짧은 바지: 정강이 2/3 지점에서 끝나고(접어 올린 단) 그 아래는 줄무늬 양말
  const cx = kx + (ax - kx) * 0.38, cy = ky + (ay - ky) * 0.38;
  K.limb([[hx, hy, thick[0]], [kx, ky, thick[1]], [cx, cy, thick[2]]], R4.pants, { bias });
  const sock = K.limb([[cx, cy, 0.95], [ax, ay, 0.95]], R4.sock, {
    bias,
    pattern: (x, y) => (Math.floor(y * S) % 2 === 0 ? R4.sockRed : undefined),
  });
  K.limb([[cx - 0.1, cy - 0.15, 1.6], [cx + (ax - cx) * 0.08, cy + (ay - cy) * 0.08, 1.55]], R4.pants, { bias: bias + 0.1 }); // 접은 단
  const fr = side === 'front' ? [4.6, 2.0] : [3.8, 1.9];
  const fx = ax + (side === 'front' ? 2.3 : 1.3) + (a.toe ? 0.8 : 0);
  const fy = ay + 2.3 - (a.toe ? 0.5 : 0);
  const shoe = K.ball(fx, fy, fr[0], a.toe ? fr[1] * 0.8 : fr[1], R4.shoe, { bias: bias + 0.15 });
  return { shoe, sock };
}

export function drawFrame(p) {
  if (p.kind === 'pose') return drawPose(p);
  if (p.kind === 'zip') return drawZip(p);
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  const d = u(p.chest);
  const hipY = HIP_Y + p.hipDrop; // 걷기: 골반도 내려감(상체보다 덜, HIP_BOB) / 서 있기(숨쉬기): 상체만
  const lean = u(p.lean);
  const body = (y) => y + d;
  // 상체 기울기: 위로 갈수록 앞으로(① 좌표 y 14에서 lean, 골반에서 0)
  const bx = (x, y) => x + lean * Math.max(0, Math.min(1, (hipY - y) / (hipY - 14)));

  // 장대: 서 있을 때 땅을 짚고, 걸을 때는 손과 한 프레임 늦게 출렁인다. 장대는 곧게 두고(ADR-0003) 끝의 집게만 앞뒤로 1px 흔들린다.
  const pd = u(p.poleDy);
  const poleTop = p.pole === 'ground' ? 5 : 5 + pd;
  const poleBot = p.pole === 'ground' ? 45.5 : 45.5 + pd - 3.0;
  const px = 24.2 + (p.pole === 'ground' ? 0 : lean);
  const tilt = u(p.poleTilt);
  const pole = K.limb([[px, poleTop, 0.95], [px, poleBot, 0.95]], R4.metal); // 마디는 마감 전에 poleJoints가 찍는다
  // 집게 갈고리(장대 끝): 금속 4단, 걸을 때 1px 흔들린다
  {
    const hx = Math.round(K.X(px + tilt - 1.6)), hy = Math.round(K.Y(poleTop - 4.4));
    K.stamp(hx, hy, [
      '.LLLD.',
      'L....D',
      'L...LD',
      '.D..D.',
      '..LD..',
      '..LD..',
      '..dD..',
    ], { L: C.lint, D: C.dusk, d: C.plum }, pole);
  }

  const feet = [];
  // 뒷다리
  {
    const r = drawLeg(K, 'back', HIP_X + p.legDx.back, hipY, p.legs.back, -0.35);
    feet.push(r.shoe);
  }
  // 뒷팔 + 뒷손
  let backHand;
  {
    const sw = p.armSwing * 0.55;
    const [sx, sy] = [bx(13, body(20)), body(20)];
    const up = 6.7, lo = 6.0;
    const a0 = Math.atan2(26.5 - 20, 11.2 - 13) - sw;
    const ex = sx + up * Math.cos(a0), ey = sy + up * Math.sin(a0);
    const a1 = a0 - sw * 0.6;
    const wx = ex + lo * Math.cos(a1), wy = ey + lo * Math.sin(a1);
    K.limb([[sx, sy, 1.6], [sx + (ex - sx) * 0.45, sy + (ey - sy) * 0.45, 1.45]], R4.shirt, {
      bias: -0.3,
      pattern: (x, y) => (Math.floor(y * S) % 4 < 2 ? R4.stripe : undefined),
    });
    K.limb([[sx + (ex - sx) * 0.4, sy + (ey - sy) * 0.4, 0.95], [ex, ey, 0.95], [wx, wy, 0.9]], R4.skin, { bias: -0.3 });
    const kind = p.armSwing > 0.35 ? 'fwd' : p.armSwing < -0.35 ? 'back' : 'mid';
    backHand = { kind, at: [Math.round(K.X(wx)) - 2, Math.round(K.Y(wy)) - 1] };
  }
  // 앞다리
  {
    const r = drawLeg(K, 'front', HIP_X + p.legDx.front, hipY, p.legs.front, 0);
    feet.push(r.shoe);
  }
  // 몸통: 줄무늬 셔츠, 앞으로 구부정. 뒤쪽 셔츠 자락이 빠져나와 있다(덜렁이).
  K.limb([[bx(15.2, body(19.5)), body(19.5), 3.4], [bx(14.8, body(25)), body(25), 3.6], [14.6, hipY, 3.4]], R4.shirt, {
    pattern: (x, y) => {
      const yy = Math.round((y - d) * S); // 몸 기준 y(② px)
      return yy % 4 < 2 && yy > 27 ? R4.stripe : undefined;
    },
  });
  // 빠져나온 셔츠 자락(뒤쪽 아래)
  K.limb([[11.6, hipY + 0.2, 1.0], [11.2, hipY + 1.7, 0.9]], R4.shirt, { bias: -0.2 });
  K.limb([[12.6, hipY + 0.6, 0.55], [17.4, hipY + 0.6, 0.55]], R4.shoe, { line: false }); // 허리띠
  // 긴 목 + 목젖
  K.limb([[bx(15.0, body(14)), body(14), 1.1], [bx(15.2, body(18.5)), body(18.5), 1.2]], R4.skin, { bias: -0.15 });
  // 앞팔(장대를 쥔 팔)
  const handY = body(23.4) + (p.pole === 'ground' ? 0 : u(p.poleDy - p.chest));
  K.limb([[bx(16.6, body(20)), body(20), 1.65], [bx(17.8, body(22.3)), body(22.3), 1.45]], R4.shirt, {
    pattern: (x, y) => (Math.floor(y * S) % 4 < 2 ? R4.stripe : undefined),
  });
  K.limb([[bx(17.6, body(22.0)), body(22.0), 0.95], [19.6, body(25.2), 0.95], [px - 1.4, handY + 0.2, 0.9]], R4.skin);
  colorLines(K, LINE);

  // 손: 격자로 찍는다(손가락). 부품 번호를 줘서 바깥 외곽선이 손 모양을 따라간다.
  const handPart = K.part(R4.skin);
  K.stamp(backHand.at[0], backHand.at[1], BACK_HAND[backHand.kind], HAND, handPart);
  const gx = Math.round(K.X(px)) - 3, gy = Math.round(K.Y(handY)) - 3;
  K.stamp(gx, gy, GRIP, HAND, handPart);

  // 머리: 상체와 같은 정수 px만큼 내리고 lean만큼 앞으로
  const hx0 = HEAD_X + p.lean, hy0 = HEAD_Y + p.chest;
  const headPart = K.part(R4.skin);
  const t = TUFT[Math.max(0, Math.min(2, p.tuft))];
  K.stamp(hx0 + 4, hy0 - 1, t, HL, headPart);
  K.stamp(hx0, hy0, HEAD[p.mouth], HL, headPart);
  K.stamp(hx0 + NOSE[0], hy0 + NOSE[1], NOSE[2], HL, headPart);
  // 큰 귀(머리카락 옆으로 나온다)
  K.stamp(hx0 + 3, hy0 + 8, ['.ts', 'tsd', 'sDd', 'sdd', '.d.'], HL, headPart);

  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  // 목젖·셔츠 깃·명찰
  K.stamp(...P(bx(15.4, body(16.8)), body(16.8)), ['t', 'd'], { t: C.tan, d: C.wood });
  K.stamp(...P(bx(14.0, body(18.4)), body(18.4)), ['WW..W', 'cWWWc'], { W: C.white, c: C.lint });
  K.stamp(...P(bx(16.3, body(22.0)), body(22.0)), ['AAA', 'AtA'], { A: C.aqua, t: C.tealM });

  // 외곽선 안쪽 그늘(장대·머리는 이미 손으로 명암을 넣었으니 뺀다)
  rimShade(K, new Set([headPart, handPart, pole]), DOWN);
  poleJoints(K, pole, poleTop);
  soles(K, feet);
  K.outline();
  return { K, feet, grip: P(px, handY) };
}

// ══════════ 화면 1 자세 (#142 "화면 1 자세", 설계 docs/design/screens/magpie_nest.md 7절) ══════════
// 서 있기·걷기(drawFrame)는 바이트 그대로 두고, 자세는 관절 점(① 좌표)을 직접 주는 drawPose로 그린다.
// 부품·색·마감 패스(colorLines → 손·머리 → rimShade → soles → outline)는 drawFrame과 같다.
//   hold        U4 고리에 매달려 버티기(대기). 한 손으로 고리, 다른 손은 장대를 비스듬히 든 채 다리를 허우적. 왼쪽(기둥·둥지)을 본다.
//               손 = 칸 (26,4) → 뒤집어 그리면 고리 손 기준점(형식 기록 7절) (158,100). build.mjs가 검사한다.
//   common.zap  공용 "찌릿". 머리카락이 곤두서고 눈이 점이 된다(2칸 덜덜) → 이를 악물고 움츠림. 합 500ms = 지금 캐릭터 anim busy(TIMING.anim 30틱).

// 얼굴 갈아 끼우기: 눈(8~11행), 눈썹(5~6행), 입(14~17행)
const EYES = {
  squint: [ // 질끈 감은 눈 > <
    'XHHHhHHDsssssssssssss.',
    'XHHdsdHDsPPssssssPPss.',
    'XHdsDdsDsssPPssPPssss.',
    'XHdsDdsdsPPssssssPPss.',
  ],
  up: [ // 위를 올려다봄(둥지): 눈동자가 흰자 윗줄에 붙는다
    'XHHHhHHDsWWPPssWWPPss.',
    'XHHdsdHDWWWPPWWWWPPWs.',
    'XHdsDdsDWWWWWWlWWWWWs.',
    'XHdsDdsdslWWlsslWWlss.',
  ],
  shock: [ // 눈이 커지고 눈동자가 점 하나
    'XHHHhHHDsWWWWssWWWWss.',
    'XHHdsdHDWWWWWWWWWWWWs.',
    'XHdsDdsDWWPWWWlWWPWWs.',
    'XHdsDdsdslWWlsslWWlss.',
  ],
  daze: [ // 어질(납작 뒤): 뒤 눈은 눈꺼풀이 반쯤 내려와 풀리고, 앞 눈은 동그랗게 뜬 채 멍하다
    'XHHHhHHDsssssssWWWWss.',
    'XHHdsdHDsPPPPsWWWWWWs.',
    'XHdsDdsDslWWPssWWPWWs.',
    'XHdsDdsdsslllsslWWlss.',
  ],
};
const BROWS_UP = [ // 놀라서 눈썹이 한 줄 위로
  'XHHHHHHHHBBBBtHtBBBBH.',
  'XHHHHHHHtssssstsssssH.',
];
const MOUTHS = {
  open: HEAD_OPEN.slice(14, 18),
  shut: MOUTH_SHUT,
  grit: [ // 이를 악묾(매달려 버티기, 찌릿 뒤)
    '...xdssssmmmmmmmmm....',
    '....dssssmTkTkTkTkm...',
    '....ddsssmmmmmmmmmm...',
    '.....ddssssssssss.....',
  ],
  ouch: [ // 크게 벌린 비명
    '...xdsssmmmmmmmmmm....',
    '....dsssmkTkkkkkkm....',
    '....ddssmkkrrrrkkm....',
    '.....ddsmmmmmmmmm.....',
  ],
};
// 젖은 앞머리(common.wet): 머리가 이마에 착 달라붙어 눈썹·눈을 가닥으로 덮는다(4~11행). "앞이 안 보여!"
const WET_BANGS = [
  'XHHHHHHHHHHHHHHHHHHHH.',
  'XHHHHHHHHHHHHHHHHHHHH.',
  'XHHHHHHHHhHHHHHhHHHHH.',
  'XHHHhHHDHHhHHHHhHHHHs.',
  'XHHHhHHDHjHhHHjHhHHHs.',
  'XHHdsdHDHsHsHjsHsHjHs.',
  'XHdsDdsDsssHssssHssHs.',
  'XHdsDdsdsssssssssssss.',
];
function face(eyes, mouth, brows) {
  const r = HEAD_OPEN.slice();
  if (brows === 'up') r.splice(5, 2, ...BROWS_UP);
  if (eyes === 'wet') r.splice(4, 8, ...WET_BANGS);
  else if (eyes !== 'open') r.splice(8, 4, ...EYES[eyes]);
  r.splice(14, 4, ...MOUTHS[mouth]);
  for (const row of r) if (row.length !== 22) throw new Error(`[jjuk] 얼굴 줄 길이 ${row.length}: ${row}`);
  return r;
}
// 곤두선 머리(찌릿): 머리 위 3줄. 두 모양을 번갈아 덜덜 떤다.
const SPIKES = [
  ['.H...H...H...H..', '.HH..HH..HH..Hh.', 'HHh.HHh.HHh.HHh.'],
  ['...H...H...H....', '..HH..HH..HH..H.', '.HHh.HHh.HHh.HHh'],
];
// 고리를 쥔 주먹(옆에서, 손가락이 갈고리 끝을 감싼다). 가운데 위가 손 기준점.
const HOOK_FIST = ['.tts.', 'tsssd', 'DDDDd', 'tsssd', 'DDDdd', '.sdd.'];
// 놀라서 쫙 편 손
const SPREAD = ['t.t.t', 'stsds', '.sssd', '..dd.'];
const HAND_ROWS = { ...BACK_HAND, fist: HOOK_FIST, spread: SPREAD, grip: GRIP };

/**
 * 자세 하나 그리기. 좌표는 모두 ① 좌표(칸 px = ① × 4/3 + 2.6).
 * p.head {x, y, eyes, mouth, brows, hair: 0~2 가닥 | 's0'·'s1' 곤두섬} — x·y는 칸 px(머리 왼쪽 위)
 * p.torso [[x,y,r]×3] 어깨 → 허리 → 골반, p.hip [x,y]
 * p.back/p.front 팔 {sh, el, wr} + hand {rows, at: 칸 px 왼쪽 위}
 * p.pole {top:[x,y], bot:[x,y]} 장대(위 끝에 집게), p.legs {back, front}: {x, lift, toe} (drawLeg와 같은 뜻)
 */
function drawPose(p) {
  const oy = p.oy ?? 0; // 몸 전체를 위로 올린다(칸 px, 음수 = 위). 엉덩방아 0번 칸(떨어지는 중)
  const K = new Canvas(CELL[0], CELL[1], S, OX, oy);
  const stripes = (x, y) => (Math.floor(y * S) % 4 < 2 ? R4.stripe : undefined);
  const arm = (a, bias) => {
    const mid = [a.sh[0] + (a.el[0] - a.sh[0]) * 0.5, a.sh[1] + (a.el[1] - a.sh[1]) * 0.5];
    K.limb([[...a.sh, 1.6], [...mid, 1.45]], R4.shirt, { bias, pattern: stripes });
    K.limb([[a.sh[0] + (a.el[0] - a.sh[0]) * 0.4, a.sh[1] + (a.el[1] - a.sh[1]) * 0.4, 0.95], [...a.el, 0.95], [...a.wr, 0.9]], R4.skin, { bias });
  };

  // 장대(맨 뒤): 집게는 위 끝에 선 채로 붙는다
  let pole;
  if (p.pole) {
    const { top, bot } = p.pole;
    pole = K.limb([[...top, 0.95], [...bot, 0.95]], R4.metal); // 마디는 마감 전에 poleJoints가 찍는다
    if (p.pole.claw !== false) {
      const hx = Math.round(K.X(top[0] - 1.6)), hy = Math.round(K.Y(top[1] - 4.4));
      const rows = p.pole.shut // 다문 집게(딸깍, common.stretch 2번)
        ? ['......', '.LLD..', 'L..LD.', '.LLD..', '..LD..', '..LD..', '..dD..']
        : ['.LLLD.', 'L....D', 'L...LD', '.D..D.', '..LD..', '..LD..', '..dD..'];
      K.stamp(hx, hy, rows, { L: C.lint, D: C.dusk, d: C.plum }, pole);
    }
  }
  const feet = [];
  feet.push(drawLeg(K, 'back', p.hip[0] - (p.hipSpread ?? 0.5), p.hip[1], p.legs.back, -0.35).shoe);
  arm(p.back, -0.3);
  feet.push(drawLeg(K, 'front', p.hip[0] + (p.hipSpread ?? 0.5), p.hip[1], p.legs.front, 0).shoe);
  const [t0, t1, t2] = p.torso;
  K.limb([t0, t1, t2], R4.shirt, {
    pattern: (x, y) => (Math.round((y - (t0[1] - 19.5)) * S) % 4 < 2 && y > t0[1] + 0.8 ? R4.stripe : undefined),
  });
  K.limb([[t2[0] - 3.0, t2[1] + 0.2, 1.0], [t2[0] - 3.4, t2[1] + 1.7, 0.9]], R4.shirt, { bias: -0.2 }); // 빠져나온 셔츠 자락
  K.limb([[t2[0] - 2.0, t2[1] + 0.6, 0.55], [t2[0] + 2.8, t2[1] + 0.6, 0.55]], R4.shoe, { line: false }); // 허리띠
  if (p.neck) K.limb([[...p.neck[0], 1.1], [...p.neck[1], 1.2]], R4.skin, { bias: -0.15 });
  arm(p.front, 0);
  colorLines(K, LINE);

  const handPart = K.part(R4.skin);
  for (const h of [p.back.hand, p.front.hand]) K.stamp(h.at[0], h.at[1] + oy, HAND_ROWS[h.rows], HAND, handPart);

  const hx0 = p.head.x, hy0 = p.head.y + oy;
  const headPart = K.part(R4.skin);
  if (typeof p.head.hair === 'number') K.stamp(hx0 + 4, hy0 - 1, TUFT[p.head.hair], HL, headPart);
  else K.stamp(hx0 + 2, hy0 - 3, SPIKES[p.head.hair === 's1' ? 1 : 0], HL, headPart);
  K.stamp(hx0, hy0, face(p.head.eyes, p.head.mouth, p.head.brows), HL, headPart);
  K.stamp(hx0 + NOSE[0], hy0 + NOSE[1], NOSE[2], HL, headPart);
  K.stamp(hx0 + 3, hy0 + 8, ['.ts', 'tsd', 'sDd', 'sdd', '.d.'], HL, headPart);
  // 셔츠 깃·명찰(몸통 위 끝 기준)
  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  K.stamp(...P(t0[0] - 1.2, t0[1] - 1.1), ['WW..W', 'cWWWc'], { W: C.white, c: C.lint });
  K.stamp(...P(t0[0] + 1.1, t0[1] + 2.5), ['AAA', 'AtA'], { A: C.aqua, t: C.tealM });

  rimShade(K, new Set([headPart, handPart, ...(pole === undefined ? [] : [pole])]), DOWN);
  const joint = pole === undefined ? undefined : poleJoints(K, pole, p.pole.top[1]);
  soles(K, feet);
  // 납작(common.flatten): 눈(8~11행)과 입(14~17행)은 누르지 않고 그대로 옮긴다
  if (p.flat) squash(K, { ...p.flat, keep: [[hy0 + 8, hy0 + 11], [hy0 + 14, hy0 + 17]] });
  K.outline();
  if (p.fx) p.fx(K); // 먼지·속도선: 외곽선 없이(ADR-0007 결정 3-1, 검은 테두리 = 만질 수 있음)
  return { K, feet, hand: p.hand, facing: p.facing, tip: p.pole?.claw === false ? poleTip(K, pole) : undefined, joint: p.pole?.claw === false ? joint : undefined, claw: p.claw };
}

/**
 * 장대 마디(ADR-0007 "장대 3조각": 마디 이음매 한 주기 = 8px, #194). 장대 위 끝(집게가 붙는 점, ① y `topY`) 행에서
 * 8px마다 한 행을, 장대 부품의 잉크 아닌 픽셀만 dusk로 칠한다(`#dd#`). 손·머리처럼 장대 앞에 그린 부품은 건드리지 않는다.
 * 첫 마디는 위 끝에서 8px 아래다(집게 7행을 피한다). 마감(soles·squash·outline) 전에 불러서 납작 자세는 마디도 같이 눌린다.
 * 돌려주는 값 = 위상: 칸 0행부터 아래로 첫 마디 행까지 px(0~7). 칸 위로 나가는 장대(tip)는 엔진이 이 위상으로
 * 이은 구간에도 8px마다 마디를 찍는다(메타 `joint`, 파이프라인 기록 5-1절).
 */
export const POLE_JOINT = 8;
function poleJoints(K, pole, topY) {
  const top = Math.round(K.Y(topY));
  for (let y = top + POLE_JOINT; y < K.h; y += POLE_JOINT) {
    if (y < 0) continue;
    for (let x = 0; x < K.w; x++) {
      const i = y * K.w + x;
      if (K.p[i] === pole && K.c[i] !== C.ink && K.c[i] !== EMPTY) K.c[i] = C.dusk;
    }
  }
  return ((top % POLE_JOINT) + POLE_JOINT) % POLE_JOINT;
}

/** 칸 위로 나가는 장대의 출구(칸 px, 0행 장대 픽셀 가운데). 엔진이 여기서 대상 점까지 장대를 잇는다(#187 Theo 초안). */
function poleTip(K, pole) {
  const xs = [];
  for (let x = 0; x < K.w; x++) if (K.p[x] === pole && K.c[x] !== C.ink) xs.push(x);
  if (!xs.length) throw new Error('[jjuk] 장대가 칸 위로 나가지 않는다(claw: false인데 0행에 장대 없음)');
  return [Math.round((xs[0] + xs[xs.length - 1]) / 2), 0];
}

// 손 stamp 왼쪽 위(칸 px): 손목 점에서 손 크기만큼
const handAt = (wr, dx, dy) => [Math.round(wr[0] * S + OX) + dx, Math.round(wr[1] * S) + dy];

// 고리 손 기준점(칸 px, 오른쪽을 본 시트 좌표). 주먹 HOOK_FIST를 (24,1)에 찍으면 가운데 위가 여기다.
// 매달린 쭉이는 **왼쪽(기둥·둥지 쪽)을 본다**(HOLD_FACING). 엔진이 뒤집어 그리면 손이 칸 47 − 26 = 21열 → 화면 137 + 21 = 158.
export const HOLD_HAND = [26, 4];
export const HOLD_FACING = -1;

const POSES = {
  // U4 매달려 버티기: 어깨가 귀까지 올라붙고(머리가 어깨 사이로), 다리는 두 박자로 허우적
  hold(k) {
    const sway = k === 0 ? 0 : -0.4; // 버둥거리면 몸통이 반대로 살짝 흔들린다
    const wr = [17.4, 5.9];
    const fwr = [21.0 + sway, 29.6];
    return {
      kind: 'pose',
      chest: 9,
      head: { x: 13, y: 10, eyes: 'squint', mouth: 'grit', hair: k === 0 ? 1 : 0 },
      torso: [[15.0 + sway, 23.2, 3.4], [14.8 + sway, 28.4, 3.6], [14.6 + sway, 33.4, 3.4]],
      hip: [14.45 + sway, 33.4],
      back: { sh: [12.8, 23.6], el: [6.0, 15.4], wr, hand: { rows: 'fist', at: [24, 1] } },
      front: { sh: [16.8 + sway, 23.8], el: [19.4 + sway, 27.6], wr: fwr, hand: { rows: 'grip', at: handAt(fwr, -2, -3) } },
      pole: { top: [30.6, 9.0], bot: [19.2 + sway, 37.0] },
      legs: k === 0
        ? { back: { x: -1.0, lift: 0, toe: false }, front: { x: 3.4, lift: 3.4, toe: true } }
        : { back: { x: 2.6, lift: 3.2, toe: true }, front: { x: -0.4, lift: 0, toe: false } },
      hand: HOLD_HAND,
      facing: HOLD_FACING,
    };
  },
  // 찌릿: 0·1 덜덜(1px 좌우), 2 이를 악물고 움츠림
  'common.zap'(k) {
    const j = k === 1 ? 0.75 : 0; // 덜덜(① 0.75 = 칸 1px)
    const d = k === 2 ? 1.5 : 2.25; // 몸이 움찔 내려앉는다
    const body = (y) => y + d;
    const fwr = [22.8 + j, body(23.4)];
    const zapped = k < 2;
    return {
      kind: 'pose',
      chest: Math.round(d * S),
      head: zapped
        ? { x: 13 + Math.round(j * S), y: 4, eyes: 'shock', mouth: 'ouch', brows: 'up', hair: k === 0 ? 's0' : 's1' }
        : { x: 13, y: 3, eyes: 'squint', mouth: 'grit', hair: 0 },
      neck: [[15.0 + j, body(14)], [15.2 + j, body(18.5)]],
      torso: [[15.2 + j, body(19.5), 3.4], [14.8 + j, body(25), 3.6], [14.6, 30 + d * 0.5, 3.4]],
      hip: [14.45, 30 + d * 0.5],
      hipSpread: 1.85, // 서 있기와 같은 다리 벌림
      back: zapped
        ? { sh: [13 + j, body(20)], el: [9.6 + j, body(23.6) - k], wr: [7.4 + j, body(26.4) - 2 * k], hand: { rows: 'spread', at: handAt([7.4 + j, body(26.4) - 2 * k], -3, -1) } }
        : { sh: [13, body(20)], el: [12.0, body(26.4)], wr: [12.4, body(31.8)], hand: { rows: 'mid', at: handAt([12.4, body(31.8)], -2, -1) } },
      front: { sh: [16.6 + j, body(20)], el: [19.6 + j, body(25.2)], wr: fwr, hand: { rows: 'grip', at: handAt([24.2 + j, fwr[1]], -3, -3) } },
      pole: zapped ? { top: [24.2 + j, 4.8], bot: [24.2 + j, 44.0] } : { top: [24.2, 5], bot: [24.2, 45.5] },
      legs: { back: { x: -2.05, lift: 0, toe: false }, front: { x: 2.4, lift: 0, toe: false } },
    };
  },
  // common.flatten  공용 "납작"(묵직이 mukjik.mjs와 같은 박자, art/lib/squash.mjs). 찌릿 2번(움츠림) 몸을 바닥 기준으로 누른다.
  //   0 꽝(반쯤, 비명) → 1 납작(가장 눌림, 장대도 접힌 것처럼 눌림, 먼지) → 2 뿅(가늘게, 머리가 곤두섬) → 3 어질(헤벌쭉 + 한 눈 풀림).
  //   쭉이는 몸이 가늘어서 셋 중 가장 옆으로 퍼진다. 마지막 칸 어질은 낙천적인 쭉이답게 웃는 입이다(묵직이는 혀, 삑삑이는 덜덜).
  'common.flatten'(k) {
    const base = POSES['common.zap'](2);
    return {
      ...base,
      head: [
        { x: 13, y: 3, eyes: 'squint', mouth: 'ouch', hair: 0 },
        { x: 13, y: 3, eyes: 'squint', mouth: 'ouch', hair: 0 },
        { x: 13, y: 3, eyes: 'shock', mouth: 'ouch', brows: 'up', hair: 's0' },
        { x: 13, y: 3, eyes: 'daze', mouth: 'open', hair: 1 },
      ][k],
      flat: [{ sx: 1.45, sy: 0.55 }, { sx: 1.6, sy: 0.36 }, { sx: 0.85, sy: 1.08 }, undefined][k],
      fx: [undefined, (K) => { puff(K, 7, 0, { behind: true }); puff(K, 41, 0, { behind: true }); }, (K) => puff(K, 24, 2, { behind: true }), undefined][k],
    };
  },
};

// U2 발사 → 고리(launch_to_hook): 시소 왼쪽 끝 자리에서 재생된다(step은 연출을 먼저, 자리 이동을 뒤에 낸다).
//   엔진에 날아가는 궤적이 없어서(teleport) "꾹 눌림 → 튕겨 솟음 → 속도선만 남고 사라짐 → 먼지" 네 칸으로 자리를 비운 뒤
//   고리에서 hold로 나타난다. 칸 위로 잘린 몸이 화면 가운데에 보이지 않게, 몸은 칸 안에서만 움직이고 사라지는 칸은 속도선뿐이다.
//   방향을 고정하지 않는다(시소에 어느 쪽에서 왔든 위로 솟는다).
// U3 매달려 뻗어 열쇠 집기(reach_hang_up): 고리에 매달린 채(hold 자리, facing −1 고정) 재생된다.
//   주먹은 hold와 같은 (26,4) → 고리에서 안 미끄러진다(build.mjs가 hand를 hold와 같이 적는다).
//   장대는 앞손에서 칸 33·34열(2px)로 곧게 위로(ADR-0003 직선) 칸 위까지. 뒤집으면 화면 150·151열이라 가운데선은 x 151이다.
//   엔진은 tip x에서 수직으로 대상 점 y까지 잇고 대상 점 x는 쓰지 않는다(#188 Theo 리뷰 1). 둥지 reachPoint 150과 1px 차이는 집게 8px 안이다.
//   칸 위 46px(칸 위 끝 y 96 → 둥지 34)는 엔진이 tip에서 이어 그린다. 집게는 claw(0 벌림 / 1 다묾) 칸.
//   마지막 칸은 열쇠를 문 집게를 확 당기는 모습(형식 기록 4-2절 (b): 열쇠는 이 연출이 끝날 때 둥지에서 빠진다).
const REACH_X = (34 - OX) / S; // 장대 축(① 좌표) = 칸 34열
Object.assign(POSES, {
  launch_to_hook(k) {
    if (k === 0) {
      // 꾹: 널빤지가 눌린 반동에 무릎이 꺾이고 몸이 깊게 접힌다. 눈이 커지고 뒷손은 쫙.
      const d = 4.2;
      const body = (y) => y + d;
      const fwr = [22.8, body(23.2)];
      return {
        kind: 'pose',
        chest: Math.round(d * S),
        head: { x: 14, y: 1 + Math.round(d * S), eyes: 'shock', mouth: 'grit', brows: 'up', hair: 's0' },
        neck: [[15.4, body(14)], [15.4, body(18.5)]],
        torso: [[15.6, body(19.5), 3.4], [15.0, body(25), 3.7], [14.4, 30 + d * 0.8, 3.5]],
        hip: [14.45, 30 + d * 0.8],
        hipSpread: 2.4,
        back: { sh: [13.2, body(20)], el: [9.4, body(23.0)], wr: [6.6, body(25.4)], hand: { rows: 'spread', at: handAt([6.6, body(25.4)], -3, -1) } },
        front: { sh: [16.8, body(20)], el: [19.8, body(24.6)], wr: fwr, hand: { rows: 'grip', at: handAt([24.2, fwr[1]], -3, -3) } },
        pole: { top: [24.2, 5 + d], bot: [24.2, 45.5] },
        legs: { back: { x: -3.2, lift: 0, toe: false }, front: { x: 3.6, lift: 0, toe: false } },
        fx: (K) => puff(K, 9, 0),
      };
    }
    if (k === 1) {
      // 튕겨 솟음: 몸은 위로 다 펴지고 팔다리는 뒤처져 아래로 늘어진다(날아오르는 쪽은 머리). 입은 비명, 머리는 곤두섬.
      // 장대는 앞손에 매달려 아래로. 발밑에 먼지가 터진다.
      const up = 2.25;
      const body = (y) => y + up;
      const fwr = [20.6, body(30.6)];
      return {
        kind: 'pose',
        chest: 0,
        head: { x: 13, y: 1 + Math.round(up * S), eyes: 'shock', mouth: 'ouch', brows: 'up', hair: 's1' },
        neck: [[15.0, body(14)], [15.0, body(18.5)]],
        torso: [[15.0, body(19.5), 3.2], [14.8, body(25), 3.4], [14.6, 30 + up, 3.2]],
        hip: [14.6, 30 + up],
        hipSpread: 0.6,
        back: { sh: [12.8, body(20)], el: [10.4, body(25.8)], wr: [9.2, body(31.4)], hand: { rows: 'spread', at: handAt([9.2, body(31.4)], -3, -1) } },
        front: { sh: [16.6, body(20)], el: [19.0, body(25.4)], wr: fwr, hand: { rows: 'grip', at: handAt([22.4, fwr[1]], -3, -3) } },
        pole: { top: [22.4, body(13.0)], bot: [22.4, 44.6] },
        legs: { back: { x: -0.6, lift: 0.9, toe: true }, front: { x: 1.0, lift: 0.6, toe: true } },
        fx: (K) => puff(K, 24, 1),
      };
    }
    // 2 사라짐: 몸은 이미 칸 위로. 위로 갈수록 진한 속도선 + 먼지 / 3 먼지가 흩어진다
    return { kind: 'zip', chest: 0, k };
  },
  reach_hang_up(k) {
    const base = POSES.hold(k === 1 ? 1 : 0);
    const yank = k === 2 ? 2.4 : 0; // 마지막 칸: 장대를 확 당겨 손이 내려온다
    const fwr = [REACH_X, 13.4 + yank];
    const sway = k === 0 ? 0.3 : k === 2 ? -0.3 : 0;
    return {
      ...base,
      head: [
        { x: 10, y: 10, eyes: 'squint', mouth: 'grit', hair: 0 }, // 끙: 이를 악물고 뻗기
        { x: 10, y: 10, eyes: 'up', mouth: 'shut', hair: 1 }, // 집게가 닿았나 올려다봄
        { x: 10, y: 9, eyes: 'up', mouth: 'open', brows: 'up', hair: 0 }, // 잡았다!
      ][k],
      torso: base.torso.map(([x, y, r]) => [x + sway, y, r]),
      hip: [base.hip[0] + sway, base.hip[1]],
      front: {
        sh: [16.8 + sway, 23.8],
        el: k === 2 ? [21.4, 21.4] : [20.4, 18.8],
        wr: fwr,
        hand: { rows: 'grip', at: handAt(fwr, -2, -3) },
      },
      pole: { top: [REACH_X, -4], bot: [REACH_X, fwr[1] + 12.5], claw: false },
      claw: k === 0 ? 0 : 1,
    };
  },
});

// common.bump_bottom  공용 "엉덩방아"(삑삑이 ppik.mjs와 같은 박자). 고리에서 손 놓기(3번, 바구니 착지 점)와 반대쪽 발사(14번)에서 나온다.
//   엔진에 떨어지는 궤적이 없어서(release = 순간 배치) 0번 칸이 "위에서 앉은 자세로 떨어지는 중"을 맡는다.
//   쭉이는 키가 칸을 다 써서 선 채로는 위로 못 올린다 → 앉은 몸(44행 높이)을 통째로 올린다(oy).
//   0 낙하(앉은 몸이 칸 위쪽, 두 팔 허우적, 머리 곤두섬, 위로 끊기는 속도선, 착지 자리 그림자)
//   → 1 쿵(엉덩이로 털썩 눌림, 다리가 위로 튀고 팔은 만세, 양옆 먼지) → 2 아야(뒤로 휘청, 뒷손으로 엉덩이 문지름, 이 악묾)
//   → 3 멍(앉은 채 헤벌쭉 + 한 눈 풀림, 장대는 세워 쥠, 뒷손은 바닥을 짚음). 말풍선 동안 3번 칸이 남는다(#193).
//   앉은 몸: 골반 (12.2, 44)이 바닥에, 상체는 서 있기보다 13.9 내려가고 3.6 뒤로. 다리는 앞으로 뻗고 무릎이 살짝 선다.
const SIT_Y = 13.9; // 서 있기 어깨(19.5) → 앉은 어깨(33.4)
const sitHead = (lean, h) => ({ x: 8 + Math.round(lean * S), y: 1 + Math.round(SIT_Y * S), ...h });
function sitPose(o) {
  const ln = o.lean ?? 0; // 뒤로 젖힘(① 좌표, 음수 = 뒤로): 어깨만 움직이고 골반은 바닥에 그대로
  const t0 = [11.6 + ln, 33.4, 3.4], t1 = [11.9 + ln * 0.5, 38.8, 3.6], t2 = [12.2, 44.0, 3.4];
  return {
    kind: 'pose',
    oy: o.oy ?? 0,
    head: sitHead(ln, o.head),
    neck: [[11.4 + ln, 27.9], [11.5 + ln, 32.4]],
    torso: [t0, t1, t2],
    hip: [12.2, 44.0],
    hipSpread: 0.6,
    back: o.back,
    front: o.front,
    pole: o.pole,
    legs: o.legs,
    flat: o.flat,
    fx: o.fx,
  };
}
const SIT_LEGS = { back: { x: 5.6, lift: 0, toe: false }, front: { x: 8.8, lift: 0, toe: false } };
Object.assign(POSES, {
  'common.bump_bottom'(k) {
    if (k === 0) {
      const fwr = [19.2, 27.0];
      return sitPose({
        oy: -16,
        lean: 0.4,
        head: { eyes: 'shock', mouth: 'ouch', brows: 'up', hair: 's1' },
        back: { sh: [10.2, 34.0], el: [6.4, 29.6], wr: [5.0, 25.0], hand: { rows: 'spread', at: handAt([5.0, 25.0], -3, -2) } },
        front: { sh: [13.4, 34.0], el: [17.0, 31.0], wr: fwr, hand: { rows: 'grip', at: handAt([21.4, fwr[1]], -3, -3) } },
        pole: { top: [21.4, 18.0], bot: [21.4, 55.0] }, // 칸 위로 집게가 잘리지 않게 몸보다 아래로 늘어뜨려 쥔다
        legs: { back: { x: 5.0, lift: 1.6, toe: true }, front: { x: 8.2, lift: 2.6, toe: true } },
        fx: (K) => { streaks(K, [[3, 2, 22], [7, 0, 14], [41, 4, 20], [45, 0, 12]], { fall: true }); shadow(K, 26, 22); },
      });
    }
    if (k === 1) {
      const fwr = [19.6, 28.6];
      return sitPose({
        head: { eyes: 'squint', mouth: 'ouch', hair: 's0' },
        back: { sh: [10.2, 34.0], el: [6.2, 30.4], wr: [4.6, 26.4], hand: { rows: 'spread', at: handAt([4.6, 26.4], -3, -2) } },
        front: { sh: [13.4, 34.0], el: [17.2, 31.8], wr: fwr, hand: { rows: 'grip', at: handAt([21.8, fwr[1]], -3, -3) } },
        pole: { top: [21.8, 8.0], bot: [21.8, 46.0] },
        legs: { back: { x: 6.2, lift: 4.6, toe: true }, front: { x: 9.0, lift: 7.0, toe: true } },
        flat: { sx: 1.1, sy: 0.86 },
        fx: (K) => { puff(K, 6, 1, { behind: true }); puff(K, 42, 0, { behind: true }); },
      });
    }
    // 2·3: 장대는 앞손으로 세워 짚는다(비스듬히 걸치면 얼굴을 가로지른다). 서 있기와 같은 실루엣 단서
    const lean = k === 2 ? -1.2 : 0;
    const fwr = [20.4, 37.0];
    return sitPose({
      lean,
      head: k === 2 ? { eyes: 'squint', mouth: 'grit', hair: 1 } : { eyes: 'daze', mouth: 'open', hair: 0 },
      back: k === 2
        ? { sh: [9.6 + lean, 34.2], el: [6.4 + lean, 38.4], wr: [7.4, 42.6], hand: { rows: 'back', at: handAt([7.4, 42.6], -2, -2) } } // 엉덩이 문지르기
        : { sh: [9.8, 34.2], el: [7.4, 38.6], wr: [6.6, 43.2], hand: { rows: 'mid', at: handAt([6.6, 43.2], -2, -1) } }, // 바닥 짚기
      front: { sh: [13.2 + lean, 34.2], el: [16.8 + lean * 0.5, 38.4], wr: fwr, hand: { rows: 'grip', at: handAt([23.4, fwr[1]], -3, -3) } },
      pole: { top: [23.4, 7.5], bot: [23.4, 46.5] },
      legs: k === 2 ? { back: { x: 5.6, lift: 0, toe: false }, front: { x: 9.0, lift: 1.0, toe: true } } : SIT_LEGS,
      fx: k === 2 ? (K) => puff(K, 26, 2, { behind: true }) : undefined,
    });
  },
});

// ── 묶음 ⑤ 쭉이 늘이기 계열 (#142). 셋 다 바닥에 선 채 재생되고 대상 점(reachPoint)까지 장대를 잇지 않는다:
//   stretch는 빨랫대·시소·바구니·까치처럼 대상 점이 없는 곳에서, reach_wobble은 "모자라다"가 핵심이라 둥지까지 이으면 안 된다.
//   그래서 tip 없이 장대와 집게가 칸 안에 다 들어온다(claw는 위 끝 stamp).
const STAND_TORSO = (dx, dy) => [[15.2 + dx, 19.5 + dy, 3.4], [14.8 + dx, 25 + dy, 3.6], [14.6 + dx * 0.4, 30 + dy * 0.6, 3.4]];
const STAND_LEGS = { back: { x: -2.05, lift: 0, toe: false }, front: { x: 2.4, lift: 0, toe: false } };
const TIPTOE = { back: { x: -1.6, lift: 0, toe: true }, front: { x: 2.0, lift: 0, toe: true } };
/** 서 있는 몸 + 앞손이 장대를 쥔 자세. 몸 dx·dy(① 좌표, dy 음수 = 위), 앞팔 el·wr, 장대 top·bot. */
function standPose(o) {
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const body = (y) => y + dy;
  return {
    kind: 'pose',
    chest: 0,
    head: { x: 13 + Math.round(dx * S), y: Math.max(2, 1 + Math.round(dy * S)), ...o.head }, // 까치발(dy<0)에도 y 2 아래로 안 감 = 서 있기 0번처럼 가닥 1행, 외곽선 0행(#218 Theo 리뷰 1)
    neck: [[15.0 + dx, body(14)], [15.2 + dx, body(18.5)]],
    torso: STAND_TORSO(dx, dy),
    hip: [14.45 + dx * 0.4, 30 + dy * 0.6],
    hipSpread: 1.85,
    back: o.back,
    front: { sh: [16.6 + dx, body(20)], el: o.el, wr: o.wr, hand: { rows: 'grip', at: handAt(o.grip ?? o.wr, -3, -3) } },
    pole: o.pole,
    legs: o.legs ?? STAND_LEGS,
    fx: o.fx,
  };
}
/** 장대 위 끝 top에서 손목 wr을 지나 손 아래로 len만큼 내려간 아래 끝. */
const poleThrough = (top, wr, below) => {
  const vx = wr[0] - top[0], vy = wr[1] - top[1], n = Math.hypot(vx, vy);
  return [wr[0] + (vx / n) * below, wr[1] + (vy / n) * below];
};

Object.assign(POSES, {
  // common.stretch  공용 "장대 뻗기"(대상 점 없는 곳). 0 끙(접힌 장대를 가슴 앞에서 겨눔, 무릎 굽힘) → 1 쭉!(까치발, 팔을 앞으로 뻗고
  //   장대가 코 오른쪽으로 칸 위 끝까지, 집게 벌림, 속도선) → 2 딸깍(집게 다묾, 입 다문 웃음).
  //   말풍선 동안 2번 칸이 남는다(#193) = 뻗은 채로 대사("어, 하이파이브? …아니구나").
  //   손은 턱 아래 오른쪽(얼굴을 가리지 않게), 장대는 코(칸 30~38열) 오른쪽을 지나 위로 비스듬히 나간다. 집게는 칸 안에 다 들어온다.
  'common.stretch'(k) {
    if (k === 0) {
      const wr = [22.0, 24.6], top = [29.6, 17.0];
      return standPose({
        dy: 0.8,
        head: { eyes: 'squint', mouth: 'grit', hair: 1 },
        back: { sh: [13, 20.8], el: [10.2, 25.0], wr: [9.4, 29.8], hand: { rows: 'back', at: handAt([9.4, 29.8], -2, -1) } },
        el: [19.0, 27.4], wr, grip: wr,
        pole: { top, bot: poleThrough(top, wr, 3) },
        legs: { back: { x: -2.6, lift: 0, toe: false }, front: { x: 2.9, lift: 0, toe: false } },
      });
    }
    const wr = [27.0, 19.6], top = [30.4, 5.4]; // 위 끝 y 5.4 = 집게(위로 4.4)가 칸 0행 안에, x 30.4 = 벌린 집게 오른쪽 외곽선이 47열 안에 들어오는 한계
    return standPose({
      dx: 0.6,
      dy: -0.6,
      head: k === 1 ? { eyes: 'up', mouth: 'open', brows: 'up', hair: 0 } : { eyes: 'up', mouth: 'shut', hair: 1 },
      back: { sh: [13.4, 19.4], el: [9.6, 21.6], wr: [6.6, 20.0], hand: { rows: 'spread', at: handAt([6.6, 20.0], -3, -2) } }, // 균형 잡는 뒷손
      el: [21.8, 21.6], wr, grip: wr,
      pole: { top, bot: poleThrough(top, wr, 5), shut: k === 2 },
      legs: TIPTOE,
      fx: k === 1 ? (K) => streaks(K, [[47, 10, 20], [39, 2, 8]]) : undefined,
    });
  },
  // common.reach_wobble  "높이가 모자라!": 장대를 곧게 세워 치켜들고 까치발로 버틴다. 위로는 칸 끝까지만(대상까지 안 닿음).
  //   0 쭉(까치발, 집게 벌림) → 1·2 휘청(장대 끝이 왼쪽 / 오른쪽으로 기울고 몸이 따라감) → 3 툭(무릎이 꺾이며 장대가 뒤로 넘어와
  //   집게가 제 정수리를 친다, 별 대신 짧은 충격선). 3번 칸이 말풍선 동안 남는다: 둥지 "높이가 모자라!", 고리 "…아파."(self_smack).
  //   장대는 코 오른쪽(칸 40열 근처)에 세워서 얼굴을 가리지 않는다. 손은 턱 오른쪽.
  'common.reach_wobble'(k) {
    if (k === 3) {
      const d = 3.2; // 무릎 꺾임: 머리가 내려와 칸 위에 집게 자리가 생긴다
      const wr = [24.6, 24.0 + d], top = [17.0, 5.4];
      return standPose({
        dy: d,
        head: { eyes: 'squint', mouth: 'ouch', brows: 'up', hair: 2 },
        back: { sh: [13, 20 + d], el: [11.8, 26.2 + d], wr: [12.2, 31.4 + d], hand: { rows: 'mid', at: handAt([12.2, 31.4 + d], -2, -1) } },
        el: [20.6, 26.6 + d], wr, grip: wr,
        pole: { top, bot: poleThrough(top, wr, 6) },
        legs: { back: { x: -2.6, lift: 0, toe: false }, front: { x: 3.0, lift: 0, toe: false } },
        fx: (K) => streaks(K, [[12, 0, 2], [32, 0, 2], [9, 5, 6], [35, 5, 6]]),
      });
    }
    const sw = [0, -1, 1][k];
    const wr = [27.6 + sw * 0.3, 18.2], top = [28.0 + sw * 1.8, 5.4];
    return standPose({
      dx: 0.8 + sw * 0.4,
      dy: -0.6,
      head: k === 0 ? { eyes: 'up', mouth: 'grit', hair: 0 } : { eyes: 'shock', mouth: 'grit', brows: 'up', hair: k === 1 ? 1 : 0 },
      back: { sh: [13.6 + sw * 0.4, 19.4], el: [9.8 + sw, 22.0], wr: [6.6 + sw * 1.4, 20.6 - k], hand: { rows: 'spread', at: handAt([6.6 + sw * 1.4, 20.6 - k], -3, -2) } },
      el: [22.4 + sw * 0.4, 21.4], wr, grip: wr,
      pole: { top, bot: poleThrough(top, wr, 10) },
      legs: k === 0 ? TIPTOE : { back: { x: -1.6 + sw * 0.6, lift: 0, toe: k !== 1 }, front: { x: 2.0 + sw * 0.6, lift: 0, toe: k !== 2 } },
    });
  },
  // common.wet  공용 "젖음"(빨래·물줄기·연못). 0 철썩(물이 확 덮침, 눈 질끈, 물보라) → 1 흠뻑(앞머리가 눈을 덮고 어깨가 축 처짐, 물이 뚝뚝)
  //   → 2 부르르(몸을 털어 물이 양옆으로 튐) → 3 뚝뚝(여전히 앞머리에 눈이 가려진 채 입만 벌림 = "앞이 안 보여!", 코끝 방울).
  //   장대는 땅을 짚은 채(서 있기와 같은 실루엣 단서).
  'common.wet'(k) {
    const dy = [1.9, 1.8, 1.2, 1.8][k]; // 0번 곤두선 머리(SPIKES, 머리 위 3줄 + 외곽선)가 칸 안에 들어오려면 head y ≥ 4 → dy ≥ 1.9
    const dx = k === 2 ? 0.75 : 0;
    const wr = [22.8 + dx, 23.4 + dy];
    const slump = k === 0 ? 0 : 1.2; // 축 처진 뒷팔
    return standPose({
      dx,
      dy,
      head: [
        { eyes: 'squint', mouth: 'ouch', brows: 'up', hair: 's0' },
        { eyes: 'wet', mouth: 'grit', hair: 2 },
        { eyes: 'wet', mouth: 'grit', hair: 2 },
        { eyes: 'wet', mouth: 'open', hair: 2 },
      ][k],
      back: k === 0
        ? { sh: [13, 20 + dy], el: [9.0, 17.6 + dy], wr: [8.2, 12.8 + dy], hand: { rows: 'spread', at: handAt([8.2, 12.8 + dy], -3, -2) } } // 화들짝 손
        : { sh: [13 + dx, 20 + dy], el: [12.4 + dx, 26.4 + dy], wr: [12.8 + dx, 31.6 + dy + slump], hand: { rows: 'mid', at: handAt([12.8 + dx, 31.6 + dy + slump], -2, -1) } },
      el: [19.6 + dx, 25.2 + dy], wr, grip: [24.2 + dx, wr[1]],
      pole: { top: [24.2 + dx, 5 + dy], bot: [24.2 + dx, 45.5] },
      fx: [
        (K) => drops(K, [[4, 3, 2], [9, 0, 1], [15, 0, 0], [33, 0, 0], [39, 1, 2], [44, 6, 1], [2, 11, 1], [45, 13, 0], [6, 8, 0]]), // 물보라
        (K) => drops(K, [[16, 26, 2], [22, 25, 1], [29, 26, 1], [35, 23, 2], [11, 43, 2], [27, 38, 0], [19, 52, 1], [31, 50, 0]]), // 앞머리·코·손끝에서 뚝뚝
        (K) => drops(K, [[1, 12, 2], [4, 20, 1], [2, 28, 0], [7, 6, 0], [43, 12, 2], [46, 20, 1], [44, 28, 0], [40, 5, 0]]), // 털어서 양옆으로
        (K) => drops(K, [[35, 22, 2], [17, 27, 1], [12, 46, 1], [28, 54, 0]]), // 코끝 방울
      ][k],
    });
  },
});

// 장대 끝 집게 칸(8×8, 엔진이 tip에서 이은 장대 끝에 그린다). 기준점 (4,8) = 장대가 들어오는 아래 가운데.
// 줄기(5~7행) 3·4열은 lint 2px = 시트 장대 0행과 같은 색이라, 엔진이 tip 0행을 위로 복사해 이어도 이음매가 없다(#188 Theo 리뷰 2).
// 0 벌림 / 1 다묾(열쇠 고리를 문다).
const CLAW = {
  cell: [8, 8],
  anchor: [4, 8],
  frames: 2,
  legend: { k: C.ink, L: C.lint, D: C.dusk, d: C.plum, W: C.white },
  rows: [
    ['kk....kk', 'kWk..kLk', 'kLk..kDk', 'kDLkkLdk', '.kDLLdk.', '..kLLk..', '..kLLk..', '..kLLk..'],
    ['..kkkk..', '.kWLLDk.', 'kLk..kDk', 'kLk..kdk', '.kLkkdk.', '..kLLk..', '..kLLk..', '..kLLk..'],
  ],
};

/** 사라진 칸(launch_to_hook 2·3): 속도선과 먼지만. 몸이 없으니 외곽선도 없다. */
function drawZip(p) {
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  if (p.k === 2) {
    streaks(K, [[19, 0, 40], [24, 0, 52], [29, 2, 44], [34, 6, 30], [15, 10, 26]]);
    puff(K, 24, 1);
  } else {
    streaks(K, [[22, 0, 14], [27, 0, 20], [32, 4, 10]]);
    puff(K, 24, 2);
  }
  return { K, feet: [] };
}

export const SHEET = {
  name: 'jjuk-base',
  character: 'jjuk',
  source: 'jjuk-v4', // 메타 json의 원본 파일 표시
  walkCycle: 36,
  anims: [
    { name: 'idle', frames: 2, ms: [700, 500] },
    { name: 'walk', frames: 6, by: 'distance' },
    { name: 'hold', frames: 2, ms: [450, 450] },
    { name: 'common.zap', frames: 3, ms: [100, 100, 300] },
    { name: 'launch_to_hook', frames: 4, ms: [150, 100, 100, 150] },
    { name: 'reach_hang_up', frames: 3, ms: [350, 250, 400] },
    { name: 'common.flatten', frames: 4, ms: [100, 600, 150, 450] },
    { name: 'common.bump_bottom', frames: 4, ms: [100, 400, 300, 500] },
    { name: 'common.stretch', frames: 3, ms: [150, 300, 350] },
    { name: 'common.reach_wobble', frames: 4, ms: [250, 200, 200, 450] },
    { name: 'common.wet', frames: 4, ms: [100, 400, 300, 500] },
  ],
  pose,
  drawFrame,
  claw: CLAW,
};
