// 말풍선 위치 계산(#329). 순수 함수만 둔다. 좌표는 전부 화면 CSS px다.
// 예전 방식(`position: fixed` + `left = 화자 x` + `translate(-50%)`)은 자동 폭이 `뷰포트 폭 − left`에 묶여서
// 오른쪽 화자일수록 말풍선이 좁게 접히고, 위쪽 화자는 화면 위로 잘렸다. 이제 폭은 글로만 정하고(main.ts가 잰다),
// 위치는 여기서 게임 화면 안으로 민다.

import type { Rect, Size } from './viewport';

/** 말풍선을 붙일 화자. x는 가운데, top은 머리 위끝, bottom은 발끝(화면 CSS px). */
export interface BubbleAnchor {
  x: number;
  top: number;
  bottom: number;
}

export interface BubbleOptions {
  /** 게임 화면 가장자리와 말풍선 사이 최소 틈. */
  margin: number;
  /** 머리(또는 발)와 말풍선 사이 틈. 꼬리가 이 안에 들어간다. */
  gap: number;
  /** 꼬리가 말풍선 모서리 둥근 곳에 걸리지 않게 좌우 끝에서 띄우는 거리. */
  tailInset: number;
  /** 피할 상자(목표 줄·HUD 이름표, #351)와 말풍선 사이 최소 틈. 없으면 0. */
  avoidGap?: number;
}

export interface BubblePlacement {
  left: number;
  top: number;
  /** true면 화자 위에 자리가 없어 발 아래로 뒤집었다. 꼬리는 위를 향한다. */
  below: boolean;
  /** 꼬리 끝 x(말풍선 왼쪽 끝 기준). 밀려도 꼬리는 화자를 가리킨다. */
  tailX: number;
}

/** 말풍선 최대 폭: 게임 화면 폭에서 양쪽 틈을 뺀 것. 이 안에서는 작가 줄바꿈(`\n`)에서만 줄이 바뀐다. */
export function bubbleMaxWidth(bounds: Rect, opts: Pick<BubbleOptions, 'margin'>): number {
  return Math.max(0, Math.floor(bounds.width - opts.margin * 2));
}

/** 말풍선 글자 크기(CSS px): 내부 9px × 화면 CSS 배율, 최소 16(ui-interaction 6-5절). 카드·HUD 이름표와 같은 꼴. */
export function bubbleFontPx(scale: number): number {
  return Math.max(16, Math.round(9 * scale));
}

/**
 * 꼬리를 말풍선 좌우 끝에서 띄우는 거리(CSS px) = 0.875em(16px에서 14).
 * 꼬리(45° 10px 네모)는 `tailX ± 7px`를 덮는데 모서리는 `0.625em`으로 글자와 같이 커진다.
 * 14px 고정이면 36px(4배)에서 모서리 반경 22.5가 꼬리 밑을 6px 깎아 바탕색 모서리가 테두리 밖으로 삐져나온다.
 */
export function bubbleTailInset(fontPx: number): number {
  return Math.round(0.875 * fontPx);
}

function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? lo : Math.min(hi, Math.max(lo, v));
}

/** 두 상자가 `gap`보다 가까운가(닿거나 겹침). 틈이 정확히 `gap`이면 겹치지 않은 것으로 본다. */
function tooClose(a: Rect, b: Rect, gap: number): boolean {
  return a.left < b.left + b.width + gap && b.left < a.left + a.width + gap
    && a.top < b.top + b.height + gap && b.top < a.top + a.height + gap;
}

/**
 * 피할 상자(#351, 설계 6-5절)를 **오른쪽으로만** 밀어서 피한다. 겹친 상자의 오른쪽 끝 + 틈으로 옮기고, 옮긴 자리에서
 * 다른 상자와 또 겹치면 다시 민다(목표 줄 → 얼굴 이름표 순으로 부딪칠 수 있다). 화면 오른쪽 끝을 넘거나 꼬리가
 * `tailInset` 밖으로 나가야 하면(화자를 못 가리키면) null.
 */
function pushRight(left: number, top: number, anchorX: number, size: Size, maxLeft: number, avoid: readonly Rect[], gap: number, tailInset: number): number | null {
  for (let i = 0; i <= avoid.length; i++) {
    const box = { left, top, width: size.width, height: size.height };
    const hit = avoid.find((a) => tooClose(box, a, gap));
    if (!hit) return left;
    // 정수 CSS px로 올린다. main.ts가 left를 반올림하므로 소수면 틈이 0.5px 모자랄 수 있다.
    left = Math.ceil(hit.left + hit.width + gap);
    if (left > maxLeft || anchorX - left < tailInset) return null;
  }
  return null;
}

/**
 * 화자 머리 위 가운데에 놓고, 좌우는 게임 화면 안으로 민다.
 * 피할 상자(`avoid`, 목표 줄·HUD 이름표)와 `avoidGap`보다 가까우면 오른쪽으로 밀고, 못 밀면 발 아래로 뒤집는다(#351).
 * 위가 넘쳐도 발 아래로 뒤집고, 아래도 넘치면(화면보다 키 큰 화자는 없지만) 화면 안으로 끌어온다.
 */
export function placeBubble(anchor: BubbleAnchor, size: Size, bounds: Rect, opts: BubbleOptions, avoid: readonly Rect[] = []): BubblePlacement {
  const gap = opts.avoidGap ?? 0;
  const minLeft = bounds.left + opts.margin;
  const maxLeft = bounds.left + bounds.width - opts.margin - size.width;
  const centred = clamp(anchor.x - size.width / 2, minLeft, maxLeft);

  const minTop = bounds.top + opts.margin;
  const maxTop = bounds.top + bounds.height - opts.margin - size.height;
  const aboveTop = anchor.top - opts.gap - size.height;
  const aboveLeft = aboveTop < minTop ? null : pushRight(centred, aboveTop, anchor.x, size, maxLeft, avoid, gap, opts.tailInset);
  const below = aboveLeft === null;
  let left = aboveLeft ?? centred;
  const top = clamp(below ? anchor.bottom + opts.gap : aboveTop, minTop, maxTop);
  // 뒤집은 자리에서도 피해 본다. 거기서도 못 피하면 가운데 그대로 둔다(더 갈 곳이 없다).
  if (below) left = pushRight(centred, top, anchor.x, size, maxLeft, avoid, gap, opts.tailInset) ?? centred;

  const tailX = clamp(anchor.x - left, opts.tailInset, size.width - opts.tailInset);
  return { left, top, below, tailX };
}
