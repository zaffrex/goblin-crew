// 스테이지 3 `laundromat` 빨래방 화면 그림 (#764, 설계 docs/design/screens/laundromat.md, 형식 docs/decisions/2026-11-16-scene-art-format-v1.md).
// 이 파일이 배경 + 물건 시트를 묶는다. 칸 그림은 laundromat.*.mjs에 있고, 여기서는 자리·상태·anim만 정한다.
//
// 물건 시트 1/2 (이 PR): 대상 6개 + 장식 둥지의 멈춘 모습·상태·대기 반복, 그리고 이미 그린 칸으로 되는 anim 전부.
//   까치(앉음·내려다보기·부리에 문 열쇠·뒤돌기·갸웃·부르르·창 안 날기·털썩), 둥지 열쇠 들어옴/나감, 틈 속 머리(snatch)·열쇠 밀림(nudge),
//   덕트 혹(travel·back·pop·걸림 반복).
// 물건 시트 2/2-a (이 PR, 건조기): O4 드럼 회전(정회전 대기 반복·역회전 상태, `dryer_3.reverse_start`·`forward_start`),
//   O5 문 벌컥·병뚜껑·날아가는 양말(`burst`·`burst#2`·`door_bang`), 머리 위 양말(`dryer_3.sock_head`, anchor ズッシー, 장식 물건 `sock`).
// 물건 시트 2/2-b (이 PR, 머리 위 물건): O8 깃털(`dryer_3.feather_puff`·`feather_head`, 장식 물건 `head_feather`),
//   O7 둥지 모자(`dryer_3.nest_hat`, 원본 object `nest`)·그 위에 앉는 까치(`magpie.hat_perch`). 셋 다 anchor ズッシー.
// 물건 시트 2/2-c (다음 PR): `gap.glint`, `shutter.roll_up`, `duct.warm_puff`·`suck_pole`, `dryer_3.gulp_pole`, 자판기 쏟아짐.
//   그 전에는 그 anim이 시트에 없어 엔진이 물건을 멈춘 모습 그대로 둔다(형식 9절 폴백).
//
// 배경 물건(셔터·건조기·자판기)은 ink 없이 그린 그림이다. 시트에서는 히트 상자 **안** 픽셀만 물건으로 떼어 바깥 ink 외곽선을 두르고
// (ADR-0007 결정 3-1, park_fountain 동상과 같은 방식), 상자 **밖** 픽셀(셔터 통, 바닥 빛 띠, 바닥 그림자 줄)은 배경에 굽는다(#882 Theo 리뷰).
// 바닥 쪽 외곽선은 안 두른다: 아래 끝이 바닥 그림자·빛 띠 줄과 붙어 있어서 ink 줄이 그 줄을 덮는다.
// 덕트(`duct`)만 외곽선이 없다: 관은 천장까지 배경으로 이어지는데 핫스팟 구간에만 테를 두르면 "관 위에 붙인 스티커"가 된다
//   (결정 2026-11-24-laundromat-duct-lump-shape-path, 혹도 관 속 외곽선을 지운다). 멈춘 모습은 배경과 같은 픽셀이고 호버 테만 준다.
//
// 그리는 순서(엔진은 층마다 objects 순서대로, tests/art/draw-order.test.ts): nest < magpie < shutter < gap.
//   둥지 → 그 위 앉은 까치(결정 2026-11-25-laundromat-magpie-sit-key-zone-mask), 까치 날기는 셔터보다 뒤(E3), 틈 속 열쇠·머리는 셔터 판 위(#917).

