import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import type { HitBox } from './hit';
import { CHAR_SLOTS } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, currentBubble, currentCut, isBusy, sceneLayout, sceneTap, sceneTick, TIMING, type SceneData, type SceneState } from './scene';
import type { Point } from './viewport';

const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MAGPIE = center({ left: 134, top: 6, width: 24, height: 24 });
const NEST = center({ left: 128, top: 30, width: 36, height: 24 });
const SEESAW_LEFT = center({ left: 208, top: 196, width: 38, height: 24 });
const HOOK = center({ left: 150, top: 84, width: 24, height: 24 });

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

  it('자기 능력 캐릭터의 폴백은 세지 않는다: 묵직이 hook ×2 뒤 삑삑이 2번째에 H06(#122 리뷰)', () => {
    const s = ready();
    const seen: string[][] = [];
    sceneTap(data, s, center(CHAR_SLOTS.mukjik), 0, false);
    for (let i = 0; i < 2; i++) {
      sceneTap(data, s, HOOK, 0, false); // 묵직이 쿵: 고리 → 폴백(L22), hook 힌트 능력이 stomp라 힌트 없음
      seen.push(sayTexts(s));
    }
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    for (let i = 0; i < 2; i++) {
      sceneTap(data, s, HOOK, 0, false); // 삑삑이 꽥: 고리 → 폴백
      seen.push(sayTexts(s));
    }
    expect(seen.slice(0, 2).flat().some((t) => t.startsWith('char.'))).toBe(false);
    expect(seen[2]).not.toContain('char.ppik.hint_stomp');
    expect(seen[3]).toContain('char.ppik.hint_stomp');
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

describe('게이지 0 (#129, ADR-0065 5절 6, ADR-0018 G2)', () => {
  const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
  const MAGPIE_GROUND = center({ left: ground[0], top: ground[1], width: ground[2], height: ground[3] });

  /** 까치를 내리고 게이지를 1로 둔 뒤, 쭉이로 바닥 까치를 뻗어(규칙 7, 게이지 -1) 기절시킨다. */
  function faintNow(): SceneState {
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false); // 삑삑이 꽥: 까치가 바닥으로
    idle(s);
    sceneTap(data, s, center(CHAR_SLOTS.jjuk), 0, false);
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    sceneTap(data, s, MAGPIE_GROUND, 0, false);
    return s;
  }

  it('컷 동안은 0을 보이고, faint가 끝나면 HUD 게이지가 가득이다', () => {
    const s = faintNow();
    let faintStart = -1;
    const shownDuringFaint = new Set<number>();
    while (isBusy(s)) {
      sceneTick(data, s);
      if (s.current?.ev.type === 'faint') {
        if (faintStart < 0) faintStart = s.tick;
        shownDuringFaint.add(s.shownGauge);
      }
    }
    expect(faintStart).toBeGreaterThan(0);
    expect([...shownDuringFaint]).toEqual([0]);
    expect(s.puzzle.gauge).toBe(5);
    expect(s.shownGauge).toBe(5);
    expect(sceneLayout(data, s).gauge).toBe(5);
  });

  it('컷 글은 faint 시작에 뜨고, busy가 끝난 뒤 0.5초 더 남다가 사라진다', () => {
    const s = faintNow();
    while (s.current?.ev.type !== 'faint') sceneTick(data, s);
    const from = s.tick;
    expect(currentCut(s)).toBe('ui.faint');
    idle(s);
    expect(sceneLayout(data, s).cut).toBe('ui.faint');
    while (currentCut(s) !== null) sceneTick(data, s);
    expect(s.tick - from).toBe(TIMING.faintCut);
    expect(TIMING.faintCut).toBeGreaterThan(TIMING.faint);
  });

  it('컷이 남은 동안 입력을 받고, 새 행동을 시작하면 컷을 내린다', () => {
    const s = faintNow();
    idle(s);
    expect(currentCut(s)).toBe('ui.faint');
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false); // 캐릭터 전환은 컷을 그대로 둔다
    expect(currentCut(s)).toBe('ui.faint');
    const r = sceneTap(data, s, SEESAW_LEFT, 0, false);
    expect(r.kind).toBe('intent');
    expect(currentCut(s)).toBeNull();
  });
});

describe('클리어 컷 L32 (설계 8절, #68)', () => {
  const withLine: SceneData = { ...data, clearLine: 'magpie_nest.clear' };

  /** 쭉이가 고리에 매달려 있고 까치는 바닥 → 둥지 뻗기 한 번이면 클리어(정답 4번). */
  function clearNow(d: SceneData): SceneState {
    const s = createScene(d);
    while (isBusy(s)) sceneTick(d, s);
    s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, jjuk: 'hook' }, flags: { ...s.puzzle.flags, 'magpie.on_ground': true } };
    const r = sceneTap(d, s, center(sceneLayout(d, s).hotspots.nest!), 0, false);
    expect(r.kind).toBe('intent');
    expect(s.puzzle.flags['nest.key_taken']).toBe(true);
    return s;
  }

  it('clear 이벤트 동안 컷 글을 띄우고 busy다. 끝나면 컷이 사라지고 클리어 카드 조건(cleared && !busy)이 된다', () => {
    const s = clearNow(withLine);
    while (s.current?.ev.type !== 'clear') sceneTick(withLine, s);
    expect(s.cleared).toBe(true);
    expect(currentCut(s)).toBe('magpie_nest.clear');
    expect(sceneLayout(withLine, s).cut).toBe('magpie_nest.clear');
    expect(currentBubble(s)).toBeNull();
    const from = s.tick;
    while (isBusy(s)) sceneTick(withLine, s);
    expect(s.tick - from).toBe(TIMING.clearCut);
    expect(currentCut(s)).toBeNull();
  });

  it('컷은 0.4초 전 탭은 무시하고, 그 뒤 탭 한 번에 넘어간다. 클리어 뒤 다른 입력은 받지 않는다', () => {
    const s = clearNow(withLine);
    while (s.current?.ev.type !== 'clear') sceneTick(withLine, s);
    expect(sceneTap(withLine, s, SEESAW_LEFT, 0, false).kind).toBe('ignored');
    for (let i = 0; i < TIMING.saySkipAfter; i++) sceneTick(withLine, s);
    expect(sceneTap(withLine, s, SEESAW_LEFT, 0, false).kind).toBe('skipSay');
    sceneTick(withLine, s);
    expect(isBusy(s)).toBe(false);
    expect(currentCut(s)).toBeNull();
    expect(sceneTap(withLine, s, SEESAW_LEFT, 0, false).kind).toBe('ignored');
  });

  it('clearLine이 없는 화면은 예전처럼 바로 카드(길이 0)', () => {
    const s = clearNow(data);
    let sawCut = false;
    while (isBusy(s)) {
      sceneTick(data, s);
      if (currentCut(s) !== null) sawCut = true;
    }
    expect(s.cleared).toBe(true);
    expect(sawCut).toBe(false);
  });
});
