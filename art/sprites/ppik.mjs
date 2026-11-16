// 삑삑이 기본 시트 (#144, 새 밀도 — 사장님 #156 "우스꽝스러운게 좋아", 11/16).
// 기준: 쭉이 새 밀도(jjuk-v4.mjs)·묵직이(mukjik.mjs). 같은 칸 48×64, 같은 마감 패스(art/lib/finish.mjs), 같은 세기의 과장.
// 디자인은 ADR-0003 3차 샘플(crew-v3.mjs ppik) 그대로: 키 작은 막내 알바(성인), 노란 우비 후드, 동그란 안경,
// 빨간 장화, 고무 닭을 두 손으로 꼭 쥔다. "작은 어른" 단서: 세로로 긴 얼굴과 뾰족한 턱, 안경, 다른 둘과 같은 명찰.
//
// 과장 (쭉이 "헤벌쭉", 묵직이 "비장" ↔ 삑삑이 "겁먹음")
//   - 얼굴 폭을 다 차지하는 동그란 안경 + 흰 렌즈 속 점 눈동자(겁먹어 작아진 눈). 가운데가 올라간 걱정 눈썹, 지그재그로 떨리는 입.
//   - 몸에 비해 큰 후드(얼굴을 액자처럼 감싼다, 안쪽 테는 진하게 → 얼굴과 우비 명도를 떼어 놓는다, ADR-0003 3차 리스크).
//   - 서 있기 두 칸: 눈동자가 앞 → 뒤로 힐끔(겁먹은 두리번), 땀방울이 한 칸 흘러내린다.
// 움직임 (성격은 걸음 모양·박자로, ADR-0007 결정 5)
//   - 걸음 주기 24px(걸음폭 12px), 짧은 다리로 종종. 지나가는 발을 높이 든다(살금살금). 상체는 앞으로 1px 웅크린다.
//   - 팔은 흔들지 않는다: 고무 닭을 꼭 쥔 채 굳어 있다(쭉이는 한 팔, 묵직이는 두 주먹을 흔든다).
//   - 딸린 것: 닭 머리는 몸보다 한 프레임 늦게 까딱이고, 우비 밑단은 내려앉은 다음 칸에 종처럼 벌어진다.
// 마감: 바깥 외곽선 ink(ADR-0007 결정 3-1), 안쪽 경계는 부품 색별, 외곽 안쪽 한 단 내림, 손은 손가락이 보이는 격자.

import { Canvas, C } from '../lib/pixel.mjs';
import { colorLines, rimShade, soles } from '../lib/finish.mjs';
import { puff, streaks } from '../lib/fx.mjs';
import { squash } from '../lib/squash.mjs';

export const CELL = [48, 64];
const S = 4 / 3;
const OX = 2.6;
const u = (px) => px / S;

// 명암 단계(어두운 쪽 → 밝은 쪽), 보송 32색 안에서.
const R4 = {
  skin: [C.wood, C.woodL, C.tan, C.tan],
  coat: [C.yelD, C.yel, C.yel, C.yelL],
  pants: [C.plum, C.dusk, C.dusk, C.lav],
  boot: [C.redD, C.red, C.red, C.redL],
  // 뒷장화: 한 단 어둡게 + 다른 ramp라 앞장화와 맞닿는 곳에 선이 생긴다(걷기에서 두 다리가 뭉치지 않게)
  bootBack: [C.redD, C.redD, C.red, C.red],
  chick: [C.lint, C.cotton, C.white, C.white],
};
// 안쪽 경계선 색: 뒤에 있는 부품 ramp 첫 색 → 선 색
const LINE = new Map([
  [C.wood, C.woodD], // 피부
  [C.yelD, C.wood], // 우비
  [C.plum, C.ink], // 바지
  [C.redD, C.plum], // 장화
  [C.lint, C.lav], // 고무 닭
]);
// 외곽선 안쪽 한 단 내리기
const DOWN = new Map([
  [C.yelL, C.yel], [C.yel, C.yelD],
  [C.redL, C.red], [C.red, C.redD],
  [C.white, C.cotton], [C.cotton, C.lint],
  [C.tan, C.woodL], [C.woodL, C.wood],
  [C.lav, C.dusk], [C.dusk, C.plum],
]);

