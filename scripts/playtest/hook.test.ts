import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { createScene, isBusy, sceneLayout, sceneTap, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { planAction, type Input, type Layout } from './plan';

// #68 2부 체크리스트: plan.ts가 **실제 게임 훅 배치**(`sceneLayout`, `window.__gcLayout()`이 돌려주는 값)로 고른 점을
// 실제 `sceneTap`에 넣고 연출이 끝날 때까지 틱을 돌려, 화면 1 정답이 클리어까지 가는지 본다.
// #111 테스트는 가짜 배치를 썼다. 여기서는 걷기·발사로 바뀐 실제 몸 위치가 다음 행동의 배치가 된다.

const load = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const data: SceneData = {
  screen: load('content/screens/magpie_nest.json') as ScreenData,
  characters: load('content/characters.json') as CharactersData,
};

function idle(s: SceneState): void {
  for (let i = 0; i < 10_000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}

function replay(input: Input): { s: SceneState; results: string[] } {
  const s = createScene(data);
  idle(s); // 재생 도구는 busy가 거짓이 될 때까지 기다린다(설계 10절 4).
  const results: string[] = [];
  for (const action of data.screen.solution ?? []) {
    const layout: Layout = sceneLayout(data, s);
    const plan = planAction(data.screen, layout, action, input);
    expect(plan.warnings, JSON.stringify(action)).toEqual([]);
    // 재생 도구는 탭마다 busy가 끝나길 기다린다(replay.ts waitIdle). 정답 3번은 올라선 뒤 다시 누른다(6-4-7절 3).
    for (const t of plan.taps) {
      const r = sceneTap(data, s, t.at, input === 'touch' ? 8 : 0, input === 'touch');
      results.push(r.kind === 'intent' ? r.intent.kind : r.kind);
      idle(s);
    }
  }
  return { s, results };
}

describe('화면 1 정답: 훅 배치 → plan → 실제 sceneTap → 연출 재생', () => {
  for (const input of ['mouse', 'touch'] as const) {
    it(`${input}: 클리어하고, 무시된 탭이 없다`, () => {
      const { s, results } = replay(input);
      expect(s.cleared).toBe(true);
      expect(sceneLayout(data, s).cleared).toBe(true);
      expect(s.shownGauge).toBe(5);
      expect(results).not.toContain('ignored');
      expect(results.filter((k) => k === 'act')).toHaveLength(5); // 정답 4 + 3번 올라섬 1(6-4-7절)
    });
  }

  it('클리어 뒤 탭은 무시한다', () => {
    const { s } = replay('mouse');
    expect(sceneTap(data, s, { x: 240, y: 240 }, 0, false).kind).toBe('ignored');
  });
});
