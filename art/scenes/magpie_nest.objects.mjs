// 화면 1 `magpie_nest` 물건 시트 ③ 원본 (#145, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md 2~7절).
// 모든 그림은 480×270 투명 화면에 **제자리로** 그린다. 빌드(art/scene-build.mjs)가 잘라서 `at`을 적는다.
// 만질 수 있는 것이라 바깥 1px ink 외곽선을 두른다(ADR-0007 결정 3-1). 반짝임·깃털 같은 효과 픽셀만 외곽선 밖이다.
// 광원은 배경과 같은 왼쪽 위 하나. 금색(yel 계열)은 열쇠 전용이다(#149 리뷰 a).
// 좌표 근거: content/screens/magpie_nest.json 히트 박스, docs/design/screens/magpie_nest.md 1-1·1-2·1-4절.
//
// ③-1: 멈춘 모습(`draw`·`states`)과 반복(`loop`: 열쇠 반짝임, U8 까치 대기).
// ③-2: 일시 연출(`anims`). 까치 4개(U1 fly_down·fly_up, U5 peck, ruffle), 시소 U6 plank_bounce 2방향, 내복 U11 flutter.

import { C, Image } from '../lib/pixel.mjs';
import { hash, rng, fill, line, stamp, outlined, darker } from '../lib/texture.mjs';

const W = 480, H = 270;
const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);

/** body(im)를 따로 그려 바깥 ink 외곽선을 두르고, fx(im)는 외곽선 없이 위에 얹는다. */
const pic = (body, fx) => (img) => {
  const t = new Image(W, H);
  body(t);
  img.blit(outlined(t), 0, 0);
  if (fx) fx(img);
};

// ═════════════ 둥지 (nest, 히트 128,30 36×24) ═════════════
// 잔가지를 겹겹이, 훔친 반짝이로 터질 듯. 열쇠는 #154 사장님 피드백("1배에서 노란 점")으로 키웠다:
// 고리 7×6 + 몸통 9px + 이 두 개, 테두리에 걸려 둥지 앞으로 늘어진다. 열쇠만 자기 ink 외곽선을 둘러 갈색 가지 위에서 뜬다.
const NEST = { CX: 146, TOP: 33, BOT: 46 };
const nestHalf = (y) => (y <= 36 ? 18 - (y === NEST.TOP ? 1 : 0) : 18 - Math.pow((y - 36) / (NEST.BOT - 36), 2) * 11);

function nestBody(im) {
  const { CX, TOP, BOT } = NEST;
  const r = rng(61);
  for (let y = TOP; y < BOT; y++) {
    const hw = nestHalf(y);
    for (let x = Math.ceil(CX - hw); x <= Math.floor(CX + hw); x++) {
      const right = x > CX + hw - 4; // 오른쪽 그늘
      let c;
      if (y <= TOP + 2) {
        const band = (x + (y - TOP) * 3) % 7; // 테두리: 굵은 가지를 둘둘 감은 띠
        c = band < 3 ? C.tan : band < 5 ? C.woodL : C.wood;
      } else {
        const a = (((x + y * 2) % 6) + 6) % 6, b = (((x - y * 2) % 7) + 7) % 7; // 엇갈려 엮은 잔가지
        c = a === 0 ? C.woodL : b === 0 ? C.woodD : a === 1 && hash(x, y, 64) < 0.5 ? C.tan : C.wood;
        if (y > BOT - 5) c = darker(c);
      }
      if (right) c = darker(c);
      if (y === BOT - 1) c = hash(x, y, 65) < 0.6 ? C.ink : C.woodD;
      im.set(x, y, c);
    }
  }
  for (let x = CX - 16; x <= CX + 16; x++) if (hash(x, 1, 66) < 0.45) im.set(x, TOP - 1, hash(x, 2, 66) < 0.5 ? C.tan : C.woodL);
  for (let i = 0; i < 14; i++) { // 사방으로 삐져나온 잔가지
    const side = i % 2 ? 1 : -1, y0 = TOP + 1 + Math.floor(r() * 9);
    const x0 = Math.round(CX + side * (nestHalf(y0) - 1));
    const len = 3 + Math.floor(r() * 4), dy = Math.round((r() - 0.6) * 4);
    line(im, x0, y0, x0 + side * len, y0 + dy, y0 < TOP + 4 ? C.woodL : r() < 0.5 ? C.wood : C.woodD);
  }
  line(im, 140, BOT - 1, 138, BOT + 3, C.woodD); line(im, 152, BOT - 1, 155, BOT + 2, C.wood); line(im, 146, BOT - 1, 146, BOT + 2, C.woodD);
  // 훔친 반짝이 더미: 포크, 병뚜껑, 은화, 단추, 구슬, 늘어진 줄무늬 양말 (금색 없음)
  line(im, 161, 32, 161, 23, C.cotton); line(im, 162, 31, 162, 24, C.lint);
  stamp(im, 159, 18, ['w.w.w', 'w.w.w', 'wcccl', '.ccl.'], { w: C.white, c: C.cotton, l: C.lint });
  stamp(im, 133, 29, ['r.r.r', 'RRRRr', 'rrrrr'], { R: C.redL, r: C.red });
  stamp(im, 139, 29, ['.ll', 'lwl', 'lld'], { l: C.lint, w: C.white, d: C.lav });
  stamp(im, 155, 29, ['.mm.', 'mtmt', '.mm.'], { m: C.tealM, t: C.tealD });
  stamp(im, 130, 31, ['qw', 'pq'], { q: C.purL, w: C.white, p: C.pur });
  stamp(im, 162, 34, ['qq.', 'qQq', 'ppp', 'qqq', 'ppp', 'qqq', '.pqq', '.ppp'], { q: C.pinkL, Q: C.white, p: C.pink });
}