import { Image, EMPTY, C } from '../lib/pixel.mjs';
import { outlined, stamp, line } from '../lib/texture.mjs';
import { room, W, H, TRANSOM, HOOD } from './laundromat.room.mjs';
import { washer } from './laundromat.washer.mjs';
import { shutter, SHUTTER, gapLift } from './laundromat.shutter.mjs';
import { dryer, DRYER_DOOR_SWING, DRUM_STEP } from './laundromat.dryer.mjs';
import { vending } from './laundromat.vending.mjs';
import {
  keyTag, KEY_ON_STREET, nestEmpty, nestWithKey, NEST, NEST_KEY, GAP_SNATCH, DUCT_LUMP, LUMP_STUCK, MAGPIE_SIT, MAGPIE_SIT_AT, MAGPIE_SIT_POSES, magpieSit,
  flySock, bottleCap, headFeather, HEAD_FEATHER,
} from './laundromat.objects.mjs';
import { ANCHOR_ORIGIN } from '../scene-build.mjs';
import { MAGPIE_FLY, MAGPIE_LEGEND, feather } from './magpie_nest.objects.mjs';

// ── 히트 상자(content/screens/laundromat.json과 같은 값. 다르면 빌드 picture 검사가 "겹치지 않는다"로 잡는다)
const SHUTTER_BOX = [SHUTTER.x, SHUTTER.y, SHUTTER.w, SHUTTER.h];
const DRYER_BOX = [344, 164, 48, 72];
const VEND_BOX = [436, 148, 40, 88];
const DUCT_BOX = [352, 120, 30, 44];
/** 세탁기 줄(배경). laundromat-bg-sketch.mjs와 같은 값(#853) */
const ROW = { x0: 176, y: 180, pitch: 40 };
const ROW_DOORS = ['open', 'load', 'empty', 'load'];

const inside = ([bx, by, bw, bh], x, y) => x >= bx && x < bx + bw && y >= by && y < by + bh;

/** 배경 물건 그림에서 상자 안 픽셀만 떼어 외곽선을 두른다. 상자 아래 끝 줄 밑(바닥 쪽) 외곽선은 뺀다. */
const boxed = (draw, box) => (img) => {
  const t = new Image(W, H);
  draw(t);
  const o = new Image(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(box, x, y)) o.set(x, y, t.get(x, y));
  const ol = outlined(o);
  const bottom = box[1] + box[3];
  for (let y = 0; y < bottom; y++) for (let x = 0; x < W; x++) { const c = ol.get(x, y); if (c !== EMPTY) img.set(x, y, c); }
};
/** 같은 그림의 상자 밖 픽셀만 배경에 굽는다(셔터 통·빛 띠, 바닥 그림자 줄). */
function outsideOf(img, draw, box) {
  const t = new Image(W, H);
  draw(t);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = t.get(x, y); if (c !== EMPTY && !inside(box, x, y)) img.set(x, y, c); }
}

const shutterLocked = (img) => shutter(img, 'locked');
const shutterUp = (img) => shutter(img, 'up');
const dryerStill = (img) => dryer(img, DRYER_BOX[0], DRYER_BOX[1]);
const vendStill = (img) => vending(img, VEND_BOX[0], VEND_BOX[1]);

function drawBg(img) {
  room(img);
  for (let i = 0; i < 4; i++) washer(img, ROW.x0 + i * ROW.pitch + 1, ROW.y, { n: i + 1, door: ROW_DOORS[i] });
  outsideOf(img, shutterLocked, SHUTTER_BOX);
  outsideOf(img, dryerStill, DRYER_BOX);
  outsideOf(img, vendStill, VEND_BOX);
}

// ═════════════ 덕트 (`duct`) ═════════════
/** 멈춘 모습: 배경 관의 핫스팟 구간(x 360~373, y 120~163)을 같은 픽셀로 옮긴다(외곽선 없음, 위 머리말). */
function ductRest(img) {
  const t = new Image(W, H);
  room(t);
  for (let y = DUCT_BOX[1]; y < DUCT_BOX[1] + DUCT_BOX[3]; y++) for (let x = 360; x < 374; x++) img.set(x, y, t.get(x, y));
}

