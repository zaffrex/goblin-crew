// 화면 2 `park_fountain` S2 정답 2번 길이 고정 (#802, PR #816 Theo 우려 1).
// 정답 2번 `fountain_stomp_drop` 연출은 replay로 +1.38초, ADR-0761 H5 한도(중간 성공 +1.5초)까지 여유가 0.12초뿐이다
// (설계 docs/design/screens/park_fountain-s2.md 8절). 그 길이 대부분이 `floor.pigeons_perch` + `jacket.slide` 시트 칸 시간이라,
// 그림 쪽에서 칸 시간을 늘리면 H5를 조용히 넘는다. 그래서 두 anim 칸 시간 합을 지금 값으로 고정한다.
// 칸 시간을 늘리고 싶으면 이 상한을 고치는 PR에서 replay로 H5를 다시 재서 본문에 적는다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSceneArt } from '../../src/core/sceneArt';

const ROOT = join(import.meta.dirname, '..', '..');
// 엔진이 받는 것과 같은 검증을 거친다(PR #820 Theo 니트).
const sheet = parseSceneArt(JSON.parse(readFileSync(join(ROOT, 'public', 'scenes', 'park_fountain-objects.json'), 'utf8')));

/** 11/23 값: perch 1030ms + slide 1040ms. */
const PERCH_SLIDE_MAX_MS = 2070;

const totalMs = (name: string): number => {
  const anim = sheet.anims[name];
  if (!anim) throw new Error(`시트에 ${name} 없음`);
  const ms = anim.ms as number | number[];
  return Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) : ms * anim.frames.length;
};

describe('park_fountain S2 정답 2번 길이 (H5 ②)', () => {
  it(`floor.pigeons_perch + jacket.slide 칸 시간 합 ≤ ${PERCH_SLIDE_MAX_MS}ms`, () => {
    const perch = totalMs('floor.pigeons_perch');
    const slide = totalMs('jacket.slide');
    expect(perch + slide, `perch ${perch}ms + slide ${slide}ms`).toBeLessThanOrEqual(PERCH_SLIDE_MAX_MS);
  });
});
