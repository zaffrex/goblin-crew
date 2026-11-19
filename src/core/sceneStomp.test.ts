// 묵직이 쿵 = 시소 끝에 뛰어올라 쿵(#414, `docs/design/screens/magpie_nest.md` 1-6절).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import artJson from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { type CharacterId } from './characters';
import { TICK_MS } from './config';
import { parseSceneArt, sceneDraws, tiltDrop } from './sceneArt';
import { parseSpriteMeta, spriteFrame } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { activeFx, boardDrop, charPose, createScene, HOP, isBusy, runAction, sceneTap, sceneTick, tiltOf, type SceneData, type SceneState } from './scene';

const art = parseSceneArt(artJson);
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData, art, sprites };
const tilt = art.objects.find((o) => o.key === 'seesaw')!.tilt!;
const ENDS = ['seesaw_left', 'seesaw_right'] as const;
const top = (d: number, x: number): number => 214 + tiltDrop(tilt, d, x);
const d = (s: SceneState): number => tiltOf(data, s, 'seesaw');
/** 쉬는 판 값(설계 1-7-1절 M). */
const M = 12;
const footY = (s: SceneState, id: CharacterId): number => s.walkers[id].y + boardDrop(data, s, id);
const frameOf = (s: SceneState, id: CharacterId): number | null => spriteFrame(sprites[id], charPose(data, s, id));
const mk = sprites.mukjik.anims;

