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
  const index = order.indexOf(save.checkpoint.screenId);
  if (index < 0) return { kind: 'new' };
  return { kind: 'continue', index, screenId: save.checkpoint.screenId, activeCharacter: save.checkpoint.activeCharacter };
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
 * 맵 재도전(#792)에서 이미 깬 화면을 다시 깼을 때 앞선 진행도를 되돌리지 않는 규칙: `checkpoint`는 `prev`가 더 앞이면 그대로 둔다.
 */
export function saveOnCard(i: CardSaveInput): SaveData {
  const cleared = i.order[i.index];
  if (cleared === undefined) throw new Error(`order에 없는 위치 ${i.index}`);
  const solved = [...(i.prev?.progress.solvedScreens ?? [])];
  if (!solved.includes(cleared)) solved.push(cleared);
  const nextId = i.order[i.index + 1] ?? cleared;
  let checkpoint = { screenId: nextId, gauge: CHECKPOINT_GAUGE, activeCharacter: i.activeCharacter, carriedItems: [] as string[] };
  if (i.prev) {
    const prevAt = i.order.indexOf(i.prev.checkpoint.screenId);
    if (prevAt > i.index + 1) checkpoint = { ...i.prev.checkpoint, carriedItems: [...i.prev.checkpoint.carriedItems] };
  }
  return { version: 1, contentVersion: i.contentVersion, updatedAt: i.now.toISOString(), progress: { solvedScreens: solved }, checkpoint };
}