/** 열쇠(둥지 테두리에 고리가 걸림). 자기 ink 외곽선 포함. 고리 구멍으로 둥지 가지가 보인다. */
function key(im) {
  stamp(im, 145, 28, [
    '..kkkkk..',
    '.kYYYYyk.',
    'kYWYkkyyk',
    'kYYk..kyk',
    'kYyk..kyk',
    '.kyykkyk.',
    '..kkYykk.',
    '...kYyk..',
    '...kYykkk',
    '...kYyyyk',
    '...kYykkk',
    '...kYyk..',
    '...kYykk.',
    '...kYyyk.',
    '...kyykk.',
    '....kk...',
  ], { k: C.ink, Y: C.yelL, y: C.yel, W: C.white });
  im.set(151, 41, C.yelD); im.set(150, 42, C.yelD); // 몸통 그늘(오른쪽 아래)
}

/**
 * 열쇠 반짝임: 0 = 꺼짐, 1 = 고리에 빛이 훑고 지나감, 2 = 큰 별. 효과라 외곽선 없음.
 * 노란 별은 밝은 크림색 하늘에 묻혀서(#154 사장님 피드백 "1배에서 열쇠가 노란 점") 별 팔은 한 단 진한 yel로 하고,
 * 1번 프레임은 별 대신 금속 위를 흰 빛이 훑는 모양으로 열쇠 자체를 깜빡이게 했다.
 */
function sparkle(im, k) {
  if (k === 1) {
    for (const [x, y] of [[147, 31], [148, 30], [149, 29], [148, 36], [148, 37]]) im.set(x, y, C.white);
  } else if (k === 2) {
    stamp(im, 151, 22, ['...l...', '...y...', '..yWy..', 'lyWWWyl', '..yWy..', '...y...', '...l...'], { y: C.yel, l: C.yelL, W: C.white });
    im.set(148, 30, C.white);
  }
}

const nestWithKey = (k) => pic((im) => { nestBody(im); key(im); }, (im) => sparkle(im, k));
const nestEmpty = pic((im) => {
  nestBody(im);
  // 열쇠가 걸려 있던 자리: 테두리 가지가 눌려 벌어진 자국
  stamp(im, 147, 31, ['.d.d.', 'dk.kd'], { d: C.woodD, k: C.ink });
});

// ═════════════ 까치 (magpie, 둥지 위 히트 134,6 24×24 / 바닥 88,212 24×24) ═════════════
// 사장님 피드백(#154 "까치가 덜 뻔뻔"): 오른쪽(사람들이 오는 쪽)을 보고 부리를 치켜들고, 가슴을 내밀고, 눈은 반쯤 감아
// 내려다본다. 한쪽 발은 열쇠 고리를 밟고 있다("내 거다", 둥지 위만). 흑백 몸 + 청록 광택 날개·꼬리.
// 포즈: 'smug'(기본), 'flick'(U8: 고개를 홱 뒤로), 'puff'(U8: 깃털 부풀리기). (fx, fy) = 앞발 끝(그림 아래 오른쪽 기준).
const MAGPIE_LEGEND = { k: C.ink, g: C.dusk, p: C.plum, w: C.white, c: C.cotton, l: C.lint, t: C.tealD, T: C.teal, m: C.tealM, d: C.dusk, e: C.white, b: C.lav };
const MAGPIE = {
  smug: [
    '..................kk',
    '...............kkkk.',
    '............kkkbk...',
    '...........kgkkk....',
    '..........kgkkeek...',
    '..........kkkkkkk...',
    '...........kkkkw....',
    '........kkkkkwwww...',
    '.......kttkkwwwwww..',
    '......ktTTkkwwwwwwc.',
    '.....ktTmTtkwwwwwwc.',
    '....ktTmTtkkwwwwwcc.',
    '...ktTmTtkkkcwwwccl.',
    '..ktTmtkk..kkcllkk..',
    '.ktTtk.......kk.....',
    'ktTk........d..d....',
    'tTk.........d..d....',
    'Tk.........dd.dd....',
  ],
  flick: [
    '....................',
    '.......kk...........',
    '........kkkkk.......',
    '..........bkkkk.....',
    '...........keekk....',
    '...........kkkgk....',
    '...........kkkkw....',
    '........kkkkkwwww...',
    '.......kttkkwwwwww..',
    '......ktTTkkwwwwwwc.',
    '.....ktTmTtkwwwwwwc.',
    '....ktTmTtkkwwwwwcc.',
    '...ktTmTtkkkcwwwccl.',
    '..ktTmtkk..kkcllkk..',
    '.ktTtk.......kk.....',
    'ktTk........d..d....',
    'tTk.........d..d....',
    'Tk.........dd.dd....',
  ],
  puff: [
    '..................kk',
    '...............kkkk.',
    '............kkkbk...',
    '...........kgkkk....',
    '.........kkgkkeek...',
    '........k.kkkkkkk...',
    '......k.kkkkkkkwwk..',
    '.....kkkkkkkwwwwwwk.',
    '....kkttkkkwwwwwwww.',
    '....ktTTTkkwwwwwwwwc',
    '...ktTmmTtkwwwwwwwwc',
    '..ktTmmTtkkwwwwwwwcc',
    '..ktTmTtkkkcwwwwwccl',
    '.ktTmtkkk.kkccwcllk.',
    'ktTtk.......kkkkk...',
    'tTk.........d..d....',
    'Tk..........d..d....',
    'k..........dd.dd....',
  ],
};

