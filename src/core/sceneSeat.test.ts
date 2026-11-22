// 바닥 앞 고정 점에서 떠나기·얼굴 상자 (#517, 화면 2 `fountain_seat`, `docs/design/screens/park_fountain.md` 12절 ③).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/park_fountain.json';
import artJson from '../../public/scenes/park_fountain-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { resolveTap, type UiState } from './interact';
import { parseSceneArt } from './sceneArt';
import { parseSpriteMeta } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, isBusy, runAction, sceneTick, tapContext, type SceneData, type SceneState } from './scene';

// PR #517 데이터(자리 + 쿵 approach). 그 PR이 먼저 머지돼도 같은 값이라 그대로 덮어쓴다.
const screen = JSON.parse(JSON.stringify(screenJson)) as ScreenData;
screen.spots.fountain_seat = { x: 220, y: 200, capacity: 3 };
screen.hotspots.fountain!.approach = { default: 'floor', stomp: 'fountain_seat' };

const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = { screen, characters: charactersJson as CharactersData, art: parseSceneArt(artJson), sprites };

function settle(s: SceneState): void {
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}
/** 묵직이를 테두리 앞 자리에 앉힌 장면(주 아하, `jacket.on_hand`가 켜진다). */
function seated(): SceneState {
  const s = createScene(data);
  settle(s);
  runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'fountain' }, null);
  settle(s);
  expect(s.puzzle.at.mukjik).toBe('fountain_seat');
  expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([220, 200]);
  return s;
}
/** 묵직이 `common.stomp`이 시작될 때의 발 위치·방향. */
function stompAt(s: SceneState): [number, number, number] {
  for (let i = 0; i < 5000; i++) {
    sceneTick(data, s);
    const ev = s.current?.ev;
    if (ev?.type === 'anim' && ev.target === 'mukjik' && ev.name === 'common.stomp') break;
  }
  const w = s.walkers.mukjik;
  return [w.x, w.y, w.facing];
}

describe('fountain_seat에서 바닥 대상으로 떠나기 (#517)', () => {
  it('앉은 뒤 재킷(손 위, 249..273) 쿵: 바닥 y로 내려가며 상자 가운데 x 261까지 걷는다', () => {
    const s = seated();
    expect(s.puzzle.flags['jacket.on_hand']).toBe(true);
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'jacket' }, null);
    expect(stompAt(s).slice(0, 2)).toEqual([261, 244]);
  });

  it('앉은 뒤 손님 쿵: 바닥에서 했을 때와 같은 설 곳(419, 244)·방향(오른쪽)', () => {
    const ref = createScene(data);
    settle(ref);
    runAction(data, ref, { char: 'mukjik', verb: 'stomp', target: 'guest' }, null);
    const want = stompAt(ref);
    const s = seated();
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'guest' }, null);
    expect(stompAt(s)).toEqual(want);
    expect(want).toEqual([419, 244, 1]);
  });

  it('바닥 클릭(move floor)은 누른 점으로 간다(그대로)', () => {
    const s = seated();
    runAction(data, s, { char: 'mukjik', verb: 'move', target: 'floor' }, { x: 300, y: 230 });
    settle(s);
    expect([s.puzzle.at.mukjik, s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual(['floor', 300, 230]);
  });
});

// 시트 알파가 없을 때(엔진이 아직 못 읽음)의 판정이다. 알파가 있을 때는 그려진 칸 6점이 ズッシー 전환이다(2-1-4절, tests/art/drawn-body.test.ts).
describe('fountain_seat에 앉은 동료: 시트 알파가 없으면 얼굴 상자만 전환 대상 (2-1절 #427 → #736, #517)', () => {
  const ui = (active: 'ppik' | 'jjuk'): UiState => ({ active }) as UiState;

  it('테두리 앞면(y 184~200)을 누르면 묵직이 전환이 아니라 테두리 대상이다', () => {
    const s = seated();
    const ctx = tapContext(data, s);
    for (const x of [210, 220, 230, 240]) {
      for (const y of [184, 192, 200]) {
        const r = resolveTap(ctx, ui('ppik'), { x, y }, 0);
        expect(r.kind, `${x},${y}`).toBe('act');
        expect(r.kind === 'act' && r.action.target, `${x},${y}`).toBe('fountain');
      }
    }
  });

  it('얼굴을 누르면 여전히 묵직이로 전환된다', () => {
    const s = seated();
    const ctx = tapContext(data, s);
    const f = ctx.faces.mukjik;
    const r = resolveTap(ctx, ui('jjuk'), { x: f.left + f.width / 2, y: f.top + f.height / 2 }, 0);
    expect(r).toMatchObject({ kind: 'switch', char: 'mukjik' });
  });
});
