// 화면 자세 장부 (#142, M1 판정 2 시작 조건). 재생 도구 A7(`replay.ts --require-art`)은 재생이 지나간
// 자세만 센다. 사장님은 자유롭게 플레이하시니 실패 연출도 판정 화면이다. 그래서 여기서는 화면의 모든
// 도달 가능한 상태 × 모든 행동을 진짜 `step`으로 돌려(#67 BFS와 같은 호스트) 캐릭터가 받을 수 있는 자세를
// 전부 모으고, 시트 `anims`(`public/sprites/<캐릭터>-base.json`)와 대조한다.
// - `@자리`·`self` 대상은 `step`이 실제 캐릭터로 풀어 준 결과를 쓰니, 누가 그 자리에 올 수 있는지 손으로 펼치지 않는다.
// - 연출 말고 엔진이 고르는 자세: `idle`·`walk`는 모두, `hold`는 `hold` 자리에 닿을 수 있는 캐릭터만(`src/core/fallbacks.ts` `poseKey`).
// - `MISSING`은 아직 시트에 없는 자세(= 화면에서 실루엣)다. 자세 PR이 그림을 넣으면 여기서 그 줄을 지워야 테스트가 통과한다.
//   **`MISSING`이 비면 판정 2 시작 조건(m1-acceptance.md 2번 자세 장부)을 채운 것이다.**

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stateKey } from '../../src/core/puzzle/bfs';
import { screenHost } from '../../src/core/puzzle/check';
import { step } from '../../src/core/puzzle/step';
import type { CharacterId } from '../../src/core/characters';
import { actionKey, targetIntent, type PuzzleTarget } from '../../src/core/interact';
import { type Action, type CharactersData, type PuzzleState, type ScreenData, type StepResult } from '../../src/core/puzzle/types';

const ROOT = join(import.meta.dirname, '..', '..');
const load = (...p: string[]): unknown => JSON.parse(readFileSync(join(ROOT, ...p), 'utf8'));
const characters = load('content', 'characters.json') as CharactersData;

/** 화면별 아직 그림이 없는 `캐릭터:자세`. 정렬해 둔다. 줄을 지우는 건 그림을 넣은 PR의 몫이다. */
const MISSING: Record<string, string[]> = {
  magpie_nest: [],
  // #380 화면 JSON. 7절 P6(위로 곧게 집기, 1-3 조건)과 클리어 컷 ③ 셋이 젖음. 쭉이 common.wet은 이미 있다.
  park_fountain: ['jjuk:take_up', 'mukjik:common.wet', 'ppik:common.wet'],
};

/** 시트가 있는 캐릭터의 `anims` 키. 시트가 없으면 빈 집합(모든 자세가 실루엣). */
function sheetAnims(char: string): Set<string> {
  const f = `${char}-base.json`;
  if (!readdirSync(join(ROOT, 'public', 'sprites')).includes(f)) return new Set();
  const meta = load('public', 'sprites', f) as { anims?: Record<string, unknown> };
  return new Set(Object.keys(meta.anims ?? {}));
}

/**
 * 도달 가능한 클리어 전 상태 × 모든 행동을 진짜 `step`으로 한 번씩 돌린다(#67 BFS와 같은 호스트).
 * `invalid`(엔진이 거르는 행동)는 넘긴다. 자세 장부와 반응 검사(#469)가 같이 쓴다.
 */
function eachStep(
  screen: ScreenData,
  chars: CharactersData,
  visit: (s: PuzzleState, a: Action, r: StepResult) => void,
): PuzzleState[] {
  const host = screenHost(screen, chars);
  const seen = new Set<string>([stateKey(host.initial)]);
  const states: PuzzleState[] = [];
  const queue: PuzzleState[] = [host.initial];
  while (queue.length) {
    const s = queue.shift()!;
    states.push(s);
    if (host.isClear(s)) continue;
    for (const a of host.actions(s)) {
      const r = step(screen, s, a, chars);
      if (r.source === 'invalid') continue;
      visit(s, a, r);
      const k = stateKey(r.state);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(r.state);
      }
    }
  }
  return states;
}

