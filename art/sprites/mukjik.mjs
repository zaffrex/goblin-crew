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
import { puff, drops } from '../lib/fx.mjs';
import { squash } from '../lib/squash.mjs';

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
  if (kind === 'common.stomp') return STOMP[k];
  if (kind === 'common.flatten') return FLATTEN[k];
  if (kind === 'step_up') return STEP_UP[k];
  if (kind === 'sit_corner') return SIT_CORNER[k];
  if (kind === 'common.wet') return WET[k];
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
// 얼굴 갈아 끼우기(쿵): 눈썹 9행, 눈 10~11행, 입 15~17행. 바꾸지 않은 줄은 HEAD 그대로.
const FACE = {
  brows: { furrow: ['.kdssBBBBBBsssBBBBBBs.'] }, // 일자 눈썹이 미간에서 내려앉는다(기합)
  eyes: {
    shut: ['.kdssssBBsssssssBBsss.', '..dsssssBBsssssBBsss..'], // 질끈 감은 눈(\ /, 미간 쪽이 낮다)
    daze: ['.kdsssssssssssswPwsss.', '..dssssBBBssssswwwss..'], // 어질: 한 눈은 풀려 반쯤 감기고 한 눈은 동그랗게 뜬다
  },
  mouth: {
    grit: ['...dssssssmmmmmmmmmm..', '...ddsssxsmTTTTTTTTm..', '....dsssxsxmmmmmmmmmm.'], // 이를 악묾
    tongue: ['...dsssssssmmmmmmmm...', '...ddsssxsxsmkkkkmss..', '....dsssxsxssmrrmsss..'], // 어질: 입이 헤 벌어지고 혀가 빠진다
  },
};
// 젖은 머리(common.wet 1~3번): 짧은 머리가 물에 눌려 정수리가 한 줄 낮아지고 빛 가닥(g)이 늘어난다.
//   젖은 머리띠가 무게로 흘러내려 **일자 눈썹과 두 눈을 통째로 덮는다**(8~10행). 코와 이를 악문 입만 남는다 = "앞이 안 보여도 비장".
//   쭉이 젖은 앞머리(jjuk-v4.mjs WET_BANGS)와 같은 웃음을 묵직이 물건(머리띠)으로 한다. 원래 띠 자리(4~6행)엔 젖은 머리가 드러난다.
const WET_HEAD = [
  '......................',
  '...KKgKKKKgKKKKK......',
  '.kKKKgKKKKKKgKKKKK....',
  '.kKKKKKgKKKKKKgKKKK...',
  '.kKKgKKKKKKgKKKKKKKK..',
  '.kKKKKdKKsKKKsKKKsKK..',
  '.kKKdsssKssttsKsttss..',
  '.kKdssstttsssssttsss..',
  'eWWWWWWWWWWWWWWWWWWWW.',
  'eWWWWWWWWWWWWWWWWWWWW.',
  'leeeeleeeeeleeeeleeee.',
  '..dsssssssssssssssss..',
];
function face(f) {
  const r = HEAD.slice();
  if (f.band === 'wet') r.splice(0, WET_HEAD.length, ...WET_HEAD);
  if (f.brows && f.band !== 'wet') r.splice(9, 1, ...FACE.brows[f.brows]);
  if (f.eyes && f.band !== 'wet') r.splice(10, 2, ...FACE.eyes[f.eyes]);
  if (f.mouth) r.splice(15, 3, ...FACE.mouth[f.mouth]);
  for (const row of r) if (row.length !== 22) throw new Error(`[mukjik] 얼굴 줄 길이 ${row.length}: ${row}`);
  return r;
}
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
  // a.knee [dx, dy]: 무릎을 골반 기준으로 직접 준다(쿵 무릎 들기). 없으면 서 있기·걷기와 같은 계산.
  const kx = a.knee ? hx + a.knee[0] : (hx + ax) / 2 + 0.5, ky = a.knee ? hy + a.knee[1] : (hy + ay) / 2;
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

