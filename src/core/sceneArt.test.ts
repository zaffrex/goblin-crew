import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { CHAR_SLOTS } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, isBusy, sceneTap, sceneTick, shownFlags, TIMING, type SceneData, type SceneState } from './scene';
import { animOf, animTicks, coveredIds, litFrames, loopStarts, objectOf, parseSceneArt, pictureOf, sceneDraws, timedFrame, type LoopStarts, type SceneArtMeta, type ScenePictureObject, type SceneView } from './sceneArt';
import { parseSpriteMeta, type SpriteMeta } from './sprite';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** 커밋된 삑삑이 시트(서 있기·걷기만, 화면 1 자세는 아직). */
const PPIK = parseSpriteMeta(clone(ppikJson));

/** 커밋된 진짜 시트 + 고정 anim(진짜 그림이 바뀌어도 이 테스트가 흔들리지 않게 덮어쓴다). 프레임 번호는 아무거나 시트 안의 것. */
function meta(): SceneArtMeta {
  const m = parseSceneArt(clone(sheetJson));
  m.anims['magpie.fly_down'] = { object: 'magpie', frames: [5, 9], ms: [100, 100], layer: 'front' };
  m.anims['magpie.ruffle'] = {
    object: 'magpie',
    frames: [5, 6, 5],
    ms: [100, 150, 100],
    layer: 'back',
    variants: [{ when: { flags: { 'magpie.on_ground': true } }, frames: [9, 10], ms: [100, 100], layer: 'front' }],
  };
  m.anims['seesaw_right.plank_bounce'] = { object: 'seesaw', frames: [12, 12, 12], ms: [80, 80, 80], layer: 'back' };
  return m;
}

const screen = screenJson as unknown as ScreenData;
const characters = charactersJson as CharactersData;
const view = (over: Partial<SceneView> = {}): SceneView => ({ flagsOf: () => screen.flags ?? {}, playing: null, clockMs: 0, ...over });
const idx = (m: SceneArtMeta, key: string) => m.objects.findIndex((o) => o.key === key);
/** 그림 물건(효과 자리가 아닌 것). 커밋된 화면 1 시트는 전부 그림 물건이다. */
const pobj = (m: SceneArtMeta, key: string) => m.objects[idx(m, key)] as ScenePictureObject;

describe('parseSceneArt', () => {
  it('커밋된 화면 1 시트를 읽는다(배경 PNG 있음, #145 draft 해제)', () => {
    const m = parseSceneArt(sheetJson);
    expect(m.screen).toBe('magpie_nest');
    expect(m.bg).toBe('magpie_nest-bg.png');
    expect(m.objects.map((o) => o.key)).toEqual(['nest', 'magpie', 'hook', 'long_johns', 'seesaw', 'basket']);
  });

  it('프레임 번호가 시트 밖이면 던진다(엔진은 그 화면 그림을 통째로 폴백)', () => {
    const bad = clone(sheetJson) as { objects: { default: { frame: number } }[] };
    bad.objects[0]!.default.frame = 99;
    expect(() => parseSceneArt(bad)).toThrow('프레임 번호 99');
  });

  it('loop ms 길이가 frames와 다르면 던진다', () => {
    const bad = clone(sheetJson) as { objects: { default: { loop?: { ms: number[] } } }[] };
    bad.objects[0]!.default.loop!.ms = [1600];
    expect(() => parseSceneArt(bad)).toThrow('loop: frames·ms');
  });
});