// ═════════════ 틈 속 열쇠 (`gap`) ═════════════
/** 그림을 셔터 찌그러진 틈(판 아래 끝 244 − gapLift 위로는 판) 안만 남긴다. 판 앞에 열쇠가 그려지지 않게(PR #929 Theo 리뷰). */
function inGap(img, draw) {
  const t = new Image(W, H);
  draw(t);
  const bottom = SHUTTER.y + SHUTTER.h;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = t.get(x, y);
      if (c !== EMPTY && y >= bottom - gapLift(x) && y < bottom) img.set(x, y, c);
    }
}
const keyStreet = (dx = 0) => (img) => inGap(img, (t) => keyTag(t, KEY_ON_STREET.x + dx, KEY_ON_STREET.y));

// 5-1 `gap.nudge`: 집게가 패를 쿡 → 열쇠가 오른쪽으로 6px 밀려 삼각 틈을 벗어남(패 아래 끝만 띠 밑으로) → 스르르 제자리.
// 밀린 칸은 틈 밖 픽셀을 잘라 굽는다(손그림 0, 시트 칸 2: +6·+3). 엔진은 물건을 안 자르니 여기서 자른다.
const NUDGE = { ms: [100, 520, 160, 140], frames: [keyStreet(0), keyStreet(6), keyStreet(3), keyStreet(0)] };

// 3-1·3-2 `gap.snatch`: 마지막 빈 틈 칸은 뺐다(빌드가 빈 칸을 못 받는다). 빠지는 칸을 그만큼 붙들고, 끝나면 멈춘 모습(열쇠 없음 = 안 그림)으로.
const SNATCH = { ms: [...GAP_SNATCH.ms.slice(0, 3), GAP_SNATCH.ms[3] + GAP_SNATCH.ms[4]], frames: GAP_SNATCH.frames.slice(0, 4) };

// ═════════════ 까치 (`magpie`) ═════════════
const sit = (pose, opt) => (img) => magpieSit(img, pose, opt);
/** 털썩 내려앉은 자리(둥지가 빨려 나가 후드 윗면, 발 아래 끝 y 53) */
const DROP = 9;
/** 후드 끝 깃털(`fly_out` 붙드는 마지막 칸 = `key.back` 멈춘 모습). 둥지 왼쪽 끝 옆, 후드 갓(x 62~) 윗면에 눕는다 */
const FEATHER_AT = { x: 62, y: 50 };
const hoodFeather = (img) => feather(img, FEATHER_AT.x, FEATHER_AT.y);

/** 들창 왼쪽 칸 안(하늘)만 남긴다. 까치는 창 밖에서 날고, 창틀·판자 밖은 벽이라 안 보인다(E3). */
const PANE = { x0: TRANSOM.paneL.x, x1: TRANSOM.paneL.x + TRANSOM.paneL.w, y0: TRANSOM.inY, y1: TRANSOM.inY + TRANSOM.inH };
function inPane(img, draw) {
  const t = new Image(W, H);
  draw(t);
  for (let y = PANE.y0; y < PANE.y1; y++) for (let x = PANE.x0; x < PANE.x1; x++) { const c = t.get(x, y); if (c !== EMPTY) img.set(x, y, c); }
}
/** 창 안 날기 한 장(magpie_nest 날기 포즈 재사용, 0칸) + 속도선. 올라가면 속도선이 몸 아래에 남는다. */
const flyPane = (pose, x, y) => (img) => inPane(img, (t) => {
  const b = new Image(W, H);
  stamp(b, x, y, MAGPIE_FLY[pose], MAGPIE_LEGEND);
  t.blit(outlined(b), 0, 0);
  for (const [dx, len] of [[6, 3], [12, 4], [17, 2]]) line(t, x + dx, y + 15, x + dx, y + 15 + len, C.lint);
});

// 날아 나감: 부풀림(놀람) → 날개 위로 → 창 위로 빠져나감(아래 절반만 보임) → 후드 끝 깃털 하나(hold). 날아 듦은 거꾸로.
// 창 아래(후드 쪽)로 내려가지 않는다: 바깥 후드보다 먼 곳을 나는 새가 후드 앞에 그려지면 앞뒤가 틀린다.
const flyOut = (dy) => ({
  ms: [100, 90, 90, 220],
  frames: [sit('puff', { dy }), flyPane('up', 60, 20 + dy), flyPane('down', 57, 8 + dy), hoodFeather],
});
const FLY_IN = { ms: [90, 90, 120, 100], frames: [flyPane('down', 57, 8), flyPane('up', 60, 20), sit('puff'), sit('smug')] };

