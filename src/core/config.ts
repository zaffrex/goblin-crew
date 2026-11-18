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

// 임시 바닥 영역 (#35). M1에서는 화면 데이터(퍼즐 데이터 모델)로 옮긴다.
// 아래끝 252: 맨 아래 게이지 띠(y 256–269, #312 설계 6-3-5절) 위로 발을 올린다. 그림 아래끝과 띠 사이 잔디 3px.
export const WALK_AREA = { left: 16, top: 200, right: 463, bottom: 252 } as const;
