// 엔딩 화면 `park_fountain` 배경 **구도 시안** (#380). 완성 그림이 아니다.
// 목적: 완성 밀도로 그리기 전에 소품 배치·시선 흐름·색 분위기(아침 7시 57분 공원)를 먼저 맞춘다.
//       특히 물줄기 4색(26·25·6·24, 지금은 art/scenes/park_fountain.objects.mjs OBJECTS.water)이 뒤 배경에서 읽히게 뒤를 정한다(PR #426 리뷰에서 예고).
// 실행: node docs/design/screens/park_fountain-bg-sketch.mjs
// 출력(같은 폴더):
//   park_fountain-bg-sketch-2x.png       시안(480×270을 2배). 세 사람은 배포 시트(public/sprites/*-base.png) 0칸을 시작 위치에 올렸다
//   park_fountain-bg-sketch-notes-2x.png 같은 그림 + 번호(볼거리 1~8, 퍼즐 물건 A~F)
//   park_fountain-bg-sketch-gray-2x.png  명도(흑백) 버전 (ADR-0007 결정 3-6)
//   park_fountain-bg-sketch-water-2x.png 물줄기 켜짐을 대충 얹은 판(입자 모양은 Theo 효과가 진짜다. 여기선 색 대비만 본다)
// 검사(어기면 종료 코드 1):
//   - 배경에 ink(0)·hint(31) 없음 (결정 3-1)
//   - 걷는 바닥 주색과 세 사람 주색의 명도 차 ≥ 30 (결정 3-4)
//   - 분수대 테두리 돌 주색과 흙길 주색의 명도 차 ≥ 30 (park_fountain.md 1-1 "돌 색은 흙길과 뚜렷이 다르게", 단서 ②)
//   - 물줄기 기둥 뒤 배경 주색과 물 밝음(26)·물보라(6)의 명도 차 ≥ 60
//   - 재킷 두 자리 뒤 배경 주색과 재킷 주색의 명도 차 ≥ 60
// 좌표는 park_fountain.md 1절·화면 JSON content/screens/park_fountain.json과 같다(그림이 좌표를 따른다). 빌드에 들어가지 않는 설계 자료다.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { hash, bay, fill, ellipse, line, stamp, outlined } from '../../../art/lib/texture.mjs';
import { OBJECTS } from '../../../art/scenes/park_fountain.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/park_fountain.json'), 'utf8'));
const L = { ...JSON.parse(readFileSync(join(HERE, 'park_fountain-layout.json'), 'utf8')), spots: SCREEN.spots, hotspots: SCREEN.hotspots };
const W = 480, H = 270;
const PATH_TOP = 198; // 흙길 시작(걷기 영역 위 끝 200보다 2px 위)
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);

const bg = new Image(W, H, C.aqua); // 배경(만질 수 없음): ink·hint 금지
const fg = new Image(W, H); // 만질 수 있는 것(핫스팟 물건): 바깥 ink 외곽선
const notes = []; // [x, y, 번호]

// ═════════════ 배경 ═════════════

// ① 하늘: 아침. 위는 옅은 물색, 지평선 쪽은 해 뜬 지 얼마 안 된 크림빛.
fill(bg, 0, 0, W, 150, (x, y) => (y < 40 ? C.aqua : y < 90 ? bay(x, y, (y - 40) / 50, C.aqua, C.cotton) : bay(x, y, (y - 90) / 60, C.cotton, C.yelL)));
// 구름 두 덩이(왼쪽 위 빛)
for (const [cx, cy, rx] of [[70, 26, 26], [398, 40, 32]]) {
  ellipse(bg, cx, cy, rx, 6, (x, y) => (y < cy - 1 ? C.white : C.cotton));
  ellipse(bg, cx - rx * 0.35, cy - 4, rx * 0.45, 6, C.white);
}

