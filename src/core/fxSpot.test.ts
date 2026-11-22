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
import { ACTOR_EDGE_GAP, actorEdgeAt, besideFeetAt, FEET_TEXT_RAISE, fxTextSpot, fxTicks } from './fx';
import { fxTextAt, parseFxTextMeta } from './fxText';
import type { CharactersData, ScreenData } from './puzzle/types';
import { activeFx, bodies, createScene, isBusy, runAction, sceneTick, type SceneData, type SceneState } from './scene';
import { parseSceneArt } from './sceneArt';
import { parseSpriteMeta } from './sprite';

const fxMeta = parseFxTextMeta(fxRaw);
const RIM = { left: 128, top: 180, width: 192 };

describe('fxTextSpot', () => {
  it('`효과@대상`이 먼저, 그다음 대상 전체, 없으면 null', () => {
    expect(fxTextSpot('squeak_text', 'nest')).toEqual({ x: 188, y: 46 });
    expect(fxTextSpot('clang_text', 'fountain')).toBe('actor');
    expect(fxTextSpot('gon_text', 'fountain')).toEqual({ x: 266, y: 198 });
    expect(fxTextSpot('poof_text', 'mukjik')).toEqual({ x: 266, y: 248 });
    expect(fxTextSpot('stomp_text', 'mukjik')).toBeNull();
    // 같은 테두리라도 물소리 シャー·작은 삑은 그대로 위 끝 가운데
    expect(fxTextSpot('shaa_text', 'fountain')).toBeNull();
    expect(fxTextSpot('small_squeak_text', 'fountain')).toBeNull();
    expect(fxTextSpot('clang_text', 'alarm_clock')).toBeNull();
  });

  it('`화면:효과@대상`은 그 화면에서만 먼저 본다(#553). 화면 1의 쿵 ドスン은 머리 위 그대로', () => {
    expect(fxTextSpot('stomp_text', 'mukjik', 'park_fountain')).toBe('feet');
    expect(fxTextSpot('stomp_text', 'mukjik', 'magpie_nest')).toBeNull();
    expect(fxTextSpot('stomp_text', 'mukjik')).toBeNull();
    // 화면 키가 없으면 예전 순서 그대로
    expect(fxTextSpot('poof_text', 'mukjik', 'park_fountain')).toEqual({ x: 266, y: 248 });
    expect(fxTextSpot('squeak_text', 'nest', 'magpie_nest')).toEqual({ x: 188, y: 46 });
  });
});

