import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterDef, characterHitBox, type CharacterId } from '../../src/core/characters';
import { distanceToBox, type HitBox } from '../../src/core/hit';
import { hudTargets, resolveTap, tap, type Armed, type TapContext, type UiState } from '../../src/core/interact';
import type { HudId } from '../../src/core/hud';
import { initialState, step } from '../../src/core/puzzle/step';
import type { Action, Box, PuzzleState, ScreenData } from '../../src/core/puzzle/types';
import { targetBox } from './coords';
import { clearPoint, defaultVerb, HUD, planAction, type Input, type Layout, type Plan } from './plan';

const screen = JSON.parse(readFileSync('content/screens/magpie_nest.json', 'utf8')) as ScreenData;
const hb = ([left, top, width, height]: Box): HitBox => ({ left, top, width, height });
const slopOf = (input: Input) => (input === 'touch' ? 8 : 0);

/** 무장 상태 ↔ 훅의 무장 버튼 id. */
const armedId = (a: Armed | null): HudId | null => (a === null ? null : a.verb === 'item' ? 'item.0' : `verb.${a.verb}`);

/** 퍼즐 상태 → 가짜 `__gcLayout()`. HUD는 실제 `hud.ts` 좌표. 캐릭터는 자리 좌표에 발을 둔다(바닥은 셋이 겹친다). */
function fakeLayout(state: PuzzleState, active: CharacterId, armed: Armed | null = null): Layout {
  const spots: Record<string, HitBox> = {};
  for (const [id, s] of Object.entries(screen.spots)) if (s.box) spots[id] = hb(s.box);
  const hotspots: Record<string, HitBox> = {};
  for (const id of Object.keys(screen.hotspots)) hotspots[id] = hb(targetBox(screen, id, state.flags)!);
  const chars: Layout['chars'] = {};
  for (const c of CHARACTERS) {
    const s = screen.spots[state.at[c.id]]!;
    chars[c.id] = characterHitBox(characterDef(c.id), s.x, s.y, 1);
  }
  const hud: Record<string, HitBox> = {};
  for (const t of hudTargets(state)) hud[t.id] = t.box;
  return { active, armed: armedId(armed), selected: null, busy: false, cleared: false, gauge: state.gauge, at: { ...state.at }, chars, spots, hotspots, hud };
}

const ctxOf = (state: PuzzleState, layout: Layout): TapContext => ({
  screen,
  puzzle: state,
  bodies: layout.chars as Record<CharacterId, HitBox>,
});

/**
 * plan의 탭을 **실제 판정 `tap()`**(src/core/interact.ts)에 차례로 넣는다. 흉내 판정은 쓰지 않는다.
 * 마지막 탭이 이 행동을 실행(`act`)해야 하고, 그 전 탭은 전환·무장·터치 첫 선택이어야 한다.
 */
function runTaps(state: PuzzleState, ui: UiState, layout: Layout, plan: Plan, action: Action, input: Input): UiState {
  const ctx = ctxOf(state, layout);
  const kinds: string[] = [];
  for (const [i, t] of plan.taps.entries()) {
    const r = tap(ctx, ui, t.at, slopOf(input), input === 'touch');
    ui = r.ui;
    kinds.push(r.intent.kind);
    if (i === plan.taps.length - 1) {
      const last = r.intent;
      if (action.target === 'floor' && last.kind === 'walk') continue;
      expect(last.kind, JSON.stringify({ action, kinds })).toBe('act');
      if (last.kind === 'act') expect(last.action).toEqual(action);
    }
  }
  expect(kinds.slice(0, -1).every((k) => k === 'switch' || k === 'arm' || k === 'select'), kinds.join(',')).toBe(true);
  return ui;
}

function replay(input: Input) {
  let state = initialState(screen);
  let ui: UiState = { active: 'jjuk', armed: null, selected: null };
  const seq: string[][] = [];
  for (const action of screen.solution!) {
    const layout = fakeLayout(state, ui.active, ui.armed);
    const plan = planAction(screen, layout, action, input);
    expect(plan.warnings, JSON.stringify(action)).toEqual([]);
    seq.push(plan.taps.map((t) => t.id));
    ui = runTaps(state, ui, layout, plan, action, input);
    state = step(screen, state, action).state;
  }
  return { seq, state };
}