// ② 먼 거리(오른쪽): 공원 담 너머 낮은 건물. 하늘보다 한 단계만 어둡게(대비 낮게, 뒤로 물러나게).
for (const [x0, w, top] of [[318, 34, 112], [352, 26, 100], [378, 40, 118], [430, 50, 106]]) {
  fill(bg, x0, top, w, 150 - top, (x) => (x === x0 + w - 1 ? C.lav : C.lint));
  for (let y = top + 5; y < 146; y += 9) for (let x = x0 + 4; x < x0 + w - 5; x += 8) R(bg, x, y, 3, 4, (x + y) % 3 ? C.cotton : C.yelL);
}

// ③ 큰 나무 무리: 분수 기둥 바로 뒤를 진한 초록으로 막는다. 물(밝은 물색·흰 물보라)이 이 위에서 뜬다.
//    꼭대기는 y 60 아래로 둬서 돌우산·꼭대기 재킷(y 32~52)은 하늘 위에 남긴다(어두운 재킷이 밝은 하늘에서 읽힘).
const CANOPY = [[176, 104, 52, 42], [236, 92, 46, 34], [294, 102, 48, 40], [140, 128, 34, 26], [328, 128, 34, 24], [414, 118, 44, 34]];
for (const [cx, cy, rx, ry] of CANOPY) {
  ellipse(bg, cx, cy, rx, ry, (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const lump = hash(x >> 2, y >> 2, cx) < 0.3; // 잎 덩어리 결
    if (dx + dy < -0.85) return lump ? C.grnL : C.grn; // 왼쪽 위 빛
    if (dx + dy < -0.35) return bay(x, y, 0.5, C.grn, lump ? C.grnL : C.grn);
    return lump ? C.grn : C.grnD;
  });
}
// 줄기 몇 개(울타리 뒤로 사라짐)
for (const [x, w] of [[120, 4], [356, 5], [404, 6]]) R(bg, x, 140, w, 30, C.woodD);

// ④ 생울타리: 공원 뒤쪽 경계. 분수 연못 뒤를 가로지른다.
fill(bg, 120, 152, 360, 32, (x, y) => {
  const top = 152 + Math.round(2 + 2 * Math.sin(x / 7) + hash(x >> 1, 0, 9) * 2);
  if (y < top) return undefined;
  if (y < top + 3) return hash(x, y, 10) < 0.5 ? C.grnL : C.grnP;
  return hash(x >> 1, y >> 1, 11) < 0.25 ? C.grnL : bay(x, y, (y - 160) / 30, C.grn, C.grnD);
});
// 잔디 띠(울타리 앞 ~ 흙길 위 끝)
fill(bg, 0, 182, W, PATH_TOP - 182, (x, y) => (hash(x, y, 12) < 0.2 ? C.grnP : y < 186 ? C.grn : C.grnL));
for (let i = 0; i < 9; i++) { const x = 340 + i * 13 + (i % 3) * 3, y = 186 + (i % 2) * 5; bg.set(x, y, C.white); bg.set(x + 1, y, C.yelL); }

