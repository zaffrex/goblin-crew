// 내부 해상도 화면을 실제 창에 맞추는 배율 계산과 좌표 변환. 순수 함수만 둔다.

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 장치 픽셀 기준으로 사용할 수 있는 영역에 내부 해상도를 얼마나 키울지 정한다(돌려주는 값도 장치 픽셀 배율).
 * 창이 CSS 픽셀로 2배 이상 들어가면 정수 배율(픽셀 굵기가 고름), 그보다 작으면(휴대폰 가로 등) 비정수 배율로 꽉 채운다 (ADR-0004 결정 4).
 * "2배"는 CSS 기준으로 잰다. 장치 픽셀로 재면 dpr 2인 844×390 휴대폰이 fit 2.89 → 2로 내려가 CSS 1배(화면 절반)가 된다(#603 10회차).
 */
export function computeScale(available: Size, internal: Size, dpr = 1): number {
  if (available.width <= 0 || available.height <= 0) return 1;
  const fit = Math.min(available.width / internal.width, available.height / internal.height);
  return fit / dpr >= 2 ? Math.floor(fit) : fit;
}

/**
 * 화면(CSS px) 좌표를 내부 픽셀 좌표로 바꾼다. 캔버스 밖이면 null.
 * rect는 캔버스의 getBoundingClientRect() 값이다.
 */
export function screenToInternal(screen: Point, rect: Rect, internal: Size): Point | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((screen.x - rect.left) * internal.width) / rect.width);
  const y = Math.floor(((screen.y - rect.top) * internal.height) / rect.height);
  if (x < 0 || y < 0 || x >= internal.width || y >= internal.height) return null;
  return { x, y };
}

/** screenToInternal의 역함수. 말풍선 같은 DOM 오버레이 위치 계산에 쓴다. 내부 픽셀의 왼쪽 위 모서리를 돌려준다. */
export function internalToScreen(p: Point, rect: Rect, internal: Size): Point {
  return {
    x: rect.left + (p.x * rect.width) / internal.width,
    y: rect.top + (p.y * rect.height) / internal.height,
  };
}
