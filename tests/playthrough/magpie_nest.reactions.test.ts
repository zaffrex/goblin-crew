import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { characterDef } from '../../src/core/characters';
import { stateKey } from '../../src/core/puzzle/bfs';
import { screenHost } from '../../src/core/puzzle/check';
import type { CharactersData, PuzzleState, ScreenData } from '../../src/core/puzzle/types';

// ADR-0018 F2 "입력 1번 = 반응 1개": 화면 1에서 고를 수 있는 행동은 전부 보이는 반응을 낸다.
// #123/#124: look·hand가 폴백 ②로 갔는데 characters.json에 반응이 없어서 탭해도 아무 일이 없었다.
// 검사 범위: BFS로 닿는 모든 상태(클리어 상태 제외) × 캐릭터 × (보기·손·자기 능력) × 대상 전부(바닥 포함).
// `move`는 걷기 자체가 반응이라 뺀다. `walk`·`gauge`만 나오는 결과는 무반응으로 센다.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const characters = load('../../content/characters.json') as CharactersData;
const host = screenHost(screen, characters);

/** 시작 상태에서 닿는 모든 상태(게이지 포함). 클리어 상태는 더 펼치지 않는다. */
function reachable(): PuzzleState[] {
  const seen = new Map<string, PuzzleState>([[stateKey(host.initial), host.initial]]);
  const queue = [host.initial];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]!;
    if (host.isClear(s)) continue;
    for (const a of host.actions(s)) {
      const next = host.step(s, a).state;
      const key = stateKey(next);
      if (!seen.has(key)) {
        seen.set(key, next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()].filter((s) => !host.isClear(s));
}

describe('magpie_nest: 무반응 행동이 없다 (F2, #124)', () => {
  const states = reachable();

  it('BFS가 화면 전체를 돈다(#67 리포트와 같은 규모)', () => {
    // check 리포트의 stateCount(305)에서 클리어 상태를 뺀 수. 크게 줄면 탐색이 잘린 것이다.
    expect(states.length).toBeGreaterThan(200);
  });

  it('닿는 모든 상태에서 캐릭터 × (보기·손·자기 능력) × 대상이 walk·gauge 말고 이벤트를 낸다', () => {
    const silent = new Set<string>();
    let checked = 0;
    for (const s of states) {
      for (const a of host.actions(s)) {
        if (a.verb !== 'look' && a.verb !== 'hand' && characterDef(a.char).ability !== a.verb) continue;
        const r = host.step(s, a);
        if (r.source === 'invalid') continue;
        checked++;
        if (!r.events.some((e) => e.type !== 'walk' && e.type !== 'gauge')) silent.add(`${a.char} ${a.verb} ${a.target} (${r.source})`);
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect([...silent]).toEqual([]);
  });
});