function drawArm(K, side, sx, sy, swing, bias, aim) {
  // 어깨 → 팔꿈치 → 손목. 짧은 소매(흰) 아래 굵은 팔뚝.
  // aim [위팔 각, 아래팔 각](라디안, 0 = 오른쪽, 아래가 +): 쿵처럼 팔을 크게 드는 자세. 없으면 swing으로 흔든다.
  const dir = side === 'front' ? 1 : -1;
  const a0 = aim ? aim[0] : Math.atan2(6.2, 2.0 * dir) - swing * 0.22 * dir;
  const up = 6.2, lo = 5.0;
  const ex = sx + up * Math.cos(a0), ey = sy + up * Math.sin(a0);
  const a1 = aim ? aim[1] : a0 - swing * 0.16 * dir;
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
  const bw = drawArm(K, 'back', bx(8.6, body(22.6)), body(22.6), p.armSwing.back, -0.3, p.aim?.back);
  // 뒷다리
  feet.push(drawLeg(K, 'back', p.legs.back, d, -0.3).shoe);
  // 앞다리
  feet.push(drawLeg(K, 'front', p.legs.front, d, 0).shoe);

  // 몸통: 흰 셔츠 위에 공 같은 배를 감싼 작업복. 배는 한 프레임 늦게 출렁인다.
  const jig = u(p.jiggle);
  const bel = p.belly;
  // 엉덩이(앉기 sit_corner): 배 뒤 아래로 튀어나온 작업복 엉덩이. 배보다 먼저 그려 배가 앞을 덮는다.
  if (p.seat) K.ball(p.seat[0], body(p.seat[1]), p.seat[2], p.seat[3], R4.overall, { bias: -0.2 });
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
  const fw = drawArm(K, 'front', bx(24.0, body(22.4)), body(22.4), p.armSwing.front, 0, p.aim?.front);
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
  // 젖은 띠(face.band 'wet')는 4행 아래로 흘러내렸다: 매듭 꼬리도 같이 내려가고, 귀는 띠 아래로 나온 끝(2행~)만 보인다.
  const band = p.face?.band === 'wet' ? 4 : 0;
  K.stamp(hx0 - 5, hy0 + 4 + band, TAILS[clamp(p.tails, 0, 2)], HL, headPart);
  K.stamp(hx0, hy0, p.face ? face(p.face) : HEAD, HL, headPart);
  K.stamp(hx0 + NOSE[0], hy0 + NOSE[1], NOSE[2], HL, headPart);
  if (band) K.stamp(hx0 + EAR[0], hy0 + EAR[1] + 2, EAR[2].slice(2), HL, headPart);
  else K.stamp(hx0 + EAR[0], hy0 + EAR[1], EAR[2], HL, headPart);

  // 단추·명찰·주머니·무릎 기운 자국
  const bt = [{ C: C.yel, c: C.yelD }];
  K.stamp(...P(bx(13.2, body(25.4)), body(25.4)), ['C'], bt[0]);
  K.stamp(...P(bx(21.6, body(25.4)), body(25.4)), ['C'], bt[0]);
  K.stamp(...P(bx(16.4 + bel, body(27.2)), body(27.2)), ['ddddd', 'd...d', 'ddddd'], { d: C.tealD });
  K.stamp(...P(bx(19.6, body(20.6)), body(20.6)), ['AAA', 'AtA'], { A: C.aqua, t: C.tealM });

  rimShade(K, new Set([headPart, handPart]), DOWN);
  soles(K, feet, C.woodL);
  // 납작(common.flatten): 눈썹·눈(9~11행)과 입(15~17행)은 덜 눌러서 얼굴이 남게 한다
  if (p.flat) squash(K, { ...p.flat, keep: [[hy0 + 9, hy0 + 11], [hy0 + 15, hy0 + 17]] });
  K.outline();
  if (p.fx) p.fx(K); // 먼지·충격선: 외곽선 없이(ADR-0007 결정 3-1)
  return { K, feet, belly };
}