/** 까치 한 장. (x, y) = 그림 왼쪽 위. 눈은 반쯤 감은 눈꺼풀(위 한 줄 dusk). */
function magpie(im, x, y, pose) {
  stamp(im, x, y, MAGPIE[pose], MAGPIE_LEGEND);
}
const MAGPIE_NEST_AT = [129, 13]; // 앞발 끝(x 144)이 열쇠 고리 왼쪽 끝(145~153, y 28~33)을 밟는다. 고리는 가리지 않는다
const MAGPIE_GROUND_AT = [91, 218]; // 발 y 235 = 바닥 히트 박스(212~236) 아래 끝
const groundShadow = (im, x = MAGPIE_GROUND_AT[0]) => R(im, x + 8, 236, 10, 1, C.plum);
const magpieOnNest = (pose) => pic((im) => magpie(im, ...MAGPIE_NEST_AT, pose));
const magpieOnGround = (pose) => pic((im) => magpie(im, ...MAGPIE_GROUND_AT, pose), (im) => {
  // 접지 그림자(오른쪽 아래, 엔진이 사람에게 그리는 그림자와 같은 plum 한 줄)
  groundShadow(im);
});

// ── 까치 일시 연출 포즈 (③-2). 앉은 포즈와 같은 범례, 같은 오른쪽 보기.
// 'up' / 'down' = 날갯짓 두 박자(몸은 수평, 꼬리는 왼쪽으로 길게, 날개 끝 흰 반점 = 까치 날개의 흰 칼깃).
// 'jab' = 몸을 앞으로 숙이고 부리를 오른쪽 아래로 내리찍음(U5). 꼬리가 위로 들린다.
const MAGPIE_FLY = {
  up: [
    '.......kk...............',
    '......kwwk..............',
    '......kwTk..............',
    '.......kTmk.............',
    '.......ktTmk............',
    '........ktTmk.....kkk...',
    '.........ktTkk...kkkek..',
    'tTT......kkkkkkkkkkgkkkk',
    '.tTTTkkkkkkkkwwwwkkkk...',
    '...tTTkkkkkwwwwwwwk.....',
    '.....kkkkcwwwwwwck......',
    '.......kkcccllcck.......',
    '..........kd..kd........',
  ],
  down: [
    '.................kkk....',
    '................kkkek...',
    'tTT......kkkkkkkkkgkkkk.',
    '.tTTTkkkkkkkkwwwwkkkk...',
    '...tTTkkkTTTkwwwwwk.....',
    '.....kkkTmTkwwwwwck.....',
    '......kTmTkcwwwccl......',
    '.....kTmTk..kcllk.......',
    '....kwmTk...kd.kd.......',
    '....kwwk................',
    '.....kk.................',
  ],
  jab: [
    'Tk..................',
    'tTk.................',
    '.tTk................',
    '..ktTk..............',
    '...ktTkk............',
    '....ktmTkkk.........',
    '.....ktmTkkkk.......',
    '......kttkkwwkk.....',
    '.......kkwwwwwkkk...',
    '........kwwwwwkkkk..',
    '........kcwwwwkeeg..',
    '.........kcllwkkkkb.',
    '..........kkk..kkkbb',
    '...........d..d...kb',
    '...........d..d....k',
    '..........dd.dd.....',
  ],
};
const flyPose = (pose) => (im, x, y) => stamp(im, x, y, MAGPIE_FLY[pose], MAGPIE_LEGEND);
/** 날아가는 한 장: 몸 + 속도선(효과, 외곽선 없음). (vx, vy) = 진행 방향 부호. 속도선은 반대쪽 뒤로 짧게 남는다. */
const flying = (pose, x, y, vy) => pic((im) => flyPose(pose)(im, x, y), (im) => {
  const sy = vy > 0 ? y - 3 : y + 15; // 내려가면 위에, 올라가면 아래에
  for (const [dx, len] of [[6, 3], [12, 4], [17, 2]]) line(im, x + dx, sy, x + dx, sy + (vy > 0 ? -len : len), C.lint);
});
/** 쪼는 순간 부리 끝에 튀는 "탁" 별(효과). 금색은 열쇠 전용이라 흰색·분홍. */
function hitSpark(im, x, y) {
  stamp(im, x - 4, y - 4, ['....w....', '.l..w..l.', '..l.W.l..', '...WWW...', 'wwWWWWWww', '...WWW...', '..l.W.l..', '.l..w..l.', '....w....'], { w: C.white, W: C.white, l: C.lint });
}
/** 떨어지는 깃털 한 장(효과): 흰 깃 + 청록 깃대. 하늘(크림)에서도 보이게 깃털 자체에 ink 테를 둘렀다. */
const feather = (im, x, y) => stamp(im, x, y, ['..kk', '.kwk', 'kwk.', 'mk..'], { k: C.ink, w: C.white, m: C.tealM });

