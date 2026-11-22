// n번째 anim 변형(#765 2/2, ADR-0761 H5 "두 번째부터는 짧은 판"). 같은 규칙·폴백이 k번째 이상 돌면 그림 쪽 `이름#k`를 쓴다.
// 첫 예: `magpie_nest` 규칙 4(삑 → 까치 내려옴)의 삑삑이 움찔 `common.shiver` → 두 번째부터 `common.shiver#2`(1100ms → 500ms).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import magpieJson from '../../content/screens/magpie_nest.json';
import jaJson from '../../content/text/ja.json';
import magpieArt from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import type { Action, CharactersData, ScreenData } from './puzzle/types';
import { createScene, isBusy, nthAnim, runAction, sceneTick, type SceneData, type SceneState } from './scene';
import { parseSceneArt } from './sceneArt';
import { parseNthName, parseSpriteMeta } from './sprite';

const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = {
  screen: magpieJson as unknown as ScreenData,
  characters: charactersJson as CharactersData,
  art: parseSceneArt(magpieArt),
  sprites,
  texts: jaJson as Record<string, string>,
};

const SQUEAK_DOWN: Action = { char: 'ppik', verb: 'squeak', target: 'magpie' };
const STOMP_BACK: Action = { char: 'mukjik', verb: 'stomp', target: 'magpie' };

/** 행동 하나를 끝까지 보고, 그동안 시작한 삑삑이 anim 이름과 그 busy 길이(틱)를 시작 순서대로 돌려준다. */
function play(s: SceneState, a: Action): { name: string; ticks: number }[] {
  runAction(data, s, a, null);
  const out: { name: string; ticks: number }[] = [];
  let seq = -1;
  for (let i = 0; i < 5000 && isBusy(s); i++) {
    sceneTick(data, s);
    const c = s.current;
    if (c && c.ev.type === 'anim' && c.ev.target === 'ppik' && c.seq !== seq) {
      seq = c.seq;
      out.push({ name: c.ev.name, ticks: c.duration ?? -1 });
    }
  }
  expect(isBusy(s)).toBe(false);
  return out;
}

function fresh(): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  return s;
}

const shiverOf = (xs: { name: string; ticks: number }[]) => xs.find((x) => x.name.startsWith('common.shiver'))!;

