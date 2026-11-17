// 사람 스프라이트 마감 패스 (#142 새 밀도). 쭉이(jjuk-v4.mjs)에서 만들어 묵직이·삑삑이가 같이 쓴다.
// 순서: 부품 그리기 → colorLines → (손·머리 stamp) → rimShade → soles → K.outline()
// 색 지도(line·down)는 캐릭터마다 넘긴다. 같은 색이라도 캐릭터마다 의미가 다를 수 있어서다.

import { C, EMPTY } from './pixel.mjs';

/**
 * 같은 부품 경계선(색별). 앞 부품과 맞닿은 뒤 부품 픽셀을 뒤 부품의 선 색으로 칠한다.
 * line: 부품 ramp의 첫 색 → 선 색. 없으면 plum.
 */
export function colorLines(K, line) {
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
          out[i] = line.get(K.parts[a].ramp[0]) ?? C.plum;
          break;
        }
      }
    }
  K.c = out;
}

/** 외곽선 바로 안쪽, 빛 반대쪽(오른쪽·아래)이 비어 있는 픽셀을 한 단 내린다(down: 색 → 한 단 어두운 색). skip 부품은 뺀다. */
export function rimShade(K, skip, down) {
  const out = K.c.slice();
  for (let y = 0; y < K.h; y++)
    for (let x = 0; x < K.w; x++) {
      const c = K.get(x, y);
      if (c === EMPTY || skip.has(K.p[y * K.w + x])) continue;
      const open = (dx, dy) => K.get(x + dx, y + dy) === EMPTY;
      if ((open(1, 0) || open(0, 1)) && down.has(c)) out[y * K.w + x] = down.get(c);
    }
  K.c = out;
}

/**
 * 신발 밑창: 신발 부품의 맨 아랫줄 바로 위 줄을 band 색으로. 맨 아랫줄은 woodD(바닥 접지).
 * band 기본 lint = 운동화 밑창 띠(쭉이). 장화는 woodL(묵직이). 삑삑이 신발도 종류에 맞춰 넘긴다.
 */
export function soles(K, shoeParts, band = C.lint) {
  for (const pid of shoeParts) {
    for (let x = 0; x < K.w; x++) {
      let bottom = -1;
      for (let y = 0; y < K.h; y++) if (K.p[y * K.w + x] === pid && K.get(x, y) !== EMPTY) bottom = y;
      if (bottom < 1) continue;
      if (K.p[(bottom - 1) * K.w + x] === pid) K.c[(bottom - 1) * K.w + x] = band;
      K.c[bottom * K.w + x] = C.woodD;
    }
  }
}

/** 엔진이 이어 그리는 장대 폭(src/core/sprite.ts `POLE_WIDTH` = 4)의 절반. */
const POLE_HALF = 2;

/**
 * 칸 가장자리(위 0행, 왼·오른쪽 끝 열)에 있는 부품 픽셀 중 외곽선(ink)이 아닌 것의 "x,y" 목록(#220).
 * 이런 픽셀은 바깥 외곽선이 칸 밖으로 나가 잘린다(ADR-0007 결정 3). fx처럼 부품 없이 dot·stamp한 픽셀은 안 센다.
 * tip: 칸 위로 나가는 장대가 있는 칸의 tip [x, y]. 엔진은 0행의 tx − 2 … tx + 1(장대 2px + 양옆 잉크, src/core/sprite.ts
 * `POLE_WIDTH` 4px)을 위로 이어 그리므로 0행에서 그 4열만 뺀다. 나머지 0행(머리·손 등)은 그대로 본다(#223).
 */
export function clippedEdge(K, { tip } = {}) {
  const bad = [];
  const check = (x, y) => {
    const i = y * K.w + x;
    if (K.p[i] >= 0 && K.c[i] !== C.ink) bad.push(`${x},${y}`);
  };
  const joined = (x) => tip !== undefined && x >= tip[0] - POLE_HALF && x < tip[0] + POLE_HALF;
  for (let x = 0; x < K.w; x++) if (!joined(x)) check(x, 0);
  for (let y = 1; y < K.h; y++) { check(0, y); check(K.w - 1, y); }
  return bad;
}
