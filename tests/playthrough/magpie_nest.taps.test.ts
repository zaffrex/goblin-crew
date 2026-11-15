import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { characterDef, characterHitBox, CHARACTERS, type CharacterId } from '../../src/core/characters';
import type { HitBox } from '../../src/core/hit';
import { CHAR_SLOTS, VERB_SLOTS, type VerbButton } from '../../src/core/hud';
import { actionKey, resolveTap, tap, type TapContext, type UiState } from '../../src/core/interact';
import { initialState, step } from '../../src/core/puzzle/step';
import type { Action, PuzzleState, ScreenData } from '../../src/core/puzzle/types';
import type { Point } from '../../src/core/viewport';

// 화면 1 정답을 "실제 탭"으로 재생한다(docs/design/ui-interaction.md 10절, 재생 도구 #101 입력 계약).
// 행동마다: (1) 캐릭터가 다르면 HUD 칸 (2) 기본 동사가 다르면 동사 버튼 (3) 대상 박스 가운데를 탭(터치는 2번).
// 탭이 만든 행동이 solution 행동과 같아야 하고, 그걸 step에 넣으면 클리어해야 한다.

const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const FLOOR_AT: Record<CharacterId, Point> = { jjuk: { x: 360, y: 244 }, mukjik: { x: 400, y: 244 }, ppik: { x: 440, y: 244 } };

function ctxFor(puzzle: PuzzleState): TapContext {
  const bodies = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const spot = screen.spots[puzzle.at[c.id]];
    const at = spot && !spot.free ? { x: spot.x, y: spot.y } : FLOOR_AT[c.id];
    bodies[c.id] = characterHitBox(characterDef(c.id), at.x, at.y, 1);
  }
  return { screen, puzzle, bodies };
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

function buttonFor(a: Action): VerbButton {
  if (a.verb === 'hand' || a.verb === 'look') return a.verb;
  if (a.verb === characterDef(a.char).ability) return 'ability';
  throw new Error(`버튼으로 고를 수 없는 동사: ${a.verb}`);
}

function replay(touch: boolean): { taps: string[]; final: PuzzleState } {
  const slop = touch ? 8 : 0;
  let puzzle = initialState(screen);
  let ui: UiState = { active: 'jjuk', armed: null, selected: null };
  const taps: string[] = [];
  const press = (p: Point, what: string): ReturnType<typeof tap>['intent'] => {
    const r = tap(ctxFor(puzzle), ui, p, slop, touch);
    ui = r.ui;
    taps.push(what);
    return r.intent;
  };

  for (const a of screen.solution ?? []) {
    if (ui.active !== a.char) press(center(CHAR_SLOTS[a.char]), `칸:${a.char}`);
    const p = targetPoint(ctxFor(puzzle), a.target);
    const dflt = resolveTap(ctxFor(puzzle), ui, p, slop);
    if (dflt.kind !== 'act' || dflt.key !== actionKey(a)) press(center(VERB_SLOTS[buttonFor(a)]), `버튼:${buttonFor(a)}`);
    let intent = press(p, a.target);
    if (touch) {
      expect(intent.kind).toBe('select');
      intent = press(p, a.target);
    }
    expect(intent).toMatchObject({ kind: 'act', action: a });
    if (intent.kind !== 'act') throw new Error('unreachable');
    puzzle = step(screen, puzzle, intent.action).state;
  }
  return { taps, final: puzzle };
}

describe('magpie_nest solution by taps (ui-interaction.md 10절)', () => {
  it('데스크톱: 정답 4행동이 클릭으로 그대로 나오고 클리어한다. 무장은 3번(묵직이 쿵)만', () => {
    const { taps, final } = replay(false);
    expect(taps).toEqual([
      '칸:ppik', 'magpie',
      '칸:jjuk', 'seesaw_left',
      '칸:mukjik', '버튼:ability', 'seesaw_right',
      '칸:jjuk', 'nest',
    ]);
    expect(final.flags[screen.exitFlag]).toBe(true);
  });

  it('터치: step 행동만 탭 2번', () => {
    const { taps, final } = replay(true);
    expect(taps.filter((t) => !t.includes(':'))).toEqual([
      'magpie', 'magpie', 'seesaw_left', 'seesaw_left', 'seesaw_right', 'seesaw_right', 'nest', 'nest',
    ]);
    expect(final.flags[screen.exitFlag]).toBe(true);
  });
});