describe('n번째 anim 변형 (#765 2/2)', () => {
  it('규칙 4 삑 → 까치 내려옴: 첫 번째는 원래 움찔, 두 번째부터 짧은 판(0.6초 짧음)', () => {
    const s = fresh();
    const first = shiverOf(play(s, SQUEAK_DOWN));
    expect(s.puzzle.flags['magpie.on_ground']).toBe(true);
    play(s, STOMP_BACK);
    expect(s.puzzle.flags['magpie.on_ground']).toBe(false);
    const second = shiverOf(play(s, SQUEAK_DOWN));
    play(s, STOMP_BACK);
    const third = shiverOf(play(s, SQUEAK_DOWN));
    expect(first.name).toBe('common.shiver');
    expect(second.name).toBe('common.shiver#2');
    // `#3`이 없으면 세 번째도 가장 가까운 아래 변형(`#2`)이다.
    expect(third.name).toBe('common.shiver#2');
    // 1100ms = 66틱, 500ms = 30틱.
    expect(first.ticks - second.ticks).toBe(36);
  });

  it('같은 규칙이 아니면 세지 않는다: 첫 삑 앞에 다른 행동이 있어도 첫 움찔은 원래 판', () => {
    const s = fresh();
    play(s, { char: 'jjuk', verb: 'stretch', target: 'nest' });
    expect(shiverOf(play(s, SQUEAK_DOWN)).name).toBe('common.shiver');
  });

  it('새 판(처음부터)은 횟수가 지워져 다시 원래 판이다(대사 변형과 같다)', () => {
    const s = fresh();
    play(s, SQUEAK_DOWN);
    play(s, STOMP_BACK);
    expect(shiverOf(play(s, SQUEAK_DOWN)).name).toBe('common.shiver#2');
    expect(shiverOf(play(fresh(), SQUEAK_DOWN)).name).toBe('common.shiver');
  });

  it('결정성: 같은 행동 열은 같은 끝 상태(틱 포함)', () => {
    const run = (): SceneState => {
      const s = fresh();
      for (const a of [SQUEAK_DOWN, STOMP_BACK, SQUEAK_DOWN, STOMP_BACK, SQUEAK_DOWN]) play(s, a);
      return s;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it('nthAnim: k ≤ n 중 가장 큰 변형, 없으면 그대로. 물건 메타 `대상.이름#k`도 본다', () => {
    const ppik = sprites.ppik;
    const anims = { ...ppik.anims, 'common.shiver#4': ppik.anims['common.shiver#2']! };
    const d: SceneData = { ...data, sprites: { ...sprites, ppik: { ...ppik, anims } } };
    expect(nthAnim(d, 'ppik', 'common.shiver', 1)).toBe('common.shiver');
    expect(nthAnim(d, 'ppik', 'common.shiver', 3)).toBe('common.shiver#2');
    expect(nthAnim(d, 'ppik', 'common.shiver', 4)).toBe('common.shiver#4');
    expect(nthAnim(d, 'ppik', 'common.shiver', 9)).toBe('common.shiver#4');
    expect(nthAnim(d, 'ppik', 'common.zap', 2)).toBe('common.zap');
    expect(nthAnim(d, 'magpie', 'fly_down', 2)).toBe('fly_down');
    const art = parseSceneArt({ ...magpieArt, anims: { ...magpieArt.anims, 'magpie.fly_down#2': magpieArt.anims['magpie.fly_down'] } });
    expect(nthAnim({ ...data, art }, 'magpie', 'fly_down', 2)).toBe('fly_down#2');
  });
});

describe('n번째 변형 이름·메타 검사 (#765 2/2)', () => {
  it('parseNthName: `이름#k`, k ≥ 2, 앞자리 0 없음', () => {
    expect(parseNthName('common.shiver#2')).toEqual({ base: 'common.shiver', k: 2 });
    expect(parseNthName('a#12')).toEqual({ base: 'a', k: 12 });
    expect(parseNthName('common.shiver')).toBeNull();
    expect(parseNthName('a#1')).toBeNull();
    expect(parseNthName('a#02')).toBeNull();
    expect(parseNthName('#2')).toBeNull();
  });

  const withAnim = (name: string, a: unknown): unknown => ({ ...ppikJson, anims: { ...ppikJson.anims, [name]: a } });
  it('캐릭터 시트: 원래 자세가 없거나 끝 칸이 다르면 거부', () => {
    expect(() => parseSpriteMeta(withAnim('nope#2', { frames: [26], ms: [100] }))).toThrow(/원래 자세/);
    expect(() => parseSpriteMeta(withAnim('common.shiver#2', { frames: [26, 27], ms: [100, 100] }))).toThrow(/끝 칸/);
    expect(() => parseSpriteMeta(withAnim('common.shiver#3', { frames: [27, 28], ms: [100, 300] }))).not.toThrow();
  });

  it('물건 메타: 원래 anim이 없거나 object·hold가 다르면 거부', () => {
    const base = magpieArt.anims['magpie.fly_down'];
    const art = (name: string, a: unknown): unknown => ({ ...magpieArt, anims: { ...magpieArt.anims, [name]: a } });
    expect(() => parseSceneArt(art('magpie.nope#2', base))).toThrow(/원래 anim/);
    expect(() => parseSceneArt(art('magpie.fly_down#2', { ...base, hold: true }))).toThrow(/object·hold/);
    expect(() => parseSceneArt(art('magpie.fly_down#2', base))).not.toThrow();
  });
});
