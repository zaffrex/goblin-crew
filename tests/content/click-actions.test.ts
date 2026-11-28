import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { actionKey, targetIntent, type PuzzleTarget } from '../../src/core/interact';
import { stateKey } from '../../src/core/puzzle/bfs';
import { screenHost } from '../../src/core/puzzle/check';
import type { CharacterId, CharactersData, PuzzleState, ScreenData } from '../../src/core/puzzle/types';

// ADR-1031 3절 "CI 시간": BFS `actions`는 한 번 누르기로 낼 수 있는 동사만 시도한다(`clickActions`).
// 줄인 탓에 플레이어가 누를 수 있는 길을 BFS가 놓치면 막다른 상태·필수 특기 판정이 틀린다.
// 그래서 닿는 모든 상태에서 UI 판정(`targetIntent`, 마우스·터치 공통)이 내는 퍼즐 행동이 전부 `actions` 안에 있는지 본다.
// 든 물건 누르기(4/4)는 아직 `targetIntent`에 없다. 붙이면 이 테스트가 그대로 그 행동도 덮는다.
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const load = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const characters = load(dir('../../content/characters.json')) as CharactersData;
const files = readdirSync(dir('../../content/screens')).filter((f) => f.endsWith('.json') && f !== 'order.json');

function reachable(screen: ScreenData): PuzzleState[] {
  const host = screenHost(screen, characters);
  const seen = new Set([stateKey(host.initial)]);
  const queue = [host.initial];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]!;
    if (host.isClear(s)) continue;
    for (const a of host.actions(s)) {
      const next = host.step(s, a).state;
      const k = stateKey(next);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(next);
      }
    }
  }
  return queue.filter((s) => !host.isClear(s));
}

describe('BFS click actions cover every UI action (ADR-1031 3절)', () => {
  it.each(files)('screens/%s', (file) => {
    const screen = load(dir(`../../content/screens/${file}`)) as ScreenData;
    const host = screenHost(screen, characters);
    // 누를 수 있는 대상: 상자 있는 서는 자리, 핫스팟, 바닥(null). 서는 자리 위 내 몸은 그 자리와 같은 판정이다.
    const targets: PuzzleTarget[] = [
      null,
      ...Object.entries(screen.spots).filter(([, sp]) => sp.box).map(([ref]) => ({ kind: 'spot' as const, ref })),
      ...Object.keys(screen.hotspots).map((ref) => ({ kind: 'hotspot' as const, ref })),
    ];
    const missing = new Set<string>();
    let checked = 0;
    for (const s of reachable(screen)) {
      const keys = new Set(host.actions(s).map(actionKey));
      for (const me of Object.keys(s.at) as CharacterId[]) {
        for (const target of targets) {
          const intent = targetIntent({ screen, puzzle: s }, me, target, { x: 0, y: 0 });
          if (intent.kind !== 'act') continue;
          checked++;
          if (!keys.has(intent.key)) missing.add(intent.key);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect([...missing]).toEqual([]);
  });
});
