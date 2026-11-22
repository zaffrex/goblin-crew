import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Action, CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { createScene, currentBubble, currentCut, isBusy, sceneLayout, sceneTap, sceneTick, type SceneData, type SceneState } from '../../src/core/scene';
import { parseSceneArt } from '../../src/core/sceneArt';
import { CASES_BY_SCREEN } from './cases/index';
import { planAction, type Input } from './plan';

// frames.ts 사례(#466 2부)를 Chrome 없이 실제 scene.ts에 넣어 본다. 여기서 실패하면 Chrome에서 찍기 전에
// 사례가 틀린 것(대상 이름 오타, pre 순서, 기대 대사)을 먼저 잡는다. 그림이 맞게 보이는지는 사람이 모음으로 본다.

const load = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const characters = load('content/characters.json') as CharactersData;
const SCREEN_FILES = readdirSync('content/screens').filter((f) => f.endsWith('.json') && f !== 'order.json').map((f) => f.replace(/\.json$/, ''));

describe('화면 파일 이름 = 화면 JSON id (#473 리뷰)', () => {
  // main.ts `pickScreen`은 파일 이름으로, `screenTextKey`는 JSON id로 화면을 찾는다. 둘이 다르면 화면별 글이 조용히 안 바뀐다.
  for (const f of SCREEN_FILES) {
    it(`content/screens/${f}.json의 id는 ${f}다`, () => {
      expect((load(`content/screens/${f}.json`) as ScreenData).id).toBe(f);
    });
  }
});

/** 연출이 끝날 때까지 틱. 그 사이 뜬 말풍선·컷 대사 키를 모은다. */
function idle(data: SceneData, s: SceneState, said: string[]): void {
  for (let i = 0; i < 20_000 && isBusy(s); i++) {
    sceneTick(data, s);
    const b = currentBubble(s);
    if (b && said.at(-1) !== b.text) said.push(b.text);
    const c = currentCut(s);
    if (c && !said.includes(c)) said.push(c);
  }
  expect(isBusy(s)).toBe(false);
}

function act(data: SceneData, s: SceneState, a: Action, input: Input, label: string, floor?: [number, number]): string[] {
  const plan = planAction(data.screen, sceneLayout(data, s), a, input, floor ? { floorPoint: { x: floor[0], y: floor[1] } } : {});
  expect(plan.warnings, label).toEqual([]);
  const said: string[] = [];
  for (const t of plan.taps) {
    const r = sceneTap(data, s, t.at, input === 'touch' ? 8 : 0, input === 'touch');
    expect(r.kind, `${label} / ${t.why}`).toBe('intent');
    idle(data, s, said);
  }
  return said;
}

describe('frames.ts 사례 (#466 2부)', () => {
  it('사례 파일이 있는 화면은 content/screens에 있다', () => {
    for (const id of Object.keys(CASES_BY_SCREEN)) expect(SCREEN_FILES).toContain(id);
  });

  for (const [screenId, cases] of Object.entries(CASES_BY_SCREEN)) {
    const data: SceneData = { screen: load(`content/screens/${screenId}.json`) as ScreenData, characters };

    it(`${screenId}: 사례 ID는 겹치지 않고 폴더 이름으로 쓸 수 있다`, () => {
      const ids = cases.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9_-]+$/);
    });

    for (const input of ['mouse', 'touch'] as const) {
      it(`${screenId} ${input}: pre·행동을 실제 탭으로 누를 수 있고, 기대 대사가 뜬다`, () => {
        for (const c of cases) {
          const s = createScene(data);
          idle(data, s, []);
          if (!c.action) continue;
          for (const a of c.pre ?? []) act(data, s, a, input, `${c.id} pre ${a.char} ${a.verb} ${a.target}`, c.floor);
          const said = act(data, s, c.action, input, c.id, c.floor);
          // scene.ts 말풍선 글은 대사 키 그대로다(글 파일은 엔진 쪽에서 바꾼다).
          if (c.says) expect(said, c.id).toContain(c.says);
        }
      });
    }
  }

  it('park_fountain: 0절 단서 표 줄(주 ①~③, 보조 ①~③)과 9절 진입·대기가 다 있다', () => {
    const ids = CASES_BY_SCREEN.park_fountain!.map((c) => c.id);
    for (const p of ['clue-main-1', 'clue-main-2', 'clue-main-3', 'clue-aux-1', 'clue-aux-2', 'clue-aux-3', 'enter', 'idle']) {
      expect(ids.some((id) => id.startsWith(p)), p).toBe(true);
    }
  });
});

describe('idle 사례가 대기 loop의 첫 움직임을 찍는다 (#477)', () => {
  // frames.ts는 시작 카드를 닫은 순간부터 `every`마다 찍고, 연출이 끝났으면 `minMs`에서 멈춘다.
  // 그림 쪽에서 loop 주기를 늘리면(예: 꾸벅 15초 → 18초) 사례는 조용히 움직임을 놓친다. 그래서 그림 데이터로 잰다.
  // 2026-11-20 로컬 캡처: 꾸벅이 15000·15200ms, 움찔이 12001·12200ms 칸에 찍혔다(벽시계 = 화면 시계).
  // 느린 PC에서는 화면 시계가 벽시계보다 늦게 가므로(#286) 끝에 1초를 남긴다.
  const LAG_MS = 1000;
  for (const [screenId, cases] of Object.entries(CASES_BY_SCREEN)) {
    const c = cases.find((x) => x.id === 'idle');
    const artPath = `public/scenes/${screenId}-objects.json`;
    if (!c) continue;
    it(`${screenId}: idle 사례 창(minMs)과 간격(every)이 멈춘 모습 loop마다 움직이는 칸을 덮는다`, () => {
      const art = parseSceneArt(load(artPath));
      const every = c.every ?? 120;
      const minMs = c.minMs ?? 0;
      let loops = 0;
      for (const o of art.objects) {
        const loop = o.effect === undefined ? o.default.loop : undefined;
        if (!loop) continue;
        loops++;
        // 처음으로 첫 칸과 다른 칸이 나오는 자리 = 처음 보이는 움직임.
        const i = loop.frames.findIndex((f) => f !== loop.frames[0]);
        expect(i, `${o.key}: loop 칸이 다 같다`).toBeGreaterThan(0);
        const start = loop.ms.slice(0, i).reduce((a, b) => a + b, 0);
        const end = start + loop.ms[i]!;
        expect(end + LAG_MS, `${o.key}: 첫 움직임 ${start}~${end}ms가 창 ${minMs}ms(여유 ${LAG_MS}) 밖`).toBeLessThanOrEqual(minMs);
        expect(every, `${o.key}: 움직이는 칸 ${loop.ms[i]}ms보다 간격이 길면 칸 사이로 빠진다`).toBeLessThanOrEqual(loop.ms[i]!);
      }
      expect(loops, 'idle 사례가 있는데 멈춘 모습 loop가 없다').toBeGreaterThan(0);
    });
  }
});