/** 부르르(ruffle·magpie_nest와 같은 박자): 부풀린 채 좌우 2px → 깃털 셋 튐 → 하나 떨어짐 → 제자리. 깃털은 창 칸 안 */
const RUFFLE = {
  ms: [100, 150, 100, 80],
  frames: [
    sit('puff', { dx: -2 }),
    (img) => { magpieSit(img, 'puff', { dx: 2 }); feather(img, 61, 30); feather(img, 79, 25); feather(img, 66, 24); },
    (img) => { magpieSit(img, 'puff'); feather(img, 61, 38); },
    sit('smug'),
  ],
};

const MAGPIE_ANIMS = {
  // onEnter: 창 너머 까치가 고개를 갸웃(진입 연출 12절, 0칸)
  tilt: { ms: [100, 260, 160, 260, 120], frames: [sit('smug'), sit('flick'), sit('smug'), sit('flick'), sit('smug')] },
  peek: MAGPIE_SIT.peek,
  beak_suck: MAGPIE_SIT.beak_suck,
  // 8 뒤돌기(좌우 뒤집기, 0칸). 두 번째는 등 돌린 뒤 틈 쪽 힐끔(내려다보기 재사용)
  snub: { ms: [80, 1100, 120], frames: [sit('smug'), sit('smug', { flip: true }), sit('smug')] },
  'snub#2': { ms: [80, 500, 700, 120], frames: [sit('smug'), sit('smug', { flip: true }), sit('peek'), sit('smug')] },
  ruffle: RUFFLE,
  // 2-1 따뜻한 바람에 부풀어 편히 앉음
  fluff: { ms: [900, 120], frames: [sit('puff'), sit('smug')] },
  // 덕트 × プピッ: 창 밖 배기구에서 …ピッ → 둥지를 꽉 붙듦(고개 홱 → 1px 웅크려 부풀림)
  clutch: { ms: [120, 700, 120], frames: [sit('flick'), sit('puff', { dy: 1 }), sit('smug')] },
  fly_out: { ...flyOut(0), hold: true, variants: [{ when: { flags: { 'key.back': true } }, ...flyOut(DROP) }] },
  fly_in: FLY_IN,
  // 6 클리어: 깔고 앉은 둥지가 빨려 나가 털썩(4px → 후드 윗면), fly_out까지 붙든다(4절 표 6)
  perch_drop: { ms: [80, 80], frames: [sit('smug', { dy: 4 }), sit('smug', { dy: DROP })], hold: true },
};

// 6 클리어 `magpie.nest_sucked`(원본 object nest): 빈 둥지가 후드 속으로 쏙(4px → 8px). 후드 윗면(y 54) 아래는 잘라 굽는다.
// 새 그림 0(빈 둥지 자리만 옮김), 시트 2칸. 둥지 자기 anim이 있어야 fx(stretch_text) 동안 둥지가 남고,
// 이 anim이 시작할 때 사라져 곧바로 perch_drop으로 까치가 털썩 앉는다(형식 4-2 (a), PR #937 Theo 리뷰).
function nestSunk(dy) {
  return (img) => {
    const t = new Image(img.w, img.h);
    nestEmpty(t);
    for (let y = 0; y + dy < HOOD.top; y++) for (let x = 0; x < img.w; x++) { const c = t.get(x, y); if (c !== EMPTY) img.set(x, y + dy, c); }
  };
}
const NEST_SUCKED = { ms: [60, 60], frames: [nestSunk(4), nestSunk(8)] };

