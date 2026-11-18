// 시소 끝 깡충 올라서기·내려서기(#397, `docs/design/screens/magpie_nest.md` 1-5-2·1-5-3절).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import type { CharacterId } from './characters';
import { parseSpriteMeta, spriteFrame } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { charPose, createScene, HOP, isBusy, runAction, sceneTap, sceneTick, type SceneData, type SceneState } from './scene';
import type { Point } from './viewport';

const base: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const withSheets: SceneData = { ...base, sprites };
const LEFT = { x: 220, y: 214 };
const LEFT_BOARD = { x: 226, y: 240 };
const RIGHT = { x: 284, y: 214 };

function ready(data: SceneData): SceneState {
  const s = createScene(data);
  while (isBusy(s)) sceneTick(data, s);
  return s;
}

interface Frame {
  at: Point;
  hop: 0 | 1 | null;
  facing: 1 | -1;
}

/** busy가 끝날 때까지 돌리며 한 캐릭터의 틱마다 위치·깡충 칸을 적는다. */
function record(data: SceneData, s: SceneState, id: CharacterId): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 2000 && isBusy(s); i++) {
    sceneTick(data, s);
    const w = s.walkers[id];
    out.push({ at: { x: w.x, y: w.y }, hop: charPose(data, s, id).hop ?? null, facing: w.facing });
  }
  expect(isBusy(s)).toBe(false);
  return out;
}

const pos = (s: SceneState, id: CharacterId): Point => ({ x: s.walkers[id].x, y: s.walkers[id].y });

/** 깡충 칸 번호가 바뀌는 구간: [칸, 이어진 틱 수][]. */
function runs(frames: Frame[]): [0 | 1, number][] {
  const out: [0 | 1, number][] = [];
  for (const f of frames) {
    if (f.hop === null) continue;
    const last = out[out.length - 1];
    if (last && last[0] === f.hop) last[1] += 1;
    else out.push([f.hop, 1]);
  }
  return out;
}

describe('시소 끝 올라서기 (#397 1-5-2절)', () => {
  it('바닥 점까지 걸은 뒤 깡충: 판 밑으로 대각선 걷기가 없다', () => {
    const s = ready(base);
    runAction(base, s, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, null);
    const frames = record(base, s, 'jjuk');
    expect(pos(s, 'jjuk')).toEqual(LEFT);
    expect(s.puzzle.at.jjuk).toBe('seesaw_left');
    // 깡충 전에는 바닥 점까지 바닥(y ≥ 240)으로만 간다.
    const firstHop = frames.findIndex((f) => f.hop !== null);
    expect(firstHop).toBeGreaterThan(0);
    for (const f of frames.slice(0, firstHop)) expect(f.at.y).toBeGreaterThanOrEqual(LEFT_BOARD.y);
    expect(frames[firstHop]!.at).toEqual(LEFT_BOARD);
    // 웅크림 → 공중 → 착지, 표 시간(시트 없음: 100/150/50ms = 6/9/3틱).
    expect(runs(frames)).toEqual([[0, 6], [1, 9], [0, 3]]);
    // 깡충 동안 서는 자리(왼쪽)를 본다.
    for (const f of frames.slice(firstHop)) expect(f.facing).toBe(-1);
  });

  it('착지 직전 공중 칸에서 발이 판 윗면(y 214) 위에 있다(위에서 내려와 선다, 1-5-3절 h > 6.5)', () => {
    // 바닥 점(y 240)은 판 앞이라 공중 앞부분의 y > 214는 판 앞을 지나는 것이다. 뚫어 보이는 건 착지 직전에 판 아래에서 올라올 때다.
    for (const id of ['jjuk', 'ppik', 'mukjik'] as const) {
      for (const target of ['seesaw_left', 'seesaw_right'] as const) {
        const s = ready(withSheets);
        runAction(withSheets, s, { char: id, verb: 'move', target }, null);
        const frames = record(withSheets, s, id);
        const air = frames.filter((f) => f.hop === 1);
        expect(air.length).toBeGreaterThan(0);
        // 묵직이(h 8)는 213.7이라 그리면 판 윗면 줄(214)에 닿은 채 내려온다. 판 아래(> 214)가 아니면 된다.
        expect(air[air.length - 1]!.at.y, `${id} → ${target}`).toBeLessThan(214);
        expect(pos(s, id)).toEqual(target === 'seesaw_left' ? LEFT : RIGHT);
      }
    }
  });

  it('시트 `step_up` ms로 시간을 재고, 그 칸으로 그린다', () => {
    const s = ready(withSheets);
    runAction(withSheets, s, { char: 'mukjik', verb: 'move', target: 'seesaw_right' }, null);
    let seen: number[] = [];
    for (let i = 0; i < 2000 && isBusy(s); i++) {
      sceneTick(withSheets, s);
      const pose = charPose(withSheets, s, 'mukjik');
      if (pose.hop != null) seen.push(spriteFrame(sprites.mukjik, pose)!);
    }
    const up = sprites.mukjik.anims.step_up!;
    expect('ms' in up && up.ms).toEqual([150, 150]);
    seen = seen.filter((f, i) => i === 0 || seen[i - 1] !== f);
    expect(seen).toEqual([up.frames[0], up.frames[1], up.frames[0]]);
  });

  it('`step_up`이 없는 시트는 서 있기 첫 칸, 시트가 없으면 실루엣(null)', () => {
    const pose = { walkedPx: null, holding: false, event: null, clockMs: 0, hop: 1 as const };
    const anims = { ...sprites.jjuk.anims };
    delete anims.step_up;
    expect(spriteFrame({ ...sprites.jjuk, anims }, pose)).toBe(sprites.jjuk.anims.idle!.frames[0]);
    expect(spriteFrame(sprites.jjuk, pose)).toBe(sprites.jjuk.anims.step_up!.frames[1]);
  });

  it('정답 경로 첫 행동(쭉이 → 왼쪽 끝) 시간: 바닥 점 걷기 + 깡충 300ms', () => {
    const s = ready(withSheets);
    runAction(withSheets, s, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, null);
    const ticks = record(withSheets, s, 'jjuk').length;
    // 134px ÷ 1.5px/틱 = 90틱 + 깡충 18틱. 예전(판 위 자리까지 직선 143px)은 96틱이었다.
    expect(ticks).toBeGreaterThanOrEqual(90 + 18);
    expect(ticks).toBeLessThanOrEqual(90 + 18 + 2);
  });
});

