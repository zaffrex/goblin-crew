import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterDef, characterHitBox, type CharacterId } from '../../src/core/characters';
import { distanceToBox, hitTest, type HitBox } from '../../src/core/hit';
import { initialState, step } from '../../src/core/puzzle/step';
import type { Action, Box, PuzzleState, ScreenData } from '../../src/core/puzzle/types';
import { targetBox } from './coords';
import { clearPoint, defaultVerb, HUD, planAction, type Input, type Layout } from './plan';

const screen = JSON.parse(readFileSync('content/screens/magpie_nest.json', 'utf8')) as ScreenData;
const hb = ([left, top, width, height]: Box): HitBox => ({ left, top, width, height });

/** ui-interaction 6절 HUD 좌표로 만든 가짜 훅 hud. 실제 도구는 훅에서 받는다. */
const HUD_BOXES: Record<string, HitBox> = {
  [HUD.char('jjuk')]: hb([300, 4, 28, 28]),
  [HUD.char('mukjik')]: hb([332, 4, 28, 28]),
  [HUD.char('ppik')]: hb([364, 4, 28, 28]),
  [HUD.ability]: hb([300, 36, 28, 28]),
  [HUD.hand]: hb([332, 36, 28, 28]),
  [HUD.look]: hb([364, 36, 28, 28]),
  [HUD.item]: hb([404, 36, 28, 28]),
};

/** 퍼즐 상태 → 가짜 `__gcLayout()`. 캐릭터는 자리 좌표에 발을 둔다(바닥은 셋이 겹친다: #101 1번 질문의 최악). */
function fakeLayout(state: PuzzleState, active: CharacterId, armed: string | null = null): Layout {
  const spots: Record<string, HitBox> = {};
  for (const [id, s] of Object.entries(screen.spots)) if (s.box) spots[id] = hb(s.box);
  const hotspots: Record<string, HitBox> = {};
  for (const id of Object.keys(screen.hotspots)) hotspots[id] = hb(targetBox(screen, id, state.flags)!);
  const chars: Layout['chars'] = {};
  for (const c of CHARACTERS) {
    const s = screen.spots[state.at[c.id]]!;
    chars[c.id] = characterHitBox(characterDef(c.id), s.x, s.y, 1);
  }
  return { active, armed, selected: null, busy: false, cleared: false, gauge: state.gauge, at: { ...state.at }, chars, spots, hotspots, hud: HUD_BOXES };
}

/** 게임 판정 흉내: 무장 없으면 캐릭터(지금 캐릭터는 hold일 때만)도 대상, 무장 중이면 캐릭터 건너뜀. */
function judge(layout: Layout, char: CharacterId, armed: boolean, p: { x: number; y: number }, slop: number): string | null {
  const targets = [
    ...Object.entries(layout.spots).map(([id, box]) => ({ id, box, z: 0 })),
    ...Object.entries(layout.hotspots).map(([id, box]) => ({ id, box, z: 0 })),
  ];
  if (!armed) {
    const hold = screen.spots[layout.at[char]]?.hold === true;
    for (const [id, box] of Object.entries(layout.chars) as [CharacterId, HitBox][]) {
      if (id !== char || hold) targets.push({ id: `char:${id}`, box, z: 1 });
    }
  }
  return hitTest(targets, p, slop)?.id ?? null;
}

function replay(input: Input) {
  let state = initialState(screen);
  let active: CharacterId = 'jjuk';
  const seq: string[][] = [];
  for (const action of screen.solution!) {
    const layout = fakeLayout(state, active);
    const plan = planAction(screen, layout, action, input);
    expect(plan.warnings, JSON.stringify(action)).toEqual([]);
    seq.push(plan.taps.map((t) => t.id));
    const armed = plan.taps.some((t) => t.id.startsWith('verb:'));
    for (const t of plan.taps.filter((t) => t.id === action.target)) {
      // 고른 점이 게임 판정에서 정말 그 대상으로 간다 (마우스 0, 터치 8px 여유 둘 다)
      expect(judge(layout, action.char, armed, t.at, 0), action.target).toBe(action.target);
      expect(judge(layout, action.char, armed, t.at, 8), action.target).toBe(action.target);
    }
    state = step(screen, state, action).state;
    active = action.char;
  }
  return { seq, state };
}

describe('playtest plan (ui-interaction 10절)', () => {
  it('화면 1 정답 마우스: 3번만 능력 무장', () => {
    const { seq, state } = replay('mouse');
    expect(seq).toEqual([
      ['char:ppik', 'magpie'],
      ['char:jjuk', 'seesaw_left'],
      ['char:mukjik', 'verb:ability', 'seesaw_right'],
      ['char:jjuk', 'nest'],
    ]);
    expect(state.flags[screen.exitFlag]).toBe(true);
  });

  it('화면 1 정답 터치: step 행동 탭은 2번, 전환·무장은 1번', () => {
    const { seq } = replay('touch');
    expect(seq).toEqual([
      ['char:ppik', 'magpie', 'magpie'],
      ['char:jjuk', 'seesaw_left', 'seesaw_left'],
      ['char:mukjik', 'verb:ability', 'seesaw_right', 'seesaw_right'],
      ['char:jjuk', 'nest', 'nest'],
    ]);
  });

  it('기본 동사: 서는 자리는 내가 없으면 move, 서 있으면 능력. 핫스팟은 능력', () => {
    expect(defaultVerb(screen, 'mukjik', 'floor', 'seesaw_right')).toBe('move');
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
    expect(planAction(screen, fakeLayout(s, 'jjuk', HUD.hand), a, 'mouse').taps.map((t) => t.id)).toEqual([HUD.hand, 'seesaw_left']);
    const b: Action = { char: 'jjuk', verb: 'hand', target: 'basket' };
    expect(planAction(screen, fakeLayout(s, 'jjuk', HUD.hand), b, 'mouse').taps.map((t) => t.id)).toEqual(['basket']);
    // 전환하면 무장이 풀리니 다시 누른다
    expect(planAction(screen, fakeLayout(s, 'ppik', HUD.hand), b, 'mouse').taps.map((t) => t.id)).toEqual([HUD.char('jjuk'), HUD.hand, 'basket']);
  });

  it('다른 캐릭터 몸이 대상을 가리면 가리지 않은 점을 고른다', () => {
    // 묵직이(30×30)가 왼쪽 끝 위에 서 있고, 쭉이가 hand 없이 왼쪽 끝으로 move
    const s = { ...initialState(screen), at: { jjuk: 'floor', mukjik: 'seesaw_left', ppik: 'floor' } };
    const layout = fakeLayout(s, 'jjuk');
    const plan = planAction(screen, layout, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, 'touch');
    const p = plan.taps.at(-1)!.at;
    expect(distanceToBox(p, layout.chars.mukjik!)).toBeGreaterThan(0);
    expect(judge(layout, 'jjuk', false, p, 8)).toBe('seesaw_left');
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
  });

  it('clearPoint: 다 가리면 null, 아니면 중심에서 가장 가까운 빈 점', () => {
    const box = { left: 0, top: 0, width: 10, height: 10 };
    expect(clearPoint(box, [])).toEqual({ x: 5, y: 5 });
    expect(clearPoint(box, [{ left: -1, top: -1, width: 12, height: 12 }])).toBeNull();
    const p = clearPoint(box, [{ left: 0, top: 0, width: 7, height: 10 }])!;
    expect(p.x).toBe(8);
  });
});
