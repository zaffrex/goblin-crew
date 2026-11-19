import type { Action } from '../../../src/core/puzzle/types.ts';

/** `frames.ts` 한 사례. 사례 ID는 결과 폴더 이름이 된다(`[a-z0-9_-]`). */
export interface FrameCase {
  id: string;
  /** 모음 그림에서 사람이 볼 것. 설계 문서 절·단서 번호를 같이 적는다. */
  why: string;
  /** 찍을 행동. 마지막 탭부터 찍는다. 없으면 시작 카드를 닫은 순간부터 찍는다(진입 연출·대기 동작). */
  action?: Action;
  /** 찍기 전에 끝까지 돌려 두는 행동(예: 판에 태우기, 물 끄기). 실제 클릭으로 누른다. */
  pre?: Action[];
  /** 이 사례에서 떠야 하는 대사 키. `cases.test.ts`가 Chrome 없이 `scene.ts`로 확인한다. */
  says?: string;
  /** 연출이 일찍 끝나도 이만큼(ms)은 찍는다. 대기 동작(약 12~15초 주기)용. */
  minMs?: number;
  /** 이 사례만 찍는 간격(ms). 긴 대기 사례에서 프레임 수를 줄인다. */
  every?: number;
}
