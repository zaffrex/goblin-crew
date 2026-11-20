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
import { puff, shadow, streaks, drops } from '../lib/fx.mjs';
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
  // 젖은 우비(common.wet 1~3번): 물을 먹어 한 단 어둡고 빛(yelL)이 빠진다. 첫 색이 같아서 안쪽 경계선(LINE)은 그대로다
  coatWet: [C.yelD, C.yelD, C.yel, C.yel],
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
  if (kind === 'common.bump_bottom') return BUMP[k];
  if (kind === 'common.shiver') return SHIVER[k];
  if (kind === 'common.wag_finger') return WAG[k];
  if (kind === 'hide_in_basket') return HIDE[k];
  if (kind === 'step_up') return STEP_UP[k];
  if (kind === 'common.wet') return WET[k];
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
  A: C.tealL, M: C.tealM, // 렌즈에 찬 물(common.wet)
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
// 젖은 후드(common.wet 1~3번): 물을 먹어 정수리가 2행 납작해지고(빛 L이 가는 줄로 남는다), 처진 챙이 앞머리와 눈썹을 덮는다(9행).
//   물 자국(y 세로 줄)이 후드에 몇 줄 진다. 챙 밑 그늘(10행)이 안경 바로 위에 붙는다. 쭉이 젖은 앞머리·묵직이 흘러내린 띠와 같은 "젖어서 눈가가 가린다" 웃음을 삑삑이는 후드 + 물안경으로 한다.
//   0~10행만 바꾸고 11행부터(안경·코·입·턱)는 HEAD 그대로다.
const WET_HOOD = [
  '.......................',
  '.......................',
  '.....yLYYYYYLYYYy......',
  '...yLYYYYYYYYYYLYYy....',
  '..yLYYYYYYYYYYYYYYYy...',
  '.yLYYYYYyYYYYYYyYYYYy..',
  'yLYYYYYYyYYYYYYyYYYYYy.',
  'LYYYyYYYYYYYYYYYYYyYYYy',
  'LYYYyYYYYYYYYYYYYYyYYYy',
  'YYYYYYYyyyyyyyyyyyyyyyy',
  'YYYYYYYyooddddddddddddd',
];
for (const row of WET_HOOD) if (row.length !== 23) throw new Error(`[ppik] 젖은 후드 줄 길이 ${row.length}: ${row}`);
const WET_HEAD = [...WET_HOOD, ...HEAD.slice(WET_HOOD.length)];
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
  // 올려다봄(몸서리 0번): 눈동자가 렌즈 위쪽에 붙는다
  up: [11, 11, ['.FFF...FFF.', 'FwwPFFFwwPF', 'FwwPF.FwwPF', 'FlwwF.FlwwF', '.FFF...FFF.']],
  // 내려다봄(빼꼼, "아, 내 닭이구나"): 눈동자가 렌즈 앞쪽 아래에 붙는다
  down: [11, 11, ['.FFF...FFF.', 'FawwFFFawwF', 'FwwwF.FwwwF', 'FlwPF.FlwPF', '.FFF...FFF.']],
  // 물 찬 안경(common.wet 1번, "물안경"): 렌즈 아래 두 줄이 물(A 밝은 물, M 물 바닥). 눈동자는 물 위에 둥둥 뜬다
