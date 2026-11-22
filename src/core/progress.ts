// 세이브 연결의 순수 판단(#767, 설계 `docs/design/ui-interaction.md` 11-4절). DOM·저장소를 모른다.
// main.ts가 `SaveStore`로 읽고 쓰는 값을 여기서 만들고 고른다. `src/core/save/` 스키마 v1은 바꾸지 않는다.

import type { SaveData } from './save/schema';

/** 클리어 카드가 뜨는 순간 저장하는 게이지(G3: 화면 들어갈 때 늘 5). */
export const CHECKPOINT_GAUGE = 5;

/** 11-4절: 배포 순서의 모든 id가 `solvedScreens`에 있으면 다 깬 것(이어 하기가 안 나온다). */
export function isAllCleared(save: SaveData, order: readonly string[]): boolean {
  const solved = new Set(save.progress.solvedScreens);
  return order.length > 0 && order.every((id) => solved.has(id));
}

export type Resume =
  | { kind: 'new' }
  | { kind: 'continue'; index: number; screenId: string; activeCharacter: string };

/**
 * 시작 때 세이브에서 어디로 이어 할지. 틀린 세이브는 전부 `new`(손상·모르는 화면·다 깸).
 * - 세이브 없음, 다 깸 → new
 * - `checkpoint.screenId`가 배포 순서에 없으면 → new (콘텐츠가 바뀌어 화면이 사라진 경우)
 * - 같은 id가 순서에 두 번 없다는 건 `parseOrder`가 보장하므로 `indexOf`로 위치를 찾는다
 */
export function resumeFrom(save: SaveData | null, order: readonly string[]): Resume {
  if (!save || isAllCleared(save, order)) return { kind: 'new' };
  const at = order.indexOf(save.checkpoint.screenId);
  if (at < 0) return { kind: 'new' };
  const solved = new Set(save.progress.solvedScreens);
  let index = at;
  if (solved.has(order[at]!)) {
    // 마지막 화면은 checkpoint가 자기 id라 이미 깬 화면일 수 있다. 그 뒤의 안 깬 화면, 없으면 순서 전체에서 처음 안 깬 화면.
    index = order.findIndex((id, k) => k > at && !solved.has(id));
    if (index < 0) index = order.findIndex((id) => !solved.has(id));
    if (index < 0) return { kind: 'new' };
  }
  return { kind: 'continue', index, screenId: order[index]!, activeCharacter: save.checkpoint.activeCharacter };
}

export interface CardSaveInput {
  prev: SaveData | null;
  order: readonly string[];
  /** 방금 클리어한 화면의 순서 안 위치. */
  index: number;
  /** 다음 화면에 들어갈 때 캐릭터(`enterCharacter` 결과). 마지막 화면이면 지금 캐릭터. */
  activeCharacter: string;
  contentVersion: string;
  now: Date;
}

/**
 * 클리어 카드가 뜰 때 쓸 세이브(11-4절). 다음 화면 id가 `checkpoint`이고, 마지막 화면은 자기 id를 두고 `solvedScreens`만 채운다.
 * 이미 깬 화면은 다시 넣지 않는다(중복 없음). `solvedScreens`는 줄지 않는다.
 * 맵 재도전(#792): `prev.solvedScreens`에 이미 있는 화면을 다시 깬 것이면 다시 하기로 보고 `checkpoint`(캐릭터 포함)를 그대로 둔다(`updatedAt`만 갱신).
 * `새로 하기`는 호출 쪽에서 `prev = null`로 시작한다(옛 진행도를 넘기지 않는다).
 */
export function saveOnCard(i: CardSaveInput): SaveData {
  const cleared = i.order[i.index];
  if (cleared === undefined) throw new Error(`order에 없는 위치 ${i.index}`);
  if (i.prev?.progress.solvedScreens.includes(cleared)) {
    const c = i.prev.checkpoint;
    return { ...i.prev, updatedAt: i.now.toISOString(), progress: { solvedScreens: [...i.prev.progress.solvedScreens] }, checkpoint: { ...c, carriedItems: [...c.carriedItems] } };
  }
  const solved = [...(i.prev?.progress.solvedScreens ?? []), cleared];
  const nextId = i.order[i.index + 1] ?? cleared;
  const checkpoint = { screenId: nextId, gauge: CHECKPOINT_GAUGE, activeCharacter: i.activeCharacter, carriedItems: [] as string[] };
  return { version: 1, contentVersion: i.contentVersion, updatedAt: i.now.toISOString(), progress: { solvedScreens: solved }, checkpoint };
}

/** 세이브 `contentVersion`(ADR-0006). 화면 id가 바뀌거나 빠지는 콘텐츠 마이그레이션이 생기면 올린다. */
export const CONTENT_VERSION = 'm2-1';

/**
 * 페이지를 열 때 세이브에서 고를 것(#767 2/2). `resume`은 어디서 시작할지, `prev`는 이번 판 클리어 카드가 이어 쓸 세이브다.
 * - checkpoint 화면이 배포 순서에 없으면(콘텐츠가 바뀜) 옛 세이브를 이어 쓰지 않는다. 이어 쓰면 다시 깬 화면이 `saveOnCard`에서
 *   "다시 하기"로 읽혀 checkpoint가 사라진 화면에 그대로 남고, 새로고침할 때마다 처음 화면으로 돌아간다.
 * - 다 깬 세이브는 이어 쓴다. 처음 화면부터 다시 해도 `solvedScreens`(맵 #792가 쓸 것)를 잃지 않는다.
 *   타이틀의 `새로 하기`(#792)는 이 함수가 아니라 호출 쪽에서 `prev = null`로 시작한다.
 */
export function startFromSave(loaded: SaveData | null, order: readonly string[]): { resume: Resume; prev: SaveData | null } {
  const prev = loaded && order.includes(loaded.checkpoint.screenId) ? loaded : null;
  return { resume: resumeFrom(loaded, order), prev };
}
