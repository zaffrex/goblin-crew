// 타이틀·맵 프레임(`menus.ts`, #792 설계 6절)이 브라우저 localStorage에 미리 심을 세이브.
// 세이브 상태 셋(없음 / 일부 깸 / 다 깸)을 게임과 같은 함수(`saveOnCard`)로 만든다. 손으로 JSON을 적으면 스키마가 바뀔 때 어긋난다.

import { CONTENT_VERSION, saveOnCard } from '../../src/core/progress.ts';
import { SAVE_KEY, type SaveData } from '../../src/core/save/schema.ts';

export const MENU_STATES = ['none', 'some', 'all'] as const;
export type MenuState = (typeof MENU_STATES)[number];

/**
 * - `none`: 세이브 없음(null).
 * - `some`: 첫 판만 깸. checkpoint는 둘째 판(카드가 뜰 때 저장하는 그대로).
 * - `all`: 배포 순서 모든 판을 차례로 깸. checkpoint는 마지막 판.
 * 판이 하나뿐인 순서는 `some`과 `all`이 같아진다.
 */
export function menuSeed(state: MenuState, order: readonly string[], activeCharacter: string, now = new Date(0)): SaveData | null {
  if (state === 'none') return null;
  const upTo = state === 'some' ? 1 : order.length;
  let save: SaveData | null = null;
  for (let index = 0; index < upTo; index++) save = saveOnCard({ prev: save, order, index, activeCharacter, contentVersion: CONTENT_VERSION, now });
  return save;
}

/** 문서가 만들어질 때마다 먼저 돌 스크립트. 세이브 키를 지우거나 심는다. 게임 함수는 안 부른다. */
export function seedScript(save: SaveData | null): string {
  const key = JSON.stringify(SAVE_KEY);
  return save === null ? `localStorage.removeItem(${key});` : `localStorage.setItem(${key}, ${JSON.stringify(JSON.stringify(save))});`;
}
