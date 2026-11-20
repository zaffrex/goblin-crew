// 반응 그림이 행동한 사람 몸에 가려지지 않는지 본다(#527). 화면 2 `alarm_clock.fall`은 엔진에서 약 4.9초 붙들려
// 그려졌지만(`hold`), 쓰러진 칸(92,188 19×12)이 ズッシー 설 곳(x 92) 몸 상자 70..109 × 183..244 뒤(`layer: 'back'`)라
// 블라인드 캡처에서 "자명종이 떨어졌다"가 안 읽혔다. 그림이 맞게 읽히는지는 사람이 캡처로 본다. 이 테스트는 "가려서 아예 안 보이는 것"만 잡는다.
//
// 방법: 시작 상태와 정답 경로 중간 상태마다, 모든 핫스팟 × 세 사람 특기를 실제 `runAction`으로 돌리고 연출이 끝날 때까지 틱한다.
// 틱마다 재생·칸 신호·붙든 물건 anim 중 `back` 층 칸의 그림 상자가 세 사람 몸 상자(`characterHitBox`) 밖으로 몇 %
// 나오는지 세고, 그 anim이 보이는 동안 가장 많이 나온 값이 기준 미만이면 실패다. 몸 상자는 실제 실루엣보다 조금 크고,
// 칸 상자는 투명 픽셀을 포함한다. 그래서 대략값이고, 기준을 넉넉히(절반) 잡았다.
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { characterDef, characterHitBox } from '../core/characters';
import { TICK_MS } from '../core/config';
import type { CharactersData, ScreenData } from '../core/puzzle/types';
import { charFacing, createScene, cuedArtView, heldArtView, isBusy, runAction, sceneTick, shownFlags, type SceneData, type SceneState } from '../core/scene';
import { parseSceneArt, sceneDraws, type SceneView } from '../core/sceneArt';
import { parseSpriteMeta } from '../core/sprite';

/** 반응 칸이 이 비율 이상 몸 밖으로 나온 틱이 한 번은 있어야 한다. */
const MIN_VISIBLE = 0.5;

/**
 * 알고 있는 가림(이슈가 열려 있는 것). 키는 `화면 사람 특기 대상 → anim`.
 * 고쳐지면 아래 "아직 가려진다" 테스트가 실패하니 그때 이 줄을 지운다.
 */
const KNOWN: Record<string, string> = {};