describe('besideFeetAt', () => {
  const w = 35;
  const half = w / 2 + ACTOR_EDGE_GAP;
  it('몸 왼쪽 밖에 틈만큼 띄우고, 칸 아래 끝은 발보다 FEET_TEXT_RAISE 위', () => {
    const at = besideFeetAt({ left: 200, top: 190, width: 46, height: 54 }, w);
    expect(at.x).toBe(200 - half);
    const p = fxTextAt('stomp_text', [0, 0, w, 10], at, 0, INTERNAL_WIDTH)!;
    expect(p.y + 10).toBe(244 - FEET_TEXT_RAISE);
  });
  it('왼쪽에 칸이 안 들어가면(화면 왼쪽 끝) 몸 오른쪽 밖', () => {
    expect(besideFeetAt({ left: 20, top: 190, width: 46, height: 54 }, w).x).toBe(66 + half);
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

  it('왼쪽에서 쳐도(자명종 쪽에 섰다가) カーン은 왼쪽 끝 장대 옆, 테두리 안에 뜬다(#530: 화면 확인은 `decoy-tap-left`)', () => {
    const s = createScene(data);
    settle(s);
    runAction(data, s, { char: 'jjuk', verb: 'stretch', target: 'alarm_clock' }, null);
    settle(s);
    runAction(data, s, { char: 'jjuk', verb: 'stretch', target: 'fountain' }, null);
    let clang: ReturnType<typeof activeFx>[number] | undefined;
    for (let i = 0; i < 5000 && !clang; i++) {
      sceneTick(data, s);
      clang = activeFx(s).find((f) => f.effect === 'clang_text');
    }
    expect(clang?.by).toBe('jjuk');
    const x = s.walkers.jjuk.x;
    expect(x).toBeLessThan(RIM.left); // 테두리 왼쪽 밖에 선다(로컬 probe x 111)
    const cell = fxMeta.cells.clang_text!;
    const p = fxTextAt('clang_text', cell, actorEdgeAt(RIM, x, cell[2]), 0, INTERNAL_WIDTH)!;
    expect(p.x).toBe(RIM.left + ACTOR_EDGE_GAP + 1); // 칸 왼쪽 끝 = 상자 왼쪽 + 틈(홀수 폭 반올림 1px)
    expect(p.x + cell[2]).toBeLessThan(224); // 가운데보다 왼쪽
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

  it('흙길 쿵 ぼふっ은 테두리가 아니라 발치 흙 위, 몸 오른쪽에 뜬다(#526: 머리 위면 "분수가 낸 소리"로 읽혔다)', () => {
    const cell = fxMeta.cells.poof_text!;
    const at = fxTextSpot('poof_text', 'mukjik') as { x: number; y: number };
    const start = fxTextAt('poof_text', cell, at, 0, INTERNAL_WIDTH)!;
    const end = fxTextAt('poof_text', cell, at, 29, INTERNAL_WIDTH)!;
    expect(start).toEqual({ x: 252, y: 234 });
    // 뜨는 내내 테두리 앞면 아래 끝(y 198)보다 한참 아래, 흙 위
    expect(end.y).toBeGreaterThan(RIM.top + 18 + 20);
    // 쿵 자리(재킷 아래 x 224)의 몸 오른쪽 끝(약 x 246)과 겹치지 않는다
    const jacket = (screenJson as unknown as { hotspots: Record<string, { box: number[] }> }).hotspots.jacket!;
    const stompX = jacket.box[0]! + jacket.box[2]! / 2;
    expect(stompX).toBe(224);
    expect(start.x).toBeGreaterThanOrEqual(stompX + 22 + 6);
  });

  it('흙길 쿵 ドスン은 수면 높이가 아니라 몸 왼쪽 발치에 뜬다(#553: 머리 위면 "분수에서 소리가 났나?"로 읽혔다)', () => {
    const s = createScene(data);
    settle(s);
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'jacket' }, null);
    let found = false;
    for (let i = 0; i < 5000 && !found; i++) {
      sceneTick(data, s);
      found = activeFx(s).some((f) => f.effect === 'stomp_text');
    }
    expect(found).toBe(true);
    const body = bodies(data, s).mukjik;
    const foot = body.top + body.height;
    expect(Math.round(s.walkers.mukjik.y)).toBe(foot); // 몸 상자 아래 끝 = 발
    const cell = fxMeta.cells.stomp_text!;
    const at = besideFeetAt(body, cell[2]);
    const start = fxTextAt('stomp_text', cell, at, 0, INTERNAL_WIDTH)!;
    const end = fxTextAt('stomp_text', cell, at, fxTicks('stomp_text') - 1, INTERNAL_WIDTH)!;
    // 뜨는 내내 발 기준 위로 키 1/2 안쪽(이슈 완료 조건), 테두리 앞면 아래 끝(y 198)보다 아래
    expect(end.y).toBeGreaterThanOrEqual(foot - body.height / 2);
    expect(end.y).toBeGreaterThan(RIM.top + 18);
    // 몸과 겹치지 않고, 오른쪽 발치 ぼふっ 칸과도 겹치지 않는다
    expect(start.x + cell[2]).toBeLessThanOrEqual(body.left);
    const poof = fxTextAt('poof_text', fxMeta.cells.poof_text!, fxTextSpot('poof_text', 'mukjik') as { x: number; y: number }, 0, INTERNAL_WIDTH)!;
    expect(start.x + cell[2]).toBeLessThan(poof.x);
  });

  it('입장 연출 fx(행동이 없다)에는 by가 없다 → 엔진은 위 끝 가운데로 되돌린다', () => {
    const s = createScene(data);
    const fx = activeFx(s).concat(...Array.from({ length: 30 }, () => (sceneTick(data, s), activeFx(s))));
    for (const f of fx) expect(f.by).toBeUndefined();
  });
});
