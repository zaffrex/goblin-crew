// 머리 위 anim `anchor`(형식 기록 16절, 개정 12, #901).
// laundromat ★① "양말이 ズッシー 머리에"와 같은 모양을 화면 1 데이터로 만든다: 까치 대상 anim이 평소 안 보이는 장식 `sock`을
// 묵직이(mukjik) 얼굴 상자 위 가운데 기준으로 그리고, `hold`라 대기열이 빌 때까지 남는다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import { characterDef, characterFaceBox } from './characters';
import { CHAR_SLOTS } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import { charFacing, createScene, headAnchor, isBusy, sceneArtView, sceneTap, sceneTick, type SceneData, type SceneState } from './scene';
import { animFrameBox, animOf, coverFrames, headPlace, litFrames, parseSceneArt, sceneDraws, type SceneArtMeta, type SceneView } from './sceneArt';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const screen = screenJson as unknown as ScreenData;
const characters = charactersJson as CharactersData;

/** 화면 1 시트 + 장식 `sock`(평소 안 그림). `magpie.fly_down`을 머리 위 anim으로 바꾼다. 칸은 5번 그림을 머리 기준 (-8, -14)에. */
function headMeta(): { meta: SceneArtMeta; sockFrame: number } {
  const m = clone(sheetJson) as unknown as SceneArtMeta;
  const sockFrame = m.frames.length;
  m.frames.push({ src: [...m.frames[5]!.src], at: [-8, -14] });
  m.objects.push({ key: 'sock', ids: [], default: { frame: null, layer: 'front' } });
  m.anims['magpie.fly_down'] = { object: 'sock', frames: [sockFrame], ms: [100], layer: 'front', hold: true, anchor: { char: 'mukjik', point: 'head' } };
  return { meta: parseSceneArt(m), sockFrame };
}

const { meta, sockFrame } = headMeta();
const data: SceneData = { screen, characters, art: meta };
const center = (b: { left: number; top: number; width: number; height: number }) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const MAGPIE = center({ left: 134, top: 6, width: 24, height: 24 });
const view = (over: Partial<SceneView> = {}): SceneView => ({ flagsOf: () => screen.flags ?? {}, playing: null, clockMs: 0, ...over });

function squeakDown(): SceneState {
  const s = createScene(data);
  while (isBusy(s)) sceneTick(data, s);
  sceneTap(data, s, center(CHAR_SLOTS.ppik), 0, false);
  sceneTap(data, s, MAGPIE, 0, false);
  return s;
}

const playingFlyDown = (s: SceneState): boolean => s.current?.ev.type === 'anim' && s.current.ev.target === 'magpie' && s.current.ev.name === 'fly_down';

describe('머리 위 anim (형식 기록 16절, 개정 12)', () => {
  it('parse: 장식 물건만 default frame null, anchor는 캐릭터 ID·head·front 그림 anim', () => {
    const bad = (edit: (m: SceneArtMeta) => void) => () => {
      const m = clone(meta);
      edit(m);
      parseSceneArt(m);
    };
    expect(bad(() => {})).not.toThrow();
    expect(bad((m) => (m.objects.find((o) => o.key === 'nest')!.default = { frame: null, layer: 'back' }))).toThrow(/default/);
    expect(bad((m) => (m.anims['magpie.fly_down']!.anchor = { char: 'nobby' as never, point: 'head' }))).toThrow(/anchor/);
    expect(bad((m) => (m.anims['magpie.fly_down']!.anchor = { char: 'ppik', point: 'foot' as never }))).toThrow(/anchor/);
    expect(bad((m) => (m.anims['magpie.fly_down']!.layer = 'back'))).toThrow(/anchor/);
    expect(bad((m) => (m.anims['magpie.fly_down']!.variants = [{ when: { flags: {} }, frames: [sockFrame], ms: [100], layer: 'front', anchor: { char: 'ppik', point: 'head' } }]))).toThrow(/anim에만/);
  });

  it('평소: 장식은 아무것도 안 그리고 머리 위 칸도 없다', () => {
    const d = sceneDraws(meta, view());
    expect(d.byObject['sock']).toEqual([]);
    expect(d.heads).toEqual([]);
    expect([...d.back, ...d.front]).not.toContain(sockFrame);
  });

  it('재생 중: 칸은 heads로만 간다. front·외곽선·덮개·말풍선 상자에서 빠진다', () => {
    const anim = meta.anims['magpie.fly_down']!;
    const v = view({ playing: { object: 'sock', anim, ms: 0 } });
    const d = sceneDraws(meta, v);
    expect(d.heads).toEqual([{ frame: sockFrame, char: 'mukjik' }]);
    expect(d.front).not.toContain(sockFrame);
    expect(d.byObject['sock']).toEqual([]);
    expect(litFrames(meta, d, 'magpie').has(sockFrame)).toBe(false);
    expect(coverFrames(meta, v).front).not.toContain(sockFrame);
    expect(animFrameBox(meta, view({ held: { magpie: { anim, ms: 500 } } }), 'magpie')).toBeNull();
  });

  it('갈래(4-1절)는 anim의 anchor를 물려받는다', () => {
    const m = clone(meta);
    m.anims['magpie.fly_down']!.variants = [{ when: { flags: { 'magpie.on_ground': false } }, frames: [sockFrame, sockFrame], ms: [50, 50], layer: 'front' }];
    const got = animOf(parseSceneArt(m), 'magpie', 'fly_down', { 'magpie.on_ground': false });
    expect(got?.anim).toMatchObject({ frames: [sockFrame, sockFrame], hold: true, anchor: { char: 'mukjik', point: 'head' } });
  });

  it('headPlace: 얼굴 상자 위 가운데 + at. 왼쪽을 보면 가운데 세로줄로 뒤집는다', () => {
    const face = { left: 100, top: 50, width: 24, height: 24 };
    const w = meta.frames[sockFrame]!.src[2];
    expect(headPlace(meta, sockFrame, face, 1)).toEqual({ x: 112 - 8, y: 36, w, h: meta.frames[sockFrame]!.src[3], flip: false });
    expect(headPlace(meta, sockFrame, face, -1)).toMatchObject({ x: 112 + 8 - w, y: 36, flip: true });
    expect(headPlace(meta, 999, face, 1)).toBeNull();
  });

  it('장면: 재생 중·붙든 동안 묵직이 머리 위에 있고, 대기열이 비면 사라진다', () => {
    const s = squeakDown();
    while (!playingFlyDown(s)) sceneTick(data, s);
    expect(sceneDraws(meta, sceneArtView(data, s)).heads).toEqual([{ frame: sockFrame, char: 'mukjik' }]);
    while (playingFlyDown(s)) sceneTick(data, s);
    expect(isBusy(s)).toBe(true); // 뒤에 shiver·say가 남아 있다
    expect(sceneDraws(meta, sceneArtView(data, s)).heads).toEqual([{ frame: sockFrame, char: 'mukjik' }]);
    while (isBusy(s)) sceneTick(data, s);
    expect(sceneDraws(meta, sceneArtView(data, s)).heads).toEqual([]);
  });

  it('headAnchor: 그리는 자리(발 + 판 높이, charFacing)의 얼굴 상자', () => {
    const s = squeakDown();
    const w = s.walkers.mukjik;
    const facing = charFacing(data, s, 'mukjik');
    expect(headAnchor(data, s, 'mukjik')).toEqual({ face: characterFaceBox(characterDef('mukjik'), w.x, w.y, facing), facing });
  });
});
