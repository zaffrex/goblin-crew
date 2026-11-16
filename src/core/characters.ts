// 캐릭터 3인 정의 (ADR-0003). 히트 영역은 ADR-0007 결정 4·6의 그림 크기와 anchorX를 따른다(#46).
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

// 시트가 있는 캐릭터는 시트 메타(`public/sprites/<id>-base.json`)의 `hit`·`anchor`와 같다(ADR-0007 결정 4:
// 서 있기 프레임 그림 박스). dx = hit[0] - anchor[0], dy = hit[1] - anchor[1]. 시트가 바뀌면
// characters.test.ts가 맞출 숫자를 알려 준다. core는 Node 도구(BFS 검사·재생)에서도 돌아서 json을 직접 읽지 않는다.
// 시트가 없는 캐릭터는 3차 샘플 잠정값: 삑삑이 18×25(anchorX 6)를 사방으로 넓혀 24px.
export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'jjuk', ability: 'stretch', hit: { dx: -13, dy: -64, width: 28, height: 64 } },
  { id: 'mukjik', ability: 'stomp', hit: { dx: -22, dy: -61, width: 39, height: 61 } },
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
