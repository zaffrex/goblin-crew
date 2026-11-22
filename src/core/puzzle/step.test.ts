import { describe, expect, it } from 'vitest';
import { approachFor, initialState, PuzzleContentError, step } from './step';
import type { Action, CharactersData, PuzzleState, ScreenData } from './types';

// ADR-0065 3절 예시(ADR-0003 예시 퍼즐 뼈대). 실제 화면 1 JSON은 #66/#88에서 Luna가 쓴다.
function magpieScreen(): ScreenData {
  return {
    id: 'magpie_nest',
    spots: {
      floor: { x: 0, y: 240, free: true },
      seesaw_left: {
        x: 220, y: 214, box: [208, 196, 38, 24],
        takenShow: [{ say: ['self', 'magpie_nest.spot_taken'] }],
      },
      seesaw_right: { x: 284, y: 214, box: [250, 196, 38, 24] },
      hook: {
        x: 160, y: 160, box: [150, 84, 24, 24], hold: true, releaseTo: 'floor',
        releaseShow: {
          default: [{ say: ['self', 'magpie_nest.let_go_jjuk'] }],
          ppik: [{ say: ['ppik', 'magpie_nest.let_go_ppik'] }],
        },
      },
    },
    hotspots: {
      magpie: {
        box: [134, 6, 24, 24], hintAbility: 'squeak',
        variants: [{ when: { flags: { 'magpie.on_ground': true } }, box: [88, 212, 24, 24] }],
      },
      nest: { box: [128, 30, 36, 24], hintAbility: 'stretch', reachPoint: [150, 34] },
    },
    flags: { 'magpie.on_ground': false, 'nest.key_taken': false },
    start: { at: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' }, items: [] },
    exitFlag: 'nest.key_taken',
    onEnter: [{ say: ['ppik', 'magpie_nest.enter'] }],
    rules: [
      {
        id: 'squeak_magpie_down', target: 'magpie', verb: 'squeak',
        when: { flags: { 'magpie.on_ground': false } },
        do: { set: { 'magpie.on_ground': true } },
        show: [{ anim: ['magpie', 'fly_down'] }, { say: ['ppik', 'magpie_nest.squeak_ok'] }],
      },
      {
        id: 'launch_to_hook', target: 'seesaw_right', verb: 'stomp',
        when: { occupied: { seesaw_left: true, hook: false } },
        do: { move: [{ from: 'seesaw_left', to: 'hook' }] },
        show: [{ anim: ['mukjik', 'stomp_seesaw'] }, { say: ['@seesaw_left', 'magpie_nest.whee'] }],
      },
      {
        id: 'take_key', target: 'nest', verb: 'stretch',
        when: { at: ['hook'], flags: { 'magpie.on_ground': true } },
        do: { set: { 'nest.key_taken': true }, give: ['item.shop_key'], move: [{ who: 'self', to: 'floor' }] },
        show: [{ anim: ['jjuk', 'reach_hang_up'] }],
      },
      {
        id: 'peck_from_hook', target: 'nest', verb: 'stretch',
        when: { at: ['hook'] },
        do: { gauge: -1, move: [{ who: 'self', to: 'floor' }] },
        show: [{ anim: ['jjuk', 'pecked_fall'] }],
      },
    ],
    fallbacks: {
      nest: { stretch: { show: [{ anim: ['jjuk', 'reach_too_short'] }] } },
    },
    solution: [
      { char: 'ppik', verb: 'squeak', target: 'magpie' },
      { char: 'jjuk', verb: 'move', target: 'seesaw_left' },
      { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' },
      { char: 'jjuk', verb: 'stretch', target: 'nest' },
    ],
  };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

function run(screen: ScreenData, actions: Action[], from = initialState(screen)): PuzzleState {
  return actions.reduce((s, a) => step(screen, s, a).state, from);
}

const withState = (s: PuzzleState, patch: Partial<PuzzleState>): PuzzleState => ({ ...s, ...patch });

describe('initialState', () => {
  it('시작 자리·선언 순서 플래그·정렬된 아이템·게이지 5', () => {
    const screen = magpieScreen();
    screen.start.items = ['item.b', 'item.a'];
    const s = initialState(screen);
    expect(s).toEqual({
      screen: 'magpie_nest',
      at: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' },
      flags: { 'magpie.on_ground': false, 'nest.key_taken': false },
      items: ['item.a', 'item.b'],
      gauge: 5,
    });
    expect(Object.keys(s.flags)).toEqual(['magpie.on_ground', 'nest.key_taken']);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('solution 자동 플레이 (ADR-0065 7절)', () => {
  it('4행동 모두 rule/move이고 게이지가 줄지 않으며 마지막에 clear', () => {
    const screen = magpieScreen();
    let s = initialState(screen);
    const sources: string[] = [];
    for (const [i, a] of screen.solution!.entries()) {
      const r = step(screen, s, a);
      sources.push(r.source);
      expect(r.events.some((e) => e.type === 'faint')).toBe(false);
      expect(r.events.some((e) => e.type === 'clear')).toBe(i === screen.solution!.length - 1);
      s = r.state;
    }
    expect(sources).toEqual(['rule', 'move', 'rule', 'rule']);
    expect(s.gauge).toBe(5);
    expect(s.items).toEqual(['item.shop_key']);
    expect(s.at.jjuk).toBe('floor');
  });

  it('같은 상태 + 같은 행동 = 같은 결과, 입력 state는 바꾸지 않는다', () => {
    const screen = deepFreeze(magpieScreen());
    const s0 = deepFreeze(initialState(screen));
    const a: Action = { char: 'ppik', verb: 'squeak', target: 'magpie' };
    const r1 = step(screen, s0, a);
    const r2 = step(screen, s0, a);
    expect(r1).toEqual(r2);
    expect(r1.state).not.toBe(s0);
    expect(s0.flags['magpie.on_ground']).toBe(false);
  });

  it('이미 clear 플래그가 true면 다시 clear를 내지 않는다', () => {
    const screen = magpieScreen();
    const s = run(screen, screen.solution!.slice(0, 3));
    const done = withState(s, { flags: { ...s.flags, 'nest.key_taken': true } });
    const r = step(screen, done, { char: 'jjuk', verb: 'stretch', target: 'nest' });
    expect(r.events.some((e) => e.type === 'clear')).toBe(false);
  });
});

describe('규칙 매칭 (3단계)', () => {
  it('파일 순서로 when이 맞는 첫 규칙 하나만 적용한다', () => {
    const screen = magpieScreen();
    // 까치가 둥지 위면 take_key는 안 맞고 peck_from_hook이 맞는다.
    const s = run(screen, screen.solution!.slice(1, 3));
    expect(s.at.jjuk).toBe('hook');
    const r = step(screen, s, { char: 'jjuk', verb: 'stretch', target: 'nest' });
    expect(r.source).toBe('rule');
    expect(r.ruleId).toBe('peck_from_hook');
    expect(r.state.gauge).toBe(4);
    expect(r.state.at.jjuk).toBe('floor');
    expect(r.events.map((e) => e.type)).toEqual(['anim', 'place', 'gauge']);
  });

  it('연출 → 효과(item, place, gauge) 순서로 이벤트를 낸다', () => {
    const screen = magpieScreen();
    const s = run(screen, screen.solution!.slice(0, 3));
    const r = step(screen, s, screen.solution![3]!);
    expect(r.events).toEqual([
      { type: 'anim', target: 'jjuk', name: 'reach_hang_up' },
      { type: 'item', op: 'give', item: 'item.shop_key' },
      { type: 'place', char: 'jjuk', from: 'hook', to: 'floor' },
      { type: 'clear' },
    ]);
  });

  it('`@자리` 화자는 효과 적용 전 그 자리의 캐릭터로 푼다', () => {
    const screen = magpieScreen();
    const s = run(screen, [{ char: 'ppik', verb: 'move', target: 'seesaw_left' }]);
    const r = step(screen, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' });
    expect(r.events).toContainEqual({ type: 'say', speaker: 'ppik', text: 'magpie_nest.whee' });
    expect(r.events).toContainEqual({ type: 'place', char: 'ppik', from: 'seesaw_left', to: 'hook' });
    expect(r.state.at.ppik).toBe('hook');
  });

  it('`@자리`가 비어 있으면 그 연출만 건너뛴다', () => {
    const screen = magpieScreen();
    screen.rules.unshift({
      id: 'stomp_empty', target: 'seesaw_right', verb: 'stomp',
      when: { occupied: { seesaw_left: false } },
      show: [{ say: ['@seesaw_left', 'x.y'] }, { anim: ['mukjik', 'stomp_air'] }],
    });
    const r = step(screen, initialState(screen), { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' });
    expect(r.ruleId).toBe('stomp_empty');
    expect(r.events.map((e) => e.type)).toEqual(['anim']);
  });

  it('조건 who·has·lacks·item·occupied', () => {
    const screen = magpieScreen();
    screen.flags['door.open'] = false;
    screen.hotspots.door = { box: [0, 0, 24, 24] };
    screen.rules.push(
      { id: 'key_door', target: 'door', verb: 'item', when: { item: 'item.key' }, do: { set: { 'door.open': true }, take: ['item.key'] } },
      { id: 'mukjik_pull', target: 'door', verb: 'hand', when: { who: ['mukjik'], lacks: ['item.key'] }, show: [{ anim: ['mukjik', 'pull'] }] },
      { id: 'others_pull', target: 'door', verb: 'hand', when: { has: ['item.key'] }, show: [{ anim: ['self', 'jingle'] }] },
    );
    const s0 = withState(initialState(screen), { items: ['item.key'] });
    expect(step(screen, s0, { char: 'mukjik', verb: 'hand', target: 'door' }).ruleId).toBe('others_pull');
    expect(step(screen, initialState(screen), { char: 'mukjik', verb: 'hand', target: 'door' }).ruleId).toBe('mukjik_pull');
    expect(step(screen, initialState(screen), { char: 'jjuk', verb: 'hand', target: 'door' }).source).toBe('characterFallback');
    const used = step(screen, s0, { char: 'jjuk', verb: 'item', target: 'door', item: 'item.key' });
    expect(used.ruleId).toBe('key_door');
    expect(used.state.items).toEqual([]);
    expect(used.state.flags['door.open']).toBe(true);
    expect(used.events).toContainEqual({ type: 'item', op: 'take', item: 'item.key' });
  });
});

describe('폴백 (4·5단계)', () => {
  it('폴백 ①: 맞는 규칙이 없으면 대상의 동사별 기본 반응, 상태는 그대로', () => {
    const screen = magpieScreen();
    const r = step(screen, initialState(screen), { char: 'jjuk', verb: 'stretch', target: 'nest' });
    expect(r.source).toBe('hotspotFallback');
    expect(r.state).toEqual(initialState(screen));
    expect(r.events).toEqual([{ type: 'anim', target: 'jjuk', name: 'reach_too_short' }]);
  });

  it('폴백 ①은 게이지만 바꿀 수 있다', () => {
    const screen = magpieScreen();
    screen.fallbacks!.magpie = { hand: { do: { gauge: -1 }, show: [{ anim: ['magpie', 'peck'] }] } };
    const r = step(screen, initialState(screen), { char: 'jjuk', verb: 'hand', target: 'magpie' });
    expect(r.source).toBe('hotspotFallback');
    expect(r.state.gauge).toBe(4);
    expect(r.events.at(-1)).toEqual({ type: 'gauge', delta: -1, value: 4 });
  });

  it('폴백 ②: characters.json의 캐릭터·동사 공통 반응, 없으면 연출 없이 끝', () => {
    const screen = magpieScreen();
    const chars: CharactersData = { fallbacks: { ppik: { look: { show: [{ say: ['self', 'char.ppik.look_generic'] }] } } } };
    const r = step(screen, initialState(screen), { char: 'ppik', verb: 'look', target: 'nest' }, chars);
    expect(r.source).toBe('characterFallback');
    expect(r.events).toEqual([{ type: 'say', speaker: 'ppik', text: 'char.ppik.look_generic' }]);
    const bare = step(screen, initialState(screen), { char: 'ppik', verb: 'look', target: 'nest' });
    expect(bare.source).toBe('characterFallback');
    expect(bare.events).toEqual([]);
  });

  it('텍스트 배열("두 번째부터")은 그대로 넘긴다. 고르는 건 UI다', () => {
    const screen = magpieScreen();
    screen.fallbacks!.magpie = { look: { show: [{ say: ['self', ['a.first', 'a.again']] }] } };
    const r = step(screen, initialState(screen), { char: 'jjuk', verb: 'look', target: 'magpie' });
    expect(r.events).toEqual([{ type: 'say', speaker: 'jjuk', text: ['a.first', 'a.again'] }]);
  });
});

describe('이동과 자동 걷기 (2단계)', () => {
  it('기본 이동: 빈 자리면 at이 바뀌고 walk 이벤트', () => {
    const screen = magpieScreen();
    const r = step(screen, initialState(screen), { char: 'jjuk', verb: 'move', target: 'seesaw_left' });
    expect(r.source).toBe('move');
    expect(r.state.at.jjuk).toBe('seesaw_left');
    expect(r.events).toEqual([{ type: 'walk', char: 'jjuk', from: 'floor', to: 'seesaw_left' }]);
  });

  it('정원이 차면 blocked + takenShow, 상태 그대로', () => {
    const screen = magpieScreen();
    const s = run(screen, [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }]);
    const r = step(screen, s, { char: 'ppik', verb: 'move', target: 'seesaw_left' });
    expect(r.source).toBe('blocked');
    expect(r.state).toEqual(s);
    expect(r.events).toEqual([{ type: 'say', speaker: 'ppik', text: 'magpie_nest.spot_taken' }]);
  });

  it('hold 자리는 move로 못 간다 (stomp 없는 3행동 지름길 차단)', () => {
    const screen = magpieScreen();
    const r = step(screen, initialState(screen), { char: 'jjuk', verb: 'move', target: 'hook' });
    expect(r.source).toBe('invalid');
    expect(r.state).toEqual(initialState(screen));
  });

  it('지금 선 자리로 move는 invalid', () => {
    const screen = magpieScreen();
    expect(step(screen, initialState(screen), { char: 'jjuk', verb: 'move', target: 'floor' }).source).toBe('invalid');
  });

  it('(T, move) 규칙이 맞으면 기본 이동 대신 그 규칙', () => {
    const screen = magpieScreen();
    screen.rules.push({
      id: 'slip', target: 'seesaw_left', verb: 'move', when: { who: ['mukjik'] },
      do: { gauge: -1 }, show: [{ anim: ['mukjik', 'slip'] }],
    });
    const r = step(screen, initialState(screen), { char: 'mukjik', verb: 'move', target: 'seesaw_left' });
    expect(r.ruleId).toBe('slip');
    expect(r.state.at.mukjik).toBe('floor');
    expect(r.state.gauge).toBe(4);
  });

  it('자동 걷기 중 (A, move) 규칙이 적용되면 행동은 거기서 끝난다 (울타리 건너뛰기 차단)', () => {
    const screen = magpieScreen();
    screen.spots.yard = { x: 300, y: 240, capacity: 3 };
    screen.flags['dog.asleep'] = false;
    screen.hotspots.bone = { box: [300, 220, 24, 24], approach: 'yard' };
    screen.rules.push(
      { id: 'dog_bites', target: 'yard', verb: 'move', when: { flags: { 'dog.asleep': false } }, do: { gauge: -1 } },
      { id: 'grab_bone', target: 'bone', verb: 'hand', do: { give: ['item.bone'] } },
    );
    const r = step(screen, initialState(screen), { char: 'jjuk', verb: 'hand', target: 'bone' });
    expect(r.ruleId).toBe('dog_bites');
    expect(r.state.items).toEqual([]);
    expect(r.state.at.jjuk).toBe('floor');
    const asleep = initialState(screen);
    asleep.flags['dog.asleep'] = true;
    const ok = step(screen, asleep, { char: 'jjuk', verb: 'hand', target: 'bone' });
    expect(ok.ruleId).toBe('grab_bone');
    expect(ok.state.at.jjuk).toBe('yard');
    expect(ok.events[0]).toEqual({ type: 'walk', char: 'jjuk', from: 'floor', to: 'yard' });
  });

  it('자동 걷기가 막히면(blocked) 행동은 거기서 끝난다', () => {
    const screen = magpieScreen();
    screen.hotspots.lever = { box: [220, 180, 24, 24], approach: 'seesaw_left' };
    screen.rules.push({ id: 'pull', target: 'lever', verb: 'hand', show: [{ anim: ['self', 'pull'] }] });
    const s = run(screen, [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }]);
    const r = step(screen, s, { char: 'ppik', verb: 'hand', target: 'lever' });
    expect(r.source).toBe('blocked');
    expect(r.state.at.ppik).toBe('floor');
  });

  it('`when.at`은 자동 걷기 뒤 자리로 판정한다', () => {
    const screen = magpieScreen();
    // seesaw_left 위의 쭉이가 둥지에 hand → approach 기본 floor로 걸어간 뒤 판정.
    screen.rules.unshift({ id: 'hand_from_floor', target: 'nest', verb: 'hand', when: { at: ['floor'] } });
    const s = run(screen, [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }]);
    const r = step(screen, s, { char: 'jjuk', verb: 'hand', target: 'nest' });
    expect(r.ruleId).toBe('hand_from_floor');
    expect(r.state.at.jjuk).toBe('floor');
  });

  it('look은 걷지 않는다', () => {
    const screen = magpieScreen();
    screen.rules.push({ id: 'look_left', target: 'nest', verb: 'look', when: { at: ['seesaw_left'] } });
    const s = run(screen, [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }]);
    const r = step(screen, s, { char: 'jjuk', verb: 'look', target: 'nest' });
    expect(r.ruleId).toBe('look_left');
    expect(r.events.some((e) => e.type === 'walk')).toBe(false);
  });

  it('approach 동사별 맵과 stay, variants의 approach', () => {
    const screen = magpieScreen();
    screen.spots.yard = { x: 300, y: 240, capacity: 3 };
    screen.hotspots.dog = { box: [300, 200, 24, 24], approach: { default: 'yard', squeak: 'stay' } };
    screen.hotspots.magpie!.variants![0]!.approach = 'seesaw_right';
    const s = initialState(screen);
    expect(approachFor(screen, s, 'jjuk', 'dog', 'hand')).toBe('yard');
    expect(approachFor(screen, s, 'jjuk', 'dog', 'squeak')).toBe('stay');
    expect(approachFor(screen, s, 'jjuk', 'nest', 'hand')).toBe('floor');
    expect(approachFor(screen, s, 'jjuk', 'magpie', 'hand')).toBe('floor');
    const down = withState(s, { flags: { ...s.flags, 'magpie.on_ground': true } });
    expect(approachFor(screen, down, 'jjuk', 'magpie', 'hand')).toBe('seesaw_right');
    const r = step(screen, s, { char: 'ppik', verb: 'squeak', target: 'dog' });
    expect(r.state.at.ppik).toBe('floor');
    expect(r.events.some((e) => e.type === 'walk')).toBe(false);
  });

  it('approach.from: 지금 선 자리별 예외, 없는 동사는 바깥 맵으로 (#688)', () => {
    const screen = magpieScreen();
    screen.hotspots.nest!.approach = { default: 'floor', squeak: 'stay', from: { seesaw_left: { stretch: 'stay' }, seesaw_right: 'stay' } };
    const s = run(screen, [
      { char: 'jjuk', verb: 'move', target: 'seesaw_left' },
      { char: 'mukjik', verb: 'move', target: 'seesaw_right' },
    ]);
    expect(approachFor(screen, s, 'jjuk', 'nest', 'stretch')).toBe('stay');
    expect(approachFor(screen, s, 'jjuk', 'nest', 'hand')).toBe('floor'); // from 안에 없는 동사 → 바깥 default
    expect(approachFor(screen, s, 'mukjik', 'nest', 'stomp')).toBe('stay'); // 문자열 값은 모든 동사
    expect(approachFor(screen, s, 'ppik', 'nest', 'hand')).toBe('floor'); // 바닥은 from에 없음
    // 시소 끝의 쭉이가 둥지에 뻗기: 내려오지 않고 그 자리에서 높이 부족 실패.
    const r = step(screen, s, { char: 'jjuk', verb: 'stretch', target: 'nest' });
    expect(r.state.at.jjuk).toBe('seesaw_left');
    expect(r.events.some((e) => e.type === 'walk')).toBe(false);
    expect(r.source).toBe('hotspotFallback'); // 바닥에서와 같은 높이 부족 반응
  });

  it('approach.from: 프로토타입 키 자리는 from에 없는 것으로 보고 바깥 맵을 쓴다 (#699)', () => {
    const screen = magpieScreen();
    screen.hotspots.nest!.approach = { default: 'floor', stretch: 'seesaw_left', from: { seesaw_right: 'stay' } };
    const s = initialState(screen);
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      // ID 문법(validate)이 막는 값이라 상태를 직접 만든다.
      const odd = { ...s, at: { ...s.at, jjuk: key } };
      expect(approachFor(screen, odd, 'jjuk', 'nest', 'stretch')).toBe('seesaw_left');
      expect(approachFor(screen, odd, 'jjuk', 'nest', 'hand')).toBe('floor');
    }
    // 위 키들은 지금 동사 이름과 안 겹쳐 가드 없이도 같은 값이 나온다. 자기 키만 보는지는 상속 키로 확인한다.
    screen.hotspots.nest!.approach = { default: 'floor', from: Object.assign(Object.create({ seesaw_left: 'stay' }), { seesaw_right: 'stay' }) };
    const onLeft = run(screen, [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }]);
    expect(approachFor(screen, onLeft, 'jjuk', 'nest', 'stretch')).toBe('floor');
  });
});

describe('유지 상태 (1단계)', () => {
  const onHook = (screen: ScreenData, who: 'jjuk' | 'ppik' = 'jjuk'): PuzzleState =>
    run(screen, [
      { char: who, verb: 'move', target: 'seesaw_left' },
      { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' },
    ]);

  it('hold 자리에서 맞는 규칙(when.at에 그 자리)이 없으면 손을 놓고 끝난다', () => {
    const screen = magpieScreen();
    const s = onHook(screen);
    const r = step(screen, s, { char: 'jjuk', verb: 'hand', target: 'magpie' });
    expect(r.source).toBe('release');
    expect(r.state.at.jjuk).toBe('floor');
    expect(r.state.gauge).toBe(5);
    expect(r.events).toEqual([
      { type: 'release', char: 'jjuk', from: 'hook', to: 'floor' },
      { type: 'say', speaker: 'jjuk', text: 'magpie_nest.let_go_jjuk' },
    ]);
  });

  it('releaseShow는 캐릭터 키가 있으면 그것을 쓴다', () => {
    const screen = magpieScreen();
    const s = onHook(screen, 'ppik');
    const r = step(screen, s, { char: 'ppik', verb: 'squeak', target: 'magpie' });
    expect(r.source).toBe('release');
    expect(r.events[1]).toEqual({ type: 'say', speaker: 'ppik', text: 'magpie_nest.let_go_ppik' });
  });

  it('releaseShow의 `@자리` 화자는 손 놓기 전 자리로 푼다', () => {
    const screen = magpieScreen();
    screen.spots.hook!.releaseShow = { default: [{ anim: ['@hook', 'drop'] }] };
    const r = step(screen, onHook(screen), { char: 'jjuk', verb: 'hand', target: 'magpie' });
    expect(r.events[1]).toEqual({ type: 'anim', target: 'jjuk', name: 'drop' });
  });

  it('`when.at`이 없는 규칙은 hold 자리에서 발동하지 않는다', () => {
    const screen = magpieScreen();
    // squeak_magpie_down에는 at 조건이 없다 → 매달린 삑삑이가 삑 해도 손 놓기.
    const s = onHook(screen, 'ppik');
    const r = step(screen, s, { char: 'ppik', verb: 'squeak', target: 'magpie' });
    expect(r.state.flags['magpie.on_ground']).toBe(false);
  });

  it('look은 손을 놓지 않는다', () => {
    const screen = magpieScreen();
    const s = onHook(screen);
    const r = step(screen, s, { char: 'jjuk', verb: 'look', target: 'magpie' });
    expect(r.source).toBe('characterFallback');
    expect(r.state.at.jjuk).toBe('hook');
  });

  it('move floor도 손 놓기다', () => {
    const screen = magpieScreen();
    const r = step(screen, onHook(screen), { char: 'jjuk', verb: 'move', target: 'floor' });
    expect(r.source).toBe('release');
    expect(r.state.at.jjuk).toBe('floor');
  });

  it('고리가 차 있으면 launch_to_hook은 안 맞는다 (occupied: hook false)', () => {
    const screen = magpieScreen();
    const s2 = step(screen, onHook(screen), { char: 'ppik', verb: 'move', target: 'seesaw_left' }).state;
    const r = step(screen, s2, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' });
    expect(r.source).toBe('characterFallback');
    expect(r.state.at.ppik).toBe('seesaw_left');
  });
});

describe('보송 게이지 (6단계, ADR-0018 G1·G2)', () => {
  it('0이 되면 faint: 위치만 시작으로, 게이지 5, 플래그·아이템은 그대로', () => {
    const screen = magpieScreen();
    const s = run(screen, [
      { char: 'jjuk', verb: 'move', target: 'seesaw_left' },
      { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' },
    ]);
    const low = withState(s, { gauge: 1, items: ['item.x'], flags: { ...s.flags, 'nest.key_taken': false } });
    const r = step(screen, low, { char: 'jjuk', verb: 'stretch', target: 'nest' });
    expect(r.ruleId).toBe('peck_from_hook');
    expect(r.state.gauge).toBe(5);
    expect(r.state.at).toEqual(screen.start.at);
    expect(r.state.items).toEqual(['item.x']);
    expect(r.events.slice(-2)).toEqual([
      { type: 'gauge', delta: -1, value: 0 },
      { type: 'faint', to: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' } },
    ]);
  });

  it('"열쇠는 챙겼지만 쪼였다": 같은 행동으로 기절해도 플래그·아이템은 남고 clear도 난다', () => {
    const screen = magpieScreen();
    screen.rules[2]!.do!.gauge = -1;
    const s = run(screen, screen.solution!.slice(0, 3));
    const r = step(screen, withState(s, { gauge: 1 }), screen.solution![3]!);
    expect(r.state.flags['nest.key_taken']).toBe(true);
    expect(r.state.items).toEqual(['item.shop_key']);
    expect(r.events.map((e) => e.type).slice(-2)).toEqual(['faint', 'clear']);
  });

  it('게이지는 5를 넘지 않는다', () => {
    const screen = magpieScreen();
    screen.fallbacks!.magpie = { hand: { do: { gauge: 2 } } };
    const r = step(screen, withState(initialState(screen), { gauge: 4 }), { char: 'jjuk', verb: 'hand', target: 'magpie' });
    expect(r.state.gauge).toBe(5);
  });
});

describe('invalid 행동', () => {
  const screen = magpieScreen();
  const s = initialState(screen);
  it.each<[string, Action]>([
    ['남의 능력', { char: 'jjuk', verb: 'squeak', target: 'magpie' }],
    ['없는 대상', { char: 'jjuk', verb: 'hand', target: 'moon' }],
    ['핫스팟으로 move', { char: 'jjuk', verb: 'move', target: 'nest' }],
    ['없는 아이템', { char: 'jjuk', verb: 'item', target: 'nest', item: 'item.shop_key' }],
    ['item 없이 item 동사', { char: 'jjuk', verb: 'item', target: 'nest' }],
    ['item 동사가 아닌데 item', { char: 'jjuk', verb: 'hand', target: 'nest', item: 'item.shop_key' }],
  ])('%s → invalid, 상태 그대로, 이벤트 없음', (_name, a) => {
    const r = step(screen, s, a);
    expect(r).toEqual({ state: s, events: [], source: 'invalid' });
  });
});

describe('콘텐츠 오류는 PuzzleContentError', () => {
  it('정원을 넘기는 규칙 move', () => {
    const screen = magpieScreen();
    screen.rules.unshift({ id: 'bad', target: 'nest', verb: 'hand', do: { move: [{ who: 'self', to: 'seesaw_left' }] } });
    const s = run(screen, [{ char: 'mukjik', verb: 'move', target: 'seesaw_left' }]);
    expect(() => step(screen, s, { char: 'jjuk', verb: 'hand', target: 'nest' })).toThrow(PuzzleContentError);
  });

  it('선언 안 된 플래그', () => {
    const screen = magpieScreen();
    screen.rules.unshift({ id: 'bad', target: 'nest', verb: 'hand', do: { set: { 'nope.flag': true } } });
    expect(() => step(screen, initialState(screen), { char: 'jjuk', verb: 'hand', target: 'nest' })).toThrow(/선언 안 된 플래그/);
  });

  it('빈 자리의 move.from은 아무 일 없음 (오류 아님)', () => {
    const screen = magpieScreen();
    screen.rules.unshift({ id: 'stomp_any', target: 'seesaw_right', verb: 'stomp', do: { move: [{ from: 'seesaw_left', to: 'hook' }] } });
    const r = step(screen, initialState(screen), { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' });
    expect(r.ruleId).toBe('stomp_any');
    expect(r.state).toEqual(initialState(screen));
    expect(r.events).toEqual([]);
  });
});

describe('효과 위치 표시 { do: "here" } (ADR-0065 5절, #206)', () => {
  // 화면 1 13번(seesaw_launch_bump) 모양: 시소 왼쪽 사람이 날아가 고리에 매달린 사람과 부딪혀 둘 다 바닥으로.
  function bumpScreen(mark: boolean): ScreenData {
    const screen = magpieScreen();
    const show: NonNullable<ScreenData['rules'][number]['show']> = [
      { anim: ['mukjik', 'common.stomp'] },
      { anim: ['@seesaw_left', 'launch_to_hook'] },
      { anim: ['@seesaw_left', 'common.flatten'] },
      { anim: ['@hook', 'common.flatten'] },
      { say: ['@hook', 'magpie_nest.bump'] },
    ];
    if (mark) show.splice(2, 0, { do: 'here' });
    screen.rules.unshift({
      id: 'bump', target: 'seesaw_right', verb: 'stomp',
      when: { occupied: { seesaw_left: true, hook: true } },
      do: { move: [{ from: 'seesaw_left', to: 'floor' }, { from: 'hook', to: 'floor' }], gauge: -1 },
      show,
    });
    return screen;
  }
  const setup: Action[] = [
    { char: 'jjuk', verb: 'move', target: 'seesaw_left' },
    { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, // 쭉이 → 고리(launch_to_hook 규칙)
    { char: 'ppik', verb: 'move', target: 'seesaw_left' },
  ];
  const stomp: Action = { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' };

  it('표시 자리에 place·gauge를 끼우고, 표시 뒤 `@자리`도 효과 전 자리로 푼다', () => {
    const screen = bumpScreen(true);
    const s = run(screen, setup);
    expect(s.at).toMatchObject({ jjuk: 'hook', ppik: 'seesaw_left' });
    const r = step(screen, s, stomp);
    expect(r.ruleId).toBe('bump');
    expect(r.events).toEqual([
      { type: 'anim', target: 'mukjik', name: 'common.stomp' },
      { type: 'anim', target: 'ppik', name: 'launch_to_hook' },
      { type: 'place', char: 'ppik', from: 'seesaw_left', to: 'floor' },
      { type: 'place', char: 'jjuk', from: 'hook', to: 'floor' },
      { type: 'gauge', delta: -1, value: 4 },
      { type: 'anim', target: 'ppik', name: 'common.flatten' },
      { type: 'anim', target: 'jjuk', name: 'common.flatten' },
      { type: 'say', speaker: 'jjuk', text: 'magpie_nest.bump' },
    ]);
  });

  it('바뀌는 건 이벤트 순서뿐: 결과 상태와 이벤트 집합은 표시가 없을 때와 같다', () => {
    const marked = bumpScreen(true);
    const plain = bumpScreen(false);
    const a = step(marked, run(marked, setup), stomp);
    const b = step(plain, run(plain, setup), stomp);
    expect(a.state).toEqual(b.state);
    expect(a.source).toBe(b.source);
    const key = (e: unknown): string => JSON.stringify(e);
    expect(a.events.map(key).sort()).toEqual(b.events.map(key).sort());
    // 표시가 없으면 지금처럼 연출 다음 효과.
    expect(b.events.map((e) => e.type)).toEqual(['anim', 'anim', 'anim', 'anim', 'say', 'place', 'place', 'gauge']);
  });

  it('표시가 맨 앞이면 효과가 먼저, 맨 뒤면 표시 없음과 같다', () => {
    const screen = magpieScreen();
    const s = run(screen, screen.solution!.slice(0, 3));
    const take = screen.rules.find((r) => r.id === 'take_key')!;
    const plain = step(screen, s, screen.solution![3]!).events;

    take.show = [...take.show!, { do: 'here' }];
    expect(step(screen, s, screen.solution![3]!).events).toEqual(plain);

    take.show = [{ do: 'here' }, { anim: ['jjuk', 'reach_hang_up'] }];
    expect(step(screen, s, screen.solution![3]!).events.map((e) => e.type)).toEqual(['item', 'place', 'anim', 'clear']);
  });

  it('faint는 표시와 상관없이 맨 뒤', () => {
    const screen = bumpScreen(true);
    const s = withState(run(screen, setup), { gauge: 1 });
    const r = step(screen, s, stomp);
    expect(r.events.at(-1)).toEqual({ type: 'faint', to: screen.start.at });
    expect(r.events.at(-2)).toEqual({ type: 'say', speaker: 'jjuk', text: 'magpie_nest.bump' });
  });

  it('표시는 연출이 아니라 이벤트로 나오지 않는다', () => {
    const screen = magpieScreen();
    screen.rules.unshift({ id: 'noop', target: 'nest', verb: 'hand', do: { set: { 'magpie.on_ground': true } }, show: [{ do: 'here' }] });
    expect(step(screen, initialState(screen), { char: 'jjuk', verb: 'hand', target: 'nest' }).events).toEqual([]);
  });
});
