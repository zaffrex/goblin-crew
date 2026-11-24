// `ビヨーン`(stretch_text)이 뜨는 동안 장대가 실제로 펴지는지 본다 (#587).
// `ability-feedback.md` 2절: 장대 늘어남이 몸 쪽 신호이고 글자는 보조다. 몸이 안 하는 일을 글자가 말하면 안 된다.
// 도달 가능한 상태 × 쭉이 행동 중 `stretch_text`를 내는 것을 (대상, 규칙/폴백)마다 하나씩 골라, 시작부터 그 상태까지
// 가장 짧은 길을 진짜 장면(`runAction` + `sceneTick`)으로 걷고 그 행동을 돌린다. 글자가 떠 있는 틱마다 `spritePole` 길이를 잰다.
// - `NO_POLE`은 지금 장대가 0px인 줄이다(#587 결정: 높은 대상 2곳은 C2 `reach_wobble`, 나머지는 안 A로 글자를 뺀다).
//   그 PR이 줄을 고치면 여기서 지워야 테스트가 통과한다. **`NO_POLE`이 비면 #587을 닫는다.**
// - 두 화면 모두 장부가 비었다(#587 닫음). 새 화면에서 0px 줄이 생기면 장부에 넣지 말고 그림·데이터를 고친다.

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateKey } from '../../src/core/puzzle/bfs';
import { screenHost } from '../../src/core/puzzle/check';
import { step } from '../../src/core/puzzle/step';
import type { Action, CharactersData, PuzzleState, ScreenData } from '../../src/core/puzzle/types';
import { activeFx, charFacing, charPose, createScene, isBusy, runAction, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { parseSceneArt } from '../../src/core/sceneArt';
import { parseSpriteMeta, spritePole } from '../../src/core/sprite';

const ROOT = join(import.meta.dirname, '..', '..');
const load = (...p: string[]): unknown => JSON.parse(readFileSync(join(ROOT, ...p), 'utf8'));
const characters = load('content', 'characters.json') as CharactersData;
const sprites = {
  jjuk: parseSpriteMeta(load('public', 'sprites', 'jjuk-base.json')),
  mukjik: parseSpriteMeta(load('public', 'sprites', 'mukjik-base.json')),
  ppik: parseSpriteMeta(load('public', 'sprites', 'ppik-base.json')),
};
const SCREENS = ['laundromat', 'magpie_nest', 'park_fountain'] as const;

/** 화면별 `대상 규칙/폴백` 중 글자 동안 장대가 0px인 줄. 정렬해 둔다. 줄을 지우는 건 #587 구현 PR 몫이다. */
const NO_POLE: Record<(typeof SCREENS)[number], string[]> = {
  // 화면 1: 까치·내복은 C2(`common.reach_wobble`)로 장대를 펴고, 시소 양 끝·바구니는 안 A로 글자를 뺐다(진마씨 재플레이 11/22 뒤). 남은 줄 없음.
  magpie_nest: [],
  // 화면 2: 분수·오리·손님은 안 A로 글자를 뺐다(바닥이거나 tip보다 낮음, 오리는 `reach_wobble`이어도 0px). 남은 줄 없음.
  park_fountain: [],
  // 스테이지 3 B(#909, 화면 JSON만): 높은 대상 덕트·까치는 `reach_wobble`로 펴지고, 바닥 틈·셔터는 안 A로 글자를 뺐다. 남은 줄 없음.
  laundromat: [],
};

function sceneData(id: string): SceneData {
  return {
    screen: load('content', 'screens', `${id}.json`) as ScreenData,
    characters,
    // 물건 그림이 아직 없는 화면(laundromat)은 회색 상자로 돈다. 장대 길이는 캐릭터 시트만 본다.
    art: existsSync(join(ROOT, 'public', 'scenes', `${id}-objects.json`)) ? parseSceneArt(load('public', 'scenes', `${id}-objects.json`)) : undefined,
    sprites,
  };
}

interface Case {
  key: string;
  path: Action[];
  action: Action;
}

const hasStretchText = (events: { type: string; effect?: string }[]): boolean => events.some((e) => e.type === 'fx' && e.effect === 'stretch_text');

/** 넓이 우선으로 가장 짧은 길을 기억하며, `stretch_text`를 내는 행동을 (대상, 출처)마다 처음 만난 것 하나씩 모은다. */
function stretchCases(screen: ScreenData): Case[] {
  const host = screenHost(screen, characters);
  const pathOf = new Map<string, Action[]>([[stateKey(host.initial), []]]);
  const queue: PuzzleState[] = [host.initial];
  const out = new Map<string, Case>();
  while (queue.length) {
    const s = queue.shift()!;
    if (host.isClear(s)) continue;
    const path = pathOf.get(stateKey(s))!;
    for (const a of host.actions(s)) {
      const r = step(screen, s, a, characters);
      if (r.source === 'invalid') continue;
      if (hasStretchText(r.events)) {
        const key = `${a.target} ${r.source === 'rule' ? r.ruleId : r.source}`;
        if (!out.has(key)) out.set(key, { key, path, action: a });
      }
      const k = stateKey(r.state);
      if (!pathOf.has(k)) {
        pathOf.set(k, [...path, a]);
        queue.push(r.state);
      }
    }
  }
  return [...out.values()].sort((x, y) => (x.key < y.key ? -1 : 1));
}

function settle(data: SceneData, s: SceneState): void {
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s), '장면이 끝나지 않는다').toBe(false);
}

