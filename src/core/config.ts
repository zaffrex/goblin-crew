// 내부(논리) 해상도. #7(아트 ADR)에서 Luna가 확정하기 전까지의 가정값이다.
export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

// 코어 시뮬레이션 틱. 코어는 tick() 호출 횟수로만 시간을 안다 (ADR-0004 결정 2).
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

// 걷기 속도: 틱당 1.5px = 초당 90px. 화면 끝에서 끝까지 약 5초.
// 퍼즐 게임은 이동이 길면 지루하므로 #7 이후 실제 걷기 프레임에 맞춰 다시 정한다.
export const WALK_SPEED = 1.5;

// 임시 바닥 영역 (#35). M1에서는 화면 데이터(퍼즐 데이터 모델)로 옮긴다.
export const WALK_AREA = { left: 16, top: 200, right: 463, bottom: 258 } as const;
