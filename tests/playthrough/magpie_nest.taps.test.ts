import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { characterDef, characterFaceBox, characterHitBox, CHARACTERS, type CharacterId } from '../../src/core/characters';
import type { HitBox } from '../../src/core/hit';
import { createFirstNotes, noteAction, noteStood, standSelect } from '../../src/core/firstNotes';
import { CHAR_SLOTS } from '../../src/core/hud';
import { actionKey, resolveTap, tap, type TapContext, type UiState } from '../../src/core/interact';
import { initialState, step } from '../../src/core/puzzle/step';
import type { Action, PuzzleState, ScreenData } from '../../src/core/puzzle/types';
import type { Point } from '../../src/core/viewport';

// 화면 1 정답을 "실제 탭"으로 재생한다(docs/design/ui-interaction.md 6-4-7절, 재생 도구 #101 입력 계약).
// 행동마다: (1) 캐릭터가 다르면 얼굴 칸 (2) 기본 동사가 다르면 대상(빈 서는 자리)에 먼저 올라선다 (3) 대상 박스 가운데를 탭(터치는 2번).
// 동사 버튼은 없다(#311).
// 탭이 만든 행동이 solution 행동과 같아야 하고, 그걸 step에 넣으면 클리어해야 한다.

const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const FLOOR_AT: Record<CharacterId, Point> = { jjuk: { x: 360, y: 244 }, mukjik: { x: 400, y: 244 }, ppik: { x: 440, y: 244 } };

function ctxFor(puzzle: PuzzleState): TapContext {
  const bodies = {} as Record<CharacterId, HitBox>;
  const faces = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const spot = screen.spots[puzzle.at[c.id]];
    const at = spot && !spot.free ? { x: spot.x, y: spot.y } : FLOOR_AT[c.id];
    bodies[c.id] = characterHitBox(characterDef(c.id), at.x, at.y, 1);
    faces[c.id] = characterFaceBox(characterDef(c.id), at.x, at.y, 1);
  }
  return { screen, puzzle, bodies, faces };
}

const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

function targetPoint(ctx: TapContext, target: string): Point {
  const spot = screen.spots[target];
  if (spot?.box) return center({ left: spot.box[0], top: spot.box[1], width: spot.box[2], height: spot.box[3] });
  const hs = screen.hotspots[target];
  if (!hs) throw new Error(`대상 없음: ${target}`);
  const v = hs.variants?.find((x) => Object.entries(x.when.flags).every(([k, val]) => ctx.puzzle.flags[k] === val));
  const [l, t, w, h] = v?.box ?? hs.box;
  return center({ left: l, top: t, width: w, height: h });
}

function replay(touch: boolean): { taps: string[]; final: PuzzleState } {
  const slop = touch ? 8 : 0;
  let puzzle = initialState(screen);
  let ui: UiState = { active: 'jjuk', selected: null };
  const taps: string[] = [];
  // main.ts와 같은 순서로 올라선 뒤를 흉내 낸다: 실행한 행동을 적고(noteAction), busy가 풀리면(step 뒤) noteStood → 터치면 standSelect(6-4-1a-1절, #710).
  const notes = createFirstNotes(puzzle.gauge, ui.active);
  const press = (p: Point, what: string): ReturnType<typeof tap>['intent'] => {
    const r = tap(ctxFor(puzzle), ui, p, slop, touch);
    ui = r.ui;
    taps.push(what);
    return r.intent;
  };

  /** 대상을 눌러 행동 하나를 실행한다(터치는 선택 + 실행. 이미 골라져 있으면 실행만). */
  const run = (p: Point, target: string, expected: Action): void => {
    let intent = press(p, target);
    if (touch && intent.kind === 'select') intent = press(p, target);
    expect(intent).toMatchObject({ kind: 'act', action: expected });
    if (intent.kind !== 'act') throw new Error('unreachable');
    noteAction(notes, intent.action, puzzle.at[intent.action.char]!, touch);
    puzzle = step(screen, puzzle, intent.action).state;
    const stood = noteStood(notes, ui.active, 0, () => null);
    const sel = stood && ui.selected === null ? standSelect({ screen, puzzle }, screen.rules, stood.char, stood.spot) : null;
    if (sel) ui = { ...ui, selected: sel.key };
  };

  for (const a of screen.solution ?? []) {
    if (ui.active !== a.char) press(center(CHAR_SLOTS[a.char]), `칸:${a.char}`);
    const p = targetPoint(ctxFor(puzzle), a.target);
    const dflt = resolveTap(ctxFor(puzzle), ui, p, slop);
    if (dflt.kind !== 'act' || dflt.key !== actionKey(a)) {
      // 기본 탭이 다르면 올라서기(move)뿐이다. 올라선 뒤 같은 자리를 다시 누르면 자기 능력(6-4-1절).
      expect(dflt).toMatchObject({ kind: 'act', action: { char: a.char, verb: 'move', target: a.target } });
      expect(a.verb).toBe(characterDef(a.char).ability);
      run(p, a.target, { char: a.char, verb: 'move', target: a.target });
    }
    run(p, a.target, a);
  }
  return { taps, final: puzzle };
}

describe('magpie_nest solution by taps (ui-interaction.md 6-4-1·6-4-7절)', () => {
  it('데스크톱: 얼굴 칸 + 대상 클릭만으로 정답 4행동이 나오고 클리어한다. 3번은 올라선 뒤 한 번 더', () => {
    const { taps, final } = replay(false);
    expect(taps).toEqual([
      '칸:ppik', 'magpie',
      '칸:jjuk', 'seesaw_left',
      '칸:mukjik', 'seesaw_right', 'seesaw_right',
      '칸:jjuk', 'nest',
    ]);
    expect(final.flags[screen.exitFlag]).toBe(true);
  });

  it('터치: step 행동만 탭 2번. 3번은 탭 3번(선택·올라섬·쿵, 올라선 순간 쿵이 골라져 있다, 6-4-1a-1절 #710)', () => {
    const { taps, final } = replay(true);
    expect(taps.filter((t) => !t.includes(':'))).toEqual([
      'magpie', 'magpie', 'seesaw_left', 'seesaw_left', 'seesaw_right', 'seesaw_right', 'seesaw_right', 'nest', 'nest',
    ]);
    expect(final.flags[screen.exitFlag]).toBe(true);
  });
});