const characters = charactersJson as CharactersData;
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
type Frames = { frames: { src: number[]; at: number[] }[] };
const baseName = (path: string, tail: string): string => path.replace(/^.*\//, '').replace(tail, '');
const SCREEN_JSON = Object.fromEntries(
  Object.entries(import.meta.glob<ScreenData>('../../content/screens/*.json', { eager: true, import: 'default' })).map(([p, v]) => [baseName(p, '.json'), v]),
);
/** 물건 시트가 있는 화면만(그림 없는 화면은 임시 상자라 가림을 따질 그림이 없다). */
const ART_JSON = Object.entries(import.meta.glob<Frames>('../../public/scenes/*-objects.json', { eager: true, import: 'default' })).map(
  ([p, v]) => [baseName(p, '-objects.json'), v] as const,
);
const PEOPLE = [
  { char: 'jjuk', verb: 'stretch' },
  { char: 'mukjik', verb: 'stomp' },
  { char: 'ppik', verb: 'squeak' },
] as const;

type Rect = { left: number; top: number; width: number; height: number };
/** 칸 상자 중 몸 상자들 밖에 있는 픽셀 비율. */
function visibleShare(r: Rect, bodies: readonly Rect[]): number {
  let out = 0;
  for (let y = r.top; y < r.top + r.height; y++) {
    for (let x = r.left; x < r.left + r.width; x++) {
      if (!bodies.some((b) => x >= b.left && x < b.left + b.width && y >= b.top && y < b.top + b.height)) out++;
    }
  }
  return out / (r.width * r.height);
}

function settle(data: SceneData, s: SceneState): void {
  for (let i = 0; i < 20_000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}

/** 행동 하나를 끝까지 돌리며 `물건 anim → 가장 많이 보인 비율`을 모은다. */
function reactions(data: SceneData, raw: Frames, s: SceneState, action: { char: string; verb: string; target: string }): Map<string, number> {
  const art = data.art!;
  const best = new Map<string, number>();
  runAction(data, s, action as Parameters<typeof runAction>[2], null);
  for (let i = 0; i < 20_000 && isBusy(s); i++) {
    sceneTick(data, s);
    const p = s.current?.art ? { ...s.current.art, ms: s.current.t * TICK_MS } : null;
    const cued = cuedArtView(s);
    const held = heldArtView(s);
    const view: SceneView = { flagsOf: (k) => shownFlags(s, k), playing: p, cued, held, clockMs: s.tick * TICK_MS };
    const draws = sceneDraws(art, view);
    const bodies = PEOPLE.map(({ char }) => {
      const w = s.walkers[char as keyof typeof s.walkers];
      return characterHitBox(characterDef(char), w.x, w.y, charFacing(data, s, char as Parameters<typeof charFacing>[2]));
    });
    for (const o of art.objects) {
      const a = p?.object === o.key ? p : (cued[o.key] ?? held[o.key]);
      if (!a || a.anim.layer !== 'back') continue;
      const frame = draws.byObject[o.key]?.[0];
      const f = frame === undefined ? undefined : raw.frames[frame];
      if (!f) continue;
      const share = visibleShare({ left: f.at[0]!, top: f.at[1]!, width: f.src[2]!, height: f.src[3]! }, bodies);
      const name = Object.entries(art.anims).find(([, v]) => v === a.anim || (v as { variants?: unknown[] }).variants?.includes(a.anim))?.[0] ?? `${o.key}.?`;
      best.set(name, Math.max(best.get(name) ?? 0, share));
    }
  }
  return best;
}

it('물건 시트가 있는 화면이 있고, 모두 화면 JSON이 있다', () => {
  expect(ART_JSON.length).toBeGreaterThan(0);
  for (const [id] of ART_JSON) expect(SCREEN_JSON[id], id).toBeDefined();
});

for (const [id, raw] of ART_JSON) {
  const screen = SCREEN_JSON[id];
  if (!screen) continue;
  const solution = screen.solution ?? [];
  const data: SceneData = { screen, characters, art: parseSceneArt(raw), sprites };
  /** 정답 경로의 i번째 행동 직전 상태(마지막 행동 뒤는 클리어라 뺀다). */
  const prefix = (i: number): SceneState => {
    const s = createScene(data);
    settle(data, s);
    for (const a of solution.slice(0, i)) {
      runAction(data, s, a, null);
      settle(data, s);
    }
    return s;
  };

  describe(`${id}: 반응 그림이 몸에 가려지지 않는다 (#527)`, () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < solution.length; i++) {
      for (const target of Object.keys(screen.hotspots)) {
        for (const { char, verb } of PEOPLE) {
          const s = prefix(i);
          for (const [name, share] of reactions(data, raw, s, { char, verb, target })) {
            const key = `${id} ${char} ${verb} ${target} → ${name}`;
            seen.set(key, Math.min(seen.get(key) ?? 1, share));
          }
        }
      }
    }

    it(`칸이 ${MIN_VISIBLE * 100}% 이상 몸 밖으로 나오는 틱이 있다 (알려진 것 제외)`, () => {
      expect(seen.size).toBeGreaterThan(0);
      const bad = [...seen].filter(([k, v]) => v < MIN_VISIBLE && !(k in KNOWN)).map(([k, v]) => `${k}: ${Math.round(v * 100)}%`);
      expect(bad).toEqual([]);
    });

    it('알려진 가림은 아직 가려진다 (고쳐졌으면 KNOWN에서 지운다)', () => {
      const mine = Object.keys(KNOWN).filter((k) => k.startsWith(`${id} `));
      for (const k of mine) {
        expect(seen.has(k), `${k}: 이 반응이 더는 안 나온다`).toBe(true);
        expect(seen.get(k)!, k).toBeLessThan(MIN_VISIBLE);
      }
    });
  });
}
