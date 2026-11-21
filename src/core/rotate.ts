// 세로 화면 안내(설계 ui-interaction.md 9절, #624). 작은 세로 화면에서는 게임 위를 불투명하게 덮고 "가로로" 안내만 보인다.
// 안내는 JS보다 먼저 보여야 해서 `index.html`에 직접 있다(글·아이콘·CSS). 이 파일은 그 원본(쿼리·아이콘 격자)과
// 떠 있는 동안 멈추는 시계를 둔다. `rotate.test.ts`가 index.html이 이 원본과 같은지 본다.

/**
 * 9-1절: 세로이고 너비가 667 CSS px 미만. CSS(`index.html` `@media`)와 JS(`matchMedia`)가 이 문자열 하나를 쓴다.
 * 667은 지원하는 가장 작은 가로 화면(667×375)의 너비다. 세로 모니터·태블릿 세로는 걸리지 않는다.
 */
export const ROTATE_QUERY = '(orientation: portrait) and (max-width: 666px)';

/** 9-3절 팔레트(보송 32색 중). 격자 글자 → 색. */
export const ROTATE_COLORS: Readonly<Record<string, string>> = {
  o: '#b9adb5', // 4 lint: 휴대폰 테두리
  b: '#5e5068', // 2 dusk: 몸통
  s: '#5a93a8', // 25: 화면
  h: '#d8f0ee', // 27: 화면 반사광
  y: '#f2d65c', // 15: 화살표
  d: '#b8953a', // 14: 화살표 그늘
};

const SCREEN_ROW = 'obssssssssbo';
/** 휴대폰 12×20(세로). 화면 13줄 = 위 3줄(반사광 포함) + 같은 줄 10번. */
export const ROTATE_PHONE: readonly string[] = [
  '.oooooooooo.',
  'obbbboobbbbo',
  'obbbbbbbbbbo',
  SCREEN_ROW,
  'obshhsssssbo',
  'obhsssssssbo',
  ...Array<string>(10).fill(SCREEN_ROW),
  'obbbbbbbbbbo',
  'obbbboobbbbo',
  'obbbbbbbbbbo',
  '.oooooooooo.',
];

/** 화살표 12×10(시계 방향, 촉이 아래). */
export const ROTATE_ARROW: readonly string[] = [
  '.yyyyyy.....',
  'yyyyyyyy....',
  'dd....yyy...',
  '.......yy...',
  '.......yy...',
  '.......yy...',
  '....yyyyyyyy',
  '.....yyyyyy.',
  '......yyyy..',
  '.......dd...',
];

/** 아이콘 상자(내부 px)와 CSS 배율(4배 고정, 9-3절). */
export const ROTATE_BOX = { width: 30, height: 22 } as const;
export const ROTATE_ICON_SCALE = 4;
const PHONE_AT = { x: 4, y: 2 };
const ARROW_AT = { x: 18, y: 0 };

/** 격자를 시계 방향으로 90° 돌린다. (열 c, 줄 r) → (열 h−1−r, 줄 c). 90°라 픽셀이 그대로 옮겨진다. */
export function rotateGridCW(grid: readonly string[]): string[] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out: string[] = [];
  for (let c = 0; c < w; c++) {
    let row = '';
    for (let r = h - 1; r >= 0; r--) row += grid[r]![c]!;
    out.push(row);
  }
  return out;
}

/**
 * 격자를 색별 `<path>`로 만든다. 같은 줄의 같은 색 칸을 이은 뒤, 위아래로 같은 자리·폭이면 한 사각형으로 합친다
 * (미리보기 SVG 32KB → 1~2KB, 9-3절). 사각형끼리 겹치지 않아 그리는 순서와 상관없다.
 */
export function gridPaths(grid: readonly string[], ox: number, oy: number): string {
  const rects: { ch: string; x: number; y: number; w: number; h: number }[] = [];
  let open = new Map<string, (typeof rects)[number]>();
  grid.forEach((row, y) => {
    const next = new Map<string, (typeof rects)[number]>();
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ROTATE_COLORS[ch]) {
        const key = `${ch}:${x}:${end - x}`;
        const above = open.get(key);
        if (above) above.h++;
        const r = above ?? { ch, x, y, w: end - x, h: 1 };
        if (!above) rects.push(r);
        next.set(key, r);
      }
      x = end;
    }
    open = next;
  });
  return Object.entries(ROTATE_COLORS)
    .map(([ch, fill]) => {
      const d = rects.filter((r) => r.ch === ch).map((r) => `M${ox + r.x} ${oy + r.y}h${r.w}v${r.h}h-${r.w}z`).join('');
      return d ? `<path fill="${fill}" d="${d}"/>` : '';
    })
    .join('');
}

/**
 * index.html `#rotate` 안 아이콘 SVG. 장면 A(세로 휴대폰)·B(휴대폰만 90° 돌림)·화살표 세 묶음이고,
 * 번갈아 보이기는 CSS(`.rot-a`·`.rot-b`)가 한다. 휴대폰을 가운데 축으로 돌리면 (0,6)~(19,17)에 놓인다.
 */
export function rotateIconSvg(): string {
  const phoneB = rotateGridCW(ROTATE_PHONE);
  const cx = PHONE_AT.x + ROTATE_PHONE[0]!.length / 2;
  const cy = PHONE_AT.y + ROTATE_PHONE.length / 2;
  const bAt = { x: cx - phoneB[0]!.length / 2, y: cy - phoneB.length / 2 };
  const { width, height } = ROTATE_BOX;
  return (
    `<svg viewBox="0 0 ${width} ${height}" width="${width * ROTATE_ICON_SCALE}" height="${height * ROTATE_ICON_SCALE}" shape-rendering="crispEdges" aria-hidden="true">` +
    `<g class="rot-a">${gridPaths(ROTATE_PHONE, PHONE_AT.x, PHONE_AT.y)}</g>` +
    `<g class="rot-b">${gridPaths(phoneB, bAt.x, bAt.y)}</g>` +
    `<g>${gridPaths(ROTATE_ARROW, ARROW_AT.x, ARROW_AT.y)}</g>` +
    `</svg>`
  );
}

/**
 * 안내가 떠 있는 동안 멈추는 벽시계(9-5절). 고정 틱은 step을 건너뛰어 멈추지만, 처음부터 버튼 3초(`RESTART_ARM_MS`)는
 * `performance.now()`를 쓰므로 그 시각에서 멈춘 시간을 뺀다.
 */
export interface PauseClock {
  /** 지금까지 다 끝난 멈춤의 합(ms). */
  pausedMs: number;
  /** 지금 멈춤이 시작된 벽시계 시각. 멈춰 있지 않으면 null. */
  since: number | null;
}

export function createPauseClock(): PauseClock {
  return { pausedMs: 0, since: null };
}

/** 멈춤 상태를 정한다. 바뀐 때만 true(멈춤 시작·끝 한 번씩). */
export function setPaused(c: PauseClock, paused: boolean, now: number): boolean {
  if (paused === (c.since !== null)) return false;
  if (paused) c.since = now;
  else {
    c.pausedMs += now - c.since!;
    c.since = null;
  }
  return true;
}

/** 멈춘 시간을 뺀 시각. 멈춰 있는 동안은 멈춘 순간에 머문다. */
export function gameNow(c: PauseClock, now: number): number {
  return (c.since ?? now) - c.pausedMs;
}