// ⑤ 관리실(왼쪽, 매점만 한 작은 집): 벽은 크림, 지붕 진한 빨강, 창(관리인 핫스팟)은 물건 쪽에서 그린다.
fill(bg, 16, 94, 104, PATH_TOP - 94, (x, y) => (x > 112 ? C.woodL : (y - 94) % 10 === 9 ? C.woodL : C.tan)); // 가로 판벽 + 오른쪽 그늘
R(bg, 10, 84, 116, 4, C.red); R(bg, 12, 88, 112, 6, C.redD); // 지붕 차양
for (let x = 12; x < 124; x += 8) R(bg, x, 88, 4, 6, C.red); // 차양 줄무늬
// 간판(빗자루와 물방울 그림: 글자 없이 "관리실"로 읽히게)
R(bg, 34, 98, 40, 11, C.woodD); R(bg, 35, 99, 38, 9, C.wood);
line(bg, 42, 106, 52, 100, C.tan); R(bg, 40, 105, 4, 2, C.yelD); // 빗자루
stamp(bg, 60, 100, ['.a.', 'aaa', 'aa.'], { a: C.aqua }); // 물방울
// 벽시계 7시 57분 ("8시 청소" 단서, 1-1 배경)
ellipse(bg, 98, 105, 6.5, 6.5, (x, y) => (Math.hypot(x + 0.5 - 98, y + 0.5 - 105) > 5.4 ? C.woodD : C.white));
{
  const hand = (deg, len, c) => { const a = (deg - 90) * Math.PI / 180; line(bg, 98, 105, Math.round(98 + Math.cos(a) * len), Math.round(105 + Math.sin(a) * len), c); };
  hand(7 * 30 + 57 * 0.5, 3, C.plum); // 시침: 8 바로 앞
  hand(57 * 6, 5, C.dusk); // 분침: 12 바로 앞
}
notes.push([98, 95, 1]);
// 창틀(배경): 핫스팟 창 36,114 44×36을 두르는 나무 틀 + 창턱 (창 안쪽·커튼·관리인은 물건)
R(bg, 34, 112, 48, 40, C.wood); R(bg, 34, 112, 48, 1, C.woodL);
R(bg, 28, 150, 80, 4, C.woodL); R(bg, 28, 153, 80, 1, C.wood); // 창턱(자명종이 앉는 곳)
// 아래 벽: 접힌 호스 걸이 + 물뿌리개(관리인이 분수를 관리한다는 것)
ellipse(bg, 52, 172, 7, 7, (x, y) => ((x + y) % 3 ? C.grn : C.grnD)); R(bg, 51, 164, 2, 2, C.lav);
stamp(bg, 86, 186, ['..ll.', 'lllll', 'lllll.l', '.lll.l'], { l: C.tealM });
notes.push([52, 162, 2]);

// ⑥ 연못: 테두리 뒤쪽 가장자리 + 물. 테두리 앞면(물건)이 아래를 덮는다.
ellipse(bg, 224, 182, 100, 16, (x, y) => (y < 172 ? C.lint : undefined)); // 뒤 가장자리 돌(윗면)
ellipse(bg, 224, 182, 96, 13, (x, y) => (y < 176 ? bay(x, y, 0.3, C.tealM, C.tealL) : C.teal));
for (const [x, y] of [[160, 174], [196, 176], [270, 173], [300, 176]]) R(bg, x, y, 5, 1, C.aqua); // 물결 반짝

// ⑦ 동상: 돌우산을 든 사람. 왼손(그림 왼쪽)은 우산 손잡이, 오른손은 앞으로 내밀어 손바닥이 위.
{
  // 물때로 거뭇한 오래된 돌(주색 dusk Y87). 물줄기 가운데 기둥이 이 앞을 지나서, 밝은 돌이면 물(26, Y188)이 사라진다.
  //   대신 왼쪽 위 테두리에 아침 빛(lint Y178)을 얹어 짙은 나무 앞에서도 실루엣, 특히 내민 손(단서)이 읽히게 한다(명도판 확인).
  const S = { light: C.lint, mid: C.dusk, dark: C.plum };
  const stone = (x, y, x0, x1) => (x <= x0 + 1 ? S.light : x <= x0 + 2 ? C.lav : x >= x1 - 2 ? S.dark : S.mid);
  fill(bg, 204, 158, 40, 14, (x, y) => (y === 158 ? S.light : stone(x, y, 204, 244))); // 받침
  fill(bg, 210, 152, 28, 6, (x) => stone(x, 0, 210, 238));
  // 긴 옷(아래로 넓어짐)
  fill(bg, 206, 118, 36, 34, (x, y) => { const hw = 7 + (y - 118) * 0.3; return Math.abs(x + 0.5 - 224) <= hw ? stone(x, y, 224 - hw, 224 + hw) : undefined; });
  for (let y = 128; y < 152; y += 6) line(bg, 220, y, 222, y + 4, S.dark); // 옷 주름
  ellipse(bg, 224, 111, 6, 7, (x, y) => (y < 107 ? S.light : stone(x, 0, 218, 230))); // 머리(정수리에 빛)
  bg.set(221, 110, S.dark); bg.set(226, 110, S.dark); line(bg, 222, 114, 225, 114, S.dark); // 눈 감고 미소(무표정 돌)
  // 오른팔 → 내민 손(손바닥 위). 손 재킷(252,106,18×18)이 여기 걸린다
  fill(bg, 230, 120, 24, 5, (x, y) => (y === 120 ? S.light : y === 121 ? C.lav : y === 124 ? S.dark : S.mid));
  R(bg, 252, 119, 10, 3, S.mid); R(bg, 252, 119, 10, 1, S.light); R(bg, 261, 117, 2, 3, S.mid); // 손가락 끝 살짝 올라감
  notes.push([262, 132, 3]);
  // 왼손 + 우산대
  R(bg, 212, 118, 6, 5, S.mid);
  R(bg, 223, 52, 2, 58, S.dark); R(bg, 223, 52, 1, 58, S.mid);
  // 돌우산(꼭대기 재킷이 얹힘): 낮은 돔 + 처마
  ellipse(bg, 224, 52, 32, 12, (x, y) => (y > 52 ? undefined : y < 44 ? S.light : x < 214 ? C.lav : x > 240 ? S.dark : S.mid));
  R(bg, 192, 51, 64, 2, S.dark);
  for (const x of [192, 208, 224, 240, 255]) bg.set(x, 53, S.dark); // 살 끝
}

