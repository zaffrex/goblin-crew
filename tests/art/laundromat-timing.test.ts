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
import { CHARACTERS } from '../../src/core/characters';
import type { Action, CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { createScene, isBusy, sceneLayout, sceneTap, sceneTick, TIMING, type SceneData, type SceneState } from '../../src/core/scene';
import { parseSceneArt } from '../../src/core/sceneArt';
import { parseSpriteMeta } from '../../src/core/sprite';
import { CASES_BY_SCREEN } from '../../scripts/playtest/cases/index';
import { planAction, type Input } from '../../scripts/playtest/plan';

const ROOT = join(import.meta.dirname, '..', '..');
const sheet = parseSceneArt(JSON.parse(readFileSync(join(ROOT, 'public', 'scenes', 'laundromat-objects.json'), 'utf8')));

/** ADR-0761 H5. */
const H5_MAX_MS = 1500;
/** 시트에 칸이 없는 물건 anim의 엔진 길이(`scene.ts` `TIMING.anim`). */
const ENGINE_ANIM_FALLBACK_MS = TIMING.anim * TICK_MS;

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

  // #935 S3: 문 벌컥 앞에 말랑한 양말 혹(`duct.sock_through`, Luna 안 (나))이 창 → 천장 덕트 → 건조기 뒤로 온다. 이것도 ★① 첫 판에
  // 붙은 시간이라 같이 센다. 시트에 아직 없으면 엔진 기본(`TIMING.anim` 30틱 = 0.5초)이 돈다. 혹 앞 `magpie.ruffle`은 전처럼 안 센다
  // (S3 단서 B, 설계 8-3 표 "붙인 엉뚱함" 밖).
  it.skipIf(!has('dryer_3.burst', 'dryer_3.sock_head'))(`★① 첫 판: 양말 혹 + 문 벌컥 행렬 + 머리 위 양말 ≤ ${H5_MAX_MS}ms`, () => {
    const lump = has('duct.sock_through') ? totalMs('duct.sock_through') : ENGINE_ANIM_FALLBACK_MS;
    const burst = totalMs('dryer_3.burst');
    const sock = totalMs('dryer_3.sock_head');
    expect(lump + burst + sock, `sock_through ${lump}ms + burst ${burst}ms + sock_head ${sock}ms`).toBeLessThanOrEqual(H5_MAX_MS);
  });

  it.skipIf(!has('dryer_3.burst', 'dryer_3.burst#2'))('★① 두 번째부터: `burst#2`가 첫 판보다 짧다(H5 짧은 판)', () => {
    expect(totalMs('dryer_3.burst#2')).toBeLessThan(totalMs('dryer_3.burst'));
  });
});

// ADR-0761 H6(클리어 연출 8초 안): 빨래방 클리어는 이미 넘는다(#802 (d), 11/25 replay 10.95초). 셔터 올라감(`shutter.roll_up`, 2/2-c1)은
// 시트에 없을 때 엔진 폴백 0.5초였다. 그림이 붙으면서 클리어가 더 길어지지 않게 폴백 길이 안으로 묶는다. 줄이는 건 Kai (d) 몫이다.
const ENGINE_FALLBACK_MS = 500;

describe('laundromat 클리어 길이 (H6, 그림이 늘리지 않음)', () => {
  it.skipIf(!has('shutter.roll_up'))(`클리어 마지막 박자 셔터 올라감 ≤ 엔진 폴백 ${ENGINE_FALLBACK_MS}ms`, () => {
    expect(totalMs('shutter.roll_up')).toBeLessThanOrEqual(ENGINE_FALLBACK_MS);
  });
});

