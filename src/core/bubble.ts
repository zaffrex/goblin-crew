// 말풍선 위치 계산(#329). 순수 함수만 둔다. 좌표는 전부 화면 CSS px다.
// 예전 방식(`position: fixed` + `left = 화자 x` + `translate(-50%)`)은 자동 폭이 `뷰포트 폭 − left`에 묶여서
// 오른쪽 화자일수록 말풍선이 좁게 접히고, 위쪽 화자는 화면 위로 잘렸다. 이제 폭은 글로만 정하고(main.ts가 잰다),
// 위치는 여기서 게임 화면 안으로 민다.

import type { Rect, Size } from './viewport';

/**
 * 말풍선을 붙일 화자. x는 가운데, top은 머리 위끝, bottom은 발끝(화면 CSS px).
 * left·right는 몸 상자 좌우 끝(#356 옆 배치). 없으면 옆에는 두지 않는다.
 */
export interface BubbleAnchor {
  x: number;
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  /**
   * 화자 얼굴 상자(#967·#970, 화면 CSS px). 있으면 말풍선이 화자 얼굴을 덮는 자리를 가장 비싸게 친다(`coverCost` 맨 앞).
   * 대사가 떠 있는 동안 말하는 사람 표정이 개그의 반이다. 물건 화자(anim 칸)는 없다.
   */
  face?: Rect;
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
  /** 꼬리 끝 x(말풍선 왼쪽 끝 기준). 밀려도 꼬리는 화자를 가리킨다. 옆 배치면 쓰지 않는다. */
  tailX: number;
  /**
   * 옆 배치(#356): 위·아래에 두면 물건(`keep`)을 가려서 화자 오른쪽(`right`) 또는 왼쪽(`left`) 옆에 뒀다.
   * 꼬리는 화자 쪽 세로 변에서 나오고 높이는 `tailY`(말풍선 위끝 기준). 위·아래 배치면 둘 다 없다.
   */
  side?: 'left' | 'right';
  tailY?: number;
}

/**
 * 말풍선이 놓일 수 있는 영역(#601 묶음 1-1 `r2-b.png`): 게임 화면에서 **아래 라벨 줄 + 게이지 띠**를 뺀 것.
 * 예전에는 게임 화면 전체여서, 발 아래로 뒤집힌 바닥 화자 말풍선이 아래끝까지 밀려 게이지 막대와 첫 감소 안내
 * (`ゲージが1マス減った！…`)를 함께 덮었다. 첫 감소는 다치는 실패의 첫 말풍선과 같은 순간이라 늘 겹친다.
 * `labelBottom`은 라벨 아래끝(화면 CSS px), `labelFontPx`는 라벨 글자 크기. 라벨 높이 = 줄 높이 1.3em + 위아래 여백 0.15em×2
 * (index.html `#label`). 라벨이 안 떠 있어도 자리는 비워 둔다: 호버 라벨이 뜰 때마다 말풍선이 뛰지 않게.
 */
