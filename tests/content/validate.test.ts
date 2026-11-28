/* eslint-disable @typescript-eslint/no-explicit-any -- 화면 JSON을 일부러 망가뜨리는 테스트라 느슨한 타입을 쓴다 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WALK_AREA } from '../../src/core/config';
import { textFits, validateCharacters, validateScreen, validateTexts, type ValidationResult } from '../../src/core/puzzle/validate';

// 화면 1을 기준으로 한 군데씩 망가뜨려 그 검사만 걸리는지 본다.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const BASE = load('../../content/screens/magpie_nest.json') as Record<string, any>;
const texts = load('../../content/text/ja.json') as Record<string, string>;
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

  it('forbids character IDs and `self` as spot or hotspot IDs (#438)', () => {
    for (const id of ['jjuk', 'ppik', 'mukjik', 'self']) {
      const r = mutate((s) => (s.hotspots[id] = { box: [10, 100, 24, 24] }));
      expect(r.errors).toContainEqual(expect.objectContaining({ code: 'reserved', path: `hotspots.${id}` }));
    }
    const r = mutate((s) => (s.spots.mukjik = { x: 1, y: 1 }));
    expect(r.errors).toContainEqual(expect.objectContaining({ code: 'reserved', path: 'spots.mukjik' }));
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
    // box가 없는 자리도 본다(floor). 그런 자리는 걷기 영역 밖이라 `spot-area` 오류도 같이 난다(#944).
    const hud = mutate((s) => Object.assign(s.spots.floor, { x: 320, y: 20 }));
    expect(codes(hud)).toEqual(['spot-area']);
    expect(hud.warnings).toEqual([expect.objectContaining({ code: 'hud-overlap', path: 'spots.floor' })]);
    // 화면 끝 점은 화면 안이다(`point-offscreen` 아님). 상자 있는 자리면 오류 0.
    expect(mutate((s) => Object.assign(s.spots.seesaw_left, { x: 480, y: 270 })).errors).toEqual([]);
    expect(codes(mutate((s) => Object.assign(s.spots.floor, { x: 480, y: 270 })))).toEqual(['spot-area']);
  });

  it('releasePoint must be on screen and inside the walk area (#108, #173)', () => {
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [160, 300])))).toEqual(['point-offscreen']);
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [160, 150])))).toEqual(['release-point-area']);
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [8, 235])))).toEqual(['release-point-area']);
    // 경계(왼쪽 아래 모서리)는 안이다. 아래끝은 게이지 띠(#312) 때문에 252이고, 그 1px 아래는 밖이다.
    expect(mutate((s) => (s.spots.hook.releasePoint = [WALK_AREA.left, WALK_AREA.bottom])).errors).toEqual([]);
    expect(codes(mutate((s) => (s.spots.hook.releasePoint = [WALK_AREA.left, WALK_AREA.bottom + 1])))).toEqual(['release-point-area']);
  });

  it('walkArea shrinks the shared walk area per screen and floor points follow it (#938)', () => {
    expect(mutate((s) => (s.walkArea = { top: 210 })).errors).toEqual([]);
    expect(mutate((s) => (s.walkArea = { left: 20, top: 210, right: 460, bottom: 250 })).errors).toEqual([]);
    // 공통 영역을 넓히거나(위 199, 아래 253) 정수가 아니거나 비면 오류
    expect(paths(mutate((s) => (s.walkArea = { top: WALK_AREA.top - 1 })))).toEqual(['walkArea.top']);
    expect(paths(mutate((s) => (s.walkArea = { bottom: WALK_AREA.bottom + 1 })))).toEqual(['walkArea.bottom']);
    expect(codes(mutate((s) => (s.walkArea = { top: 236.5 })))).toEqual(['walk-area']);
    expect(codes(mutate((s) => (s.walkArea = { top: 240, bottom: 240 })))).toEqual(['walk-area']);
    expect(codes(mutate((s) => (s.walkArea = { tpo: 236 })))).toEqual(['unknown-key']);
    // releasePoint·board는 화면 영역으로 잰다: 고리 releasePoint(y 235)는 top 235까지 안, 236이면 밖. 시소 판(y 240)은 top 241이면 밖
    expect(BASE.spots.hook.releasePoint).toEqual([160, 235]);
    expect(mutate((s) => (s.walkArea = { top: 235 })).errors).toEqual([]);
    expect(paths(mutate((s) => (s.walkArea = { top: 236 })))).toEqual(['spots.hook.releasePoint']);
    expect(codes(mutate((s) => (s.walkArea = { top: 241 })))).toEqual(['board-area', 'board-area', 'release-point-area']);
  });

  it('boxless walk spots must stand inside the walk area; boxed and hold spots need not (#944)', () => {
    // 상자 없는 자리 = 발 점. 엔진이 clampToArea로 조용히 옮기니 영역 밖이면 그림의 자리와 서는 자리가 달라진다.
    expect(BASE.spots.floor.box).toBeUndefined();
    expect(mutate((s) => Object.assign(s.spots.floor, { x: WALK_AREA.left, y: WALK_AREA.top })).errors).toEqual([]);
    expect(mutate((s) => Object.assign(s.spots.floor, { x: WALK_AREA.right, y: WALK_AREA.bottom })).errors).toEqual([]);
    expect(paths(mutate((s) => (s.spots.floor.y = WALK_AREA.top - 1)))).toEqual(['spots.floor']);
    expect(codes(mutate((s) => (s.spots.floor.y = WALK_AREA.bottom + 1)))).toEqual(['spot-area']);
    expect(codes(mutate((s) => (s.spots.floor.x = WALK_AREA.left - 1)))).toEqual(['spot-area']);
    // 화면 walkArea를 따른다: 빨래방(top 244 = floor y)처럼 경계에 맞닿으면 안, 1px 넘으면 밖.
    //   이 화면은 시소 board(y 240)·고리 releasePoint(235)가 floor(244)보다 위라 top 대신 bottom으로 잰다.
    const y = BASE.spots.floor.y;
    expect(mutate((s) => (s.walkArea = { bottom: y })).errors).toEqual([]);
    expect(paths(mutate((s) => (s.walkArea = { bottom: y - 1 })))).toEqual(['spots.floor']);
    // free가 아닌 상자 없는 자리(park_fountain fountain_seat 같은 걷기 자리)도 본다.
    expect(codes(mutate((s) => (s.spots.seat = { x: 220, y: WALK_AREA.top - 2 })))).toEqual(['spot-area']);
    // 상자 있는 자리(물건 위, 시소)와 hold 자리(고리)는 발이 바닥이 아니라 안 본다.
    expect(BASE.spots.seesaw_left.box).toBeDefined();
    expect(mutate((s) => (s.spots.seesaw_left.y = 150)).errors).toEqual([]);
    expect(BASE.spots.hook.hold).toBe(true);
    expect(mutate((s) => delete s.spots.hook.box).errors).toEqual([]);
  });

  it('board is an on-floor [x, y] on walkable non-free spots only (#397)', () => {
    expect(BASE.spots.seesaw_left.board).toEqual([226, 240]);
    expect(BASE.spots.seesaw_right.board).toEqual([290, 240]);
    expect(paths(mutate((s) => (s.spots.seesaw_left.board = [226])))).toEqual(['spots.seesaw_left.board']);
    expect(paths(mutate((s) => (s.spots.seesaw_left.board = ['226', 240])))).toEqual(['spots.seesaw_left.board']);
    expect(paths(mutate((s) => (s.spots.floor.board = [226, 240])))).toEqual(['spots.floor.board']);
    expect(paths(mutate((s) => (s.spots.hook.board = [160, 235])))).toEqual(['spots.hook.board']);
    expect(codes(mutate((s) => (s.spots.seesaw_left.board = [226, 300])))).toEqual(['point-offscreen']);
    // 판 위(y 214)는 걷기 영역(top 200) 안이라 통과, 영역 위로 올라가면 오류.
    expect(codes(mutate((s) => (s.spots.seesaw_left.board = [226, WALK_AREA.top - 1])))).toEqual(['board-area']);
    expect(mutate((s) => (s.spots.seesaw_left.board = [WALK_AREA.right, WALK_AREA.bottom])).errors).toEqual([]);
    expect(codes(mutate((s) => (s.spots.seesaw_left.board = [WALK_AREA.right + 1, 240])))).toEqual(['board-area']);
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

  it('checks approach.from: known standing spots, dest per spot, no nested from (#688)', () => {
    const ok = mutate((s) => (s.hotspots.nest.approach = { default: 'floor', from: { seesaw_left: { stretch: 'stay' }, seesaw_right: 'stay' } }));
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { from: { roof: 'stay' } })))).toEqual(['ref-spot']);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { from: { seesaw_left: 'hook' } })))).toEqual(['approach-hold']);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { from: { seesaw_left: { jump: 'stay' } } })))).toEqual(['approach-verb']);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { from: { seesaw_left: { from: { floor: 'stay' } } } })))).toEqual(['approach-verb']);
    expect(codes(mutate((s) => (s.hotspots.nest.approach = { from: 'stay' } as never)))).toEqual(['schema']);
    // hold 자리에서 하는 행동은 손 놓기가 먼저라 approach까지 안 온다.
    const hold = mutate((s) => (s.hotspots.nest.approach = { from: { hook: 'stay' } }));
    expect(hold.errors).toEqual([]);
    expect(hold.warnings.map((x) => x.code)).toEqual(['approach-unused']);
  });

  it('checks variants flags and hintAbility on hotspots and spots', () => {
    expect(codes(mutate((s) => (s.hotspots.magpie.variants[0].when.flags = { 'magpie.gone': true })))).toEqual(['ref-flag']);
    expect(codes(mutate((s) => (s.hotspots.nest.hintAbility = 'hand')))).toEqual(['hint-ability']);
    expect(mutate((s) => (s.spots.hook.hintAbility = 'stomp')).errors).toEqual([]);
    expect(codes(mutate((s) => (s.spots.hook.hintAbility = 'look')))).toEqual(['hint-ability']);
  });

  it('variant name is an id with a <screen>.name.<name> text (#1031 state label)', () => {
    // 글이 있는 이름(둥지)을 빌려 쓰면 통과, 없는 글·ID 문법 위반은 오류.
    expect(mutate((s) => (s.hotspots.magpie.variants[0].name = 'nest')).errors).toEqual([]);
    const missing = mutate((s) => (s.hotspots.magpie.variants[0].name = 'magpie_ground'));
    expect(missing.errors).toEqual([expect.objectContaining({ code: 'ref-text', path: 'hotspots.magpie.variants[0].name' })]);
    expect(codes(mutate((s) => (s.hotspots.magpie.variants[0].name = 'Bad Name')))).toEqual(['id']);
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

  it('warns when a hotspot box or spot sits in the goal line zone (#349, 6-2-2)', () => {
    const box = mutate((s) => (s.hotspots.basket.box = [100, 30, 24, 24]));
    expect(box.errors).toEqual([]);
    expect(box.warnings).toEqual([expect.objectContaining({ code: 'goal-overlap', path: 'hotspots.basket.box' })]);
    // 맞닿기만 하면 겹침이 아니다(목표 줄 자리 오른쪽 끝 x 118, 아래 끝 y 38).
    expect(mutate((s) => (s.hotspots.basket.box = [118, 4, 24, 24])).warnings).toEqual([]);
    expect(mutate((s) => (s.hotspots.basket.box = [4, 38, 24, 24])).warnings).toEqual([]);
    // 자리 박스와 자리 좌표(box가 없는 floor)도 본다.
    const spotBox = mutate((s) => (s.spots.hook.box = [60, 10, 24, 24]));
    expect(spotBox.warnings).toEqual([expect.objectContaining({ code: 'goal-overlap', path: 'spots.hook.box' })]);
    const pt = mutate((s) => Object.assign(s.spots.floor, { x: 50, y: 20 }));
    expect(codes(pt)).toEqual(['spot-area']);
    expect(pt.warnings).toEqual([expect.objectContaining({ code: 'goal-overlap', path: 'spots.floor' })]);
    expect(mutate((s) => Object.assign(s.spots.floor, { x: 118, y: 20 })).warnings).toEqual([]);
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
    // say 화자는 핫스팟도 된다(관리인·손님처럼 사람이 아닌 화자, ADR-0065 5절 2026-11-19 개정, #380).
    expect(mutate((s) => (s.rules[0].show = [{ say: ['magpie', 'magpie_nest.enter'] }])).errors).toEqual([]);
    expect(mutate((s) => (s.onEnter = [{ say: ['magpie', 'magpie_nest.enter'] }])).errors).toEqual([]);
    // 서는 자리 ID(맨 이름)와 없는 ID는 화자가 아니다. 자리에 선 사람은 `@자리`로 쓴다.
    expect(codes(mutate((s) => (s.rules[0].show = [{ say: ['hook', 'magpie_nest.enter'] }])))).toEqual(['ref-actor']);
    expect(codes(mutate((s) => (s.rules[0].show = [{ say: ['crow', 'magpie_nest.enter'] }])))).toEqual(['ref-actor']);
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

  it('allows the effect position marker { do: "here" } only once, only in rule show with do (#206)', () => {
    // 화면 1 데이터는 11·13·14·15번에 표시가 이미 있다(#206). 검사는 표시를 뺀 13번에 다시 넣어 본다.
    const bump = (s: Record<string, any>): Record<string, any> => {
      const r = s.rules.find((x: any) => x.id === 'seesaw_launch_bump');
      r.show = r.show.filter((x: any) => !('do' in x));
      return r;
    };
    const ok = mutate((s) => bump(s).show.splice(2, 0, { do: 'here' }));
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);

    expect(codes(mutate((s) => bump(s).show.push({ do: 'here' }, { do: 'here' })))).toEqual(['do-here']);
    // 위치는 실제 데이터 길이에서 구한다(화면 데이터가 바뀌어도 깨지지 않게).
    const bumpIdx = BASE.rules.findIndex((r: any) => r.id === 'seesaw_launch_bump');
    const bumpLen = (BASE.rules[bumpIdx] as any).show.filter((x: any) => !('do' in x)).length;
    expect(paths(mutate((s) => bump(s).show.push({ do: 'there' })))).toEqual([`rules[${bumpIdx}].show[${bumpLen}].do`]);
    expect(codes(mutate((s) => s.rules.find((r: any) => !r.do && r.show).show.push({ do: 'here' })))).toEqual(['do-here']);
    // 규칙 show 밖(onEnter, 폴백 ①, takenShow, releaseShow)은 오류.
    expect(codes(mutate((s) => s.onEnter.push({ do: 'here' })))).toEqual(['do-here']);
    expect(codes(mutate((s) => s.fallbacks.nest.stomp.show.push({ do: 'here' })))).toEqual(['do-here']);
    expect(codes(mutate((s) => (s.spots.seesaw_left.takenShow = [{ do: 'here' }])))).toEqual(['do-here']);
    // set만 있는 do는 이벤트가 없어 표시가 아무것도 안 바꾼다: 경고.
    const noop = mutate((s) => s.rules.find((r: any) => r.do && Object.keys(r.do).join() === 'set').show.push({ do: 'here' }));
    expect(noop.errors).toEqual([]);
    expect(noop.warnings).toEqual([expect.objectContaining({ code: 'do-here-noop' })]);
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
    // 공통 실패 리액션은 화면을 몰라서 핫스팟 화자도 못 쓴다(#380).
    const fbHot = { jjuk: { look: { show: [{ say: ['magpie', t] }] } } };
    expect(validateCharacters({ fallbacks: fbHot, hints: full }, ctx).errors.map((e) => e.code)).toEqual(['ref-actor']);
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

describe('validateScreen: hands (ADR-1031 pick/put/holds/chain)', () => {
  // 화면 1 둥지를 들 물건으로 본다(검사 모양만 본다. 화면 1 자체는 안 바꾼다).
  const pick = { id: 'pick_nest', target: 'nest', verb: 'stretch', do: { pick: true } };
  const put = { id: 'put_nest', target: 'nest', verb: 'item', when: { item: 'nest' }, do: { put: true } };
  const withRules = (...rules: unknown[]): ValidationResult => mutate((s) => s.rules.push(...rules));

  // 재료로 써서 사라지는 둥지: present 플래그를 take 규칙이 끈다(ADR-1031, #1043 Kai·Luna).
  const gone = (s: Record<string, any>): void => {
    s.flags['nest.used'] = false;
    s.hotspots.nest.present = { flags: { 'nest.used': false } };
  };
  const useNest = {
    id: 'use_nest', target: 'magpie', verb: 'item', chain: 'use',
    when: { item: 'nest', holds: 'nest' }, do: { set: { 'nest.used': true }, take: ['nest'] },
  };

  it('accepts a pick + put pair and when.item / holds / take on the picked id', () => {
    const r = mutate((s) => {
      gone(s);
      s.rules.push(pick, put, useNest);
    });
    expect(r.errors).toEqual([]);
  });

  it('present: flags only, declared, at least one', () => {
    const withPresent = (present: unknown): string[] => codes(mutate((s) => (s.hotspots.nest.present = present)));
    expect(withPresent({ flags: { 'magpie.on_ground': true } })).toEqual([]);
    expect(withPresent({ flags: { 'nest.gone': false } })).toEqual(['ref-flag']);
    expect(withPresent({ flags: {} })).toEqual(['schema']);
    expect(withPresent({ flags: { 'magpie.on_ground': true }, at: ['floor'] })).toEqual(['unknown-key']);
    expect(withPresent(true)).toEqual(['schema']);
  });

  it('take of a held item must require holding it and switch its present off', () => {
    const take = (rule: Record<string, unknown>, setup = gone): string[] =>
      codes(mutate((s) => {
        setup(s);
        s.rules.push(pick, put, { ...useNest, ...rule });
      }));
    // Kai #1043: 든 것을 요구하지 않으면 바닥의 물건에 아무 일도 안 일어난다.
    expect(take({ verb: 'stomp', chain: undefined, when: undefined })).toEqual(['take-not-held']);
    expect(take({ when: { item: 'nest' } })).toEqual([]);
    // 같은 규칙 set이 present를 안 끄면 제자리에 다시 생긴다.
    expect(take({ do: { take: ['nest'] } })).toEqual(['take-leaves-item']);
    expect(take({ do: { set: { 'nest.used': false }, take: ['nest'] } })).toEqual(['take-leaves-item']);
    expect(take({ do: { take: ['nest'] } }, () => {})).toEqual(['take-leaves-item']);
  });

  it('pick must be the picker ability on a hotspot, without a chain tag', () => {
    expect(codes(withRules({ ...pick, verb: 'stomp' }))).toEqual(['pick-verb']);
    expect(codes(withRules({ ...pick, target: 'seesaw_left' }))).toEqual(['pick-target']);
    expect(codes(withRules({ ...pick, chain: 'change' }))).toEqual(['chain-hands']);
    expect(codes(withRules({ ...pick, when: { who: ['mukjik'] } }))).toEqual(['pick-who']);
    expect(codes(withRules({ ...pick, do: { pick: 1 } }))).toContain('schema');
  });

  it('put needs verb item on an item that has a pick rule', () => {
    expect(codes(withRules(put))).toEqual(expect.arrayContaining(['put-target']));
    expect(codes(withRules(pick, { ...put, verb: 'stretch', when: undefined }))).toEqual(['put-verb']);
    expect(codes(withRules(pick, { ...put, when: { item: 'item.shop_key' } }))).toEqual(['put-verb']);
  });

  it('chain tag is one of change/combine/use', () => {
    const r = mutate((s) => (s.rules[0].chain = 'merge'));
    expect(r.errors).toEqual([expect.objectContaining({ code: 'schema', path: 'rules[0].chain' })]);
  });

  it('holds must name a pickable item, and picked ids must not collide with party items', () => {
    expect(codes(withRules({ ...pick, id: 'x', target: 'magpie', when: { holds: 'nest' } }))).toEqual(['ref-item']);
    const r = mutate((s) => {
      s.hotspots['item.shop_key'] = { box: [0, 0, 24, 24] };
      s.rules.push({ id: 'pick_key', target: 'item.shop_key', verb: 'stretch', do: { pick: true } });
    });
    expect(codes(r)).toContain('hands-item-overlap');
  });
});
