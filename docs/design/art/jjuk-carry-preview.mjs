// 쭉이 든 물건 얹는 점(carry) 미리보기 (ADR-1031 4·5절, #1031). 원본은 art/sprites/jjuk-v4.mjs, 점은 public/sprites/jjuk-base.json `carry`.
// 서 있기 2칸·걷기 6칸 위에 가장 큰 들 물건(20×20, ADR-1031 5절 상한) 자리 상자를 아래 가운데 = carry로 얹어 본다.
// 위 줄은 오른쪽을 본 칸, 아래 줄은 엔진처럼 기준점 경계로 뒤집은 왼쪽을 본 칸(carry x도 칸 폭 − x로 뒤집는다).
// 물건 자리 상자는 그림이 아니라 크기 확인용이다(빨강 테두리, 안은 비움).
// 실행: node docs/design/art/jjuk-carry-preview.mjs → 같은 폴더 jjuk-carry-preview-4x.png

import { readFileSync, writeFileSync } from 'node:fs';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SHEET, pose } from '../../../art/sprites/jjuk-v4.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'public', 'sprites', 'jjuk-base.json'), 'utf8'));
const [CW, CH] = meta.cell;
const AX = meta.anchor[0];
const ITEM = 20;
const TOP = ITEM + 4; // 칸 위 여백
const GAP = 4;
const frames = [];
for (const name of ['idle', 'walk']) {
  meta.anims[name].carry.forEach((c, k) => frames.push({ K: SHEET.drawFrame(pose(name, k)).K, carry: c }));
}
const img = new Image(frames.length * (CW + GAP), 2 * (TOP + CH + GAP), C.cotton);
const box = (x0, y0) => {
  for (let i = 0; i < ITEM; i++) {
    img.set(x0 + i, y0, C.red); img.set(x0 + i, y0 + ITEM - 1, C.red);
    img.set(x0, y0 + i, C.red); img.set(x0 + ITEM - 1, y0 + i, C.red);
  }
};
frames.forEach((f, i) => {
  for (const flip of [false, true]) {
    const ox = i * (CW + GAP), oy = (flip ? TOP + CH + GAP : 0) + TOP;
    img.rect(ox, oy + CH - 1, CW, 1, C.lint); // 바닥 줄
    img.blit(f.K, ox, oy, flip ? { flipAx: AX } : {});
    const cx = flip ? 2 * AX - f.carry[0] : f.carry[0]; // 연속 좌표(픽셀 경계)를 기준점 경계로 뒤집는다
    box(ox + cx - ITEM / 2, oy + f.carry[1] - ITEM);
  }
});
writeFileSync(join(HERE, 'jjuk-carry-preview-4x.png'), indexedPng(img, 4));
console.log('jjuk-carry-preview-4x.png', frames.map((f) => f.carry.join(',')).join(' '));