// ═════════════ 고리 (hook, 그림 152,92 10×8, 히트 150,84 24×24) ═════════════
// 기둥 오른쪽 면에 나사 두 개로 박은 쇠판 + L자로 꺾인 갈고리. 갈고리 끝 아래가 y 100(손 기준점 158,100, 형식 7절).
const hook = pic((im) => {
  stamp(im, 150, 89, [
    'lcc........',
    'lWl........',
    'lll........',
    'lclcccccl..',
    'llllllllcl.',
    'ldl....dll.',
    'lll....lll.',
    'ldl..clld..',
    'lll..ldd...',
    'll.........',
  ], { l: C.lint, c: C.cotton, W: C.white, d: C.lav });
  im.set(150, 90, C.dusk); im.set(150, 96, C.dusk); // 나사
});

// ═════════════ 왕꽃무늬 내복 (long_johns, 372,112 32×40) ═════════════
// 빨랫줄(y 110)에 빨래집게 둘로 걸린 남의 내복. 빨강 바탕에 큰 흰 꽃, 무릎이 늘어나 불룩하다. 엉덩이 쪽 덧댄 천 한 장.
function longJohnsBody(im) {
  const X0 = 374, TOP = 112;
  // 몸통(허리띠 ~ 가랑이) + 두 다리. 오른쪽 다리가 바람에 살짝 들렸다
  const bodyRows = 14;
  for (let y = TOP; y < TOP + bodyRows; y++) for (let x = X0; x < X0 + 28; x++) im.set(x, y, C.red);
  const leg = (lx, len, lift) => {
    for (let j = 0; j < len; j++) {
      const y = TOP + bodyRows + j, off = Math.round(lift * (j / len) * (j / len));
      const knee = j > len * 0.45 && j < len * 0.7 ? 1 : 0; // 늘어난 무릎
      for (let x = lx - knee + off; x < lx + 12 + knee + off; x++) im.set(x, y, C.red);
    }
    // 발목 시보리
    const y = TOP + bodyRows + len, off = Math.round(lift);
    for (let x = lx + 1 + off; x < lx + 11 + off; x++) { im.set(x, y, C.redD); im.set(x, y + 1, x % 2 ? C.red : C.redD); }
  };
  leg(X0, 22, 0);
  leg(X0 + 16, 20, 3);
  // 명암: 왼쪽 위 밝게(redL), 오른쪽 면·가랑이 그늘(redD)
  fill(im, X0 - 2, TOP, 36, 40, (x, y) => {
    const c = im.get(x, y);
    if (c !== C.red) return undefined;
    const left = im.get(x - 1, y) === -1, right = im.get(x + 1, y) === -1;
    if (left || (y < TOP + 3 && x < X0 + 12)) return C.redL;
    if (right || im.get(x + 2, y) === -1) return C.redD;
    if (y > TOP + bodyRows - 2 && y < TOP + bodyRows + 3 && x > X0 + 10 && x < X0 + 18) return C.redD; // 가랑이 주름
    return undefined;
  });
  // 허리 고무단(흰 골지)
  for (let x = X0; x < X0 + 28; x++) { im.set(x, TOP, C.cotton); im.set(x, TOP + 1, x % 2 ? C.white : C.lint); im.set(x, TOP + 2, C.lint); }
  // 왕꽃: 흰 꽃잎 다섯 + 노랑 대신 분홍 꽃술(금색은 열쇠 전용)
  const flower = (fx, fy) => stamp(im, fx, fy, ['.w.w.', 'wwWww', '.WpW.', 'wwWww', '.w.w.'], { w: C.white, W: C.cotton, p: C.pink });
  for (const [fx, fy] of [[376, 117], [388, 115], [397, 120], [379, 128], [392, 131], [376, 140], [394, 143], [383, 149]]) {
    if (im.get(fx + 2, fy + 2) !== -1) flower(fx, fy);
  }
  // 덧댄 천(엉덩이, 청록 체크) + 바늘땀
  fill(im, 386, 121, 6, 5, (x, y) => ((x + y) % 2 ? C.tealM : C.tealL));
  for (const [sx, sy] of [[385, 121], [385, 123], [385, 125], [392, 122], [392, 124]]) im.set(sx, sy, C.white);
  // 빨래집게 둘(빨랫줄에 물림, 나무색)
  for (const px of [377, 397]) stamp(im, px, 108, ['tw', 'tw', 'tw', 'ww', '.w'], { t: C.tan, w: C.woodL });
}
const longJohns = pic(longJohnsBody);

