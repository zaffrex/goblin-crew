// 내부(논리) 해상도. #7(아트 ADR)에서 Luna가 확정하기 전까지의 가정값이다.
export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

// 코어 시뮬레이션 틱. 코어는 tick() 호출 횟수로만 시간을 안다 (ADR-0004 결정 2).
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

// 한 프레임에 따라잡는 최대 틱 수. 15틱 = 250ms: 4fps까지 느려져도 게임 시간이 벽시계와 같다(#286 4번 (b),
// `scripts/playtest/pace.ts` 측정. 예전 5틱(83ms)은 12fps 아래에서 걷기가 느려졌다: CPU ×64 휴대폰 0.4배).
// 그보다 긴 공백(탭 전환, 디버거 멈춤)은 여기서 자르고 버린다(`fixedStep.ts` `consumeFrame`, `engine/loop.ts`). 틱은 그리기 없는 계산이라 15번 돌아도 싸다.
export const MAX_STEPS_PER_FRAME = 15;

// 걷기 속도: 틱당 1.5px = 초당 90px. 화면 끝에서 끝까지 약 5초.
// 퍼즐 게임은 이동이 길면 지루하므로 #7 이후 실제 걷기 프레임에 맞춰 다시 정한다.
export const WALK_SPEED = 1.5;

// 공통 바닥 영역 (#35). 화면 JSON `walkArea`가 없으면 이 값이고, 있으면 이 안으로 줄인다(`walkAreaOf`, #938).
// 아래끝 252: 맨 아래 게이지 띠(y 256–269, #312 설계 6-3-5절) 위로 발을 올린다. 그림 아래끝과 띠 사이 잔디 3px.
export const WALK_AREA = { left: 16, top: 200, right: 463, bottom: 252 } as const;

/**
 * 높은 대상/바닥 대상 기준선(y). 상자 아래 끝이 이 선 위(≤)면 높은 대상이다(`approachPoint` `high`, 비켜 서기 낮은 대상, 배치 검사).
 * 화면별 `walkArea.top`을 따라가지 않는다(#938): 빨래방(top 236)에서 따라가면 아래 끝이 236인 `dryer_3`·`soap_vending`이
 * 높은 대상이 되어 설 곳(옆 → 가운데)과 덕트 뒤 비켜 서기(설계 laundromat.md 2-2 E7)가 바뀐다.
 */
export const HIGH_TARGET_LINE = WALK_AREA.top;

/** 화면 JSON `walkArea`(일부 키만 적어도 된다). 공통 `WALK_AREA` 안으로만 줄일 수 있다(검사 `walk-area`). */
export interface WalkAreaOverride {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

/** 이 화면의 걷기 영역(#938). 화면 JSON `walkArea` 키를 공통 `WALK_AREA` 위에 덮는다. 없으면 `WALK_AREA` 그대로. */
export function walkAreaOf(screen: { walkArea?: WalkAreaOverride }): { left: number; top: number; right: number; bottom: number } {
  return screen.walkArea ? { ...WALK_AREA, ...screen.walkArea } : WALK_AREA;
}
