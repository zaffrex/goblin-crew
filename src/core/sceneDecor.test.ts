// 장식 물건 `ids: []`와 anim 원본 `object`(형식 기록 15절, 개정 11, #901).
// laundromat `magpie.key_in`(메타 `object: 'nest'`)과 같은 모양을 화면 1 데이터로 만든다: 까치 대상 anim이 핫스팟 없는 장식을 바꿔 그린다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import { CHAR_SLOTS } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, heldArtView, isBusy, sceneTap, sceneTick, shownFlags, type SceneData, type SceneState } from './scene';
import { animObject, coveredIds, litFrames, objectOf, parseSceneArt, sceneDraws, type SceneArtMeta, type SceneView } from './sceneArt';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const screen = screenJson as unknown as ScreenData;
const characters = charactersJson as CharactersData;

/** 화면 1 시트 + 장식 `perch`(까치 칸 그림을 그대로 씀 = 까치 픽셀 위에 그려짐). `fly_down`은 `perch`를 바꿔 그리고 붙든다. */
function decorMeta(): SceneArtMeta {
  const m = parseSceneArt(clone(sheetJson)) as SceneArtMeta;
  const magpie = m.objects.find((o) => o.key === 'magpie') as { default: { frame: number } };
  const at = m.objects.findIndex((o) => o.key === 'magpie') + 1;
  m.objects.splice(at, 0, { key: 'perch', ids: [], default: { frame: magpie.default.frame, layer: 'back' } });
  m.anims['magpie.fly_down'] = { object: 'perch', frames: [5, 9], ms: [100, 100], layer: 'back', hold: true };
  return parseSceneArt(clone(m));
}

const data: SceneData = { screen, characters, art: decorMeta() };
const center = (b: { left: number; top: number; width: number; height: number }) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MAGPIE = center({ left: 134, top: 6, width: 24, height: 24 });
const view = (over: Partial<SceneView> = {}): SceneView => ({ flagsOf: () => screen.flags ?? {}, playing: null, clockMs: 0, ...over });

function ready(): SceneState {
  const s = createScene(data);
  while (isBusy(s)) sceneTick(data, s);
  return s;
}

/** 삑삑이로 까치를 눌러 `squeak_down`(fly_down이 든 규칙)을 시작한다. */
function squeakDown(): SceneState {
  const s = ready();
  sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
  sceneTap(data, s, MAGPIE, 0, false);
  return s;
}

/** busy가 끝날 때까지 (재생 중 이벤트, 그 물건의 보이는 플래그)를 바뀔 때만 모은다(sceneArt.test.ts `trace`와 같다). */
function trace(s: SceneState, key: string): string[] {
  const out: string[] = [];
  let last = '';
  while (isBusy(s)) {
    sceneTick(data, s);
    const ev = s.current?.ev;
    const name = !ev ? 'idle' : ev.type === 'anim' ? `${ev.target}.${ev.name}` : ev.type;
    const line = `${name}:${String(shownFlags(s, key)['magpie.on_ground'])}`;
    if (line !== last && ev) out.push(line);
    last = line;
  }
  out.push(`end:${String(shownFlags(s, key)['magpie.on_ground'])}`);
  return out;
}

describe('장식 물건 (형식 기록 15절, 개정 11)', () => {
  it('parse: 그림 물건 ids []를 받는다. 대상을 안 맡아서 coveredIds·objectOf에 안 나온다', () => {
    const m = data.art!;
    expect(m.objects.find((o) => o.key === 'perch')!.ids).toEqual([]);
    expect(coveredIds(m).has('perch')).toBe(false);
    for (const id of coveredIds(m)) expect(objectOf(m, id)?.key).not.toBe('perch');
  });

  it('animObject: 메타 object가 그림 물건이면 그것, 아니면 대상의 물건', () => {
    const m = data.art!;
    expect(animObject(m, 'magpie', 'fly_down')?.key).toBe('perch');
    expect(animObject(m, 'magpie', 'no_such_anim')?.key).toBe('magpie');
    expect(animObject(m, 'seesaw_right', 'plank_bounce')?.key).toBe('seesaw');
  });

  it('4-2 (a): 장식은 자기 anim(fly_down) 시작 때 바뀐다', () => {
    expect(trace(squeakDown(), 'perch')).toEqual(['ppik.common.squeeze_chicken:false', 'fx:false', 'magpie.fly_down:true', 'ppik.common.shiver:true', 'say:true', 'end:true']);
  });

  it('4-2 (b): 대상 물건(까치)은 그 anim을 자기 것으로 안 봐서 첫 anim 끝에 바뀐다', () => {
    expect(trace(squeakDown(), 'magpie')).toEqual(['ppik.common.squeeze_chicken:false', 'fx:true', 'magpie.fly_down:true', 'ppik.common.shiver:true', 'say:true', 'end:true']);
  });

  it('재생·붙듦은 장식 물건 키로 잡힌다(까치는 멈춘 모습 그대로)', () => {
    const s = squeakDown();
    while (!(s.current?.ev.type === 'anim' && s.current.ev.target === 'magpie')) sceneTick(data, s);
    expect(s.current.art).toMatchObject({ object: 'perch', anim: { frames: [5, 9] } });
    while (s.current?.ev.type === 'anim' && s.current.ev.target === 'magpie') sceneTick(data, s);
    expect(Object.keys(heldArtView(s))).toEqual(['perch']);
  });

  it('장식 픽셀 위를 눌러도 아래 대상(까치)이 받는다. 호버 외곽선에도 장식은 안 켜진다(Luna 조건)', () => {
    const m = data.art!;
    const d = sceneDraws(m, view());
    const perchFrame = d.byObject['perch']![0]!;
    const f = m.frames[perchFrame]!;
    expect(f.at[0] <= MAGPIE.x && MAGPIE.x < f.at[0] + f.src[2] && f.at[1] <= MAGPIE.y && MAGPIE.y < f.at[1] + f.src[3]).toBe(true); // 누르는 점이 장식 그림 안
    const s = squeakDown();
    expect(s.puzzle.flags['magpie.on_ground']).toBe(true);
    expect(litFrames(m, d, 'magpie')).toEqual(new Set(d.byObject['magpie']));
  });
});