// ═════════════ 3번 건조기 (`dryer_3`, 시트 2/2-a) ═════════════
// O4 드럼: 같은 세 장(0°·40°·80°)을 정회전은 0 → 40 → 80, 역회전은 0 → 80 → 40으로 잇는다(laundromat.dryer.mjs 머리말).
// 대기 반복 첫 칸 = 멈춘 모습(0°)이라 상태가 바뀌거나 anim이 끝난 순간 튀지 않는다(형식 4절 개정 3).
const [DX, DY] = DRYER_BOX;
const spinPic = (k) => boxed((img) => dryer(img, DX, DY, { spin: k * DRUM_STEP }), DRYER_BOX);
const SPIN = [spinPic(0), spinPic(1), spinPic(2)];
// 한 바퀴 약 1.35초. 빨래방 건조기 실제 속도(1초 남짓)에 가깝고, 빨래방 idle 사례 간격 150ms(scripts/playtest/cases.test.ts)보다 짧으면 칸 사이로 빠진다
const SPIN_MS = 150;
const FORWARD_LOOP = { ms: SPIN_MS, frames: [SPIN[0], SPIN[1], SPIN[2]] };
const REVERSE_LOOP = { ms: SPIN_MS, frames: [SPIN[0], SPIN[2], SPIN[1]] };
// 쿵 직후 바뀐 방향으로 한 마디(120°): 느리게 시작해 반복 속도로. 첫 칸이 느려야 "방향이 바뀌었다"가 눈에 걸린다.
// 마지막 칸 다음이 대기 반복 첫 칸(0°)이라 이어진다(역회전 0 → 80 → 40 → 0, 정회전 0 → 40 → 80 → 0).
const START_MS = [240, 190, SPIN_MS];
const REVERSE_START = { ms: START_MS, frames: REVERSE_LOOP.frames };
const FORWARD_START = { ms: START_MS, frames: FORWARD_LOOP.frames };

// O5 문 벌컥: 열린 문이 몸 왼쪽 밖으로 나가서 그만큼 넓힌 상자로 잘라 외곽선을 두른다
const OPEN_BOX = [DX - DRYER_DOOR_SWING, DY, DRYER_BOX[2] + DRYER_DOOR_SWING, DRYER_BOX[3]];
const doorOpen = boxed((img) => dryer(img, DX, DY, { door: 'open' }), OPEN_BOX);
/** 건조기 그림 + 날아다니는 것들(양말·병뚜껑, 각자 외곽선) */
const withItems = (base, ...items) => (img) => { base(img); for (const f of items) f(img); };
const sockAt = (x, y, flip = false) => (img) => flySock(img, x, y, { flip });
const capAt = (x, y) => (img) => bottleCap(img, x, y);

// 1-1 첫 판 행렬(설계 8-3 "물건 셋까지"): 문 벌컥 → 양말이 튀어 올랐다 역회전에 도로 빨려 듦 → 병뚜껑이 튀어 올라 한 박자 떠 있다(S3 A 단서, `ビンのフタ？`)
//   → 도로 빨려 듦 → 마지막 양말이 높이 날아가고 문이 쾅(닫힌 문 = 역회전 반복 첫 칸, 도로 빨려 든 양말이 문틈에 다시 낀다).
// 높이 날아간 양말은 바로 다음 줄 `sock_head`가 받아 ズッシー 머리로 데려간다. 그래서 머리로 가는 양말이 행렬의 마지막이다.
// 입 가운데 368,197. 위로 튄 것은 건조기 위 끝(164) 근처까지만 가고, 덕트(x 360~373)보다 앞에 그린다(그리는 순서 duct < dryer_3).
const BURST = {
  ms: [90, 110, 110, 150, 110],
  frames: [
    withItems(doorOpen, sockAt(362, 192)),
    withItems(doorOpen, sockAt(358, 171, true), capAt(365, 193)),
    withItems(doorOpen, sockAt(362, 185), capAt(364, 172)),
    withItems(doorOpen, capAt(365, 189), sockAt(362, 190)),
    withItems(SPIN[0], sockAt(368, 150, true)),
  ],
};
// 두 번째부터(#765 `burst#2`, 8-3 짧은 판): 양말 하나만 바로 높이
const BURST_2 = { ms: [90, 110], frames: [withItems(doorOpen, sockAt(362, 190)), withItems(SPIN[0], sockAt(368, 150, true))] };
// 6 클리어: 문 벌컥(빈 문, 둥지 모자는 2/2-b `nest_hat`이 머리 위에) → 쾅. 엔진 기본 0.5초보다 짧게(H6 넘침 줄이기)
const DOOR_BANG = { ms: [90, 150, 80], frames: [doorOpen, doorOpen, SPIN[0]] };

