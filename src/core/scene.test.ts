import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import type { HitBox } from './hit';
import { CHAR_SLOTS } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, currentBubble, isBusy, sceneLayout, sceneTap, sceneTick, TIMING, type SceneData, type SceneState } from './scene';
import type { Point } from './viewport';

const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MAGPIE = center({ left: 134, top: 6, width: 24, height: 24 });
const NEST = center({ left: 128, top: 30, width: 36, height: 24 });
const SEESAW_LEFT = center({ left: 208, top: 196, width: 38, height: 24 });

function idle(s: SceneState, max = 5000): number {
  let n = 0;
  while (isBusy(s) && n < max) {
    sceneTick(data, s);
    n++;
  }
  expect(isBusy(s)).toBe(false);
  return n;
}

/** onEnter가 끝난 화면. */
function ready(): SceneState {
  const s = createScene(data);
  idle(s);
  return s;
}

/** 다음 말풍선까지 틱을 돌린다. */
function untilSay(s: SceneState): string {
  for (let i = 0; i < 2000; i++) {
    const b = currentBubble(s);
    if (b) return b.text;
    sceneTick(data, s);
  }
  throw new Error('말풍선이 안 떴다');
}

function sayTexts(s: SceneState): string[] {
  const out: string[] = [];
  while (isBusy(s)) {
    const b = currentBubble(s);
    if (b && s.current?.t === 0) out.push(b.text);
    sceneTick(data, s);
  }
  return out;
}

describe('createScene', () => {
  it('바닥 3명을 40px씩 벌려 세우고, onEnter 동안 busy다', () => {
    const s = createScene(data);
    expect([s.walkers.jjuk.x, s.walkers.mukjik.x, s.walkers.ppik.x]).toEqual([360, 400, 440]);
    expect(s.walkers.jjuk.y).toBe(244);
    expect(isBusy(s)).toBe(true);
    expect(untilSay(s)).toBe('magpie_nest.enter');
    idle(s);
    expect(s.shownGauge).toBe(5);
  });

  it('상태는 JSON으로 왕복해도 같다(ADR-0004 결정 2)', () => {
    const s = ready();
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    sceneTick(data, s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('busy 중 입력 (설계 5절)', () => {
  it('반응 재생 중에는 전환·행동을 받지 않는다(줄도 안 세움)', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false); // 쭉이 뻗기: 둥지 → 높이가 모자라
    expect(isBusy(s)).toBe(true);
    const before = JSON.stringify(s.puzzle);
    expect(sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false).kind).toBe('ignored');
    expect(s.ui.active).toBe('jjuk');
    idle(s);
    expect(JSON.stringify(s.puzzle)).toBe(before);
  });

  it('말풍선은 0.4초 전에는 안 넘어가고, 그 뒤 탭 한 번에 그 말풍선만 끝난다', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false);
    untilSay(s);
    for (let i = 0; i < TIMING.saySkipAfter - 1; i++) sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('ignored');
    sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('skipSay');
    sceneTick(data, s);
    expect(currentBubble(s)).toBeNull();
  });

  it('자동 걷기 중 탭은 걷기만 끝 위치로 건너뛰고 새 행동은 받지 않는다(ADR-0065 6절 개정)', () => {
    const s = ready();
    sceneTap(data, s, SEESAW_LEFT, 0, false); // 쭉이 올라서기
    sceneTick(data, s);
    expect(s.current?.ev.type).toBe('walk');
    const r = sceneTap(data, s, MAGPIE, 0, false);
    expect(r.kind).toBe('skipWalk');
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([220, 214]);
    expect(s.puzzle.at.jjuk).toBe('seesaw_left');
    idle(s);
    // 까치 탭은 행동이 되지 않았다: 까치는 아직 둥지 위다.
    expect(s.puzzle.flags['magpie.on_ground']).toBe(false);
  });

  it('바닥→바닥 엔진 걷기는 busy가 아니다', () => {
    const s = ready();
    const r = sceneTap(data, s, { x: 300, y: 250 }, 0, false);
    expect(r).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    expect(isBusy(s)).toBe(false);
    expect(s.walkers.jjuk.target).toEqual({ x: 300, y: 250 });
  });
});

describe('대사 변형과 힌트 ② (ADR-0065 5절, ADR-0018 F3)', () => {
  it('규칙 대사 배열은 발동 횟수로 고른다(마지막 것을 반복)', () => {
    const s = ready();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      sceneTap(data, s, NEST, 0, false);
      seen.push(...sayTexts(s));
    }
    expect(seen).toEqual(['magpie_nest.nest_too_short', 'magpie_nest.nest_too_short_again', 'magpie_nest.nest_too_short_again']);
  });

  it('같은 핫스팟에서 폴백 2번째에 힌트 대사가 한 번 붙는다', () => {
    const s = ready();
    const seen: string[][] = [];
    for (let i = 0; i < 3; i++) {
      sceneTap(data, s, MAGPIE, 0, false); // 쭉이 뻗기: 까치 → 폴백
      seen.push(sayTexts(s));
    }
    expect(seen[0]).toEqual(['magpie_nest.magpie_high_five']);
    expect(seen[1]).toEqual(['magpie_nest.magpie_high_five', 'char.jjuk.hint_squeak']);
    expect(seen[2]).toEqual(['magpie_nest.magpie_high_five']);
  });

  it('힌트 능력이 자기 능력이면 힌트를 띄우지 않는다', () => {
    const run = (d: SceneData): string[] => {
      const s = createScene(d);
      while (isBusy(s)) sceneTick(d, s);
      sceneTap(d, s, center(CHAR_SLOTS.mukjik), 0, false);
      const seen: string[] = [];
      for (let i = 0; i < 2; i++) {
        sceneTap(d, s, NEST, 0, false); // 묵직이 쿵: 둥지 → 폴백
        while (isBusy(s)) {
          const b = currentBubble(s);
          if (b && s.current?.t === 0) seen.push(b.text);
          sceneTick(d, s);
        }
      }
      return seen;
    };
    expect(run(data)).toContain('char.mukjik.hint_stretch');
    const nest = { ...data.screen.hotspots.nest!, hintAbility: 'stomp' as const };
    const own: SceneData = { ...data, screen: { ...data.screen, hotspots: { ...data.screen.hotspots, nest } } };
    expect(run(own).some((t) => t.startsWith('char.'))).toBe(false);
  });
});

describe('sceneLayout (재생 도구 훅)', () => {
  it('상자는 판정 상자와 같고, busy·gauge는 재생 상태를 따른다', () => {
    const s = createScene(data);
    const l = sceneLayout(data, s);
    expect(l.busy).toBe(true);
    expect(l.gauge).toBe(5);
    expect(l.hud['char.jjuk']).toEqual(CHAR_SLOTS.jjuk);
    expect(l.hotspots.magpie).toEqual({ left: 134, top: 6, width: 24, height: 24 });
    expect(l.at).toEqual({ jjuk: 'floor', mukjik: 'floor', ppik: 'floor' });
    expect(l.armed).toBeNull();
  });
});
