// 클리어 규칙 연출 건너뛰기(#765, M2 플래닝 회의록 "확인한 것"). 이미 본 클리어는 정답 행동 0.4초 뒤 월드 탭 하나로 카드까지 간다.
// 완료 조건: 두 화면 정답 경로에서 끝까지 본 판과 건너뛴 판의 마지막 상태가 같다(끝 상태 어긋남, #452와 같은 종류를 막는다).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import magpieJson from '../../content/screens/magpie_nest.json';
import parkJson from '../../content/screens/park_fountain.json';
import jaJson from '../../content/text/ja.json';
import magpieArt from '../../public/scenes/magpie_nest-objects.json';
import parkArt from '../../public/scenes/park_fountain-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { inHudZone } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, isBusy, runAction, sceneTap, sceneTick, TIMING, type SceneData, type SceneState } from './scene';
import { parseSceneArt } from './sceneArt';
import { parseSpriteMeta } from './sprite';

const texts = jaJson as Record<string, string>;
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const SCREENS: [string, unknown, unknown][] = [
  ['magpie_nest', magpieJson, magpieArt],
  ['park_fountain', parkJson, parkArt],
];
/** 월드 한가운데(HUD·게이지 띠 밖). 무엇을 누르든 건너뛰기가 먼저다. */
const WORLD = { x: 240, y: 120 };
/** HUD 칸 줄 안의 점(왼쪽 아래). */
const HUD = { x: 4, y: 262 };

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

/** 정답의 마지막 행동 바로 앞까지 푼 판. 시작 연출도 끝까지 본다. */
function beforeLast(data: SceneData): { s: SceneState; last: NonNullable<ScreenData['solution']>[number] } {
  const s = createScene(data);
  settle(data, s);
  const sol = data.screen.solution!;
  for (const a of sol.slice(0, -1)) {
    runAction(data, s, a, null);
    settle(data, s);
  }
  expect(s.cleared).toBe(false);
  return { s, last: sol[sol.length - 1]! };
}

/** 판 복사. 쉬는 판(대기열·연출 없음)만 복사하니 JSON으로 충분하다(core는 DOM 타입이 없어 `structuredClone`을 못 쓴다). */
const clone = (s: SceneState): SceneState => JSON.parse(JSON.stringify(s)) as SceneState;

/** 시각(`tick`)과 건너뛰기 표시만 빼고 비교한다. 나머지(퍼즐·보이는 플래그·자리·마지막 장·기울기·본 대사)는 같아야 한다. */
function endState(s: SceneState): Record<string, unknown> {
  const o = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  delete o.tick;
  delete o.clearSeen;
  return o;
}

describe.each(SCREENS)('클리어 연출 건너뛰기 %s (#765)', (id, screen, art) => {
  const data = dataOf(id, screen, art);

  it('정답 경로: 끝까지 본 판과 건너뛴 판의 마지막 상태가 같다', () => {
    const { s, last } = beforeLast(data);
    const watched = clone(s);
    runAction(data, watched, last, null);
    const watchTicks = watched.tick;
    settle(data, watched);
    expect(watched.cleared).toBe(true);
    // 연출이 실제로 길어야 이 검사가 뜻이 있다(0.4초 잠금보다 길다).
    expect(watched.tick - watchTicks).toBeGreaterThan(TIMING.clearSkipAfter * 2);

    const skipped = clone(s);
    skipped.clearSeen = true;
    runAction(data, skipped, last, null);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(data, skipped);
    expect(isBusy(skipped)).toBe(true);
    expect(sceneTap(data, skipped, WORLD, 0, false)).toEqual({ kind: 'skipClear' });
    // 탭 하나로 카드 조건(`cleared && !busy`)이 선다.
    expect(skipped.cleared).toBe(true);
    expect(isBusy(skipped)).toBe(false);
    expect(endState(skipped)).toEqual(endState(watched));
    // 건너뛴 뒤 탭은 아무것도 하지 않는다(클리어 뒤 입력 없음).
    expect(sceneTap(data, skipped, WORLD, 0, false)).toEqual({ kind: 'ignored' });
  });

  it('터치도 같다', () => {
    const { s, last } = beforeLast(data);
    s.clearSeen = true;
    runAction(data, s, last, null);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(data, s);
    expect(sceneTap(data, s, WORLD, 8, true)).toEqual({ kind: 'skipClear' });
    expect(s.cleared && !isBusy(s)).toBe(true);
  });

  it('정답 행동 뒤 0.4초 안의 탭은 버린다(더블클릭·손가락 떨림으로 날리지 않게)', () => {
    const { s, last } = beforeLast(data);
    s.clearSeen = true;
    runAction(data, s, last, null);
    for (let i = 0; i < TIMING.clearSkipAfter - 1; i++) sceneTick(data, s);
    const before = endState(s);
    expect(sceneTap(data, s, WORLD, 0, false)).toEqual({ kind: 'ignored' });
    expect(endState(s)).toEqual(before);
    sceneTick(data, s);
    expect(sceneTap(data, s, WORLD, 0, false)).toEqual({ kind: 'skipClear' });
  });

  it('처음 보는 클리어는 건너뛰지 않는다(지금처럼 걷기·말풍선·컷 글만 넘김)', () => {
    const { s, last } = beforeLast(data);
    runAction(data, s, last, null);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(data, s);
    for (let i = 0; i < 20 && !s.cleared; i++) {
      expect(sceneTap(data, s, WORLD, 0, false).kind).not.toBe('skipClear');
      for (let k = 0; k < 6; k++) sceneTick(data, s);
    }
    expect(isBusy(s)).toBe(true);
  });

  it('HUD 영역 탭은 건너뛰지 않는다(예외 셋 그대로)', () => {
    expect(inHudZone(HUD)).toBe(true);
    expect(inHudZone(WORLD)).toBe(false);
    const { s, last } = beforeLast(data);
    s.clearSeen = true;
    runAction(data, s, last, null);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(data, s);
    expect(sceneTap(data, s, HUD, 0, false).kind).not.toBe('skipClear');
    expect(isBusy(s)).toBe(true);
  });

  it('클리어가 아닌 행동 중에는 본 적 있어도 건너뛰지 않는다', () => {
    const s = createScene(data);
    settle(data, s);
    s.clearSeen = true;
    runAction(data, s, data.screen.solution![0]!, null);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(data, s);
    expect(s.clearAt).toBeNull();
    expect(sceneTap(data, s, WORLD, 0, false).kind).not.toBe('skipClear');
  });
});
