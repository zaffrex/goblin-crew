import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { hitTest, type HitBox } from './hit';
import { CHAR_SLOTS, VERB_SLOTS } from './hud';
import { worldTargets } from './interact';
import { parseSpriteMeta, spriteBox, spriteFrame } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { activeFx, bodies, charFacing, charPose, createScene, currentBubble, currentCut, drawOrder, isBusy, sceneLayout, sceneTap, sceneTick, tapContext, TIMING, type SceneData, type SceneState } from './scene';
import type { Point } from './viewport';

const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MAGPIE = center({ left: 134, top: 6, width: 24, height: 24 });
const NEST = center({ left: 128, top: 30, width: 36, height: 24 });
const SEESAW_LEFT = center({ left: 208, top: 196, width: 38, height: 24 });
const HOOK = center({ left: 150, top: 84, width: 24, height: 24 });
const SEESAW_RIGHT = center({ left: 250, top: 196, width: 38, height: 24 });

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

describe('바구니 착지 점과 포개짐 (형식 기록 6절 2번, 10절 2단계, #157)', () => {
  const BASKET = { x: 160, y: 235 };
  const pick = (s: SceneState, c: 'jjuk' | 'mukjik' | 'ppik'): void => {
    sceneTap(data, s, center(CHAR_SLOTS[c]), 0, false);
  };
  /** c를 왼쪽 시소 끝에 올리고 묵직이 쿵으로 발사한다. 고리가 비어 있으면 c가 고리에 매달린다. */
  function launch(s: SceneState, c: 'jjuk' | 'ppik'): void {
    pick(s, c);
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    pick(s, 'mukjik');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, SEESAW_RIGHT, 0, false);
    idle(s);
  }
  /** 매달린 c에게 바닥을 누르게 해서 손을 놓게 한다(5절 1단계). */
  function letGo(s: SceneState, c: 'jjuk' | 'ppik', floor: Point = { x: 400, y: 250 }): void {
    pick(s, c);
    sceneTap(data, s, floor, 0, false);
    idle(s);
  }
  const at = (s: SceneState, c: 'jjuk' | 'mukjik' | 'ppik'): Point => ({ x: s.walkers[c].x, y: s.walkers[c].y });
  /** 그리는 순서에서 두 사람만 뽑는다(뒤 → 앞). 묵직이는 바닥 어딘가에 서 있어서 비교에서 뺀다. */
  const pair = (s: SceneState, a: 'jjuk' | 'ppik', b: 'jjuk' | 'ppik'): string[] => drawOrder(data, s).filter((c) => c === a || c === b);
  const hitAt = (s: SceneState, p: Point): string | undefined => hitTest(worldTargets(tapContext(data, s), s.ui), p, 0)?.id;

  it('고리에서 손을 놓으면 누른 바닥 점이 아니라 바구니 안 (160, 235)에 떨어진다', () => {
    const s = ready();
    launch(s, 'jjuk');
    expect(s.puzzle.at.jjuk).toBe('hook');
    letGo(s, 'jjuk');
    expect(s.puzzle.at.jjuk).toBe('floor');
    expect(at(s, 'jjuk')).toEqual(BASKET);
    expect(s.floorTo.jjuk).toBeUndefined();
  });

  it('13번(포개짐): 고리의 사람과 시소에서 날아간 사람(via hook)이 둘 다 바구니에 떨어진다', () => {
    const s = ready();
    launch(s, 'jjuk');
    launch(s, 'ppik');
    expect(s.puzzle.at).toEqual({ jjuk: 'floor', mukjik: 'floor', ppik: 'floor' });
    expect(at(s, 'jjuk')).toEqual(BASKET);
    expect(at(s, 'ppik')).toEqual(BASKET);
    // 규칙의 move 순서대로 떨어진다: 시소의 삑삑이 먼저, 고리의 쭉이가 위.
    expect(pair(s, 'jjuk', 'ppik')).toEqual(['ppik', 'jjuk']);
  });

  it('14번(반대로 날아감)은 via가 없어서 지금처럼 그 자리 바로 아래 바닥에 선다', () => {
    const s = ready();
    pick(s, 'ppik');
    sceneTap(data, s, SEESAW_RIGHT, 0, false);
    idle(s);
    pick(s, 'mukjik');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    expect(s.puzzle.at.ppik).toBe('floor');
    expect(at(s, 'ppik')).toEqual({ x: data.screen.spots.seesaw_right!.x, y: data.screen.spots.floor!.y });
  });

  /** 끝날 때까지 틱을 돌리며 c가 서 있던 점을 모두 모은다(같은 점은 한 번). */
  function trail(s: SceneState, c: 'jjuk' | 'mukjik' | 'ppik'): string[] {
    const seen = new Set<string>();
    while (isBusy(s)) {
      sceneTick(data, s);
      seen.add(`${s.walkers[c].x},${s.walkers[c].y}`);
    }
    return [...seen];
  }

  it('#176: 고리에서 맞아 기절하면 바구니 안 착지 점에 서고 바닥 y로 튀지 않는다', () => {
    const s = ready();
    launch(s, 'jjuk');
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    pick(s, 'jjuk');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, NEST, 0, false); // 까치가 둥지에 있어서 쪼임(게이지 -1) → place 뒤 faint
    const seen = trail(s, 'jjuk');
    expect(s.puzzle.gauge).toBe(5);
    expect(s.puzzle.at.jjuk).toBe('floor');
    // 매달린 채 쪼이고(고리 점) → 바구니 착지. 바닥 y(244)는 한 번도 지나지 않는다.
    const hook = data.screen.spots.hook!;
    expect(seen).toEqual([`${hook.x},${hook.y}`, `${BASKET.x},${BASKET.y}`]);
    expect(at(s, 'jjuk')).toEqual(BASKET);
  });

  it('#176: 13번(포개짐)이 게이지 0이면 두 사람 다 바구니에 남는다', () => {
    const s = ready();
    launch(s, 'jjuk');
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    launch(s, 'ppik');
    expect(s.puzzle.gauge).toBe(5);
    expect(at(s, 'jjuk')).toEqual(BASKET);
    expect(at(s, 'ppik')).toEqual(BASKET);
  });

  it('#176: 고리 아닌 곳(시소 끝)에서 기절하면 지금처럼 그 x의 바닥 y에 선다', () => {
    const s = ready();
    pick(s, 'ppik');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, MAGPIE, 0, false); // 삑삑이 꽥: 까치가 바닥으로
    idle(s);
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    expect(s.puzzle.at.jjuk).toBe('seesaw_left');
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, center({ left: ground[0], top: ground[1], width: ground[2], height: ground[3] }), 0, false); // 규칙 7: 쪼임 → 0
    idle(s);
    expect(s.puzzle.gauge).toBe(5);
    expect(s.puzzle.at.jjuk).toBe('floor');
    expect(at(s, 'jjuk')).toEqual({ x: data.screen.spots.seesaw_left!.x, y: data.screen.spots.floor!.y });
  });

  /** 까치를 바닥에 내리고 쭉이를 왼쪽 시소 끝에 올린 뒤, 게이지 1에서 바닥 까치를 뻗게 한다(규칙 7 → 기절). */
  function peckFromSeesaw(s: SceneState): void {
    pick(s, 'ppik');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, MAGPIE, 0, false);
    idle(s);
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, center({ left: ground[0], top: ground[1], width: ground[2], height: ground[3] }), 0, false);
  }

  it('#215: 바닥을 걸어 (60, 210)에 선 사람은 남 때문에 기절해도 그 점에 그대로 있다', () => {
    const s = ready();
    pick(s, 'mukjik');
    sceneTap(data, s, { x: 60, y: 210 }, 0, false);
    for (let i = 0; i < 2000 && s.walkers.mukjik.target; i++) sceneTick(data, s);
    expect(at(s, 'mukjik')).toEqual({ x: 60, y: 210 });
    peckFromSeesaw(s);
    const seen = trail(s, 'mukjik');
    expect(s.puzzle.gauge).toBe(5);
    expect(seen).toEqual(['60,210']);
    // 행동한 쭉이(시소 끝)는 지금처럼 그 x의 바닥 y로 내려온다.
    expect(at(s, 'jjuk')).toEqual({ x: data.screen.spots.seesaw_left!.x, y: data.screen.spots.floor!.y });
  });

  it('#215: 시소에서 `move floor`로 내려와 선 사람도 기절 때 그 점에 남는다', () => {
    const s = ready();
    pick(s, 'ppik');
    sceneTap(data, s, SEESAW_RIGHT, 0, false);
    idle(s);
    expect(s.puzzle.at.ppik).toBe('seesaw_right');
    sceneTap(data, s, { x: 440, y: 212 }, 0, false); // 시소에서 바닥 점으로(move floor). 묵직이와 안 겹치는 점
    idle(s);
    expect(s.puzzle.at.ppik).toBe('floor');
    const stood = at(s, 'ppik');
    peckFromSeesaw(s);
    idle(s);
    expect(s.puzzle.gauge).toBe(5);
    expect(at(s, 'ppik')).toEqual(stood);
  });

  it('포개지면 나중에 떨어진 사람이 앞에 그려지고 클릭도 받는다(CHARACTERS 순서보다 우선)', () => {
    const s = ready();
    launch(s, 'jjuk');
    letGo(s, 'jjuk');
    launch(s, 'ppik');
    letGo(s, 'ppik');
    expect(at(s, 'ppik')).toEqual(BASKET);
    expect(pair(s, 'jjuk', 'ppik')).toEqual(['jjuk', 'ppik']);
    pick(s, 'mukjik'); // 지금 캐릭터 몸은 판정에서 빠지므로 제3자로 바꾼다
    expect(hitAt(s, { x: 160, y: 225 })).toBe('char:ppik');
    // 반대 순서면 쭉이가 위다(순번이 이긴다는 확인).
    s.landed.jjuk = (s.landed.ppik ?? 0) + 1;
    expect(pair(s, 'jjuk', 'ppik')).toEqual(['ppik', 'jjuk']);
    expect(hitAt(s, { x: 160, y: 225 })).toBe('char:jjuk');
  });

  it('바구니 안 캐릭터 상자가 바구니 핫스팟을 덮고, 좌우 끝은 바구니가 받는다', () => {
    const s = ready();
    launch(s, 'jjuk');
    letGo(s, 'jjuk');
    pick(s, 'mukjik');
    const [bx, by, bw] = data.screen.hotspots.basket!.box!;
    expect(hitAt(s, { x: 160, y: 230 })).toBe('char:jjuk');
    expect(hitAt(s, { x: bx, y: by + 12 })).toBe('hotspot:basket');
    expect(hitAt(s, { x: bx + bw - 1, y: by + 12 })).toBe('hotspot:basket');
  });

  it('발 y가 다르면 착지 순번과 상관없이 발 y가 큰 쪽이 앞이다(바구니 앞을 지나는 사람)', () => {
    const s = ready();
    launch(s, 'jjuk');
    letGo(s, 'jjuk');
    s.walkers.ppik.x = 160;
    s.walkers.ppik.y = 244;
    s.landed.ppik = -1;
    expect(pair(s, 'jjuk', 'ppik')).toEqual(['jjuk', 'ppik']);
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

describe('한 번 재생 연출의 마지막 장 유지와 매달림 (#189, 형식 기록 5절)', () => {
  /** 지금 재생 중인 이벤트 종류. 함수로 읽어서 while 조건의 타입 좁힘이 루프 뒤로 새지 않게 한다. */
  const now = (s: SceneState): string | undefined => s.current?.ev.type;
  const animOn = (s: SceneState, target: string): boolean => s.current?.ev.type === 'anim' && s.current.ev.target === target;
  const pick = (s: SceneState, c: 'jjuk' | 'mukjik' | 'ppik'): void => {
    sceneTap(data, s, center(CHAR_SLOTS[c]), 0, false);
  };
  /** 쭉이를 왼쪽 시소 끝에 올리고 묵직이 쿵을 누른다(재생은 아직 안 함). */
  function stompWithJjuk(): SceneState {
    const s = ready();
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    pick(s, 'mukjik');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, SEESAW_RIGHT, 0, false);
    return s;
  }

  it('발사 연출이 끝나도 말풍선 동안 시소 위에서 마지막 장(launch_to_hook)을 유지하고, 고리에 놓이면 매달림으로 바뀐다', () => {
    const s = stompWithJjuk();
    while (!(s.current?.ev.type === 'anim' && s.current.ev.name === 'launch_to_hook')) sceneTick(data, s);
    // 퍼즐 상태는 이미 고리지만 몸은 아직 시소다 → 매달림이 아니다(방향 고정 없음).
    expect(s.puzzle.at.jjuk).toBe('hook');
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: false, event: { name: 'launch_to_hook', ms: 0 } });
    while (now(s) !== 'say') sceneTick(data, s);
    const seesaw = data.screen.spots.seesaw_left!;
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([seesaw.x, seesaw.y]);
    const pose = charPose(data, s, 'jjuk');
    expect(pose.holding).toBe(false);
    expect(pose.event?.name).toBe('launch_to_hook');
    expect(pose.event!.ms).toBeGreaterThan(0);
    while (now(s) !== 'place') sceneTick(data, s);
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: null });
    idle(s);
    expect(s.held).toEqual({});
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: null });
  });

  it('캐릭터 연출은 다른 대상의 연출 동안에도 붙들고, 물건 anim은 붙들지 않고, 같은 캐릭터의 다음 연출이 놓게 한다', () => {
    const s = stompWithJjuk();
    s.held.jjuk = { name: 'common.zap', ms: 500 }; // 앞에서 남은 연출이 있다고 치자
    while (!animOn(s, 'seesaw_right')) sceneTick(data, s);
    expect(charPose(data, s, 'mukjik').event?.name).toBe('common.stomp');
    while (!animOn(s, 'jjuk')) sceneTick(data, s);
    expect(s.held.jjuk).toBeUndefined();
    while (now(s) !== 'say') sceneTick(data, s);
    expect(Object.keys(s.held).sort()).toEqual(['jjuk', 'mukjik']);
    expect(s.held.jjuk?.name).toBe('launch_to_hook');
  });

  it('둥지 뻗기: 매달린 채 reach_hang_up 마지막 장 + 대상 점(reachPoint)을 말풍선 동안 유지, 바닥에 떨어지면 놓는다', () => {
    const s = ready();
    const hook = data.screen.spots.hook!;
    s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, jjuk: 'hook' }, flags: { ...s.puzzle.flags, 'magpie.on_ground': true } };
    s.walkers.jjuk.x = hook.x;
    s.walkers.jjuk.y = hook.y;
    pick(s, 'jjuk');
    sceneTap(data, s, center(VERB_SLOTS.ability), 0, false);
    sceneTap(data, s, NEST, 0, false);
    const [rx, ry] = data.screen.hotspots.nest!.reachPoint!;
    while (now(s) !== 'say') sceneTick(data, s);
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: { name: 'reach_hang_up' }, reach: { x: rx, y: ry } });
    while (now(s) !== 'release' && now(s) !== 'place') sceneTick(data, s);
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: false, event: null });
  });

  it('reachPoint가 없는 대상에 행동하면 대상 점을 지운다', () => {
    const s = ready();
    s.reach.jjuk = { x: 1, y: 2 };
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    expect(charPose(data, s, 'jjuk').reach).toBeNull();
  });
});