// ═════════════ 시소 (seesaw: seesaw_left + seesaw_right, 널빤지 208,214 80×6) ═════════════
// 널빤지 한 장. 이 함수는 수평 모습이고, 사람이 탄 기울기는 seesawTilt(d)다(설계 1-5절, #397). 받침(세제 통 242,220)은 배경 띠 (c) 몫이다.
// 양 끝에 발판 자국(밟혀서 닳은 칠), 가운데 못 두 개. 고리 쪽 왼쪽 끝은 신발 자국이 하나 더 있다(누가 자주 섰다).
function seesawBody(im) {
  const X0 = 208, X1 = 288, Y0 = 214, HH = 6;
  fill(im, X0, Y0, X1 - X0, HH, (x, y) => {
    const ly = y - Y0, lx = x - X0;
    if (ly === 0) return lx % 19 === 0 ? C.woodL : C.tan; // 윗면 빛
    if (ly === HH - 1) return C.woodD; // 아랫면 그늘
    if (ly === HH - 2) return hash(x, 0, 81) < 0.3 ? C.woodD : C.wood;
    // 나뭇결: 길게 흐르는 선 두 줄 + 옹이 하나
    const grain = Math.round(Math.sin(lx / 9) * 0.7);
    if (ly + grain === 2 && hash(lx >> 2, 0, 82) < 0.7) return C.wood;
    if (Math.hypot(lx - 58, (ly - 2.5) * 2) < 1.6) return C.woodD; // 옹이
    return hash(x, y, 83) < 0.06 ? C.tan : C.woodL;
  });
  // 끝면(나이테가 보이는 마구리, 왼쪽은 빛 오른쪽은 그늘)
  for (let y = Y0; y < Y0 + HH; y++) { im.set(X0, y, y === Y0 ? C.tan : C.woodL); im.set(X1 - 1, y, C.wood); }
  // 양 끝 닳은 칠 자국 + 왼쪽 끝 신발 자국
  for (const cx of [220, 284]) for (let x = cx - 5; x <= cx + 5; x++) if (hash(x, 1, 84) < 0.55) im.set(x, Y0, C.woodL);
  stamp(im, 216, Y0 + 1, ['d.d.d.d'], { d: C.wood });
  // 가운데 받침 위 못 두 개
  im.set(246, Y0 + 2, C.lav); im.set(250, Y0 + 2, C.lav); im.set(246, Y0 + 1, C.lint); im.set(250, Y0 + 1, C.lint);
}
const seesaw = pic(seesawBody);

// 널빤지 기울기(U6 튕김과 멈춘 기울기가 같이 쓴다). 회전 대신 열마다 세로로 밀어(층 밀기) 나뭇결·못이 깨지지 않게 한다.
const PIVOT_X = 248; // 받침(세제 통 242~254) 가운데 = 못 두 개 사이
const TILT_RUN = 40; // 축에서 이만큼 떨어진 열(오른쪽 끝 x 287)이 d px 내려간다
/** d = 오른쪽 끝(x 287)이 내려가는 px. 음수면 왼쪽 끝이 내려간다. 열 x는 round(d × (x − 247.5) / 40) 내려간다(엔진 발 높이와 같은 식). */
const plank = (d, fx) => pic((im) => {
  const t = new Image(W, H);
  seesawBody(t);
  for (let x = 200; x < 296; x++) {
    const dy = Math.round((d * (x - PIVOT_X + 0.5)) / TILT_RUN);
    for (let y = 208; y < 224; y++) { const c = t.get(x, y); if (c !== -1) im.set(x, y + dy, c); }
  }
}, fx);
/** 멈춘 기울기 그림(#397 설계 1-5절). d = 오른쪽 끝이 내려간 px(음수 = 왼쪽 끝). 미리보기·기울기 칸이 같은 함수를 쓴다. */
export const seesawTilt = (d) => plank(d);
/**
 * 쉬는 판(설계 1-7절, #437): 무게가 다르면 무거운 쪽 끝이 끝까지 내려가 쉰다. 판 끝 가장 낮은 픽셀 232, 땅(235)까지 3px 남김.
 * 더 키우면 U6 가장 큰 칸(`REST + 3`)이 땅을 뚫는다(1-7-2절).
 */
const REST = 12;
/**
 * 멈춘 기울기(형식 기록 12절, 개정 7). 엔진이 "보이는 탑승"으로 d = rest × 부호(오른쪽 무게 − 왼쪽 무게)를 정하고 그 칸을 그린다(설계 1-7-1절).
 * 판 위 사람 발도 같은 식(pivot·run)으로 내린다. 0은 수평 그림(`draw`)이다.
 */
const seesawTiltMeta = {
  rest: REST,
  weight: { jjuk: 1, ppik: 1, mukjik: 2 },
  pivot: PIVOT_X - 0.5,
  run: TILT_RUN,
  draw: { [-REST]: seesawTilt(-REST), [REST]: seesawTilt(REST) },
};

