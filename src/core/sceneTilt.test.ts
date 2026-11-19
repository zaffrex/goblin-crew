// 시소 기울기와 판 위 발 높이(#397, `docs/design/screens/magpie_nest.md` 1-5-4절, 형식 기록 12절 개정 5).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import artJson from '../../public/scenes/magpie_nest-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { CHARACTERS, type CharacterId } from './characters';
import { TICK_MS } from './config';
import { parseSceneArt, sceneDraws, tiltDrop } from './sceneArt';
import { parseSpriteMeta } from './sprite';
import type { CharactersData, ScreenData } from './puzzle/types';
import { boardDrop, createScene, floorTarget, isBusy, runAction, sceneTap, sceneTick, tiltOf, type SceneData, type SceneState } from './scene';

const art = parseSceneArt(artJson);
const sprites = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData, art, sprites };
const seesaw = art.objects.find((o) => o.key === 'seesaw')!;
const tilt = seesaw.tilt!;
const ENDS = ['seesaw_left', 'seesaw_right'] as const;
const IDS = CHARACTERS.map((c) => c.id);
const WEIGHT: Record<CharacterId, number> = { jjuk: 1, ppik: 1, mukjik: 2 };
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
  it('시소에 기울기 4칸(−6, −3, 3, 6)과 판 밑 바닥 상자가 있다', () => {
    expect(Object.keys(tilt.frames).map(Number).sort((a, b) => a - b)).toEqual([-6, -3, 3, 6]);
    expect(tilt).toMatchObject({ step: 3, weight: WEIGHT, pivot: 247.5, run: 40 });
    expect(seesaw.noFloor).toEqual({ box: [204, 200, 89, 38], y: 240 });
  });

  it('설계 1-5-4절 발 높이 표와 같다', () => {
    const table: [number, number, number][] = [[-6, 218, 209], [-3, 216, 211], [0, 214, 214], [3, 212, 217], [6, 210, 219]];
    for (const [dd, left, right] of table) expect([dd, top(dd, 220), top(dd, 284)]).toEqual([dd, left, right]);
  });

  it('d가 0이 아니면 멈춘 모습 대신 기울기 칸, anim 재생 중이면 anim 칸', () => {
    const view = (dd: number, playing: Parameters<typeof sceneDraws>[1]['playing'] = null) => ({ flagsOf: () => ({}), playing, clockMs: 0, tiltOf: () => dd });
    expect(sceneDraws(art, view(0)).byObject.seesaw).toEqual([seesaw.default.frame]);
    expect(sceneDraws(art, view(-3)).byObject.seesaw).toEqual([tilt.frames['-3']]);
    expect(sceneDraws(art, view(9)).byObject.seesaw).toEqual([seesaw.default.frame]); // 칸 없는 값은 수평 그대로
    const bounce = art.anims['seesaw_right.plank_bounce']!;
    expect(sceneDraws(art, view(-3, { object: 'seesaw', anim: bounce, ms: 0 })).byObject.seesaw).toEqual([bounce.frames[0]]);
  });

  it('그림 메타의 기울기 칸이 깨지면 파서가 막는다', () => {
    const bad = JSON.parse(JSON.stringify(artJson)) as { objects: { key: string; tilt?: { frames: Record<string, number> } }[] };
    bad.objects.find((o) => o.key === 'seesaw')!.tilt!.frames['0'] = 1;
    expect(() => parseSceneArt(bad)).toThrow(/tilt/);
  });
});

