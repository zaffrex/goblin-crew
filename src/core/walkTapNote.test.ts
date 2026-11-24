// 걷기 영역 밖 터치 탭 → `あるく` 0.6초(`ui-interaction.md` 5-2-6절, #601 모바일 2회, Luna 스펙).
// main.ts `worldTap` 순서를 그대로 흉내 낸다: noteTap → sceneTap → (터치·바닥 걷기면) noteWalkTap → 걷기 시작(noteWalkStart).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import fountainJson from '../../content/screens/park_fountain.json';
import texts from '../../content/text/ja.json';
import { WALK_AREA } from './config';
import { createFirstNotes, currentNote, noteTap, noteWalkStart, noteWalkTap, WALK_NOTE_MIN, WALK_TAP_NOTE_TICKS, type FirstNotes } from './firstNotes';
import type { CharactersData, ScreenData } from './puzzle/types';
import { createScene, isBusy, sceneTap, sceneTick, takeWalkStart, type SceneData, type SceneState } from './scene';
import type { Point } from './viewport';

const data: SceneData = { screen: fountainJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const TEXT: Record<string, string> = texts;
const WALK = TEXT['ui.verb.walk']!;
const SKIP = TEXT['ui.hud.walk_skip']!;
/** 터치 slop(내부 px). main.ts 터치 탭과 같은 쪽(0보다 크면 터치). */
const TOUCH = 6;

function ready(): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
  takeWalkStart(s);
  return s;
}

/** main.ts `worldTap`의 안내 부분. 돌려준 값은 sceneTap 결과 종류(+ 걷기면 intent 종류). */
function tap(s: SceneState, n: FirstNotes, p: Point, slop: number): string {
  noteTap(n);
  const r = sceneTap(data, s, p, slop, slop > 0);
  if (slop > 0 && r.kind === 'intent' && r.intent.kind === 'walk') noteWalkTap(n, p, WALK_AREA, WALK, s.tick);
  const ws = takeWalkStart(s);
  if (ws) noteWalkStart(n, ws.char, ws.dist, SKIP);
  return r.kind === 'intent' ? `intent:${r.intent.kind}` : r.kind;
}

describe('걷기 영역 밖 터치 탭 → あるく (5-2-6절)', () => {
  it('글은 데스크톱 호버와 같은 `ui.verb.walk`다(새 글 0)', () => {
    expect(WALK).toBe('あるく');
  });

  it('영역 밖이면 0.6초 띄우고, 영역 안(양 끝 포함)이면 안 띄운다', () => {
    const n = createFirstNotes(5, 'jjuk');
    expect(noteWalkTap(n, { x: 100, y: WALK_AREA.top }, WALK_AREA, WALK, 0)).toBe(false);
    expect(noteWalkTap(n, { x: WALK_AREA.right, y: WALK_AREA.bottom }, WALK_AREA, WALK, 0)).toBe(false);
    expect(currentNote(n, 0)).toBeNull();
    expect(noteWalkTap(n, { x: 100, y: WALK_AREA.top - 1 }, WALK_AREA, WALK, 10)).toBe(true);
    expect(currentNote(n, 10 + WALK_TAP_NOTE_TICKS - 1)).toBe(WALK);
    expect(currentNote(n, 10 + WALK_TAP_NOTE_TICKS)).toBeNull();
    expect(noteWalkTap(n, { x: WALK_AREA.left - 1, y: 230 }, WALK_AREA, WALK, 0)).toBe(true);
  });

  it('`park_fountain` 돌우산 판 가장자리(Mia 모바일 2회 #17)를 터치하면 걷기 + あるく, 다음 탭에서 지운다', () => {
    const s = ready();
    const n = createFirstNotes(5, s.ui.active);
    const umbrellaEdge = { x: 196, y: 50 };
    expect(tap(s, n, umbrellaEdge, TOUCH)).toBe('intent:walk');
    expect(currentNote(n, s.tick)).toBe(WALK);
    noteTap(n);
    expect(currentNote(n, s.tick)).toBeNull();
  });

  it('그 탭이 긴 걷기여도 건너뛰기 안내는 안 뜨고 횟수(`walkNotes`)도 안 센다', () => {
    const s = ready();
    const n = createFirstNotes(5, s.ui.active);
    const w = s.walkers[s.ui.active];
    // 지금 자리에서 WALK_NOTE_MIN 넘게 떨어진 x, 걷기 영역 위(벽).
    const far = { x: w.x > 240 ? w.x - WALK_NOTE_MIN - 20 : w.x + WALK_NOTE_MIN + 20, y: 120 };
    expect(tap(s, n, far, TOUCH)).toBe('intent:walk');
    expect(currentNote(n, s.tick)).toBe(WALK);
    expect(n.walkNotes).toBe(0);
    // 0.6초 뒤에도 건너뛰기 안내로 바뀌지 않는다(걷기 시작 때 한 번만 본다).
    for (let i = 0; i < WALK_TAP_NOTE_TICKS; i++) sceneTick(data, s);
    expect(currentNote(n, s.tick)).toBeNull();
  });

  it('마우스 클릭(slop 0)은 안 띄운다: 호버가 이미 あるく를 보여 준다', () => {
    const s = ready();
    const n = createFirstNotes(5, s.ui.active);
    expect(tap(s, n, { x: 196, y: 50 }, 0)).toBe('intent:walk');
    expect(currentNote(n, s.tick)).not.toBe(WALK);
  });

  it('영역 안 바닥 터치는 지금처럼: 긴 걷기면 건너뛰기 안내', () => {
    const s = ready();
    const n = createFirstNotes(5, s.ui.active);
    const w = s.walkers[s.ui.active];
    const far = { x: w.x > 240 ? w.x - WALK_NOTE_MIN - 20 : w.x + WALK_NOTE_MIN + 20, y: 240 };
    expect(tap(s, n, far, TOUCH)).toBe('intent:walk');
    expect(currentNote(n, s.tick)).toBe(SKIP);
    expect(n.walkNotes).toBe(1);
  });
});
