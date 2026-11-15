/* eslint-disable @typescript-eslint/no-explicit-any -- 화면 JSON을 일부러 망가뜨리는 테스트라 느슨한 타입을 쓴다 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { textFits, validateCharacters, validateScreen, validateTexts, type ValidationResult } from '../../src/core/puzzle/validate';

// 화면 1을 기준으로 한 군데씩 망가뜨려 그 검사만 걸리는지 본다.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const BASE = load('../../content/screens/magpie_nest.json') as Record<string, any>;
const texts = load('../../content/text/ko.json') as Record<string, string>;
const ctx = { texts };

function mutate(fn: (s: Record<string, any>) => void): ValidationResult {
  const s = structuredClone(BASE);
  fn(s);
  return validateScreen(s, ctx);
}
const codes = (r: ValidationResult): string[] => r.errors.map((e) => e.code);
const paths = (r: ValidationResult): string[] => r.errors.map((e) => e.path);

describe('validateScreen', () => {
  it('accepts screen 1 as is (no errors, no warnings)', () => {
    const r = validateScreen(BASE, ctx);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('rejects non-objects and missing required fields', () => {
    expect(codes(validateScreen(null, ctx))).toEqual(['schema']);
    const r = mutate((s) => delete s.exitFlag);
    expect(paths(r)).toContain('exitFlag');
  });

  it('flags unknown keys so typos do not silently fall back to defaults', () => {
    const r = mutate((s) => {
      s.hotspots.nest.aproach = 'floor';
    });
    expect(r.errors).toEqual([expect.objectContaining({ code: 'unknown-key', path: 'hotspots.nest.aproach' })]);
  });

  it('enforces I1 ID grammar on keys and values', () => {
    const r = mutate((s) => {
      s.flags['Magpie.Up'] = false;
      s.rules[0].id = 'bad-id';
    });
    expect(paths(r)).toEqual(expect.arrayContaining(['flags.Magpie.Up', 'rules[0].id']));
    expect(codes(r).every((c) => c === 'id')).toBe(true);
  });

  it('requires a free floor spot and forbids `stay` as a spot ID', () => {
    expect(codes(mutate((s) => delete s.spots.floor.free))).toContain('floor');
    expect(codes(mutate((s) => (s.spots.stay = { x: 1, y: 1 })))).toContain('reserved');
  });

  it('forbids the same ID in spots and hotspots', () => {
    const r = mutate((s) => (s.hotspots.hook = { box: [10, 100, 24, 24] }));
    expect(r.errors).toContainEqual(expect.objectContaining({ code: 'dup-id', path: 'hotspots.hook' }));
  });

  it('hold spots need releaseTo pointing at a free spot', () => {
    expect(codes(mutate((s) => delete s.spots.hook.releaseTo))).toContain('hold-release');
    expect(codes(mutate((s) => (s.spots.hook.releaseTo = 'seesaw_left')))).toContain('hold-release');
    expect(codes(mutate((s) => (s.spots.hook.releaseTo = 'nowhere')))).toContain('ref-spot');
    expect(paths(mutate((s) => (s.spots.seesaw_left.releaseTo = 'floor')))).toContain('spots.seesaw_left.releaseTo');
  });

  it('checks approach targets, map verbs, and refuses walking into hold spots', () => {
    expect(codes(mutate((s) => (s.hotspots.nest.approach = 'hook')))).toEqual(['approach-hold']);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { default: 'stay', jump: 'floor' })))).toEqual(['approach-verb']);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { squeak: 'roof' })))).toEqual(['ref-spot']);
    const w = mutate((s) => (s.hotspots.nest.approach = { look: 'floor' }));
    expect(w.errors).toEqual([]);
    expect(w.warnings.map((x) => x.code)).toEqual(['approach-unused']);
  });

  it('checks variants flags and hintAbility on hotspots and spots', () => {
    expect(codes(mutate((s) => (s.hotspots.magpie.variants[0].when.flags = { 'magpie.gone': true })))).toEqual(['ref-flag']);
    expect(codes(mutate((s) => (s.hotspots.nest.hintAbility = 'hand')))).toEqual(['hint-ability']);
    expect(mutate((s) => (s.spots.hook.hintAbility = 'stomp')).errors).toEqual([]);
    expect(codes(mutate((s) => (s.spots.hook.hintAbility = 'look')))).toEqual(['hint-ability']);
  });

  it('checks box size, screen bounds, and warns on HUD overlap', () => {
    expect(codes(mutate((s) => (s.hotspots.basket.box = [144, 212, 20, 24])))).toEqual(['box-small']);
    expect(codes(mutate((s) => (s.hotspots.basket.box = [470, 212, 24, 24])))).toEqual(['box-offscreen']);
    const hud = mutate((s) => (s.hotspots.basket.box = [320, 20, 24, 24]));
    expect(hud.errors).toEqual([]);
    expect(hud.warnings).toEqual([expect.objectContaining({ code: 'hud-overlap', path: 'hotspots.basket.box' })]);
    // 맞닿기만 하면 겹침이 아니다(HUD 왼쪽 끝 x 300).
    expect(mutate((s) => (s.hotspots.basket.box = [276, 20, 24, 24])).warnings).toEqual([]);
  });

  it('checks rule references: target, verb, when, do', () => {
    expect(codes(mutate((s) => (s.rules[0].target = 'moon')))).toEqual(['ref-target']);
    expect(codes(mutate((s) => (s.rules[0].verb = 'kick')))).toEqual(['schema']);
    expect(codes(mutate((s) => (s.rules[0].verb = 'move')))).toEqual(['move-target']);
    expect(codes(mutate((s) => (s.rules[0].when = { at: ['roof'] })))).toEqual(['ref-spot']);
    expect(codes(mutate((s) => (s.rules[0].when = { who: ['goblin'] })))).toEqual(['ref-char']);
    expect(codes(mutate((s) => (s.rules[0].when = { occupied: { roof: true } })))).toEqual(['ref-spot']);
    expect(codes(mutate((s) => (s.rules[0].when = { has: ['item.ghost'] })))).toEqual(['ref-item']);
    expect(codes(mutate((s) => (s.rules[0].do = { set: { 'nest.gone': true } })))).toEqual(['ref-flag']);
    expect(codes(mutate((s) => (s.rules[0].do = { move: [{ who: 'self', from: 'floor', to: 'floor' }] })))).toEqual(['schema']);
    expect(codes(mutate((s) => (s.rules[0].do = { move: [{ from: 'hook', to: 'roof' }] })))).toEqual(['ref-spot']);
    expect(codes(mutate((s) => (s.rules[0].do = { gauge: -0.5 })))).toEqual(['schema']);
    expect(codes(mutate((s) => (s.rules[1].id = s.rules[0].id)))).toEqual(['dup-id']);
  });

  it('knows items only from start.items and give', () => {
    const r = mutate((s) => (s.rules[0].when = { has: ['item.shop_key'] }));
    expect(r.errors).toEqual([]);
    expect(codes(mutate((s) => (s.rules[0].do = { take: ['item.spoon'] })))).toEqual(['ref-item']);
  });

  it('checks show: speakers, @spot, self scope, text IDs and bubble size', () => {
    expect(codes(mutate((s) => (s.rules[0].show = [{ say: ['@roof', 'magpie_nest.enter'] }])))).toEqual(['ref-spot']);
    expect(codes(mutate((s) => (s.rules[0].show = [{ say: ['magpie', 'magpie_nest.enter'] }])))).toEqual(['ref-actor']);
    // anim·fx는 핫스팟도 대상이 된다.
    expect(mutate((s) => (s.rules[0].show = [{ anim: ['magpie', 'fly_down'] }, { fx: ['stars', 'nest'] }])).errors).toEqual([]);
    expect(codes(mutate((s) => (s.rules[0].show = [{ say: ['self', 'magpie_nest.nope'] }])))).toEqual(['ref-text']);
    expect(codes(mutate((s) => (s.onEnter = [{ say: ['self', 'magpie_nest.enter'] }])))).toEqual(['ref-self']);
    expect(codes(mutate((s) => (s.rules[0].show = [{ say: ['self', 'magpie_nest.enter'], anim: ['self', 'x'] }])))).toEqual(['schema']);
    const long = validateScreen({ ...structuredClone(BASE), onEnter: [{ say: ['ppik', 'x.long'] }] }, { texts: { ...texts, 'x.long': '가'.repeat(15) } });
    expect(codes(long)).toEqual(['text-long']);
  });

  it('fallbacks may only change the gauge', () => {
    expect(codes(mutate((s) => (s.fallbacks.nest.stretch = { do: { set: { 'nest.key_taken': true } } })))).toEqual(['unknown-key']);
    expect(codes(mutate((s) => (s.fallbacks.moon = { look: {} })))).toEqual(['ref-target']);
  });

  it('checks start positions, capacity, and exitFlag', () => {
    expect(codes(mutate((s) => (s.start.at.jjuk = 'hook')))).toEqual(['start-hold']);
    expect(codes(mutate((s) => (s.start.at = { jjuk: 'seesaw_left', mukjik: 'seesaw_left', ppik: 'floor' })))).toEqual(['capacity']);
    expect(codes(mutate((s) => delete s.start.at.ppik))).toEqual(['schema']);
    expect(codes(mutate((s) => (s.exitFlag = 'door.open')))).toEqual(['ref-flag']);
    expect(codes(mutate((s) => (s.flags[s.exitFlag] = true)))).toEqual(['exit-initial']);
  });

  it('checks solution actions shape, refs, and ability ownership', () => {
    expect(codes(mutate((s) => (s.solution[0].verb = 'stomp')))).toEqual(['ability']);
    expect(codes(mutate((s) => (s.solution[0].target = 'moon')))).toEqual(['ref-target']);
    expect(codes(mutate((s) => (s.solution[0].item = 'item.shop_key')))).toEqual(['schema']);
  });
});

describe('validateTexts / validateCharacters / textFits', () => {
  it('textFits counts code points per line, max 2 lines', () => {
    expect(textFits('가'.repeat(14))).toBe(true);
    expect(textFits('가'.repeat(15))).toBe(false);
    expect(textFits('a\nb')).toBe(true);
    expect(textFits('a\nb\nc')).toBe(false);
  });

  it('texts: ID keys, string values', () => {
    expect(validateTexts({ 'a.b': 'x' }).errors).toEqual([]);
    expect(validateTexts({ 'A.b': 'x', 'a.c': 1 }).errors.map((e) => e.path)).toEqual(['texts.A.b', 'texts.a.c']);
  });

  it('characters: hints need ability keys and existing text', () => {
    expect(validateCharacters({ hints: { jjuk: { squeak: 'magpie_nest.enter' } } }, ctx).errors).toEqual([]);
    const r = validateCharacters({ hints: { goblin: { look: 'nope.text' } } }, ctx);
    expect(r.errors.map((e) => e.code)).toEqual(['ref-char', 'schema', 'ref-text']);
    expect(validateCharacters({ fallbacks: { jjuk: { look: { show: [{ say: ['@hook', 'magpie_nest.enter'] }] } } } }, ctx).errors.map((e) => e.code)).toEqual(['ref-spot']);
  });
});