export function bubbleBounds(game: Rect, labelBottom: number, labelFontPx: number): Rect {
  const floor = Math.floor(labelBottom - labelFontPx * 1.6);
  return { left: game.left, top: game.top, width: game.width, height: Math.max(0, Math.min(game.height, floor - game.top)) };
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

/** 두 상자가 1px이라도 겹치나. 맞닿기만 하면 겹치지 않은 것이다. */
function overlaps(a: Rect, b: Rect): boolean {
  return tooClose(a, b, 0);
}

/**
 * 옆 배치(#356, 설계 6-5절): 말풍선 세로 변을 몸 상자 옆 `gap`에 붙이고, 위끝은 머리 위끝에 맞춘다(꼬리가 머리를 가리킨다).
 * 아래가 넘치면 화면 안으로 올리되 꼬리가 몸 높이를 벗어나면(화자를 못 가리키면) 포기한다. 화면 좌우를 넘거나 피할 상자·
 * `blockers`(물건 + 다른 사람 몸)와 겹쳐도 null. 옆에서는 밀지 않는다: 밀면 꼬리가 화자에서 떨어진다.
 * `blockers`를 비워 부르면 놓을 수 있는 자리인지만 본다(#598 가장 덜 덮는 자리 후보).
 */
function sideBubble(side: 'left' | 'right', anchor: BubbleAnchor, size: Size, bounds: Rect, opts: BubbleOptions, avoid: readonly Rect[], blockers: readonly Rect[]): BubblePlacement | null {
  const edge = side === 'right' ? anchor.right : anchor.left;
  if (edge === undefined) return null;
  const left = side === 'right' ? Math.ceil(edge + opts.gap) : Math.floor(edge - opts.gap - size.width);
  if (left < bounds.left + opts.margin || left + size.width > bounds.left + bounds.width - opts.margin) return null;
  const top = clamp(anchor.top, bounds.top + opts.margin, bounds.top + bounds.height - opts.margin - size.height);
  const tailY = Math.max(opts.tailInset, anchor.top - top + opts.tailInset);
  if (tailY > size.height - opts.tailInset || top + tailY > anchor.bottom) return null;
  const box = { left, top, width: size.width, height: size.height };
  const gap = opts.avoidGap ?? 0;
  if (avoid.some((a) => tooClose(box, a, gap)) || blockers.some((k) => overlaps(box, k))) return null;
  return { left, top, below: false, tailX: opts.tailInset, side, tailY };
}

/**
 * 말풍선이 가리면 안 되는 물건(#356). `toy`면 장난감(화면 JSON에 `hintAbility`가 없는 핫스팟, #598 Luna):
 * 반응 그림이 대사보다 먼저 끝나서 말풍선이 덮어도 잃는 게 적다. 다 막혔을 때 고르는 순서에서 가장 뒤로 간다.
 */
export interface KeepBox extends Rect {
  toy?: boolean;
}

/** 상자 `k`가 말풍선에 가려진 비율(0~1). 넓이가 아니라 비율이라 작은 물건을 통째로 덮는 자리가 가장 비싸다(#598). */
function coveredRatio(box: Rect, k: Rect): number {
  const w = Math.min(box.left + box.width, k.left + k.width) - Math.max(box.left, k.left);
  const h = Math.min(box.top + box.height, k.top + k.height) - Math.max(box.top, k.top);
  const area = k.width * k.height;
  return w <= 0 || h <= 0 || area <= 0 ? 0 : (w * h) / area;
}

/**
 * 자리의 값(#598, #967). [화자 얼굴, 단서 물건, 다른 사람 몸, 장난감] 순으로 가려진 비율의 합. 앞 칸부터 비교한다.
 * 화자 얼굴을 조금이라도 덜 덮는 자리가 이기고(#967·#970 Luna: 화자 얼굴 > 단서 > 동료 몸 > 장난감), 같으면 단서,
 * 그다음 동료 얼굴, 그다음 장난감이다. 얼굴 상자가 없는 화자(물건)는 첫 칸이 늘 0이라 예전 순서 그대로다.
 */
function coverCost(p: BubblePlacement, size: Size, keep: readonly KeepBox[], bodies: readonly Rect[], face: Rect | undefined): [number, number, number, number] {
  const box = { left: p.left, top: p.top, width: size.width, height: size.height };
  const sum = (list: readonly Rect[]): number => list.reduce((acc, k) => acc + coveredRatio(box, k), 0);
  return [face ? coveredRatio(box, face) : 0, sum(keep.filter((k) => !k.toy)), sum(bodies), sum(keep.filter((k) => k.toy))];
}

/**
 * 물건 하나의 10% 미만 차이는 같다고 본다(같으면 앞 후보 = 처음 자리). 둘 다 비슷하게 덮을 때 머리 위 자리를 버리고
 * 발 아래로 가 봐야 얻는 게 없고, 걷는 중 1px 차이로 자리가 프레임마다 뒤바뀌지도 않게 한다.
 */
const COST_EPS = 0.1;

function cheaper(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]! - COST_EPS) return true;
    if (a[i]! > b[i]! + COST_EPS) return false;
  }
  return false;
}

/**
 * 화자 머리 위 가운데에 놓고, 좌우는 게임 화면 안으로 민다.
 * 피할 상자(`avoid`, 목표 줄·HUD 이름표)와 `avoidGap`보다 가까우면 오른쪽으로 밀고, 못 밀면 발 아래로 뒤집는다(#351).
 * 위가 넘쳐도 발 아래로 뒤집고, 아래도 넘치면(화면보다 키 큰 화자는 없지만) 화면 안으로 끌어온다.
 * 그렇게 놓은 자리가 가리면 안 되는 물건(`keep`, 화면의 다른 핫스팟)과 겹치면 화자 오른쪽 → 왼쪽 옆에 둔다(#356).
 * 옆 자리는 물건에 더해 다른 사람 몸(`bodies`)과도 겹치면 안 된다. 바닥에서는 옆에 동료가 서 있어서, 물건 대신 동료 얼굴을
 * 가리게 된다.
 * 옆에도 빈자리가 없고 처음 자리가 단서 물건(`toy`가 아닌 것)을 덮으면(#598) 처음 자리·오른쪽 옆·왼쪽 옆·위아래 뒤집은
 * 자리 가운데 **가장 덜 덮는 자리**를 고른다(`coverCost`: 단서 → 동료 몸 → 장난감 순, 같으면 앞 후보).
 * 예전에는 처음 자리로 돌아가서 휴대폰에서 아하 결과를 덮었다. 장난감만 덮으면 예전처럼 처음 자리다.
 * 처음 자리가 **화자 자기 얼굴**(`anchor.face`)을 덮어도(#967·#970) 같은 후보 비교로 간다. 바닥 화자는 발 아래 자리가
 * 라벨 줄 위로 끌려 올라와(`bubbleBounds`) 사실상 자기 몸·얼굴 위에 놓이기 때문이다.
 */