// ══════════ 화면 1 자세 (#142, 설계 docs/design/screens/magpie_nest.md 3·4절) ══════════
// common.stomp  공용 "쿵"(능력 동작). 시소 끝·까치 앞·기둥 밑동·바구니·빨랫줄 기둥에서 같은 그림을 쓴다.
//   발 구르기로 그린다(ADR-0003 "발을 구르거나 엉덩방아"). 엉덩방아는 실패 리액션 common.bump_bottom과 겹쳐서
//   성공한 쿵이 넘어진 것처럼 읽히지 않게 뺐다.
//   0 무릎 들기(상체 젖힘, 두 주먹 위로, 미간 찌푸림) → 1 내려찍기(배는 아직 위) → 2 쿵(쪼그라듦, 배 출렁 아래, 먼지·충격선)
//   → 3 여운(배가 튀어 오름, 먼지 흩어짐, 무표정 복귀). 합 1100ms ≤ 연출 상한 1500(#187 busy = 시트 ms).
//   서 있기·걷기와 같은 drawFrame에 무릎(knee)·팔 각도(aim)·얼굴(face)·효과(fx)만 더한다. 방향은 고정하지 않는다.
const UP = -Math.PI / 2;
/** 충격선(외곽선 없음): 두 발 바깥에서 비스듬히 위로 튀는 짧은 선 2개씩. 몸 위에는 그리지 않는다. */
function impact(K) {
  const rays = [
    [[9, 55, C.white], [8, 54, C.white], [7, 53, C.cotton]],
    [[12, 53, C.white], [12, 52, C.cotton]],
    [[39, 55, C.white], [40, 54, C.white], [41, 53, C.cotton]],
    [[36, 53, C.white], [36, 52, C.cotton]],
  ];
  for (const ray of rays) for (const [x, y, c] of ray) if (K.get(x, y) === -1) K.dot(x, y, c);
}
/** 내려찍는 발 뒤 속도선(외곽선 없음): 발 앞쪽 바깥에 세로로 짧게. */
function drop(K) {
  for (const [x, y0, y1] of [[42, 47, 53], [44, 50, 55]])
    for (let y = y0; y <= y1; y++) if (K.get(x, y) === -1) K.dot(x, y, y - y0 < 2 ? C.lint : y - y0 < 4 ? C.cotton : C.white);
}
const STOMP = [
  { // 0 무릎 들기: 앞 무릎을 배 높이로, 상체는 뒤로, 두 주먹을 머리 옆으로
    chest: 0, belly: 0.6, jiggle: 0, lean: -2,
    legs: { back: { x: -0.8, lift: 0, toe: false }, front: { x: 3.6, lift: 5.4, toe: false, knee: [5.2, -2.4] } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [UP - 0.75, UP - 0.35], front: [UP + 0.5, UP + 0.15] },
    tails: 2,
    face: { brows: 'furrow' },
  },
  { // 1 내려찍기: 발이 거의 바닥, 몸이 내려가는데 배는 아직 위(한 프레임 늦음), 주먹도 같이 내리친다
    chest: 3, belly: 0.6, jiggle: -1, lean: 0,
    legs: { back: { x: -1.2, lift: 0, toe: false }, front: { x: 3.0, lift: 0.8, toe: false } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [2.5, 2.1], front: [0.75, 1.25] },
    tails: 0,
    face: { brows: 'furrow', eyes: 'shut', mouth: 'grit' },
    fx: drop,
  },
  { // 2 쿵: 다리를 벌리고 쪼그라든다. 배가 늦게 내려앉고 머리띠 꼬리가 튄다. 양옆 먼지 + 충격선
    chest: 5, belly: 0.6, jiggle: 2, lean: 0,
    legs: { back: { x: -2.8, lift: 0, toe: false }, front: { x: 4.0, lift: 0, toe: false } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [2.2, 1.95], front: [0.95, 1.3] },
    tails: 0,
    face: { brows: 'furrow', eyes: 'shut', mouth: 'grit' },
    fx: (K) => { puff(K, 6, 1, { behind: true }); puff(K, 42, 1, { behind: true }); impact(K); },
  },
  { // 3 여운: 몸이 올라오는데 배는 한 번 더 튀어 오른다. 얼굴은 원래 무표정(비장)으로, 먼지는 흩어진다
    chest: 2, belly: 0.6, jiggle: -2, lean: 0,
    legs: { back: { x: -1.6, lift: 0, toe: false }, front: { x: 2.6, lift: 0, toe: false } },
    armSwing: { back: 0, front: 0 },
    tails: 1,
    fx: (K) => { puff(K, 6, 2, { behind: true }); puff(K, 42, 2, { behind: true }); },
  },
];

