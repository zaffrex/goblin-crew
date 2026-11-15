// 쭉이 기본 시트 — 새 밀도 샘플 (#142, 사장님 결정 11/16 "세 사람 그림도 같이 더").
// 사장님 OK 전에는 엔진에 붙이지 않는다(art/build.mjs의 SHEETS는 아직 jjuk.mjs). OK가 나면 build.mjs에서 import만 바꾼다.
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
  return { x: u(x), lift: p === 4 ? 2.6 : 1.5, toe: false };
}

// 걷기 출렁임(② px, 상체가 내려가는 양). 0 = 딛기(다리 벌어짐), 1 = 내려앉기(가장 낮음), 2 = 올라서기(가장 높음).
// 무릎을 살짝 굽힌 채 걷는 덜렁이 걸음이라 가장 높을 때도 서 있기보다 1px 낮다.
const BOB = [3, 4, 1, 3, 4, 1];
// 머리 가닥·장대가 따라오는 양: 몸 출렁임을 한 프레임 늦게 받는다.
const lag = (arr, k) => arr[(k + 5) % 6];

export function pose(kind, k) {
  if (kind === 'idle') {
    return {
      chest: k, // 숨 들이쉬기 / 내쉬기
      lean: 0,
      legs: { back: { x: -2.05, lift: 0, toe: false }, front: { x: 2.4, lift: 0, toe: false } },
      armSwing: 0,
      pole: 'ground',
      poleDy: 0,
      poleTilt: 0,
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
const HEAD = [
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

/** 같은 부품 경계선(색별). 앞 부품과 맞닿은 뒤 부품 픽셀을 뒤 부품의 선 색으로 칠한다. */
function colorLines(K) {
  const out = K.c.slice();
  for (let y = 0; y < K.h; y++)
    for (let x = 0; x < K.w; x++) {
      const i = y * K.w + x;
      const a = K.p[i];
      if (a < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = K.idx(x + dx, y + dy);
        if (j < 0) continue;
        const b = K.p[j];
        if (b > a && K.parts[b].line && K.parts[b].ramp !== K.parts[a].ramp) {
          out[i] = LINE.get(K.parts[a].ramp[0]) ?? C.plum;
          break;
        }
      }
    }
  K.c = out;
}

/** 외곽선 바로 안쪽, 빛 반대쪽(오른쪽·아래)이 비어 있는 픽셀을 한 단 내린다. 덩어리감이 생긴다. */
function rimShade(K, skip) {
  const out = K.c.slice();
  for (let y = 0; y < K.h; y++)
    for (let x = 0; x < K.w; x++) {
      const c = K.get(x, y);
      if (c === EMPTY || skip.has(K.p[y * K.w + x])) continue;
      const open = (dx, dy) => K.get(x + dx, y + dy) === EMPTY;
      if ((open(1, 0) || open(0, 1)) && DOWN.has(c)) out[y * K.w + x] = DOWN.get(c);
    }
  K.c = out;
}

/** 신발 밑창: 신발 부품의 맨 아랫줄 바로 위 줄을 lint로(운동화 밑창 띠). 맨 아랫줄은 어둡게 둔다(바닥 접지). */
function soles(K, shoeParts) {
  for (const pid of shoeParts) {
    for (let x = 0; x < K.w; x++) {
      let bottom = -1;
      for (let y = 0; y < K.h; y++) if (K.p[y * K.w + x] === pid && K.get(x, y) !== EMPTY) bottom = y;
      if (bottom < 1) continue;
      if (K.p[(bottom - 1) * K.w + x] === pid) K.c[(bottom - 1) * K.w + x] = C.lint;
      K.c[bottom * K.w + x] = C.woodD;
    }
  }
}

export function drawFrame(p) {
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  const d = u(p.chest);
  const hipY = HIP_Y + (p.pole === 'ground' ? 0 : d); // 걷기: 골반도 같이 내려감 / 서 있기(숨쉬기): 상체만
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
  const pole = K.limb([[px, poleTop, 0.95], [px, poleBot, 0.95]], R4.metal, {
    pattern: (x, y) => (Math.abs((y - poleTop) % 6) < 0.5 ? [C.plum, C.dusk, C.lav] : undefined), // 마디 이음매
  });
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
  colorLines(K);

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
  K.stamp(hx0, hy0, HEAD, HL, headPart);
  K.stamp(hx0 + NOSE[0], hy0 + NOSE[1], NOSE[2], HL, headPart);
  // 큰 귀(머리카락 옆으로 나온다)
  K.stamp(hx0 + 3, hy0 + 8, ['.ts', 'tsd', 'sDd', 'sdd', '.d.'], HL, headPart);

  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  // 목젖·셔츠 깃·명찰
  K.stamp(...P(bx(15.4, body(16.8)), body(16.8)), ['t', 'd'], { t: C.tan, d: C.wood });
  K.stamp(...P(bx(14.0, body(18.4)), body(18.4)), ['WW..W', 'cWWWc'], { W: C.white, c: C.lint });
  K.stamp(...P(bx(16.3, body(22.0)), body(22.0)), ['AAA', 'AtA'], { A: C.aqua, t: C.tealM });

  // 외곽선 안쪽 그늘(장대·머리는 이미 손으로 명암을 넣었으니 뺀다)
  rimShade(K, new Set([headPart, handPart, pole]));
  soles(K, feet);
  K.outline();
  return { K, feet, grip: P(px, handY) };
}

export const SHEET = {
  name: 'jjuk-base',
  character: 'jjuk',
  walkCycle: 36,
  anims: [
    { name: 'idle', frames: 2, ms: [700, 500] },
    { name: 'walk', frames: 6, by: 'distance' },
  ],
  pose,
  drawFrame,
};