/** 화면에서 캐릭터가 받을 수 있는 `캐릭터:자세` 전부. */
function screenPoses(screen: ScreenData): string[] {
  const chars = new Set(Object.keys(screen.start.at));
  const holdSpots = new Set(Object.entries(screen.spots).filter(([, s]) => s.hold).map(([id]) => id));
  const out = new Set<string>();
  for (const c of chars) out.add(`${c}:idle`).add(`${c}:walk`);
  for (const item of screen.onEnter ?? []) {
    if ('anim' in item && chars.has(item.anim[0])) out.add(`${item.anim[0]}:${item.anim[1]}`);
  }
  const states = eachStep(screen, characters, (_s, _a, r) => {
    for (const e of r.events) if (e.type === 'anim' && chars.has(e.target)) out.add(`${e.target}:${e.name}`);
  });
  for (const s of states) for (const [c, at] of Object.entries(s.at)) if (holdSpots.has(at)) out.add(`${c}:hold`);
  return [...out].sort();
}

/**
 * 플레이어가 이 상태에서 누를 수 있는 행동의 `actionKey` 집합.
 * 규칙을 손으로 옮기지 않고 UI 판정(`resolveTap`)이 히트 뒤에 부르는 `targetIntent`를 그대로 부른다(#476 리뷰 후속).
 * 대상 = 바닥 + 모든 핫스팟 + 상자 있는 자리. 캐릭터 대상은 전환이라 퍼즐 행동이 아니다.
 * 상자가 겹쳐 실제로는 못 누르는 대상(입력층)은 여기서 안 본다. 그건 replay 몫이다.
 */
function tappableKeys(screen: ScreenData, s: PuzzleState): Set<string> {
  const targets: PuzzleTarget[] = [
    null,
    ...Object.keys(screen.hotspots).map((ref) => ({ kind: 'hotspot' as const, ref })),
    ...Object.entries(screen.spots).filter(([, sp]) => sp.box).map(([ref]) => ({ kind: 'spot' as const, ref })),
  ];
  const keys = new Set<string>();
  for (const char of Object.keys(s.at) as CharacterId[]) {
    for (const t of targets) {
      const r = targetIntent({ screen, puzzle: s }, char, t, { x: 0, y: 0 });
      if (r.kind === 'act') keys.add(r.key);
    }
  }
  return keys;
}

/**
 * 눌렀는데 보이는 반응이 없는 행동(#469, 회고 #1 A2). 걷기만 하고 끝나면 반응이 아니다(#266 첫 클릭 무반응).
 * 반응 = 걷기 말고 다른 이벤트 하나 이상(자세·말풍선·효과·게이지·손 놓기·배치·기절·클리어),
 * 또는 `move`로 실제로 자리가 바뀜(걸어가 서는 것 자체가 결과다).
 * 돌려주는 줄: `캐릭터.동사@대상 (source) ← 상태`. 같은 행동은 처음 만난 상태 하나만 적는다.
 */
function silentActions(screen: ScreenData, chars: CharactersData): string[] {
  const out = new Map<string, string>();
  let last: PuzzleState | null = null;
  let tappable = new Set<string>();
  eachStep(screen, chars, (s, a, r) => {
    if (s !== last) [last, tappable] = [s, tappableKeys(screen, s)];
    if (!tappable.has(actionKey(a))) return;
    if (r.events.some((e) => e.type !== 'walk')) return;
    if (a.verb === 'move' && r.state.at[a.char] !== s.at[a.char]) return;
    const key = `${a.char}.${a.verb}@${a.target} (${r.source})`;
    if (!out.has(key)) out.set(key, `${key} ← ${JSON.stringify({ at: s.at, flags: Object.keys(s.flags).filter((f) => s.flags[f]) })}`);
  });
  return [...out.values()].sort();
}