/** 그 행동을 돌리는 동안 `stretch_text`가 떠 있던 틱 수와, 그 틱들에서 쭉이 장대 길이의 최댓값(px, 없으면 0). */
function measure(data: SceneData, c: Case): { textTicks: number; maxPole: number } {
  const s = createScene(data);
  settle(data, s);
  for (const a of c.path) {
    runAction(data, s, a, null);
    settle(data, s);
  }
  runAction(data, s, c.action, null);
  let textTicks = 0;
  let maxPole = 0;
  for (let i = 0; i < 5000 && isBusy(s); i++) {
    sceneTick(data, s);
    if (!activeFx(s).some((f) => f.effect === 'stretch_text')) continue;
    textTicks++;
    const w = s.walkers.jjuk;
    const pole = spritePole(sprites.jjuk, charPose(data, s, 'jjuk'), w.x, w.y, charFacing(data, s, 'jjuk'));
    if (pole) maxPole = Math.max(maxPole, pole.bottom - pole.top);
  }
  return { textTicks, maxPole };
}

describe('ビヨーン 동안 장대가 펴진다 (#587, ability-feedback.md 2절)', () => {
  it('화면 목록이 content/screens와 같다(새 화면은 SCREENS·NO_POLE에 넣는다)', () => {
    const files = readdirSync(join(ROOT, 'content', 'screens')).filter((f) => f.endsWith('.json') && f !== 'order.json').map((f) => f.replace(/\.json$/, ''));
    expect([...SCREENS].sort()).toEqual(files.sort());
  });
  for (const id of SCREENS) {
    it(`${id}: 장대 0px 줄이 NO_POLE 장부와 같다`, () => {
      const data = sceneData(id);
      const cases = stretchCases(data.screen);
      expect(cases.length, '쭉이 stretch_text 행동이 하나도 없다').toBeGreaterThan(0);
      const rows = cases.map((c) => ({ key: c.key, ...measure(data, c) }));
      console.info(`[stretch-pole] ${id}\n` + rows.map((r) => `  ${r.key}: 글자 ${r.textTicks}틱, 장대 최대 ${r.maxPole}px`).join('\n'));
      for (const r of rows) expect(r.textTicks, `${r.key}: 글자가 안 떴다`).toBeGreaterThan(0);
      const zero = rows.filter((r) => r.maxPole < 1).map((r) => r.key).sort();
      expect(zero, '글자만 뜨고 장대가 안 펴진 줄(#587). 고쳤으면 NO_POLE에서 지우고, 새로 생겼으면 그림·데이터를 고친다').toEqual(NO_POLE[id]);
    });
  }
});
