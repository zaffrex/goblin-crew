// 쭉이 손의 물건 그리기(ADR-1031 5절, 4/4 그리기 조각): `carry` 점, 손 표시 지연(`handsShown`), 제자리에서 빼기.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import type { CharactersData, ScreenData } from './puzzle/types';
import { carried, charPose, createScene, isBusy, runAction, sceneArtView, sceneTick, type SceneData, type SceneState } from './scene';
import { carriedPlace, parseSceneArt, sceneDraws, type SceneArtMeta } from './sceneArt';
import { parseSpriteMeta, spriteBox, spriteCarry, type Pose, type SpriteMeta } from './sprite';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const characters = charactersJson as CharactersData;
const art = parseSceneArt(sheetJson) as SceneArtMeta;
const BASKET_FRAME = 15;

/** 실제 쭉이 시트. `pickNull`이면 `common.pick` 0번 칸 `carry`를 뺀다(4/4 메타 조각에서 할 것, #1056 형식). */
function jjuk(pickNull = false): SpriteMeta {
  const m = clone(jjukJson) as unknown as { anims: Record<string, { carry?: unknown[] }> };
  if (pickNull) m.anims['common.pick']!.carry![0] = null;
  return parseSpriteMeta(m);
}

/** 화면 1에 바구니 집기·쓰기 규칙을 앞에 붙인다. 바구니는 장난감이라 다른 규칙과 안 겹친다. */
function pickScreen(show = true): ScreenData {
  const s = clone(screenJson) as unknown as ScreenData;
  s.flags = { ...s.flags, 'basket.used': false };
  s.hotspots.basket!.present = { flags: { 'basket.used': false } };
  s.rules.unshift(
    { id: 'pick_basket', target: 'basket', verb: 'stretch', do: { pick: true }, ...(show ? { show: [{ anim: ['jjuk', 'common.pick'] }] } : {}) },
    {
      id: 'use_basket', target: 'hook', verb: 'item', when: { item: 'basket' },
      do: { set: { 'basket.used': true }, take: ['basket'] }, show: [{ anim: ['jjuk', 'common.pick_high'] }],
    },
  );
  return s;
}

const pose = (over: Partial<Pose> = {}): Pose => ({ walkedPx: null, holding: false, event: null, clockMs: 0, ...over });

function settle(d: SceneData, s: SceneState): void {
  for (let n = 0; isBusy(s) && n < 5000; n++) sceneTick(d, s);
  expect(isBusy(s)).toBe(false);
}

const playing = (s: SceneState, name: string): boolean => s.current?.ev.type === 'anim' && s.current.ev.target === 'jjuk' && s.current.ev.name === name;

describe('spriteCarry (ADR-1031 5절)', () => {
  const meta = jjuk(true);

  it('서 있기: 칸 점을 화면으로, 왼쪽을 보면 tip과 같이 cell − x', () => {
    const [cx, cy] = meta.anims.idle!.carry![0]!;
    const right = spriteBox(meta, 100, 240, 1);
    const left = spriteBox(meta, 100, 240, -1);
    expect(spriteCarry(meta, pose(), 100, 240, 1)).toEqual({ x: right.left + cx, y: right.top + cy });
    expect(spriteCarry(meta, pose(), 100, 240, -1)).toEqual({ x: left.left + meta.cell[0] - cx, y: left.top + cy });
  });

  it('걷기: 걸은 거리로 고른 칸의 점(spriteFrame과 같은 칸)', () => {
    const walk = meta.anims.walk!;
    const step = meta.walkCycle / walk.frames.length;
    const [cx, cy] = walk.carry![2]!;
    const box = spriteBox(meta, 100, 240, 1);
    expect(spriteCarry(meta, pose({ walkedPx: step * 2 }), 100, 240, 1)).toEqual({ x: box.left + cx, y: box.top + cy });
  });

  it('집기 연출의 null 칸은 rest(물건이 아직 바닥), 다음 칸부터 점', () => {
    expect(spriteCarry(meta, pose({ event: { name: 'common.pick', ms: 0 } }), 100, 240, 1)).toBe('rest');
    expect(spriteCarry(meta, pose({ event: { name: 'common.pick', ms: 250 } }), 100, 240, 1)).not.toBe('rest');
  });

  it('carry 없는 연출·시트에 없는 연출은 서 있기 첫 칸 점, 서 있기 carry도 없으면 null', () => {
    const idle0 = spriteCarry(meta, pose(), 100, 240, 1);
    expect(spriteCarry(meta, pose({ event: { name: 'common.pick_high', ms: 0 } }), 100, 240, 1)).toEqual(idle0);
    expect(spriteCarry(meta, pose({ event: { name: 'no_such_anim', ms: 0 } }), 100, 240, 1)).toEqual(idle0);
    const bare = clone(meta);
    delete bare.anims.idle!.carry;
    delete bare.anims.walk!.carry;
    expect(spriteCarry(bare, pose({ event: { name: 'no_such_anim', ms: 0 } }), 100, 240, 1)).toBeNull();
  });
});

