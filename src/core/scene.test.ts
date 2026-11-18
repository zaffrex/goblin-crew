import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { hitTest, type HitBox } from './hit';
import { CHAR_SLOTS, GAUGE_BAND, GAUGE_SEGS, HUD_AREA } from './hud';
import { worldTargets } from './interact';
import { seenSayKey } from './sayText';
import { parseSpriteMeta, spriteBox, spriteFrame } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { activeFx, activeMarkerVisible, approachPoint, bodies, charFacing, charPose, createScene, currentBubble, currentCut, drawOrder, gaugeBeforeSay, gaugeDrop, isBusy, runAction, sceneLayout, sceneTap, sceneTick, tapContext, TIMING, type SceneData, type SceneState } from './scene';
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

/** 지금 뜬 말풍선의 본 대사 표 키(화자 + 글 ID, #304). */
function bubbleKey(s: SceneState): string {
  const b = currentBubble(s);
  if (!b) throw new Error('말풍선 없음');
  return seenSayKey(b.speaker, b.text);
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
  it('반응 재생 중에는 월드 탭 전환·행동을 받지 않는다(줄도 안 세움)', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false); // 쭉이 뻗기: 둥지 → 높이가 모자라
    expect(isBusy(s)).toBe(true);
    const before = JSON.stringify(s.puzzle);
    expect(sceneTap(data, s, center(bodies(data, s).ppik), 0, false).kind).toBe('ignored');
    expect(sceneTap(data, s, SEESAW_LEFT, 0, false).kind).toBe('ignored');
    expect(s.ui.active).toBe('jjuk');
    idle(s);
    expect(JSON.stringify(s.puzzle)).toBe(before);
  });

  it('말풍선은 1.0초 전에는 안 넘어가고, 그 뒤 탭 한 번에 그 말풍선만 끝난다', () => {
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

  it('말풍선은 예전 0.4초(클리어 컷 가드)에는 아직 안 넘어간다(#284 최소 1.0초)', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false);
    untilSay(s);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('ignored');
    expect(currentBubble(s)).not.toBeNull();
  });

  it('최소 표시 시간은 1.0초이고, 가장 짧은 대사 길이(sayBase)를 넘지 않는다', () => {
    expect(TIMING.saySkipAfter).toBe(60);
    expect(TIMING.saySkipAfter).toBeLessThanOrEqual(TIMING.sayBase);
    expect(TIMING.clearSkipAfter).toBe(24);
  });

  /** 둥지를 계속 눌러 같은 글이 다시 뜰 때까지 돌린다. 매번 끝까지 띄운다(idle). 처음 본 글은 0.4초에 아직 안 넘어가는지도 본다. */
  function nestUntilRepeat(s: SceneState): string {
    const seen = new Set<string>();
    for (let n = 0; n < 10; n++) {
      sceneTap(data, s, NEST, 0, false);
      untilSay(s);
      const text = bubbleKey(s);
      if (seen.has(text)) return text;
      for (let i = 0; i < TIMING.seenSaySkipAfter; i++) sceneTick(data, s);
      // 처음 보는 글(변형 `*_again` 포함)은 다른 글 ID라 1.0초 규칙이다.
      expect(sceneTap(data, s, NEST, 0, false).kind).toBe('ignored');
      seen.add(text);
      idle(s);
    }
    throw new Error('같은 글이 다시 안 떴다');
  }

  it('이미 끝까지 본 말풍선은 0.4초(23틱 ignored → 24틱 skipSay)에 넘어간다(ability-feedback.md 6절, #289)', () => {
    const s = ready();
    const text = nestUntilRepeat(s);
    expect(s.seenSay[text]).toBe(true);
    for (let i = 0; i < TIMING.seenSaySkipAfter - 1; i++) sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('ignored');
    sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('skipSay');
    sceneTick(data, s);
    expect(currentBubble(s)).toBeNull();
  });

  it('탭으로 넘긴 말풍선도 본 것으로 친다(넘기기는 1.0초 뒤에만 되니 적어도 1.0초 보였다)', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false);
    untilSay(s);
    const text = bubbleKey(s);
    expect(s.seenSay[text]).toBeUndefined();
    for (let i = 0; i < TIMING.saySkipAfter; i++) sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('skipSay');
    sceneTick(data, s);
    expect(s.seenSay[text]).toBe(true);
  });

  it('같은 글 ID라도 다른 화자가 본 줄이면 처음 보는 대사다(화자별 변형 글, #304)', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false);
    untilSay(s);
    const b = currentBubble(s)!;
    const other = b.speaker === 'ppik' ? 'jjuk' : 'ppik';
    s.seenSay[seenSayKey(other, b.text)] = true;
    for (let i = 0; i < TIMING.seenSaySkipAfter; i++) sceneTick(data, s);
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('ignored');
    s.seenSay[seenSayKey(b.speaker, b.text)] = true;
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('skipSay');
  });

    it('새 판(createScene)은 본 대사가 비어 있다', () => {
    expect(createScene(data).seenSay).toEqual({});
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

describe('busy 중 HUD 칸 탭 (설계 5절 예외 셋, #266)', () => {
  /** 이벤트 진행 상태 스냅숏: 탭이 연출을 건드리지 않았는지 본다. */
  const playback = (s: SceneState): string => JSON.stringify({ tick: s.tick, current: s.current, queue: s.queue, overlays: s.overlays, walkers: s.walkers, puzzle: s.puzzle });

  it('onEnter 첫 틱(말풍선 전)에 얼굴 탭: 바로 전환되고 연출은 그대로다', () => {
    const s = createScene(data);
    expect(isBusy(s)).toBe(true);
    const before = playback(s);
    const r = sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    expect(r).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'ppik' } });
    expect(s.ui.active).toBe('ppik');
    expect(playback(s)).toBe(before);
    // 터치도 첫 탭에 바로(HUD는 2번 탭 규칙이 없다).
    expect(sceneTap(data, s, center(CHAR_SLOTS.mukjik), 8, true)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'mukjik' } });
    expect(s.ui.active).toBe('mukjik');
    expect(untilSay(s)).toBe('magpie_nest.enter');
  });

  it('말풍선 1.0초 전·후 HUD 탭은 말풍선을 넘기지 않는다. 같은 때 월드 탭은 지금처럼 skipSay', () => {
    const s = createScene(data);
    untilSay(s);
    expect(sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false).kind).toBe('intent');
    for (let i = 0; i < TIMING.saySkipAfter; i++) sceneTick(data, s);
    const before = playback(s);
    expect(sceneTap(data, s, center(CHAR_SLOTS.mukjik), 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'mukjik' } });
    expect(sceneTap(data, s, center(CHAR_SLOTS.jjuk), 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'jjuk' } });
    expect(playback(s)).toBe(before);
    expect(currentBubble(s)?.text).toBe('magpie_nest.enter');
    expect(sceneTap(data, s, NEST, 0, false).kind).toBe('skipSay');
    sceneTick(data, s);
    expect(currentBubble(s)).toBeNull();
  });

  it('자동 걷기 중 HUD 탭은 걷기를 건너뛰지 않는다', () => {
    const s = ready();
    sceneTap(data, s, SEESAW_LEFT, 0, false); // 쭉이 올라서기
    sceneTick(data, s);
    expect(s.current?.ev.type).toBe('walk');
    const before = playback(s);
    expect(sceneTap(data, s, center(CHAR_SLOTS.mukjik), 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'mukjik' } });
    expect(playback(s)).toBe(before);
    expect(s.current?.ev.type).toBe('walk');
    idle(s);
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([220, 214]);
  });

  it('busy 중 내 얼굴 탭은 아무 일 없음', () => {
    const s = createScene(data);
    expect(sceneTap(data, s, center(CHAR_SLOTS.jjuk), 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'none' } });
    expect(s.ui.active).toBe('jjuk');
  });

  it('busy 중 게이지·HUD 빈 띠 탭은 무시한다(말풍선도 안 넘긴다)', () => {
    const s = createScene(data);
    untilSay(s);
    for (let i = 0; i < TIMING.saySkipAfter; i++) sceneTick(data, s);
    const blank = { x: HUD_AREA.left + 14, y: HUD_AREA.top + HUD_AREA.height - 4 }; // 얼굴 아래 특기 이름표 띠(6-4-2절)
    expect(Object.values(sceneLayout(data, s).hud).some((b) => hitTest([{ id: 'b', box: b, z: 0 }], blank, 0))).toBe(false);
    const before = JSON.stringify(s);
    expect(sceneTap(data, s, center(GAUGE_SEGS[2]!), 0, false).kind).toBe('ignored');
    expect(sceneTap(data, s, blank, 0, false).kind).toBe('ignored');
    expect(JSON.stringify(s)).toBe(before);
    expect(currentBubble(s)?.text).toBe('magpie_nest.enter');
    // 띠 왼쪽 이름표 자리, 띠 맨 윗줄, 얼굴 칸 사이 틈도 같다(6-3-5절·6-4-2절).
    for (const p of [{ x: 20, y: 263 }, { x: 240, y: GAUGE_BAND.top }, { x: 330, y: 18 }]) expect(sceneTap(data, s, p, 0, false).kind).toBe('ignored');
    expect(JSON.stringify(s)).toBe(before);
    // 옛 게이지 자리(x 401–479)는 이제 하늘이라 월드 탭이다(6-4-2절): 말풍선을 넘긴다.
    for (let i = 0; i < TIMING.saySkipAfter; i++) sceneTick(data, s);
    expect(sceneTap(data, s, { x: 440, y: 18 }, 0, false).kind).toBe('skipSay');
  });

  it('busy가 아닐 때 게이지 띠 탭은 걷지 않는다, 띠 바로 위 잔디는 252로 붙어 걷는다(#312)', () => {
    const s = ready();
    const before = JSON.stringify(s);
    for (const p of [{ x: 20, y: 263 }, { x: 240, y: 256 }, { x: 240, y: 269 }]) {
      expect(sceneTap(data, s, p, 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'none' } });
    }
    expect(JSON.stringify(s)).toBe(before);
    const r = sceneTap(data, s, { x: 240, y: 255 }, 0, false);
    expect(r).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    expect(s.walkers.jjuk.target?.y).toBe(252);
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

  it('みる는 대상별 폴백이어도 힌트 ② 횟수에 안 들어간다(#286)', () => {
    const s = ready();
    const seen: string[][] = [];
    // UI로는 みる를 못 낸다(6-4-4절). 데이터·힌트 규칙은 남아 있으니 행동을 직접 넣는다.
    runAction(data, s, { char: 'jjuk', verb: 'look', target: 'magpie' }, null); // 쭉이 みる: 까치 → 대상별 폴백 ①
    seen.push(sayTexts(s));
    for (let i = 0; i < 2; i++) {
      sceneTap(data, s, MAGPIE, 0, false); // 쭉이 뻗기: 까치 → 폴백
      seen.push(sayTexts(s));
    }
    expect(seen[0]).toEqual(['magpie_nest.look.magpie']);
    expect(seen[1]).toEqual(['magpie_nest.magpie_high_five']); // みる를 셌다면 여기서 힌트가 붙는다
    expect(seen[2]).toEqual(['magpie_nest.magpie_high_five', 'char.jjuk.hint_squeak']);
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
    sceneTap(data, s, SEESAW_RIGHT, 0, false); // 올라섬
    idle(s);
    sceneTap(data, s, SEESAW_RIGHT, 0, false); // 한 번 더 = 쿵(6-4-1절)
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
    sceneTap(data, s, SEESAW_LEFT, 0, false); // 올라섬
    idle(s);
    sceneTap(data, s, SEESAW_LEFT, 0, false); // 한 번 더 = 쿵
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
    sceneTap(data, s, MAGPIE, 0, false); // 삑삑이 꽥: 까치가 바닥으로
    idle(s);
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    expect(s.puzzle.at.jjuk).toBe('seesaw_left');
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
    sceneTap(data, s, center({ left: ground[0], top: ground[1], width: ground[2], height: ground[3] }), 0, false); // 규칙 7: 쪼임 → 0
    idle(s);
    expect(s.puzzle.gauge).toBe(5);
    expect(s.puzzle.at.jjuk).toBe('floor');
    expect(at(s, 'jjuk')).toEqual({ x: data.screen.spots.seesaw_left!.x, y: data.screen.spots.floor!.y });
  });

  /** 까치를 바닥에 내리고 쭉이를 왼쪽 시소 끝에 올린 뒤, 게이지 1에서 바닥 까치를 뻗게 한다(규칙 7 → 기절). */
  function peckFromSeesaw(s: SceneState): void {
    pick(s, 'ppik');
    sceneTap(data, s, MAGPIE, 0, false);
    idle(s);
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    s.puzzle.gauge = 1;
    s.shownGauge = 1;
    const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
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

describe('클리어 컷 L32 (magpie_nest.md 8절, #68)', () => {
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
    for (let i = 0; i < TIMING.clearSkipAfter - 1; i++) sceneTick(withLine, s);
    expect(sceneTap(withLine, s, SEESAW_LEFT, 0, false).kind).toBe('ignored');
    sceneTick(withLine, s);
    expect(sceneTap(withLine, s, SEESAW_LEFT, 0, false).kind).toBe('skipSay');
    sceneTick(withLine, s);
    expect(isBusy(s)).toBe(false);
    expect(currentCut(s)).toBeNull();
    expect(sceneTap(withLine, s, SEESAW_LEFT, 0, false).kind).toBe('ignored');
  });

  it('클리어 컷 중·클리어 뒤 HUD 탭은 전환·무장을 하지 않는다(#266 규칙 5)', () => {
    const s = clearNow(withLine);
    while (s.current?.ev.type !== 'clear') sceneTick(withLine, s);
    const ui = JSON.stringify(s.ui);
    expect(sceneTap(withLine, s, center(CHAR_SLOTS.ppik), 0, false).kind).toBe('ignored');
    expect(JSON.stringify(s.ui)).toBe(ui);
    while (isBusy(s)) sceneTick(withLine, s);
    expect(sceneTap(withLine, s, center(CHAR_SLOTS.ppik), 0, false).kind).toBe('ignored');
    expect(JSON.stringify(s.ui)).toBe(ui);
  });

  it('클리어 컷 0.4초 뒤 HUD 칸 탭은 컷을 넘긴다(skipSay). 전환·무장은 하지 않는다(#266 규칙 5, PR #273)', () => {
    const s = clearNow(withLine);
    while (s.current?.ev.type !== 'clear') sceneTick(withLine, s);
    const ui = JSON.stringify(s.ui);
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(withLine, s);
    // 클리어 컷 분기가 busy HUD 분기보다 먼저다. 순서가 바뀌면 이 탭이 전환이 되고 컷이 안 넘어간다.
    expect(sceneTap(withLine, s, center(CHAR_SLOTS.ppik), 0, false).kind).toBe('skipSay');
    expect(JSON.stringify(s.ui)).toBe(ui);
    sceneTick(withLine, s);
    expect(isBusy(s)).toBe(false);
    expect(currentCut(s)).toBeNull();
  });

  it('클리어 컷 0.4초 뒤 HUD 띠의 칸 아닌 곳(게이지) 탭도 컷을 넘긴다(#266 규칙 5 "아무 탭", PR #276 리뷰)', () => {
    const s = clearNow(withLine);
    while (s.current?.ev.type !== 'clear') sceneTick(withLine, s);
    const ui = JSON.stringify(s.ui);
    // busy 중 HUD 띠 빈 곳 무시(5절)는 클리어 컷 분기 뒤에 와야 한다. 순서가 바뀌면 이 탭이 ignored가 된다.
    expect(sceneTap(withLine, s, center(GAUGE_SEGS[2]!), 0, false).kind).toBe('ignored');
    for (let i = 0; i < TIMING.clearSkipAfter; i++) sceneTick(withLine, s);
    expect(sceneTap(withLine, s, center(GAUGE_SEGS[2]!), 0, false).kind).toBe('skipSay');
    expect(JSON.stringify(s.ui)).toBe(ui);
    sceneTick(withLine, s);
    expect(isBusy(s)).toBe(false);
    expect(currentCut(s)).toBeNull();
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
    sceneTap(data, s, SEESAW_RIGHT, 0, false); // 올라섬
    idle(s);
    sceneTap(data, s, SEESAW_RIGHT, 0, false); // 한 번 더 = 쿵
    return s;
  }

  it('발사 연출 마지막 장 뒤 효과 위치 표시에서 고리에 놓이고, 말풍선은 매달린 채 고리에서 뜬다(#339, ADR-0065 5절)', () => {
    const s = stompWithJjuk();
    while (!(s.current?.ev.type === 'anim' && s.current.ev.name === 'launch_to_hook')) sceneTick(data, s);
    // 퍼즐 상태는 이미 고리지만 몸은 아직 시소다 → 매달림이 아니다(방향 고정 없음).
    expect(s.puzzle.at.jjuk).toBe('hook');
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: false, event: { name: 'launch_to_hook', ms: 0 } });
    const seesaw = data.screen.spots.seesaw_left!;
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([seesaw.x, seesaw.y]);
    // 표시 `{ do: "here" }`가 발사 장과 말풍선 사이라서 놓임이 말풍선보다 먼저다.
    while (now(s) !== 'place' && now(s) !== 'say') sceneTick(data, s);
    expect(now(s)).toBe('place');
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: null });
    while (now(s) !== 'say') sceneTick(data, s);
    const hook = data.screen.spots.hook!;
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([hook.x, hook.y]);
    expect(currentBubble(s)?.speaker).toBe('jjuk');
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: null });
    idle(s);
    expect(s.held).toEqual({});
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: null });
  });

  it('캐릭터 연출은 다른 대상의 연출 동안에도 붙들고, 물건 anim은 붙들지 않고, 같은 캐릭터의 다음 연출·놓임이 놓게 한다', () => {
    const s = stompWithJjuk();
    s.held.jjuk = { name: 'common.zap', ms: 500 }; // 앞에서 남은 연출이 있다고 치자
    while (!animOn(s, 'seesaw_right')) sceneTick(data, s);
    expect(charPose(data, s, 'mukjik').event?.name).toBe('common.stomp');
    while (!animOn(s, 'jjuk')) sceneTick(data, s);
    expect(s.held.jjuk).toBeUndefined();
    expect(Object.keys(s.held)).toEqual(['mukjik']);
    // 쭉이 발사 장은 끝나면 붙들지만 바로 뒤 place(표시 자리)가 놓는다. 묵직이 쿵은 말풍선까지 붙든다.
    while (now(s) !== 'say') sceneTick(data, s);
    expect(Object.keys(s.held)).toEqual(['mukjik']);
    expect(s.held.mukjik?.name).toBe('common.stomp');
  });

  it('둥지 뻗기: 매달린 채 reach_hang_up 마지막 장 + 대상 점(reachPoint)을 말풍선 동안 유지, 바닥에 떨어지면 놓는다', () => {
    const s = ready();
    const hook = data.screen.spots.hook!;
    s.puzzle = { ...s.puzzle, at: { ...s.puzzle.at, jjuk: 'hook' }, flags: { ...s.puzzle.flags, 'magpie.on_ground': true } };
    s.walkers.jjuk.x = hook.x;
    s.walkers.jjuk.y = hook.y;
    pick(s, 'jjuk');
    sceneTap(data, s, NEST, 0, false);
    const [rx, ry] = data.screen.hotspots.nest!.reachPoint!;
    while (now(s) !== 'say') sceneTick(data, s);
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: true, event: { name: 'reach_hang_up' }, reach: { x: rx, y: ry } });
    while (now(s) !== 'release' && now(s) !== 'place') sceneTick(data, s);
    expect(charPose(data, s, 'jjuk')).toMatchObject({ holding: false, event: null });
  });

  it('reachPoint가 없는 대상이면 대상 상자 아래 끝 가운데가 대상 점이다(#284: 바닥에서 고리 뻗기 → 고리 바로 아래에서 멈춤)', () => {
    const s = ready();
    pick(s, 'jjuk');
    sceneTap(data, s, HOOK, 0, false);
    const [bx, by, bw, bh] = data.screen.spots.hook!.box!;
    expect(charPose(data, s, 'jjuk').reach).toEqual({ x: bx + bw / 2, y: by + bh });
    while (!animOn(s, 'jjuk')) sceneTick(data, s);
    expect(charPose(data, s, 'jjuk').event?.name).toBe('common.reach_wobble');
  });

  it('다음 행동이 이전 대상 점을 덮어쓴다(자리 이동이면 그 자리 상자 아래 끝)', () => {
    const s = ready();
    s.reach.jjuk = { x: 1, y: 2 };
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    const [bx, by, bw, bh] = data.screen.spots.seesaw_left!.box!;
    expect(charPose(data, s, 'jjuk').reach).toEqual({ x: bx + bw / 2, y: by + bh });
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

describe('특기 시그니처 fx: 신호 여러 개와 0.6초 (#284, ability-feedback.md 2·4절)', () => {
  const jjuk = parseSpriteMeta(jjukJson);
  const mukjik = parseSpriteMeta(mukjikJson);
  const d: SceneData = { ...data, sprites: { jjuk, mukjik } };
  const WOBBLE = 'common.reach_wobble';
  /** 큐에 넣고, 이벤트별로 처음 뜬 틱(연출 시작 기준)을 모은다. */
  function firstSeen(events: SceneState['queue'], watch: string): Record<string, number> {
    const s = createScene(d);
    while (isBusy(s)) sceneTick(d, s);
    s.queue.push(...events);
    const seen: Record<string, number> = {};
    let t0 = -1;
    for (let i = 0; i < 2000 && (i === 0 || isBusy(s)); i++) {
      sceneTick(d, s);
      if (t0 < 0 && s.current?.ev.type === 'anim' && s.current.ev.name === watch) t0 = s.tick;
      for (const f of activeFx(s)) if (seen[f.effect] === undefined) seen[f.effect] = s.tick - t0;
    }
    return seen;
  }

  it('고리 뻗기(규칙 9): 0번 칸에 ビヨーン, 장대가 멈추는 1번 칸(300ms = 18틱)에 キン이 둘 다 연출 중에 뜬다', () => {
    expect(jjuk.anims[WOBBLE]).toMatchObject({ cue: [0, 1] });
    const seen = firstSeen(
      [
        { type: 'anim', target: 'jjuk', name: WOBBLE },
        { type: 'fx', effect: 'stretch_text', target: 'jjuk' },
        { type: 'fx', effect: 'ting_text', target: 'hook' },
        { type: 'say', speaker: 'jjuk', text: 'x' },
      ],
      WOBBLE,
    );
    expect(seen).toEqual({ stretch_text: 0, ting_text: 18 });
  });

  it('이어진 fx가 신호보다 적으면 남는 신호는 아무것도 안 띄운다(둥지 뻗기: ビヨーン 하나)', () => {
    const s = createScene(d);
    while (isBusy(s)) sceneTick(d, s);
    s.queue.push(
      { type: 'anim', target: 'jjuk', name: WOBBLE },
      { type: 'fx', effect: 'stretch_text', target: 'jjuk' },
      { type: 'say', speaker: 'jjuk', text: 'x' },
    );
    while (!(s.current?.ev.type === 'anim' && s.current.t >= 18)) sceneTick(d, s);
    expect(s.overlays.map((o) => o.ev.type === 'fx' && o.ev.effect)).toEqual(['stretch_text']);
    expect(s.queue.map((e) => e.type)).toEqual(['say']);
  });

  it('쿵: ドスン은 2번 칸(400ms = 24틱)에 뜨고, 시그니처는 36틱 남는다. 연출이 끝나기 전에 내려간다', () => {
    expect(mukjik.anims['common.stomp']).toMatchObject({ cue: [2] });
    const s = createScene(d);
    while (isBusy(s)) sceneTick(d, s);
    s.queue.push({ type: 'anim', target: 'mukjik', name: 'common.stomp' }, { type: 'fx', effect: 'stomp_text', target: 'mukjik' }, { type: 'say', speaker: 'mukjik', text: 'x' });
    while (activeFx(s).length === 0) sceneTick(d, s);
    expect(s.current).toMatchObject({ ev: { name: 'common.stomp' }, t: 24 });
    let alive = 0;
    while (activeFx(s).length > 0) {
      alive += 1;
      sceneTick(d, s);
    }
    expect(alive).toBe(36);
    // 쿵 연출 1100ms = 66틱. 24 + 36 = 60틱에 글자가 내려가서 말풍선과 안 겹친다(4절 길이 확인).
    expect(s.current?.ev.type).toBe('anim');
  });
});

describe('대상 앞까지 걷기 (설계 5-1절, #219)', () => {
  const start = (): SceneState => createScene(data);
  const pick = (s: SceneState, c: 'jjuk' | 'mukjik' | 'ppik'): void => {
    sceneTap(data, s, center(CHAR_SLOTS[c]), 0, false);
  };
  /** 5-1절 "화면 1 적용 결과" 표. 발밑 x 400(묵직이 시작 위치, 오른쪽)에서 계산한다. */
  const standX = (s: SceneState, char: 'jjuk' | 'mukjik' | 'ppik', verb: 'stretch' | 'stomp' | 'hand', target: string, from = 400): number | undefined =>
    approachPoint(data, s.puzzle, { char, verb, target }, { x: from, y: 244 })?.x;

  it('표: 높은 대상은 reachPoint x 또는 상자 가운데 x 바로 아래', () => {
    const s = start();
    expect(standX(s, 'jjuk', 'stretch', 'nest')).toBe(150);
    expect(standX(s, 'jjuk', 'stretch', 'magpie')).toBe(146);
    expect(standX(s, 'jjuk', 'stretch', 'hook')).toBe(162);
    expect(standX(s, 'mukjik', 'stomp', 'magpie')).toBe(146);
    expect(standX(s, 'mukjik', 'stomp', 'nest')).toBe(146);
    for (const verb of ['stretch', 'stomp', 'hand'] as const) expect(standX(s, 'mukjik', verb, 'long_johns')).toBe(388);
  });

  it('표: 바닥 대상은 가까운 쪽 가장자리 옆, 대상을 본 몸 상자가 2px 떨어진다', () => {
    const s = start();
    const gapTo = (char: 'jjuk' | 'mukjik' | 'ppik', target: string, box: HitBox, from: number): number => {
      const ap = approachPoint(data, s.puzzle, { char, verb: 'stomp', target }, { x: from, y: 244 })!;
      s.walkers[char].x = ap.x;
      s.walkers[char].facing = ap.face!;
      const body = bodies(data, s)[char];
      return ap.face === -1 ? body.left - (box.left + box.width) : box.left - (body.left + body.width);
    };
    const right = { left: 250, top: 196, width: 38, height: 24 };
    const left = { left: 208, top: 196, width: 38, height: 24 };
    const basket = { left: 144, top: 212, width: 32, height: 24 };
    expect(gapTo('mukjik', 'seesaw_right', right, 400)).toBe(2); // 오른쪽에서 오면 오른쪽 끝 옆
    expect(standX(s, 'mukjik', 'stomp', 'seesaw_right')).toBe(307);
    expect(gapTo('mukjik', 'seesaw_left', left, 100)).toBe(2); // 왼쪽에서 오면 왼쪽 끝 옆
    expect(gapTo('jjuk', 'basket', basket, 400)).toBe(2);
    expect(gapTo('ppik', 'basket', basket, 20)).toBe(2);
  });

  it('바닥의 까치는 variants 상자(88,212)로 바닥 대상이 된다', () => {
    const s = start();
    s.puzzle = { ...s.puzzle, flags: { ...s.puzzle.flags, 'magpie.on_ground': true } };
    const ap = approachPoint(data, s.puzzle, { char: 'mukjik', verb: 'hand', target: 'magpie' }, { x: 400, y: 244 })!;
    expect(ap).toEqual({ x: 88 + 24 + 2 + 17, face: -1 });
  });

  it('바닥 대상에 stretch는 가까운 쪽 가장자리 옆(규칙 7 땅의 까치, 바구니). 대상 위에 겹쳐 서지 않는다', () => {
    const s = start();
    s.puzzle = { ...s.puzzle, flags: { ...s.puzzle.flags, 'magpie.on_ground': true } };
    const ap = (target: string, from: number) => approachPoint(data, s.puzzle, { char: 'jjuk', verb: 'stretch', target }, { x: from, y: 244 });
    expect(ap('magpie', 360)).toEqual({ x: 112 + 2 + 15, face: -1 });
    expect(ap('basket', 400)).toEqual({ x: 176 + 2 + 15, face: -1 });
    expect(ap('basket', 20)).toEqual({ x: 144 - 2 - 15, face: 1 });
  });

  it('원거리 동사와 바닥이 아닌 캐릭터는 걷지 않는다. squeak·look은 대상 쪽으로 돌아서기만 한다', () => {
    const s = start();
    expect(approachPoint(data, s.puzzle, { char: 'ppik', verb: 'squeak', target: 'magpie' }, { x: 440, y: 244 })).toEqual({ x: 440, face: -1 });
    expect(approachPoint(data, s.puzzle, { char: 'jjuk', verb: 'look', target: 'long_johns' }, { x: 360, y: 244 })).toEqual({ x: 360, face: 1 });
    expect(approachPoint(data, s.puzzle, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, { x: 360, y: 244 })).toBeNull();
    expect(approachPoint(data, s.puzzle, { char: 'jjuk', verb: 'hand', target: 'mukjik' }, { x: 360, y: 244 })).toBeNull(); // 캐릭터 대상: 상자 없음
    const onSeesaw = { ...s.puzzle, at: { ...s.puzzle.at, jjuk: 'seesaw_left' } };
    expect(approachPoint(data, onSeesaw, { char: 'jjuk', verb: 'stretch', target: 'nest' }, { x: 220, y: 214 })).toBeNull();
  });

  it('대상 approach가 그 동사에 stay면 걷지 않는다(화면 설계 우선)', () => {
    const nest = { ...data.screen.hotspots.nest!, approach: { stretch: 'stay' } };
    const d: SceneData = { ...data, screen: { ...data.screen, hotspots: { ...data.screen.hotspots, nest } } };
    const s = createScene(d);
    expect(approachPoint(d, s.puzzle, { char: 'jjuk', verb: 'stretch', target: 'nest' }, { x: 360, y: 244 })).toEqual({ x: 360, face: -1 });
    expect(approachPoint(d, s.puzzle, { char: 'jjuk', verb: 'stomp', target: 'nest' }, { x: 360, y: 244 })?.x).toBe(146);
  });

  it('규칙 8: 쭉이가 둥지 밑(150)까지 걸어가 둥지 쪽을 보고 "높이가 모자라!". 퍼즐 상태는 걷기와 무관하다', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false);
    expect(isBusy(s)).toBe(true);
    expect(s.queue[0]).toEqual({ type: 'walk', char: 'jjuk', from: 'floor', to: 'floor', face: -1 });
    expect(s.puzzle.at.jjuk).toBe('floor');
    expect(untilSay(s)).toBe('magpie_nest.nest_too_short');
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([150, 244]);
    expect(s.walkers.jjuk.facing).toBe(-1);
    idle(s);
    expect(s.walkers.jjuk.x).toBe(150); // 행동이 끝나도 돌아가지 않는다
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('걷는 중 탭은 걷기만 건너뛰고, 행동 연출은 그대로 이어진다(5절 예외 둘)', () => {
    const s = ready();
    sceneTap(data, s, NEST, 0, false);
    sceneTick(data, s);
    expect(s.current?.ev.type).toBe('walk');
    expect(sceneTap(data, s, MAGPIE, 0, false).kind).toBe('skipWalk');
    expect(s.walkers.jjuk.x).toBe(150);
    expect(untilSay(s)).toBe('magpie_nest.nest_too_short');
    expect(s.walkers.jjuk.facing).toBe(-1);
  });

  it('바닥에서 시소 끝에 쿵(UI로는 못 냄, 6-4-4절): 묵직이가 오른쪽 끝 옆(307)까지 걸어가서 쿵 → 쭉이가 고리로', () => {
    const s = ready();
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    pick(s, 'mukjik');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    expect(s.queue[0]).toMatchObject({ type: 'walk', char: 'mukjik', face: -1 });
    idle(s);
    expect(s.walkers.mukjik.x).toBe(307);
    expect(s.walkers.mukjik.facing).toBe(-1);
    expect(s.puzzle.at.jjuk).toBe('hook');
  });

  it('정답 3번(6-4-1절): 묵직이 오른쪽 끝에 올라선 뒤 한 번 더 = 쿵 → 쭉이가 고리로, 묵직이는 끝 자리에 선다', () => {
    const s = ready();
    pick(s, 'jjuk');
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    idle(s);
    pick(s, 'mukjik');
    expect(sceneTap(data, s, SEESAW_RIGHT, 0, false)).toMatchObject({ intent: { kind: 'act', action: { verb: 'move' } } });
    idle(s);
    expect(s.puzzle.at.mukjik).toBe('seesaw_right');
    expect(sceneTap(data, s, SEESAW_RIGHT, 0, false)).toMatchObject({ intent: { kind: 'act', action: { verb: 'stomp', target: 'seesaw_right' } } });
    idle(s);
    expect(s.puzzle.at.jjuk).toBe('hook');
  });

  it('이미 설 곳(±2px)이면 걷지 않고 방향만 대상 쪽으로 바꾼다', () => {
    const s = ready();
    s.walkers.jjuk.x = 151;
    s.walkers.jjuk.facing = 1;
    sceneTap(data, s, NEST, 0, false);
    expect(s.queue.some((e) => e.type === 'walk')).toBe(false);
    expect(s.walkers.jjuk.facing).toBe(-1);
    expect(s.walkers.jjuk.x).toBe(151);
  });

  it('삑삑이 꽥은 걷지 않고 돌아서기만 한다', () => {
    const s = ready();
    pick(s, 'ppik');
    expect(s.walkers.ppik.facing).toBe(1);
    sceneTap(data, s, MAGPIE, 0, false);
    expect(s.queue.some((e) => e.type === 'walk')).toBe(false);
    expect(s.walkers.ppik.facing).toBe(-1);
    idle(s);
    expect(s.walkers.ppik.x).toBe(440);
  });

  it('step이 다른 자리로 가는 walk로 시작하면 엔진 걷기를 더하지 않는다(시소 올라서기)', () => {
    const s = ready();
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    expect(s.queue.filter((e) => e.type === 'walk')).toEqual([{ type: 'walk', char: 'jjuk', from: 'floor', to: 'seesaw_left' }]);
  });
});

// #46 Luna 리뷰: 말풍선이 떠 있는 동안 ▼가 같이 그려지면 꼬리가 ▼를 가릴 수 있다. 구조적으로 안 겹치는지 본다.
describe('▼ 조작 표시와 말풍선', () => {
  it('말풍선이 떠 있는 틱에는 ▼를 그리지 않는다 (진입 짹 + 세 사람 폴백·힌트)', () => {
    const s = createScene(data);
    let bubbles = 0;
    const run = (): void => {
      for (let n = 0; n < 5000 && isBusy(s); n++) {
        if (currentBubble(s)) {
          bubbles++;
          expect(activeMarkerVisible(s)).toBe(false);
        }
        sceneTick(data, s);
      }
      expect(isBusy(s)).toBe(false);
      expect(currentBubble(s)).toBeNull();
      expect(activeMarkerVisible(s)).toBe(true);
    };
    run(); // onEnter 짹
    for (const who of ['jjuk', 'mukjik', 'ppik'] as const) {
      sceneTap(data, s, center(CHAR_SLOTS[who]), 0, false);
      run();
      for (const target of [NEST, HOOK, MAGPIE, NEST]) {
        sceneTap(data, s, target, 0, false);
        run();
      }
    }
    expect(bubbles).toBeGreaterThan(0);
  });
});

describe('게이지 감소 시점: 첫 say 바로 앞 (ui-interaction.md 6-2-5절, #285)', () => {
  const say = { type: 'say', speaker: 'mukjik', text: 'x' } as const;
  const anim = { type: 'anim', target: 'mukjik', name: 'flatten' } as const;
  const fx = { type: 'fx', effect: 'stars', target: 'mukjik' } as const;
  const drop = { type: 'gauge', delta: -1, value: 4 } as const;

  it('show(anim·fx·say) 다음 gauge → gauge를 첫 say 앞으로 당긴다', () => {
    expect(gaugeBeforeSay([anim, fx, say, say, drop])).toEqual([anim, fx, drop, say, say]);
  });

  it('say가 없거나 gauge가 이미 앞이거나 늘어나는 게이지면 그대로', () => {
    const noSay = [anim, fx, drop];
    expect(gaugeBeforeSay(noSay)).toBe(noSay);
    const already = [anim, drop, say];
    expect(gaugeBeforeSay(already)).toBe(already);
    const up = [anim, say, { type: 'gauge', delta: 1, value: 5 } as const];
    expect(gaugeBeforeSay(up)).toBe(up);
  });

  it('faint가 같이 오면 그대로(기절 연출은 따로)', () => {
    const fainting = [anim, say, { type: 'gauge', delta: -1, value: 0 } as const, { type: 'faint', to: {} } as never];
    expect(gaugeBeforeSay(fainting)).toBe(fainting);
  });

  it('실제 화면 1: 바닥 까치 뻗기(게이지 −1) — 칸이 말풍선보다 먼저 줄고, 그동안 gaugeDrop이 잃은 칸을 알려 준다', () => {
    const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
    const MAGPIE_GROUND = center({ left: ground[0], top: ground[1], width: ground[2], height: ground[3] });
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false);
    idle(s);
    sceneTap(data, s, center(CHAR_SLOTS.jjuk), 0, false);
    sceneTap(data, s, MAGPIE_GROUND, 0, false);
    expect(s.puzzle.gauge).toBe(4);
    let gaugeAtFirstSay: number | null = null;
    let drops = 0;
    while (isBusy(s)) {
      sceneTick(data, s);
      const d = gaugeDrop(s);
      if (d) {
        drops++;
        expect([d.from, d.to]).toEqual([4, 5]);
      }
      if (gaugeAtFirstSay === null && currentBubble(s)) gaugeAtFirstSay = s.shownGauge;
    }
    expect(drops).toBeGreaterThan(0);
    expect(gaugeAtFirstSay).toBe(4);
    expect(gaugeDrop(s)).toBeNull();
  });
});