function ready(): SceneState {
  const s = createScene(data);
  while (isBusy(s)) sceneTick(data, s);
  return s;
}
function settle(s: SceneState): void {
  for (let i = 0; i < 3000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}
function board(s: SceneState, id: CharacterId, end: string): void {
  runAction(data, s, { char: id, verb: 'move', target: end }, null);
  settle(s);
  expect(s.puzzle.at[id]).toBe(end);
}
const playing = (s: SceneState, name: string): boolean => s.current?.ev.type === 'anim' && s.current.ev.name === name;
/** 묵직이 `seesaw_stomp`이 시작될 때까지 돌린다(걷기 끝). */
function untilStomp(s: SceneState): void {
  for (let i = 0; i < 3000 && !playing(s, 'seesaw_stomp'); i++) sceneTick(data, s);
  expect(playing(s, 'seesaw_stomp')).toBe(true);
}

describe('시트 `seesaw_stomp` (1-6-3절, 형식 `reuse`/`air`)', () => {
  it('새 칸 없이 step_up 0 · common.stomp 0~3을 잇고, 공중 칸 [1, 2], 신호는 쿵 칸 3', () => {
    const st = mk['common.stomp']!.frames;
    expect(mk.seesaw_stomp).toEqual({ frames: [mk.step_up!.frames[0], ...st], ms: [150, 150, 100, 400, 300], air: [1, 2], cue: [3] });
  });

  it('`air`가 깨지면 파서가 막는다', () => {
    for (const air of [[1], [2, 1], [1, 4], [-1, 2], 'x']) {
      const bad = JSON.parse(JSON.stringify(mukjikJson)) as { anims: Record<string, { air?: unknown }> };
      bad.anims.seesaw_stomp!.air = air;
      expect(() => parseSpriteMeta(bad), JSON.stringify(air)).toThrow(/air/);
    }
  });
});

describe('판 끝에 뛰어올라 쿵 (1-6-2·1-6-4절)', () => {
  it('바닥에서: 바닥 점(290, 240)까지 걸어 그 끝을 보고, 웅크림 150 + 공중 250ms 뒤 착지 칸 틱에 ドスン·U6가 같이 시작한다', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    untilStomp(s);
    expect([s.walkers.mukjik.x, s.walkers.mukjik.y, s.walkers.mukjik.facing]).toEqual([290, 240, -1]);
    const h = s.hops.mukjik!;
    expect(h).toMatchObject({ kind: 'stomp', crouch: 9, air: 15, land: 42, h: HOP.stomp.h, onBoard: false, to: { x: 284, y: 214 }, after: { x: 290, y: 240 } });
    let t = 0;
    let peak = Infinity;
    let lastAir = 0;
    const frames: number[] = [];
    while (!playing(s, 'plank_bounce')) {
      sceneTick(data, s);
      t++;
      if (s.hops.mukjik!.t < 24) {
        frames.push(frameOf(s, 'mukjik')!);
        if (s.hops.mukjik!.t >= 9) {
          peak = Math.min(peak, footY(s, 'mukjik'));
          lastAir = footY(s, 'mukjik');
        }
      }
    }
    // 착지 칸 틱 = 시작 + 24틱(400ms). 그 틱에 U6가 t=0으로 시작하고 시그니처 글자가 겹쳐 뜬다.
    expect(t).toBe(24);
    expect(s.current!.t).toBe(0);
    expect(activeFx(s).map((f) => [f.effect, f.t])).toEqual([['stomp_text', 0]]);
    expect(frameOf(s, 'mukjik')).toBe(mk['common.stomp']!.frames[2]); // 쿵 칸
    expect(s.riding.mukjik).toBe('seesaw_right');
    // 웅크림(step_up 0) → 무릎 들기 → 내려찍기
    expect([...new Set(frames)]).toEqual(mk.seesaw_stomp!.frames.slice(0, 3));
    // 꼭대기 발 y(1-6-2절 "약 190~195"는 d 3 시절 값). 쉬는 판에서는 착지 목표가 들린 끝(203)이라 그만큼 높다.
    // 공중 마지막 틱 발은 착지 전 판(쭉이 왼쪽, 쉬는 판 −12) 윗면 위
    expect(Math.round(peak)).toBeGreaterThanOrEqual(185);
    expect(Math.round(peak)).toBeLessThanOrEqual(195);
    expect(Math.round(lastAir)).toBeLessThanOrEqual(top(-M, 284));
  });

  it('제자리(이미 그 끝): 퍼즐의 내려서기는 그리지 않고 판 위에서 웅크렸다 H 24로 뛴다. 공중 동안도 탄 채라 판이 그대로다(1-7-6절)', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    board(s, 'mukjik', 'seesaw_right');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    expect(s.puzzle.at.mukjik).toBe('floor');
    untilStomp(s);
    expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([284, 214]);
    expect(s.hops.mukjik).toMatchObject({ onBoard: true, h: HOP.stomp.hOnBoard });
    let peak = Infinity;
    while (!playing(s, 'plank_bounce')) {
      sceneTick(data, s);
      const h = s.hops.mukjik!;
      // 웅크림·공중 내내 판에 탄 채(쉬는 판 12). 판이 쭉이 쪽으로 넘어가 쭉이가 떨어졌다 다시 솟는 일이 없다.
      expect(s.riding.mukjik).toBe('seesaw_right');
      expect(d(s)).toBe(M);
      expect(Math.round(footY(s, 'jjuk'))).toBe(top(M, 220));
      if (h.t < 9) expect(Math.round(footY(s, 'mukjik'))).toBe(top(M, 284));
      else if (h.t < 24) {
        // 공중 동안 발은 판 윗면(225)보다 아래로 가지 않는다
        expect(Math.round(footY(s, 'mukjik'))).toBeLessThanOrEqual(top(M, 284));
        peak = Math.min(peak, footY(s, 'mukjik'));
      }
    }
    // 225에서 H 24로 뛰어 225에 착지(1-7-6절)
    expect(Math.round(peak)).toBe(top(M, 284) - HOP.stomp.hOnBoard);
    expect(s.riding.mukjik).toBe('seesaw_right');
  });

  it('여운이 끝나면(착지 + 700ms) 바닥 점으로 내려서고(⑦), 그동안 busy·탭 무시, 끝나면 판이 수평이고 퍼즐은 그대로', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    board(s, 'mukjik', 'seesaw_right');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    untilStomp(s);
    while (!playing(s, 'plank_bounce')) sceneTick(data, s);
    let t = 0;
    while (s.hops.mukjik?.kind === 'stomp') {
      sceneTick(data, s);
      t++;
    }
    expect(t).toBe(42);
    expect(s.hops.mukjik).toMatchObject({ up: false, to: { x: 290, y: 240 } });
    expect(s.riding.mukjik).toBeUndefined();
    expect(s.walkers.mukjik.facing).toBe(1); // 바닥 점 쪽(1-5-2절 내려서기)
    // 대기열이 먼저 비어도 ⑦이 끝날 때까지 busy고 탭은 받지 않는다(1-6-2절 "탭 건너뛰기")
    while (s.current !== null || s.queue.length > 0) sceneTick(data, s);
    if (s.hops.mukjik) {
      expect(isBusy(s)).toBe(true);
      expect(sceneTap(data, s, { x: 400, y: 244 }, 0, false)).toEqual({ kind: 'ignored' });
    }
    settle(s);
    expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([290, 240]);
    expect(s.puzzle.at).toMatchObject({ mukjik: 'floor', jjuk: 'hook' });
    expect(d(s)).toBe(0);
    expect(s.held.mukjik).toBeUndefined();
  });

  it('11~14번 세 사람 × 양쪽 끝: 매 틱 묵직이 발이 판(U6 칸 포함)을 뚫지 않는다', () => {
    const cases: [CharacterId, (typeof ENDS)[number]][] = [['jjuk', 'seesaw_left'], ['ppik', 'seesaw_left'], ['jjuk', 'seesaw_right'], ['ppik', 'seesaw_right']];
    for (const [rider, end] of cases) {
      for (const onBoard of [false, true]) {
        const s = ready();
        board(s, rider, end);
        const target = end === 'seesaw_left' ? 'seesaw_right' : 'seesaw_left';
        if (onBoard) board(s, 'mukjik', target);
        runAction(data, s, { char: 'mukjik', verb: 'stomp', target }, null);
        const x = data.screen.spots[target]!.x;
        let n = 0;
        for (let i = 0; i < 3000 && isBusy(s); i++) {
          sceneTick(data, s);
          const w = s.walkers.mukjik;
          // 뛰어올라 탄 동안(쿵 깡충)만 잰다. ⑦ 내려서기 뜨는 틱의 벌어짐은 #397 내려서기 규격 그대로다(#406 리뷰).
          if (w.x !== x || w.y > 214 + 0.5 || s.hops.mukjik?.kind !== 'stomp') continue;
          const dd = drawnTilt(s);
          expect(Math.round(footY(s, 'mukjik')), `${rider} ${end} ${onBoard} t${s.tick}`).toBeLessThanOrEqual(top(dd, x));
          n++;
        }
        expect(n).toBeGreaterThanOrEqual(42); // 착지 칸부터 여운 끝까지(제자리는 웅크림·공중도 같은 열이라 더 많다)
        expect(s.riding.mukjik).toBeUndefined();
      }
    }
  });
});