describe('매달린 캐릭터의 클릭 상자는 그리는 방향을 따른다 (#186)', () => {
  const meta = parseSpriteMeta(jjukJson);
  const withSheet: SceneData = { ...data, sprites: { jjuk: meta } };
  /** 오른쪽을 보며 고리에 놓인 쭉이(걸어온 방향 = 오른쪽, 시트 hold.facing = 왼쪽). */
  function hangingFacingRight(d: SceneData): SceneState {
    const s = createScene(d);
    idle(s);
    const hook = d.screen.spots.hook!;
    s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, jjuk: 'hook' } };
    s.walkers.jjuk.x = hook.x;
    s.walkers.jjuk.y = hook.y;
    s.walkers.jjuk.facing = 1;
    return s;
  }

  it('시트가 있으면 hold.facing(왼쪽)으로 상자를 만들고, 매달린 그림의 hit 열 범위와 같다(#203)', () => {
    expect(meta.anims.hold?.facing).toBe(-1);
    const s = hangingFacingRight(withSheet);
    expect(charFacing(withSheet, s, 'jjuk')).toBe(-1);
    const w = s.walkers.jjuk;
    const box = spriteBox(meta, w.x, w.y, -1);
    const [hx, hy, hw, hh] = meta.anims.hold!.hit!;
    // 왼쪽을 보면 칸을 뒤집으니 hit 열 [hx, hx+hw)는 칸 안 [cw-hx-hw, cw-hx)로 간다.
    const left = box.left + (meta.cell[0] - hx - hw);
    expect(bodies(withSheet, s).jjuk).toEqual({ left, top: box.top + hy, width: hw, height: hh });
    expect(tapContext(withSheet, s).bodies.jjuk).toEqual(bodies(withSheet, s).jjuk);
    expect(sceneLayout(withSheet, s).chars.jjuk).toEqual(bodies(withSheet, s).jjuk);
  });

  it('시트가 없으면 실루엣이라 걷는 방향 그대로다', () => {
    const s = hangingFacingRight(data);
    expect(charFacing(data, s, 'jjuk')).toBe(1);
  });

  it('바닥에 선 캐릭터는 시트가 있어도 걷는 방향이다', () => {
    const s = createScene(withSheet);
    idle(s);
    s.walkers.jjuk.facing = 1;
    expect(charFacing(withSheet, s, 'jjuk')).toBe(1);
    s.walkers.jjuk.facing = -1;
    expect(charFacing(withSheet, s, 'jjuk')).toBe(-1);
  });
});