describe('carriedPlace', () => {
  it('그림 아래 가운데를 점에 맞춘다(폭/2 반올림), 뒤집지 않는다', () => {
    const [, , w, h] = art.frames[BASKET_FRAME]!.src;
    const p = carriedPlace(art, 'basket', () => ({}), { x: 120, y: 180 });
    expect(p).toEqual({ frame: BASKET_FRAME, x: Math.round(120 - w / 2), y: 180 - h });
  });

  it('시트에 없는 대상은 null', () => {
    expect(carriedPlace(art, 'no_such', () => ({}), { x: 0, y: 0 })).toBeNull();
  });
});

describe('손 표시 지연과 제자리 빼기 (handsShown)', () => {
  it('집기: 걸어가는 동안·null 칸은 제자리, carry 칸부터 손. 손에 있으면 제자리 그림이 빠진다', () => {
    const d: SceneData = { screen: pickScreen(), characters, art, sprites: { jjuk: jjuk(true) } };
    const s = createScene(d);
    settle(d, s);
    s.walkers.jjuk.x = 40; // 바구니(144~176)에서 떨어뜨려 걸어가게
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    expect(s.puzzle.hands).toBe('basket');
    expect(s.handsShown).toBeDefined();
    let walked = false;
    while (!playing(s, 'common.pick')) {
      if (s.current?.ev.type === 'walk') walked = true;
      expect(carried(d, s)).toBeNull();
      expect(sceneDraws(art, sceneArtView(d, s)).byObject['basket']).toContain(BASKET_FRAME);
      sceneTick(d, s);
    }
    expect(walked).toBe(true);
    // 0번 칸(null): 아직 바닥
    expect(carried(d, s)).toBeNull();
    while (playing(s, 'common.pick') && carried(d, s) === null) sceneTick(d, s);
    expect(playing(s, 'common.pick')).toBe(true);
    expect(carried(d, s)?.item).toBe('basket');
    expect(sceneDraws(art, sceneArtView(d, s)).byObject['basket']).toEqual([]);
    settle(d, s);
    expect(s.handsShown).toBeUndefined();
    const c = carried(d, s)!;
    expect(c.item).toBe('basket');
    expect(c.at).toEqual(spriteCarry(d.sprites!.jjuk!, charPose(d, s, 'jjuk'), s.walkers.jjuk.x, s.walkers.jjuk.y, s.walkers.jjuk.facing));
    expect(sceneDraws(art, sceneArtView(d, s)).byObject['basket']).toEqual([]);
  });

  it('쭉이 연출이 없는 집기 규칙은 바로 손으로 간다', () => {
    const d: SceneData = { screen: pickScreen(false), characters, art, sprites: { jjuk: jjuk(true) } };
    const s = createScene(d);
    settle(d, s);
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    expect(s.handsShown).toBeUndefined();
    expect(carried(d, s)?.item).toBe('basket');
  });

  it('재료로 쓰기(take): 쓰는 연출이 끝날 때까지 손에 있고, 끝나면 손에도 제자리에도 없다', () => {
    const d: SceneData = { screen: pickScreen(), characters, art, sprites: { jjuk: jjuk(true) } };
    const s = createScene(d);
    settle(d, s);
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    settle(d, s);
    runAction(d, s, { char: 'jjuk', verb: 'item', target: 'hook', item: 'basket' }, null);
    expect(s.puzzle.hands).toBeUndefined();
    expect(s.handsShown).toEqual({ hands: 'basket', seq: expect.any(Number) });
    while (!playing(s, 'common.pick_high')) {
      expect(carried(d, s)?.item).toBe('basket');
      sceneTick(d, s);
    }
    // carry 없는 연출: 서 있기 첫 칸 점에 그대로 든다
    expect(carried(d, s)?.at).not.toBeNull();
    settle(d, s);
    expect(carried(d, s)).toBeNull();
    expect(sceneDraws(art, sceneArtView(d, s)).byObject['basket']).toEqual([]);
  });

  it('시트 없는 쭉이(실루엣): 들고 있으면 제자리에서 빼고 손에도 안 그린다(at null)', () => {
    const d: SceneData = { screen: pickScreen(false), characters, art };
    const s = createScene(d);
    settle(d, s);
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    expect(carried(d, s)).toEqual({ item: 'basket', at: null });
    expect(sceneDraws(art, sceneArtView(d, s)).byObject['basket']).toEqual([]);
  });
});
