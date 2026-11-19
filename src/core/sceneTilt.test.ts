// 시소 기울기와 판 위 발 높이(#397, `docs/design/screens/magpie_nest.md` 1-5-4절, 형식 기록 12절 개정 5).
// 쉬는 판(#437, 1-7절, 형식 기록 개정 7): d = 12 × 부호(무게 차).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import artJson from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { CHARACTERS, type CharacterId } from './characters';
import { TICK_MS } from './config';
import { parseSceneArt, sceneDraws, tiltDrop, type ScenePictureObject } from './sceneArt';
import { parseSpriteMeta } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { boardDrop, createScene, floorTarget, HOP, isBusy, runAction, sceneLayout, sceneTap, sceneTick, tiltOf, type SceneData, type SceneState } from './scene';

const art = parseSceneArt(artJson);
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData, art, sprites };
const seesaw = art.objects.find((o) => o.key === 'seesaw')! as ScenePictureObject;
const tilt = seesaw.tilt!;
const ENDS = ['seesaw_left', 'seesaw_right'] as const;
const IDS = CHARACTERS.map((c) => c.id);
const WEIGHT: Record<CharacterId, number> = { jjuk: 1, ppik: 1, mukjik: 2 };
/** 쉬는 판 값(설계 1-7-1절 M). */
const M = 12;
const restOf = (sum: number): number => M * Math.sign(sum);
/** 널빤지 윗면 y(수평 214)가 기울기 d일 때 열 x에서. 그림 원본 `plank(d)`와 같은 식. */
const top = (d: number, x: number): number => 214 + tiltDrop(tilt, d, x);

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

/** 그려지는 발 y(걷기 좌표 + 판 위 내려감). 엔진(main.ts)이 이 값을 반올림해 그린다. */
const footY = (s: SceneState, id: CharacterId): number => s.walkers[id].y + boardDrop(data, s, id);
const d = (s: SceneState): number => tiltOf(data, s, 'seesaw');

describe('기울기 그림 메타 (형식 기록 12절)', () => {
  it('시소에 쉬는 판 2칸(−12, 12)과 판 밑 바닥 상자가 있다(1-7-1절)', () => {
    expect(Object.keys(tilt.frames).map(Number).sort((a, b) => a - b)).toEqual([-M, M]);
    expect(tilt).toMatchObject({ rest: M, weight: WEIGHT, pivot: 247.5, run: 40 });
    expect(seesaw.noFloor).toEqual({ box: [204, 200, 89, 38], y: 240 });
  });

  it('설계 1-7-1절 발 높이 표와 같다', () => {
    const table: [number, number, number][] = [[-12, 222, 203], [0, 214, 214], [12, 206, 225]];
    for (const [dd, left, right] of table) expect([dd, top(dd, 220), top(dd, 284)]).toEqual([dd, left, right]);
  });

  it('d가 0이 아니면 멈춘 모습 대신 기울기 칸, anim 재생 중이면 anim 칸', () => {
    const view = (dd: number, playing: Parameters<typeof sceneDraws>[1]['playing'] = null) => ({ flagsOf: () => ({}), playing, clockMs: 0, tiltOf: () => dd });
    expect(sceneDraws(art, view(0)).byObject.seesaw).toEqual([seesaw.default.frame]);
    expect(sceneDraws(art, view(-M)).byObject.seesaw).toEqual([tilt.frames[String(-M)]]);
    expect(sceneDraws(art, view(9)).byObject.seesaw).toEqual([seesaw.default.frame]); // 칸 없는 값은 수평 그대로
    const bounce = art.anims['seesaw_right.plank_bounce']!;
    expect(sceneDraws(art, view(-M, { object: 'seesaw', anim: bounce, ms: 0 })).byObject.seesaw).toEqual([bounce.frames[0]]);
  });

  it('그림 메타의 기울기 칸이 깨지면 파서가 막는다', () => {
    const bad = JSON.parse(JSON.stringify(artJson)) as { objects: { key: string; tilt?: { frames: Record<string, number> } }[] };
    bad.objects.find((o) => o.key === 'seesaw')!.tilt!.frames['0'] = 1;
    expect(() => parseSceneArt(bad)).toThrow(/tilt/);
  });
});

