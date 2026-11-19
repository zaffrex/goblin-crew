// 캐릭터 3인 정의 (ADR-0003). 히트 영역은 ADR-0007 결정 4·6의 그림 크기와 anchorX를 따른다(#46).
// 그림이 24px보다 좁거나 낮아도 히트 영역은 최소 24×24로 키운다.

import type { HitBox } from './hit';
import type { Facing } from './walk';

export type CharacterId = 'jjuk' | 'mukjik' | 'ppik';

export interface CharacterDef {
  id: CharacterId;
  /** ADR-0003 능력 동사. 능력 사용은 퍼즐 데이터 모델 뒤에 붙인다. */
  ability: 'stretch' | 'stomp' | 'squeak';
  /**
   * 오른쪽을 볼 때, 기준점(발 바닥 + 다리 가운데) 기준 히트 영역.
   * dx는 기준점에서 왼쪽 끝까지(음수), dy는 기준점에서 위쪽 끝까지(음수).
   */
  hit: RelBox;
  /**
   * 얼굴 상자(시트 `head`, HUD 얼굴 칸을 자르는 그 24×24). `hit`과 같은 기준점·방향 규칙이다.
   * 바닥(`free` 자리)에 선 다른 캐릭터는 이 상자를 눌러야 전환된다(ui-interaction.md 2-1절, #427).
   */
  face: RelBox;
}

/** 기준점(발 바닥 + 다리 가운데)에서 잰 상자. 오른쪽을 볼 때 값이다. */
export interface RelBox {
  dx: number;
  dy: number;
  width: number;
  height: number;
}

export const MIN_HIT_SIZE = 24;

// 세 사람 모두 시트 메타(`public/sprites/<id>-base.json`)의 `hit`·`anchor`와 같다(ADR-0007 결정 4:
// 서 있기 프레임 그림 박스). dx = hit[0] - anchor[0], dy = hit[1] - anchor[1]. `face`는 같은 식으로 `head`다. 시트가 바뀌면
// src/engine/sprites.test.ts가 맞출 숫자를 알려 준다. core는 Node 도구(BFS 검사·재생)에서도 돌아서 json을 직접 읽지 않는다.
// 새 캐릭터를 시트 없이 넣을 때는 히트 박스가 MIN_HIT_SIZE 이상이어야 한다(실루엣이 히트 박스 높이를 다 쓴다).
export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'jjuk', ability: 'stretch', hit: { dx: -13, dy: -64, width: 28, height: 64 }, face: { dx: -12, dy: -64, width: 24, height: 24 } },
  { id: 'mukjik', ability: 'stomp', hit: { dx: -22, dy: -61, width: 39, height: 61 }, face: { dx: -15, dy: -62, width: 24, height: 24 } },
  { id: 'ppik', ability: 'squeak', hit: { dx: -14, dy: -50, width: 33, height: 50 }, face: { dx: -13, dy: -49, width: 24, height: 24 } },
];

export function characterDef(id: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === id);
  if (!def) throw new Error(`알 수 없는 캐릭터: ${id}`);
  return def;
}

/** 기준점 상자를 발 위치·방향에 놓는다. 왼쪽을 볼 때는 기준점(anchorX) 축으로 뒤집는다. */
function placeBox({ dx, dy, width, height }: RelBox, x: number, y: number, facing: Facing): HitBox {
  const fx = Math.round(x);
  const fy = Math.round(y);
  const left = facing === 1 ? fx + dx : fx - (dx + width);
  return { left, top: fy + dy, width, height };
}

/** 발 위치와 보는 방향으로 히트 영역(몸)을 만든다. */
export function characterHitBox(def: CharacterDef, x: number, y: number, facing: Facing): HitBox {
  return placeBox(def.hit, x, y, facing);
}

/** 발 위치와 보는 방향으로 얼굴 상자를 만든다(설계 2-1절). 몸 상자와 같은 뒤집기 규칙이다. */
export function characterFaceBox(def: CharacterDef, x: number, y: number, facing: Facing): HitBox {
  return placeBox(def.face, x, y, facing);
}