describe('멈춘 모습·anim 고르기 (형식 기록 4·4-1절)', () => {
  it('when 첫 일치, 없으면 default. 까치 바닥은 front', () => {
    const m = meta();
    const magpie = objectOf(m, 'magpie')!;
    expect(pictureOf(magpie, { 'magpie.on_ground': false }).layer).toBe('back');
    expect(pictureOf(magpie, { 'magpie.on_ground': true })).toBe(magpie.states![0]);
    expect(magpie.states![0]!.layer).toBe('front');
  });

  it('ids 물건: seesaw_left·seesaw_right 모두 시소 하나, 모르는 대상은 null(임시 상자)', () => {
    const m = meta();
    expect(objectOf(m, 'seesaw_left')?.key).toBe('seesaw');
    expect(objectOf(m, 'seesaw_right')?.key).toBe('seesaw');
    expect(objectOf(m, 'nope')).toBeNull();
    expect(coveredIds(m)).toEqual(new Set(['nest', 'magpie', 'hook', 'long_johns', 'seesaw_left', 'seesaw_right', 'basket']));
  });

  it('anim 갈래는 넘긴 플래그로 고르고, 갈래 layer를 쓴다', () => {
    const m = meta();
    expect(animOf(m, 'magpie', 'ruffle', { 'magpie.on_ground': false })!.anim).toMatchObject({ frames: [5, 6, 5], layer: 'back' });
    expect(animOf(m, 'magpie', 'ruffle', { 'magpie.on_ground': true })!.anim).toMatchObject({ frames: [9, 10], layer: 'front' });
    expect(animOf(m, 'magpie', 'no_such_anim', {})).toBeNull(); // 시트에 없는 anim은 건너뛴다(형식 4절)
    expect(animOf(m, 'jjuk', 'reach_hang_up', {})).toBeNull();
  });

  it('busy 길이 = ms 합을 60Hz 틱으로 올림', () => {
    expect(animTicks({ frames: [0, 0, 0], ms: [80, 80, 80] })).toBe(15); // 240ms = 14.4틱 → 15
    expect(animTicks({ frames: [0], ms: [100] })).toBe(6); // 딱 6틱(부동소수 오차로 7이 되지 않는다)
    expect(animTicks({ frames: [0], ms: [1500] })).toBe(90);
  });

  it('timedFrame: 반복은 감고, 일회는 마지막 칸에 머문다', () => {
    const t = { frames: [1, 2, 3], ms: [1600, 120, 120] };
    expect([0, 1599, 1600, 1720, 1839, 1840].map((ms) => timedFrame(t, ms, true))).toEqual([1, 1, 2, 3, 3, 1]);
    expect(timedFrame(t, 99999, false)).toBe(3);
  });
});

describe('sceneDraws (6절 앞뒤)', () => {
  it('처음 화면: 모두 back(적은 순서), 바구니 앞판은 overlay', () => {
    const m = meta();
    const d = sceneDraws(m, view());
    expect(d.back).toHaveLength(6);
    expect(d.front).toEqual([]);
    expect(d.overlays).toEqual([{ sortY: 236, frame: m.objects[idx(m, 'basket')]!.overlay!.frame }]);
  });

  it('까치가 바닥이면 front, 둥지는 loop 시계로 반짝인다', () => {
    const m = meta();
    const nest = pobj(m, 'nest').default.loop!;
    const d = sceneDraws(m, view({ flagsOf: (k) => ({ 'magpie.on_ground': k === 'magpie', 'nest.key_taken': false }), clockMs: 1650 }));
    expect(d.front).toEqual([pobj(m, 'magpie').states![0]!.loop!.frames[0]]); // 바닥 대기 loop 첫 칸
    expect(d.back[0]).toBe(nest.frames[1]); // 1600~1720ms는 두 번째 칸(작은 별)
  });

  it('anim 재생 중인 물건은 멈춘 모습 대신 anim 프레임(그 layer)을 그린다', () => {
    const m = meta();
    const a = animOf(m, 'magpie', 'fly_down', {})!;
    const d = sceneDraws(m, view({ playing: { object: a.object, anim: a.anim, ms: 150 } }));
    expect(d.front).toEqual([9]);
    expect(d.back).toHaveLength(5); // 둥지 위 까치는 안 그린다
  });
});

