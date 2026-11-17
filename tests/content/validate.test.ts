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
    // 쓸 수 있는 필드를 같이 알려 준다(#108).
    expect(r.errors[0]!.message).toContain('approach');
    expect(r.errors[0]!.message).toContain('note');
  });

  it('rejects `when.gauge`: the gauge is not a rule condition (#67, ADR-0096)', () => {
    const r = mutate((s) => {
      s.rules[0].when = { ...(s.rules[0].when ?? {}), gauge: 1 };
    });
    expect(r.errors).toEqual([expect.objectContaining({ code: 'unknown-key', path: 'rules[0].when.gauge' })]);
  });

  it('enforces I1 ID grammar on keys and values', () => {
    const r = mutate((s) => {
      s.flags['Magpie.Up'] = false;
      s.rules[0].id = 'bad-id';
    });
    expect(paths(r)).toEqual(expect.arrayContaining(['flags["Magpie.Up"]', 'rules[0].id']));
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

  it('releasePoint is [x, y] on hold spots only; move.via names a hold spot with a releasePoint and the same releaseTo (#157)', () => {
    expect(paths(mutate((s) => (s.spots.hook.releasePoint = [160])))).toEqual(['spots.hook.releasePoint']);
    expect(paths(mutate((s) => (s.spots.seesaw_left.releasePoint = [220, 214])))).toEqual(['spots.seesaw_left.releasePoint']);
    const bump = BASE.rules.findIndex((r: any) => r.id === 'seesaw_launch_bump');
    const via = (fn: (m: any, s: Record<string, any>) => void): ValidationResult =>
      mutate((s) => fn(s.rules[bump].do.move.find((m: any) => m.via !== undefined), s));
    expect(codes(via((m) => (m.via = 'seesaw_right')))).toEqual(['move-via']);
    expect(codes(via((m) => (m.via = 'nowhere')))).toEqual(['ref-spot']);
    expect(codes(via((_m, s) => delete s.spots.hook.releasePoint))).toEqual(['move-via']);
    expect(codes(via((m) => (m.to = 'seesaw_right')))).toEqual(['move-via']);
  });

  it('writes dotted ID keys in brackets in paths (#108)', () => {
    expect(paths(mutate((s) => (s.rules[0].do = { set: { 'magpie.dwn': true } })))).toEqual(['rules[0].do.set["magpie.dwn"]']);
    expect(paths(mutate((s) => (s.rules[0].when = { occupied: { roof: true } })))).toEqual(['rules[0].when.occupied.roof']);
  });

  it('checks spot coordinates: off screen fails, inside the HUD warns (#108)', () => {
    expect(codes(mutate((s) => (s.spots.seesaw_left.x = 481)))).toEqual(['point-offscreen']);
    expect(codes(mutate((s) => (s.spots.floor.y = -1)))).toEqual(['point-offscreen']);
    // box가 없는 자리도 본다(floor).
    const hud = mutate((s) => Object.assign(s.spots.floor, { x: 320, y: 20 }));
    expect(hud.errors).toEqual([]);
    expect(hud.warnings).toEqual([expect.objectContaining({ code: 'hud-overlap', path: 'spots.floor' })]);
    // 화면 끝 점은 화면 안이다.
    expect(mutate((s) => Object.assign(s.spots.floor, { x: 480, y: 270 })).errors).toEqual([]);
  });

  it('releasePoint must be on screen and inside the walk area (#108, #173)', () => {
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [160, 300])))).toEqual(['point-offscreen']);
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [160, 150])))).toEqual(['release-point-area']);
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [8, 235])))).toEqual(['release-point-area']);
    expect(mutate((s) => (s.spots.hook.releasePoint = [16, 258])).errors).toEqual([]);
  });

  it('forbids move rules on hold spots: the UI never makes that action (#108, #115)', () => {
    const r = mutate((s) => s.rules.push({ id: 'hook_walk', target: 'hook', verb: 'move' }));
    expect(r.errors).toEqual([expect.objectContaining({ code: 'move-hold', path: `rules[${BASE.rules.length}].target` })]);
  });

  it('warns when no rule of that ability targets or moves into the hinted target (#108, #229)', () => {
    // 화면에 squeak 규칙(까치)이 있어도 nest·hook으로 이어지지 않으면 경고다(#226 규칙이 놓치던 빈틈).
    const nest = mutate((s) => (s.hotspots.nest.hintAbility = 'squeak'));
    expect(nest.warnings).toEqual([expect.objectContaining({ code: 'hint-ability-unused', path: 'hotspots.nest.hintAbility' })]);
    const hook = mutate((s) => (s.spots.hook.hintAbility = 'squeak'));
    expect(hook.warnings).toEqual([expect.objectContaining({ code: 'hint-ability-unused', path: 'spots.hook.hintAbility' })]);
    // ②: hook의 stomp 힌트는 시소 규칙이 hook으로 보내서 통과한다. 그 move를 지우면 경고.
    const noLaunch = mutate((s) => {
      for (const r of s.rules) if (r.verb === 'stomp' && r.do?.move) r.do.move = r.do.move.filter((m: any) => m.to !== 'hook' && m.via !== 'hook');
    });
    expect(noLaunch.warnings.map((w) => w.path)).toContain('spots.hook.hintAbility');
    // via로 보내도 통과한다: to를 지우고 via만 남은 move가 하나라도 있으면 된다.
    const viaOnly = mutate((s) => {
      for (const r of s.rules) if (r.verb === 'stomp' && r.do?.move) r.do.move = r.do.move.filter((m: any) => m.to !== 'hook');
    });
    expect(viaOnly.warnings.map((w) => w.path)).not.toContain('spots.hook.hintAbility');
    const r = mutate((s) => {
      s.rules = s.rules.filter((x: any) => x.verb !== 'squeak');
      s.solution = s.solution.filter((a: any) => a.verb !== 'squeak');
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([expect.objectContaining({ code: 'hint-ability-unused', path: 'hotspots.magpie.hintAbility' })]);
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
    // say[1]이 문자열이 아니면 ID 문법 위반이 아니라 "텍스트 ID여야 한다"로 안내한다(#108).
    const num = mutate((s) => (s.rules[0].show = [{ say: ['self', 3] }]));
    expect(num.errors).toEqual([expect.objectContaining({ code: 'schema', path: 'rules[0].show[0].say[1]' })]);
    expect(num.errors[0]!.message).toContain('텍스트 ID');
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
    expect(validateTexts({ 'A.b': 'x', 'a.c': 1 }).errors.map((e) => e.path)).toEqual(['texts["A.b"]', 'texts["a.c"]']);
  });

  it('characters: hints need ability keys and existing text', () => {
    const t = 'magpie_nest.enter';
    const full = { jjuk: { squeak: t, stomp: t }, mukjik: { stretch: t, squeak: t }, ppik: { stretch: t, stomp: t } };
    expect(validateCharacters({ hints: full }, ctx).errors).toEqual([]);
    const r = validateCharacters({ hints: { ...full, goblin: { look: 'nope.text' } } }, ctx);
    expect(r.errors.map((e) => e.code)).toEqual(['ref-char', 'schema', 'ref-text']);
    const fb = { jjuk: { look: { show: [{ say: ['@hook', t] }] } } };
    expect(validateCharacters({ fallbacks: fb, hints: full }, ctx).errors.map((e) => e.code)).toEqual(['ref-spot']);
  });

  it('characters: every character needs hints for both other abilities; own ability warns (#108)', () => {
    const t = 'magpie_nest.enter';
    const r = validateCharacters({ hints: { jjuk: { squeak: t, stretch: t }, mukjik: { stretch: t, squeak: t } } }, ctx);
    expect(r.errors.map((e) => `${e.code} ${e.path}`)).toEqual(['hint-missing hints.jjuk.stomp', 'hint-missing hints.ppik.stretch', 'hint-missing hints.ppik.stomp']);
    expect(r.warnings.map((e) => `${e.code} ${e.path}`)).toEqual(['hint-own-ability hints.jjuk.stretch']);
    // hints가 통째로 없으면 6개 다 빠진 것이다.
    expect(validateCharacters({}, ctx).errors.map((e) => e.code)).toEqual(Array(6).fill('hint-missing'));
  });
});
