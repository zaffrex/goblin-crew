// 내부 해상도 오프스크린 캔버스에 그리고, 화면 캔버스에 nearest-neighbor로 확대해 옮긴다.

import { computeScale, type Rect, type Size } from '../core/viewport';

export interface Display {
  /** 게임은 이 컨텍스트에 내부 해상도 좌표로 그린다. */
  readonly ctx: CanvasRenderingContext2D;
  readonly internal: Size;
  /** 화면 캔버스의 현재 CSS 위치/크기 (입력 좌표 변환용). */
  rect(): Rect;
  /** 오프스크린 버퍼를 화면에 옮긴다. 매 프레임 렌더 끝에 호출한다. */
  present(): void;
  /** 창 크기나 devicePixelRatio가 바뀌면 호출한다. */
  resize(): void;
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다');
  return ctx;
}

export function createDisplay(screen: HTMLCanvasElement, internal: Size): Display {
  const buffer = document.createElement('canvas');
  buffer.width = internal.width;
  buffer.height = internal.height;
  const ctx = get2d(buffer);
  ctx.imageSmoothingEnabled = false;

  const screenCtx = get2d(screen);

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    // 장치 픽셀 기준으로 배율을 정해야 고밀도 화면에서도 픽셀이 고르게 나온다.
    const available = {
      width: Math.floor(window.innerWidth * dpr),
      height: Math.floor(window.innerHeight * dpr),
    };
    const scale = computeScale(available, internal, dpr);
    const deviceW = Math.max(1, Math.round(internal.width * scale));
    const deviceH = Math.max(1, Math.round(internal.height * scale));
    screen.width = deviceW;
    screen.height = deviceH;
    screen.style.width = `${deviceW / dpr}px`;
    screen.style.height = `${deviceH / dpr}px`;
    // 캔버스 크기를 바꾸면 컨텍스트 상태가 초기화되므로 다시 끈다.
    screenCtx.imageSmoothingEnabled = false;
  }

  function present(): void {
    screenCtx.drawImage(buffer, 0, 0, screen.width, screen.height);
  }

  function rect(): Rect {
    const r = screen.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  resize();
  return { ctx, internal, rect, present, resize };
}