// common.flatten  공용 "납작". 위에서 무언가에 맞아 눌린다(화면 1: 튀어 오른 널빤지가 이마를 친다 #15, 발사된 사람이 부딪힌다 #13).
//   몸을 새로 그리지 않고 서 있기 그림을 바닥 기준으로 누른다(art/lib/squash.mjs). 세 사람이 같은 박자를 쓴다.
//   0 꽝(반쯤 눌림, 질끈) → 1 납작(가장 눌림, 옆으로 퍼짐, 먼지) → 2 뿅(가늘게 튀어 오름) → 3 어질(제 키, 한 눈 풀림 + 혀).
//   합 1300ms ≤ 연출 상한 1500(#187 busy = 시트 ms). 마지막 칸 어질은 말풍선 동안 그대로 남는다(#193).
//   묵직이는 이미 칸 폭에 가까워(39px) 옆으로 덜 퍼진다(squash가 칸 안으로 줄인다). 대신 세로를 가장 많이 누른다(무거운 사람이 제일 납작).
//   별은 그리지 않는다: 화면 데이터가 fx stars를 따로 띄운다(#15).
const FLAT_FACE = { brows: 'furrow', eyes: 'shut', mouth: 'grit' };
const FLATTEN = [
  { // 0 꽝: 반쯤 눌림
    chest: 0, belly: 0.6, jiggle: 0, lean: 0,
    legs: { back: { x: -1.6, lift: 0, toe: false }, front: { x: 2.6, lift: 0, toe: false } },
    armSwing: { back: 0.6, front: 0.6 }, tails: 0, face: FLAT_FACE,
    flat: { sx: 1.25, sy: 0.55 },
  },
  { // 1 납작: 가장 눌리고 옆으로 퍼진다. 양옆으로 먼지
    chest: 0, belly: 0.6, jiggle: 0, lean: 0,
    legs: { back: { x: -1.6, lift: 0, toe: false }, front: { x: 2.6, lift: 0, toe: false } },
    armSwing: { back: 1, front: 1 }, tails: 2, face: FLAT_FACE,
    flat: { sx: 1.3, sy: 0.36 },
    fx: (K) => { puff(K, 4, 0, { behind: true }); puff(K, 44, 0, { behind: true }); },
  },
  { // 2 뿅: 가늘고 길게 튀어 오른다(칸 위 끝까지만), 놀란 눈
    chest: 0, belly: 0, jiggle: -2, lean: 0,
    legs: { back: { x: -0.4, lift: 0, toe: false }, front: { x: 1.4, lift: 0, toe: false } },
    armSwing: { back: -0.4, front: -0.4 }, tails: 0, face: { brows: 'furrow' },
    flat: { sx: 0.86, sy: 1.08 },
    fx: (K) => puff(K, 24, 2, { behind: true }),
  },
  { // 3 어질: 제 키로 돌아왔지만 한 눈은 풀리고 입이 헤 벌어져 혀가 빠진다. 배가 늦게 한 번 출렁
    chest: 1, belly: 0.6, jiggle: 1, lean: 1,
    legs: { back: { x: -0.4, lift: 0, toe: false }, front: { x: 1.4, lift: 0, toe: false } },
    armSwing: { back: 0.3, front: -0.3 }, tails: 1, face: { eyes: 'daze', mouth: 'tongue' },
  },
];

// step_up  시소 올라서기 깡충(#397, 설계 docs/design/screens/magpie_nest.md 1-5-3절). 엔진이 칸을 궤적 위에 놓는다:
//   웅크림 0번(150ms) → 공중 1번(150ms, 기준점이 포물선으로 8px만 솟는다) → 착지 0번(50ms). 내려서기는 1번 → 0번.
//   무거움은 웅크림에 몬다: 셋 중 가장 깊이, 가장 오래 웅크리고 두 주먹을 뒤로 젖혀 반동을 모은다. 공중은 "겨우 넘는" 얼굴.
//   0 웅크림: 무릎 굽혀 몸을 낮추고 상체는 앞으로, 두 주먹은 엉덩이 뒤로. 미간 찌푸림(쿵 0번과 같은 기합)
//   1 공중: 앞 무릎을 배 높이로 접어 올리고(쿵 0번 무릎 들기와 같은 다리) 뒷발 앞코가 끌린다. 두 주먹은 앞으로 휘두른다.
//      배는 한 칸 늦게 아래로 처진다(jiggle). 뒷발 앞코가 칸 바닥 행에 닿아 build.mjs "딛은 발" 검사를 지킨다.
const STEP_UP = [
  {
    chest: 5, belly: 0.6, jiggle: -1, lean: 1,
    legs: { back: { x: -1.8, lift: 0, toe: false }, front: { x: 3.0, lift: 0, toe: false } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [Math.PI - 0.95, Math.PI - 0.7], front: [Math.PI - 1.15, Math.PI - 0.85] },
    tails: 1,
    face: { brows: 'furrow' },
  },
  {
    chest: 1, belly: 0.6, jiggle: 2, lean: 1,
    legs: { back: { x: -1.6, lift: -0.75, toe: true }, front: { x: 3.4, lift: 4.6, toe: false, knee: [4.6, -1.8] } }, // 앞코 신발은 1px 짧아서 발목을 1px 내린다
    armSwing: { back: 0, front: 0 },
    aim: { back: [1.05, 0.6], front: [1.3, 1.05] }, // 칸이 좁아(묵직이 39px) 주먹은 앞 아래로
    tails: 2,
    face: { brows: 'furrow', mouth: 'grit' },
  },
];

