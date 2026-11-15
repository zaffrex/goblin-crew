import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { createScene, currentBubble, isBusy, sceneLayout, sceneTap, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { planAction, type Input } from './plan';
import { checkStep, scenarios, selectedTarget, slopProbes } from './scenarios';

// replay.ts가 Chrome에서 돌릴 시나리오를 실제 scene.ts에 그대로 넣어 본다(Chrome 없음).
// 여기서 실패하면 시나리오가 틀렸거나 게임이 틀린 것이다. Chrome 재생 전에 먼저 걸러 낸다.

const load = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const data: SceneData = {
  screen: load('content/screens/magpie_nest.json') as ScreenData,
  characters: load('content/characters.json') as CharactersData,
};
const id = (s: string) => s;

/**
 * 재생으로 찾은 알려진 버그(#129: 게이지 0 리셋 뒤 HUD 게이지가 0에 머묾). 고치면 이 목록을 []로 바꾼다.
 * 목록과 정확히 같아야 통과하므로, 고쳐지거나 새 문제가 생기면 이 테스트가 깨져서 알려 준다.
 */
const KNOWN_A3 = ['규칙 7 3회 → 게이지 0: 게이지 0 (기대 5)'];

/** 연출이 끝날 때까지 틱. 그 사이 뜬 말풍선 글 id를 모은다(replay.ts는 DOM `#bubble`을 본다). */
function idle(s: SceneState, said: string[]): void {
  for (let i = 0; i < 10_000 && isBusy(s); i++) {
    sceneTick(data, s);
    const b = currentBubble(s);
    if (b && said.at(-1) !== b.text) said.push(b.text);
  }
  expect(isBusy(s)).toBe(false);
}

function run(input: Input, scenarioId: string): { s: SceneState; problems: string[] } {
  const sc = scenarios(data.screen).find((x) => x.id === scenarioId)!;
  const s = createScene(data);
  idle(s, []);
  const problems: string[] = [];
  for (const step of sc.steps) {
    const plan = planAction(data.screen, sceneLayout(data, s), step.action, input);
    expect(plan.warnings, step.label).toEqual([]);
    const said: string[] = [];
    for (const t of plan.taps) {
      const r = sceneTap(data, s, t.at, input === 'touch' ? 8 : 0, input === 'touch');
      expect(r.kind, `${step.label} / ${t.why}`).toBe('intent');
      idle(s, said);
    }
    problems.push(...checkStep(data.screen, step, sceneLayout(data, s), said, id).map((p) => `${step.label}: ${p}`));
  }
  return { s, problems };
}

describe('M1 판정 시나리오 (scene.ts 직접, Chrome 없음)', () => {
  for (const input of ['mouse', 'touch'] as const) {
    it(`${input} A1: solution 그대로 클리어`, () => {
      const { s, problems } = run(input, 'A1');
      expect(problems).toEqual([]);
      expect(s.cleared).toBe(true);
    });

    it(`${input} A2·A3: 오답 두 번씩 → 게이지 0 → 리셋 → 클리어`, () => {
      const { s, problems } = run(input, 'A2A3');
      expect(problems).toEqual(KNOWN_A3);
      expect(s.cleared).toBe(true);
    });
  }

  it('A6②: 터치 8px은 선택, 9px은 선택 안 됨', () => {
    for (const p of slopProbes(data.screen)) {
      const s = createScene(data);
      idle(s, []);
      sceneTap(data, s, p.at, 8, true);
      expect(selectedTarget(sceneLayout(data, s).selected), p.label).toBe(p.selects ? p.target : null);
    }
  });
});
