import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reactionReport } from './difficulty';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';

// #67 / PR #822 review (Theo): pin the reactionReport warnings on a toy screen derived from laundromat.
// Since stage 3 B (#909) dryer_3 has rules, so the decoy here is soap_vending (the only toy left).
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const load = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const characters = load<CharactersData>(dir('../../content/characters.json'));
const base = (): ScreenData => load<ScreenData>(dir('../../content/screens/laundromat.json'));

describe('reactionReport', () => {
  it('counts decoy actions taken at on-path states (laundromat has only on-path states)', () => {
    const r = reactionReport(base(), characters);
    expect(r.wrong.states).toBe(5);
    expect(r.wrong.reactions).toBeGreaterThan(0);
  });

  it('warns when a decoy fallback does gauge', () => {
    const s = base();
    s.fallbacks!.soap_vending!.stretch!.do = { gauge: -1 };
    expect(reactionReport(s, characters).warnings.join('\n')).toContain('soap_vending.stretch');
  });

  it('warns when a decoy rule changes flags', () => {
    const s = base();
    s.rules.push({ id: 'decoy.soap_stomp', target: 'soap_vending', verb: 'stomp', do: { set: { 'dryer.reverse': true } } });
    expect(reactionReport(s, characters).warnings.join('\n')).toContain('decoy.soap_stomp');
  });

  it('does not warn when a decoy rule only changes position', () => {
    const s = base();
    s.spots.perch = { x: 300, y: 200, free: true };
    s.rules.push({ id: 'decoy.soap_stomp', target: 'soap_vending', verb: 'stomp', do: { move: [{ who: 'self', to: 'perch' }] } });
    const r = reactionReport(s, characters);
    expect(r.warnings.filter((w) => w.includes('decoy.soap_stomp'))).toEqual([]);
  });
});