// ══════════ 화면 2 자세 (#380, 설계 docs/design/screens/park_fountain.md 7절 P4) ══════════
// sit_corner  분수대 테두리 돌에 일부러 털썩 앉기(3번★ 주 아하, 4번). 자리 fountain_seat(발 y 200 = 테두리 아래 끝 198 바로 앞)에서
//   재생해서, 엉덩이가 테두리 앞면 윗단(칸 y 44~53) 위에 놓인다. 발 y 244에서 앉으면 흙길에 앉은 것으로 읽혀 단서 ②(돌/흙)가 무너진다.
//   넘어지는 실패 리액션 common.bump_bottom(뒤로 자빠짐, 별)과 다르게 *일부러* 앉는다: 별 없음, 마지막 얼굴이 비장(눈 뜬 기합).
//   0 겨누기: 무릎을 굽혀 엉덩이를 뒤로 쭉 빼고, 뒷손으로 등 뒤 돌을 더듬는다. 앞주먹은 무릎에. 미간 찌푸림.
//   1 털썩: 엉덩이가 돌에 닿는 칸. 허벅지가 앞으로 눕고 두 팔이 튀어 오른다. 배는 아직 위(한 칸 늦음). 엉덩이 옆 먼지 + 충격선.
//      시트 cue 1 = 이 칸에서 `ゴォン`(gon_text)이 뜬다.
//   2 비장: 앉은 채 가슴을 펴고 앞주먹은 무릎, 뒷손은 돌을 짚는다. 배가 늦게 내려앉아 한 번 출렁. 머리띠 꼬리 처짐.
//      cue 2 = 이 칸에서 분수대 흔들림(shake)·물결(ripple). 말풍선 동안 이 칸이 남는다(#193).
//   합 1250ms ≤ 연출 상한 1500. 방향은 고정하지 않는다(테두리 앞면 앞에 서니 어느 쪽을 봐도 엉덩이가 돌 위다).
/** 앉은 다리: 허벅지가 앞으로 눕고(무릎 = 골반 높이) 정강이는 곧게 내려 발바닥이 바닥에 닿는다. */
const SEAT_LEGS = {
  back: { x: 3.4, lift: 0, toe: false, knee: [3.6, 0.6] },
  front: { x: 4.6, lift: 0, toe: false, knee: [4.8, 0.4] },
};
/** 엉덩이 뒤 먼지·충격선(외곽선 없음): 엉덩이가 돌에 닿는 자리 뒤쪽으로 짧게 튄다. 몸 위에는 그리지 않는다. */
function seatImpact(K) {
  const rays = [
    [[5, 47, C.white], [4, 46, C.white], [3, 45, C.cotton]],
    [[5, 52, C.white], [4, 52, C.white], [3, 52, C.cotton]],
    [[7, 43, C.white], [7, 42, C.cotton]],
  ];
  for (const ray of rays) for (const [x, y, c] of ray) if (K.get(x, y) === -1) K.dot(x, y, c);
}
const SIT_CORNER = [
  { // 0 겨누기: 엉덩이를 뒤로 빼고 몸을 앞으로 숙인다. 뒷손은 등 뒤 아래(돌 더듬기), 앞주먹은 앞 무릎 위
    chest: 4, belly: 0.6, jiggle: 0, lean: 2,
    legs: { back: { x: -0.4, lift: 0, toe: false, knee: [1.8, 1.6] }, front: { x: 2.0, lift: 0, toe: false, knee: [3.6, 1.2] } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [2.2, 2.0], front: [1.15, 1.6] },
    seat: [6.4, 38.6, 4.0, 3.2],
    tails: 1,
    face: { brows: 'furrow' },
  },
  { // 1 털썩: 앉는 칸. 허벅지가 눕고 몸은 살짝 뒤로, 배는 아직 위(jiggle -2). 두 주먹이 반동으로 어깨 옆까지 튄다
    chest: 2, belly: 0.6, jiggle: -2, lean: -1,
    legs: SEAT_LEGS,
    armSwing: { back: 0, front: 0 },
    aim: { back: [UP - 0.3, UP + 0.05], front: [UP + 0.9, UP + 0.4] },
    seat: [7.0, 39.4, 4.4, 2.6],
    tails: 0,
    face: { brows: 'furrow', eyes: 'shut', mouth: 'grit' },
    fx: (K) => { puff(K, 4, 1, { behind: true }); seatImpact(K); },
  },
  { // 2 비장: 앉은 채 가슴을 편다. 앞주먹은 무릎, 뒷손은 엉덩이 옆 돌을 짚는다. 배가 늦게 내려앉아 출렁(jiggle +2)
    chest: 1, belly: 0.6, jiggle: 2, lean: -1,
    legs: SEAT_LEGS,
    armSwing: { back: 0, front: 0 },
    aim: { back: [2.0, 1.75], front: [1.2, 1.5] },
    seat: [7.0, 39.0, 4.4, 3.0],
    tails: 2,
    face: { brows: 'furrow', mouth: 'grit' },
    fx: (K) => puff(K, 4, 2, { behind: true }),
  },
];