describe('보이는 탑승으로 기울기 정하기 (1-5-4·1-7절)', () => {
  it('빈 판·가벼운 둘은 수평, 무게가 다르면 무거운 쪽 끝이 12px 내려가 쉰다(혼자 탄 사람도 같다)', () => {
    const cases: [CharacterId, string][][] = [
      [],
      [['jjuk', 'seesaw_left']],
      [['ppik', 'seesaw_right']],
      [['mukjik', 'seesaw_left']],
      [['mukjik', 'seesaw_right']],
      [['jjuk', 'seesaw_left'], ['ppik', 'seesaw_right']],
      [['jjuk', 'seesaw_left'], ['mukjik', 'seesaw_right']],
      [['mukjik', 'seesaw_left'], ['ppik', 'seesaw_right']],
    ];
    for (const riders of cases) {
      const s = ready();
      for (const [id, end] of riders) board(s, id, end);
      const want = restOf(riders.reduce((sum, [id, end]) => sum + (end === 'seesaw_right' ? 1 : -1) * WEIGHT[id], 0));
      expect(d(s)).toBe(want);
      for (const [id] of riders) expect(Math.round(footY(s, id))).toBe(top(want, s.walkers[id].x));
      // 탄 사람의 걷기 좌표(히트 박스)는 그대로 214다.
      for (const [id] of riders) expect(s.walkers[id].y).toBe(214);
    }
  });

  // 누가(3) × 어느 끝(2) × 반대 끝에 누가(없음 + 나머지 둘) = 18가지. #401 리뷰 "18가지 조합"과 같다.
  const combos = IDS.flatMap((who) => ENDS.flatMap((end) => [null, ...IDS.filter((o) => o !== who)].map((other) => ({ who, end, other }))));
  it('18가지 올라서기: 공중 마지막 틱 발이 판 윗면을 뚫지 않고, 착지 칸이 시작되는 틱에 판·발이 함께 새 기울기로 간다', () => {
    expect(combos).toHaveLength(18);
    for (const { who, end, other } of combos) {
      const label = `${who} → ${end} (반대 끝 ${other ?? '없음'})`;
      const s = ready();
      const otherEnd = end === 'seesaw_left' ? 'seesaw_right' : 'seesaw_left';
      if (other) board(s, other, otherEnd);
      const before = d(s);
      const sumBefore = other ? (otherEnd === 'seesaw_right' ? 1 : -1) * WEIGHT[other] : 0;
      const after = restOf(sumBefore + (end === 'seesaw_right' ? 1 : -1) * WEIGHT[who]);
      runAction(data, s, { char: who, verb: 'move', target: end }, null);
      let lastAir: number | null = null;
      let landed = false;
      for (let i = 0; i < 3000 && isBusy(s); i++) {
        sceneTick(data, s);
        const h = s.hops[who];
        const dd = d(s);
        // 반대 끝 사람 발은 매 틱 지금 그리는 판 위에 있다(보간 없음). 묵직이가 올라선 틱부터는 들썩(#414 1-6-6절)이라 판에서 최대 H 4 뜬다.
        if (other && s.hops[other]?.kind === 'jostle') {
          const gap = top(dd, s.walkers[other].x) - Math.round(footY(s, other));
          expect(gap, label).toBeGreaterThanOrEqual(0);
          expect(gap, label).toBeLessThanOrEqual(HOP.jostle.h);
        } else if (other) expect(Math.round(footY(s, other)), label).toBe(top(dd, s.walkers[other].x));
        if (h && h.t >= h.crouch && h.t < h.crouch + h.air) {
          expect(dd, label).toBe(before); // 공중에서는 아직 착지 전 기울기
          lastAir = footY(s, who);
        } else if (h && h.t >= h.crouch + h.air) {
          if (!landed) {
            // 공중 마지막 틱(착지 전 판이 그려진 틱): 발이 그때 판 윗면 위(그린 픽셀 기준)
            expect(lastAir, label).not.toBeNull();
            expect(Math.round(lastAir!), label).toBeLessThanOrEqual(top(before, h.to.x));
            landed = true;
          }
          expect(dd, label).toBe(after);
          expect(Math.round(footY(s, who)), label).toBe(top(after, h.to.x));
        }
      }
      expect(landed, label).toBe(true);
      expect(d(s), label).toBe(after);
      expect(Math.round(footY(s, who)), label).toBe(top(after, s.walkers[who].x));
    }
  });

  it('내려서기: 뜨는 틱에 판이 바뀌고, 뛰는 사람 발은 서 있던 높이에서 바닥 점까지 끊기지 않는다', () => {
    for (const who of IDS) {
      for (const end of ENDS) {
        const s = ready();
        board(s, who, end);
        const standing = footY(s, who);
        runAction(data, s, { char: who, verb: 'move', target: 'floor' }, { x: 330, y: 244 });
        sceneTick(data, s);
        expect(s.hops[who]?.up).toBe(false);
        expect(d(s)).toBe(0);
        // 첫 공중 틱: 출발점(서 있던 발)에서 한 틱 움직인 만큼만
        expect(Math.abs(footY(s, who) - standing)).toBeLessThan(4);
        settle(s);
        expect(boardDrop(data, s, who)).toBe(0);
        expect(s.riding[who]).toBeUndefined();
      }
    }
  });

  it('판 위 끝 ↔ 끝 걷기는 계속 탄 채이고, 축을 넘는 틱에 기울기 부호가 바뀐다', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    expect(d(s)).toBe(-M);
    runAction(data, s, { char: 'jjuk', verb: 'move', target: 'seesaw_right' }, null);
    const seen: number[] = [];
    for (let i = 0; i < 600 && isBusy(s); i++) {
      sceneTick(data, s);
      const dd = d(s);
      if (seen[seen.length - 1] !== dd) seen.push(dd);
      expect(s.riding.jjuk).toBeDefined();
      expect(Math.round(footY(s, 'jjuk'))).toBe(top(dd, s.walkers.jjuk.x));
    }
    expect(seen).toEqual([-M, M]);
  });

  it('정답 11번: U6 동안은 쭉이 + 판 끝에 뛰어오른 묵직이 기울기, 발사가 시작되는 틱에 묵직이 혼자, ⑦ 뒤 수평(#414)', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    let sawBounce = false;
    let sawLaunch = false;
    let launchTicks = 0;
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(data, s);
      const ev = s.current?.ev;
      // 발사 연출 내내 쭉이 발은 빠진 틱의 판 높이(206) 그대로다. ⑦로 판이 수평이 돼도 따라 내려가지 않는다(1-7-8절).
      if (ev?.type === 'anim' && ev.name === 'launch_to_hook') {
        launchTicks++;
        expect(Math.round(footY(s, 'jjuk'))).toBe(206);
      }
      if (ev?.type === 'anim' && ev.name === 'plank_bounce') {
        sawBounce = true;
        expect(d(s)).toBe(M); // 멈춘 기울기(그림 고르기용): 왼쪽 쭉이 1 < 오른쪽 묵직이 2. 판은 U6 칸이 그린다
      }
      if (ev?.type === 'anim' && ev.name === 'launch_to_hook' && s.current!.t === 0) {
        sawLaunch = true;
        expect(d(s)).toBe(M); // 쭉이가 빠지고 묵직이 혼자. 쉬는 판이라 판 그림은 그대로(1-7-8절)
        // 발사 동안 쭉이는 빠진 틱의 판 높이(들린 왼쪽 끝 206)에 그대로 선다. 걷기 좌표(214)로 내려가 판에 묻히지 않는다.
        expect(Math.round(footY(s, 'jjuk'))).toBe(top(M, s.walkers.jjuk.x));
        expect(top(M, s.walkers.jjuk.x)).toBe(206);
      }
    }
    expect([sawBounce, sawLaunch]).toEqual([true, true]);
    expect(launchTicks).toBeGreaterThan(15);
    expect(s.puzzle.at.jjuk).toBe('hook');
    // 고리로 옮겨진 뒤에는 잡아 둔 높이를 쓰지 않는다
    expect(boardDrop(data, s, 'jjuk')).toBe(0);
    expect(s.riding.mukjik).toBeUndefined();
    expect(d(s)).toBe(0);
  });

  /** U6 동안 매 틱 [U6 칸 번호, 판 위 사람의 그려지는 발 y]. 칸이 바뀌는 틱에 발도 바뀐다. */
  function bounceFeet(s: SceneState, id: CharacterId): [number, number][] {
    const seen: [number, number][] = [];
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(data, s);
      const p = s.current;
      if (p?.ev.type !== 'anim' || p.ev.name !== 'plank_bounce') continue;
      const drawn = sceneDraws(art, { flagsOf: () => ({}), playing: { ...p.art!, ms: p.t * TICK_MS }, clockMs: 0 }).byObject.seesaw![0]!;
      const k = p.art!.anim.frames.indexOf(drawn);
      const y = Math.round(footY(s, id));
      // 그리는 판 칸의 d로 잰 판 윗면과 발이 같다(뚫지도 뜨지도 않는다)
      expect(y).toBe(top(p.art!.anim.tilt![k]!, s.walkers[id].x));
      if (seen.length === 0 || seen[seen.length - 1]![0] !== k) seen.push([k, y]);
    }
    return seen;
  }

  it('U6 칸별 기울기 메타(12-5절, 1-7-7절): 오른쪽 끝 12 → 15 → 8, 왼쪽 끝 반대', () => {
    expect(art.anims['seesaw_right.plank_bounce']!.tilt).toEqual([12, 15, 8]);
    expect(art.anims['seesaw_left.plank_bounce']!.tilt).toEqual([-12, -15, -8]);
  });

  it('정답 11번: U6 동안 왼쪽 쭉이 발이 칸마다 판을 따른다(206 → 204 → 209, 1-7-7절 표)', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    expect(bounceFeet(s, 'jjuk')).toEqual([[0, 206], [1, 204], [2, 209]]);
    expect(s.puzzle.at.jjuk).toBe('hook');
  });

  it('14번: U6 동안 오른쪽에 탄 사람 발이 왼쪽 끝 이벤트 칸을 따른다(203 → 200 → 207)', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_right');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' }, null);
    expect(bounceFeet(s, 'jjuk')).toEqual([[0, 203], [1, 200], [2, 207]]);
  });

  it('15번: 묵직이가 밟은 끝에 올라탄 채 U6 칸을 따라 내려갔다 올라온다(1-6-5절, 판 위·바닥 둘 다)', () => {
    for (const end of ENDS) {
      for (const onBoard of [true, false]) {
        const s = ready();
        if (onBoard) board(s, 'mukjik', end);
        runAction(data, s, { char: 'mukjik', verb: 'stomp', target: end }, null);
        const feet = bounceFeet(s, 'mukjik');
        // 밟은 끝 이벤트: 오른쪽 끝(x 284)은 225 → 228 → 221, 왼쪽 끝(x 220)은 222 → 224 → 220(1-7-7절 표)
        expect(feet.map(([k]) => k)).toEqual([0, 1, 2]);
        expect(feet.map(([, y]) => y)).toEqual(end === 'seesaw_right' ? [225, 228, 221] : [222, 224, 220]);
        expect(s.riding.mukjik).toBeUndefined();
        expect(d(s)).toBe(0);
      }
    }
  });

  it('칸별 기울기가 없는 물건 anim이면 지금처럼 멈춘 값에 둔다', () => {
    const plain = JSON.parse(JSON.stringify(artJson)) as { anims: Record<string, { tilt?: number[] }> };
    delete plain.anims['seesaw_right.plank_bounce']!.tilt;
    const noTilt: SceneData = { ...data, art: parseSceneArt(plain) };
    const s = createScene(noTilt);
    while (isBusy(s)) sceneTick(noTilt, s);
    runAction(noTilt, s, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, null);
    for (let i = 0; i < 3000 && isBusy(s); i++) sceneTick(noTilt, s);
    runAction(noTilt, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    let n = 0;
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(noTilt, s);
      if (s.current?.ev.type === 'anim' && s.current.ev.name === 'plank_bounce') {
        n++;
        // 멈춘 기울기: 왼쪽 쭉이 1 < 판 끝에 뛰어오른 오른쪽 묵직이 2(#414) → 쉬는 판
        expect(Math.round(s.walkers.jjuk.y + boardDrop(noTilt, s, 'jjuk'))).toBe(top(M, s.walkers.jjuk.x));
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it('그림 메타의 anim 칸별 기울기가 칸 수와 다르면 파서가 막는다', () => {
    const bad = JSON.parse(JSON.stringify(artJson)) as { anims: Record<string, { tilt?: number[] }> };
    bad.anims['seesaw_left.plank_bounce']!.tilt = [-4, -7];
    expect(() => parseSceneArt(bad)).toThrow(/plank_bounce.*tilt/);
  });

  it('탭 건너뛰기로 깡충을 넘기면 기울기도 바로 새 값', () => {
    const s = ready();
    runAction(data, s, { char: 'mukjik', verb: 'move', target: 'seesaw_right' }, null);
    while (!s.hops.mukjik) sceneTick(data, s);
    expect(d(s)).toBe(0);
    expect(sceneTap(data, s, { x: 300, y: 150 }, 0, false).kind).toBe('skipWalk');
    expect(d(s)).toBe(M);
    settle(s);
    expect(d(s)).toBe(M);
  });

  it('판 위 사람의 히트 박스는 그린 자리(판 높이)를 따른다(1-7-9절): 들린 쭉이 8px 위, 내려간 묵직이 11px 아래', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    board(s, 'mukjik', 'seesaw_right');
    const flat: SceneData = { ...data, art: { ...art, objects: art.objects.map((o) => (o.key === 'seesaw' ? { ...o, tilt: undefined } : o)) } as typeof art };
    const tilted = sceneLayout(data, s).chars;
    const level = sceneLayout(flat, s).chars;
    expect(tilted.jjuk.top - level.jjuk.top).toBe(top(M, 220) - 214);
    expect(tilted.mukjik.top - level.mukjik.top).toBe(top(M, 284) - 214);
    expect([top(M, 220) - 214, top(M, 284) - 214]).toEqual([-8, 11]);
    // 바닥 사람은 그대로
    expect(tilted.ppik).toEqual(level.ppik);
  });

  it('기울기 메타가 없으면(그림 없는 화면) 늘 0이고 발도 안 내려간다', () => {
    const plain: SceneData = { ...data, art: undefined };
    const s = createScene(plain);
    runAction(plain, s, { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, null);
    for (let i = 0; i < 3000 && isBusy(s); i++) sceneTick(plain, s);
    expect(tiltOf(plain, s, 'seesaw')).toBe(0);
    expect(boardDrop(plain, s, 'jjuk')).toBe(0);
  });
});

describe('판 밑 바닥 클릭 구멍 (1-5-2절)', () => {
  it('판 밑 상자(x 204~292, y 200~237) 안 목표는 y 240으로, 밖은 그대로', () => {
    expect(floorTarget(data, { x: 250, y: 225 })).toEqual({ x: 250, y: 240 });
    expect(floorTarget(data, { x: 204, y: 200 })).toEqual({ x: 204, y: 240 });
    expect(floorTarget(data, { x: 292, y: 237 })).toEqual({ x: 292, y: 240 });
    expect(floorTarget(data, { x: 293, y: 225 })).toEqual({ x: 293, y: 225 });
    expect(floorTarget(data, { x: 250, y: 238 })).toEqual({ x: 250, y: 238 });
    expect(floorTarget({ ...data, art: undefined }, { x: 250, y: 225 })).toEqual({ x: 250, y: 225 });
  });

  it('바닥을 눌러 걷기: 판 밑(받침 옆 잔디)을 누르면 판 앞에 선다', () => {
    const s = ready();
    // 판 밑 히트 영역 바깥(받침 옆, y 230). 쭉이가 골라져 있다.
    expect(sceneTap(data, s, { x: 232, y: 230 }, 0, false).kind).toBe('intent');
    expect(s.walkers.jjuk.target).toEqual({ x: 232, y: 240 });
  });

  it('시소에서 바닥 점을 누르고 내려오는 `move floor`도 같은 구멍을 막는다', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'jjuk', verb: 'move', target: 'floor' }, { x: 260, y: 228 });
    settle(s);
    expect(s.walkers.jjuk).toMatchObject({ x: 260, y: 240 });
  });
});