// 머리 위 양말(anchor ズッシー, 형식 16절): ANCHOR_ORIGIN = 얼굴 상자 위 가운데, 오른쪽을 본 모습 기준.
// ズッシー는 쿵을 하고 건조기를 보고 서 있어서 건조기는 늘 "앞쪽(+x)"이다(왼쪽을 보면 엔진이 뒤집는다).
// 그래서 양말이 앞쪽 위(행렬 마지막 칸 자리 근처)에서 날아와 정수리에 떨어지는 길을 머리 기준으로 그린다.
// 정수리(털모자 꼭대기)는 얼굴 상자 위 끝보다 4px 아래, x −8~+1. 양말 목이 정수리를 가로지르고 발은 앞쪽(얼굴 쪽 이마 위)으로 늘어진다. 눈(+14 아래)은 안 가린다.
// 칸 사이 이동은 21px 안(R3, 행렬 마지막 칸 → 첫 칸도 머리 기준 약 16px).
const [AX, AY] = ANCHOR_ORIGIN;
const SOCK_HEAD = {
  ms: [60, 60, 70, 140],
  frames: [sockAt(AX + 30, AY - 30, true), sockAt(AX + 15, AY - 24), sockAt(AX + 2, AY - 9), sockAt(AX - 6, AY + 2)],
};

// ═════════════ 머리 위 깃털·둥지 모자 (시트 2/2-b, O7·O8) ═════════════
// O8 깃털(설계 8-1 B'·1-2): 혹이 덕트를 막으며 밀어낸 깃털이 건조기 문 위 이음매(12시, 368,181)에서 퐁 → ズッシー 털모자에 꽂힌다.
//   깃털은 처음부터 끝까지 새 칸 하나(O8 `headFeather` 5×10)다. magpie_nest `feather`(4×4)는 1배에서 먼지 한 점이라 문에서 튀어도 눈이 안 간다.
//   같은 깃털이 문에서 나와 머리에 꽂히니 "그 깃털"로도 이어진다. 기울기는 자리만 바꿔 찍는다(돌린 칸 없음, 0칸).
//   `feather_puff`(제자리, dryer_3): 역회전 반복 칸 위에 깃털 아래 끝이 이음매에 걸림 → 한 뼘(11px) 위로 퐁.
//   `feather_head`(anchor ズッシー, 장식 물건 `head_feather`): 앞쪽 위에서 한 번 → 꽂힘. hold라 대사(`suck`·`reverse_key`) 끝까지 남는다.
//   H5(tests/art/laundromat-timing.test.ts): 빈 부리 멍 660ms에 더해 1500 안 → 깃털 몫 840ms. 여기서는 210 + 290 = 500ms.
const FEATHER_SEAM = { x: 368, y: 181 };
const doorFeather = (dy) => (img) => headFeather(img, FEATHER_SEAM.x - HEAD_FEATHER.quill.x, FEATHER_SEAM.y - HEAD_FEATHER.quill.y + dy);
const FEATHER_PUFF = {
  ms: [100, 110],
  frames: [withItems(SPIN[2], doorFeather(0)), withItems(SPIN[1], doorFeather(-11))],
};
// 털모자 꼭대기(머리 기준): 얼굴 상자 위 끝 + 4, x −8~+1(sock_head 머리말). 깃대 끝이 꼭대기 1px 안(AY + 6)에, 가운데보다 3px 뒤(AX − 3)에 박힌다.
const QUILL_AT = { x: AX - 3, y: AY + 6 };
const headFeatherAt = (dx, dy) => (img) => headFeather(img, QUILL_AT.x - HEAD_FEATHER.quill.x + dx, QUILL_AT.y - HEAD_FEATHER.quill.y + dy);
const FEATHER_HEAD = { ms: [90, 200], frames: [headFeatherAt(12, -14), headFeatherAt(0, 0)] };

