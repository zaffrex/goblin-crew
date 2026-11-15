// 양말 3인조 정의 (ADR-0003). 히트 영역은 ADR-0007 결정 4·6의 그림 크기와 anchorX를 따른다.
// 그림이 24px보다 좁거나 낮아도 히트 영역은 최소 24×24로 키운다.

import type { HitBox } from './hit';
import type { Facing, Walker } from './walk';

export type CharacterId = 'jjuk' | 'mukjik' | 'ppik';

export interface CharacterDef {
  id: CharacterId;
  /** ADR-0003 능력 동사. 능력 사용은 퍼즐 데이터 모델 뒤에 붙인다. */
  ability: 'stretch' | 'stomp' | 'squeak';
  /**
   * 오른쪽을 볼 때, 기준점(발 바닥 + 다리 가운데) 기준 히트 영역.
   * dx는 기준점에서 왼쪽 끝까지(음수), dy는 기준점에서 위쪽 끝까지(음수).
   */
  hit: { dx: number; dy: number; width: number; height: number };
}

export const MIN_HIT_SIZE = 24;

// 그림: 쭉이 20×42(anchorX 6), 묵직이 30×30(anchorX 11), 삑삑이 18×25(anchorX 6).
// 좁은 쪽은 사방으로 똑같이 넓혀 24px를 맞춘다(쭉이 +2/+2, 삑삑이 +3/+3).
export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'jjuk', ability: 'stretch', hit: { dx: -8, dy: -42, width: 24, height: 42 } },
  { id: 'mukjik', ability: 'stomp', hit: { dx: -11, dy: -30, width: 30, height: 30 } },
  { id: 'ppik', ability: 'squeak', hit: { dx: -9, dy: -25, width: 24, height: 25 } },
];

export function characterDef(id: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === id);
  if (!def) throw new Error(`알 수 없는 캐릭터: ${id}`);
  return def;
}

/** 발 위치와 보는 방향으로 히트 영역을 만든다. 왼쪽을 볼 때는 기준점(anchorX) 축으로 뒤집는다. */
export function characterHitBox(def: CharacterDef, x: number, y: number, facing: Facing): HitBox {
  const fx = Math.round(x);
  const fy = Math.round(y);
  const { dx, dy, width, height } = def.hit;
  const left = facing === 1 ? fx + dx : fx - (dx + width);
  return { left, top: fy + dy, width, height };
}

export function walkerHitBox(w: Walker): HitBox {
  return characterHitBox(characterDef(w.id), w.x, w.y, w.facing);
}
