// 바닥 걷기 도착점이 동료 몸과 겹치면 비켜 선다(#825, Mia `park_fountain` 5회차 d3-a·d4-c "즛시가 노비와 겹쳐 섬").
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import fountainJson from '../../content/screens/park_fountain.json';
import { characterDef, characterHitBox, type CharacterId } from './characters';
import { WALK_AREA } from './config';
import type { HitBox } from './hit';
import type { CharactersData, ScreenData } from './puzzle/types';
import { bodies, createScene, isBusy, sceneTap, sceneTick, standAside, takeWalkStart, type SceneData, type SceneState } from './scene';

const data: SceneData = { screen: fountainJson as unknown as ScreenData, characters: charactersJson as CharactersData };

function ready(): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
  takeWalkStart(s);
  return s;
}

/** 걷기를 끝까지 돌린다. */
function settle(s: SceneState): void {
  for (let i = 0; i < 5000 && (isBusy(s) || Object.values(s.walkers).some((w) => w.target)); i++) sceneTick(data, s);
}

function place(s: SceneState, id: CharacterId, x: number, y: number): void {
  Object.assign(s.walkers[id], { x, y, target: null, walkTicks: 0 });
}

const overlap = (a: HitBox, b: HitBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

function anyOverlap(s: SceneState): string[] {
  const b = bodies(data, s);
  const ids = Object.keys(b) as CharacterId[];
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (overlap(b[ids[i]!], b[ids[j]!])) out.push(`${ids[i]}/${ids[j]}`);
  return out;
}

describe('바닥 걷기 비켜 서기 (#825)', () => {
  it('Mia 5회차 재현: 노비(224,242) 옆 동상을 즛시로 누르면 몸이 안 겹치는 x에 선다', () => {
    const s = ready();
    place(s, 'jjuk', 224, 242);
    place(s, 'mukjik', 120, 230);
    place(s, 'ppik', 400, 230);
    s.ui = { active: 'mukjik', selected: null };
    // 동상(바닥 위). 클릭 대상이 아니라 걷기이고 y는 걷기 영역 위 끝으로 당겨진다.
    const r = sceneTap(data, s, { x: 226, y: 150 }, 0, false);
    expect(r).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    const t = s.walkers.mukjik.target!;
    expect(t.y).toBe(WALK_AREA.top);
    // 오른쪽으로 걸어가니 오른쪽을 본다. 노비 몸 왼쪽 끝 - 2px 틈에 몸 오른쪽 끝이 닿는 x.
    const jjuk = characterHitBox(characterDef('jjuk'), 224, 242, s.walkers.jjuk.facing);
    const m = characterDef('mukjik').hit;
    expect(t.x).toBe(Math.floor(jjuk.left - 2 - m.width - m.dx));
    settle(s);
    expect(anyOverlap(s)).toEqual([]);
  });

  it('안 겹치면 누른 점 그대로', () => {
    const s = ready();
    place(s, 'jjuk', 224, 242);
    place(s, 'mukjik', 120, 230);
    place(s, 'ppik', 400, 230);
    s.ui = { active: 'mukjik', selected: null };
    sceneTap(data, s, { x: 60, y: 240 }, 0, false);
    expect(s.walkers.mukjik.target).toEqual({ x: 60, y: 240 });
  });

  it('한쪽이 걷기 영역 밖이면 반대쪽에 선다', () => {
    const s = ready();
    place(s, 'jjuk', WALK_AREA.left + 4, 240);
    place(s, 'mukjik', 200, 230);
    place(s, 'ppik', 400, 230);
    const t = standAside(data, s, 'mukjik', { x: WALK_AREA.left, y: 236 });
    const jjuk = bodies(data, s).jjuk;
    expect(t.x).toBeGreaterThan(WALK_AREA.left);
    expect(characterHitBox(characterDef('mukjik'), t.x, t.y, -1).left).toBeGreaterThanOrEqual(jjuk.left + jjuk.width + 2);
  });

  it('셋이 붙어 있어도 누구와도 안 겹치는 x를 고른다', () => {
    const s = ready();
    place(s, 'jjuk', 240, 240);
    place(s, 'ppik', 280, 240);
    place(s, 'mukjik', 60, 230);
    s.ui = { active: 'mukjik', selected: null };
    sceneTap(data, s, { x: 262, y: 238 }, 0, false);
    settle(s);
    expect(anyOverlap(s)).toEqual([]);
  });

  it('동료가 걷는 중이면 그 목표 자리를 피한다', () => {
    const s = ready();
    place(s, 'mukjik', 60, 230);
    place(s, 'ppik', 400, 230);
    place(s, 'jjuk', 120, 240);
    s.walkers.jjuk.target = { x: 300, y: 240 };
    const t = standAside(data, s, 'mukjik', { x: 300, y: 238 });
    expect(t.x).not.toBe(300);
    const goal = characterHitBox(characterDef('jjuk'), 300, 240, s.walkers.jjuk.facing);
    expect(overlap(characterHitBox(characterDef('mukjik'), t.x, t.y, t.x > 60 ? 1 : -1), goal)).toBe(false);
  });

  it('비켜 선 목표를 다시 누르면(같은 탭) 건너뛰기가 그대로 된다(5-2-1절)', () => {
    const s = ready();
    place(s, 'jjuk', 224, 242);
    place(s, 'mukjik', 60, 230);
    place(s, 'ppik', 400, 230);
    s.ui = { active: 'mukjik', selected: null };
    sceneTap(data, s, { x: 226, y: 150 }, 0, false);
    const t = { ...s.walkers.mukjik.target! };
    expect(t.x).not.toBe(226);
    sceneTick(data, s);
    expect(sceneTap(data, s, { x: 226, y: 150 }, 0, false)).toEqual({ kind: 'skipWalk' });
    expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([t.x, t.y]);
  });
});
