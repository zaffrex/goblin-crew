// 걷기 건너뛰기: 가려던 곳을 다시 누르면 바로 도착 + 긴 걷기 안내(#38, `ui-interaction.md` 5-2절).
// 5-2-4절 "테스트로 고정할 것" 1~5번. 6번(정답 재생 그대로)은 `solve` 테스트가 본다(자동 걷기만 쓰고 바닥 걷기를 안 쓴다).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import screenJson from '../../content/screens/magpie_nest.json';
import texts from '../../content/text/ja.json';
import { createFirstNotes, currentNote, noteSwitch, noteTap, noteWalkDone, noteWalkSkipped, noteWalkStart, WALK_NOTE_MAX, WALK_NOTE_MIN } from './firstNotes';
import { CHAR_SLOTS } from './hud';
import type { HitBox } from './hit';
import type { CharactersData, ScreenData } from './puzzle/types';
import { charWalking, createScene, isBusy, sceneTap, sceneTick, takeWalkStart, WALK_SKIP_SAME, type SceneData, type SceneState } from './scene';
import type { Point } from './viewport';

const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const TEXT: Record<string, string> = texts;
const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
const SEESAW_LEFT = center({ left: 208, top: 196, width: 38, height: 24 });

/** onEnter가 끝난 화면. */
function ready(): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
  takeWalkStart(s);
  return s;
}