describe('loopStarts (#237 물건별 loop 위상)', () => {
  const ground = (k: string) => ({ 'magpie.on_ground': k === 'magpie', 'nest.key_taken': false });
  const magpieAt = (m: SceneArtMeta, v: SceneView) => sceneDraws(m, v).front[0];

  it('anim이 끝난 프레임부터 그 물건 loop를 0으로 센다: fly_down 끝 → 바로 다음은 멈춘 모습 첫 칸', () => {
    const m = meta();
    const groundLoop = pobj(m, 'magpie').states![0]!.loop!;
    // 화면 시계만 쓰면 2300ms는 바닥 loop 두 번째 칸(flick, 2200~2350ms)이다.
    expect(magpieAt(m, view({ flagsOf: ground, clockMs: 2300 }))).toBe(groundLoop.frames[1]);

    const a = animOf(m, 'magpie', 'fly_down', {})!;
    let starts: LoopStarts = {};
    const playing = view({ flagsOf: ground, playing: { object: a.object, anim: a.anim, ms: 150 }, clockMs: 2150 });
    starts = loopStarts(m, playing, starts);
    expect(starts['magpie']!.pic).toBeNull();
    // anim이 끝난 첫 렌더: 시작 시각이 지금으로 바뀌고 첫 칸(= state frame)을 그린다.
    const done = view({ flagsOf: ground, clockMs: 2300 });
    starts = loopStarts(m, done, starts);
    expect(starts['magpie']!.atMs).toBe(2300);
    expect(magpieAt(m, { ...done, loopStarts: starts })).toBe(groundLoop.frames[0]);
    // 2200ms 뒤에 flick, 그 앞까지는 멈춘 모습
    const later = (ms: number) => {
      const v = view({ flagsOf: ground, clockMs: ms });
      starts = loopStarts(m, v, starts);
      return magpieAt(m, { ...v, loopStarts: starts });
    };
    expect(later(2300 + 2199)).toBe(groundLoop.frames[0]);
    expect(later(2300 + 2200)).toBe(groundLoop.frames[1]);
  });

  it('멈춘 모습이 그대로면 시작 시각을 유지하고(같은 객체), 다른 물건은 건드리지 않는다', () => {
    const m = meta();
    const s1 = loopStarts(m, view({ clockMs: 100 }), {});
    const s2 = loopStarts(m, view({ clockMs: 5000 }), s1);
    for (const o of m.objects) expect(s2[o.key]).toBe(s1[o.key]);
    // 까치만 바닥으로 바뀌면 까치만 다시 센다. 둥지는 그대로라 반짝임 박자가 이어진다.
    const s3 = loopStarts(m, view({ flagsOf: ground, clockMs: 6000 }), s2);
    expect(s3['magpie']!.atMs).toBe(6000);
    expect(s3['nest']).toBe(s1['nest']);
  });

  it('loopStarts를 안 넘기면 예전처럼 화면 시계 0부터 센다', () => {
    const m = meta();
    const nest = pobj(m, 'nest').default.loop!;
    expect(sceneDraws(m, view({ clockMs: 1650 })).back[0]).toBe(nest.frames[1]);
    const starts = loopStarts(m, view({ clockMs: 1000 }), {});
    expect(sceneDraws(m, view({ clockMs: 1650, loopStarts: starts })).back[0]).toBe(nest.frames[0]);
  });
});

// ── 장면 연결: 보이는 플래그(4-2절)와 busy 길이(5절)
const data: SceneData = { screen, characters, art: meta() };
const center = (b: { left: number; top: number; width: number; height: number }) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MAGPIE = center({ left: 134, top: 6, width: 24, height: 24 });
const NEST = center({ left: 128, top: 30, width: 36, height: 24 });

function ready(d: SceneData = data): SceneState {
  const s = createScene(d);
  while (isBusy(s)) sceneTick(d, s);
  return s;
}

