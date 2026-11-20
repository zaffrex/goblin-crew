// 칸 신호가 물건 anim을 겹쳐 시작한다(#507). 화면 2 보조 단서 ①(자명종)·③(관리인 창)에서
// "장대가 닿는 칸 = 글자 + 물건 반응"이 같은 프레임에 보이는지 본다. 판정(읽히는지)은 #468 블라인드 캡처가 한다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/park_fountain.json';
import artJson from '../../public/scenes/park_fountain-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { TICK_MS } from './config';
import type { CharactersData, ScreenData } from './puzzle/types';
import { activeFx, charFacing, charPose, createScene, cuedArtView, heldArtView, isBusy, runAction, sceneTick, type SceneData, type SceneState } from './scene';
import { parseSceneArt, sceneDraws, type SceneView } from './sceneArt';
import { parseSpriteMeta, spritePole } from './sprite';

const art = parseSceneArt(artJson);
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData, art, sprites };
const WOBBLE = 'common.reach_wobble';
/** reach_wobble 1번 칸 시작(300ms = 18틱) = 장대가 다 늘어난 틱(`claw.growMs` 300). */
const TOUCH_TICK = 18;

type Rect = { left: number; top: number; width: number; height: number };
const overlap = (a: Rect, b: Rect): { w: number; h: number } => ({
  w: Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left),
  h: Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top),
});
/** 물건의 멈춘 모습 칸 그림 상자(시트 `frames[].at` + 크기). */
function restRect(key: string): Rect {
  const o = art.objects.find((x) => x.key === key)!;
  const f = (artJson as { frames: { src: number[]; at: number[] }[] }).frames[(o as { default: { frame: number } }).default.frame]!;
  return { left: f.at[0]!, top: f.at[1]!, width: f.src[2]!, height: f.src[3]! };
}

function ready(): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 3000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
  return s;
}
const wobbleT = (s: SceneState): number | null =>
  s.current?.ev.type === 'anim' && s.current.ev.target === 'jjuk' && s.current.ev.name === WOBBLE ? s.current.t : null;
function untilWobble(s: SceneState, t: number): void {
  for (let i = 0; i < 3000 && wobbleT(s) !== t; i++) sceneTick(data, s);
  expect(wobbleT(s)).toBe(t);
}
function view(s: SceneState): SceneView {
  return { flagsOf: () => ({}), playing: null, cued: cuedArtView(s), held: heldArtView(s), clockMs: s.tick * TICK_MS };
}

describe('칸 신호 → 물건 anim (#507, scene.ts fireCue)', () => {
  it('맨 앞이 물건 anim이면 신호 틱에 겹쳐 시작하고, 캐릭터 연출은 그대로 이어진다', () => {
    const s = ready();
    s.queue.push(
      { type: 'anim', target: 'jjuk', name: WOBBLE },
      { type: 'fx', effect: 'stretch_text', target: 'alarm_clock' },
      { type: 'anim', target: 'alarm_clock', name: 'spring' },
      { type: 'say', speaker: 'jjuk', text: 'x' },
    );
    untilWobble(s, TOUCH_TICK - 1);
    expect(s.overlays.map((o) => o.ev.type)).toEqual(['fx']);
    sceneTick(data, s);
    expect(wobbleT(s)).toBe(TOUCH_TICK);
    expect(s.overlays.map((o) => o.ev.type)).toEqual(['fx', 'anim']);
    expect(s.queue.map((e) => e.type)).toEqual(['say']);
    expect(cuedArtView(s)).toMatchObject({ alarm_clock: { ms: 0 } });
    // 같은 틱에 ビヨーン도 떠 있다(0번 칸에 뜬 36틱 중 18틱째).
    expect(activeFx(s)).toContainEqual({ effect: 'stretch_text', target: 'alarm_clock', t: TOUCH_TICK });
    // 그리는 쪽: 자명종은 멈춘 모습이 아니라 spring 첫 칸이다.
    const spring = art.anims['alarm_clock.spring']!;
    expect(sceneDraws(art, view(s)).byObject.alarm_clock).toEqual([spring.frames[0]]);
  });

  it('겹친 물건 anim이 끝나면 `hold`를 붙들고, 대기열이 다 끝나면 놓는다', () => {
    const s = ready();
    s.queue.push(
      { type: 'anim', target: 'jjuk', name: WOBBLE },
      { type: 'fx', effect: 'stretch_text', target: 'alarm_clock' },
      { type: 'anim', target: 'alarm_clock', name: 'spring' },
    );
    untilWobble(s, TOUCH_TICK);
    for (let i = 0; i < 3000 && s.overlays.some((o) => o.art); i++) sceneTick(data, s);
    expect(cuedArtView(s)).toEqual({});
    expect(heldArtView(s)).toHaveProperty('alarm_clock');
    for (let i = 0; i < 3000 && isBusy(s); i++) sceneTick(data, s);
    sceneTick(data, s);
    expect(heldArtView(s)).toEqual({});
  });

  it('신호 뒤가 캐릭터 연출이면 겹치지 않는다(차례 그대로)', () => {
    const s = ready();
    s.queue.push({ type: 'anim', target: 'jjuk', name: WOBBLE }, { type: 'fx', effect: 'stretch_text', target: 'jjuk' }, { type: 'anim', target: 'mukjik', name: 'common.stomp' });
    untilWobble(s, TOUCH_TICK + 1);
    expect(s.overlays.map((o) => o.ev.type)).toEqual(['fx']);
    expect(s.queue.map((e) => e.type)).toEqual(['anim']);
  });
});

describe('화면 2 장대 단서: 닿는 칸에 글자·반응이 같이 (#507)', () => {
  const cases = [
    { target: 'alarm_clock', rect: restRect('alarm_clock'), fx: { effect: 'stretch_text', target: 'alarm_clock' }, anim: 'alarm_clock.spring' },
    { target: 'keeper', rect: restRect('keeper'), fx: { effect: 'stretch_text', target: 'jjuk' }, anim: 'keeper.curtain' },
  ] as const;
  for (const c of cases) {
    it(`${c.target} × stretch: 닿는 틱에 집게가 그림과 4×4 이상 겹치고, ${c.fx.effect}와 ${c.anim}이 같이 보인다`, () => {
      const s = ready();
      runAction(data, s, { char: 'jjuk', verb: 'stretch', target: c.target }, null);
      untilWobble(s, TOUCH_TICK);
      const w = s.walkers.jjuk;
      const pole = spritePole(sprites.jjuk, charPose(data, s, 'jjuk'), w.x, w.y, charFacing(data, s, 'jjuk'));
      expect(pole, '장대를 이어야 한다').not.toBeNull();
      const claw = { left: pole!.clawLeft, top: pole!.clawTop, width: 8, height: 8 };
      const o = overlap(claw, c.rect);
      expect(o.w, JSON.stringify({ claw, rect: c.rect })).toBeGreaterThanOrEqual(4);
      expect(o.h, JSON.stringify({ claw, rect: c.rect })).toBeGreaterThanOrEqual(4);
      expect(activeFx(s)).toContainEqual(expect.objectContaining(c.fx));
      expect(s.overlays.find((x) => x.art)?.art?.anim).toBe(art.anims[c.anim]);
    });
  }
});
