// 처음 한 번만 띄우는 안내 글(설계 6-4-3·6-2-5절, #285·#311). 대상 라벨 자리(`#label`)에 뜬다.
// 터치에는 호버가 없어서 특기 뜻·게이지 뜻을 배울 기회가 이것뿐이다. UI 상태라 세이브·BFS와 무관하다.
// M1은 세이브가 없어서 "그 판에서 처음"(새로고침하면 다시)이다.

import { characterDef, type CharacterId } from './characters';
import { targetIntent, type Label, type PuzzleView } from './interact';
import { FLOOR, type Action, type RuleDef } from './puzzle/types';
import type { Point } from './viewport';
import type { WalkArea } from './walk';

/** 첫 감소 안내가 떠 있는 시간(틱, 2.5초 @ 60Hz, 설계 6-2-5절). */
export const GAUGE_NOTE_TICKS = 150;
/** 마우스 전환 알림이 떠 있는 시간(틱, 0.8초 @ 60Hz, #692). 터치는 시간으로 안 지운다(다음 탭까지). */
export const SWITCH_NOTE_TICKS = 48;

export interface FirstNotes {
  /** 그 판에서 특기 설명을 이미 본 캐릭터. 처음 캐릭터는 시작 카드가 말했으니 처음부터 들어 있다(6-4-3절). */
  introduced: Set<CharacterId>;
  /** 첫 감소 안내를 이미 띄웠나. */
  dropShown: boolean;
  /** 지난번에 본 게이지(감소를 알아보는 데 쓴다). */
  lastGauge: number;
  /**
   * 지금 떠 있는 글. `until`이 null이면 다음 탭까지.
   * `hover`가 있으면 마우스 전환 알림이다(#692): 마우스가 다른 대상으로 옮겨 가면(`noteHover`) 호버 라벨에 자리를 내준다.
   * `walk`가 있으면 긴 걷기 안내다(#38): 그 캐릭터의 걷기가 끝나면(`noteWalkDone`) 지운다.
   */
  note: { text: string; until: number | null; hover?: string; walk?: CharacterId } | null;
  /**
   * 서는 자리로 가는 중인 사람(6-4-1a절). busy가 풀리면 `noteStood`가 본다.
   * `touch`: 올라서기를 실행한 탭이 터치였나. 터치면 안내 글 대신 그 자리 특기를 고른 상태로 만든다(6-4-1a-1절, #710).
   */
  climbing: { char: CharacterId; spot: string; touch: boolean } | null;
  /** 서 있는 자리에 특기를 한 번이라도 쓴 캐릭터. 그 판에서 올라선 뒤 라벨을 다시 안 띄운다(6-4-1a절). 터치 선택(6-4-1a-1절)은 이걸 안 본다. */
  usedHere: Set<CharacterId>;
  /** 긴 걷기 안내(#38, 5-2-2절)를 띄운 횟수. `WALK_NOTE_MAX`번이면 그 판에서 더 안 띄운다. */
  walkNotes: number;
  /** 그 판에서 걷기 건너뛰기(자동·바닥)를 한 번이라도 썼나. 썼으면 긴 걷기 안내를 다시 안 띄운다. */
  walkSkipped: boolean;
  /**
   * 마지막 탭 직전에 걷기 안내가 떠 있던 사람(#755 Luna 리뷰). 그 탭이 시작한 걷기가 같은 사람이면 목표 바꾸기라 안내를 횟수 없이 이어 띄운다.
   * 바닥 탭은 탭 처리 안에서, 물건 탭은 다음 틱에 걷기가 시작돼서(`runAction`은 대기열에 넣기만 한다) 탭 뒤 첫 틱까지 들고 있는다.
   * 걷기 시작 하나를 받으면(`noteWalkStart`) 또는 그 틱이 끝나면(`noteWalkDone`) 비운다.
   */
  walkCarry: CharacterId | null;
}

export function createFirstNotes(gauge: number, first: CharacterId): FirstNotes {
  return { introduced: new Set([first]), dropShown: false, lastGauge: gauge, note: null, climbing: null, usedHere: new Set(), walkNotes: 0, walkSkipped: false, walkCarry: null };
}

/**
 * 탭 하나가 왔다. 떠 있는 글은 무엇이든 지운다(다음 탭에서 지움, 6-4-3·6-2-5절). 탭 결과를 반영하기 **전에** 부른다.
 * 걷기 안내였으면 그 주인을 `walkCarry`에 남긴다(목표 바꾸기면 횟수 없이 이어 띄운다, #755).
 */