//   (맨 윗줄에 두면 테와 붙어서 안 보인다. 위에 흰 줄 하나를 남겨 "물 위 공기"로 쓴다).
  flood: [11, 11, ['.FFF...FFF.', 'FwwwFFFwwwF', 'FAPAF.FAPAF', 'FMAMF.FMAMF', '.FFF...FFF.']],
  // 털다가 출렁(common.wet 2번): 물이 몸 반대쪽(뒤)으로 기운다. 눈동자는 물 위로 밀려 앞쪽 위
  slosh: [11, 11, ['.FFF...FFF.', 'FAwPFFFAwPF', 'FAAwF.FAAwF', 'FMAAF.FMAAF', '.FFF...FFF.']],
  // 반쯤 빠짐(common.wet 3번): 물은 맨 아랫줄만 남고 눈동자가 물 바로 위에서 앞을 본다
  drain: [11, 11, ['.FFF...FFF.', 'FawwFFFawwF', 'FwwPF.FwwPF', 'FAMAF.FAMAF', '.FFF...FFF.']],
  askew: [11, 10, ['.FFF.......', 'FPwwF..FFF.', 'FwwwFFFawwF', 'FlwwF.FwwwF', '.FFF..FwwPF', '.......FFF.']],
};
const TEMPLE = [10, 12, ['F']]; // 안경다리(후드 안으로)
const NOSE = [20, 15, ['.tt.', 'tsss', 'ssdd', '.dD.']]; // 작은 단추 코(쭉이 코와 반대로 작다)
const MOUTHS = {
  shake: [13, 18, ['.m.m.m', 'm.m.m.']], // 덜덜 떨리는 입(기본)
  clench: [13, 18, ['mmmmmm', '.m..m.']], // 이를 악문 입(쥐어짜기)
  o: [14, 17, ['.mm.', 'mPPm', 'mPPm', '.mm.']], // 흐익(놀라 벌린 입)
  prim: [14, 18, ['mmmm', '.DD.']], // 새침하게 다문 입(안 돼요)
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
// 세운 검지(안 돼요). 주먹 4×3 위로 검지 2px, 끝 마디가 까딱인다. [뒤로 / 곧게 / 앞으로]
const FINGER = [
  ['tt...', '.st..', '.ss..', '.ss..', 'tsss.', 'tsssd', 'sDsDd', '.ddd.'],
  ['.tt..', '.st..', '.ss..', '.ss..', 'tsss.', 'tsssd', 'sDsDd', '.ddd.'],
  ['..tt.', '.st..', '.ss..', '.ss..', 'tsss.', 'tsssd', 'sDsDd', '.ddd.'],
];
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
  if (p.hide !== undefined) return drawHide(p);
  const oy = p.oy ?? 0; // 몸 전체를 위로 올린다(px, 음수 = 위). 발사·매달림
  const dx = p.dx ?? 0; // 몸 전체를 옆으로(px, 정수). 몸서리
  const K = new Canvas(CELL[0], CELL[1], S, OX + dx, oy);
  const d = u(p.chest);
  const lean = u(p.lean);
  const body = (y) => y + d;
  // 상체 기울기: 위로 갈수록 lean(① y 22에서 lean, 골반에서 0)
  const bx = (x, y) => x + lean * clamp((HIP_Y + d - y) / (HIP_Y - 22), 0, 1);
  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  const coat = p.wet ? R4.coatWet : R4.coat;

  const feet = [];
  feet.push(drawLeg(K, 'back', p.legs.back, d, -0.3));
  feet.push(drawLeg(K, 'front', p.legs.front, d, 0));

  // 뒷팔 소매(우비 뒤, 닭 쪽으로 뻗는다). 손은 닭 등 위에 따로 찍는다.
  K.limb([[bx(12.8, body(27.6)), body(27.6), 1.5], [bx(18.6, body(30.0)), body(30.0), 1.35]], coat, { bias: -0.35 });

  // 우비: 아래로 퍼지는 A라인(큰 타원 아래쪽만). 밑단은 내려앉은 다음 칸에 양 끝이 들린다(종처럼 벌어짐).
  const cx = 14.6, cy = body(38.2), rx = 6.6;
  const hem = HEM_Y + d;
  K.ball(cx, cy, rx, 13.5, coat, {
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

  // 앞팔 소매: 어깨 → 팔꿈치 → 닭 아래(소매가 길어 손등까지 덮는다).
  // 손가락질(p.point)이면 닭은 뒷손에 맡기고 앞팔을 얼굴 앞으로 세운다(손은 머리 다음에 찍는다).
  const sx = bx(16.6, body(27.8)), sy = body(27.8);
  const pt = p.point && { x: bx(28.2 + p.point.x, body(25.0)), y: body(25.0) };
  if (pt) K.limb([[sx, sy, 1.6], [bx(22.0, body(31.2)), body(31.2), 1.5], [pt.x, pt.y, 1.45]], coat);
  else K.limb([[sx, sy, 1.6], [bx(18.0, body(31.4)), body(31.4), 1.5], [cbx - 2.2, cby + 1.2, 1.55]], coat);
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
  if (!pt) {
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
  const hx0 = HEAD_X + p.lean + dx, hy0 = HEAD_Y + p.chest + oy;
  const headPart = K.part(R4.skin);
  K.stamp(hx0, hy0, p.wet ? WET_HEAD : HEAD, HL, headPart);
  // 고리에 걸린 후드 꼭지: 정수리 천이 텐트처럼 당겨져 손 기준점(hand)까지 솟는다. 당긴 주름이 정수리로 내려온다.
  if (p.snag) K.stamp(hx0 + 7, hy0 - 6, SNAG, HL, headPart);
  const gUp = p.glassesUp ?? 0; // 안경·눈썹이 튀어 오른다(놀람)
  const brows = p.wet ? [] : [[BROWS[0], BROWS[1] - gUp, BROWS[2]]]; // 젖은 후드 챙이 눈썹을 덮는다
  for (const [cx2, cy2, rows] of [...brows, [...GLASSES[p.eyes].slice(0, 1), GLASSES[p.eyes][1] - gUp, GLASSES[p.eyes][2]], TEMPLE, NOSE, MOUTHS[p.mouth ?? 'shake'], CHEEK])
    K.stamp(hx0 + cx2, hy0 + cy2, rows, HL, headPart);
  if (p.sweat >= 0) K.stamp(hx0 + 21, hy0 + 1 + p.sweat, SWEAT, { A: C.tealM, W: C.white }, K.part(R4.chick));
  // 세운 검지(머리 앞에 찍는다): 소매 끝에서 주먹, 그 위로 검지가 까딱(tilt −1 뒤 / 0 곧게 / 1 앞)
  if (pt) {
    const [x, y] = P(pt.x, pt.y);
    K.stamp(x - 2, y - 8, FINGER[p.point.tilt + 1], HAND_L, handPart);
  }

  rimShade(K, new Set([headPart, handPart]), DOWN);
  soles(K, feet, C.redD);
  // 납작(common.flatten): 안경(10~15행)과 입(17~20행)은 누르지 않고 그대로 옮긴다
  if (p.flat) squash(K, { ...p.flat, keep: [[hy0 + 10, hy0 + 15], [hy0 + 17, hy0 + 20]] });
  K.outline();
  if (p.fx) p.fx(K, { beak: P(hx, hy), head: [hx0, hy0] }); // 소리선·놀람선: 외곽선 없이(ADR-0007 결정 3-1)
  return { K, feet, hand: p.hand, facing: p.facing };
}

// ══════════ 화면 1 자세 (#142, 설계 docs/design/screens/magpie_nest.md) ══════════
// common.squeeze_chicken  공용 "삑"(능력 동작). 까치·둥지·시소·바닥 어디에 삑 해도 같은 그림. "삑!" 글자는 엔진 fx(squeak_text)이고, 칸 신호 cue로 1번(꽉!) 칸에 뜬다.
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

// common.bump_bottom  공용 "엉덩방아"(쭉이 jjuk-v4.mjs와 같은 박자). 고리에서 손 놓기(3번, 바구니 착지 점)와
//   반대쪽 발사(14번, 빨랫줄에 걸렸다 떨어짐)에서 나온다. 엔진에 떨어지는 궤적이 없어서(release = 순간 배치) 0번 칸이 "위에서 떨어지는 중"을 맡는다.
//   개그: 엉덩이가 바닥에 닿는 순간 품의 고무 닭이 먼저 운다(납작과 같은 단서). 우비가 종처럼 내려앉아 앉은 삑삑이는 노란 텐트 + 장화 두 짝이 된다.
//   0 낙하(몸은 칸 위쪽, 장화가 대롱대롱, 닭을 치켜든 비명, 위로 끊기는 속도선, 착지 자리 그림자)
//   → 1 쿵(엉덩이로 앉으며 눌림, 장화가 튀어 오르고 닭 부리 쩍, 양옆 먼지) → 2 아야(뒤로 기울어 휘청, 바늘 눈 + 벌린 입)
//   → 3 멍(앉은 채 비뚤어진 안경, 덜덜 입, 땀, 닭 머리 축 처짐). 말풍선 동안 3번 칸이 남는다(#193).
//   앉은 몸 = 서 있기 몸을 chest 10(① 7.5)만큼 내린 것: 골반 45.5, 우비 밑단이 바닥 행에 닿는다. 방향은 고정하지 않는다.
const SIT = 10;
const BUMP = [
  { // 0 낙하: 칸 위쪽에서 떨어진다(oy, 후드가 칸 위 끝에 닿는 만큼). 장화는 대롱대롱, 닭을 치켜들고 비명
    chest: 0, lean: -1, oy: -14,
    legs: { back: { x: -0.8, lift: 0.4, toe: true }, front: { x: 1.6, lift: 1.4, toe: true } },
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: -1, chickHead: -2, chickUp: 4, flare: 1,
    fx: (K) => { streaks(K, [[5, 2, 22], [9, 0, 14], [40, 4, 20], [44, 0, 12]], { fall: true }); shadow(K, 24, 18); },
  },
  { // 1 쿵: 엉덩이로 털썩. 몸이 눌리고 장화가 튀어 오른다. 닭도 눌려 부리가 쩍
    chest: SIT, lean: 0,
    legs: { back: { x: 6.4, lift: 3.0, toe: true }, front: { x: 8.4, lift: 5.0, toe: true } },
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: -3, chickUp: 4, squash: 1, beakOpen: true, flare: 1,
    flat: { sx: 1.12, sy: 0.84 },
    fx: (K) => { puff(K, 6, 1, { behind: true }); puff(K, 41, 0, { behind: true }); },
  },
  { // 2 아야: 반동에 뒤로 휘청. 장화는 바닥에 털썩, 바늘 눈 + 벌린 입, 닭은 부풀며 머리가 늦게 내려온다
    chest: SIT, lean: -2,
    legs: { back: { x: 6.8, lift: 0, toe: false }, front: { x: 8.6, lift: 0.8, toe: true } },
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: 0, chickHead: 2, chickUp: 3, flare: 0,
    fx: (K) => puff(K, 24, 2, { behind: true }),
  },
  { // 3 멍: 앉은 채 비뚤어진 안경, 덜덜 입, 땀. 닭 머리는 축 처진다
    chest: SIT, lean: 0,
    legs: { back: { x: 6.8, lift: 0, toe: false }, front: { x: 8.4, lift: 0, toe: false } },
    eyes: 'askew', mouth: 'shake', sweat: 1, chickHead: 2, chickUp: 2, flare: 0,
  },
];

// ── 짧은 반응 3개(묶음 ⑥). 셋 다 삑삑이 능력(삑)을 장난감·고리에 썼을 때의 기본 반응이고, 삑 동작 대신 성격을 연기한다.
//   설계 4절 표: 고리 L23 "몸서리", 내복 L31 "손가락을 흔들며 말린다", 바구니 L28 "자기 삑에 놀라 숨었다 고개만"(U9).
//   마지막 칸이 말풍선 동안 남는다(#193). 그래서 마지막 칸 = 대사와 같은 표정이다.

/** 덜덜 선(외곽선 없음): 몸 윤곽 양옆에 짧은 세로 선 두 줄씩. side 0/1로 위아래를 엇갈린다(떨림). rows = 몸 높이 중 어디에 둘지(② 행). */
function tremble(K, side, rows = [30, 40]) {
  const b = K.bbox(rows[0], rows[1]);
  if (!b) return;
  const o = side ? 2 : 0;
  const y0 = rows[0] + 1;
  const marks = [[b.x - 2, y0 + o, 4], [b.x - 4, y0 + 2 + o, 3], [b.x + b.w + 1, y0 + 2 - o, 4], [b.x + b.w + 3, y0 + 4 - o, 3]];
  for (const [x, y, n] of marks)
    for (let j = 0; j < n; j++) if (K.get(x, y + j) === -1) K.dot(x, y + j, j === 0 || j === n - 1 ? C.lint : C.white);
}

// common.shiver  공용 "몸서리"(무서운 것을 보거나 떠올림). 화면 1은 고리(L23 "저기 매달리면 / 무섭겠다…").
//   0 올려다봄(무서운 쪽을 보고 굳는다, 닭을 끌어안음) → 1·2 부르르(몸 전체가 1px씩 좌우로 떨리고, 눈 질끈·이 악물기, 닭도 같이 눌린다)
//   → 3 움츠림(닭을 턱밑까지 끌어안고 덜덜 입 + 땀, 말풍선 동안 남는 칸). 위를 보는 건 0번 칸뿐이라 다른 화면에서도 쓸 수 있다.
const SHIVER_LEGS = { back: { x: -0.3, lift: 0, toe: false }, front: { x: 0.4, lift: 0, toe: false } }; // 무릎 모으기
const SHIVER = [
  { // 0 올려다봄: 상체를 살짝 젖히고 눈동자가 위로. 닭을 가슴께로
    chest: 1, lean: -1, legs: SHIVER_LEGS,
    eyes: 'up', mouth: 'shake', sweat: -1, chickHead: 0, chickUp: 2, flare: 0,
  },
  { // 1 부르르(뒤로 1px): 눈 질끈, 이 악물기, 닭 반쯤 눌림
    chest: 2, lean: 0, dx: -1, legs: SHIVER_LEGS,
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: -1, chickUp: 3, squash: 0.5, flare: 1,
    fx: (K) => tremble(K, 0),
  },
  { // 2 부르르(앞으로 1px)
    chest: 2, lean: 0, dx: 1, legs: SHIVER_LEGS,
    eyes: 'shut', mouth: 'clench', sweat: -1, chickHead: 1, chickUp: 3, squash: 0.5, flare: 1,
    fx: (K) => tremble(K, 1),
  },
  { // 3 움츠림: 닭을 턱밑까지, 덜덜 입, 땀
    chest: 3, lean: 0, legs: SHIVER_LEGS,
    eyes: 'fwd', mouth: 'shake', sweat: 0, chickHead: 0, chickUp: 4, flare: 0,
    fx: (K) => tremble(K, 0),
  },
];

// common.wag_finger  공용 "안 돼요"(규칙 지키는 막내 알바). 화면 1은 내복(L31 "손님 빨래는 / 건드리면 안 돼요").
//   닭을 처음으로 한 손에 맡기고(뒷손이 등을 꼭 쥔다) 앞손 검지를 얼굴 앞에 세운다. 눈은 새침하게 감고 입을 다문다.
//   0 세움(곧게) → 1 까딱(뒤로) → 2 까딱(앞으로) → 3 곧게 + 실눈 뜨고 힐끔(말풍선 동안 남는 칸). 닭 머리는 손가락 반대로 까딱.
const WAG_LEGS = { back: { x: -0.9, lift: 0, toe: false }, front: { x: 1.0, lift: 0, toe: false } };
const WAG = [
  { chest: 0, lean: -1, legs: WAG_LEGS, eyes: 'shut', mouth: 'prim', sweat: -1, chickHead: 0, chickUp: 1, flare: 0, point: { x: 0, tilt: 0 } },
  { chest: 0, lean: -1, legs: WAG_LEGS, eyes: 'shut', mouth: 'prim', sweat: -1, chickHead: 1, chickUp: 1, flare: 0, point: { x: -0.8, tilt: -1 } },
  { chest: 0, lean: -1, legs: WAG_LEGS, eyes: 'shut', mouth: 'prim', sweat: -1, chickHead: -1, chickUp: 1, flare: 0, point: { x: 0.8, tilt: 1 } },
  { chest: 0, lean: -1, legs: WAG_LEGS, eyes: 'fwd', mouth: 'prim', sweat: -1, chickHead: 0, chickUp: 1, flare: 0, point: { x: 0, tilt: 0 } },
];

// hide_in_basket  U9 "자기 삑에 놀라 숨었다가 고개만 내밀기"(L28 "깜짝이야! / …아, 내 닭이구나").
//   설계 7절 U9는 "바구니에 쏙"이었지만, 삑 행동은 대상 앞까지 걷지 않아서(ui-interaction 5-1절, #219) 삑삑이는 바구니에서 멀리 서 있을 수 있다.
//   그래서 바구니 대신 **자기 우비 속으로** 거북이처럼 쏙 숨는다(어디서 삑 해도 같은 그림). 이름은 화면 데이터 키라 그대로 둔다.
//   0 꽉!(닭을 쥐어짜 삑, 소리선) → 1 흐익(자기 소리에 놀라 젖힘) → 2 쏙(머리·닭이 우비 속으로, 후드 꼭대기와 장화 코만 보인다, 우비가 노란 텐트로 바닥까지)
//   → 3 빼꼼(옷깃 위로 안경만 올라오고, 앞섶 사이로 닭 머리가 같이 빼꼼. 눈동자는 닭을 내려다본다 = "아, 내 닭이구나").
const HIDE = [
  { ...SQUEEZE[1] },
  { ...SQUEEZE[2] },
  { hide: 0 },
  { hide: 1 },
];

/** 우비 속에 숨은 칸(hide_in_basket 2·3). 서 있기 몸을 쓰지 않고 텐트(우비) + 머리 윗부분 + 장화 코만 그린다. */
function drawHide(p) {
  const K = new Canvas(CELL[0], CELL[1], S, OX, 0);
  const peek = p.hide === 1;
  // 장화 코: 텐트 밑단 아래로 두 짝(앞 장화가 한 단 밝다)
  const feet = [
    K.ball(10.8, 46.0, 3.1, 2.0, R4.bootBack, { bias: -0.15 }),
    K.ball(19.6, 46.0, 3.4, 2.0, R4.boot, { bias: 0.15 }),
  ];
  // 머리: 옷깃 선(collar, ② 행) 위로 visible 행만 남는다. 텐트를 머리 다음에 그려서 아래를 덮는다.
  const collar = 44;
  const visible = peek ? 16 : 8; // 쏙: 후드 꼭대기만 / 빼꼼: 안경까지
  const hx0 = HEAD_X + (peek ? 0 : -1), hy0 = collar - visible;
  const headPart = K.part(R4.skin);
  K.stamp(hx0, hy0, HEAD, HL, headPart);
  if (peek) {
    for (const [cx, cy, rows] of [[BROWS[0], BROWS[1] - 1, BROWS[2]], GLASSES.down, TEMPLE])
      K.stamp(hx0 + cx, hy0 + cy, rows, HL, headPart);
  }
  // 텐트(우비): 옷깃에서 바닥까지 종 모양. 쏙 칸은 한 번 더 웅크려 폭이 넓다.
  const top = (collar - 0.5) / S; // ① 좌표
  const rx = peek ? 8.6 : 9.2;
  K.ball(14.8, 47.4, rx, 47.4 - top + 0.6, R4.coat, { clip: (x, y) => y >= top && y <= 45.2 });
  // 닭 머리: 빼꼼 칸에서 앞섶 사이로 같이 내민다
  let chickHead = -1;
  if (peek) chickHead = K.ball(22.4, 38.6, 1.75, 1.85, R4.chick);
  colorLines(K, LINE);
  // 우비 세부: 앞섶 선과 토글 단추, 명찰(쏙 칸에서도 "같은 직원" 단서)
  const coatL = { y: C.yelD, b: C.woodD, w: C.wood, A: C.aqua, t: C.tealM };
  const P = (x, y) => [Math.round(K.X(x)), Math.round(K.Y(y))];
  {
    const [x0, y0] = P(21.0, top + 1.0);
    for (let y = y0; y <= 61; y++) if (K.get(x0, y) !== -1 && K.get(x0, y) !== C.ink && K.p[y * K.w + x0] !== chickHead) K.dot(x0, y, C.yelD);
    for (const ty of [41.6, 44.6]) {
      const [x, y] = P(21.0, ty);
      K.stamp(x - 1, y, ['bw'], coatL);
    }
  }
  K.stamp(...P(13.0, top + 2.6), ['AAA', 'AtA'], coatL);
  if (peek) {
    const [x, y] = P(22.4, 38.6);
    K.stamp(x - 1, y - 4, ['.R.R', 'RRrR'], CHICK_L, chickHead);
    K.stamp(x + 2, y - 1, ['OO.', 'OOO', 'Or.'], CHICK_L, chickHead);
    K.stamp(x, y - 1, ['k'], CHICK_L);
  }
  rimShade(K, new Set([headPart]), DOWN);
  soles(K, feet, C.redD);
  K.outline();
  // 쏙 칸: 텐트가 떨리는 덜덜 선. 빼꼼 칸: 땀 한 방울(외곽선 없이)
  if (!peek) tremble(K, 1, [46, 56]);
  else K.stamp(hx0 + 21, hy0 + 2, SWEAT, { A: C.tealM, W: C.white });
  return { K, feet };
}

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

// step_up  시소 올라서기 깡충(#397, 설계 docs/design/screens/magpie_nest.md 1-5-3절). 엔진이 칸을 궤적 위에 놓는다:
//   웅크림 0번(50ms) → 공중 1번(150ms, 기준점이 포물선으로 12px 솟는다) → 착지 0번(50ms). 내려서기는 1번 → 0번.
//   두 손은 고무 닭을 쥔 채라(캐릭터 단서) 다른 둘처럼 팔을 젓지 않는다. 대신 닭을 가슴에 끌어안고, 공중에서는 닭 머리가 늦게 따라온다.
//   0 웅크림: 무릎 모으고 몸을 낮춘다(우비 밑단이 종처럼 벌어짐), 눈 질끈 + 이 악물기 = "할 수 있다…!"
//   1 공중: 앞발은 무릎을 접어 올리고 뒷발 앞코는 아래로 끌린다(기준점 = 뒷발 앞코). 바늘 눈 + 벌린 입, 안경이 튄다.
//   뒷발 앞코가 칸 바닥 행에 닿아 있어서 build.mjs "딛은 발" 검사를 그대로 지킨다. 높이는 엔진 궤적이 맡는다.
const STEP_UP = [
  {
    chest: 3, lean: 1,
    legs: { back: { x: -1.3, lift: 0, toe: false }, front: { x: 1.2, lift: 0, toe: false } },
    eyes: 'shut', mouth: 'clench', sweat: 0, chickHead: 0, chickUp: 2, flare: 1,
  },
  {
    chest: 1, lean: 1,
    legs: { back: { x: -1.6, lift: -0.75, toe: true }, front: { x: 1.4, lift: 2.6, toe: true } }, // 앞코 장화는 1px 짧아서 발목을 1px 내린다
    eyes: 'wide', mouth: 'o', glassesUp: 1, sweat: -1, chickHead: 2, chickUp: 2, flare: 1,
  },
];

// ══════════ 공용 리액션 (#529, 화면 2 8절 ③ 클리어 컷) ══════════
// common.wet  공용 "젖음". 쭉이(jjuk-v4.mjs)·묵직이(mukjik.mjs)와 같은 박자 [100, 400, 300, 500], 같은 순서:
//   0 철썩(물이 확 덮침: 움찔하며 닭을 반사적으로 쥐어짜 부리가 쩍, 눈 질끈, 안경 튐, 물보라. 후드는 아직 제자리)
//   → 1 흠뻑(후드가 물을 먹어 납작해지고 챙이 눈썹까지 처진다. **안경에 물이 차서 눈동자가 렌즈 위에 둥둥 뜬다** = 물안경. 어깨 축, 덜덜 입, 닭 머리 축)
//   → 2 부르르(몸을 1px 앞으로 털고 물이 양옆으로 튄다. 렌즈 속 물이 뒤로 출렁, 닭 머리가 반대로 휙)
//   → 3 졸졸(허리를 펴고 입을 다문 "직원 자세". 렌즈 물은 맨 아랫줄만 남고, **품의 고무 닭 부리에서 물이 졸졸** 흘러내린다).
//   삑삑이 웃음은 "닭부터 운다"(납작·엉덩방아와 같은 단서)라서, 젖었을 때는 닭이 울 대신 물을 토한다. 소리 글자는 없다.
//   마지막 칸이 말풍선 동안 남는다(#193). 화면 2에서는 손님 `guest_hand` → プピ `clear`(`はい！\nお預かりします！`) 동안이라
//   3번은 겁먹은 얼굴이 아니라 다문 입으로 똑바로 선다(젖어도 맡은 일은 받는 막내 알바).
//   서 있기와 같은 drawFrame에 젖은 후드(wet)·렌즈 물(eyes)·물방울(fx)만 더한다. 방향은 고정하지 않는다.
const WET_LEGS = { back: { x: -0.9, lift: 0, toe: false }, front: { x: 1.0, lift: 0, toe: false } };
const WET = [
  { // 0 철썩: 무릎을 모으고 움찔, 닭을 반사적으로 쥐어짜 부리가 쩍. 안경이 튀고 눈 질끈. 물보라가 몸 둘레로
    chest: 2, lean: -1,
    legs: { back: { x: -0.3, lift: 0, toe: false }, front: { x: 0.4, lift: 0, toe: false } },
    eyes: 'shut', mouth: 'clench', glassesUp: 1, sweat: -1, chickHead: -3, chickUp: 2, squash: 1, beakOpen: true, flare: 1,
    fx: (K) => drops(K, [[6, 6, 2], [12, 2, 1], [20, 0, 0], [30, 1, 1], [38, 4, 2], [44, 12, 1], [3, 18, 1], [45, 22, 0], [9, 10, 0]]),
  },
  { // 1 흠뻑: 후드가 납작, 챙이 눈썹을 덮고 렌즈에 물이 찬다. 어깨가 내려앉고(chest 3) 닭 머리는 축 처진다. 챙 끝·밑단에서 물 뚝
    chest: 3, lean: 0, wet: true, legs: WET_LEGS,
    eyes: 'flood', mouth: 'shake', sweat: -1, chickHead: 2, chickUp: 0, flare: 0,
    fx: (K, { head: [hx, hy] }) => drops(K, [[hx + 23, hy + 11, 2], [hx + 1, hy + 9, 1], [9, 49, 1], [31, 50, 2], [15, 56, 0], [36, 57, 0]]),
  },
  { // 2 부르르: 몸 전체를 1px 앞으로 털고 물이 양옆으로 튄다. 렌즈 물은 뒤로 출렁, 닭 머리는 반대로 휙, 우비 밑단이 벌어진다
    chest: 2, lean: 1, dx: 1, wet: true, legs: WET_LEGS,
    eyes: 'slosh', mouth: 'clench', sweat: -1, chickHead: -2, chickUp: 1, flare: 1,
    fx: (K) => drops(K, [[1, 16, 2], [4, 25, 1], [2, 33, 0], [7, 9, 0], [44, 14, 2], [46, 24, 1], [45, 32, 0], [40, 7, 0]]),
  },
  { // 3 졸졸: 허리를 펴고 입을 다문다. 렌즈 물은 아랫줄만, 고무 닭 부리에서 물이 졸졸(부리 앞 → 아래로 가늘어지는 줄)
    chest: 1, lean: 0, wet: true, legs: WET_LEGS,
    eyes: 'drain', mouth: 'prim', sweat: -1, chickHead: 0, chickUp: 1, beakOpen: true, flare: 0,
    fx: (K, { beak: [x, y], head: [hx, hy] }) => drops(K, [[x + 5, y, 1], [x + 6, y + 2, 1], [x + 6, y + 4, 0], [x + 6, y + 7, 0], [x + 5, y + 11, 2], [hx + 23, hy + 12, 1]]),
  },
];

export const SHEET = {
  name: 'ppik-base',
  character: 'ppik',
  walkCycle: 24,
  anims: [
    { name: 'idle', frames: 2, ms: [700, 450] },
    { name: 'walk', frames: 6, by: 'distance' },
    // cue 1: "삑!" 글자(show의 fx)가 꽉! 칸에 뜬다. 없으면 흐익 칸까지 끝난 뒤에 떠서 개그 순서가 뒤집힌다(#199).
    { name: 'common.squeeze_chicken', frames: 3, ms: [200, 350, 450], cue: 1 },
    { name: 'hold', frames: 2, ms: [300, 450] },
    { name: 'launch_to_hook', frames: 4, ms: [150, 100, 100, 150] },
    { name: 'common.flatten', frames: 4, ms: [100, 600, 150, 450] },
    // 납작에서 멈춤(#357 1번): 새 칸 없이 꽝 → 납작 두 칸만. 엔진이 마지막 장(납작)을 다음 말풍선이 끝날 때까지 붙든다(형식 기록 5절).
    { name: 'common.flatten_stay', reuse: [['common.flatten', 0], ['common.flatten', 1]], ms: [100, 600] },
    { name: 'common.bump_bottom', frames: 4, ms: [100, 400, 300, 500] },
    { name: 'common.shiver', frames: 4, ms: [400, 100, 100, 500] },
    { name: 'common.wag_finger', frames: 4, ms: [250, 200, 200, 400] },
    { name: 'hide_in_basket', frames: 4, ms: [200, 300, 350, 500] },
    // 웅크림·공중(#397 1-5-3절). 착지는 엔진이 0번 칸을 50ms 다시 쓴다. 맨 뒤에 붙여서 앞 칸 번호(#357 납작 17)는 그대로다.
    { name: 'step_up', frames: 2, ms: [50, 150] },
    // 공용 젖음(#529). 쭉이·묵직이와 같은 박자. 맨 뒤에 붙여서 앞 칸 번호는 그대로다.
    { name: 'common.wet', frames: 4, ms: [100, 400, 300, 500] },
  ],
  pose,
  drawFrame,
};