// ══════════ 공용 리액션 (#529, 화면 2 duck stomp·8절 ③ 클리어 컷) ══════════
// common.wet  공용 "젖음". 쭉이 common.wet(jjuk-v4.mjs)과 같은 박자 [100, 400, 300, 500]와 같은 순서:
//   0 철썩(물이 확 덮침: 두 주먹이 머리 옆으로 튀고 눈 질끈, 머리띠는 아직 제자리, 물보라)
//   → 1 흠뻑(젖은 머리띠가 흘러내려 눈썹·눈을 덮는다. 어깨가 축 처지고 두 팔이 늘어진다. 머리띠 꼬리 처짐, 물 뚝뚝)
//   → 2 부르르(상체를 털어 물이 양옆으로 튄다. 배가 한 칸 늦게 반대로 출렁)
//   → 3 뚝뚝(띠에 눈이 가린 채 이를 악문다 = 젖어도 비장. 코끝·주먹에서 방울). 마지막 칸이 말풍선 동안 남는다(#193).
//   묵직이 웃음은 "안 무너지는 얼굴"이라(쭉이는 입 벌림, 묵직이는 비장) 3번 입은 grit이다.
const WET_BAND = { band: 'wet' };
const WET = [
  { // 0 철썩: 무릎이 살짝 굽고 두 주먹이 반사적으로 머리 옆까지 튄다. 눈 질끈 + 이 악묾
    chest: 2, belly: 0.6, jiggle: -1, lean: -1,
    legs: { back: { x: -1.2, lift: 0, toe: false }, front: { x: 2.4, lift: 0, toe: false } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [UP - 0.6, UP - 0.25], front: [UP + 0.55, UP + 0.2] },
    tails: 0,
    face: { brows: 'furrow', eyes: 'shut', mouth: 'grit' },
    fx: (K) => drops(K, [[4, 3, 2], [10, 0, 1], [17, 0, 0], [31, 0, 0], [38, 1, 2], [43, 7, 1], [2, 12, 1], [45, 15, 0], [7, 8, 0]]),
  },
  { // 1 흠뻑: 띠가 눈을 덮고, 어깨가 내려앉아(chest 3) 두 팔이 축 늘어진다. 배는 한 칸 늦게 아래
    chest: 3, belly: 0.6, jiggle: 1, lean: 0,
    legs: { back: { x: -0.6, lift: 0, toe: false }, front: { x: 1.6, lift: 0, toe: false } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [1.8, 1.7], front: [1.35, 1.45] }, // 축 늘어진 팔(서 있기보다 더 곧게 아래)
    tails: 2,
    face: WET_BAND,
    fx: (K) => drops(K, [[12, 22, 1], [20, 23, 1], [28, 22, 2], [36, 25, 1], [6, 40, 2], [41, 41, 1], [16, 54, 0], [33, 55, 0]]),
  },
  { // 2 부르르: 상체를 앞으로 털고(lean +2) 배는 반대로(jiggle −2). 물이 양옆으로 튄다
    chest: 2, belly: 0.6, jiggle: -2, lean: 2,
    legs: { back: { x: -1.6, lift: 0, toe: false }, front: { x: 2.8, lift: 0, toe: false } },
    armSwing: { back: 0.9, front: -0.9 },
    tails: 1,
    face: WET_BAND,
    fx: (K) => drops(K, [[0, 13, 2], [3, 21, 1], [1, 29, 0], [6, 7, 0], [44, 12, 2], [46, 21, 1], [45, 29, 0], [41, 5, 0]]),
  },
  { // 3 뚝뚝: 띠에 눈이 가린 채 이를 악문다. 코끝·두 주먹 끝에서 방울
    chest: 3, belly: 0.6, jiggle: 0, lean: 0,
    legs: { back: { x: -0.6, lift: 0, toe: false }, front: { x: 1.6, lift: 0, toe: false } },
    armSwing: { back: 0, front: 0 },
    aim: { back: [1.8, 1.7], front: [1.35, 1.45] }, // 축 늘어진 팔(서 있기보다 더 곧게 아래)
    tails: 2,
    face: { ...WET_BAND, mouth: 'grit' },
    fx: (K) => drops(K, [[37, 22, 2], [8, 42, 1], [40, 43, 1], [24, 55, 0]]),
  },
];

