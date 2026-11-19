import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkScreen, formatReport, reportErrors, uniqueReactions } from '../../src/core/puzzle/check';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67: BFS check for every screen in content/screens (ADR-0018, ADR-0096). Report goes to the CI log.
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const load = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const characters = load(dir('../../content/characters.json')) as CharactersData;
const files = readdirSync(dir('../../content/screens')).filter((f) => f.endsWith('.json'));

describe('screen BFS check', () => {
  it.each(files)('screens/%s', (file) => {
    const screen = load(dir(`../../content/screens/${file}`)) as ScreenData;
    const r = checkScreen(screen, characters);
    console.info(formatReport(screen, r));
    expect(reportErrors(r)).toEqual([]);
    for (const [k, v] of Object.entries(r.requiredAbilities)) expect(v, `${k} 판정`).not.toBeNull();
  });

  it('counts unique reactions without common.*', () => {
    const screen = load(dir('../../content/screens/magpie_nest.json')) as ScreenData;
    // 10 = 9 + 묵직이 `seesaw_stomp`(#414). 새 칸 없이 있는 칸을 잇는 시트 줄이지만 화면 고유 연출로 센다(ADR-0018 R1 상한 12).
    expect(uniqueReactions(screen)).toBe(10);
    const withSpots = { spots: { a: { takenShow: [{ anim: ['x', 'taken_u'] }], releaseShow: { default: [{ anim: ['x', 'release_u'] }] } } } };
    expect(uniqueReactions(withSpots as unknown as ScreenData)).toBe(2);
    expect(uniqueReactions({ ...screen, fallbacks: undefined, onEnter: undefined, rules: [{ show: [{ anim: ['a', 'common.x'] }, { anim: ['a', 'y'] }] }] } as unknown as ScreenData)).toBe(1);
  });
});
