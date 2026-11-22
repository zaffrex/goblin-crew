import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import nestJson from '../../content/screens/magpie_nest.json';
import fountainJson from '../../content/screens/park_fountain.json';
import { bodies, createScene, currentBubble, isBusy, sceneTap, sceneTick, TIMING, type SceneData, type SceneState } from './scene';
import { hotspotBox } from './interact';
import { CHAR_SLOTS } from './hud';
import type { HitBox } from './hit';
import type { CharactersData, ScreenData } from './puzzle/types';
import type { Point } from './viewport';

// ui-interaction.md 5절 예외 넷 3 개정(#601 Mia park_fountain 회차): 마우스로 행동 뒤 마지막 말풍선이 떠 있을 때
// 호버 라벨이 보여 준 *다른* 행동을 클릭하면 닫기만 하지 않고 그대로 실행한다. 같은 행동·바닥·빈 곳은 지금처럼 닫기만 한다.

const characters = charactersJson as CharactersData;
const nest: SceneData = { screen: nestJson as unknown as ScreenData, characters };
const fountain: SceneData = { screen: fountainJson as unknown as ScreenData, characters };
const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MOUSE = 0;

function idle(data: SceneData, s: SceneState): void {
  for (let i = 0; i < 20_000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}
function untilSay(data: SceneData, s: SceneState, text?: string): void {
  for (let i = 0; i < 5000; i++) {
    const b = currentBubble(s);
    if (b && (text === undefined || b.text === text)) return;
    sceneTick(data, s);
  }
  throw new Error(`말풍선 ${text ?? ''}이 안 떴다`);
}
const ticks = (data: SceneData, s: SceneState, n: number): void => {
  for (let i = 0; i < n; i++) sceneTick(data, s);
};
const lastEvent = (s: SceneState): boolean => s.queue.length === 0 && s.overlays.length === 0 && Object.keys(s.hops).length === 0;
const at = (data: SceneData, s: SceneState, target: string): Point => center(hotspotBox(data.screen, s.puzzle, target)!);
const click = (data: SceneData, s: SceneState, p: Point) => sceneTap(data, s, p, MOUSE, false);

describe('마우스, 행동 뒤 마지막 말풍선 클릭 (예외 넷 3, #601)', () => {
  /** 쭉이로 둥지를 뻗어(높이 부족) 그 말풍선이 마지막 이벤트로 뜬 순간. */
  function nestSay(): SceneState {
    const s = createScene(nest);
    idle(nest, s);
    click(nest, s, at(nest, s, 'nest'));
    untilSay(nest, s, 'magpie_nest.nest_too_short');
    expect(lastEvent(s)).toBe(true);
    return s;
  }

  it('잠금 뒤 다른 물건 클릭: 말풍선을 닫고 그 행동을 바로 실행한다', () => {
    const s = nestSay();
    ticks(nest, s, TIMING.saySkipAfter);
    expect(click(nest, s, at(nest, s, 'magpie'))).toMatchObject({ kind: 'intent', intent: { kind: 'act', action: { char: 'jjuk', verb: 'stretch', target: 'magpie' } } });
    untilSay(nest, s);
    expect(currentBubble(s)?.text).toBe('magpie_nest.magpie_high_five');
  });

  it('잠금 뒤 같은 물건 클릭: 닫기만 한다(💥 칸 게이지를 두 번 잃지 않게)', () => {
    const s = nestSay();
    ticks(nest, s, TIMING.saySkipAfter);
    const puzzle = JSON.stringify(s.puzzle);
    expect(click(nest, s, at(nest, s, 'nest')).kind).toBe('skipSay');
    idle(nest, s);
    expect(JSON.stringify(s.puzzle)).toBe(puzzle);
  });

  it('잠금 뒤 바닥 클릭: 닫기만 하고 걷지 않는다(대사 넘기다 걸어가지 않게)', () => {
    const s = nestSay();
    ticks(nest, s, TIMING.saySkipAfter);
    expect(click(nest, s, { x: 300, y: 250 }).kind).toBe('skipSay');
    idle(nest, s);
    expect(s.walkers.jjuk.target).toBeNull();
  });

  it('잠금 뒤 화면 속 동료 몸 클릭: 닫고 전환한다', () => {
    const s = nestSay();
    ticks(nest, s, TIMING.saySkipAfter);
    expect(click(nest, s, center(bodies(nest, s).ppik))).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'ppik' } });
    expect(s.ui.active).toBe('ppik');
    expect(currentBubble(s)).toBeNull();
  });

  it('잠금 전 클릭은 지금처럼 버린다(말풍선 그대로)', () => {
    const s = nestSay();
    ticks(nest, s, 30);
    expect(click(nest, s, at(nest, s, 'magpie')).kind).toBe('ignored');
    expect(currentBubble(s)?.text).toBe('magpie_nest.nest_too_short');
  });

  it('연출 중간 말풍선(뒤에 이벤트가 남음)은 다른 물건 클릭도 닫기만 한다(예외 넷 4)', () => {
    const s = createScene(fountain);
    idle(fountain, s);
    click(fountain, s, center(CHAR_SLOTS.ppik));
    click(fountain, s, at(fountain, s, 'keeper'));
    untilSay(fountain, s, 'park_fountain.keeper_wake');
    expect(lastEvent(s)).toBe(false);
    ticks(fountain, s, TIMING.saySkipAfter);
    expect(click(fountain, s, at(fountain, s, 'alarm_clock')).kind).toBe('skipSay');
    idle(fountain, s);
    // 자명종 행동은 안 나갔다: 남은 연출(물 멈춤 → プピ 대사)만 끝났다.
    expect(s.puzzle.flags['fountain.off']).toBe(true);
  });

  it('park_fountain Mia 회차 재현: 물이 멈춘 대사 중 쭉이로 바꿔 재킷 클릭 → 바로 집는다', () => {
    const s = createScene(fountain);
    idle(fountain, s);
    click(fountain, s, center(CHAR_SLOTS.mukjik));
    click(fountain, s, at(fountain, s, 'fountain'));
    idle(fountain, s);
    expect(s.puzzle.flags['jacket.on_hand']).toBe(true);
    click(fountain, s, center(CHAR_SLOTS.ppik));
    click(fountain, s, at(fountain, s, 'keeper'));
    untilSay(fountain, s, 'park_fountain.fountain_off');
    expect(lastEvent(s)).toBe(true);
    // 얼굴 칸 전환은 말풍선 중에도 바로 된다(예외 셋). 말풍선은 그대로다.
    click(fountain, s, center(CHAR_SLOTS.jjuk));
    expect(s.ui.active).toBe('jjuk');
    expect(currentBubble(s)?.text).toBe('park_fountain.fountain_off');
    ticks(fountain, s, TIMING.saySkipAfter);
    // 전에는 이 클릭이 말풍선만 닫고 버려져서, 호버 라벨 「スーツの上着までのばす」만 남고 장대가 안 나갔다.
    expect(click(fountain, s, at(fountain, s, 'jacket'))).toMatchObject({ kind: 'intent', intent: { kind: 'act', action: { char: 'jjuk', verb: 'stretch', target: 'jacket' } } });
    expect(s.puzzle.flags['jacket.taken']).toBe(true);
  });
});