describe('시소 끝 내려서기·판 위 걷기 (#397 1-5-2절)', () => {
  function onLeft(data: SceneData): SceneState {
    const s = ready(data);
    runAction(data, s, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, null);
    while (isBusy(s)) sceneTick(data, s);
    expect(pos(s, 'jjuk')).toEqual(LEFT);
    return s;
  }

  it('바닥으로 떠나면 먼저 바닥 점으로 뛰어내린다(웅크림 없이 공중 → 착지)', () => {
    const s = onLeft(base);
    runAction(base, s, { char: 'jjuk', verb: 'move', target: 'floor' }, { x: 400, y: 230 });
    const frames = record(base, s, 'jjuk');
    expect(runs(frames)).toEqual([[1, 6], [0, 3]]);
    const landed = frames.findIndex((f) => f.hop === null);
    expect(frames[landed - 1]!.at).toEqual(LEFT_BOARD);
    // 공중 동안 바닥 점보다 위로 솟는다(판에서 떨어지듯 미끄러지지 않음).
    expect(Math.min(...frames.filter((f) => f.hop === 1).map((f) => f.at.y))).toBeLessThan(LEFT.y);
    // 뛰어내리는 동안 바닥 점(오른쪽)을 본다.
    expect(frames[0]!.facing).toBe(1);
    expect(pos(s, 'jjuk')).toEqual({ x: 400, y: 230 });
  });

  it('끝 ↔ 끝은 판 위로 걷는다(깡충 없음, y 214 그대로)', () => {
    const s = onLeft(base);
    runAction(base, s, { char: 'jjuk', verb: 'move', target: 'seesaw_right' }, null);
    const frames = record(base, s, 'jjuk');
    expect(frames.every((f) => f.hop === null && f.at.y === 214)).toBe(true);
    expect(pos(s, 'jjuk')).toEqual(RIGHT);
  });

  it('끝이 차 있으면 바닥 점까지 걸어 그 끝을 보고 멈춘다(뛰지 않음, 16번)', () => {
    const s = onLeft(base);
    runAction(base, s, { char: 'ppik', verb: 'move', target: 'seesaw_left' }, null);
    const frames = record(base, s, 'ppik');
    expect(s.puzzle.at.ppik).toBe('floor');
    expect(frames.every((f) => f.hop === null)).toBe(true);
    expect(pos(s, 'ppik')).toEqual(LEFT_BOARD);
    expect(s.walkers.ppik.facing).toBe(-1);
    // 이미 바닥 점에 서 있으면 다시 걷지 않는다.
    runAction(base, s, { char: 'ppik', verb: 'move', target: 'seesaw_left' }, null);
    expect(s.queue.some((e) => e.type === 'walk')).toBe(false);
  });

  it('탭 건너뛰기는 깡충까지 건너뛰어 판 위 자리에 바로 선다', () => {
    const s = ready(base);
    runAction(base, s, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, null);
    // 바닥 점에 닿아 깡충이 시작될 때까지.
    while (!s.hops.jjuk) sceneTick(base, s);
    expect(sceneTap(base, s, { x: 300, y: 150 }, 0, false)).toEqual({ kind: 'skipWalk' });
    expect(pos(s, 'jjuk')).toEqual(LEFT);
    expect(s.hops.jjuk).toBeUndefined();
    sceneTick(base, s);
    expect(isBusy(s)).toBe(false);
    expect(pos(s, 'jjuk')).toEqual(LEFT);
  });

  it('내려서기 시간은 셋 같다(공중 100ms + 착지 50ms)', () => {
    expect(HOP.down.airMs + HOP.landMs).toBe(150);
    for (const id of ['jjuk', 'ppik', 'mukjik'] as const) expect(HOP.up[id].h).toBeGreaterThan(6.5);
  });
});