const screens = readdirSync(join(ROOT, 'content', 'screens'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => load('content', 'screens', f) as ScreenData);

describe('화면 자세 장부 (#142, 판정 2 시작 조건)', () => {
  it.each(screens.map((s) => [s.id, s] as const))('%s: 시트에 없는 자세 = MISSING', (id, screen) => {
    const poses = screenPoses(screen);
    const missing = poses.filter((p) => {
      const [char = '', name = ''] = p.split(':');
      return !sheetAnims(char).has(name);
    });
    console.info(`[${id}] 자세 ${poses.length}개, 그림 없음 ${missing.length}개: ${missing.join(', ') || '없음'}`);
    // 새 실루엣이 생겼으면(화면 데이터에 자세 추가) 그림을 그리거나 여기에 올린다. 그림이 생겼으면 줄을 지운다.
    expect(missing, `MISSING['${id}']를 이 목록으로 맞춰 주세요`).toEqual(MISSING[id] ?? []);
  });

  it('MISSING에 없는 화면 이름이 없다', () => {
    const ids = new Set(screens.map((s) => s.id));
    for (const id of Object.keys(MISSING)) expect(ids.has(id), id).toBe(true);
  });
});

describe('반응 없는 행동 (#469, 회고 #1 A2)', () => {
  // 막다른 상태는 BFS(#454)가, 히트 상자·겹침은 replay가 잡는다. 여기서는 "눌렀는데 아무 일 없음"만 본다.
  it.each(screens.map((s) => [s.id, s] as const))('%s: 누를 수 있는 행동마다 보이는 반응이 있다', (id, screen) => {
    const silent = silentActions(screen, characters);
    console.info(`[${id}] 반응 없는 행동 ${silent.length}개`);
    // 실패하면: 그 대상에 규칙·핫스팟 폴백을 주거나, characters.json 특기 폴백 말풍선이 빠졌는지 본다.
    expect(silent, `${id}: 반응 없는 행동`).toEqual([]);
  });

  const nest = screens.find((s) => s.id === 'magpie_nest')!;

  it('핫스팟 폴백과 특기 폴백 말풍선을 둘 다 지우면 잡는다', () => {
    // 화면 1은 모든 핫스팟에 쭉이 특기 폴백이 있어 캐릭터 공통 폴백까지 내려가지 않는다. 그래서 둘 다 지운다.
    const screen = structuredClone(nest);
    for (const fb of Object.values(screen.fallbacks ?? {})) delete fb.stretch;
    const chars = structuredClone(characters);
    delete chars.fallbacks!.jjuk!.stretch;
    const silent = silentActions(screen, chars);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((l) => l.startsWith('jjuk.stretch@') && l.includes('(characterFallback)'))).toBe(true);
  });

  it('규칙 연출을 지우고 플래그만 바꾸면 잡는다', () => {
    const screen = structuredClone(nest);
    const rule = screen.rules.find((r) => r.show?.length && r.do && !r.do.move && !r.do.gauge && !r.do.give && !r.do.take);
    expect(rule, '플래그만 바꾸는 규칙이 화면 1에 있어야 한다').toBeDefined();
    rule!.show = [];
    const silent = silentActions(screen, characters);
    expect(silent.some((l) => l.includes('(rule)'))).toBe(true);
  });

  it('자리가 차서 막혔는데 연출이 없으면 잡는다', () => {
    // 걸어가 서는 `move`는 반응으로 치므로(통과 테스트), 막힌 `move`만 목록에 나와야 한다.
    const screen = structuredClone(nest);
    for (const spot of Object.values(screen.spots)) delete spot.takenShow;
    const silent = silentActions(screen, characters);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((l) => l.includes('.move@') && l.includes('(blocked)'))).toBe(true);
  });
});