// ⑧ 가로등(분수 오른쪽 뒤). 아침이라 꺼져 있다.
R(bg, 307, 96, 3, 86, C.plum); R(bg, 307, 96, 1, 86, C.dusk);
stamp(bg, 302, 86, ['..ddddddd..', '.dcccccccd.', 'dcaaaaaaacd', '.ddddddddd.'], { d: C.plum, c: C.dusk, a: C.lint });
notes.push([314, 92, 4]);

// ⑨ 입구(오른쪽 끝): 돌기둥 + 낮은 철 울타리. 손님이 들어온 쪽.
R(bg, 330, 170, 132, 1, C.dusk);
for (let x = 332; x < 462; x += 6) R(bg, x, 166, 1, 16, C.dusk);
R(bg, 330, 176, 132, 1, C.dusk);
for (const x0 of [462]) {
  R(bg, x0, 140, 16, 58, C.lint); R(bg, x0, 140, 2, 58, C.cotton); R(bg, x0 + 14, 140, 2, 58, C.lav);
  R(bg, x0 - 2, 134, 20, 6, C.cotton); R(bg, x0 - 2, 139, 20, 1, C.lav);
  ellipse(bg, x0 + 8, 130, 5, 4, C.lint);
}
notes.push([470, 124, 5]);
// 벤치(입구 쪽, 비어 있음: 손님이 앉지 않고 서서 기다린다)
R(bg, 360, 184, 40, 3, C.wood); R(bg, 360, 178, 40, 2, C.woodL); R(bg, 362, 187, 2, 8, C.plum); R(bg, 396, 187, 2, 8, C.plum);
notes.push([380, 174, 6]);

// ⑩ 흙길: 걷는 바닥. 분수대 둘레를 돈다. 주색 woodL(Y149)은 세 사람 주색과 모두 30 이상 떨어진다.
fill(bg, 0, PATH_TOP, W, 60, (x, y) => {
  if (y === PATH_TOP) return C.wood; // 잔디와 맞닿는 그늘
  const h = hash(x, y, 20);
  return h < 0.05 ? C.tan : h > 0.97 ? C.wood : C.woodL;
});
for (let i = 0; i < 40; i++) { const x = Math.floor(hash(i, 1, 21) * W), y = 204 + Math.floor(hash(i, 2, 21) * 50); R(bg, x, y, 2, 1, C.tan); bg.set(x, y + 1, C.wood); } // 자갈
// 아래 끝 화단 가장자리(화면 맨 아래 줄)
fill(bg, 0, 258, W, 12, (x, y) => (y === 258 ? C.grnL : hash(x >> 1, y, 22) < 0.3 ? C.grnL : C.grn));
// 비둘기 셋: 재킷 아래 흙길(ズッシー가 7번 쿵을 하는 x 224 근처). 단서 ②에서 날아오른다.
const PIGEON = ['.dd.....', 'dlkd....', '.dtl....', '.dtlllld', '.dllllldd', '..dllll.', '...p..p.'];
for (const [x, y, flip] of [[196, 206, 0], [240, 212, 1], [258, 204, 0]]) {
  const rows = flip ? PIGEON.map((r) => [...r.padEnd(9, '.')].reverse().join('')) : PIGEON;
  stamp(bg, x, y, rows, { l: C.lint, k: C.plum, d: C.lav, t: C.tealM, p: C.redL });
}
notes.push([232, 222, 7]);
// 엎어진 풍선 장수의 풍선 하나(나무에 걸림): 공원 분위기 볼거리
line(bg, 418, 86, 418, 100, C.lav); ellipse(bg, 418, 82, 4, 5, (x, y) => (x < 417 && y < 81 ? C.pinkL : C.pink));
notes.push([426, 74, 8]);

