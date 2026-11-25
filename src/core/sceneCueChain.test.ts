// 칸 신호로 겹쳐 뜬 물건 anim 뒤에 같은 물건 anim이 이어지면 겹친 채 이어 시작한다(#955).
// 빨래방 클리어 `duct_unstick`: 장대가 닿는 칸에 둥지가 빨려 들고(`nest_sucked`), 그 끝 틱에 까치가 후드에 내려앉는다(`perch_drop`).
// 전에는 `perch_drop`이 `reach_wobble` 끝까지 기다려서, 둥지 없는 자리 위에 까치가 0.72초(43틱) 떠 있었다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/laundromat.json';
import artJson from '../../public/scenes/laundromat-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, cuedArtView, isBusy, sceneTick, type PlayEvent, type SceneData, type SceneState } from './scene';
import { parseSceneArt } from './sceneArt';
import { parseSpriteMeta } from './sprite';

const art = parseSceneArt(artJson);
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData, art, sprites };
const WOBBLE = 'common.reach_wobble';

function ready(): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 3000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
  return s;
}

/** 클리어 show 앞 다섯 줄(`content/screens/laundromat.json` `duct_unstick`). */
const CLEAR_HEAD: PlayEvent[] = [
  { type: 'anim', target: 'jjuk', name: WOBBLE },
  { type: 'fx', effect: 'stretch_text', target: 'jjuk' },
  { type: 'anim', target: 'magpie', name: 'nest_sucked' },
  { type: 'anim', target: 'magpie', name: 'perch_drop' },
  { type: 'anim', target: 'duct', name: 'lump_pop' },
];

const wobbling = (s: SceneState): boolean => s.current?.ev.type === 'anim' && s.current.ev.target === 'jjuk' && s.current.ev.name === WOBBLE;
const cuedName = (s: SceneState, key: string): string | undefined => {
  const o = s.overlays.find((x) => x.ev.type === 'anim' && x.ev.target === key);
  return o?.ev.type === 'anim' ? o.ev.name : undefined;
};

describe('겹친 물건 anim 이어 붙이기 (#955, scene.ts tickOverlays)', () => {
  it('빨래방 클리어: nest_sucked가 끝나는 틱에 perch_drop이 겹쳐 시작한다(까치가 공중에 안 뜸)', () => {
    const s = ready();
    s.queue.push(...CLEAR_HEAD.map((e) => ({ ...e })));
    let sucked = -1;
    let dropped = -1;
    let lastSucked = -1;
    for (let i = 0; i < 600 && (dropped < 0 || sucked < 0); i++) {
      sceneTick(data, s);
      const name = cuedName(s, 'magpie');
      if (name === 'nest_sucked') {
        if (sucked < 0) sucked = s.tick;
        lastSucked = s.tick;
      }
      if (name === 'perch_drop' && dropped < 0) dropped = s.tick;
    }
    expect(sucked, 'nest_sucked가 칸 신호로 겹쳐 떠야 한다').toBeGreaterThan(0);
    // 빈 틱 0: 마지막 nest_sucked 틱 바로 다음 틱이 perch_drop 첫 틱(t=0)이다.
    expect(dropped - lastSucked).toBe(1);
    expect(wobbling(s), 'perch_drop은 장대 연출이 도는 동안 시작한다').toBe(true);
    expect(cuedArtView(s)).toMatchObject({ magpie: { ms: 0 } });
  });

  it('다른 물건 anim(덕트 lump_pop)은 이어 붙이지 않고 장대 연출 끝을 기다린다', () => {
    const s = ready();
    s.queue.push(...CLEAR_HEAD.map((e) => ({ ...e })));
    for (let i = 0; i < 600 && cuedName(s, 'magpie') !== 'perch_drop'; i++) sceneTick(data, s);
    for (let i = 0; i < 600 && s.overlays.some((o) => o.ev.type === 'anim'); i++) {
      expect(s.queue.map((e) => (e.type === 'anim' ? e.target : e.type))).toEqual(['duct']);
      sceneTick(data, s);
    }
    // perch_drop이 끝나도 장대는 아직 흔들리고, lump_pop은 대기열에 남는다.
    expect(wobbling(s)).toBe(true);
    expect(s.queue).toHaveLength(1);
    for (let i = 0; i < 600 && wobbling(s); i++) sceneTick(data, s);
    expect(s.current?.ev.type === 'anim' && s.current.ev.target).toBe('duct');
  });

  it('캐릭터 연출이 이미 끝났으면 이어 붙이지 않는다(대기열 차례 그대로)', () => {
    const s = ready();
    // 칸 신호 없이 물건 anim 둘: 차례대로 `current`로 돈다. overlays는 끝까지 비어 있다.
    s.queue.push({ type: 'anim', target: 'magpie', name: 'nest_sucked' }, { type: 'anim', target: 'magpie', name: 'perch_drop' });
    for (let i = 0; i < 600 && isBusy(s); i++) {
      sceneTick(data, s);
      expect(s.overlays).toEqual([]);
    }
  });
});