// ═════════════ 빨래 바구니 (basket, 그림 144,220 32×16, 히트 144,212 32×24) ═════════════
// 위에서 살짝 내려다본 등나무 바구니. 뒤판(물건 기본 그림) = 꼬인 테두리 뒤쪽 + 어두운 안쪽 + 그 안의 빨래.
// 앞판(overlay, sortY 236) = 테두리 앞쪽 + 엮은 앞벽 226~236(높이 10px, 설계 1-4절 3번. 외곽선 포함 225~236). 바구니 안 캐릭터는 앞판 뒤에 선다.
const BASKET = { X0: 144, X1: 176, RIM: 220, FRONT: 226, BOT: 236 };

const basketBack = pic((im) => {
  const { X0, X1, RIM, FRONT } = BASKET;
  // 테두리 뒤쪽(타원 위 반)
  for (let x = X0; x < X1; x++) {
    const lx = x - X0;
    const up = lx < 3 || lx > 28 ? 1 : 0;
    im.set(x, RIM + up, lx % 3 === 0 ? C.woodL : C.tan);
    im.set(x, RIM + 1 + up, lx % 3 === 1 ? C.woodL : C.wood);
  }
  // 안쪽 그늘(뒤 벽 안쪽면 + 바닥)
  fill(im, X0 + 1, RIM + 2, X1 - X0 - 2, FRONT - RIM, (x, y) => {
    const ly = y - RIM - 2;
    if (ly === 0) return C.wood;
    return (x + y) % 4 === 0 ? C.wood : C.woodD;
  });
  // 안의 빨래: 흰 셔츠(소매가 테두리 밖으로 늘어짐), 분홍 양말, 청록 수건 끝
  stamp(im, 147, 221, ['.wwwcc..', 'wwwwwcc.', 'cwwccl..'], { w: C.white, c: C.cotton, l: C.lint });
  stamp(im, 160, 220, ['mmTm', 'mTmm', '.mm.'], { m: C.tealM, T: C.tealL });
  stamp(im, 167, 214, ['..qq', '.qQq', 'qqq.', 'pqq.', 'pp..', '.p..'], { q: C.pinkL, Q: C.white, p: C.pink });
});

const basketFront = pic((im) => {
  const { X0, X1, FRONT, BOT } = BASKET;
  // 엮은 앞벽: 아래로 갈수록 좁아짐(옆면 기울기), 3줄마다 엇갈린 결, 오른쪽 그늘
  fill(im, X0, FRONT, X1 - X0, BOT - FRONT, (x, y) => {
    const inset = Math.floor((y - FRONT) / 5);
    if (x < X0 + inset || x >= X1 - inset) return undefined;
    const row = Math.floor((y - FRONT) / 3), lx = (x - X0 + (row % 2) * 2) % 4, ly = (y - FRONT) % 3;
    let c = lx === 3 ? C.wood : ly === 0 ? C.tan : ly === 2 ? C.wood : C.woodL;
    if (x >= X1 - inset - 5) c = darker(c);
    if (y === BOT - 1) c = C.woodD;
    return c;
  });
  // 테두리 앞쪽(꼬인 줄 3단, 빛을 받는다). 앞벽 윗줄에 겹쳐 그려 외곽선 포함 위 끝이 225다
  // (발 235 위 10px 이하, 형식 기록 6절 개정 1. 위로 올리면 삑삑이가 머리만 남는다)
  for (let x = X0 - 1; x < X1 + 1; x++) {
    im.set(x, FRONT, x % 3 === 0 ? C.woodL : C.tan);
    im.set(x, FRONT + 1, x % 3 === 1 ? C.woodL : C.wood);
    im.set(x, FRONT + 2, x % 3 === 2 ? C.wood : C.woodD);
  }
  // 손잡이 구멍 둘 + 앞으로 늘어진 셔츠 소매(단추)
  stamp(im, X0 + 1, FRONT + 4, ['kk', 'k.'], { k: C.woodD });
  stamp(im, X1 - 3, FRONT + 4, ['kk', '.k'], { k: C.woodD });
  stamp(im, 150, FRONT + 1, ['cwwc', '.cwc', '.cwc', '.lll', '..t.'], { w: C.white, c: C.cotton, l: C.lint, t: C.tealM });
});

// ═════════════ 물건 목록 (형식 3절. 적은 순서 = 뒤 → 앞, 설계 1-4절) ═════════════
export const OBJECTS = {
  nest: {
    draw: nestWithKey(0),
    // 열쇠 반짝임: 가만히 1600 → 작은 별 120 → 큰 별 120 (형식 4절 Q2)
    loop: { ms: [1600, 120, 120], frames: [nestWithKey(0), nestWithKey(1), nestWithKey(2)] },
    states: [{ when: { flags: { 'nest.key_taken': true } }, draw: nestEmpty }],
  },
  magpie: {
    draw: magpieOnNest('smug'),
    // U8 까치 대기: 가만히 2500 → 고개 홱 150 → 부풀림 300 (설계 9절, 관찰 단서 C7)
    loop: { ms: [2500, 150, 300], frames: [magpieOnNest('smug'), magpieOnNest('flick'), magpieOnNest('puff')] },
    states: [{
      when: { flags: { 'magpie.on_ground': true } },
      layer: 'front', // 바닥의 까치는 캐릭터 앞(형식 6절, 설계 1-4절 4번)
      draw: magpieOnGround('smug'),
      loop: { ms: [2200, 150, 300], frames: [magpieOnGround('smug'), magpieOnGround('flick'), magpieOnGround('puff')] },
    }],
  },
  hook: { draw: hook },
  long_johns: { draw: longJohns },
  // 판 밑 바닥(널빤지와 받침 사이, 판 바로 뒤 잔디)에 서는 목표는 판 앞 y 240으로 옮긴다(설계 1-5-2절, 형식 기록 12절).
  seesaw: { ids: ['seesaw_left', 'seesaw_right'], draw: seesaw, tilt: seesawTiltMeta, noFloor: { box: [204, 200, 89, 38], y: 240 } },
  basket: { draw: basketBack, overlay: { sortY: 236, draw: basketFront } },
};

