// 내부(논리) 해상도. #7(아트 ADR)에서 Luna가 확정하기 전까지의 가정값이다.
export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

// 코어 시뮬레이션 틱. 코어는 step() 호출 횟수로만 시간을 안다 (ADR-0004 결정 2).
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
