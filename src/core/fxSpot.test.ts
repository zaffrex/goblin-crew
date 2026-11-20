// 소리 글자 자리 예외(#530 할 일 3, #528): `효과@대상` 키와 `'actor'`(행동한 캐릭터 쪽 대상 끝).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/park_fountain.json';
import artJson from '../../public/scenes/park_fountain-objects.json';
// eslint-disable-next-line no-restricted-imports -- public/ui는 에셋 JSON이다(src/ui 아님). ADR-0004 규칙이 경로 패턴으로 같이 걸린다.
import fxRaw from '../../public/ui/fx-text.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { INTERNAL_WIDTH } from './config';
import { ACTOR_EDGE_GAP, actorEdgeAt, fxTextSpot } from './fx';
import { fxTextAt, parseFxTextMeta } from './fxText';
import type { CharactersData, ScreenData } from './puzzle/types';
import { activeFx, createScene, isBusy, runAction, sceneTick, type SceneData, type SceneState } from './scene';
import { parseSceneArt } from './sceneArt';
import { parseSpriteMeta } from './sprite';

const fxMeta = parseFxTextMeta(fxRaw);
const RIM = { left: 128, top: 180, width: 192 };

describe('fxTextSpot', () => {
  it('`효과@대상`이 먼저, 그다음 대상 전체, 없으면 null', () => {
    expect(fxTextSpot('squeak_text', 'nest')).toEqual({ x: 188, y: 46 });
    expect(fxTextSpot('clang_text', 'fountain')).toBe('actor');
    expect(fxTextSpot('gon_text', 'fountain')).toEqual({ x: 266, y: 198 });
    // 같은 테두리라도 물소리 シャー·작은 삑은 그대로 위 끝 가운데
    expect(fxTextSpot('shaa_text', 'fountain')).toBeNull();
    expect(fxTextSpot('small_squeak_text', 'fountain')).toBeNull();
    expect(fxTextSpot('clang_text', 'alarm_clock')).toBeNull();
  });
});

describe('actorEdgeAt', () => {
  const w = 25;
  const half = w / 2 + ACTOR_EDGE_GAP;
  it('캐릭터가 상자 오른쪽 밖이면 칸 오른쪽 끝이 상자 오른쪽 끝 − 틈', () => {
    const at = actorEdgeAt(RIM, 336, w);
    expect(at).toEqual({ x: 320 - half, y: 180 });
  });
  it('왼쪽 밖이면 칸 왼쪽 끝이 상자 왼쪽 끝 + 틈', () => {
    expect(actorEdgeAt(RIM, 100, w)).toEqual({ x: 128 + half, y: 180 });
  });
  it('상자 안이면 캐릭터 x 그대로', () => {
    expect(actorEdgeAt(RIM, 200, w).x).toBe(200);
  });
  it('상자가 칸보다 좁으면 상자 가운데', () => {
    expect(actorEdgeAt({ left: 10, top: 5, width: 20 }, 0, w)).toEqual({ x: 20, y: 5 });
  });
});

describe('park_fountain 테두리 カーン (#530 할 일 3)', () => {
  const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
  const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData, art: parseSceneArt(artJson), sprites };

  function settle(s: SceneState): void {
    for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  }

  it('장대로 테두리를 치면 カーン은 쭉이 효과로 뜨고, 쭉이 쪽 끝 장대 옆에 뜬다(가운데 x 224가 아니다)', () => {
    const s = createScene(data);
    settle(s);
    runAction(data, s, { char: 'jjuk', verb: 'stretch', target: 'fountain' }, null);
    let clang: ReturnType<typeof activeFx>[number] | undefined;
    for (let i = 0; i < 5000 && !clang; i++) {
      sceneTick(data, s);
      clang = activeFx(s).find((f) => f.effect === 'clang_text');
    }
    expect(clang?.by).toBe('jjuk');
    const x = s.walkers.jjuk.x;
    const cell = fxMeta.cells.clang_text!;
    const at = actorEdgeAt(RIM, x, cell[2]);
    const p = fxTextAt('clang_text', cell, at, 0, INTERNAL_WIDTH)!;
    // 칸은 테두리 안, 쭉이가 선 쪽 끝에서 틈만큼 안쪽
    expect(p.x).toBeGreaterThanOrEqual(RIM.left);
    expect(p.x + cell[2]).toBeLessThanOrEqual(RIM.left + RIM.width);
    expect(Math.abs(at.x - 224)).toBeGreaterThan(40);
    // 쭉이 머리 위 ニューッ(같은 틱에 뜬다) 칸과 가로로 겹치지 않는다. 쭉이 그림 가운데 = 발 x로 본다.
    const st = fxMeta.cells.stretch_text!;
    const stLeft = Math.round(x) - Math.floor(st[2] / 2);
    const stRight = stLeft + st[2];
    expect(p.x + cell[2] <= stLeft || p.x >= stRight, `clang ${p.x}..${p.x + cell[2]} vs stretch ${stLeft}..${stRight}`).toBe(true);
  });

  it('털썩 ゴォン은 엉덩이 오른쪽 테두리 앞면 위에 뜬다(#528 실패 1: 가슴 위 가운데가 아니다)', () => {
    const cell = fxMeta.cells.gon_text!;
    const p = fxTextAt('gon_text', cell, fxTextSpot('gon_text', 'fountain') as { x: number; y: number }, 0, INTERNAL_WIDTH)!;
    expect(p).toEqual({ x: 250, y: 182 });
    // 시작 칸은 테두리 앞면(128,180,192×18) 안
    expect(p.y).toBeGreaterThanOrEqual(RIM.top);
    expect(p.y + cell[3]).toBeLessThanOrEqual(RIM.top + 18);
    expect(p.x + cell[2]).toBeLessThanOrEqual(RIM.left + RIM.width);
    // 앉는 자리(x 220) 오른쪽으로 떨어져 있다. 몸 오른쪽 끝 약 x 242 + 틈 8
    const seat = (screenJson as unknown as { spots: Record<string, { x: number }> }).spots.fountain_seat!;
    expect(p.x).toBeGreaterThanOrEqual(seat.x + 30);
  });

  it('입장 연출 fx(행동이 없다)에는 by가 없다 → 엔진은 위 끝 가운데로 되돌린다', () => {
    const s = createScene(data);
    const fx = activeFx(s).concat(...Array.from({ length: 30 }, () => (sceneTick(data, s), activeFx(s))));
    for (const f of fx) expect(f.by).toBeUndefined();
  });
});