const HIP_Y = 38.0; // ① 골반(다리 시작, 우비 밑단 안)
const ANKLE_Y = 43.8;
const LEG = 6.2; // 골반 → 발목 최대 길이
const HIP_X = { back: 13.0, front: 16.3 };
const STEP_PX = 4; // ② px, 걸음 주기 24 / 6
const CONTACT_PX = 6;
const HEM_Y = 39.6; // ① 우비 밑단(서 있기)

function walkAnkle(phase) {
  const p = ((phase % 6) + 6) % 6;
  if (p <= 3) return { x: u(CONTACT_PX - STEP_PX * p), lift: 0, toe: p === 3 };
  const x = -CONTACT_PX + (2 * CONTACT_PX * (p - 3)) / 3;
  // 지나가는 발을 높이 든다(살금살금 종종걸음). 묵직이는 2.2 / 1.4
  return { x: u(x), lift: p === 4 ? 2.6 : 1.6, toe: p === 5 };
}

// 걷기 출렁임(② px). 0 = 발 딛기(가장 낮음), 1 = 받치기, 2 = 지나가기(가장 높음, 발을 높이 든 칸)
const BOB = [3, 1, 0, 3, 1, 0];
const lag = (arr, k) => arr[(k + 5) % 6];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function pose(kind, k) {
  if (kind === 'common.squeeze_chicken') return SQUEEZE[k];
  if (kind === 'hold') return HOLD[k];
  if (kind === 'launch_to_hook') return LAUNCH[k];
  if (kind === 'common.flatten') return FLATTEN[k];
  if (kind === 'idle') {
    return {
      chest: k, // 숨 들이쉬기 / 내쉬기
      lean: 0,
      legs: { back: { x: -0.9, lift: 0, toe: false }, front: { x: 1.0, lift: 0, toe: false } },
      eyes: k === 0 ? 'fwd' : 'back', // 겁먹은 두리번: 앞 → 뒤로 힐끔
      sweat: k, // 땀방울이 한 칸 흘러내린다
      chickHead: k, // 내쉴 때 닭 머리도 1px 처진다
      flare: 0,
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
  const prevChest = Math.max(lag(BOB, k), 0);
  return {
    chest,
    lean: 1, // 웅크리고 앞으로
    legs: { back, front },
    eyes: 'fwd',
    sweat: -1, // 걸을 때는 땀방울 없음(뒤로 날린 것으로 본다)
    chickHead: clamp(prevChest - chest, -2, 2), // 닭 머리는 몸보다 한 프레임 늦다
    flare: lag(BOB, k) >= 3 ? 1 : 0, // 내려앉은 다음 칸에 밑단이 벌어진다
  };
}

// ── 머리 (② 격자, 오른쪽을 본다). 후드가 정수리와 뒤통수를 감싸고, 얼굴은 오른쪽으로 열린다. 23×23, 세로로 긴 얼굴과 뾰족한 턱.
// L yelL(후드 빛) Y yel(후드) y yelD(후드 그늘·안쪽 테) o woodD(후드 안 깊은 그늘)
// K plum(앞머리) g dusk(앞머리 빛)
// D wood(피부 선) d woodL(피부 그늘) s tan(피부) t yelL(피부 빛)
// B plum(눈썹) F ink(안경테) w white(렌즈) a aqua(렌즈 반사) l lint(렌즈 그늘) P ink(눈동자) m redD(입) c pink(볼)
const HL = {
  L: C.yelL, Y: C.yel, y: C.yelD, o: C.woodD,
  K: C.plum, g: C.dusk,
  D: C.wood, d: C.woodL, s: C.tan, t: C.yelL,
  B: C.plum, F: C.ink, w: C.white, a: C.aqua, l: C.lint, P: C.ink, m: C.redD, c: C.pink,
};
const HEAD = [
  '......LLLLYYYY.........',
  '...LLLLYYYYYYYYYY......',
  '..LLYYYYYYYYYYYYYYy....',
  '.LLYYYYYYYYYYYYYYYYy...',
  '.LYYYYYYYYYYYYYYYYYYy..',
  'LLYYYYYYYYYYYYYYYYYYYy.',
  'LYYYYYYYYyyyyyyyyyyyyyy',
  'LYYYYYYYyoKKKKgKKKKKKKy',
  'LYYYYYYYyoKsKKKsKKKsKKs',
  'YYYYYYYyodsssssssssssss',
  'YYYYYYYyodsssssssssssss',
  'YYYYYYYyodsssssssssssss',
  'YYYYYYYyodsssssssssssss',
  'YYYYYYYyodsssssssssssss',
  'yYYYYYYyodsssssssssssss',
  'yYYYYYYyoddssssssssssss',
  'yYYYYYYYyodssssssssssss',
  '.yYYYYYYyodssssssssssd.',
  '..yYYYYYYyoddssssssss..',
  '...yyYYYYyyoddsssssss..',
  '.....yyyy...ddssssss...',
  '............ddsssd.....',
  '..............dddd.....',
];
// 얼굴 위에 찍는 것: [열, 행, 격자]
const BROWS = [11, 9, ['..BB..BB..', 'BB......BB']]; // 가운데가 올라간 걱정 눈썹
const GLASSES = {
  // 렌즈 5×5 두 개 + 코다리. 흰자가 렌즈를 채우고 눈동자는 1×2 점(겁먹어 작아진 눈동자). 2×2로 채우면 선글라스로 읽힌다.
  fwd: [11, 11, ['.FFF...FFF.', 'FawwFFFawwF', 'FwwPF.FwwPF', 'FlwPF.FlwPF', '.FFF...FFF.']],
  back: [11, 11, ['.FFF...FFF.', 'FawwFFFawwF', 'FPwwF.FPwwF', 'FPwlF.FPwlF', '.FFF...FFF.']],
  // 질끈 감은 눈: 렌즈를 가로지르는 한 줄 + 아래 주름 점(3×3 렌즈에서 > <는 동그라미로 읽혀서 뺐다)
  shut: [11, 11, ['.FFF...FFF.', 'FawwFFFawwF', 'FPPPF.FPPPF', 'FlwlF.FlwlF', '.FFF...FFF.']],
  // 자기 소리에 놀란 눈: 렌즈 가운데 1px 눈동자(바늘 눈). 안경은 1px 튀어 오른다(glassesUp).
  wide: [11, 11, ['.FFF...FFF.', 'FawwFFFawwF', 'FwPwF.FwPwF', 'FwwwF.FwwwF', '.FFF...FFF.']],
  // 어질(납작 뒤): 안경이 비뚤어져 뒤 렌즈가 1px 위, 앞 렌즈가 1px 아래. 눈동자는 왼쪽 위 / 오른쪽 아래로 따로 논다.
  askew: [11, 10, ['.FFF.......', 'FPwwF..FFF.', 'FwwwFFFawwF', 'FlwwF.FwwwF', '.FFF..FwwPF', '.......FFF.']],
};
const TEMPLE = [10, 12, ['F']]; // 안경다리(후드 안으로)
const NOSE = [20, 15, ['.tt.', 'tsss', 'ssdd', '.dD.']]; // 작은 단추 코(쭉이 코와 반대로 작다)
const MOUTHS = {
  shake: [13, 18, ['.m.m.m', 'm.m.m.']], // 덜덜 떨리는 입(기본)
  clench: [13, 18, ['mmmmmm', '.m..m.']], // 이를 악문 입(쥐어짜기)
  o: [14, 17, ['.mm.', 'mPPm', 'mPPm', '.mm.']], // 흐익(놀라 벌린 입)
};
const CHEEK = [11, 16, ['cc']];
// 후드 꼭지(머리 격자 기준 (7,−6)에 찍는다): 꼭지 끝은 머리 (14,−6). 손 기준점 (14,−4)보다 2px 위로 솟아 고리 끝을 감싼다
// (쭉이 주먹이 고리와 겹치는 것과 같은 정도). 8·9줄은 정수리로 내려오는 당김 주름.
const SNAG = [
  '.......Y',
  '.......Yy',
  '......LYy',
  '.....LYYy',
  '....LLYYy',
  '..LLLyYYy',
  '.......Yy',
  '....y....',
  '...y.....',
];
const SWEAT = ['.A.', 'AAA', 'AWA', '.A.'];
const HEAD_X = 11, HEAD_Y = 15;
/** 머리 박스(② 칸 좌표, 서 있기 0번 기준). UI 초상화가 24×24로 자른다. */
export const HEAD_BOX = [HEAD_X, HEAD_Y, 24, 24];

// 손 격자. s tan t yelL d woodL D wood(손가락 사이 선)
const HAND_L = { s: C.tan, t: C.yelL, d: C.woodL, D: C.wood };
const HAND = {
  // 앞손: 닭 몸 아래를 받쳐 쥔다(손가락 마디가 보인다)
  front: ['.tts.', 'tsssd', 'sDsDd', '.ddd.'],
  // 뒷손: 닭 등 위로 손가락만 넘어온다
  back: ['tss.', 'sDsd', '.dd.'],
};
// 고무 닭 세부: R red(볏) O hint(부리·다리) k ink(눈)
const CHICK_L = { R: C.red, r: C.redD, O: C.hint, k: C.ink };

function drawLeg(K, side, a, d, bias) {
  const hx = HIP_X[side], hy = HIP_Y + d;
  const ax = hx + a.x;
  const ay = ANKLE_Y - a.lift;
  // 짧은 다리: 무릎은 가운데에서 앞으로(들린 발일수록 더)
  const kx = (hx + ax) / 2 + 0.4 + a.lift * 0.35, ky = (hy + ay) / 2;
  K.limb([[hx, hy, 1.5], [kx, ky, 1.35], [ax, ay - 1.0, 1.3]], R4.pants, { bias });
  // 장화 목(정강이 절반까지), 맨 위 접힌 테
  const ramp = side === 'front' ? R4.boot : R4.bootBack;
  const top = ay - 2.7;
  const tx = ax + (kx - ax) * 0.25;
  K.limb([[tx, top, 1.85], [ax, ay - 0.5, 1.75]], ramp, { bias });
  K.limb([[tx - 0.05, top - 0.2, 2.05], [tx, top + 0.25, 2.0]], ramp, { bias: bias + 0.25 });
  const fr = side === 'front' ? [3.3, 1.9] : [3.0, 1.8];
  const fx = ax + (side === 'front' ? 1.2 : 0.8) + (a.toe ? 0.5 : 0);
  const fy = ay + 1.8 - (a.toe ? 0.4 : 0);
  return K.ball(fx, fy, fr[0], a.toe ? fr[1] * 0.8 : fr[1], ramp, { bias: bias + 0.15 });
}

export function drawFrame(p) {
  if (p.zip !== undefined) return drawZip(p);
  const oy = p.oy ?? 0; // 몸 전체를 위로 올린다(px, 음수 = 위). 발사·매달림
  const K = new Canvas(CELL[0], CELL[1], S, OX, oy);
  const d = u(p.chest);
  const lean = u(p.lean);
  const body = (y) => y + d;
  // 상체 기울기: 위로 갈수록 lean(① y 22에서 lean, 골반에서 0)
  const bx = (x, y) => x + lean * clamp((HIP_Y + d - y) / (HIP_Y - 22), 0, 1);
  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];

  const feet = [];
  feet.push(drawLeg(K, 'back', p.legs.back, d, -0.3));
  feet.push(drawLeg(K, 'front', p.legs.front, d, 0));

  // 뒷팔 소매(우비 뒤, 닭 쪽으로 뻗는다). 손은 닭 등 위에 따로 찍는다.
  K.limb([[bx(12.8, body(27.6)), body(27.6), 1.5], [bx(18.6, body(30.0)), body(30.0), 1.35]], R4.coat, { bias: -0.35 });

  // 우비: 아래로 퍼지는 A라인(큰 타원 아래쪽만). 밑단은 내려앉은 다음 칸에 양 끝이 들린다(종처럼 벌어짐).
  const cx = 14.6, cy = body(38.2), rx = 6.6;
  const hem = HEM_Y + d;
  K.ball(cx, cy, rx, 13.5, R4.coat, {
    clip: (x, y) => y >= body(24.4) && y <= hem - p.flare * 0.9 * Math.min(1, Math.abs(x - cx) / rx) ** 2,
  });

  // 고무 닭: 몸(두 손 사이) → 목 → 머리. 머리는 한 프레임 늦게 까딱인다.
  const ch = u(p.chickHead);
  const sq = p.squash ?? 0; // 0 보통 ~ 1 쥐어짜 납작
  const up = u(p.chickUp ?? 0); // 닭을 가슴께로 끌어올린다
  const cbx = bx(23.4, body(31.6)), cby = body(31.6) - up;
  const chick = K.ball(cbx, cby, 3.2 + 1.0 * sq, 2.5 - 0.9 * sq, R4.chick);
  K.ball(cbx - 2.6, cby - 0.9, 1.3, 1.0, R4.chick, { bias: 0.1 }); // 꼬리
  const hx = bx(26.0, body(27.2)), hy = body(27.2) - up + ch;
  K.limb([[cbx + 1.4, cby - 1.2, 1.15], [hx - 0.3, hy + 0.9, 1.0]], R4.chick, { line: false });
  const chickHead = K.ball(hx, hy, 1.75, 1.85, R4.chick);

  // 앞팔 소매: 어깨 → 팔꿈치 → 닭 아래(소매가 길어 손등까지 덮는다)
  const sx = bx(16.6, body(27.8)), sy = body(27.8);
  K.limb([[sx, sy, 1.6], [bx(18.0, body(31.4)), body(31.4), 1.5], [cbx - 2.2, cby + 1.2, 1.55]], R4.coat);
  colorLines(K, LINE);

  // 닭 세부: 볏·부리·눈·늘어진 다리
  {
    const [x, y] = P(hx, hy);
    K.stamp(x - 1, y - 4, ['.R.R', 'RRrR'], CHICK_L, chickHead);
    // 부리: 쥐어짜면 쩍 벌어진다(위 부리 / 목구멍 / 아래 부리)
    K.stamp(x + 2, y - 1, p.beakOpen ? ['OOO.', 'r...', 'OOOO'] : ['OO.', 'OOO', 'Or.'], CHICK_L, chickHead);
    K.stamp(x, y - 1, ['k'], CHICK_L);
    const [lx, ly] = P(cbx - 0.6, cby + 2.2);
    K.stamp(lx, ly, ['O.O', 'O.O', 'OOOO'], CHICK_L, chick);
  }

  // 손(격자): 앞손은 닭 배 아래, 뒷손은 닭 등 위
  const handPart = K.part(R4.skin);
  {
    const [x, y] = P(cbx - 1.6, cby + 0.6 - 0.6 * sq);
    K.stamp(x - 2, y - 1, HAND.front, HAND_L, handPart);
  }
  {
    const [x, y] = P(cbx + 0.6, cby - 2.0 + 0.8 * sq);
    K.stamp(x - 1, y - 1, HAND.back, HAND_L, handPart);
  }

  // 우비 세부: 앞섶 선, 단추(나무 토글), 주머니, 명찰
  const coatL = { y: C.yelD, b: C.woodD, w: C.wood, A: C.aqua, t: C.tealM };
  {
    const [x0, y0] = P(bx(18.4, body(28.4)), body(28.4));
    const [, y1] = P(0, hem - 0.6);
    for (let y = y0; y <= y1; y++) if (K.get(x0, y) !== -1 && K.get(x0, y) !== C.ink) K.dot(x0, y, C.yelD);
    for (const ty of [31.0, 34.6, 37.6]) {
      const [x, y] = P(bx(18.4, body(ty)), body(ty));
      K.stamp(x - 1, y, ['bw'], coatL);
    }
  }
  K.stamp(...P(bx(11.0, body(34.6)), body(34.6)), ['yyyy', 'y..y', 'yyyy'], coatL); // 주머니
  K.stamp(...P(bx(15.4, body(28.2)), body(28.2)), ['AAA', 'AtA'], coatL); // 명찰(셋이 같은 직원 명찰)

  // 머리: 상체와 같은 정수 px만큼 내리고 lean만큼 앞으로
  const hx0 = HEAD_X + p.lean, hy0 = HEAD_Y + p.chest + oy;
  const headPart = K.part(R4.skin);
  K.stamp(hx0, hy0, HEAD, HL, headPart);
  // 고리에 걸린 후드 꼭지: 정수리 천이 텐트처럼 당겨져 손 기준점(hand)까지 솟는다. 당긴 주름이 정수리로 내려온다.
  if (p.snag) K.stamp(hx0 + 7, hy0 - 6, SNAG, HL, headPart);
  const gUp = p.glassesUp ?? 0; // 안경·눈썹이 튀어 오른다(놀람)
  for (const [cx2, cy2, rows] of [[BROWS[0], BROWS[1] - gUp, BROWS[2]], [...GLASSES[p.eyes].slice(0, 1), GLASSES[p.eyes][1] - gUp, GLASSES[p.eyes][2]], TEMPLE, NOSE, MOUTHS[p.mouth ?? 'shake'], CHEEK])
    K.stamp(hx0 + cx2, hy0 + cy2, rows, HL, headPart);
  if (p.sweat >= 0) K.stamp(hx0 + 21, hy0 + 1 + p.sweat, SWEAT, { A: C.tealM, W: C.white }, K.part(R4.chick));

  rimShade(K, new Set([headPart, handPart]), DOWN);
  soles(K, feet, C.redD);
  // 납작(common.flatten): 안경(10~15행)과 입(17~20행)은 누르지 않고 그대로 옮긴다
  if (p.flat) squash(K, { ...p.flat, keep: [[hy0 + 10, hy0 + 15], [hy0 + 17, hy0 + 20]] });
  K.outline();
  if (p.fx) p.fx(K, { beak: P(hx, hy), head: [hx0, hy0] }); // 소리선·놀람선: 외곽선 없이(ADR-0007 결정 3-1)
  return { K, feet, hand: p.hand, facing: p.facing };
}

// ══════════ 화면 1 자세 (#142, 설계 docs/design/screens/magpie_nest.md) ══════════
// common.squeeze_chicken  공용 "삑"(능력 동작). 까치·둥지·시소·바닥 어디에 삑 해도 같은 그림. "삑!" 글자는 엔진 fx(squeak_text)다.
//   개그: 겁 많은 삑삑이가 자기가 낸 소리에 제일 놀란다.
//   0 준비(닭을 가슴께로 끌어올리고 눈을 질끈, 무릎을 모은다) → 1 꽉!(닭이 납작해지고 목이 쭉, 부리가 쩍, 소리선)
//   → 2 흐익(몸을 젖히고 안경이 튀어 오른다, 바늘 눈, 놀람선, 닭은 부풀며 머리가 늦게 내려온다). 합 1000ms ≤ 1500.
//   서 있기와 같은 drawFrame에 닭 납작(squash)·끌어올림(chickUp)·부리·얼굴·효과만 더한다. 방향은 고정하지 않는다.
/** 부리 앞 소리선(외곽선 없음): 위·앞·아래로 퍼지는 짧은 선 3개. 몸 위에는 그리지 않는다. */
function soundLines(K, { beak: [x, y] }) {
  const rays = [
    [[x + 6, y - 3, C.white], [x + 7, y - 4, C.white], [x + 8, y - 5, C.cotton]],
    [[x + 7, y, C.white], [x + 8, y, C.white], [x + 9, y, C.cotton]],
    [[x + 6, y + 3, C.white], [x + 7, y + 4, C.white], [x + 8, y + 5, C.cotton]],
  ];
  for (const ray of rays) for (const [rx, ry, c] of ray) if (K.get(rx, ry) === -1) K.dot(rx, ry, c);
}
/** 놀람선(외곽선 없음): 후드 위로 튀는 짧은 선 3개. */
function startle(K, { head: [hx, hy] }) {
  const rays = [
    [[hx + 2, hy - 1, C.cotton], [hx + 1, hy - 2, C.white], [hx, hy - 3, C.white]],
    [[hx + 9, hy - 3, C.cotton], [hx + 9, hy - 4, C.white], [hx + 9, hy - 5, C.white]],
    [[hx + 17, hy - 1, C.cotton], [hx + 18, hy - 2, C.white], [hx + 19, hy - 3, C.white]],
  ];
  for (const ray of rays) for (const [rx, ry, c] of ray) if (K.get(rx, ry) === -1) K.dot(rx, ry, c);
}
const SQUEEZE = [
  { // 0 준비: 닭을 가슴께로, 무릎 모으고 움츠림, 눈 질끈 + 이 악물기
    chest: 2, lean: 0,
    legs: { back: { x: -0.3, lift: 0, toe: false }, front: { x: 0.4, lift: 0, toe: false } },
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: 0, chickUp: 2, flare: 0,
  },
  { // 1 꽉!: 더 움츠리고 두 손으로 쥐어짠다. 닭은 납작, 목이 위로 튀고 부리가 쩍
    chest: 3, lean: 0,
    legs: { back: { x: -0.3, lift: 0, toe: false }, front: { x: 0.4, lift: 0, toe: false } },
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: -3, chickUp: 2, squash: 1, beakOpen: true, flare: 0,
    fx: soundLines,
  },
  { // 2 흐익: 자기 소리에 놀라 몸을 젖힌다. 안경 튐 + 바늘 눈 + 벌린 입, 땀 한 방울. 닭은 부풀고 머리가 늦게 내려온다
    chest: 0, lean: -2,
    legs: { back: { x: -1.6, lift: 0, toe: false }, front: { x: 1.9, lift: 0, toe: true } },
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: 0, chickHead: 2, chickUp: 1, flare: 1,
    fx: startle,
  },
];

// hold  U7 매달려 삑삑삑(대기, 설계 7절). 짧은 팔로는 고리에 손이 안 닿는다 → 날아가다 **후드 꼭지가 고리에 꿰여** 대롱대롱.
//   두 손은 여전히 고무 닭(캐릭터 단서 그대로). 겁에 질려 닭을 쥐어짰다 놨다 → 삑! 삑! 다리는 번갈아 허우적.
//   "잘못 고른 사람" 단서(C5): 매달린 삑삑이는 아무것도 못 하고 삑삑대기만 한다. 손 놓기(3번)는 후드가 빠지는 것으로 읽힌다(L04 "떨어진다!").
//   손 기준점 = 후드 꼭지 (25,4). 왼쪽(기둥·둥지)을 본다(쭉이와 같은 방향): 뒤집으면 47 − 25 = 22열 → 화면 136 + 22 = 158 = 고리 손 기준점.
//   몸이 짧아 발이 바닥 행에 안 닿는다(매달린 칸은 build.mjs 바닥 검사 대신 손 기준점 검사).
export const HOLD_HAND = [25, 4];
export const HOLD_FACING = -1;
const HANG = -7; // 후드 꼭대기 15행 → 8행
const HOLD = [
  { // 0 꽉! 삑: 닭을 쥐어짜 부리가 쩍, 바늘 눈 + 벌린 입. 앞발을 차 올린다
    chest: 0, lean: 0, oy: HANG, snag: true, hand: HOLD_HAND, facing: HOLD_FACING,
    legs: { back: { x: -0.4, lift: 0, toe: true }, front: { x: 1.4, lift: 2.4, toe: true } },
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: 0, chickHead: -3, chickUp: 2, squash: 1, beakOpen: true, flare: 1,
    fx: soundLines,
  },
  { // 1 놓음: 닭이 부풀고 머리가 까딱, 눈 질끈 + 덜덜 입, 땀이 흘러내린다. 뒷발을 찬다
    chest: 0, lean: 0, oy: HANG, snag: true, hand: HOLD_HAND, facing: HOLD_FACING,
    legs: { back: { x: 0.6, lift: 2.0, toe: true }, front: { x: 0.2, lift: 0, toe: true } },
    eyes: 'shut', mouth: 'shake', sweat: 1, chickHead: 1, chickUp: 1, flare: 0,
  },
];

// launch_to_hook  공용 발사 포즈 이동(설계 12번, 쭉이 U2와 같은 박자 150/100/100/150).
//   0 꾹: 널빤지 반동에 깊게 주저앉고 놀라 닭을 쥐어짠다 → 1 솟음: 몸이 위로, 닭을 머리 위로 치켜들고 비명, 장화는 처진다
//   → 2 사라짐: 속도선만 → 3 먼지 + 남겨진 땀방울 하나가 떨어진다. 고리에서 hold로 나타난다. 방향은 고정하지 않는다.
const LAUNCH = [
  {
    chest: 6, lean: 0,
    legs: { back: { x: -2.0, lift: 0, toe: false }, front: { x: 2.2, lift: 0, toe: false } },
    eyes: 'wide', mouth: 'clench', glassesUp: 1, sweat: -1, chickHead: -2, chickUp: 0, squash: 1, beakOpen: true, flare: 1,
    fx: (K) => puff(K, 6, 0),
  },
  {
    chest: 0, lean: -1, oy: -6,
    legs: { back: { x: -0.6, lift: 0.8, toe: true }, front: { x: 0.8, lift: 0.4, toe: true } },
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: -1, chickHead: -3, chickUp: 4, flare: 1,
    fx: (K, at) => { startle(K, at); puff(K, 24, 1); },
  },
  { zip: 2 },
  { zip: 3 },
];
// common.flatten  공용 "납작"(묵직이 mukjik.mjs와 같은 박자, art/lib/squash.mjs). 서 있기 몸을 바닥 기준으로 누른다.
//   개그: 눌리는 순간 품에 안은 고무 닭도 같이 눌려 부리가 쩍 벌어진다(삑삑이는 납작해져도 닭부터 운다).
//   0 꽝(반쯤, 닭 눌림) → 1 납작(가장 눌림, 먼지) → 2 뿅(가늘게 솟고 안경 튐) → 3 어질(제 키, 안경이 비뚤어지고 입은 덜덜).
//   "삑!" 글자는 그리지 않는다(엔진 fx, #199 칸 신호). 화면 데이터가 필요하면 0번 칸에 신호를 단다.
const FLAT_LEGS = { back: { x: -0.3, lift: 0, toe: false }, front: { x: 0.4, lift: 0, toe: false } };
const FLATTEN = [
  { // 0 꽝: 반쯤 눌림. 닭도 눌려 부리가 쩍
    chest: 3, lean: 0, legs: FLAT_LEGS,
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: -3, chickUp: 2, squash: 1, beakOpen: true, flare: 1,
    flat: { sx: 1.3, sy: 0.55 },
  },
  { // 1 납작: 가장 눌림. 우비 밑단이 옆으로 퍼지고 먼지
    chest: 3, lean: 0, legs: FLAT_LEGS,
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: -3, chickUp: 2, squash: 1, beakOpen: true, flare: 1,
    flat: { sx: 1.4, sy: 0.42 },
    fx: (K) => { puff(K, 7, 0, { behind: true }); puff(K, 41, 0, { behind: true }); },
  },
  { // 2 뿅: 가늘고 길게 솟는다. 안경이 튀고 바늘 눈, 닭은 부풀며 머리가 늦게 내려온다
    chest: 0, lean: 0, legs: { back: { x: -0.9, lift: 0, toe: false }, front: { x: 1.0, lift: 0, toe: false } },
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: -1, chickHead: 2, chickUp: 1, flare: 0,
    flat: { sx: 0.86, sy: 1.12 },
    fx: (K) => puff(K, 24, 2, { behind: true }),
  },
  { // 3 어질: 비뚤어진 안경, 따로 노는 눈동자, 덜덜 입, 땀 한 방울
    chest: 1, lean: 0, legs: { back: { x: -0.9, lift: 0, toe: false }, front: { x: 1.0, lift: 0, toe: false } },
    eyes: 'askew', mouth: 'shake', sweat: 0, chickHead: 1, chickUp: 0, flare: 0,
  },
];

/** 사라진 칸(launch_to_hook 2·3): 속도선·먼지만(외곽선 없음). 3번 칸에는 남겨진 땀방울이 떨어진다. */
function drawZip(p) {
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  if (p.zip === 2) {
    streaks(K, [[17, 0, 36], [22, 0, 48], [27, 0, 42], [32, 4, 28]]);
    puff(K, 24, 1);
  } else {
    streaks(K, [[20, 0, 12], [25, 0, 18], [30, 2, 9]]);
    K.stamp(23, 30, SWEAT, { A: C.tealM, W: C.white });
    puff(K, 24, 2);
  }
  return { K, feet: [] };
}

export const SHEET = {
  name: 'ppik-base',
  character: 'ppik',
  walkCycle: 24,
  anims: [
    { name: 'idle', frames: 2, ms: [700, 450] },
    { name: 'walk', frames: 6, by: 'distance' },
    { name: 'common.squeeze_chicken', frames: 3, ms: [200, 350, 450] },
    { name: 'hold', frames: 2, ms: [300, 450] },
    { name: 'launch_to_hook', frames: 4, ms: [150, 100, 100, 150] },
    { name: 'common.flatten', frames: 4, ms: [100, 600, 150, 450] },
  ],
  pose,
  drawFrame,
};