/** 지금 그리는 널빤지의 d: U6 재생 중이면 그 칸(그리는 쪽 `sceneDraws`와 같은 고르기), 아니면 멈춘 기울기. */
function drawnTilt(s: SceneState): number {
  const p = s.current;
  if (!p?.art || p.art.object !== 'seesaw' || !p.art.anim.tilt) return d(s);
  const drawn = sceneDraws(art, { flagsOf: () => ({}), playing: { ...p.art, ms: p.t * TICK_MS }, clockMs: 0 }).byObject.seesaw![0]!;
  return p.art.anim.tilt[p.art.anim.frames.indexOf(drawn)]!;
}

describe('15번: 빈 판에 쿵 하면 판이 묵직이를 튕겨 낸다 (1-6-5절)', () => {
  for (const end of ENDS) {
    it(`${end}: U6가 끝나는 틱에 뿅 칸으로 바닥 점 바깥 +12(y 244)로 날아가 착지하면서 납작 0번부터(flatten_stay, #433), ⑦ 없음`, () => {
      const s = ready();
      runAction(data, s, { char: 'mukjik', verb: 'stomp', target: end }, null);
      untilStomp(s);
      while (!playing(s, 'plank_bounce')) sceneTick(data, s);
      while (playing(s, 'plank_bounce')) sceneTick(data, s);
      // U6가 끝난 틱 = 납작 이벤트 시작 틱. 그 틱에 판에서 빠진다(빈 판 = 수평).
      expect(playing(s, 'common.flatten_stay')).toBe(true);
      expect(s.current!.t).toBe(0);
      expect(s.current!.lead).toBe(15);
      expect(s.riding.mukjik).toBeUndefined();
      expect(d(s)).toBe(0);
      const board = data.screen.spots[end]!.board!;
      expect(s.hops.mukjik).toMatchObject({ kind: 'eject', h: HOP.eject.h, to: { x: board[0] + 12, y: 244 } });
      const flat = mk['common.flatten']!.frames;
      let air = 0;
      while (s.hops.mukjik) {
        expect(frameOf(s, 'mukjik')).toBe(flat[2]); // 뿅
        expect(Math.round(footY(s, 'mukjik'))).toBeLessThanOrEqual(244);
        sceneTick(data, s);
        air++;
      }
      expect(air).toBe(15);
      expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([board[0] + 12, 244]);
      expect(frameOf(s, 'mukjik')).toBe(flat[0]); // 착지하면서 꽝
      settle(s);
      expect(s.hops.mukjik).toBeUndefined();
      expect([s.walkers.mukjik.x, s.walkers.mukjik.y]).toEqual([board[0] + 12, 244]);
      expect(s.puzzle.at.mukjik).toBe('floor');
    });
  }

  it('게이지 감소는 납작(튕겨 나가기 포함)이 끝난 뒤 말풍선 앞(gaugeBeforeSay 그대로)', () => {
    const s = ready();
    const g = s.shownGauge;
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    let flatEnd = -1;
    let gaugeAt = -1;
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(data, s);
      if (playing(s, 'common.flatten_stay')) flatEnd = s.tick;
      if (gaugeAt < 0 && s.shownGauge < g) gaugeAt = s.tick;
    }
    expect(gaugeAt).toBe(flatEnd + 1);
  });
});