// ═════════════ 물건 (핫스팟, 외곽선) — 시안 수준 ═════════════
const obj = (body) => { const t = new Image(W, H); body(t); fg.blit(outlined(t), 0, 0); };
const HB = L.hotspots;

// A 분수대 테두리 앞면 128,180,192×18: 흰 돌 블록(흙길과 명도 대비)
obj((t) => {
  fill(t, 128, 180, 192, 18, (x, y) => {
    if (y === 180) return C.white;
    if ((x - 128) % 24 === 23 || y === 189) return C.lint; // 블록 줄눈
    if (x > 300 || y > 194) return C.lint;
    return hash(x >> 1, y >> 1, 30) < 0.08 ? C.lint : C.cotton;
  });
});
// B 재킷(꼭대기) 214,32,20×14: 신랑의 분홍 정장 재킷(pink Y173). 위는 밝은 하늘, 손 자리는 짙은 나무·돌 앞이라
//   둘 다에서 읽히는 명도대가 Y 165~173뿐이다(검사 마지막 줄). 소매가 우산 위로 늘어진다.
obj((t) => {
  // 등판이 보이게 돔에 덮였다. 깃은 위, 왼소매는 아래로 늘어지고 오른소매는 바람에 펄럭인다(매트릭스 76행 "펄럭인다").
  stamp(t, 214, 32, [
    '......rrrrrr........',
    '....rLLLLPPPPr......',
    '..rLLLPPPPPPPPr.....',
    '.rLLPPPPPPPPPPPrrrr.',
    'rLLPPPPPPPPPPPPPPPPr',
    'rLPrPPPPPPPPPPPrPPrr',
    'rLPrrPPPPPPPPPPr.rr.',
    'rPr.rPPPPPPPPPPr....',
    'rPr.rPPPPPPPPPPPr...',
    'rPr..rPPPPPPPPPPr...',
    'rPr..rrrrrrrrrrr....',
    'rPr.................',
    '.ww.................',
    '....................',
  ], { r: C.red, P: C.pink, L: C.pinkL, w: C.white });
});
// C 관리인 창 안: 반쯤 열린 커튼 + 조는 얼굴(Zz)
obj((t) => {
  fill(t, 36, 114, 44, 36, (x, y) => (x < 50 ? ((x + (y >> 1)) % 3 ? C.pinkL : C.pink) : bay(x, y, 0.4, C.lint, C.lav)));
  ellipse(t, 62, 130, 9, 9, (x, y) => (y < 124 ? C.woodD : x < 58 ? C.tan : C.woodL)); // 머리
  line(t, 57, 131, 60, 131, C.woodD); line(t, 64, 131, 67, 131, C.woodD); // 감은 눈
  R(t, 52, 139, 20, 11, C.tealD); R(t, 52, 139, 20, 1, C.teal); // 작업복 어깨
  stamp(t, 72, 116, ['zzz', '..z', '.z.', 'zzz'], { z: C.white });
});
// D 닭 자명종 84,140 12×12
obj((t) => {
  stamp(t, 84, 140, [
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
  ], { r: C.red, w: C.white, k: C.plum, y: C.yel, c: C.redL });
});
// E 오리 180,158 14×12
obj((t) => {
  stamp(t, 180, 158, [
    '..yyy.........',
    '.yyyky........',
    'ooyyyy........',
    '..yyy.........',
    '..yyyy...yy...',
    '.yyyyyyyyyy...',
    'yyyyyyYyyyyy..',
    'yyyyyYYyyyyyy.',
    '.yyyyyyyyyyy..',
    '..yyyyyyyyy...',
    '..............',
    '..............',
  ], { y: C.yel, Y: C.yelL, k: C.plum, o: C.redL });
});
// F 손님: 시안의 대충 그림 대신 물건 시트 원본(art/scenes/park_fountain.objects.mjs)의 대기 멈춘 모습을 얹는다.
// 물건 미리보기(park_fountain-objects-preview.mjs)가 손님 없는 판을 쓰도록 따로 둔다.
const guestLayer = new Image(W, H);
OBJECTS.guest.draw(guestLayer);