describe('매달린 자세는 그 자세 그림 상자로 클릭한다 (#203)', () => {
  const ppik = parseSpriteMeta(ppikJson);
  const withSheet: SceneData = { ...data, sprites: { ppik } };
  /** 후드로 고리에 매달린 삑삑이. 조작은 쭉이(삑삑이는 매달려 있어도 대상으로 들어온다). */
  function hangingPpik(d: SceneData): SceneState {
    const s = createScene(d);
    idle(s);
    const hook = d.screen.spots.hook!;
    s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, ppik: 'hook' } };
    s.walkers.ppik.x = hook.x;
    s.walkers.ppik.y = hook.y;
    s.ui.active = 'jjuk';
    return s;
  }
  const hitAt = (d: SceneData, s: SceneState, p: Point): string | undefined => hitTest(worldTargets(tapContext(d, s), s.ui), p, 0)?.id;

  it('클릭 상자가 매달린 그림(hold 모든 칸 합집합)과 같다', () => {
    const s = hangingPpik(withSheet);
    const hook = data.screen.spots.hook!;
    const box = spriteBox(ppik, hook.x, hook.y, -1);
    const [hx, hy, hw, hh] = ppik.anims.hold!.hit!;
    expect(bodies(withSheet, s).ppik).toEqual({ left: box.left + (ppik.cell[0] - hx - hw), top: box.top + hy, width: hw, height: hh });
  });

  it('머리(서 있기 상자 위, 고리 상자 안)를 누르면 고리가 아니라 삑삑이가 잡힌다', () => {
    const s = hangingPpik(withSheet);
    const body = bodies(withSheet, s).ppik;
    const standing = bodies(data, hangingPpik(data)).ppik;
    const head: Point = { x: body.left + body.width / 2, y: body.top + 2 };
    expect(head.y).toBeLessThan(standing.top); // 예전 상자로는 밖이었다
    expect(hitAt(withSheet, s, head)).toBe('char:ppik');
    expect(hitAt(data, hangingPpik(data), head)).toBe('spot:hook'); // 실루엣(시트 없음)은 예전 그대로
  });

  it('고리 상자 맨 위는 여전히 고리다(매달린 사람 머리 위)', () => {
    const s = hangingPpik(withSheet);
    expect(hitAt(withSheet, s, { x: HOOK.x, y: 85 })).toBe('spot:hook');
  });

  it('바닥에 서면 서 있기 상자로 돌아온다', () => {
    const s = createScene(withSheet);
    idle(s);
    const w = s.walkers.ppik;
    expect(bodies(withSheet, s).ppik).toEqual(bodies(data, s).ppik);
    expect(w.y).toBeGreaterThan(160);
  });
});

