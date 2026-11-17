import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initialState, step } from '../../src/core/puzzle/step';
import type { ScreenData } from '../../src/core/puzzle/types';

// ADR-0065 7절: 화면의 solution을 처음부터 step으로 재생한다.
// 모든 행동이 rule 또는 기본 move, 게이지 0 없음, 마지막 행동에서 clear.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const text = load('../../content/text/ja.json') as Record<string, string>;

describe('magpie_nest solution playthrough', () => {
  it('clears with rule/move actions only and never faints', () => {
    const solution = screen.solution ?? [];
    expect(solution.length).toBe(4);
    let s = initialState(screen);
    solution.forEach((a, i) => {
      const r = step(screen, s, a);
      expect(['rule', 'move'], `step ${i} ${JSON.stringify(a)}`).toContain(r.source);
      expect(r.events.some((e) => e.type === 'faint')).toBe(false);
      expect(r.events.some((e) => e.type === 'clear')).toBe(i === solution.length - 1);
      s = r.state;
    });
    expect(s.flags[screen.exitFlag]).toBe(true);
    expect(s.items).toContain('item.shop_key');
  });

  it('every say text ID exists in content/text/ja.json', () => {
    const ids = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (k === 'say' && Array.isArray(x)) [x[1]].flat().forEach((id) => ids.add(String(id)));
          else walk(x);
        }
      }
    };
    walk(screen);
    expect([...ids].filter((id) => !(id in text))).toEqual([]);
  });
});
