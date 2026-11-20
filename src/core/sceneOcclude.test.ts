// 높은 대상 앞에 서면 몸이 대상 그림을 가리지 않게 앞(아래)으로 내려서기 (#575, PR #571 리뷰).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import nestScreen from '../../content/screens/magpie_nest.json';
import parkScreen from '../../content/screens/park_fountain.json';
import nestArt from '../../public/scenes/magpie_nest-objects.json';
import parkArt from '../../public/scenes/park_fountain-objects.json';
import { CHARACTERS, characterDef, characterHitBox, type CharacterId } from './characters';
import { WALK_AREA } from './config';
import type { HitBox } from './hit';
import { parseSceneArt, restingBox } from './sceneArt';
import type { CharactersData, ScreenData, Verb } from './puzzle/types';
import { approachPoint, createScene, isBusy, runAction, sceneTick, type SceneData, type SceneState } from './scene';
import type { Facing } from './walk';

const characters = charactersJson as CharactersData;
const nest: SceneData = { screen: nestScreen as unknown as ScreenData, characters, art: parseSceneArt(nestArt) };
const park: SceneData = { screen: parkScreen as unknown as ScreenData, characters, art: parseSceneArt(parkArt) };
const CHARS = CHARACTERS.map((c) => c.id);
const VERBS: Verb[] = ['stretch', 'stomp', 'hand'];
const FEET = [200, 205, 220, 237, 244, 252];

/** 대상 그림 넓이 중 몸 상자에 덮인 비율. 엔진 `hiddenShare`와 따로 센다. */
function hidden(art: HitBox, body: HitBox): number {
  let n = 0;
  for (let y = art.top; y < art.top + art.height; y++)
    for (let x = art.left; x < art.left + art.width; x++)
      if (x >= body.left && x < body.left + body.width && y >= body.top && y < body.top + body.height) n++;
  return n / (art.width * art.height);
}

/** 상자 아래 끝이 걷기 영역 위인 대상(5-1절 "높은 대상"). */
function highTargets(d: SceneData): string[] {
  return Object.entries(d.screen.hotspots)
    .filter(([, h]) => h.box && h.box[1] + h.box[3] <= WALK_AREA.top)
    .map(([id]) => id);
}

function settle(d: SceneData, s: SceneState): void {
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(d, s);
  expect(isBusy(s)).toBe(false);
}

describe('높은 대상 앞 내려서기 (#575)', () => {
  it('두 화면 높은 대상 전부: 어느 발 y에서 와도 선 자리에서 몸이 대상 그림을 반 넘게 가리지 않는다', () => {
    for (const d of [nest, park]) {
      const s = createScene(d);
      for (const target of highTargets(d)) {
        const art = restingBox(d.art!, target, s.puzzle.flags);
        if (!art) continue;
        for (const char of CHARS)
          for (const verb of VERBS)
            for (const fromY of FEET) {
              const ap = approachPoint(d, s.puzzle, { char, verb, target }, { x: 400, y: fromY });
              if (!ap) continue;
              const faces: Facing[] = ap.face === null ? [1, -1] : [ap.face];
              for (const f of faces) {
                const share = hidden(art, characterHitBox(characterDef(char), ap.x, ap.y, f));
                expect(share, `${d.screen.id} ${target} ${char} ${verb} 발 y ${fromY} → (${ap.x}, ${ap.y})`).toBeLessThanOrEqual(0.5);
              }
            }
      }
    }
  });

  it('화면 1은 그대로다: 높은 대상 앞 발 y는 언제나 지금 y (long_johns는 위쪽 바닥에서 약 3할만 가린다)', () => {
    const s = createScene(nest);
    for (const target of highTargets(nest))
      for (const char of CHARS)
        for (const verb of VERBS)
          for (let fromY = WALK_AREA.top; fromY <= WALK_AREA.bottom; fromY++) {
            const ap = approachPoint(nest, s.puzzle, { char, verb, target }, { x: 400, y: fromY });
            if (ap) expect(ap.y, `${target} ${char} ${verb} ${fromY}`).toBe(fromY);
          }
  });

  it('오리: 위쪽 바닥(발 y 205)에서 누르면 x는 그대로 상자 가운데 187, 몸 위 끝이 그림 아래 끝(외곽선 포함 177)에 닿게 내려선다', () => {
    const s = createScene(park);
    const art = restingBox(park.art!, 'duck', s.puzzle.flags)!;
    expect(art.top + art.height).toBe(177);
    const at = (char: CharacterId, verb: Verb, y: number) => approachPoint(park, s.puzzle, { char, verb, target: 'duck' }, { x: 400, y });
    expect(at('jjuk', 'stretch', 205)).toEqual({ x: 187, y: 177 + 64, face: null });
    expect(at('mukjik', 'stomp', 205)).toEqual({ x: 187, y: 177 + 61, face: null });
    // 이미 충분히 아래면 위로 올라가지 않는다(시작 자리 244, 캡처 사례 `toy-duck-*`는 그대로).
    expect(at('jjuk', 'stretch', 244)?.y).toBe(244);
    expect(at('mukjik', 'stomp', 244)?.y).toBe(244);
  });

  it('reachPoint 대상(관리인·자명종)의 stretch 서는 곳은 시작 자리에서 그대로다', () => {
    const s = createScene(park);
    for (const [target, x] of [['keeper', 73], ['alarm_clock', 107]] as const) {
      const ap = approachPoint(park, s.puzzle, { char: 'jjuk', verb: 'stretch', target }, { x: 400, y: 244 });
      expect(ap?.x).toBe(x);
      expect(ap?.y).toBe(244);
    }
  });

  it('장면: 묵직이가 위쪽 바닥(400, 205)에서 오리를 쿵 → (187, 238)까지 걸어가서 행동한다', () => {
    const s = createScene(park);
    settle(park, s);
    Object.assign(s.walkers.mukjik, { x: 400, y: 205 });
    runAction(park, s, { char: 'mukjik', verb: 'stomp', target: 'duck' }, null);
    expect(s.queue[0]).toMatchObject({ type: 'walk', char: 'mukjik' });
    settle(park, s);
    expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([187, 238]);
  });
});