describe('바닥 걷기 건너뛰기 (5-2-1절)', () => {
  it('글이 있다: 터치·마우스 두 판', () => {
    expect(TEXT['ui.hud.walk_skip']).toBe('行き先をもう一度タップすると、すぐ着く');
    expect(TEXT['ui.hud.walk_skip_click']).toBe('行き先をもう一度クリックすると、すぐ着く');
  });

  it('1. 걷는 중 목표에서 12px 안을 다시 누르면 목표에 바로 서고, 12px 밖이면 목표를 바꿔 계속 걷는다', () => {
    const s = ready();
    const w = s.walkers.jjuk;
    const goal = { x: 420, y: 240 };
    expect(sceneTap(data, s, goal, 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    const facing = w.facing;
    sceneTick(data, s);
    // 12px 밖(13px): 목표가 바뀐다.
    expect(sceneTap(data, s, { x: goal.x - 13, y: goal.y }, 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    expect(w.target).toEqual({ x: 407, y: 240 });
    sceneTick(data, s);
    const mid = { x: w.x, y: w.y };
    expect(mid.x).toBeLessThan(407);
    // 지금 목표에서 정확히 12px(대각선 포함 유클리드 거리): 같은 점이다.
    expect(Math.hypot(7.2, 9.6)).toBeCloseTo(WALK_SKIP_SAME);
    expect(sceneTap(data, s, { x: 407 + 7.2, y: 240 - 9.6 }, 0, false)).toEqual({ kind: 'skipWalk' });
    expect([w.x, w.y]).toEqual([407, 240]);
    expect(w.target).toBeNull();
    expect(w.walkTicks).toBe(0);
    expect(w.facing).toBe(facing);
    expect(charWalking(s, 'jjuk')).toBe(false);
    expect(isBusy(s)).toBe(false);
  });

  it('서 있을 때 같은 점을 누르는 건 건너뛰기가 아니다(걷기 시작)', () => {
    const s = ready();
    const goal = { x: 420, y: 240 };
    sceneTap(data, s, goal, 0, false);
    for (let i = 0; i < 2000 && s.walkers.jjuk.target; i++) sceneTick(data, s);
    expect(sceneTap(data, s, goal, 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    expect(sceneTap(data, s, { x: 100, y: 240 }, 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    expect(s.walkers.jjuk.target).toEqual({ x: 100, y: 240 });
  });

  it('2. 걷는 중 다른 캐릭터로 바꾼 뒤 같은 점을 누르면 새 걷기다. 처음 캐릭터는 계속 걷는다', () => {
    const s = ready();
    const goal = { x: 420, y: 240 };
    sceneTap(data, s, goal, 0, false);
    sceneTick(data, s);
    expect(sceneTap(data, s, center(CHAR_SLOTS.mukjik), 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'switch', char: 'mukjik' } });
    expect(s.ui.active).toBe('mukjik');
    expect(sceneTap(data, s, goal, 0, false)).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
    expect(s.walkers.mukjik.target).toEqual(goal);
    expect(s.walkers.jjuk.target).toEqual(goal);
    expect(s.walkers.jjuk.x).not.toBe(goal.x);
  });

  it('3. 걷기 영역 밖(게이지 띠 바로 위)을 두 번 누르면 자른 점끼리 비교해 건너뛴다', () => {
    const s = ready();
    sceneTap(data, s, { x: 400, y: 255 }, 0, false);
    expect(s.walkers.jjuk.target).toEqual({ x: 400, y: 252 });
    sceneTick(data, s);
    // 누른 점끼리는 12px보다 멀어도(가로 5px + 세로 범위 밖) 자른 점은 (405, 252)라 5px.
    expect(sceneTap(data, s, { x: 405, y: 255 }, 0, false)).toEqual({ kind: 'skipWalk' });
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([400, 252]);
  });

  it('긴 걷기 길이를 넘긴다: 바닥 걷기는 직선, 자동 걷기는 구간 합. 건너뛰기는 새 걷기가 아니다', () => {
    const s = ready();
    const w = s.walkers.jjuk;
    sceneTap(data, s, { x: 420, y: 240 }, 0, false);
    const ws = takeWalkStart(s);
    expect(ws?.char).toBe('jjuk');
    expect(ws?.dist).toBeCloseTo(Math.hypot(420 - w.x, 240 - w.y));
    expect(takeWalkStart(s)).toBeNull();
    sceneTick(data, s);
    expect(sceneTap(data, s, { x: 420, y: 240 }, 0, false).kind).toBe('skipWalk');
    expect(takeWalkStart(s)).toBeNull();
    // 자동 걷기(시소 왼끝에 올라서기): 이벤트가 시작하는 틱에 넘긴다.
    sceneTap(data, s, SEESAW_LEFT, 0, false);
    for (let i = 0; i < 5 && s.current?.ev.type !== 'walk'; i++) sceneTick(data, s);
    expect(s.current?.ev.type).toBe('walk');
    const auto = takeWalkStart(s);
    expect(auto?.char).toBe('jjuk');
    expect(auto!.dist).toBeGreaterThan(WALK_NOTE_MIN);
    expect(charWalking(s, 'jjuk')).toBe(true);
  });

  it('시작 연출(onEnter) 중에는 걷기 길이를 넘기지 않는다', () => {
    const s = createScene(data);
    for (let i = 0; i < 5000 && isBusy(s); i++) {
      sceneTick(data, s);
      expect(takeWalkStart(s)).toBeNull();
    }
  });
});

describe('긴 걷기 안내 (5-2-2절)', () => {
  const MSG = 'skip';

  it('4. 135px 이상에서만 뜨고, 걷기가 끝나면 지운다. 2번 뜬 뒤에는 안 뜬다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteWalkStart(n, 'jjuk', WALK_NOTE_MIN - 1, MSG);
    expect(currentNote(n, 0)).toBeNull();
    noteWalkStart(n, 'jjuk', WALK_NOTE_MIN, MSG);
    expect(currentNote(n, 0)).toBe(MSG);
    // 시간으로는 안 지운다(그 걷기가 끝날 때까지).
    expect(currentNote(n, 100000)).toBe(MSG);
    noteWalkDone(n, () => true);
    expect(currentNote(n, 0)).toBe(MSG);
    noteWalkDone(n, (c) => c !== 'jjuk');
    expect(currentNote(n, 0)).toBeNull();
    for (let i = 1; i < WALK_NOTE_MAX; i++) {
      noteWalkStart(n, 'mukjik', 300, MSG);
      expect(currentNote(n, 0)).toBe(MSG);
      noteTap(n);
    }
    noteWalkStart(n, 'jjuk', 300, MSG);
    expect(currentNote(n, 0)).toBeNull();
    expect(WALK_NOTE_MAX).toBe(2);
  });

  it('4. 안내가 떠 있는 중 같은 사람이 목표를 바꾸면 안내가 이어지고 횟수는 안 센다(#755 Luna 리뷰)', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteWalkStart(n, 'jjuk', 300, MSG);
    expect(n.walkNotes).toBe(1);
    // 탭(목표 바꾸기): 엔진은 noteTap 전에 떠 있던 걷기 안내의 주인을 잡아 둔다.
    const walking = n.note?.walk;
    noteTap(n);
    noteWalkStart(n, 'jjuk', 300, MSG, walking === 'jjuk');
    expect(currentNote(n, 0)).toBe(MSG);
    expect(n.walkNotes).toBe(1);
    // 바꾼 걷기가 짧으면 탭이 지운 그대로다.
    noteTap(n);
    noteWalkStart(n, 'jjuk', WALK_NOTE_MIN - 1, MSG, true);
    expect(currentNote(n, 0)).toBeNull();
    // 걷기가 끝난 뒤 다음 긴 걷기에서 한 번 더 뜬다(2번째), 그 뒤는 안 뜬다.
    noteWalkStart(n, 'jjuk', 300, MSG);
    expect(currentNote(n, 0)).toBe(MSG);
    expect(n.walkNotes).toBe(2);
    noteTap(n);
    noteWalkStart(n, 'jjuk', 300, MSG);
    expect(currentNote(n, 0)).toBeNull();
  });

  it('4. 건너뛰기를 한 번 쓰면 다시 안 뜬다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteWalkSkipped(n);
    noteWalkStart(n, 'jjuk', 300, MSG);
    expect(currentNote(n, 0)).toBeNull();
  });

  it('5. 다른 처음 한 번 안내가 떠 있으면 덮지 않고, 횟수도 세지 않는다', () => {
    const n = createFirstNotes(5, 'jjuk');
    noteSwitch(n, 'mukjik', 'intro');
    noteWalkStart(n, 'mukjik', 300, MSG);
    expect(currentNote(n, 0)).toBe('intro');
    noteWalkDone(n, () => false);
    expect(currentNote(n, 0)).toBe('intro');
    noteTap(n);
    for (let i = 0; i < WALK_NOTE_MAX; i++) {
      noteWalkStart(n, 'mukjik', 300, MSG);
      expect(currentNote(n, 0)).toBe(MSG);
      noteTap(n);
    }
  });
});
