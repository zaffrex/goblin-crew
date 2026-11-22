// 화면 2 `park_fountain` 동상 그림 (#802). 배경(park_fountain.mjs)과 물건 시트(park_fountain.objects.mjs)가 같이 쓴다.
// 동상은 S2 미끼(`statue` hotspot, PR #827)라 클릭되는 물건이 됐다. 시트에 없으면 엔진이 그 자리에 임시 상자를 그린다
// (scene-art-format 9절 폴백). 그래서 시트에도 같은 그림을 외곽선을 둘러 얹는다(ADR-0007 3-1). 배경에도 그대로 남겨 둔다
// (시트가 읽히기 전 프레임, 배경 미리보기, 배경 대비 검사가 지금과 같게).

import { C } from '../lib/pixel.mjs';
import { hash, fill, ellipse, line } from '../lib/texture.mjs';

const R = (img, x, y, w, h, c) => img.rect(x, y, w, h, c);

// ═════════════ ⑦ 동상 ═════════════
/**
 * 돌우산을 든 사람. 왼손(그림 왼쪽)은 우산 손잡이, 오른손은 앞으로 내밀어 손바닥이 위(재킷이 떨어져 걸리는 곳, 단서).
 * 물때로 거뭇한 오래된 돌(주색 dusk Y87): 물줄기 가운데 기둥(tealL Y188·흰 물보라)이 이 앞을 지난다.
 * 시안의 남은 위험 "명도판에서 몸통이 나무와 붙는다"를 고쳤다: 몸통 왼쪽 빛(lint→lav)을 2~3px로 넓히고 옷자락 끝에 빛줄.
 * 손 좌표는 재킷 칸(objects JACKET_HAND_AT 250,107, 손바닥 윗면 y 119, x 252~262)과 맞물려 있어 옮기지 않는다.
 */
export function statue(bg) {
  const S = { light: C.lint, mid: C.dusk, dark: C.plum };
  const stone = (x, x0, x1) => (x <= x0 + 1 ? S.light : x <= x0 + 3 ? C.lav : x >= x1 - 2 ? S.dark : S.mid);
  // 받침: 2단. 윗단 모서리 빛, 아랫단에 물때 줄
  fill(bg, 204, 158, 40, 14, (x, y) => {
    if (y === 158) return S.light;
    if (y === 159) return x < 236 ? C.lav : S.mid;
    const c = stone(x, 204, 244);
    if (c === S.mid && (x * 5 + Math.floor(y / 3)) % 11 === 0) return S.dark; // 물때 세로 줄
    return c;
  });
  R(bg, 206, 165, 6, 1, C.lav); R(bg, 214, 163, 20, 5, S.dark); R(bg, 215, 164, 18, 3, S.mid); R(bg, 215, 164, 18, 1, C.lav); // 글자 없는 명판(움푹)
  fill(bg, 210, 152, 28, 6, (x) => stone(x, 210, 238));
  R(bg, 210, 152, 28, 1, S.light);
  // 긴 옷(아래로 넓어짐) + 주름 + 옷자락 끝 빛
  fill(bg, 206, 118, 36, 34, (x, y) => {
    const hw = 7 + (y - 118) * 0.3;
    if (Math.abs(x + 0.5 - 224) > hw) return undefined;
    return stone(x, 224 - hw, 224 + hw);
  });
  for (let y = 128; y < 152; y += 6) { line(bg, 220, y, 222, y + 4, S.dark); line(bg, 227, y + 2, 228, y + 5, S.dark); bg.set(219, y, C.lav); }
  for (let x = 208; x < 241; x++) if (bg.get(x, 151) === S.mid) bg.set(x, 151, x < 224 ? C.lav : S.dark);
  // 물때(우산 처마에서 흘러내린 자국): 어깨·옷에 가는 세로 줄
  for (const x of [216, 230, 233]) for (let y = 122; y < 146; y++) if (bg.get(x, y) === S.mid && hash(x, y >> 2, 42) < 0.7) bg.set(x, y, S.dark);
  // 머리(정수리에 빛) + 감은 눈과 옅은 미소(무표정 돌)
  ellipse(bg, 224, 111, 6, 7, (x, y) => (y < 107 ? (x < 226 ? S.light : C.lav) : stone(x, 218, 230)));
  bg.set(221, 110, S.dark); bg.set(226, 110, S.dark); line(bg, 222, 114, 225, 114, S.dark);
  R(bg, 221, 117, 6, 1, S.dark); // 목 그늘
  // 오른팔 → 내민 손(손바닥 위). 손 재킷(250,107)이 여기 걸린다
  fill(bg, 230, 120, 24, 5, (x, y) => (y === 120 ? S.light : y === 121 ? C.lav : y === 124 ? S.dark : S.mid));
  R(bg, 238, 121, 1, 3, S.dark); // 팔꿈치 주름
  R(bg, 252, 119, 10, 3, S.mid); R(bg, 252, 119, 10, 1, S.light); R(bg, 261, 117, 2, 3, S.mid); bg.set(261, 117, S.light); // 손가락 끝 살짝 올라감
  R(bg, 252, 122, 9, 1, S.dark); // 손 아래 그늘
  // 왼손 + 우산대
  R(bg, 212, 118, 6, 5, S.mid); R(bg, 212, 118, 6, 1, S.light); R(bg, 212, 118, 1, 5, C.lav);
  R(bg, 223, 52, 2, 66, S.dark); R(bg, 223, 52, 1, 66, S.mid);
  for (const y of [70, 92]) bg.set(223, y, C.lav); // 우산대 마디
  // 돌우산(꼭대기 재킷이 얹힘): 낮은 돔 + 처마 + 살 끝. 윗면은 아침 빛, 오른쪽은 그늘
  ellipse(bg, 224, 52, 32, 12, (x, y) => {
    if (y > 52) return undefined;
    if (y < 44) return x < 232 ? S.light : C.lav;
    if (x < 214) return C.lav;
    if (x > 240) return S.dark;
    return (x - 192) % 8 === 0 ? S.dark : S.mid; // 우산 살 골
  });
  R(bg, 192, 51, 64, 2, S.dark); R(bg, 192, 51, 30, 1, S.mid);
  for (const x of [192, 208, 224, 240, 255]) bg.set(x, 53, S.dark);
  R(bg, 222, 39, 4, 2, S.mid); bg.set(222, 39, S.light); // 꼭지
}

/** 처마 끝 물방울 자국(우산이 젖어 있다: 분수가 이 우산 위로 뿜는다). 효과 픽셀이라 물건 시트에서는 외곽선 밖이다. */
export function statueDrips(bg) {
  for (const x of [196, 252]) { bg.set(x, 54, C.tealM); bg.set(x, 56, C.tealL); }
}