describe('걸어서 올라설 때 반대쪽 들썩 (1-6-6절)', () => {
  it('묵직이가 오른쪽 끝에 올라서는 착지 틱에 왼쪽 쭉이가 H 4로 100ms 뜨고 50ms 착지(뿅 → 서 있기), 퍼즐 상태는 그대로', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    const before = JSON.parse(JSON.stringify(s.puzzle)) as typeof s.puzzle;
    runAction(data, s, { char: 'mukjik', verb: 'move', target: 'seesaw_right' }, null);
    let mukLanded = -1;
    let jostleStart = -1;
    let jostleEnd = -1;
    let minGap = 0;
    const poses: (number | null)[] = [];
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(data, s);
      const h = s.hops.mukjik;
      if (mukLanded < 0 && h && h.t >= h.crouch + h.air) mukLanded = s.tick;
      const j = s.hops.jjuk;
      if (j) {
        if (jostleStart < 0) jostleStart = s.tick;
        jostleEnd = s.tick;
        expect(j.kind).toBe('jostle');
        poses.push(frameOf(s, 'jjuk'));
        minGap = Math.max(minGap, top(d(s), 220) - Math.round(footY(s, 'jjuk')));
      }
      expect(s.puzzle.at.jjuk).toBe('seesaw_left');
    }
    expect(jostleStart).toBe(mukLanded);
    expect(jostleEnd - jostleStart + 1).toBe(9); // 6 + 3틱(150ms)
    expect(minGap).toBe(HOP.jostle.h);
    const jf = sprites.jjuk.anims;
    expect([...new Set(poses)]).toEqual([jf['common.flatten']!.frames[2], jf.idle!.frames[0]]);
    expect(s.puzzle).toEqual({ ...before, at: { ...before.at, mukjik: 'seesaw_right' } });
    expect(Math.round(footY(s, 'jjuk'))).toBe(top(M, 220));
  });

  it('묵직이가 걸어서 내려서며 뜨는 틱에 판이 반대쪽을 떨어뜨리고 그 끝 사람이 들썩한다(1-7-5절)', () => {
    for (const [other, otherEnd, mukEnd] of [['jjuk', 'seesaw_left', 'seesaw_right'], ['ppik', 'seesaw_right', 'seesaw_left']] as const) {
      const s = ready();
      board(s, other, otherEnd);
      board(s, 'mukjik', mukEnd);
      const restBefore = d(s);
      const x = s.walkers[other].x;
      expect(Math.round(footY(s, other))).toBe(top(restBefore, x));
      runAction(data, s, { char: 'mukjik', verb: 'move', target: 'floor' }, { x: 380, y: 244 });
      let liftOff = -1;
      let jostleStart = -1;
      let minGap = 0;
      for (let i = 0; i < 3000 && isBusy(s); i++) {
        sceneTick(data, s);
        const h = s.hops.mukjik;
        if (liftOff < 0 && h && !h.up) {
          liftOff = s.tick;
          // 뜨는 틱: 판이 반대쪽으로 넘어가고 들썩이 같이 생긴다(t = 0)
          expect(d(s)).toBe(-restBefore);
          expect(s.hops[other]).toMatchObject({ kind: 'jostle', t: 0, h: HOP.jostle.h });
        }
        const j = s.hops[other];
        if (j) {
          if (jostleStart < 0) jostleStart = s.tick;
          minGap = Math.max(minGap, top(d(s), x) - Math.round(footY(s, other)));
        }
      }
      expect(jostleStart).toBe(liftOff);
      expect(minGap).toBe(HOP.jostle.h);
      expect(Math.round(footY(s, other))).toBe(top(-restBefore, x));
      expect(s.puzzle.at[other]).toBe(otherEnd);
    }
  });

  it('가벼운 사람이 내려설 때, 반대쪽이 비었을 때는 들썩하지 않는다(1-7-5절)', () => {
    const cases: [CharacterId, CharacterId | null][] = [['jjuk', 'mukjik'], ['ppik', 'jjuk'], ['mukjik', null]];
    for (const [who, other] of cases) {
      const s = ready();
      if (other) board(s, other, 'seesaw_left');
      board(s, who, 'seesaw_right');
      runAction(data, s, { char: who, verb: 'move', target: 'floor' }, { x: 380, y: 244 });
      for (let i = 0; i < 3000 && isBusy(s); i++) {
        sceneTick(data, s);
        if (other) expect(s.hops[other], `${who} / ${other}`).toBeUndefined();
      }
    }
  });

  it('가벼운 사람이 올라설 때, 반대쪽이 비었을 때는 들썩하지 않는다', () => {
    const cases: [CharacterId, CharacterId | null][] = [['jjuk', 'mukjik'], ['ppik', 'jjuk'], ['mukjik', null]];
    for (const [who, other] of cases) {
      const s = ready();
      if (other) board(s, other, 'seesaw_left');
      runAction(data, s, { char: who, verb: 'move', target: 'seesaw_right' }, null);
      for (let i = 0; i < 3000 && isBusy(s); i++) {
        sceneTick(data, s);
        if (other) expect(s.hops[other], `${who} / ${other}`).toBeUndefined();
      }
    }
  });
});

