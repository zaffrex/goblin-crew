import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reactionReport } from './difficulty';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67 / PR #822 review (Theo): pin the reactionReport warnings on a toy screen derived from laundromat.
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const load = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const characters = load<CharactersData>(dir('../../content/characters.json'));
const base = (): ScreenData => load<ScreenData>(dir('../../content/screens/laundromat.json'));

describe('reactionReport', () => {
  it('counts decoy actions taken at on-path states (laundromat has only on-path states)', () => {
    const r = reactionReport(base(), characters);
    expect(r.wrong.states).toBe(3);
    expect(r.wrong.reactions).toBeGreaterThan(0);
  });

  it('warns when a decoy fallback does gauge', () => {
    const s = base();
    s.fallbacks!.dryer_3!.stretch!.do = { gauge: -1 };
    expect(reactionReport(s, characters).warnings.join('\n')).toContain('dryer_3.stretch');
  });

  it('warns when a decoy rule changes flags', () => {
    const s = base();
    s.rules.push({ id: 'decoy.dryer_stomp', target: 'dryer_3', verb: 'stomp', do: { set: { 'latch.open': true } } });
    expect(reactionReport(s, characters).warnings.join('\n')).toContain('decoy.dryer_stomp');
  });

  it('does not warn when a decoy rule only changes position', () => {
    const s = base();
    s.spots.perch = { x: 300, y: 200, free: true };
    s.rules.push({ id: 'decoy.dryer_stomp', target: 'dryer_3', verb: 'stomp', do: { move: [{ who: 'self', to: 'perch' }] } });
    const r = reactionReport(s, characters);
    expect(r.warnings.filter((w) => w.includes('decoy.dryer_stomp'))).toEqual([]);
  });
});
