// 클리어 카드 동안 붙든 칸 남기기(#973). 빨래방 클리어의 끝 그림(ズッシー 머리 위 둥지 모자 + 그 위 까치)이
// 대기열이 비는 틱에 같이 지워져서, 데모에서 가장 오래 보는 정지 화면(카드 뒤)이 평범한 빨래방으로 돌아갔다.
// 클리어한 판은 카드가 닫히면 버려지니(다음 판 또는 맵), 대기열이 빈 뒤에도 마지막 장·붙든 물건 칸을 놓지 않는다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import laundromatJson from '../../content/screens/laundromat.json';
import magpieJson from '../../content/screens/magpie_nest.json';
import parkJson from '../../content/screens/park_fountain.json';
import jaJson from '../../content/text/ja.json';
import laundromatArt from '../../public/scenes/laundromat-objects.json';
import magpieArt from '../../public/scenes/magpie_nest-objects.json';
import parkArt from '../../public/scenes/park_fountain-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, isBusy, runAction, sceneArtView, sceneTick, type SceneData, type SceneState } from './scene';
import { parseSceneArt, sceneDraws } from './sceneArt';
import { parseSpriteMeta } from './sprite';

const texts = jaJson as Record<string, string>;
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };

function dataOf(id: string, screen: unknown, art: unknown): SceneData {
  return {
    screen: screen as ScreenData,
    characters: charactersJson as CharactersData,
    art: parseSceneArt(art),
    sprites,
    clearLine: `${id}.clear` in texts ? `${id}.clear` : undefined,
    texts,
  };
}

function settle(data: SceneData, s: SceneState): void {
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}

/** 정답을 끝까지 보고(건너뛰기 없음) 카드 조건(`cleared && !busy`)이 선 판. */
function solved(data: SceneData): SceneState {
  const s = createScene(data);
  settle(data, s);
  for (const a of data.screen.solution!) {
    runAction(data, s, a, null);
    settle(data, s);
  }
  expect(s.cleared).toBe(true);
  return s;
}

const heads = (data: SceneData, s: SceneState) => sceneDraws(data.art!, sceneArtView(data, s)).heads;

describe('클리어 카드 동안 붙든 칸 (#973)', () => {
  const data = dataOf('laundromat', laundromatJson, laundromatArt);

  it('laundromat: 카드가 뜬 뒤에도 둥지 모자와 그 위 까치를 ズッシー 머리 위에 그린다', () => {
    const s = solved(data);
    expect(Object.keys(s.heldArt).sort()).toEqual(['magpie', 'nest']);
    const h = heads(data, s);
    expect(h.map((x) => x.char)).toEqual(['mukjik', 'mukjik']);
    // 머리 위 칸만 남긴다. チュック 마지막 장(`common.reach_wobble`)은 지금처럼 놓는다.
    expect(s.held).toEqual({});
    // 카드는 탭할 때까지 떠 있다. 몇 초가 지나도(틱이 돌아도) 그대로다.
    const before = JSON.stringify(h);
    for (let i = 0; i < 600; i++) sceneTick(data, s);
    expect(JSON.stringify(heads(data, s))).toBe(before);
  });

  it('클리어 전 행동은 지금처럼 대기열이 비면 놓는다(결정 2026-11-24 머리 위 물건 그대로)', () => {
    const s = createScene(data);
    settle(data, s);
    const sol = data.screen.solution!;
    for (const a of sol.slice(0, -1)) {
      runAction(data, s, a, null);
      settle(data, s);
      expect(s.cleared).toBe(false);
      expect(s.heldArt).toEqual({});
      expect(s.held).toEqual({});
    }
  });

  // 완료 조건 "화면 1·2 클리어 카드 모양은 그대로": 둘 다 머리 위 칸이 없어서 카드 뒤에 붙든 칸이 0이다.
  // `park_fountain`은 손님·관리인 `hold`와 チュック `take_off` 마지막 장이 클리어 끝에 있는데, 이건 지금처럼 놓는다.
  it.each([
    ['magpie_nest', magpieJson, magpieArt],
    ['park_fountain', parkJson, parkArt],
  ])('%s: 카드 뒤에 남는 붙든 칸이 없다(예전과 같은 모습)', (id, screen, art) => {
    const s = solved(dataOf(id, screen, art));
    expect(s.heldArt).toEqual({});
    expect(s.held).toEqual({});
  });
});
