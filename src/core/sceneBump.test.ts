// 13번 `seesaw_launch_bump` 연출(#357): 납작한 채로 한마디, 바구니 안 두 사람은 좌우로 벌린다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import artJson from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { type CharacterId } from './characters';
import { parseSceneArt } from './sceneArt';
import { parseSpriteMeta, spriteFrame } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { charPose, createScene, currentBubble, isBusy, RELEASE_SPREAD, runAction, sceneTick, type SceneData, type SceneState } from './scene';

const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = {
  screen: screenJson as unknown as ScreenData,
  characters: charactersJson as CharactersData,
  art: parseSceneArt(artJson),
  sprites,
};
const frameOf = (s: SceneState, id: CharacterId): number | null => spriteFrame(sprites[id], charPose(data, s, id));
const hook = data.screen.spots.hook!;
const [rx, ry] = hook.releasePoint!;

function settle(s: SceneState): void {
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}

/** `hung`을 고리에 매달고 `flyer`를 시소 왼쪽 끝에 세운 뒤 묵직이가 오른쪽 끝을 쿵 한다(13번). 첫 말풍선이 뜬 틱에 멈춘다. */
function bumpUntilSay(flyer: CharacterId, hung: CharacterId): SceneState {
  const s = createScene(data);
  settle(s);
  s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, [hung]: 'hook' } };
  s.walkers[hung].x = hook.x;
  s.walkers[hung].y = hook.y;
  s.spotOf[hung] = 'hook';
  runAction(data, s, { char: flyer, verb: 'move', target: 'seesaw_left' }, null);
  settle(s);
  expect(s.puzzle.at[flyer]).toBe('seesaw_left');
  runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
  for (let i = 0; i < 5000 && currentBubble(s) === null; i++) sceneTick(data, s);
  expect(currentBubble(s)).not.toBeNull();
  return s;
}

describe('시트 `common.flatten_stay` (#357 1번)', () => {
  it('새 칸 없이 `common.flatten` 0·1번(꽝 → 납작)만 같은 박자로 잇는다', () => {
    for (const id of ['jjuk', 'ppik'] as const) {
      const f = sprites[id].anims['common.flatten']!;
      expect(sprites[id].anims['common.flatten_stay'], id).toMatchObject({ frames: f.frames.slice(0, 2), ms: [100, 600] });
    }
  });
});

describe('13번 부딪힘 연출 (#357)', () => {
  for (const [flyer, hung] of [['ppik', 'jjuk'], ['jjuk', 'ppik']] as const) {
    it(`${flyer}→${hung}: 말풍선이 떠 있는 내내 두 사람 다 납작 칸이고, 끝나면 놓는다`, () => {
      const s = bumpUntilSay(flyer, hung);
      const flat = (id: CharacterId): number => sprites[id].anims['common.flatten']!.frames[1]!;
      let ticks = 0;
      while (currentBubble(s) !== null) {
        expect(frameOf(s, flyer), `tick ${ticks}`).toBe(flat(flyer));
        expect(frameOf(s, hung), `tick ${ticks}`).toBe(flat(hung));
        sceneTick(data, s);
        ticks++;
      }
      expect(ticks).toBeGreaterThan(60);
      settle(s);
      // 대기열이 비면 붙든 장을 놓는다(형식 기록 5절): 둘 다 서 있기로 돌아온다.
      expect(s.held).toEqual({});
      expect(frameOf(s, flyer)).not.toBe(flat(flyer));
      expect(frameOf(s, hung)).not.toBe(flat(hung));
    });

    it(`${flyer}→${hung}: 바구니에서 먼저 떨어진 사람은 왼쪽, 나중(고리)은 오른쪽으로 ${RELEASE_SPREAD}px씩 벌린다`, () => {
      const s = bumpUntilSay(flyer, hung);
      expect([s.walkers[flyer].x, s.walkers[flyer].y]).toEqual([rx - RELEASE_SPREAD, ry]);
      expect([s.walkers[hung].x, s.walkers[hung].y]).toEqual([rx + RELEASE_SPREAD, ry]);
      // 두 발 모두 바구니(히트 상자 x) 안이다.
      const [bx, , bw] = data.screen.hotspots.basket!.box!;
      for (const id of [flyer, hung]) expect(s.walkers[id].x).toBeGreaterThan(bx);
      for (const id of [flyer, hung]) expect(s.walkers[id].x).toBeLessThan(bx + bw);
    });
  }

  it('바구니에 이미 벌려 선 두 사람이 있으면 셋째는 가운데에 떨어진다(벌린 자리는 그대로)', () => {
    const s = bumpUntilSay('ppik', 'jjuk');
    settle(s);
    s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, mukjik: 'hook' } };
    s.walkers.mukjik.x = hook.x;
    s.walkers.mukjik.y = hook.y;
    s.walkers.mukjik.target = null;
    s.queue.push({ type: 'release', char: 'mukjik', from: 'hook', to: 'floor' });
    settle(s);
    expect([s.walkers.mukjik.x, s.walkers.ppik.x, s.walkers.jjuk.x]).toEqual([rx, rx - RELEASE_SPREAD, rx + RELEASE_SPREAD]);
  });
});
