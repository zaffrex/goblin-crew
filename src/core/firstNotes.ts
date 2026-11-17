// 처음 한 번만 띄우는 안내 글(설계 6-2-3·6-2-5절, #285). 대상 라벨 자리(`#label`)에 뜬다.
// 터치에는 호버가 없어서 특기 뜻·게이지 뜻을 배울 기회가 이것뿐이다. UI 상태라 세이브·BFS와 무관하다.
// M1은 세이브가 없어서 "그 판에서 처음"(새로고침하면 다시)이다.

import type { CharacterId } from './characters';

/** 첫 감소 안내가 떠 있는 시간(틱, 2.5초 @ 60Hz, 설계 6-2-5절). */
export const GAUGE_NOTE_TICKS = 150;

export interface FirstNotes {
  /** 그 판에서 능력 버튼을 무장해 본 캐릭터. */
  armedOnce: Set<CharacterId>;
  /** 첫 감소 안내를 이미 띄웠나. */
  dropShown: boolean;
  /** 지난번에 본 게이지(감소를 알아보는 데 쓴다). */
  lastGauge: number;
  /** 지금 떠 있는 글. `until`이 null이면 다음 탭까지. */
  note: { text: string; until: number | null } | null;
}

export function createFirstNotes(gauge: number): FirstNotes {
  return { armedOnce: new Set(), dropShown: false, lastGauge: gauge, note: null };
}

/** 탭 하나가 왔다. 떠 있는 글은 무엇이든 지운다(다음 탭에서 지움, 6-2-3·6-2-5절). 탭 결과를 반영하기 **전에** 부른다. */
export function noteTap(n: FirstNotes): void {
  n.note = null;
}

/** 능력 버튼을 무장했다. 그 캐릭터가 처음이면 특기 설명을 다음 탭까지 띄운다(6-2-3절). */
export function noteArmAbility(n: FirstNotes, char: CharacterId, text: string): void {
  if (n.armedOnce.has(char)) return;
  n.armedOnce.add(char);
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