// ═════════════ 일시 연출 (③-2, 형식 4·4-1·4-2절) ═════════════
// 상태를 바꾸는 anim은 첫 칸 = 출발 자리, 마지막 칸 = 도착 자리(4-2절 (a)). 마지막 칸은 도착 상태의 멈춘 모습과 같은 그림이라
// anim이 끝나 `loop`로 넘어갈 때 튀지 않는다. ms 합은 1500 이하(8절).
const [NX, NY] = MAGPIE_NEST_AT, [GX, GY] = MAGPIE_GROUND_AT;
const nestPose = (pose, dx = 0, fx) => pic((im) => magpie(im, NX + dx, NY, pose), fx);
const groundPose = (pose, dx = 0, fx) => pic((im) => magpie(im, GX + dx, GY, pose), (im) => { groundShadow(im, GX + dx); if (fx) fx(im); });

// U1 까치 내려와 노려보기(규칙 4 `magpie_squeak_down`). "삑!"에 깃털이 곤두서고 → 퍼덕퍼덕 거의 수직으로 떨어지듯 내려와 →
// 바닥에서 한 번 더 부풀려 노려본 뒤 → 바닥 smug(= 바닥 상태 멈춘 모습).
const FLY_PATH = [[124, 20], [117, 58], [110, 98], [103, 138], [97, 176]];
const flyDown = {
  ms: [120, 70, 70, 70, 70, 70, 90, 150, 150],
  frames: [
    nestPose('puff'),
    ...FLY_PATH.map(([x, y], i) => flying(i % 2 ? 'down' : 'up', x, y, 1)),
    pic((im) => flyPose('up')(im, 92, 206), (im) => groundShadow(im)),
    groundPose('puff'),
    groundPose('smug'),
  ],
  layer: 'front', // 내려오는 동안 캐릭터 앞(형식 6절)
};
// U1 거꾸로(규칙 6 `magpie_stomp_back`). "쿵"에 고개 홱 → 같은 길을 거꾸로 올라가 → 둥지에서 깃털 정리 → 둥지 smug.
const flyUp = {
  ms: [120, 70, 70, 70, 70, 70, 90, 150, 100],
  frames: [
    groundPose('flick'),
    pic((im) => flyPose('down')(im, 92, 206), (im) => groundShadow(im)),
    ...[...FLY_PATH].reverse().map(([x, y], i) => flying(i % 2 ? 'down' : 'up', x, y, -1)),
    nestPose('puff'),
    nestPose('smug'),
  ],
  layer: 'front',
};

// U5 까치 쪼기. 둥지 위(규칙 2 `hook_jjuk_pecked*`): 매달린 쭉이 손(고리 158,100)까지 내리꽂혀 "탁" → 둥지로.
// 바닥(규칙 7 `magpie_stretch_pecked`): 오른쪽에 선 쭉이(발 x 약 129) 손 쪽으로 깡충 뛰어 "탁" → 제자리.
const peckNest = {
  ms: [120, 70, 180, 80, 100],
  frames: [
    nestPose('flick'),
    flying('down', 134, 50, 1),
    pic((im) => flyPose('jab')(im, 138, 84), (im) => hitSpark(im, 160, 99)),
    flying('up', 132, 48, -1),
    nestPose('smug'),
  ],
  layer: 'front', // 매달린 캐릭터(형식 6절 3번)보다 앞이어야 손을 쪼는 게 보인다
};
const peckGround = {
  ms: [120, 70, 180, 80, 100],
  frames: [
    groundPose('flick'),
    pic((im) => flyPose('up')(im, 98, 200), (im) => groundShadow(im, GX + 6)),
    pic((im) => flyPose('jab')(im, 104, 194), (im) => { hitSpark(im, 126, 209); groundShadow(im, GX + 8); }),
    pic((im) => flyPose('down')(im, 93, 214), (im) => groundShadow(im, GX + 2)),
    groundPose('smug'),
  ],
  layer: 'front',
};