/** busy가 끝날 때까지 틱마다 (재생 중 이벤트, 그 물건의 보이는 플래그 값)을 모은다. 이벤트가 바뀔 때만 적는다. */
function trace(s: SceneState, key: string, flag: string, d: SceneData = data): string[] {
  const out: string[] = [];
  let last = '';
  while (isBusy(s)) {
    sceneTick(d, s);
    const ev = s.current?.ev;
    const name = !ev ? 'idle' : ev.type === 'anim' ? `${ev.target}.${ev.name}` : ev.type;
    const line = `${name}:${String(shownFlags(s, key)[flag])}`;
    if (line !== last && ev) out.push(line);
    last = line;
  }
  out.push(`end:${String(shownFlags(s, key)[flag])}`);
  return out;
}

describe('보이는 플래그 (형식 기록 4-2절)', () => {
  it('squeak_down (a): 닭 누르기 동안 까치는 둥지, fly_down 시작부터 바닥 → 끝나도 바닥', () => {
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false);
    expect(s.puzzle.flags['magpie.on_ground']).toBe(true); // 판정은 이미 새 플래그
    expect(shownFlags(s, 'magpie')['magpie.on_ground']).toBe(false); // 그림은 아직 둥지
    expect(trace(s, 'magpie', 'magpie.on_ground')).toEqual([
      'ppik.common.squeeze_chicken:false',
      'fx:false',
      'magpie.fly_down:true',
      'say:true',
      'end:true',
    ]);
  });

  it('fly_down이 시트에 있으면 그 길이(200ms → 12틱)가 busy이고 갈래·물건을 들고 있다', () => {
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false);
    while (!(s.current?.ev.type === 'anim' && s.current.ev.target === 'magpie')) sceneTick(data, s);
    expect(s.current.duration).toBe(12);
    expect(s.current.art).toMatchObject({ object: 'magpie', anim: { frames: [5, 9], layer: 'front' } });
  });

  it('시트에 없는 캐릭터 anim은 지금처럼 임시 길이', () => {
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false);
    sceneTick(data, s);
    expect(s.current?.ev).toMatchObject({ type: 'anim', target: 'ppik' });
    expect(s.current?.duration).toBe(TIMING.anim);
    expect(s.current?.art).toBeUndefined();
  });

  it('캐릭터 시트에 그 자세가 있으면 시트 ms 합이 busy 길이다(#182 질문 3)', () => {
    const probe = ready();
    sceneTap(data, probe, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, probe, MAGPIE, 0, false);
    sceneTick(data, probe);
    const name = (probe.current?.ev as { name: string }).name;
    // 750ms = 45틱. 50ms 배수가 아닌 값도 물건 anim과 같이 올림(130ms → 7.8 → 8틱).
    const sheet = (ms: number[]): SpriteMeta => ({ ...PPIK, anims: { ...PPIK.anims, [name]: { frames: ms.map((_, i) => i), ms } } });
    for (const [ms, ticks] of [[[250, 250, 250], 45], [[130], 8]] as const) {
      const d: SceneData = { ...data, sprites: { ppik: sheet([...ms]) } };
      const s = ready(d);
      sceneTap(d, s, center(CHAR_SLOTS.ppik), 0, false);
      sceneTap(d, s, MAGPIE, 0, false);
      sceneTick(d, s);
      expect(s.current?.ev).toMatchObject({ type: 'anim', target: 'ppik', name });
      expect(s.current?.duration).toBe(ticks);
      expect(s.current?.art).toBeUndefined();
    }
  });

  it('캐릭터 시트가 있어도 그 자세가 없으면 임시 길이', () => {
    // 실제 시트에는 squeeze_chicken이 있다(#142). 그 자세만 뺀 시트로 "시트는 있고 자세는 없음"을 만든다.
    const anims = Object.fromEntries(Object.entries(PPIK.anims).filter(([k]) => k !== 'common.squeeze_chicken'));
    const noPose: SpriteMeta = { ...PPIK, anims };
    const d: SceneData = { ...data, sprites: { ppik: noPose } };
    const s = ready(d);
    sceneTap(d, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(d, s, MAGPIE, 0, false);
    sceneTick(d, s);
    expect(s.current?.ev).toMatchObject({ type: 'anim', target: 'ppik', name: 'common.squeeze_chicken' });
    expect(noPose.anims['common.squeeze_chicken']).toBeUndefined();
    expect(s.current?.duration).toBe(TIMING.anim);
  });

  it('실제 삑삑이 시트의 squeeze_chicken은 1000ms = 60틱이다(#142)', () => {
    const d: SceneData = { ...data, sprites: { ppik: PPIK } };
    const s = ready(d);
    sceneTap(d, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(d, s, MAGPIE, 0, false);
    sceneTick(d, s);
    expect(s.current?.ev).toMatchObject({ type: 'anim', target: 'ppik', name: 'common.squeeze_chicken' });
    expect(s.current?.duration).toBe(60);
  });

  it('ruffle 갈래: 처음(둥지 위)은 기본, 까치가 바닥이면 바닥 갈래', () => {
    const s = createScene(data);
    while (!(s.current?.ev.type === 'anim')) sceneTick(data, s);
    expect(s.current.art?.anim.layer).toBe('back'); // onEnter ruffle
    while (isBusy(s)) sceneTick(data, s);
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false); // 내려옴
    while (isBusy(s)) sceneTick(data, s);
    const ground = data.screen.hotspots.magpie!.variants![0]!.box!;
    sceneTap(data, s, center({ left: ground[0], top: ground[1], width: ground[2], height: ground[3] }), 0, false); // 또 꽥
    let ruffle: SceneState['current'] = null;
    while (isBusy(s)) {
      sceneTick(data, s);
      if (s.current?.ev.type === 'anim' && s.current.ev.target === 'magpie') ruffle ??= s.current;
    }
    expect(ruffle?.art?.anim).toMatchObject({ frames: [9, 10], layer: 'front' });
  });

  it('nest_key (b): 열쇠는 reach_hang_up이 끝날 때 둥지에서 빠진다', () => {
    const s = ready();
    // 정답 직전 상태: 까치는 바닥, 쭉이는 고리
    s.puzzle.flags['magpie.on_ground'] = true;
    s.puzzle.at.jjuk = 'hook';
    s.walkers.jjuk.x = data.screen.spots.hook!.x;
    s.walkers.jjuk.y = data.screen.spots.hook!.y;
    s.ui.active = 'jjuk';
    sceneTap(data, s, NEST, 0, false);
    expect(s.puzzle.flags['nest.key_taken']).toBe(true);
    const t = trace(s, 'nest', 'nest.key_taken');
    expect(t[0]).toBe('jjuk.reach_hang_up:false');
    expect(t[1]).toMatch(/:true$/); // reach_hang_up 다음 이벤트부터 열쇠 없음
    expect(t.at(-1)).toBe('end:true');
  });

  it('플래그를 안 바꾸는 행동, 그림 메타가 없는 장면은 기록이 없다(바로 진짜 플래그)', () => {
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.jjuk), 0, false);
    sceneTap(data, s, MAGPIE, 0, false); // 둥지 위 까치에 뻗기: 플래그 그대로
    expect(s.shown).toEqual({});

    const plain: SceneData = { screen, characters };
    const p = ready(plain);
    sceneTap(plain, p, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(plain, p, MAGPIE, 0, false);
    expect(p.shown).toEqual({});
    expect(shownFlags(p, 'magpie')['magpie.on_ground']).toBe(true);
  });

  it('상태는 JSON으로 왕복해도 같다(ADR-0004 결정 2)', () => {
    const s = ready();
    sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(data, s, MAGPIE, 0, false);
    for (let i = 0; i < 40; i++) sceneTick(data, s);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('litFrames (10-1절 호버 외곽선 대상)', () => {
  it('시소는 어느 끝을 가리켜도 널빤지 프레임 전체가 켜진다', () => {
    const m = meta();
    const d = sceneDraws(m, view());
    expect(litFrames(m, d, 'seesaw_left')).toEqual(new Set([12]));
    expect(litFrames(m, d, 'seesaw_right')).toEqual(new Set([12]));
  });

  it('바구니는 몸통과 앞판(overlay)이 함께 켜진다', () => {
    const m = meta();
    const basket = pobj(m, 'basket');
    expect(litFrames(m, sceneDraws(m, view()), 'basket')).toEqual(new Set([basket.default.frame, basket.overlay!.frame]));
  });

  it('loop 물건은 지금 그리는 프레임만 켜진다(둥지 깜빡임 칸)', () => {
    const m = meta();
    // 둥지 loop [0,1,2] ms [1600,120,120] → 1650ms에는 1번 칸
    expect(litFrames(m, sceneDraws(m, view({ clockMs: 1650 })), 'nest')).toEqual(new Set([1]));
  });

  it('시트에 없는 대상(폴백 상자)·캐릭터·대상 없음은 빈 집합', () => {
    const m = meta();
    const d = sceneDraws(m, view());
    expect(litFrames(m, d, 'no_such_target').size).toBe(0);
    expect(litFrames(m, d, 'jjuk').size).toBe(0);
    expect(litFrames(m, d, null).size).toBe(0);
  });
});

// ── 효과 자리(형식 기록 11절, 개정 4). 둥지 다음에 물줄기 자리를 끼우고, 까치가 바닥이면 꺼지게 한 가짜 메타.
function fxMeta(): SceneArtMeta {
  const m = meta();
  m.objects.splice(idx(m, 'nest') + 1, 0, {
    key: 'water',
    ids: [],
    effect: 'fountain_water',
    area: [152, 8, 144, 172],
    colors: [26, 25, 6, 24],
    default: { mode: 'on' },
    states: [{ when: { flags: { 'magpie.on_ground': true } }, mode: 'off' }],
  });
  // 진짜 대상 ID(magpie)로 보내는 효과 anim: 물건 그림이 아니라 효과 자리를 바꾼다(11-3절)
  m.anims['magpie.fly_down'] = { object: 'water', frames: [], ms: [300], layer: 'back', mode: 'stop' };
  return parseSceneArt(clone(m));
}

describe('효과 자리 (형식 기록 11절, 개정 4)', () => {
  it('parse: 효과 자리·효과 anim 모양을 확인한다', () => {
    const bad = (edit: (m: SceneArtMeta & { objects: Record<string, unknown>[] }) => void) => {
      const m = clone(fxMeta()) as SceneArtMeta & { objects: Record<string, unknown>[] };
      edit(m);
      return () => parseSceneArt(m);
    };
    expect(bad(() => {})).not.toThrow();
    const w = 1; // water 자리 번호
    expect(bad((m) => (m.objects[w]!.effect = 'washer_foam'))).toThrow('key·effect');
    expect(bad((m) => (m.objects[w]!.ids = ['magpie']))).toThrow('ids가 빈 배열');
    expect(bad((m) => (m.objects[w]!.default = { mode: 'burst' }))).toThrow('default: mode');
    expect(bad((m) => (m.objects[w]!.colors = [26, 25, 6, 32]))).toThrow('colors');
    expect(bad((m) => (m.anims['magpie.fly_down']!.mode = 'on'))).toThrow("anims['magpie.fly_down'].mode");
    expect(bad((m) => (m.anims['magpie.fly_down']!.frames = [5]))).toThrow('효과 anim 모양');
    expect(bad((m) => (m.anims['nest.x'] = { object: 'nest', frames: [5], ms: [100], layer: 'back', mode: 'stop' }))).toThrow('효과 자리 anim만');
  });

  it('효과 자리는 ID가 없다: objectOf·coveredIds·외곽선에 안 들어간다', () => {
    const m = fxMeta();
    expect(coveredIds(m)).toEqual(coveredIds(meta()));
    const d = sceneDraws(m, view());
    expect(d.byObject.water).toBeUndefined();
    expect(objectOf(m, 'nest')!.key).toBe('nest');
  });

  it('sceneDraws: 적은 자리(둥지 다음)에 효과를 끼우고, 멈춘 모드는 보이는 플래그로 고른다', () => {
    const m = fxMeta();
    const d = sceneDraws(m, view({ clockMs: 1000 }));
    expect(typeof d.back[0]).toBe('number'); // 둥지
    expect(d.back[1]).toEqual({ key: 'water', effect: 'fountain_water', area: [152, 8, 144, 172], colors: [26, 25, 6, 24], mode: 'on', clockMs: 1000, slotMs: 1000, durMs: 0 });
    expect(d.back.filter((f) => typeof f !== 'number')).toHaveLength(1);
    // off는 그리지 않는다
    const off = sceneDraws(m, view({ flagsOf: () => ({ ...screen.flags, 'magpie.on_ground': true }) }));
    expect(off.back.every((f) => typeof f === 'number')).toBe(true);
  });

  it('효과 anim 재생 중이면 연출 모드, 시계는 anim 시작부터, 길이는 ms', () => {
    const m = fxMeta();
    const anim = m.anims['magpie.fly_down']!;
    const d = sceneDraws(m, view({ clockMs: 5000, playing: { object: 'water', anim, ms: 120 } }));
    expect(d.back[1]).toMatchObject({ key: 'water', mode: 'stop', clockMs: 5000, slotMs: 120, durMs: 300 });
    // 까치 물건은 anim을 안 받았으니 멈춘 모습 그대로
    expect(d.back).toContain(pobj(m, 'magpie').default.frame);
  });

  it('효과 자리 시계: 모드가 바뀐 때부터 0으로 센다(loopStarts와 같은 규칙)', () => {
    const m = fxMeta();
    const anim = m.anims['magpie.fly_down']!;
    let st = loopStarts(m, view({ clockMs: 0 }), {});
    st = loopStarts(m, view({ clockMs: 2000, playing: { object: 'water', anim, ms: 0 } }), st);
    const v = view({ clockMs: 2300, flagsOf: () => ({ ...screen.flags, 'magpie.on_ground': false }) });
    st = loopStarts(m, v, st);
    expect(sceneDraws(m, { ...v, loopStarts: st }).back[1]).toMatchObject({ mode: 'on', slotMs: 0 });
  });

  it('보이는 플래그 4-2 (a): 효과 자리는 자기 효과 anim이 시작될 때 바뀐다(첫 anim 끝이 아니라)', () => {
    const d: SceneData = { screen, characters, art: fxMeta() };
    const s = ready(d);
    sceneTap(d, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(d, s, MAGPIE, 0, false);
    expect(trace(s, 'water', 'magpie.on_ground', d)).toEqual(['ppik.common.squeeze_chicken:false', 'fx:false', 'magpie.fly_down:true', 'say:true', 'end:true']);
  });

  it('효과 anim의 busy 길이는 그 ms(300ms → 18틱)이고 재생 중인 물건은 효과 자리다', () => {
    const d: SceneData = { screen, characters, art: fxMeta() };
    const s = ready(d);
    sceneTap(d, s, center(CHAR_SLOTS.ppik), 0, false);
    sceneTap(d, s, MAGPIE, 0, false);
    while (!(s.current?.ev.type === 'anim' && s.current.ev.target === 'magpie')) sceneTick(d, s);
    expect(s.current.duration).toBe(18);
    expect(s.current.art).toMatchObject({ object: 'water', anim: { mode: 'stop' } });
  });
});