export function noteTap(n: FirstNotes): void {
  n.walkCarry = n.note?.walk ?? null;
  n.note = null;
}

/** 그 캐릭터로 바꿨다(얼굴 탭·몸 탭). 그 판에서 처음이면 특기 설명을 다음 탭까지 띄운다(6-4-3절). 터치만 부른다. */
export function noteSwitch(n: FirstNotes, char: CharacterId, text: string): void {
  if (n.introduced.has(char)) return;
  n.introduced.add(char);
  n.note = { text, until: null };
}

/**
 * 전환 알림 `{name}に交代`(#692, #603 7·8회차). 몸 탭으로 바뀌면 휴대폰에서는 얼굴 칸 강조만 달라지는데 시선은 누른 물건에 있어서
 * "눌렀는데 반응 없음"으로 읽혔다. 얼굴 칸 탭도 같은 일이라 같은 글을 쓴다. `noteSwitch` **뒤에** 부른다:
 * 그 판 처음 바꾼 캐릭터(터치)는 특기 설명이 이미 떴고, 그 글도 이름으로 시작하니 그게 먼저다.
 * 터치는 다음 탭까지(선택 라벨과 같은 규칙). 마우스는 0.8초, 그 사이 마우스가 다른 대상으로 가면 바로 호버 라벨이다(`noteHover`).
 * `hoverKey`는 클릭한 순간 마우스 아래 라벨 키(`labelKey`)다.
 */
export function noteSwitched(n: FirstNotes, text: string, tick: number, touch: boolean, hoverKey: string): void {
  if (n.note) return;
  n.note = touch ? { text, until: null } : { text, until: tick + SWITCH_NOTE_TICKS, hover: hoverKey };
}

/** 마우스 호버 라벨이 다시 정해졌다. 전환 알림을 띄운 자리와 다른 대상이면 알림을 지운다(#692, "마우스는 호버가 바꾼다"). */
export function noteHover(n: FirstNotes, hoverKey: string): void {
  if (n.note?.hover !== undefined && n.note.hover !== hoverKey) n.note = null;
}

/** 호버 라벨 비교용 키. 라벨이 없으면 빈 글. */
export function labelKey(l: Label | null): string {
  return l ? `${l.verb ?? ''}|${l.target ?? ''}|${l.item ?? ''}` : '';
}

/**
 * 터치 첫 탭(선택) 라벨 글. 그 판 내내 `template`(`{label}` 자리에 원래 라벨)으로 감싼다(#661 → #680, 설계 4절).
 * 첫 탭 라벨은 데스크톱 호버 라벨과 똑같이 생겨서, 이 말이 없으면 "눌렀는데 반응 없음"으로 읽힌다(#603 5회차 휴대폰).
 * 처음엔 터치로 한 번 실행하면 껐는데, 규칙을 아는 플레이어도 전환 탭(동료 몸이 덮은 시소 끝)을 한 번으로 세서
 * 둘째 탭(선택)에서 멈췄다(#603 7회차). 그래서 끄지 않는다.
 * 한 줄로 붙인다. 둘째 줄로 내리면 라벨이 위로 자라 휴대폰에서 방금 고른 시소 판 끝을 덮는다(다시 탭할 바로 그 대상).
 */
export function selectLabelText(base: string, template: string): string {
  return template.replace('{label}', base);
}

/** 매 프레임 보이는 게이지를 넘긴다. 그 판에서 처음 줄면 2.5초 안내(6-2-5절). 기절 뒤 다시 차는 건 감소가 아니다. */
export function noteGauge(n: FirstNotes, gauge: number, tick: number, text: string): void {
  if (gauge < n.lastGauge && !n.dropShown) {
    n.dropShown = true;
    n.note = { text, until: tick + GAUGE_NOTE_TICKS };
  }
  n.lastGauge = gauge;
}

/** 지금 띄울 글. 시간이 지났으면 지운다. */
export function currentNote(n: FirstNotes, tick: number): string | null {
  if (n.note?.until != null && tick >= n.note.until) n.note = null;
  return n.note?.text ?? null;
}

/**
 * 실행된 행동 하나(마우스 클릭, 터치 둘째 탭). `before`는 탭 **전** 그 사람 자리(`puzzle.at`, `step`이 바꾸기 전).
 * 서는 자리로 `move`면 올라서기 시작, 선 자리에 자기 특기면 "써 봤다"로 센다(6-4-1a절).
 */
