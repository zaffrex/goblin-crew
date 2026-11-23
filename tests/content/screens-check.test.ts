import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkScreen, solutionLengthWarning, formatReport, reportErrors, uniqueReactions } from '../../src/core/puzzle/check';
import { difficultyReport, formatDifficulty, formatReactions, reactionReport } from './difficulty';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67: BFS check for every screen in content/screens (ADR-0018, ADR-0096). Report goes to the CI log.
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const load = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const characters = load(dir('../../content/characters.json')) as CharactersData;
const files = readdirSync(dir('../../content/screens')).filter((f) => f.endsWith('.json') && f !== 'order.json');

describe('screen BFS check', () => {
  it.each(files)('screens/%s', (file) => {
    const screen = load(dir(`../../content/screens/${file}`)) as ScreenData;
    const r = checkScreen(screen, characters);
    console.info(formatReport(screen, r));
    console.info(formatDifficulty(difficultyReport(screen, characters)));
    console.info(formatReactions(reactionReport(screen, characters)));
    expect(reportErrors(r)).toEqual([]);
    for (const [k, v] of Object.entries(r.requiredAbilities)) expect(v, `${k} 판정`).not.toBeNull();
  });

  it('warns when solution is longer than the BFS shortest (warning only)', () => {
    const screen = load(dir('../../content/screens/laundromat.json')) as ScreenData;
    const r = checkScreen(screen, characters);
    expect(solutionLengthWarning(screen, r.explore)).toBeNull();
    const padded = { ...screen, solution: [...screen.solution!.slice(0, -1), screen.solution![0]!, screen.solution!.at(-1)!] } as ScreenData;
    expect(solutionLengthWarning(padded, r.explore)).toMatch(/최단/);
    expect(solutionLengthWarning({ ...screen, solution: undefined } as ScreenData, r.explore)).toBeNull();
  });

  it('counts unique reactions without common.*', () => {
    const screen = load(dir('../../content/screens/magpie_nest.json')) as ScreenData;
    // 11 = 9 + 묵직이 `seesaw_stomp`(#414) + 까치 `twist`(U10 클리어 반전 컷, #763). 새 칸 없이 있는 칸을 잇는 시트 줄이지만 화면 고유 연출로 센다(R1 하한 이름 4. 상한은 ADR-0422 새 칸 48, tests/art/r1-cells.test.ts).
    expect(uniqueReactions(screen)).toBe(11);
    const withSpots = { spots: { a: { takenShow: [{ anim: ['x', 'taken_u'] }], releaseShow: { default: [{ anim: ['x', 'release_u'] }] } } } };
    expect(uniqueReactions(withSpots as unknown as ScreenData)).toBe(2);
    expect(uniqueReactions({ ...screen, fallbacks: undefined, onEnter: undefined, rules: [{ show: [{ anim: ['a', 'common.x'] }, { anim: ['a', 'y'] }] }] } as unknown as ScreenData)).toBe(1);
  });
});

// 특기 자리(ui-interaction.md 6-4-1c, #723): `box` 있는 비-`hold` 서는 자리의 `hintAbility`가 A면, 특기가 A인 캐릭터는
// 그 자리 첫 클릭이 올라서기 대신 A다(interact.ts `specialtySpot`, 자리 데이터만 본다). 그러니 데이터에
// `target` = 그 자리, `verb` = A 규칙이 있어야 한다. 없으면 첫 클릭이 폴백으로 빠지고 그 자리로 올라설 길도 없어진다.
describe('specialty spots have a rule for their hintAbility (6-4-1c)', () => {
  it.each(files)('screens/%s', (file) => {
    const screen = load(dir(`../../content/screens/${file}`)) as ScreenData;
    const missing = Object.entries(screen.spots)
      .filter(([, s]) => s.box && !s.hold && !s.free && s.hintAbility)
      .filter(([id, s]) => !screen.rules.some((r) => r.target === id && r.verb === s.hintAbility))
      .map(([id, s]) => `${id} × ${s.hintAbility}`);
    expect(missing).toEqual([]);
  });
});