// 깃털 털기(`ruffle`): 화면 진입·규칙 5·쿵/뻗기에 놀람. 부풀린 채 좌우로 부르르 → 깃털이 튄다 → 하나가 떨어진다.
const ruffleFrames = (pose, [x, y]) => [
  pose('puff', -2),
  pose('puff', 2, (im) => { feather(im, x - 5, y + 3); feather(im, x + 21, y + 7); feather(im, x + 7, y - 4); }),
  pose('puff', 0, (im) => { feather(im, x - 6, y + 10); }),
];
const ruffle = {
  ms: [100, 150, 100],
  frames: ruffleFrames(nestPose, MAGPIE_NEST_AT),
  variants: [{ when: { flags: { 'magpie.on_ground': true } }, ms: [100, 150, 100], frames: ruffleFrames(groundPose, MAGPIE_GROUND_AT), layer: 'front' }],
};

// U6 시소 널빤지 튕김(규칙 9~15 `stomp`). 이벤트 대상 끝이 내려가고 반대 끝이 튀어 오른다(형식 3·5절 "`seesaw_right` = 오른쪽이 내려감").
// 정답(발사)과 실패(잘못 발사, 제 이마 치기)가 같은 프레임이다(설계 U6). 제 이마 치기(15번)는 데이터가 반대쪽 끝 이벤트를 보내서
// 묵직이가 밟은 끝이 튀어 오른다. 널빤지는 회전 대신 열마다 세로로 밀어(층 밀기) 나뭇결·못이 깨지지 않게 한다.
// 끝나면 엔진이 그때 탄 사람으로 멈춘 기울기(쉬는 판 ±12 또는 수평)를 고른다(첫 칸·끝 칸 규칙 4-2절 (a)는 상태를 바꾸는 anim만).
/** 튀어 오르는 끝 위의 속도선(효과). side = -1 왼쪽 끝 / 1 오른쪽 끝, lift = 그 끝이 올라간 px. */
const whoosh = (side, lift) => (im) => {
  const x0 = side < 0 ? 209 : 279;
  for (const [dx, len] of [[0, 3], [4, 4], [8, 2]]) line(im, x0 + dx, 211 - lift, x0 + dx, 211 - lift - len, C.lint);
};
// 칸 d = [쉬는 값, 땅 치기, 되튐](설계 1-7-7절, #437). 첫 칸이 쉬는 값이라 이미 내려간 판(제자리 쿵)이 쿵 순간 올라가지 않는다.
// 둘째 칸에 판 끝 가장 낮은 픽셀이 땅(235)에 닿는다. 셋째 칸은 4px 되튀고 부호는 그대로다.
const BOUNCE_D = [REST, REST + 3, REST - 4];
const plankBounce = (side) => ({ // side = 내려가는 끝
  ms: [60, 120, 80],
  frames: BOUNCE_D.map((d, k) => plank(side * d, k === 1 ? whoosh(-side, d) : undefined)),
  // 칸별 널빤지 d(형식 기록 12-5절). 판 위 발이 이 칸의 판 높이를 따른다. 그림과 같은 상수에서 만든다.
  tilt: BOUNCE_D.map((d) => side * d),
});

// U11 내복 펄럭(14번 빨랫줄에 날아와 걸림, `long_johns` × 쭉이 집게·묵직이 쿵). 빨래집게·허리단은 줄에 붙은 채
// 아래로 갈수록 더 크게 오른쪽으로 날린다(시소에서 날아온 사람이 왼쪽에서 오니까) → 물결 → 왼쪽으로 되돌아옴.
// 상태를 바꾸지 않는다(쭉이 얼굴을 덮는 것·묵직이 모자는 캐릭터 anim과 fx 몫, 설계 5절).
/** sway = 발목에서 옆으로 밀리는 px, wave = 물결 진폭. 허리단(y 112) 위는 그대로다. */
const flapping = (sway, wave, fx) => pic((im) => {
  const t = new Image(W, H);
  longJohnsBody(t);
  for (let y = 104; y < 160; y++) {
    const k = Math.max(0, y - 112) / 40;
    const dx = Math.round(sway * k * k + wave * Math.sin((y - 112) / 3.5) * k);
    for (let x = 360; x < 420; x++) { const c = t.get(x, y); if (c !== -1) im.set(x + dx, y, c); }
  }
}, fx);
/** 바람 줄(효과): 내복 왼쪽에서 오른쪽으로 휘는 짧은 선 셋. */
const gust = (im) => {
  for (const [x, y, len] of [[358, 124, 6], [355, 134, 8], [359, 144, 5]]) { line(im, x, y, x + len, y, C.white); im.set(x + len + 1, y - 1, C.white); }
};
const flutter = {
  ms: [90, 130, 110],
  frames: [flapping(7, 0, gust), flapping(13, 2, gust), flapping(-4, 1)],
};

export const ANIMS = {
  'magpie.fly_down': flyDown,
  'magpie.fly_up': flyUp,
  'magpie.peck': { ...peckNest, variants: [{ when: { flags: { 'magpie.on_ground': true } }, ...peckGround }] },
  'magpie.ruffle': ruffle,
  'seesaw_right.plank_bounce': plankBounce(1),
  'seesaw_left.plank_bounce': plankBounce(-1),
  'long_johns.flutter': flutter,
};

/** 고리 손 기준점(형식 7절). 매달린 자세 프레임의 손이 여기 와야 한다. */
export const GRIPS = { hook: [158, 100] };