export function noteAction(n: FirstNotes, action: Action, before: string, touch = false): void {
  if (action.verb === 'move') {
    n.climbing = action.target === FLOOR ? null : { char: action.char, spot: action.target, touch };
    return;
  }
  n.climbing = null;
  if (action.verb === characterDef(action.char).ability && action.target === before) n.usedHere.add(action.char);
}

/**
 * 올라선 뒤 띄울 라벨(6-4-1a절 조건 ②·③). 그 사람이 그 자리를 누르면 나오는 라벨(`targetIntent`, 호버와 같은 판정)이
 * 그 사람 특기이고, 화면 `rules`에 그 자리 × 그 특기 규칙이 있을 때만(`when`은 안 본다). 폴백만 있는 자리는 null.
 * 이 함수는 rules를 읽는다. 라벨 판정(`interact.ts` 원칙 1)은 그대로 rules를 안 읽고, 이건 안내를 띄울지만 정한다.
 */
export function standLabel(ctx: PuzzleView, rules: readonly RuleDef[], char: CharacterId, spot: string): Label | null {
  return standSelect(ctx, rules, char, spot)?.label ?? null;
}

/**
 * 터치로 올라선 뒤 엔진이 대신 고를 것(6-4-1a-1절, #710). `standLabel`과 같은 조건이고, 4절 "첫 탭 = 선택"과 같은 상태가 되도록
 * 그 자리를 다시 눌렀을 때 나오는 행동 키(`ui.selected`)와 라벨(터치 선택 라벨)을 준다. 다음 탭이 같은 끝이나 서 있는 내 몸이면 바로 실행된다.
 */
export function standSelect(ctx: PuzzleView, rules: readonly RuleDef[], char: CharacterId, spot: string): { key: string; label: Label } | null {
  if (ctx.puzzle.at[char] !== spot) return null;
  const r = targetIntent(ctx, char, { kind: 'spot', ref: spot }, { x: 0, y: 0 });
  const ability = characterDef(char).ability;
  if (r.kind !== 'act' || r.label.verb !== ability) return null;
  return rules.some((rule) => rule.target === spot && rule.verb === ability) ? { key: r.key, label: r.label } : null;
}

/**
 * busy가 풀린 첫 프레임에 부른다. 방금 서는 자리로 간 사람이 지금 고른 사람이고(조건 ①), 아직 그 자리 특기를 안 써 봤고,
 * 다른 처음 한 번 안내가 떠 있지 않으면 2.5초(또는 다음 탭까지) 그 라벨을 띄운다. `text`가 null이면(조건 ②·③) 안 띄운다.
 * 올라서기가 터치였으면 글을 띄우지 않고 `{ char, spot }`을 돌려준다. 부른 쪽이 `standSelect`로 그 자리 특기를 고른다(6-4-1a-1절, #710).
 * 터치는 "아직 안 써 봤고"를 보지 않아 올라설 때마다 돌려준다(두 번째 발사도 탭 3번, PR #719). 조건 ①과 겹침 건너뜀은 같다.
 */
export function noteStood(n: FirstNotes, active: CharacterId, tick: number, text: (c: { char: CharacterId; spot: string }) => string | null): { char: CharacterId; spot: string } | null {
  const c = n.climbing;
  n.climbing = null;
  if (!c || c.char !== active || currentNote(n, tick) !== null) return null;
  // 터치는 `usedHere`를 보지 않는다: 글이 아니라 할 일 없는 탭을 없애는 상태라 올라설 때마다 고른다(6-4-1a-1절, PR #719).
  if (c.touch) return { char: c.char, spot: c.spot };
  if (n.usedHere.has(c.char)) return null;
  const s = text(c);
  if (s) n.note = { text: s, until: tick + GAUGE_NOTE_TICKS };
  return null;
}

/** 긴 걷기 안내를 띄우는 최소 걷기 길이(내부 px, 90px/s로 1.5초, #38 5-2-2절). 짧은 걷기는 알려 줘도 누르기 전에 끝난다. */
export const WALK_NOTE_MIN = 135;
/** 그 판에서 긴 걷기 안내를 띄우는 최대 횟수(5-2-2절). 첫 번째는 걷는 그림을 보느라 못 읽을 수 있어서 2번이다. */
export const WALK_NOTE_MAX = 2;

