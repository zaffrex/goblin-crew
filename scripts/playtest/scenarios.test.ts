import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { createScene, currentBubble, currentCut, isBusy, sceneLayout, sceneTap, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { sayTextVariants } from '../../src/core/sayText';
import { planAction, type Input } from './plan';
import { checkStep, scenarios, selectedTarget, slopProbes } from './scenarios';

// replay.ts가 Chrome에서 돌릴 시나리오를 실제 scene.ts에 그대로 넣어 본다(Chrome 없음).
// 여기서 실패하면 시나리오가 틀렸거나 게임이 틀린 것이다. Chrome 재생 전에 먼저 걸러 낸다.

const load = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const data: SceneData = {
  screen: load('content/screens/magpie_nest.json') as ScreenData,
  characters: load('content/characters.json') as CharactersData,
};
const id = (s: string) => [s];

/**
 * 재생으로 찾은 알려진 버그 목록. 비어 있어야 정상이다(#129 수정으로 비움).
 * 목록과 정확히 같아야 통과하므로, 고쳐지거나 새 문제가 생기면 이 테스트가 깨져서 알려 준다.
 */
const KNOWN_A3: string[] = [];

/** 연출이 끝날 때까지 틱. 그 사이 뜬 말풍선·컷 글 id를 모은다(replay.ts는 DOM `#bubble`·`#faint`를 본다). */
function idle(s: SceneState, said: string[]): void {
  for (let i = 0; i < 10_000 && isBusy(s); i++) {
    sceneTick(data, s);
    const b = currentBubble(s);
    if (b && said.at(-1) !== b.text) said.push(b.text);
    const c = currentCut(s);
    if (c && !said.includes(c)) said.push(c);
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

    it(`${input} R206: 시소 반응 11·13·14·15번 (#206, #339)`, () => {
      const { s, problems } = run(input, 'R206');
      expect(problems).toEqual([]);
      expect(s.puzzle.at).toEqual({ jjuk: 'floor', mukjik: 'floor', ppik: 'floor' });
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

describe('checkStep 말풍선 글 대조 (#304)', () => {
  const TEXT = load('content/text/ja.json') as Record<string, string>;
  const variants = (k: string) => sayTextVariants(TEXT, k);
  const step = (says: string[]) => ({
    action: { char: 'mukjik', verb: 'look', target: 'nest' },
    check: 'A1',
    label: 'みる 둥지',
    expect: { says },
  }) as unknown as Parameters<typeof checkStep>[1];
  const layout = () => sceneLayout(data, createScene(data));

  it('화자별 변형 글(묵직이 みる 둥지)이 뜨면 그 줄이 뜬 것으로 친다', () => {
    const said = [TEXT['magpie_nest.look.nest.mukjik']!];
    expect(checkStep(data.screen, step(['magpie_nest.look.nest']), layout(), said, variants)).toEqual([]);
  });

  it('다른 글이 뜨면 여전히 안 뜬 것으로 잡는다', () => {
    const said = [TEXT['magpie_nest.enter'] ?? 'magpie_nest.enter'];
    expect(checkStep(data.screen, step(['magpie_nest.look.nest']), layout(), said, variants)).toHaveLength(1);
  });
});