// ═════════════ 세 사람(배포 시트 0칸, 시작 위치에서 왼쪽을 봄) ═════════════
function readIndexedPng(file) {
  const buf = readFileSync(file);
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); if (buf[p + 17] !== 3) throw new Error('인덱스 PNG만 읽는다'); }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const img = new Image(w, h);
  for (let y = 0; y < h; y++) {
    if (raw[y * (w + 1)] !== 0) throw new Error('필터 0만 읽는다');
    for (let x = 0; x < w; x++) { const i = raw[y * (w + 1) + 1 + x]; img.c[y * w + x] = i >= 32 ? EMPTY : i; }
  }
  return img;
}
const people = new Image(W, H);
const START = { jjuk: [336, 244], mukjik: [376, 244], ppik: [416, 244] }; // 1-2절, floor 376 ±40
for (const [id, [sx, sy]] of Object.entries(START)) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'public/sprites', `${id}-base.json`), 'utf8'));
  const sheet = readIndexedPng(join(ROOT, 'public/sprites', meta.image));
  const [cw, ch] = meta.cell, [ax, ay] = meta.anchor;
  const cell = new Image(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cell.set(x, y, sheet.get(x, y));
  // 시트는 오른쪽을 본다. 분수대(왼쪽)를 보게 기준점 x를 축으로 뒤집는다
  people.blit(cell, sx - (cw - ax), sy - ay, { flipAx: cw / 2 });
}

// 다른 미리보기가 불러 쓸 판: 배경(만질 수 없음), 손님을 뺀 물건, 세 사람(시작 위치).
export { bg, fg, people, START };

