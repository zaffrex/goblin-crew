// 내려놓은 물건의 놓인 자리(ADR-1031 4절, #1065): 상자·그림이 쭉이 발 점으로 가고, 다시 들거나 `present`가 꺼지면 지운다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import { frameNudges } from './fxShape';
import { hotspotBox, placedBox, resolveTap } from './interact';
import type { CharactersData, ScreenData } from './puzzle/types';
import { carried, createScene, isBusy, runAction, sceneArtView, sceneLayout, sceneTick, shownFlags, tapContext, type SceneData, type SceneState } from './scene';
import { carriedPlace, parseSceneArt, placedShifts, sceneDraws, type SceneArtMeta } from './sceneArt';
import { parseSpriteMeta, type SpriteMeta } from './sprite';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const characters = charactersJson as CharactersData;
const art = parseSceneArt(sheetJson) as SceneArtMeta;
const BASKET_FRAME = 15;
/** 바구니 기본 상자 [144, 212, 32, 24]. */
const BASKET = { left: 144, top: 212, width: 32, height: 24 };

/** 실제 쭉이 시트, `common.pick` 0번 칸 `carry` = null(#1056 형식). */
function jjuk(): SpriteMeta {
  const m = clone(jjukJson) as unknown as { anims: Record<string, { carry?: unknown[] }> };
  m.anims['common.pick']!.carry![0] = null;
  return parseSpriteMeta(m);
}

/** 화면 1에 바구니 집기·내려놓기·쓰기 규칙을 앞에 붙인다(carried.test.ts와 같은 모양 + `put`). */
function pickScreen(): ScreenData {
  const s = clone(screenJson) as unknown as ScreenData;
  s.flags = { ...s.flags, 'basket.used': false };
  s.hotspots.basket!.present = { flags: { 'basket.used': false } };
  s.rules.unshift(
    { id: 'pick_basket', target: 'basket', verb: 'stretch', do: { pick: true }, show: [{ anim: ['jjuk', 'common.pick'] }] },
    { id: 'put_basket', target: 'basket', verb: 'item', when: { item: 'basket' }, do: { put: true } },
    {
      id: 'use_basket', target: 'hook', verb: 'item', when: { item: 'basket' },
      do: { set: { 'basket.used': true }, take: ['basket'] }, show: [{ anim: ['jjuk', 'common.pick_high'] }],
    },
  );
  return s;
}

function settle(d: SceneData, s: SceneState): void {
  for (let n = 0; isBusy(s) && n < 5000; n++) sceneTick(d, s);
  expect(isBusy(s)).toBe(false);
}

function setup(): { d: SceneData; s: SceneState } {
  const d: SceneData = { screen: pickScreen(), characters, art, sprites: { jjuk: jjuk() } };
  const s = createScene(d);
  settle(d, s);
  return { d, s };
}

/** 바구니를 집고 쭉이를 x 300으로 옮겨 내려놓는다. */
function putAt300(d: SceneData, s: SceneState): void {
  runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
  settle(d, s);
  s.walkers.jjuk.x = 300;
  runAction(d, s, { char: 'jjuk', verb: 'item', target: 'basket', item: 'basket' }, null);
  expect(s.puzzle.hands).toBeUndefined();
}

describe('placedBox', () => {
  it('크기 그대로, 아래 가운데를 점에 (가로 반올림)', () => {
    expect(placedBox(BASKET, { x: 300, y: 244 })).toEqual({ left: 284, top: 220, width: 32, height: 24 });
    expect(placedBox({ ...BASKET, width: 31 }, { x: 300, y: 244 })).toEqual({ left: 285, top: 220, width: 31, height: 24 });
  });
});