// O7 둥지 모자(설계 8-2 2번): 열쇠 든 둥지(O2 `nestWithKey`, 패·고리·양말 그대로 = 0칸)가 머리 위 16 → 8 → 0px로 두 번 떨어져 얹힌다.
//   둥지 바닥(좁은 줄, 몸 기준 x 6~13)을 털모자 꼭대기(x −8~+1) 가운데에 맞추고 1px 박는다. 그래서 둥지 그릇이 모자처럼 얹히고,
//   금색 고리는 앞쪽(+x) 위로 솟고 분홍 양말은 뒤통수 쪽으로 늘어진다. 눈 줄(+14)은 0px 가린다(미리보기 검사).
//   ノビー가 4번에서 "둥지에서 열쇠를 집는" 고리가 앞쪽이라 어느 방향을 봐도 사람 쪽에 열쇠가 있다(엔진이 같이 뒤집는다).
//   원본 object는 장식 둥지 `nest`다: `magpie.nest_sucked`로 후드 속에 빨려 든 그 둥지가 문에서 나와 머리에 앉는 것이라 같은 물건이다.
//   물건 순서 nest < magpie라 머리 위에서도 둥지 위에 까치가 그려진다(엔진 heads는 objects 순서).
const HAT_NEST = { x: AX - 13, y: AY - 2 };
const headNest = (dy) => (img) => {
  const t = new Image(W, H);
  nestWithKey(t);
  img.blit(t, HAT_NEST.x - NEST.x, HAT_NEST.y - NEST.y + dy);
};
// 문 벌컥(door_bang 첫 칸 90ms)과 같은 박자에 시작. 엔진 기본 0.5초보다 0.14초 짧다(H6 넘침).
const NEST_HAT = { ms: [80, 80, 200], frames: [headNest(-16), headNest(-8), headNest(0)] };

// 까치 둥지 모자 앉기(`magpie.hat_perch`, 설계 8-2 3번): 앉은 까치가 둥지 윗줄에 발을 딛는 자리 관계(MAGPIE_SIT_AT − NEST)를 그대로 옮긴다.
//   날아 내려옴(창 안 날기 `down` 재사용) → 부풀려 착지(`puff`) → smug. 셋 다 재사용 그림이라 손그림 0칸.
//   열쇠 자리 비움(MAGPIE_KEY_ZONE)은 화면 좌표 마스크라 여기선 안 쓴다. 고리는 몸 기준 +17부터라 smug(배 끝 +15)와 안 겹친다.
const HAT_SIT = { x: HAT_NEST.x + MAGPIE_SIT_AT.x - NEST.x, y: HAT_NEST.y + MAGPIE_SIT_AT.y - NEST.y };
const hatSit = (pose) => (img) => stamp(img, HAT_SIT.x, HAT_SIT.y, MAGPIE_SIT_POSES[pose], MAGPIE_LEGEND);
const hatFly = (img) => {
  const b = new Image(W, H);
  stamp(b, HAT_SIT.x - 4, HAT_SIT.y - 16, MAGPIE_FLY.down, MAGPIE_LEGEND);
  img.blit(outlined(b), 0, 0);
};
const HAT_PERCH = { ms: [100, 120, 200], frames: [hatFly, hatSit('puff'), hatSit('smug')] };

// ═════════════ 물건 ═════════════
const notOnStreet = ['key.in_nest', 'key.stuck', 'key.back'].map((f) => ({ when: { flags: { [f]: true } }, draw: null }));

