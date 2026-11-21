// 처음 한 번만 띄우는 안내 글(설계 6-4-3·6-2-5절, #285·#311). 대상 라벨 자리(`#label`)에 뜬다.
// 터치에는 호버가 없어서 특기 뜻·게이지 뜻을 배울 기회가 이것뿐이다. UI 상태라 세이브·BFS와 무관하다.
// M1은 세이브가 없어서 "그 판에서 처음"(새로고침하면 다시)이다.

import { characterDef, type CharacterId } from './characters';
import { targetIntent, type Label, type PuzzleView } from './interact';
import { FLOOR, type Action, type RuleDef } from './puzzle/types';

/** 첫 감소 안내가 떠 있는 시간(틱, 2.5초 @ 60Hz, 설계 6-2-5절). */
export const GAUGE_NOTE_TICKS = 150;

export interface FirstNotes {
  /** 그 판에서 특기 설명을 이미 본 캐릭터. 처음 캐릭터는 시작 카드가 말했으니 처음부터 들어 있다(6-4-3절). */
  introduced: Set<CharacterId>;
  /** 첫 감소 안내를 이미 띄웠나. */
  dropShown: boolean;
  /** 지난번에 본 게이지(감소를 알아보는 데 쓴다). */
  lastGauge: number;
  /** 지금 떠 있는 글. `until`이 null이면 다음 탭까지. */
  note: { text: string; until: number | null } | null;
  /** 서는 자리로 가는 중인 사람(6-4-1a절). busy가 풀리면 `noteStood`가 본다. */
  climbing: { char: CharacterId; spot: string } | null;
  /** 서 있는 자리에 특기를 한 번이라도 쓴 캐릭터. 그 판에서 올라선 뒤 라벨을 다시 안 띄운다(6-4-1a절). */
  usedHere: Set<CharacterId>;
}

export function createFirstNotes(gauge: number, first: CharacterId): FirstNotes {
  return { introduced: new Set([first]), dropShown: false, lastGauge: gauge, note: null, climbing: null, usedHere: new Set() };
}

/** 탭 하나가 왔다. 떠 있는 글은 무엇이든 지운다(다음 탭에서 지움, 6-4-3·6-2-5절). 탭 결과를 반영하기 **전에** 부른다. */
export function noteTap(n: FirstNotes): void {
  n.note = null;
}

/** 그 캐릭터로 바꿨다(얼굴 탭·몸 탭). 그 판에서 처음이면 특기 설명을 다음 탭까지 띄운다(6-4-3절). 터치만 부른다. */
export function noteSwitch(n: FirstNotes, char: CharacterId, text: string): void {
  if (n.introduced.has(char)) return;
  n.introduced.add(char);
  n.note = { text, until: null };
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
export function noteAction(n: FirstNotes, action: Action, before: string): void {
  if (action.verb === 'move') {
    n.climbing = action.target === FLOOR ? null : { char: action.char, spot: action.target };
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
  if (ctx.puzzle.at[char] !== spot) return null;
  const r = targetIntent(ctx, char, { kind: 'spot', ref: spot }, { x: 0, y: 0 });
  const ability = characterDef(char).ability;
  if (r.kind !== 'act' || r.label.verb !== ability) return null;
  return rules.some((rule) => rule.target === spot && rule.verb === ability) ? r.label : null;
}

/**
 * busy가 풀린 첫 프레임에 부른다. 방금 서는 자리로 간 사람이 지금 고른 사람이고(조건 ①), 아직 그 자리 특기를 안 써 봤고,
 * 다른 처음 한 번 안내가 떠 있지 않으면 2.5초(또는 다음 탭까지) 그 라벨을 띄운다. `text`가 null이면(조건 ②·③) 안 띄운다.
 */
export function noteStood(n: FirstNotes, active: CharacterId, tick: number, text: (c: { char: CharacterId; spot: string }) => string | null): void {
  const c = n.climbing;
  n.climbing = null;
  if (!c || c.char !== active || n.usedHere.has(c.char) || currentNote(n, tick) !== null) return;
  const s = text(c);
  if (s) n.note = { text: s, until: tick + GAUGE_NOTE_TICKS };
}