describe('놓인 자리 (ADR-1031 4절)', () => {
  it('내려놓기: 쭉이 발 점이 놓인 자리, 상자·레이아웃·클릭이 다 그리로 간다', () => {
    const { d, s } = setup();
    expect(s.placed).toEqual({});
    putAt300(d, s);
    expect(s.placed).toEqual({ basket: { x: 300, y: s.walkers.jjuk.y } });
    const moved = placedBox(BASKET, { x: 300, y: s.walkers.jjuk.y });
    expect(hotspotBox(d.screen, s.puzzle, 'basket', s.placed)).toEqual(moved);
    expect(hotspotBox(d.screen, s.puzzle, 'basket')).toEqual(BASKET);
    settle(d, s);
    expect(sceneLayout(d, s).hotspots.basket).toEqual(moved);
    // 묵직이를 골라 놓인 바구니 왼쪽 끝을 누르면 바구니 행동이다. 옛 자리는 이제 빈 바닥이다.
    s.ui.active = 'mukjik';
    const ctx = tapContext(d, s);
    const hit = resolveTap(ctx, s.ui, { x: moved.left + 1, y: moved.top + moved.height - 2 }, 0);
    expect(hit.kind === 'act' ? hit.action.target : hit.kind).toBe('basket');
    const old = resolveTap(ctx, s.ui, { x: BASKET.left + 4, y: BASKET.top + BASKET.height - 2 }, 0);
    expect(old.kind === 'act' ? old.action.target : old.kind).not.toBe('basket');
  });

  it('그림: 멈춘 모습 칸이 놓인 점에 아래 가운데로 옮겨진다', () => {
    const { d, s } = setup();
    putAt300(d, s);
    settle(d, s);
    const flagsOf = (k: string) => shownFlags(s, k);
    const shifts = placedShifts(art, s.placed, flagsOf);
    const p = carriedPlace(art, 'basket', flagsOf, s.placed.basket!)!;
    const f = art.frames[BASKET_FRAME]!;
    expect(p.frame).toBe(BASKET_FRAME);
    expect(shifts.basket).toEqual({ dx: p.x - f.at[0], dy: p.y - f.at[1] });
    const draws = sceneDraws(art, sceneArtView(d, s));
    expect(draws.byObject['basket']).toContain(BASKET_FRAME);
    expect(frameNudges(art, draws, shifts).get(BASKET_FRAME)).toEqual(shifts.basket);
  });

  it('다시 집기: 걸어가는 곳은 놓인 자리, 연출 동안 지우지 않고 끝나면 지운다', () => {
    const { d, s } = setup();
    putAt300(d, s);
    settle(d, s);
    s.walkers.jjuk.x = 420;
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    expect(s.puzzle.hands).toBe('basket');
    // 바닥 대상: 놓인 상자(284~316) 오른쪽 옆으로 간다. 옛 자리(144~176)로 가면 안 된다.
    const to = s.walkers.jjuk.target?.x ?? s.floorTo.jjuk?.x;
    expect(to).toBeGreaterThan(316);
    expect(to).toBeLessThan(360);
    let ticks = 0;
    while (isBusy(s) && carried(d, s) === null) {
      expect(s.placed.basket).toBeDefined();
      sceneTick(d, s);
      ticks++;
    }
    expect(ticks).toBeGreaterThan(0);
    settle(d, s);
    expect(s.placed).toEqual({});
    expect(carried(d, s)?.item).toBe('basket');
  });

  it('재료로 쓰기(take) → present 꺼짐: 놓인 자리가 없다. 다시 나와도 기본 자리', () => {
    const { d, s } = setup();
    putAt300(d, s);
    settle(d, s);
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    settle(d, s);
    runAction(d, s, { char: 'jjuk', verb: 'item', target: 'hook', item: 'basket' }, null);
    settle(d, s);
    expect(s.placed).toEqual({});
    expect(hotspotBox(d.screen, s.puzzle, 'basket', s.placed)).toBeNull();
    s.puzzle.flags['basket.used'] = false;
    expect(hotspotBox(d.screen, s.puzzle, 'basket', s.placed)).toEqual(BASKET);
  });

  it('바닥에 놓인 채 present가 꺼지면 연출이 끝날 때 지운다', () => {
    const { d, s } = setup();
    putAt300(d, s);
    settle(d, s);
    s.puzzle.flags['basket.used'] = true;
    sceneTick(d, s);
    expect(s.placed).toEqual({});
  });

  it('제자리에서 집기만 하면 놓인 자리가 안 생긴다. 새 판은 비어 있다', () => {
    const { d, s } = setup();
    runAction(d, s, { char: 'jjuk', verb: 'stretch', target: 'basket' }, null);
    settle(d, s);
    expect(s.placed).toEqual({});
    putAt300(d, s);
    expect(Object.keys(s.placed)).toEqual(['basket']);
    expect(createScene(d).placed).toEqual({});
  });
});
