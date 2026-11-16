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
import type { CharactersData, PuzzleState, ScreenData } from '../../src/core/puzzle/types';

const ROOT = join(import.meta.dirname, '..', '..');
const load = (...p: string[]): unknown => JSON.parse(readFileSync(join(ROOT, ...p), 'utf8'));
const characters = load('content', 'characters.json') as CharactersData;

/** 화면별 아직 그림이 없는 `캐릭터:자세`. 정렬해 둔다. 줄을 지우는 건 그림을 넣은 PR의 몫이다. */
const MISSING: Record<string, string[]> = {
  magpie_nest: [
    'jjuk:common.bump_bottom',
    'jjuk:common.flatten',
    'jjuk:common.reach_wobble',
    'jjuk:common.stretch',
    'jjuk:common.wet',
    'mukjik:common.flatten',
    'ppik:common.bump_bottom',
    'ppik:common.flatten',
    'ppik:common.shiver',
    'ppik:common.wag_finger',
    'ppik:hide_in_basket',
    'ppik:hold',
    'ppik:launch_to_hook',
  ],
};

/** 시트가 있는 캐릭터의 `anims` 키. 시트가 없으면 빈 집합(모든 자세가 실루엣). */
function sheetAnims(char: string): Set<string> {
  const f = `${char}-base.json`;
  if (!readdirSync(join(ROOT, 'public', 'sprites')).includes(f)) return new Set();
  const meta = load('public', 'sprites', f) as { anims?: Record<string, unknown> };
  return new Set(Object.keys(meta.anims ?? {}));
}

/** 화면에서 캐릭터가 받을 수 있는 `캐릭터:자세` 전부. */
function screenPoses(screen: ScreenData): string[] {
  const host = screenHost(screen, characters);
  const chars = new Set(Object.keys(screen.start.at));
  const holdSpots = new Set(Object.entries(screen.spots).filter(([, s]) => s.hold).map(([id]) => id));
  const out = new Set<string>();
  for (const c of chars) out.add(`${c}:idle`).add(`${c}:walk`);
  for (const item of screen.onEnter ?? []) {
    if ('anim' in item && chars.has(item.anim[0])) out.add(`${item.anim[0]}:${item.anim[1]}`);
  }
  const seen = new Set<string>([stateKey(host.initial)]);
  const queue: PuzzleState[] = [host.initial];
  while (queue.length) {
    const s = queue.shift()!;
    for (const [c, at] of Object.entries(s.at)) if (holdSpots.has(at)) out.add(`${c}:hold`);
    if (host.isClear(s)) continue;
    for (const a of host.actions(s)) {
      const r = step(screen, s, a, characters);
      for (const e of r.events) if (e.type === 'anim' && chars.has(e.target)) out.add(`${e.target}:${e.name}`);
      const k = stateKey(r.state);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(r.state);
      }
    }
  }
  return [...out].sort();
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