const OBJECTS = {
  // 장식 둥지(대상 없음, `magpie.key_in`·`key_out`이 바꿔 그린다). 클리어(key.back)에는 빨려 나가 없다.
  nest: {
    ids: [],
    draw: nestEmpty,
    states: [
      { when: { flags: { 'key.back': true } }, draw: null },
      { when: { flags: { 'key.in_nest': true } }, draw: (img) => nestWithKey(img), loop: NEST_KEY.loop },
    ],
  },
  magpie: {
    draw: sit('smug'),
    loop: MAGPIE_SIT.loop,
    states: [{ when: { flags: { 'key.back': true } }, draw: hoodFeather }],
  },
  shutter: {
    draw: boxed(shutterLocked, SHUTTER_BOX),
    states: [{ when: { flags: { 'key.back': true } }, draw: boxed(shutterUp, SHUTTER_BOX) }],
  },
  gap: { draw: keyStreet(0), states: notOnStreet },
  duct: {
    draw: ductRest,
    states: [
      // 클리어(duct_unstick)는 key.back만 켜고 key.stuck은 안 끈다. key.back을 먼저 둬야 lump_pop 뒤에 혹이 다시 안 나온다(PR #937 Theo 리뷰)
      { when: { flags: { 'key.back': true } }, draw: ductRest },
      { when: { flags: { 'key.stuck': true } }, draw: DUCT_LUMP.stuck.frames[0], loop: DUCT_LUMP.stuck },
    ],
  },
  // 시작은 정회전(설계 3절: 거짓이면 정회전), 역회전 상태는 같은 칸 거꾸로
  dryer_3: {
    draw: SPIN[0],
    loop: FORWARD_LOOP,
    states: [{ when: { flags: { 'dryer.reverse': true } }, draw: SPIN[0], loop: REVERSE_LOOP }],
  },
  // 머리 위 양말(장식 물건, 평소 안 보임 · 형식 16절). `dryer_3.sock_head`가 anchor로 그린다
  sock: { ids: [], draw: null },
  // 머리 위 깃털(장식 물건, 평소 안 보임). `dryer_3.feather_head`가 anchor로 그린다
  head_feather: { ids: [], draw: null },
  soap_vending: { draw: boxed(vendStill, VEND_BOX) },
};

const ANIMS = {
  ...Object.fromEntries(Object.entries(MAGPIE_ANIMS).map(([k, v]) => [`magpie.${k}`, v])),
  'magpie.key_in': { object: 'nest', ...NEST_KEY.key_in },
  'magpie.key_out': { object: 'nest', ...NEST_KEY.key_out },
  'magpie.nest_sucked': { object: 'nest', ...NEST_SUCKED },
  'gap.snatch': SNATCH,
  'gap.nudge': NUDGE,
  'duct.lump_travel': DUCT_LUMP.lump_travel,
  'duct.lump_back': DUCT_LUMP.lump_back,
  'duct.lump_pop': DUCT_LUMP.lump_pop,
  'dryer_3.reverse_start': REVERSE_START,
  'dryer_3.forward_start': FORWARD_START,
  'dryer_3.burst': BURST,
  'dryer_3.burst#2': BURST_2,
  'dryer_3.door_bang': DOOR_BANG,
  'dryer_3.sock_head': { object: 'sock', anchor: { char: 'mukjik', point: 'head' }, hold: true, ...SOCK_HEAD },
  'dryer_3.feather_puff': FEATHER_PUFF,
  'dryer_3.feather_head': { object: 'head_feather', anchor: { char: 'mukjik', point: 'head' }, hold: true, ...FEATHER_HEAD },
  'dryer_3.nest_hat': { object: 'nest', anchor: { char: 'mukjik', point: 'head' }, hold: true, ...NEST_HAT },
  'magpie.hat_perch': { anchor: { char: 'mukjik', point: 'head' }, hold: true, ...HAT_PERCH },
};

// 검사용: 걸린 혹 칸이 duct 핫스팟 안이라는 전제(결정 2026-11-24-laundromat-duct-lump-shape-path)
if (!inside(DUCT_BOX, LUMP_STUCK.x, LUMP_STUCK.y)) throw new Error('[laundromat] 걸린 혹 자리가 duct 핫스팟 밖');

export const SCENE = {
  id: 'laundromat',
  draft: false,
  bg(img) { drawBg(img); },
  objects: OBJECTS,
  anims: ANIMS,
};
