// 화면 3 `laundromat` 중간 성공 길이 상한 (#764, ADR-0761 H5: 붙인 엉뚱함은 담백한 판보다 1.5초 안).
// `park-fountain-timing.test.ts`와 같은 방식이다. 붙인 엉뚱함 대부분이 시트 칸 시간이라 그림 쪽에서 늘리면 H5를 조용히 넘는다.
// 무엇이 "붙인 엉뚱함"인지는 설계 `docs/design/screens/laundromat.md` 8-3절 표를 따른다.
//
// 11/25 시트 1/2(#937) 기준 엔진 타임라인(틱 단위로 돌림, 2/2 칸 없는 anim은 엔진 기본 0.5초):
// - 3-2 `gap_squeak_suck`(커밋된 정답 길): 빈 부리(`magpie.beak_suck` 마지막 칸 160ms) + `huh_text` fx 500ms가 이미 0.66초다.
//   깃털(`feather_puff` + `feather_head`, 시트 2/2)에 남는 몫은 0.84초다. 설계 어림 +0.8초는 `？` fx 0.5초를 안 셌다.
// - ★① `dryer_reverse`: 문 벌컥 행렬(`burst`) + 머리 위 양말(`sock_head`)이 붙인 엉뚱함이다(설계 어림 +1.2초).
// 2/2 anim이 시트에 아직 없으면 그 줄은 건너뛴다. 시트 2/2 PR이 칸을 넣는 순간부터 막는다.
// 상한을 고치고 싶으면 이 파일을 고치는 PR에서 replay로 H5를 다시 재서 본문에 적는다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TICK_MS } from '../../src/core/config';
import { fxTicks } from '../../src/core/fx';
import { parseSceneArt } from '../../src/core/sceneArt';

const ROOT = join(import.meta.dirname, '..', '..');
const sheet = parseSceneArt(JSON.parse(readFileSync(join(ROOT, 'public', 'scenes', 'laundromat-objects.json'), 'utf8')));

/** ADR-0761 H5. */
const H5_MAX_MS = 1500;

const has = (...names: string[]): boolean => names.every((n) => n in sheet.anims);

const msOf = (name: string): number[] => {
  const anim = sheet.anims[name];
  if (!anim) throw new Error(`시트에 ${name} 없음`);
  const ms = anim.ms as number | number[];
  return Array.isArray(ms) ? ms : anim.frames.map(() => ms);
};
const totalMs = (name: string): number => msOf(name).reduce((a, b) => a + b, 0);

/** 빈 부리 멍: 열쇠가 빨려 든 뒤 칸(마지막 칸) + `？` 글자 fx. 칸 0개 대기 연출이라 시트 1/2에 이미 있다. */
const blankBeakMs = (): number => msOf('magpie.beak_suck').at(-1)! + fxTicks('huh_text') * TICK_MS;

describe('laundromat 중간 성공 길이 (H5, 설계 8-3)', () => {
  it('빈 부리 멍(시트 1/2)은 H5 절반 안이다. 넘으면 깃털 몫이 없다', () => {
    expect(blankBeakMs()).toBeLessThanOrEqual(H5_MAX_MS / 2);
  });

  it.skipIf(!has('dryer_3.feather_puff', 'dryer_3.feather_head'))(
    `3-2 suck: 빈 부리 멍 + 깃털 퐁 + 머리 위 깃털 ≤ ${H5_MAX_MS}ms`,
    () => {
      const blank = blankBeakMs();
      const feather = totalMs('dryer_3.feather_puff') + totalMs('dryer_3.feather_head');
      expect(blank + feather, `빈 부리 ${blank}ms + 깃털 ${feather}ms`).toBeLessThanOrEqual(H5_MAX_MS);
    },
  );

  it.skipIf(!has('dryer_3.burst', 'dryer_3.sock_head'))(`★① 첫 판: 문 벌컥 행렬 + 머리 위 양말 ≤ ${H5_MAX_MS}ms`, () => {
    const burst = totalMs('dryer_3.burst');
    const sock = totalMs('dryer_3.sock_head');
    expect(burst + sock, `burst ${burst}ms + sock_head ${sock}ms`).toBeLessThanOrEqual(H5_MAX_MS);
  });

  it.skipIf(!has('dryer_3.burst', 'dryer_3.burst#2'))('★① 두 번째부터: `burst#2`가 첫 판보다 짧다(H5 짧은 판)', () => {
    expect(totalMs('dryer_3.burst#2')).toBeLessThan(totalMs('dryer_3.burst'));
  });
});
