// 자리 비켜 주기(#968): 대상 앞 자동 걷기 설 곳이 가만히 서 있는 동료 몸과 겹치면 그 동료가 비켜 선다.
// 화면 3: ズッシー × 3번 건조기 설 곳(몸 x 303~342)이 プピ 시작 자리(x 301~334)를 덮어 プピ가 화면에서 사라졌다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import laundromatJson from '../../content/screens/laundromat.json';
import type { CharacterId } from './characters';
import type { HitBox } from './hit';
import type { Action, CharactersData, ScreenData } from './puzzle/types';
import { bodies, createScene, isBusy, runAction, sceneTick, takeWalkStart, type SceneData, type SceneState } from './scene';

const data: SceneData = { screen: laundromatJson as unknown as ScreenData, characters: charactersJson as CharactersData };

const STOMP: Action = { char: 'mukjik', verb: 'stomp', target: 'dryer_3' };
const SQUEAK: Action = { char: 'ppik', verb: 'squeak', target: 'gap' };
const POKE: Action = { char: 'jjuk', verb: 'stretch', target: 'duct' };

function settle(s: SceneState): void {
  for (let i = 0; i < 20000 && (isBusy(s) || Object.values(s.walkers).some((w) => w.target)); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}

function ready(): SceneState {
  const s = createScene(data);
  settle(s);
  takeWalkStart(s);
  return s;
}

const overlap = (a: HitBox, b: HitBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

function overlaps(s: SceneState): string[] {
  const b = bodies(data, s);
  const ids = Object.keys(b) as CharacterId[];
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (overlap(b[ids[i]!], b[ids[j]!])) out.push(`${ids[i]}/${ids[j]}`);
  return out;
}

function play(s: SceneState, actions: readonly Action[]): void {
  for (const a of actions) {
    runAction(data, s, a, null);
    settle(s);
  }
}

const dryer3 = (): HitBox => {
  const [left, top, width, height] = data.screen.hotspots.dryer_3!.box as [number, number, number, number];
  return { left, top, width, height };
};

describe('자리 비켜 주기 (#968, laundromat)', () => {
  it('처음 배치에서 プピ와 ズッシー 설 곳이 겹친다(이 검사가 지키는 상황)', () => {
    const s = ready();
    expect(overlaps(s)).toEqual([]);
    const ppikX = s.walkers.ppik.x;
    runAction(data, s, STOMP, null);
    // 탭한 틱에 プピ가 비켜 서기 시작한다. ズッシー 걷기와 나란히 간다.
    expect(s.walkers.ppik.target).not.toBeNull();
    expect(s.walkers.ppik.target!.x).not.toBe(ppikX);
    expect(s.walkers.ppik.target!.y).toBe(s.walkers.ppik.y);
  });

  it('쿵 → プピッ → 쿡: ★① 뒤·클리어 뒤 아무도 안 겹치고 プピ는 ズッシー 쪽을 본다', () => {
    const s = ready();
    play(s, [STOMP]);
    expect(overlaps(s)).toEqual([]);
    expect(s.walkers.ppik.x).toBeLessThan(s.walkers.mukjik.x);
    expect(s.walkers.ppik.facing).toBe(1);
    expect(overlap(bodies(data, s).ppik, dryer3())).toBe(false);
    expect(s.puzzle.at.ppik).toBe('floor');
    play(s, [SQUEAK, POKE]);
    expect(s.cleared).toBe(true);
    expect(overlaps(s)).toEqual([]);
  });

  it('プピッ → 쿵 → 쿡: 순서가 바뀌어도 같다', () => {
    const s = ready();
    play(s, [SQUEAK, STOMP]);
    expect(overlaps(s)).toEqual([]);
    expect(s.walkers.ppik.facing).toBe(1);
    play(s, [POKE]);
    expect(s.cleared).toBe(true);
    expect(overlaps(s)).toEqual([]);
  });

  it('걷는 중인 동료는 건드리지 않는다', () => {
    const s = ready();
    const ppik = s.walkers.ppik;
    ppik.target = { x: ppik.x + 1, y: ppik.y };
    runAction(data, s, STOMP, null);
    expect(ppik.target).toEqual({ x: ppik.x + 1, y: ppik.y });
  });
});
