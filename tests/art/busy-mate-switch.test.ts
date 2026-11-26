// 연출 중(busy) 화면 속 동료의 보이는 그림 칸을 누르면 바로 전환한다 (`ui-interaction.md` 5절 예외 다섯, #935 후보 7 B).
// Mia 묶음 2-1: ズッシー 행동 직후 ノビー를 눌렀는데 4.12초 동안 아무 일도 없었다(설계대로 `ignored`, 표시 0).
// 입력 규칙이 세 화면에 다 걸리니 세 화면 정답 첫 행동으로 돈다(PM 판정 #935). 판정은 엔진처럼 시트 알파를 넘겨 `sceneTap`으로 한다.

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import charactersJson from '../../content/characters.json';
import nestJson from '../../content/screens/magpie_nest.json';
import nestArtJson from '../../public/scenes/magpie_nest-objects.json';
import fountainJson from '../../content/screens/park_fountain.json';
import fountainArtJson from '../../public/scenes/park_fountain-objects.json';
import laundromatJson from '../../content/screens/laundromat.json';
import laundromatArtJson from '../../public/scenes/laundromat-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import type { AlphaMask } from '../../src/core/alpha';
import { CHARACTERS, type CharacterId } from '../../src/core/characters';
import { createScene, drawnBodies, isBusy, isHanging, runAction, sceneTap, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { parseSceneArt } from '../../src/core/sceneArt';
import { parseSpriteMeta, type SpriteMeta } from '../../src/core/sprite';
import type { Action, CharactersData, ScreenData } from '../../src/core/puzzle/types';
import type { Point } from '../../src/core/viewport';
import { pngAlpha } from './png';

const ROOT = join(import.meta.dirname, '..', '..', 'public');
const sprites: Record<CharacterId, SpriteMeta> = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const masks: Record<string, AlphaMask> = Object.fromEntries(CHARACTERS.map((c) => [c.id, pngAlpha(join(ROOT, 'sprites', sprites[c.id].image))]));
const characters = charactersJson as CharactersData;

function screenData(screen: unknown, artJson: unknown): { base: SceneData; data: SceneData } {
  const art = parseSceneArt(artJson);
  const objects = pngAlpha(join(ROOT, 'scenes', art.image));
  const base: SceneData = { screen: screen as ScreenData, characters, art, sprites };
  return { base, data: { ...base, alpha: { sprite: (id) => masks[id] ?? null, objects: () => objects } } };
}

const SCREENS = [
  { id: 'magpie_nest', ...screenData(nestJson, nestArtJson) },
  { id: 'park_fountain', ...screenData(fountainJson, fountainArtJson) },
  { id: 'laundromat', ...screenData(laundromatJson, laundromatArtJson) },
];
const laundromat = SCREENS[2]!;
const nest = SCREENS[0]!;
const MOUSE = 0;
const TOUCH = 8;

function ready(d: SceneData): SceneState {
  const s = createScene(d);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(d, s);
  expect(isBusy(s)).toBe(false);
  return s;
}

function act(d: SceneData, s: SceneState, a: Action): void {
  s.ui = { active: a.char, selected: null };
  runAction(d, s, a, null);
  expect(isBusy(s)).toBe(true);
}

/** busy 중 지금 이벤트가 `pred`일 때까지 돈다. */
function until(d: SceneData, s: SceneState, pred: (s: SceneState) => boolean): void {
  for (let i = 0; i < 5000; i++) {
    if (pred(s)) return;
    sceneTick(d, s);
    expect(isBusy(s)).toBe(true);
  }
  throw new Error('그 이벤트가 안 왔다');
}
const evType = (s: SceneState): string | undefined => s.current?.ev.type;
const animOf = (s: SceneState): string | null => {
  const ev = s.current?.ev;
  return ev?.type === 'anim' ? ev.target : null;
};

/** 이번 프레임에 그 사람으로 판정되는 그림 칸 하나(가운데에 가까운 것). 없으면 null. */
function drawnPoint(d: SceneData, s: SceneState, id: CharacterId): Point | null {
  const b = drawnBodies(d, s)[id];
  if (!b) return null;
  const cx = b.box.left + b.box.width / 2;
  const cy = b.box.top + b.box.height / 2;
  let best: Point | null = null;
  for (let y = Math.floor(b.box.top); y < b.box.top + b.box.height; y++) {
    for (let x = Math.floor(b.box.left); x < b.box.left + b.box.width; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      if (!b.at(p)) continue;
      if (!best || Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy)) best = p;
    }
  }
  return best;
}

/** 탭이 건드리면 안 되는 것: 시각, 지금 이벤트와 경과, 대기열, 퍼즐 상태, 걷는 사람 자리·목표. */
function snapshot(s: SceneState): string {
  return JSON.stringify([s.tick, s.current?.ev, s.current?.t, s.queue, s.puzzle, s.walkers]);
}