/**
 * 걷기가 시작됐다(자동·바닥, 시작 연출 밖). `WALK_NOTE_MIN` 이상이고, 그 판에서 건너뛰기를 안 써 봤고, 아직 `WALK_NOTE_MAX`번 안 띄웠으면
 * 그 걷기가 끝날 때까지(또는 다음 탭까지) 안내를 띄운다. 다른 안내가 떠 있으면 덮지 않고 이번은 건너뛴다(횟수도 안 센다).
 * 이 걷기가 `walkCarry`와 같은 사람이면(탭 직전에 그 사람의 걷기 안내가 떠 있었다 = 목표 바꾸기, 바닥 탭이든 물건 탭이든, #755 Luna 리뷰)
 * 플레이어 눈에는 안내 한 번이 이어지는 것이라 횟수를 세지 않고 다시 띄운다. 새 걷기가 짧으면 탭이 지운 그대로 둔다.
 * `walkCarry`는 길이와 상관없이 걷기 시작 하나에서 비운다(같은 행동 안의 두 번째 걷기는 새로 센다).
 */
export function noteWalkStart(n: FirstNotes, char: CharacterId, dist: number, text: string): void {
  const continues = n.walkCarry === char;
  n.walkCarry = null;
  if (dist < WALK_NOTE_MIN) return;
  if (continues) {
    if (!n.note) n.note = { text, until: null, walk: char };
    return;
  }
  if (n.walkSkipped || n.walkNotes >= WALK_NOTE_MAX || n.note) return;
  n.walkNotes += 1;
  n.note = { text, until: null, walk: char };
}

/**
 * 걷기 건너뛰기를 썼다(자동이든 바닥이든). 그 판에서 긴 걷기 안내를 다시 안 띄운다. 탭이 이미 떠 있던 글을 지웠다(`noteTap`).
 * 그 탭이 남긴 `walkCarry`도 비운다: 건너뛰기는 목표 바꾸기가 아니라서, 바로 다음 틱에 같은 사람의 긴 걷기가 시작돼도
 * 안내를 이어 띄우지 않는다(#755 Luna 재리뷰 후속, "한 번이라도 쓰면 다시 안 띄운다").
 */
export function noteWalkSkipped(n: FirstNotes): void {
  n.walkSkipped = true;
  n.walkCarry = null;
}

/**
 * 매 틱, 그 틱의 걷기 시작을 넘긴(`noteWalkStart`) **뒤에** 부른다. 긴 걷기 안내를 띄운 그 캐릭터의 걷기가 끝났으면 지운다.
 * 탭 뒤 첫 틱이 끝났으니 `walkCarry`도 비운다: 그 틱에 걷기가 시작되지 않았으면 목표 바꾸기가 아니다(말 먼저 하는 행동의 걷기는 새로 센다).
 */
export function noteWalkDone(n: FirstNotes, walking: (char: CharacterId) => boolean): void {
  n.walkCarry = null;
  if (n.note?.walk !== undefined && !walking(n.note.walk)) n.note = null;
}

/** 걷기 영역 밖 터치 탭에 `あるく`를 띄우는 시간(틱, 0.6초 @ 60Hz, `ui-interaction.md` 5-2-6절). 다음 탭이 먼저 오면 그때 지운다. */
export const WALK_TAP_NOTE_TICKS = 36;

/**
 * 터치 탭이 바닥 걷기가 됐다(`intent.kind === 'walk'`). 누른 점이 걷기 영역(`area`, 양 끝 포함) 밖이면 `text`(`ui.verb.walk`)를
 * 0.6초 또는 다음 탭까지 띄우고 true를 준다(5-2-6절, #601 모바일 2회). 영역 안이면 몸이 누른 자리로 가니 아무것도 안 한다.
 * 걷기가 시작되기 **전에** 부른다: 글이 떠 있으면 `noteWalkStart`가 그 탭의 긴 걷기 안내를 건너뛰고 횟수도 안 센다.
 * 마우스는 부르지 않는다(호버가 이미 `あるく`를 보여 준다).
 */
export function noteWalkTap(n: FirstNotes, p: Point, area: WalkArea, text: string, tick: number): boolean {
  if (p.x >= area.left && p.x <= area.right && p.y >= area.top && p.y <= area.bottom) return false;
  n.note = { text, until: tick + WALK_TAP_NOTE_TICKS };
  return true;
}
