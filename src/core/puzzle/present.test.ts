// 핫스팟 있음 조건 `present`(ADR-1031 3절, #1043 Kai·Luna): 다 쓴 물건은 사라지고, 결합으로 생긴 물건은 나타난다.
import { describe, expect, it } from 'vitest';
import { hotspotBox } from '../interact';
import { checkScreen, replaySolution } from './check';
import { initialState, step } from './step';
import { hotspotPresent, type Action, type PuzzleState, type ScreenData } from './types';

// 양말을 건조기에 넣으면(양말 사라짐) 보송 양말이 나온다(나타남) → 쭉이가 집어 종에 건다.
function screenFixture(): ScreenData {
  return {
    id: 'present_fixture',
    spots: { floor: { x: 0, y: 240, free: true } },
    hotspots: {
      sock: { box: [100, 220, 24, 16], present: { flags: { 'sock.used': false } } },
      dryer: { box: [200, 180, 40, 48] },
      fluffy: { box: [210, 220, 20, 16], present: { flags: { 'fluffy.made': true, 'fluffy.used': false } } },
      bell: { box: [400, 100, 24, 24] },
    },
    flags: { 'sock.used': false, 'fluffy.made': false, 'fluffy.used': false, 'bell.rung': false },
    start: { at: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' }, items: [] },
    exitFlag: 'bell.rung',
    rules: [
      { id: 'pick_sock', target: 'sock', verb: 'stretch', do: { pick: true } },
      { id: 'put_sock', target: 'sock', verb: 'item', when: { item: 'sock' }, do: { put: true } },
      {
        id: 'load_dryer', target: 'dryer', verb: 'item', chain: 'combine',
        when: { item: 'sock' }, do: { set: { 'sock.used': true, 'fluffy.made': true }, take: ['sock'] },
      },
      { id: 'pick_fluffy', target: 'fluffy', verb: 'stretch', do: { pick: true } },
      { id: 'put_fluffy', target: 'fluffy', verb: 'item', when: { item: 'fluffy' }, do: { put: true } },
      {
        id: 'hang_bell', target: 'bell', verb: 'item', chain: 'use',
        when: { item: 'fluffy' }, do: { set: { 'fluffy.used': true, 'bell.rung': true }, take: ['fluffy'] },
      },
    ],
    solution: [
      { char: 'jjuk', verb: 'stretch', target: 'sock' },
      { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' },
      { char: 'jjuk', verb: 'stretch', target: 'fluffy' },
      { char: 'jjuk', verb: 'item', target: 'bell', item: 'fluffy' },
    ],
  };
}

function play(screen: ScreenData, actions: Action[]): PuzzleState {
  let s = initialState(screen);
  for (const a of actions) s = step(screen, s, a).state;
  return s;
}

describe('hotspot present (ADR-1031)', () => {
  it('hotspotPresent: no condition = always; spots and unknown ids are present', () => {
    const screen = screenFixture();
    const s0 = initialState(screen);
    expect(hotspotPresent(screen, s0.flags, 'dryer')).toBe(true);
    expect(hotspotPresent(screen, s0.flags, 'sock')).toBe(true);
    expect(hotspotPresent(screen, s0.flags, 'fluffy')).toBe(false);
    expect(hotspotPresent(screen, s0.flags, 'floor')).toBe(true);
    expect(hotspotPresent(screen, s0.flags, 'constructor')).toBe(true);
  });

  it('a used-up item is gone: Kai #1043 cases are invalid, not a rule or a fallback', () => {
    const screen = screenFixture();
    const s = play(screen, screen.solution!.slice(0, 2));
    expect(s.hands).toBeUndefined();
    expect(s.flags['sock.used']).toBe(true);
    // 다시 집기(무한 양말), 묵직이 밟기 폴백, 보기까지 전부 화면에 없는 대상이다.
    expect(step(screen, s, { char: 'jjuk', verb: 'stretch', target: 'sock' }).source).toBe('invalid');
    expect(step(screen, s, { char: 'mukjik', verb: 'stomp', target: 'sock' }).source).toBe('invalid');
    expect(step(screen, s, { char: 'ppik', verb: 'look', target: 'sock' }).source).toBe('invalid');
  });

  it('a made item appears only after its flag is on', () => {
    const screen = screenFixture();
    const pickFluffy: Action = { char: 'jjuk', verb: 'stretch', target: 'fluffy' };
    expect(step(screen, initialState(screen), pickFluffy).source).toBe('invalid');
    const r = step(screen, play(screen, screen.solution!.slice(0, 2)), pickFluffy);
    expect(r.ruleId).toBe('pick_fluffy');
    expect(r.state.hands).toBe('fluffy');
  });

  it('holding keeps the item usable; put back keeps it present', () => {
    const screen = screenFixture();
    const held = play(screen, screen.solution!.slice(0, 1));
    const put = step(screen, held, { char: 'jjuk', verb: 'item', target: 'sock', item: 'sock' });
    expect(put.ruleId).toBe('put_sock');
    expect(hotspotPresent(screen, put.state.flags, 'sock')).toBe(true);
  });

  it('UI: hotspotBox and tap targets drop an absent hotspot', () => {
    const screen = screenFixture();
    const s0 = initialState(screen);
    expect(hotspotBox(screen, s0, 'sock')).not.toBeNull();
    expect(hotspotBox(screen, s0, 'fluffy')).toBeNull();
    const after = play(screen, screen.solution!.slice(0, 2));
    expect(hotspotBox(screen, after, 'sock')).toBeNull();
    expect(hotspotBox(screen, after, 'fluffy')).toEqual({ left: 210, top: 220, width: 20, height: 16 });
  });

  it('BFS: solution replays, no dead ends, and the used sock is not a second route', () => {
    const screen = screenFixture();
    expect(replaySolution(screen)).toEqual([]);
    const report = checkScreen(screen);
    expect(report.explore.clearReachable).toBe(true);
    expect(report.explore.failures).toEqual([]);
    expect(report.explore.deadEnds).toEqual([]);
    expect(report.explore.shortestLength).toBe(4);
  });

  it('BFS: an item whose present flag nothing turns on never appears, so clear is unreachable', () => {
    // Theo #1043 우려: "나타남" 플래그를 켜는 규칙이 없으면 따로 검사 없이 BFS가 못 깸으로 잡는다.
    const screen = screenFixture();
    const load = screen.rules.find((r) => r.id === 'load_dryer')!;
    load.do = { set: { 'sock.used': true }, take: ['sock'] };
    const report = checkScreen(screen);
    expect(report.explore.clearReachable).toBe(false);
    expect(replaySolution(screen).length).toBeGreaterThan(0);
  });
});