export function placeBubble(anchor: BubbleAnchor, size: Size, bounds: Rect, opts: BubbleOptions, avoid: readonly Rect[] = [], keep: readonly KeepBox[] = [], bodies: readonly Rect[] = []): BubblePlacement {
  const base = placeAboveOrBelow(anchor, size, bounds, opts, avoid);
  const box = { left: base.left, top: base.top, width: size.width, height: size.height };
  const coversFace = anchor.face !== undefined && overlaps(box, anchor.face);
  if (!coversFace && !keep.some((k) => overlaps(box, k))) return base;
  const blockers = [...keep, ...bodies];
  const side = sideBubble('right', anchor, size, bounds, opts, avoid, blockers) ?? sideBubble('left', anchor, size, bounds, opts, avoid, blockers);
  if (side) return side;
  // 장난감만 덮으면 예전처럼 처음 자리(#598). 장난감은 반응이 대사보다 먼저 끝나고, 화면 1 배포 판(진마씨 재플레이)의
  // 바닥 장면 자리를 바꾸지 않는다.
  if (!coversFace && !keep.some((k) => !k.toy && overlaps(box, k))) return base;

  const candidates = [
    sideBubble('right', anchor, size, bounds, opts, avoid, []),
    sideBubble('left', anchor, size, bounds, opts, avoid, []),
    placeAboveOrBelow(anchor, size, bounds, opts, avoid, !base.below),
  ];
  let best = base;
  let bestCost = coverCost(base, size, keep, bodies, anchor.face);
  for (const c of candidates) {
    if (!c) continue;
    const cost = coverCost(c, size, keep, bodies, anchor.face);
    if (cheaper(cost, bestCost)) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * 위·아래 자리. `forceBelow`를 주면(#598 뒤집은 자리 후보) 위가 비어도 아래로(true), 또는 위로(false) 둔다.
 * 위로 강제했는데 위가 화면 밖이거나 피할 상자를 못 피하면 null. 주지 않으면 예전 규칙(위 → 못 두면 아래).
 */
function placeAboveOrBelow(anchor: BubbleAnchor, size: Size, bounds: Rect, opts: BubbleOptions, avoid: readonly Rect[]): BubblePlacement;
function placeAboveOrBelow(anchor: BubbleAnchor, size: Size, bounds: Rect, opts: BubbleOptions, avoid: readonly Rect[], forceBelow: boolean): BubblePlacement | null;
function placeAboveOrBelow(anchor: BubbleAnchor, size: Size, bounds: Rect, opts: BubbleOptions, avoid: readonly Rect[], forceBelow?: boolean): BubblePlacement | null {
  const gap = opts.avoidGap ?? 0;
  const minLeft = bounds.left + opts.margin;
  const maxLeft = bounds.left + bounds.width - opts.margin - size.width;
  const centred = clamp(anchor.x - size.width / 2, minLeft, maxLeft);

  const minTop = bounds.top + opts.margin;
  const maxTop = bounds.top + bounds.height - opts.margin - size.height;
  const aboveTop = anchor.top - opts.gap - size.height;
  if (forceBelow === false && aboveTop < minTop) return null;
  const aboveLeft = aboveTop < minTop || forceBelow === true ? null : pushRight(centred, aboveTop, anchor.x, size, maxLeft, avoid, gap, opts.tailInset);
  // 위로 강제했는데 피할 상자를 못 피하면 후보가 아니다(목표 줄·이름표는 덮지 않는다).
  if (forceBelow === false && aboveLeft === null) return null;
  const below = forceBelow ?? aboveLeft === null;
  let left = aboveLeft ?? centred;
  const top = clamp(below ? anchor.bottom + opts.gap : aboveTop, minTop, maxTop);
  // 뒤집은 자리에서도 피해 본다. 거기서도 못 피하면 가운데 그대로 둔다(더 갈 곳이 없다).
  if (below) left = pushRight(centred, top, anchor.x, size, maxLeft, avoid, gap, opts.tailInset) ?? centred;

  const tailX = clamp(anchor.x - left, opts.tailInset, size.width - opts.tailInset);
  return { left, top, below, tailX };
}