describe('playtest plan (ui-interaction 10절)', () => {
  it('화면 1 정답 마우스: 3번만 능력 무장', () => {
    const { seq, state } = replay('mouse');
    expect(seq).toEqual([
      ['char.ppik', 'magpie'],
      ['char.jjuk', 'seesaw_left'],
      ['char.mukjik', 'verb.ability', 'seesaw_right'],
      ['char.jjuk', 'nest'],
    ]);
    expect(state.flags[screen.exitFlag]).toBe(true);
  });

  it('화면 1 정답 터치: step 행동 탭은 2번, 전환·무장은 1번', () => {
    const { seq } = replay('touch');
    expect(seq).toEqual([
      ['char.ppik', 'magpie', 'magpie'],
      ['char.jjuk', 'seesaw_left', 'seesaw_left'],
      ['char.mukjik', 'verb.ability', 'seesaw_right', 'seesaw_right'],
      ['char.jjuk', 'nest', 'nest'],
    ]);
  });

  it('기본 동사: 서는 자리는 내가 없으면 move, 서 있거나 hold 자리면 능력. 핫스팟은 능력', () => {
    expect(defaultVerb(screen, 'mukjik', 'floor', 'seesaw_right')).toBe('move');
    expect(defaultVerb(screen, 'jjuk', 'floor', 'hook')).toBe('stretch');
    expect(defaultVerb(screen, 'mukjik', 'seesaw_right', 'seesaw_right')).toBe('stomp');
    expect(defaultVerb(screen, 'ppik', 'floor', 'nest')).toBe('squeak');
    expect(() => defaultVerb(screen, 'ppik', 'floor', 'nope')).toThrow();
  });

  it('올라선 뒤 다시 누르면 능력: 무장 없이 대상만 (2절 ① 경로)', () => {
    const s = { ...initialState(screen), at: { jjuk: 'seesaw_left', mukjik: 'seesaw_right', ppik: 'floor' } };
    const plan = planAction(screen, fakeLayout(s, 'mukjik'), { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, 'mouse');
    expect(plan.verbByDefault).toBe(true);
    expect(plan.taps.map((t) => t.id)).toEqual(['seesaw_right']);
  });

  it('남은 무장은 같은 버튼을 다시 눌러 푼다. 같은 무장이면 다시 누르지 않는다', () => {
    const s = initialState(screen);
    const a: Action = { char: 'jjuk', verb: 'move', target: 'seesaw_left' };
    const hand: Armed = { verb: 'hand' };
    expect(planAction(screen, fakeLayout(s, 'jjuk', hand), a, 'mouse').taps.map((t) => t.id)).toEqual([HUD.hand, 'seesaw_left']);
    const b: Action = { char: 'jjuk', verb: 'hand', target: 'basket' };
    expect(planAction(screen, fakeLayout(s, 'jjuk', hand), b, 'mouse').taps.map((t) => t.id)).toEqual(['basket']);
    // 전환하면 무장이 풀리니 다시 누른다
    expect(planAction(screen, fakeLayout(s, 'ppik', hand), b, 'mouse').taps.map((t) => t.id)).toEqual([HUD.char('jjuk'), HUD.hand, 'basket']);
  });

  it('다른 캐릭터 몸이 대상을 가리면 가리지 않은 점을 고른다', () => {
    // 묵직이(30×30)가 왼쪽 끝 위에 서 있고, 쭉이가 hand 없이 왼쪽 끝으로 move
    const s = { ...initialState(screen), at: { jjuk: 'floor', mukjik: 'seesaw_left', ppik: 'floor' } };
    const layout = fakeLayout(s, 'jjuk');
    const plan = planAction(screen, layout, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, 'touch');
    const p = plan.taps.at(-1)!.at;
    expect(distanceToBox(p, layout.chars.mukjik!)).toBeGreaterThan(0);
    const r = resolveTap(ctxOf(s, layout), { active: 'jjuk', armed: null, selected: null }, p, 8);
    expect(r.kind === 'act' && r.action).toEqual({ char: 'jjuk', verb: 'move', target: 'seesaw_left' });
  });

  it('매달린 캐릭터: 내 몸도 가리는 대상, 바닥 탭은 터치 2번(손 놓기 보호)', () => {
    const s = { ...initialState(screen), at: { jjuk: 'hook', mukjik: 'floor', ppik: 'floor' } };
    const layout = fakeLayout(s, 'jjuk');
    const nest = planAction(screen, layout, { char: 'jjuk', verb: 'stretch', target: 'nest' }, 'mouse');
    expect(distanceToBox(nest.taps.at(-1)!.at, layout.chars.jjuk!)).toBeGreaterThan(0);
    const drop = planAction(screen, layout, { char: 'jjuk', verb: 'move', target: 'floor' }, 'touch', { floorPoint: { x: 40, y: 250 } });
    expect(drop.taps.map((t) => t.id)).toEqual(['floor', 'floor']);
    const walk = planAction(screen, fakeLayout(initialState(screen), 'jjuk'), { char: 'jjuk', verb: 'move', target: 'floor' }, 'touch', { floorPoint: { x: 40, y: 250 } });
    expect(walk.taps.map((t) => t.id)).toEqual(['floor']);
  });

  it('고를 수 없는 입력은 오류: 지금 자리로 move, 남의 능력, item, floorPoint 없음', () => {
    const s = { ...initialState(screen), at: { jjuk: 'seesaw_left', mukjik: 'floor', ppik: 'floor' } };
    const l = fakeLayout(s, 'jjuk');
    expect(() => planAction(screen, l, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, 'mouse')).toThrow(/move/);
    expect(() => planAction(screen, l, { char: 'jjuk', verb: 'stomp', target: 'nest' }, 'mouse')).toThrow(/능력/);
    expect(() => planAction(screen, l, { char: 'jjuk', verb: 'item', target: 'nest', item: 'key' }, 'mouse')).toThrow(/item/);
    expect(() => planAction(screen, l, { char: 'jjuk', verb: 'move', target: 'floor' }, 'mouse')).toThrow(/floorPoint/);
    // hold 자리는 기본 탭이 능력이고 move 버튼은 없다 (PR #116)
    expect(() => planAction(screen, fakeLayout(initialState(screen), 'jjuk'), { char: 'jjuk', verb: 'move', target: 'hook' }, 'mouse')).toThrow(/hold/);
  });

  it('clearPoint: 다 가리면 null, 아니면 중심에서 가장 가까운 빈 점', () => {
    const box = { left: 0, top: 0, width: 10, height: 10 };
    expect(clearPoint(box, [])).toEqual({ x: 5, y: 5 });
    expect(clearPoint(box, [{ left: -1, top: -1, width: 12, height: 12 }])).toBeNull();
    const p = clearPoint(box, [{ left: 0, top: 0, width: 7, height: 10 }])!;
    expect(p.x).toBe(8);
  });
});
