// 처음 한 번만 띄우는 안내 글(설계 6-4-3·6-2-5절, #285·#311). 대상 라벨 자리(`#label`)에 뜬다.
// 터치에는 호버가 없어서 특기 뜻·게이지 뜻을 배울 기회가 이것뿐이다. UI 상태라 세이브·BFS와 무관하다.
// M1은 세이브가 없어서 "그 판에서 처음"(새로고침하면 다시)이다.

import type { CharacterId } from './characters';

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
}

export function createFirstNotes(gauge: number, first: CharacterId): FirstNotes {
  return { introduced: new Set([first]), dropShown: false, lastGauge: gauge, note: null };
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
