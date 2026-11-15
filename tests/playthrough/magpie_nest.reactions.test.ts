import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../../src/core/characters';
import { initialState, step } from '../../src/core/puzzle/step';
import type { CharactersData, PuzzleState, ScreenData, Verb } from '../../src/core/puzzle/types';

// ADR-0018 F2 "입력 1번 = 반응 1개": 화면 1에서 플레이어가 고를 수 있는 행동은 전부 이벤트가 1개 이상이다.
// #123: look·hand가 폴백 ②로 갔는데 characters.json에 반응이 없어서 탭해도 아무 일이 없었다.
// 바닥 탭은 동사와 상관없이 걷기라서(`interact.ts` floorIntent) 대상에서 뺀다.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const characters = load('../../content/characters.json') as CharactersData;

const targets = [...Object.keys(screen.hotspots), ...Object.keys(screen.spots).filter((id) => !screen.spots[id]!.free)];

/** 시작 상태와 정답을 한 걸음씩 진행한 상태들(클리어 직전까지). */
function states(): PuzzleState[] {
  const out = [initialState(screen)];
  for (const a of (screen.solution ?? []).slice(0, -1)) out.push(step(screen, out[out.length - 1]!, a, characters).state);
  return out;
}

describe('magpie_nest: 무반응 행동이 없다 (F2, #123)', () => {
  it('정답 경로의 각 상태에서 캐릭터 × (보기·손·자기 능력) × 대상이 모두 이벤트를 낸다', () => {
    const silent: string[] = [];
    states().forEach((s, i) => {
      for (const c of CHARACTERS) {
        const verbs: Verb[] = ['look', 'hand', c.ability];
        for (const verb of verbs) {
          for (const target of targets) {
            const r = step(screen, s, { char: c.id, verb, target }, characters);
            if (r.source !== 'invalid' && r.events.length === 0) silent.push(`state${i} ${c.id} ${verb} ${target} (${r.source})`);
          }
        }
      }
    });
    expect(silent).toEqual([]);
  });
});