// ADR-0761 H6 전체 길이: 마지막 탭 → 대기열이 빔(클리어 카드). `aha-s6-clear` 사례를 실제 scene.ts에 넣고 틱으로 잰다(#802 (d)).
// 엔진과 같은 재료를 쓴다: 물건 시트 메타, 캐릭터 시트 메타(`public/sprites/*-base.json`), 글 파일(말풍선 길이 = 글자 수).
// 시트 알파는 안 넣는다(누를 대상 고르기에만 쓰여 길이와 상관없음).
//
// 8초를 넘던 동안은 상한이 그때 잰 길이(`KNOWN_OVER_TICKS`)였다. #802 (d)로 8초 안에 들어와 null이고, 이제 H6 480틱으로 잠겨 있다.
// 다시 숫자로 되돌리지 않는다. 클리어에 박자를 더하려면 다른 박자를 뺀다(설계 laundromat.md 8-2).
const H6_TICKS = Math.round(8000 / TICK_MS);
/** 11/26 main(`120b465`, #963 뒤) 10.77초(646틱)였다. #802 (d)(PR #966)로 7.77초(466틱)가 되어 null, H6 480틱으로 잠근다. */
const KNOWN_OVER_TICKS: number | null = null;

const characters = JSON.parse(readFileSync(join(ROOT, 'content', 'characters.json'), 'utf8')) as CharactersData;
const texts = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(join(ROOT, 'content', 'text', 'ja.json'), 'utf8')) as Record<string, unknown>).filter(
    (e): e is [string, string] => typeof e[1] === 'string',
  ),
);
const sprites = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, parseSpriteMeta(JSON.parse(readFileSync(join(ROOT, 'public', 'sprites', `${c.id}-base.json`), 'utf8')))]),
);
const sceneData: SceneData = {
  screen: JSON.parse(readFileSync(join(ROOT, 'content', 'screens', 'laundromat.json'), 'utf8')) as ScreenData,
  characters,
  art: sheet,
  sprites,
  texts,
};

/** 행동 하나를 실제 탭으로 누르고, 마지막 탭부터 연출이 끝날 때까지 틱 수. */
function tapAndWait(s: SceneState, a: Action, input: Input): number {
  const plan = planAction(sceneData.screen, sceneLayout(sceneData, s), a, input, {});
  expect(plan.warnings).toEqual([]);
  let ticks = 0;
  for (const t of plan.taps) {
    expect(sceneTap(sceneData, s, t.at, input === 'touch' ? 8 : 0, input === 'touch').kind).toBe('intent');
    ticks = 0;
    while (isBusy(s) && ticks < 20_000) {
      sceneTick(sceneData, s);
      ticks++;
    }
  }
  return ticks;
}

function clearTicks(input: Input): number {
  const c = CASES_BY_SCREEN.laundromat!.find((x) => x.id === 'aha-s6-clear')!;
  const s = createScene(sceneData);
  while (isBusy(s)) sceneTick(sceneData, s);
  for (const a of c.pre ?? []) tapAndWait(s, a, input);
  const ticks = tapAndWait(s, c.action!, input);
  expect(s.cleared, '사례가 클리어까지 안 감').toBe(true);
  return ticks;
}

const secs = (t: number): string => `${((t * TICK_MS) / 1000).toFixed(2)}초(${t}틱)`;

describe('laundromat 클리어 전체 길이 (H6, 마지막 탭 → 카드)', () => {
  for (const input of ['mouse', 'touch'] as const) {
    it(`${input}: 지금 길이보다 길어지지 않는다 (8초 안이면 H6 ${H6_TICKS}틱)`, () => {
      const t = clearTicks(input);
      expect(t, `클리어 ${secs(t)}`).toBeLessThanOrEqual(KNOWN_OVER_TICKS ?? H6_TICKS);
    });
  }

  it.skipIf(KNOWN_OVER_TICKS === null)('8초 안에 들어왔으면 KNOWN_OVER_TICKS를 null로 바꿔 H6로 잠근다', () => {
    const t = clearTicks('mouse');
    expect(t, `클리어 ${secs(t)}로 8초 안이에요. 이 파일 KNOWN_OVER_TICKS를 null로 바꿔 주세요(#802 (d))`).toBeGreaterThan(H6_TICKS);
  });
});
