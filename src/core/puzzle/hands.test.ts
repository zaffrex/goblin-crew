// 쭉이 손 1칸(ADR-1031 1·3·4절): `hands` + 효과 `pick`/`put` + 조건 `holds`.
import { describe, expect, it } from 'vitest';
import { stateKey } from './bfs';
import { checkScreen, replaySolution, screenHost } from './check';
import { initialState, step } from './step';
import type { Action, PuzzleState, ScreenData } from './types';

// 작은 사슬: 묵직이가 양말을 납작하게(변화) → 쭉이가 집어 건조기에 넣음(결합, 양말 사라짐) → 삑삑이 소리로 건조기 켜기(쓰기).
function chainScreen(): ScreenData {
  return {
    id: 'hands_fixture',
    spots: {
      floor: { x: 0, y: 240, free: true },
      stool: { x: 300, y: 220, box: [290, 200, 24, 24] },
    },
    hotspots: {
      sock: { box: [100, 220, 24, 16] },
      dryer: { box: [200, 180, 40, 48] },
      bell: { box: [400, 100, 24, 24] },
    },
    flags: { 'sock.flat': false, 'dryer.loaded': false, 'dryer.on': false, 'bell.rung': false },
    start: { at: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' }, items: [] },
    exitFlag: 'dryer.on',
    rules: [
      { id: 'pick_sock', target: 'sock', verb: 'stretch', do: { pick: true } },
      { id: 'put_sock', target: 'sock', verb: 'item', when: { item: 'sock' }, do: { put: true } },
      { id: 'flatten_sock', target: 'sock', verb: 'stomp', chain: 'change', when: { flags: { 'sock.flat': false } }, do: { set: { 'sock.flat': true } } },
      {
        id: 'load_dryer', target: 'dryer', verb: 'item', chain: 'combine',
        when: { item: 'sock', flags: { 'sock.flat': true } },
        do: { set: { 'dryer.loaded': true }, take: ['sock'] },
      },
      { id: 'start_dryer', target: 'dryer', verb: 'squeak', chain: 'use', when: { flags: { 'dryer.loaded': true } }, do: { set: { 'dryer.on': true } } },
      // 든 채로 종 치기: 빈손이면 안 맞는다(`holds`).
      { id: 'ring_bell_holding', target: 'bell', verb: 'squeak', when: { holds: true }, do: { set: { 'bell.rung': true } } },
    ],
    solution: [
      { char: 'mukjik', verb: 'stomp', target: 'sock' },
      { char: 'jjuk', verb: 'stretch', target: 'sock' },
      { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' },
      { char: 'ppik', verb: 'squeak', target: 'dryer' },
    ],
  };
}

const PICK: Action = { char: 'jjuk', verb: 'stretch', target: 'sock' };
const PUT: Action = { char: 'jjuk', verb: 'item', target: 'sock', item: 'sock' };

function holding(screen: ScreenData): PuzzleState {
  return step(screen, initialState(screen), PICK).state;
}

describe('hands (ADR-1031)', () => {
  it('starts empty and pick puts the target in hands, not in party items', () => {
    const screen = chainScreen();
    const s0 = initialState(screen);
    expect(s0.hands).toBeUndefined();
    const r = step(screen, s0, PICK);
    expect(r.source).toBe('rule');
    expect(r.ruleId).toBe('pick_sock');
    expect(r.state.hands).toBe('sock');
    expect(r.state.items).toEqual([]);
    expect(s0.hands).toBeUndefined();
  });

  it('while holding, the held item is not a screen target and the pole ability does not fire', () => {
    const screen = chainScreen();
    const s = holding(screen);
    expect(step(screen, s, { char: 'mukjik', verb: 'stomp', target: 'sock' }).source).toBe('invalid');
    expect(step(screen, s, { char: 'ppik', verb: 'look', target: 'sock' }).source).toBe('invalid');
    expect(step(screen, s, { char: 'jjuk', verb: 'stretch', target: 'dryer' }).source).toBe('invalid');
    // 쭉이만 든 물건을 쓴다.
    expect(step(screen, s, { char: 'ppik', verb: 'item', target: 'dryer', item: 'sock' }).source).toBe('invalid');
  });

  it('the held item works with verb item + when.item, and take consumes it from hands', () => {
    const screen = chainScreen();
    let s = step(screen, initialState(screen), { char: 'mukjik', verb: 'stomp', target: 'sock' }).state;
    s = step(screen, s, PICK).state;
    const r = step(screen, s, { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' });
    expect(r.ruleId).toBe('load_dryer');
    expect(r.state.hands).toBeUndefined();
    expect(r.state.flags['dryer.loaded']).toBe(true);
    // 파티 아이템 이벤트를 내지 않는다(손과 items를 섞지 않음).
    expect(r.events.some((e) => e.type === 'item')).toBe(false);
  });

  it('a wrong use keeps the item in hands (fallback, no state change)', () => {
    const screen = chainScreen();
    const r = step(screen, holding(screen), { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' });
    expect(r.source).toBe('characterFallback');
    expect(r.state.hands).toBe('sock');
  });

  it('put empties hands without walking when jjuk stands on a free spot', () => {
    const screen = chainScreen();
    const r = step(screen, holding(screen), PUT);
    expect(r.ruleId).toBe('put_sock');
    expect(r.state.hands).toBeUndefined();
    expect(r.events.filter((e) => e.type === 'walk')).toEqual([]);
    // 놓은 뒤 상태는 처음과 같다(위치는 퍼즐 상태가 아님).
    expect(stateKey(r.state)).toBe(stateKey(initialState(screen)));
  });

  it('put does not match off a free spot (character fallback, still holding)', () => {
    const screen = chainScreen();
    const s = step(screen, holding(screen), { char: 'jjuk', verb: 'move', target: 'stool' }).state;
    expect(s.at.jjuk).toBe('stool');
    expect(s.hands).toBe('sock');
    const r = step(screen, s, PUT);
    expect(r.source).toBe('characterFallback');
    expect(r.state.hands).toBe('sock');
  });

  it('holds condition: true/false/item id', () => {
    const screen = chainScreen();
    const ring: Action = { char: 'ppik', verb: 'squeak', target: 'bell' };
    expect(step(screen, initialState(screen), ring).source).toBe('characterFallback');
    expect(step(screen, holding(screen), ring).ruleId).toBe('ring_bell_holding');
    const byId: ScreenData = { ...screen, rules: screen.rules.map((r) => (r.id === 'ring_bell_holding' ? { ...r, when: { holds: 'sock' } } : r)) };
    expect(step(byId, holding(byId), ring).ruleId).toBe('ring_bell_holding');
    const empty: ScreenData = { ...screen, rules: screen.rules.map((r) => (r.id === 'ring_bell_holding' ? { ...r, when: { holds: false } } : r)) };
    expect(step(empty, initialState(empty), ring).ruleId).toBe('ring_bell_holding');
    expect(step(empty, holding(empty), ring).source).toBe('characterFallback');
  });

  it('a faint keeps what jjuk holds (like party items, ADR-0018 G2)', () => {
    const screen = chainScreen();
    screen.rules.push({ id: 'zap', target: 'bell', verb: 'stomp', do: { gauge: -5 } });
    const r = step(screen, holding(screen), { char: 'mukjik', verb: 'stomp', target: 'bell' });
    expect(r.events.some((e) => e.type === 'faint')).toBe(true);
    expect(r.state.hands).toBe('sock');
  });

  it('BFS sees hands: held states are distinct nodes, solution replays, no dead ends', () => {
    const screen = chainScreen();
    expect(replaySolution(screen)).toEqual([]);
    const report = checkScreen(screen);
    expect(report.explore.clearReachable).toBe(true);
    expect(report.explore.failures).toEqual([]);
    expect(report.explore.deadEnds).toEqual([]);
    expect(stateKey(holding(screen))).not.toBe(stateKey(initialState(screen)));
    // 빈손이면 키 모양이 ADR-1031 전과 같다(4칸).
    expect(JSON.parse(stateKey(initialState(screen)))).toHaveLength(4);
    // 든 물건 행동은 쭉이에게만 나온다.
    const acts = screenHost(screen).actions(holding(screen));
    const itemActs = acts.filter((a) => a.verb === 'item');
    expect(itemActs.length).toBeGreaterThan(0);
    expect(itemActs.every((a) => a.char === 'jjuk' && a.item === 'sock')).toBe(true);
  });
});