describe('보이는 탑승으로 기울기 정하기 (1-5-4절)', () => {
  it('빈 판은 수평, 혼자 탄 가벼운 사람 3px, 묵직이 6px, 무게 차만 기운다', () => {
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
      const want = 3 * riders.reduce((sum, [id, end]) => sum + (end === 'seesaw_right' ? 1 : -1) * WEIGHT[id], 0);
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
      const after = before + 3 * (end === 'seesaw_right' ? 1 : -1) * WEIGHT[who];
      runAction(data, s, { char: who, verb: 'move', target: end }, null);
      let lastAir: number | null = null;
      let landed = false;
      for (let i = 0; i < 3000 && isBusy(s); i++) {
        sceneTick(data, s);
        const h = s.hops[who];
        const dd = d(s);
        // 반대 끝 사람 발은 매 틱 지금 그리는 판 위에 있다(보간 없음).
        if (other) expect(Math.round(footY(s, other)), label).toBe(top(dd, s.walkers[other].x));
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
    expect(d(s)).toBe(-3);
    runAction(data, s, { char: 'jjuk', verb: 'move', target: 'seesaw_right' }, null);
    const seen: number[] = [];
    for (let i = 0; i < 600 && isBusy(s); i++) {
      sceneTick(data, s);
      const dd = d(s);
      if (seen[seen.length - 1] !== dd) seen.push(dd);
      expect(s.riding.jjuk).toBeDefined();
      expect(Math.round(footY(s, 'jjuk'))).toBe(top(dd, s.walkers.jjuk.x));
    }
    expect(seen).toEqual([-3, 3]);
  });

  it('정답 11번: U6 동안은 쭉이가 탄 기울기, 발사(`launch_to_hook`)가 시작되는 틱에 수평', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    let sawBounce = false;
    let sawLaunch = false;
    for (let i = 0; i < 3000 && isBusy(s); i++) {
      sceneTick(data, s);
      const ev = s.current?.ev;
      if (ev?.type === 'anim' && ev.name === 'plank_bounce') {
        sawBounce = true;
        expect(d(s)).toBe(-3); // 멈춘 기울기(그림 고르기용)는 그대로. 판은 U6 칸이 그린다
      }
      if (ev?.type === 'anim' && ev.name === 'launch_to_hook') {
        sawLaunch = true;
        expect(d(s)).toBe(0);
        expect(boardDrop(data, s, 'jjuk')).toBe(0);
      }
    }
    expect([sawBounce, sawLaunch]).toEqual([true, true]);
    expect(s.puzzle.at.jjuk).toBe('hook');
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

  it('U6 칸별 기울기 메타(12-5절): 오른쪽 끝 4 → 7 → −2, 왼쪽 끝 반대', () => {
    expect(art.anims['seesaw_right.plank_bounce']!.tilt).toEqual([4, 7, -2]);
    expect(art.anims['seesaw_left.plank_bounce']!.tilt).toEqual([-4, -7, 2]);
  });

  it('정답 11번: U6 동안 왼쪽 쭉이 발이 칸마다 판을 따른다(211 → 209 → 215, 1-5-4절 표)', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_left');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, null);
    expect(bounceFeet(s, 'jjuk')).toEqual([[0, 211], [1, 209], [2, 215]]);
    expect(s.puzzle.at.jjuk).toBe('hook');
  });

  it('14번: U6 동안 오른쪽에 탄 사람 발이 왼쪽 끝 이벤트 칸을 따른다(210 → 208 → 216)', () => {
    const s = ready();
    board(s, 'jjuk', 'seesaw_right');
    runAction(data, s, { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' }, null);
    expect(bounceFeet(s, 'jjuk')).toEqual([[0, 210], [1, 208], [2, 216]]);
  });

  it('15번: 판 위 묵직이가 찧으면 먼저 바닥으로 내려서서 U6 동안 판 위 발이 없다(1-5-2절 "판 옆 바닥에서 찧는다")', () => {
    for (const end of ENDS) {
      const s = ready();
      board(s, 'mukjik', end);
      runAction(data, s, { char: 'mukjik', verb: 'stomp', target: end }, null);
      let n = 0;
      for (let i = 0; i < 3000 && isBusy(s); i++) {
        sceneTick(data, s);
        if (s.current?.ev.type !== 'anim' || s.current.ev.name !== 'plank_bounce') continue;
        n++;
        expect(s.riding.mukjik).toBeUndefined();
        expect(boardDrop(data, s, 'mukjik')).toBe(0);
        expect(s.walkers.mukjik.y).toBe(244);
      }
      expect(n).toBeGreaterThan(0);
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
        expect(Math.round(s.walkers.jjuk.y + boardDrop(noTilt, s, 'jjuk'))).toBe(top(-3, s.walkers.jjuk.x));
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
    expect(d(s)).toBe(6);
    settle(s);
    expect(d(s)).toBe(6);
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
