import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Action, CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { createScene, currentBubble, currentCut, isBusy, sceneLayout, sceneTap, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { CASES_BY_SCREEN } from './cases/index';
import { planAction, type Input } from './plan';

// frames.ts 사례(#466 2부)를 Chrome 없이 실제 scene.ts에 넣어 본다. 여기서 실패하면 Chrome에서 찍기 전에
// 사례가 틀린 것(대상 이름 오타, pre 순서, 기대 대사)을 먼저 잡는다. 그림이 맞게 보이는지는 사람이 모음으로 본다.

const load = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const characters = load('content/characters.json') as CharactersData;
const SCREEN_FILES = readdirSync('content/screens').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

describe('화면 파일 이름 = 화면 JSON id (#473 리뷰)', () => {
  // main.ts `pickScreen`은 파일 이름으로, `screenTextKey`는 JSON id로 화면을 찾는다. 둘이 다르면 화면별 글이 조용히 안 바뀐다.
  for (const f of SCREEN_FILES) {
    it(`content/screens/${f}.json의 id는 ${f}다`, () => {
      expect((load(`content/screens/${f}.json`) as ScreenData).id).toBe(f);
    });
  }
});

/** 연출이 끝날 때까지 틱. 그 사이 뜬 말풍선·컷 대사 키를 모은다. */
function idle(data: SceneData, s: SceneState, said: string[]): void {
  for (let i = 0; i < 20_000 && isBusy(s); i++) {
    sceneTick(data, s);
    const b = currentBubble(s);
    if (b && said.at(-1) !== b.text) said.push(b.text);
    const c = currentCut(s);
    if (c && !said.includes(c)) said.push(c);
  }
  expect(isBusy(s)).toBe(false);
}

function act(data: SceneData, s: SceneState, a: Action, input: Input, label: string): string[] {
  const plan = planAction(data.screen, sceneLayout(data, s), a, input);
  expect(plan.warnings, label).toEqual([]);
  const said: string[] = [];
  for (const t of plan.taps) {
    const r = sceneTap(data, s, t.at, input === 'touch' ? 8 : 0, input === 'touch');
    expect(r.kind, `${label} / ${t.why}`).toBe('intent');
    idle(data, s, said);
  }
  return said;
}

describe('frames.ts 사례 (#466 2부)', () => {
  it('사례 파일이 있는 화면은 content/screens에 있다', () => {
    for (const id of Object.keys(CASES_BY_SCREEN)) expect(SCREEN_FILES).toContain(id);
  });

  for (const [screenId, cases] of Object.entries(CASES_BY_SCREEN)) {
    const data: SceneData = { screen: load(`content/screens/${screenId}.json`) as ScreenData, characters };

    it(`${screenId}: 사례 ID는 겹치지 않고 폴더 이름으로 쓸 수 있다`, () => {
      const ids = cases.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9_-]+$/);
    });

    for (const input of ['mouse', 'touch'] as const) {
      it(`${screenId} ${input}: pre·행동을 실제 탭으로 누를 수 있고, 기대 대사가 뜬다`, () => {
        for (const c of cases) {
          const s = createScene(data);
          idle(data, s, []);
          if (!c.action) continue;
          for (const a of c.pre ?? []) act(data, s, a, input, `${c.id} pre ${a.char} ${a.verb} ${a.target}`);
          const said = act(data, s, c.action, input, c.id);
          // scene.ts 말풍선 글은 대사 키 그대로다(글 파일은 엔진 쪽에서 바꾼다).
          if (c.says) expect(said, c.id).toContain(c.says);
        }
      });
    }
  }

  it('park_fountain: 0절 단서 표 줄(주 ①~③, 보조 ①~③)과 9절 진입·대기가 다 있다', () => {
    const ids = CASES_BY_SCREEN.park_fountain!.map((c) => c.id);
    for (const p of ['clue-main-1', 'clue-main-2', 'clue-main-3', 'clue-aux-1', 'clue-aux-2', 'clue-aux-3', 'enter', 'idle']) {
      expect(ids.some((id) => id.startsWith(p)), p).toBe(true);
    }
  });
});