describe('연출 중 화면 속 동료 클릭 = 바로 전환 (예외 다섯, #935 후보 7 B)', () => {
  for (const sc of SCREENS) {
    const first = (sc.data.screen.solution ?? [])[0]!;
    it(`${sc.id}: 정답 첫 행동(${first.char} ${first.verb} ${first.target})의 말풍선 아닌 연출 중, 다른 두 사람 그림 칸 = 전환(마우스·터치), 연출은 그대로`, () => {
      for (const slop of [MOUSE, TOUCH]) {
        const s = ready(sc.data);
        act(sc.data, s, first);
        until(sc.data, s, (x) => evType(x) === 'anim' || evType(x) === 'fx');
        const mates = CHARACTERS.map((c) => c.id).filter((id) => id !== first.char && id !== animOf(s) && !isHanging(sc.data, s, id));
        expect(mates.length).toBe(2);
        for (const mate of mates) {
          const p = drawnPoint(sc.data, s, mate);
          expect(p, `${mate} 그림 칸`).not.toBeNull();
          const before = snapshot(s);
          expect(sceneTap(sc.data, s, p!, slop, slop > 0)).toEqual({ kind: 'intent', intent: { kind: 'switch', char: mate, label: { verb: null, target: mate } } });
          expect(s.ui).toEqual({ active: mate, selected: null });
          expect(snapshot(s)).toBe(before);
          s.ui = { active: first.char, selected: null };
        }
      }
    });
  }

  it('대상 앞까지 걷는 중에도 동료 그림 칸은 전환이고, 걷기는 건너뛰지 않는다(전: `skipWalk`)', () => {
    const d = laundromat.data;
    const s = ready(d);
    act(d, s, { char: 'mukjik', verb: 'stomp', target: 'dryer_3' });
    until(d, s, (x) => evType(x) === 'walk');
    const target = { ...s.walkers.mukjik.target };
    const p = drawnPoint(d, s, 'jjuk')!;
    expect(sceneTap(d, s, p, MOUSE, false)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'jjuk' } });
    expect(evType(s)).toBe('walk');
    expect(s.walkers.mukjik.target).toEqual(target);
  });

  it('그림 칸만 본다: 그 사람 그림 상자 안 투명 칸은 전환이 아니다(전처럼 무시)', () => {
    const d = laundromat.data;
    const s = ready(d);
    act(d, s, { char: 'mukjik', verb: 'stomp', target: 'dryer_3' });
    until(d, s, (x) => evType(x) === 'anim');
    const b = drawnBodies(d, s).jjuk!;
    let p: Point | null = null;
    for (let y = Math.floor(b.box.top); !p && y < b.box.top + b.box.height; y++) {
      for (let x = Math.floor(b.box.left); !p && x < b.box.left + b.box.width; x++) {
        const q = { x: x + 0.5, y: y + 0.5 };
        if (!CHARACTERS.some((c) => drawnBodies(d, s)[c.id]?.at(q))) p = q;
      }
    }
    expect(p).not.toBeNull();
    expect(sceneTap(d, s, p!, TOUCH, true).kind).toBe('ignored');
    expect(s.ui.active).toBe('mukjik');
  });

  it('시트 알파가 아직 없으면(엔진이 못 읽음) 전처럼 무시한다: 서 있기 얼굴 상자로 넓히지 않는다', () => {
    const s = ready(laundromat.data);
    act(laundromat.data, s, { char: 'mukjik', verb: 'stomp', target: 'dryer_3' });
    until(laundromat.data, s, (x) => evType(x) === 'anim');
    const p = drawnPoint(laundromat.data, s, 'jjuk')!;
    expect(sceneTap(laundromat.base, s, p, MOUSE, false).kind).toBe('ignored');
    expect(s.ui.active).toBe('mukjik');
  });

  it('지금 anim으로 움직이는 사람은 빼다: 얼굴 칸으로 다른 사람이 된 뒤 연출 중인 ズッシー를 눌러도 전환하지 않는다', () => {
    const d = laundromat.data;
    const s = ready(d);
    act(d, s, { char: 'mukjik', verb: 'stomp', target: 'dryer_3' });
    until(d, s, (x) => animOf(x) === 'mukjik');
    s.ui = { active: 'jjuk', selected: null };
    const p = drawnPoint(d, s, 'mukjik')!;
    expect(sceneTap(d, s, p, MOUSE, false).kind).toBe('ignored');
    expect(s.ui.active).toBe('jjuk');
  });

  it('매달린 사람은 빼다: 화면 1 고리의 ノビー는 연출 중 눌러도 전환하지 않는다(쉴 때는 전환)', () => {
    const d = nest.data;
    const s = ready(d);
    const sol = d.screen.solution!;
    for (const a of sol.slice(0, 3)) {
      act(d, s, a);
      for (let i = 0; i < 20_000 && isBusy(s); i++) sceneTick(d, s);
    }
    expect(isHanging(d, s, 'jjuk')).toBe(true);
    const idle = drawnPoint(d, s, 'jjuk')!;
    s.ui = { active: 'ppik', selected: null };
    expect(sceneTap(d, s, idle, MOUSE, false)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'jjuk' } });
    act(d, s, { char: 'ppik', verb: 'squeak', target: 'magpie' });
    until(d, s, (x) => evType(x) === 'anim' || evType(x) === 'fx');
    const p = drawnPoint(d, s, 'jjuk')!;
    expect(sceneTap(d, s, p, MOUSE, false).kind).not.toBe('intent');
    expect(s.ui.active).toBe('ppik');
  });

  it('말풍선 중은 그대로(예외 넷 2·3·4): 잠금 전 동료 그림 칸 클릭은 바로 전환하지 않는다', () => {
    const d = laundromat.data;
    for (const slop of [MOUSE, TOUCH]) {
      const s = ready(d);
      act(d, s, { char: 'mukjik', verb: 'stomp', target: 'dryer_3' });
      until(d, s, (x) => evType(x) === 'say');
      const p = drawnPoint(d, s, 'jjuk')!;
      sceneTap(d, s, p, slop, slop > 0);
      expect(s.ui.active).toBe('mukjik');
    }
  });
});