// 직접 실행할 때만 검사·출력한다(불러 쓸 때는 그림만).
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  // ═════════════ 합치기 + 검사 ═════════════
  const scene = new Image(W, H);
  scene.blit(bg, 0, 0); scene.blit(fg, 0, 0); scene.blit(guestLayer, 0, 0); scene.blit(people, 0, 0);

  const problems = [];
  const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
  const mainColor = (img, x0, y0, w, h) => {
    const n = new Map();
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY) n.set(c, (n.get(c) ?? 0) + 1); }
    return [...n].sort((a, b) => b[1] - a[1])[0][0];
  };
  const dY = (a, b) => Math.abs(Y[a] - Y[b]);
  check(!bg.c.includes(C.ink) && !bg.c.includes(C.hint), '배경에 ink(0)·hint(31) 없음');
  const floorMain = mainColor(bg, 0, 214, W, 44);
  const MAIN = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };
  for (const [name, c] of Object.entries(MAIN)) check(dY(c, floorMain) >= 30, `흙길 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name} #${c}(Y${Y[c]}) 차 ${dY(c, floorMain)} ≥ 30`);
  const [fx, fy, fw] = HB.fountain.box;
  const rimMain = mainColor(fg, fx, fy, fw, 18);
  check(dY(rimMain, floorMain) >= 30, `테두리 돌 주색 #${rimMain}(Y${Y[rimMain]}) vs 흙길 차 ${dY(rimMain, floorMain)} ≥ 30`);
  // 물줄기 기둥: 효과 자리 가운데 1/3, 켜짐 높이(물보라 꼭대기 ~ 연못)
  const [wx, , ww] = OBJECTS.water.area;
  const columnBack = mainColor(bg, wx + ww / 3, 70, ww / 3, 96);
  for (const c of [C.tealL, C.white]) check(dY(c, columnBack) >= 60, `물줄기 뒤 주색 #${columnBack}(Y${Y[columnBack]}) vs 물 #${c}(Y${Y[c]}) 차 ${dY(c, columnBack)} ≥ 60`);
  const jacketMain = C.pink; // 외곽선(ink)이 더 많아서 주색을 직접 둔다
  for (const [name, [x, y, w, h]] of [['꼭대기', [214, 18, 20, 12]], ['손 둘레', [248, 100, 26, 26]]]) {
    const back = mainColor(bg, x, y, w, h);
    check(dY(jacketMain, back) >= 60, `재킷 #${jacketMain}(Y${Y[jacketMain]}) vs ${name} 뒤 #${back}(Y${Y[back]}) 차 ${dY(jacketMain, back)} ≥ 60`);
  }

  // ───────────── 번호 표시판 (notes 그림 전용) ─────────────
  const DIG = {
    1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'], 3: ['110', '001', '010', '001', '110'],
    4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'], 6: ['011', '100', '110', '101', '010'],
    7: ['111', '001', '010', '010', '010'], 8: ['010', '101', '010', '101', '010'],
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  };
  const tag = (im, x, y, ch, back) => {
    R(im, x - 3, y - 4, 7, 9, back);
    DIG[ch].forEach((row, j) => [...row].forEach((b, i) => b === '1' && im.set(x - 1 + i, y - 2 + j, C.white)));
  };
  const noted = new Image(W, H);
  noted.blit(scene, 0, 0);
  for (const [x, y, n] of notes) tag(noted, x, y, String(n), C.hint);
  for (const [k, x, y] of [['A', 120, 190], ['B', 208, 28], ['C', 30, 120], ['D', 100, 136], ['E', 176, 154], ['F', 434, 172]]) tag(noted, x, y, k, C.purD);

  // 물줄기 켜짐 대충(색 대비 확인용. 모양은 Theo의 fountain_water 효과가 진짜다)
  const wet = new Image(W, H);
  wet.blit(scene, 0, 0);
  for (let i = 0; i < 260; i++) {
    const t = hash(i, 3, 40), side = hash(i, 4, 40) < 0.5 ? -1 : 1;
    const h = hash(i, 5, 40);
    // 가운데 기둥(우산대 앞) + 우산 처마에서 양쪽으로 흘러내리는 물
    const x = h < 0.35 ? 224 + Math.round((t - 0.5) * 6) : Math.round(224 + side * (34 + t * 40));
    const y = h < 0.35 ? Math.round(60 + t * 110) : Math.round(64 + t * 108 + (t * t) * 6);
    const c = hash(i, 6, 40) < 0.15 ? C.white : hash(i, 7, 40) < 0.6 ? C.tealL : C.tealM;
    wet.set(x, y, c); if (h < 0.35) wet.set(x, y + 1, c);
  }

  // ───────────── 출력 ─────────────
  writeFileSync(join(HERE, 'park_fountain-bg-sketch-2x.png'), indexedPng(scene, 2));
  writeFileSync(join(HERE, 'park_fountain-bg-sketch-notes-2x.png'), indexedPng(noted, 2));
  writeFileSync(join(HERE, 'park_fountain-bg-sketch-water-2x.png'), indexedPng(wet, 2));
  {
    const S = 2, w = W * S, h = H * S;
    const raw = Buffer.alloc((w + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[scene.get(Math.floor(x / S), Math.floor(y / S))];
    const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
    const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
    writeFileSync(join(HERE, 'park_fountain-bg-sketch-gray-2x.png'), Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
    ]));
  }
  console.log(`배경 1배 크기(인덱스 PNG): ${indexedPng(bg, 1).length} bytes`);
  if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
}
