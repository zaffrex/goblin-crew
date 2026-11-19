// park_fountain 물줄기 입자(그림 형식 개정 4, 11-4절, #425) 미리보기. 엔진과 같은 fxParticles()로 그린다.
// 실행: node --experimental-strip-types docs/design/screens/park_fountain-water-preview.mjs
//   (src/core/sceneFx.ts를 바로 읽어서 타입 지우기가 필요하다. Node 22.18 이상은 플래그 없이도 된다)
// 출력(같은 폴더): park_fountain-water-preview-2x.png
//   왼쪽부터 on 2장(화면 시계 3000·3400ms) / stop 300·600ms / burst 200·400ms. 배경은 임시 dusk(2번), 아래 회색 줄은 테두리 자리.
// 값은 #424 회색 배치(area 152,8,144×172, colors 26·25·6·24). 진짜 하늘색 위 대비는 배경이 붙은 뒤 다시 본다.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { fxParticles } from '../../../src/core/sceneFx.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const AREA = [152, 8, 144, 172], COLORS = [26, 25, 6, 24];
const CASES = [
  ['on', 3000, 0, 0], ['on', 3400, 0, 0],
  ['stop', 3300, 300, 900], ['stop', 3600, 600, 900],
  ['burst', 3200, 200, 1200], ['burst', 3400, 400, 1200],
];
const W = 160, H = 190;
const img = new Image(W * CASES.length, H);
img.rect(0, 0, img.w, img.h, 2);
CASES.forEach(([mode, clockMs, slotMs, durMs], k) => {
  const ox = k * W - AREA[0] + 8, oy = 4;
  img.rect(k * W + 8, oy + AREA[1] + AREA[3], AREA[2], 2, 4);
  for (const p of fxParticles({ key: 'water', effect: 'fountain_water', area: AREA, colors: COLORS, mode, clockMs, slotMs, durMs }))
    img.rect(p.x + ox, p.y + oy, p.size, p.size, p.color);
});
writeFileSync(join(HERE, 'park_fountain-water-preview-2x.png'), indexedPng(img, 2));