export const SHEET = {
  name: 'mukjik-base',
  character: 'mukjik',
  walkCycle: 24,
  anims: [
    { name: 'idle', frames: 2, ms: [800, 600] },
    { name: 'walk', frames: 6, by: 'distance' },
    // cue 2: 시그니처 `ドスン`+흔들림+먼지(stomp_text)는 발이 닿는 쿵 칸(400ms)에 뜬다(ability-feedback.md 2·2-1절, #284).
    { name: 'common.stomp', frames: 4, ms: [300, 100, 400, 300], cue: [2] },
    { name: 'common.flatten', frames: 4, ms: [100, 600, 150, 450] },
    // 납작에서 멈춤(#433, 15번 혼자 맞기): 쭉이·삑삑이 시트와 같다(#357). 새 칸 없이 꽝 → 납작 두 칸만, 엔진이 납작 장을 다음 말풍선이 끝날 때까지 붙든다.
    { name: 'common.flatten_stay', reuse: [['common.flatten', 0], ['common.flatten', 1]], ms: [100, 600] },
    // 웅크림·공중(#397 1-5-3절). 착지는 엔진이 0번 칸을 50ms 다시 쓴다. 맨 뒤에 붙여서 앞 칸 번호(#357 납작 12)는 그대로다.
    { name: 'step_up', frames: 2, ms: [150, 150] },
    // 시소 끝에 뛰어올라 쿵(#414, magpie_nest.md 1-6-2·1-6-3절). 새 칸 없이 웅크림 → 무릎 들기 → 내려찍기 → 쿵 → 여운을 잇는다.
    // air [1, 2] = 공중(엔진이 궤적 위에 놓는다), 3번(쿵)이 착지 칸: 이 칸이 시작되는 틱에 `ドスン`(cue)과 U6가 같이 시작한다.
    {
      name: 'seesaw_stomp',
      reuse: [['step_up', 0], ['common.stomp', 0], ['common.stomp', 1], ['common.stomp', 2], ['common.stomp', 3]],
      ms: [150, 150, 100, 400, 300],
      cue: [3],
      air: [1, 2],
    },
    // 화면 2 P4 테두리 돌에 털썩 앉기(#380, park_fountain.md 7절). 맨 뒤에 붙여서 앞 칸 번호는 그대로다.
    // cue [1, 2]: 털썩 칸에서 `ゴォン`, 비장 칸에서 흔들림(3번)·물결(4번).
    { name: 'sit_corner', frames: 3, ms: [400, 150, 700], cue: [1, 2] },
    // 공용 젖음(#529). 쭉이와 같은 박자. 맨 뒤에 붙여서 앞 칸 번호는 그대로다.
    { name: 'common.wet', frames: 4, ms: [100, 400, 300, 500] },
  ],
  pose,
  drawFrame,
};
