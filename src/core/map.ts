// 깬 판 맵의 자리·썸네일·잠금 줄 판단(#792 3/3, 설계 `docs/design/title-and-map.md` 3절). DOM·캔버스를 모른다.
// 어느 카드가 깸/잠금인지, 누르면 무엇을 하는지는 `title.ts` `mapCards`·`mapPress`다. 여기는 그리는 숫자만.

/** 3절 표(내부 px). 목업 `docs/design/title-map-mock.mjs` `MAP`과 같은 숫자다. */
export const MAP_LAYOUT = {
  back: { x: 8, y: 8, w: 72, h: 28 },
  card: { w: 128, h: 100, y: 76, xs: [24, 176, 328] },
  thumb: { dx: 4, dy: 4, w: 120, h: 68 },
  name: { dy: 78, h: 16 },
  /** 깸 도장 보이는 16×16(외곽선 포함). 썸네일 오른쪽 위에서 2px 안쪽. */
  stamp: { size: 16, inset: 2 },
  /** 잠긴 카드 `？` 가운데. 썸네일 가운데와 같다. */
  locked: { y: 200, h: 14, w: 280 },
  pathY: 126,
  /** 길 점 2×2, 6px 간격(3절 표). */
  dot: { size: 2, step: 6 },
} as const;

/** BOSONG-32 번호(3절 표 "0번 ink" 등). */
export const MAP_COLORS = { ink: 0, plum: 1, dusk: 2, lav: 3, lint: 4, cotton: 5, yel: 15 } as const;

/** 잠긴 카드 썸네일 위 ink 덮개(3-1절). 단서가 안 읽히는 진하기. */
export const MAP_LOCKED_DIM = 0.8;

/** 잠금 안내 줄이 떠 있는 시간(ms, 3-2절). 다른 잠긴 카드를 누르면 다시 센다. */
export const MAP_LOCKED_MS = 2000;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * `k`번째 카드 상자(배포 순서 왼쪽 → 오른쪽). 카드 자리는 3개뿐이다(3절 표).
 * 4번째 판이 생기면 null. 그 판은 지금 그릴 자리가 없으니 맵이 아니라 설계(동네 지도 2단계)부터 다시 본다.
 */
export function mapCardBox(k: number): Box | null {
  const c = MAP_LAYOUT.card;
  const x = c.xs[k];
  return x === undefined ? null : { left: x, top: c.y, width: c.w, height: c.h };
}

/** 카드 안 썸네일 상자(내부 px). */
export function mapThumbBox(card: Box): Box {
  const t = MAP_LAYOUT.thumb;
  return { left: card.left + t.dx, top: card.top + t.dy, width: t.w, height: t.h };
}

/**
 * 깸 도장 시트 칸(20×20)을 놓을 왼쪽 위. 보이는 16×16이 썸네일 오른쪽 위 2px 안쪽에 오고,
 * 칸은 보이는 자리보다 (2, 2) 앞에서 시작한다(3-1절 "칸을 (sx − 2, sy − 2)에").
 */
export function mapStampAt(card: Box): { x: number; y: number } {
  const th = mapThumbBox(card);
  const { size, inset } = MAP_LAYOUT.stamp;
  const sx = th.left + th.width - size - inset;
  const sy = th.top + inset;
  return { x: sx - 2, y: sy - 2 };
}

/**
 * 길 점 왼쪽 위 x들(y는 `pathY`). 첫 카드 오른쪽부터 마지막 카드까지 6px마다, 카드(양옆 2px 포함) 위는 뺀다.
 * 마지막 카드 오른쪽으로는 잇지 않는다. 끝 카드가 `おしまい！`인데 길이 화면 밖으로 이어지면 둘이 반대로 말한다(3절 표, #792).
 * "더 있다"는 잠긴 카드가 맡는다(3-1절). 목업과 같은 셈이다.
 */
export function mapPathDots(cards: readonly Box[], width: number): number[] {
  const first = cards[0];
  if (!first) return [];
  const end = Math.min(width, Math.max(...cards.map((c) => c.left + c.width)));
  const out: number[] = [];
  for (let x = 0; x < end; x += MAP_LAYOUT.dot.step) {
    if (x <= first.left) continue;
    if (cards.some((c) => x >= c.left - 2 && x < c.left + c.width + 2)) continue;
    out.push(x);
  }
  return out;
}

/**
 * 썸네일 자르는 자리(3-3절): 그 판 시작 상태 장면의 왼쪽 위. 숫자는 `content/map.json` 한 곳에만 둔다(화면 데이터 밖).
 * 없거나 틀리면 `origin` null → 썸네일 자리를 dusk 한 색으로 칠한다(그림 전 화면과 같은 모양). 틀린 값은 `error`로 알린다(엔진이 경고).
 */
export function thumbOrigin(raw: unknown, screenId: string, scene: { width: number; height: number }): { origin: { x: number; y: number } | null; error: string | null } {
  const table = (raw as { thumbOrigin?: Record<string, unknown> } | null)?.thumbOrigin;
  const v = table?.[screenId];
  if (v === undefined) return { origin: null, error: null };
  const t = MAP_LAYOUT.thumb;
  const ok =
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => Number.isInteger(n)) &&
    (v[0] as number) >= 0 &&
    (v[1] as number) >= 0 &&
    (v[0] as number) + t.w <= scene.width &&
    (v[1] as number) + t.h <= scene.height;
  if (!ok) return { origin: null, error: `content/map.json thumbOrigin.${screenId}: [x, y] 정수이고 ${t.w}×${t.h}가 화면 안에 들어가야 합니다` };
  return { origin: { x: v[0] as number, y: v[1] as number }, error: null };
}

/** 잠금 안내 줄이 지금 떠 있나. `since`는 마지막으로 잠긴 카드를 누른 시각(ms), 없으면 null. */
export function mapLockedShown(since: number | null, now: number): boolean {
  return since !== null && now - since < MAP_LOCKED_MS;
}

/** 맵이 쓰는 글 키(설계 4절). 판 이름은 `<id>.map.name`. */
export const MAP_TEXT_KEYS = { back: 'ui.map.back', locked: 'ui.map.locked', button: 'ui.title.map' } as const;

/**
 * 맵 글이 다 있나. 없으면 타이틀에서 `マップ`를 뺀다(키 이름이 버튼·카드에 찍히는 판이 기본 링크로 나가지 않게).
 * 카드 자리(3개)보다 판이 많아도 뺀다(`mapCardBox` null).
 */
export function mapReady(text: Readonly<Record<string, string>>, order: readonly string[]): boolean {
  const has = (k: string): boolean => typeof text[k] === 'string' && text[k] !== '';
  return Object.values(MAP_TEXT_KEYS).every(has) && order.every((id, k) => has(`${id}.map.name`) && mapCardBox(k) !== null);
}