describe('칸 신호: show의 fx를 연출 칸에 맞춰 띄운다 (#199, 형식 기록 5-2절)', () => {
  const ppik = parseSpriteMeta(ppikJson);
  const withSheet: SceneData = { ...data, sprites: { ppik } };
  const SQUEEZE = 'common.squeeze_chicken';
  /** 까치 삑 정답(magpie_squeak_down) show 그대로. */
  function squeakShow(d: SceneData): SceneState {
    const s = createScene(d);
    while (isBusy(s)) sceneTick(d, s);
    s.queue.push(
      { type: 'anim', target: 'ppik', name: SQUEEZE },
      { type: 'fx', effect: 'squeak_text', target: 'ppik' },
      { type: 'anim', target: 'magpie', name: 'fly_down' },
      { type: 'say', speaker: 'ppik', text: 'magpie_nest.squeak_down' },
    );
    return s;
  }
  /** fx가 처음 뜨는 틱까지 돌린다. 그때의 장면을 돌려준다. */
  function untilFx(d: SceneData, s: SceneState, effect: string): void {
    for (let i = 0; i < 2000; i++) {
      sceneTick(d, s);
      if (activeFx(s).some((f) => f.effect === effect)) return;
    }
    throw new Error(`${effect}가 안 떴다`);
  }

  it('삑삑이 시트의 squeeze_chicken은 1번(꽉!) 칸에 신호가 있다', () => {
    expect(ppik.anims[SQUEEZE]).toMatchObject({ cue: 1 });
  });

  it('"삑!"은 꽉! 칸이 시작될 때 뜨고, 흐익 칸보다 먼저다', () => {
    const s = squeakShow(withSheet);
    untilFx(withSheet, s, 'squeak_text');
    // 아직 삑삑이 연출 중이고, 그리는 칸은 1번(꽉!)이다. 0번 200ms = 12틱 뒤.
    expect(s.current?.ev).toMatchObject({ type: 'anim', target: 'ppik', name: SQUEEZE });
    expect(s.current?.t).toBe(12);
    const frames = ppik.anims[SQUEEZE]!.frames;
    expect(spriteFrame(ppik, charPose(withSheet, s, 'ppik'))).toBe(frames[1]);
    // 흐익(2번) 칸이 시작될 때 "삑!"은 이미 떠 있다(30틱 중 21틱째).
    while (spriteFrame(ppik, charPose(withSheet, s, 'ppik')) !== frames[2]) sceneTick(withSheet, s);
    expect(activeFx(s)).toEqual([{ effect: 'squeak_text', target: 'ppik', t: 21 }]);
  });

  it('겹쳐 뜬 fx는 대기열에서 빠지고, 다음 이벤트(까치 연출)는 삑삑이 연출이 끝나자마자 시작한다', () => {
    const s = squeakShow(withSheet);
    untilFx(withSheet, s, 'squeak_text');
    expect(s.queue.map((e) => e.type)).toEqual(['anim', 'say']);
    while (s.current?.ev.type !== 'anim' || s.current.ev.target !== 'magpie') sceneTick(withSheet, s);
    // 삑삑이 연출 1000ms = 60틱 뒤 바로. fx(30틱)는 그 전에 끝났다.
    expect(s.current.t).toBe(0);
    expect(activeFx(s)).toEqual([]);
    expect(s.overlays).toEqual([]);
  });

  it('신호는 연출 바로 뒤 fx 하나만 띄우고, 그 뒤 fx는 연출이 끝난 뒤 차례로 뜬다(둥지 삑 메아리, ADR-0003)', () => {
    const s = createScene(withSheet);
    while (isBusy(s)) sceneTick(withSheet, s);
    s.queue.push(
      { type: 'anim', target: 'ppik', name: SQUEEZE },
      { type: 'fx', effect: 'squeak_text', target: 'nest' },
      { type: 'fx', effect: 'small_squeak_text', target: 'ppik' },
      { type: 'say', speaker: 'ppik', text: 'x' },
    );
    untilFx(withSheet, s, 'squeak_text');
    // 꽉! 칸(12틱): 원래 삑만 뜬다. 메아리는 아직 대기열에 있다.
    expect(s.current?.t).toBe(12);
    expect(activeFx(s).map((f) => f.effect)).toEqual(['squeak_text']);
    expect(s.queue.map((e) => e.type)).toEqual(['fx', 'say']);
    // 연출이 끝나면(1000ms = 60틱) 메아리가 차례로 뜬다. 원래 삑(30틱)은 이미 내려갔다.
    while (s.current?.ev.type !== 'fx') sceneTick(withSheet, s);
    expect(activeFx(s).map((f) => f.effect)).toEqual(['small_squeak_text']);
    expect(s.overlays).toEqual([]);
    expect(s.queue.map((e) => e.type)).toEqual(['say']);
  });

  it('연출 바로 뒤가 fx가 아니면 신호는 아무것도 띄우지 않는다', () => {
    const s = createScene(withSheet);
    while (isBusy(s)) sceneTick(withSheet, s);
    s.queue.push(
      { type: 'anim', target: 'ppik', name: SQUEEZE },
      { type: 'say', speaker: 'ppik', text: 'x' },
      { type: 'fx', effect: 'later', target: 'ppik' },
    );
    sceneTick(withSheet, s);
    while (s.current?.ev.type === 'anim' && s.current.t <= 12) sceneTick(withSheet, s);
    expect(s.overlays).toEqual([]);
    expect(s.queue.map((e) => e.type)).toEqual(['say', 'fx']);
  });

  it('fx 순번(seq)은 대기열 순서 그대로다', () => {
    const s = squeakShow(withSheet);
    const first = s.started;
    untilFx(withSheet, s, 'squeak_text');
    expect(s.current?.seq).toBe(first);
    expect(s.overlays[0]?.seq).toBe(first + 1);
    while (s.current?.ev.type !== 'anim' || s.current.ev.target !== 'magpie') sceneTick(withSheet, s);
    expect(s.current.seq).toBe(first + 2);
  });

  it('겹쳐 뜬 fx가 남아 있는 동안은 busy이고 탭을 받지 않는다(연출이 마지막 이벤트일 때)', () => {
    const meta = parseSpriteMeta({ ...ppikJson, anims: { ...ppik.anims, [SQUEEZE]: { frames: [8, 9, 10], ms: [50, 50, 50], cue: 2 } } });
    const d: SceneData = { ...data, sprites: { ppik: meta } };
    const s = createScene(d);
    while (isBusy(s)) sceneTick(d, s);
    s.queue.push({ type: 'anim', target: 'ppik', name: SQUEEZE }, { type: 'fx', effect: 'squeak_text', target: 'ppik' });
    untilFx(d, s, 'squeak_text');
    while (s.current !== null) sceneTick(d, s);
    expect(s.queue).toEqual([]);
    expect(isBusy(s)).toBe(true);
    expect(sceneTap(d, s, SEESAW_LEFT, 0, false)).toEqual({ kind: 'ignored' });
    // 마지막 장 유지도 fx가 끝날 때까지 남는다.
    expect(s.held.ppik).toMatchObject({ name: SQUEEZE });
    while (isBusy(s)) sceneTick(d, s);
    expect(activeFx(s)).toEqual([]);
    sceneTick(d, s);
    expect(s.held).toEqual({});
  });

  it('신호 없는 시트·실루엣이면 지금처럼 연출이 끝난 뒤 fx가 차례로 뜬다', () => {
    for (const d of [data, { ...data, sprites: { ppik: parseSpriteMeta({ ...ppikJson, anims: { ...ppik.anims, [SQUEEZE]: { frames: [8, 9, 10], ms: [200, 350, 450] } } }) } }]) {
      const s = squeakShow(d);
      untilFx(d, s, 'squeak_text');
      expect(s.current?.ev).toMatchObject({ type: 'fx', effect: 'squeak_text' });
      expect(s.overlays).toEqual([]);
    }
  });
});
