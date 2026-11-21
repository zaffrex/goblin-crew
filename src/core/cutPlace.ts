// 클리어 컷·클리어 카드 자리 (#662). 순수 함수만 둔다.
// 예전에는 CSS `left/top: 50%`(창 가운데)였다. 휴대폰 가로 667×375는 캔버스가 창 세로 가운데가 아니라(위 26px, 아래 79px)
// 상자가 게임 화면 가운데보다 26px 아래에 떴고, 1.0배라 상자가 내부 79px로 커서 열쇠를 든 노비 머리·손을 덮었다.

import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './config';
import type { HitBox } from './hit';
import type { Point } from './viewport';

/** 상자 아래끝과 그 아래 캐릭터 머리 사이 틈(내부 px). */
export const CUT_GAP = 4;
/** 위로 올려도 이 위로는 안 간다(내부 px). 목표 줄 자리(`GOAL_AT` y 4)와 같다. 클리어 동안 목표 줄은 숨는다. */
export const CUT_MIN_TOP = 4;

/**
 * 컷 상자 가운데 점(내부 px). 기본은 게임 화면 가운데다.
 * 그 자리 상자가 캐릭터 몸 상자와 겹치면, 가로로 겹치는 캐릭터 중 가장 높은 머리의 `CUT_GAP` 위로 아래끝을 올린다.
 * 그래도 `CUT_MIN_TOP`을 넘으면 거기서 멈춘다(그때는 겹침을 받아들인다. 글이 화면 밖으로 나가는 것보다 낫다).
 * 가로 가운데는 그대로 둔다. 좌우로 밀면 긴 글이 화면 끝에 붙고, 캐릭터는 대개 바닥에 서 있어 위가 비어 있다.
 *
 * @param size 상자 크기(내부 px). 글자 크기가 배율마다 달라서(`cutFontPx`) 부르는 쪽이 DOM에서 재서 넘긴다.
 * @param cast 캐릭터 몸 상자(`sceneLayout().chars`).
 */
export function cutCenter(size: { width: number; height: number }, cast: readonly HitBox[]): Point {
  const x = INTERNAL_WIDTH / 2;
  const mid = INTERNAL_HEIGHT / 2;
  const left = x - size.width / 2;
  const right = x + size.width / 2;
  const across = cast.filter((c) => c.left < right && left < c.left + c.width);
  let top = mid - size.height / 2;
  // 올린 자리에서 더 높은 캐릭터(선반 위 등)와 또 겹치면 그 머리 위로 다시 올린다. 캐릭터 수만큼이면 끝난다.
  for (let i = 0; i <= across.length; i++) {
    const bottom = top + size.height;
    const hit = across.filter((c) => c.top - CUT_GAP < bottom && top < c.top + c.height);
    if (hit.length === 0) break;
    top = Math.min(...hit.map((c) => c.top)) - CUT_GAP - size.height;
    if (top <= CUT_MIN_TOP) {
      top = CUT_MIN_TOP;
      break;
    }
  }
  return { x, y: top + size.height / 2 };
}