describe('10번: 끝에 다른 사람이 있으면 바닥 점에서 멈춘다 (1-6-2절)', () => {
  it('바닥에서 오른쪽 끝을 쿵 → (290, 240)에서 그 끝을 보고 말한다. 뛰지 않는다', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_right');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(data, s);
      expect(s.hops.mukjik).toBeUndefined();
      if (s.current?.ev.type === 'say') break;
    }
    expect(s.current).toMatchObject({ ev: { type: 'say', speaker: 'mukjik', text: 'magpie_nest.seesaw_end_taken' } });
    expect([s.walkers.mukjik.x, s.walkers.mukjik.y, s.walkers.mukjik.facing]).toEqual([290, 240, -1]);
  });
});

describe('리셋이 대기열 밖 깡충을 끊는다', () => {
  it('쿵 남은 칸 도중 기절 리셋이 오면 판 위 좌표가 아니라 바닥 자리로 간다', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    untilStomp(s);
    while (!playing(s, 'plank_bounce')) sceneTick(data, s);
    expect(s.hops.mukjik?.kind).toBe('stomp');
    const to = { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' } as const;
    s.current = null;
    s.queue = [{ type: 'faint', to }];
    sceneTick(data, s);
    expect(s.hops.mukjik).toBeUndefined();
    expect(s.riding.mukjik).toBeUndefined();
    expect(s.walkers.mukjik.y).toBeGreaterThanOrEqual(240);
  });
});
