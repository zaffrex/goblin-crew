// 시작 카드 닫기(#285, ui-interaction.md 6-2-1절). 재생 도구(replay·frames·smoke)가 게임을 연 직후 부른다.
// 카드가 떠 있는 동안 장면은 멈춰 있어서(진입 연출 포함) 닫지 않으면 busy가 영영 안 풀린다.
// 기본 링크(쿼리 없음)에는 카드 앞에 타이틀(#792, title-and-map.md 2절)이 뜬다. 그때는 `はじめ`를 실제로 눌러 지나간다(#885).

import { sleep, type Page } from './cdp.ts';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../src/core/config.ts';
import { LOAD_TIMEOUT_MS } from '../../src/core/restart.ts';
import { TITLE_SECOND_PRESS_MIN_MS } from '../../src/core/title.ts';
import { screenToInternal, type Point, type Rect } from '../../src/core/viewport.ts';

/** 화면 가운데(내부 좌표). 카드가 덮고 있는 자리라 이 탭은 캔버스(게임)에 닿지 않는다. */
export const CARD_TAP = { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT / 2 };

/** 내부 좌표 한 점을 실제 클릭·탭으로 보낸다(도구마다 마우스/터치). */
export type TapAt = (at: Point) => Promise<void>;

type CardState = 'loading' | 'title' | 'none' | 'locked' | 'ready';

const STATE = `(() => {
  // 로딩 화면(#387): 그림이 다 올 때까지 카드가 안 뜬다. 여기서 'none'으로 보면 카드 없는 빌드로 착각한다.
  const l = document.querySelector('#loading');
  if (l && !l.hidden) return 'loading';
  const t = document.querySelector('#title');
  if (t && !t.hidden) return 'title';
  const c = document.querySelector('#card');
  if (!c || c.hidden) return 'none';
  return c.hasAttribute('data-ready') ? 'ready' : 'locked';
})()`;

/** 타이틀 `はじめ` 버튼과 캔버스의 페이지 상자. 타이틀이 안 떠 있으면 null. */
const TITLE_NEW = `(() => {
  const t = document.querySelector('#title');
  const b = t && !t.hidden ? t.querySelector('button[data-button="new"]') : null;
  const g = document.querySelector('#game');
  if (!b || !g) return null;
  const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  return { button: box(b), canvas: box(g), armed: b.hasAttribute('data-armed') };
})()`;

/**
 * 버튼 상자 가운데를 게임 내부 좌표로. 도구는 내부 좌표로 탭을 보내니(`internalToPage`) 게임 입력과 같은 식(`screenToInternal`)으로 되돌린다.
 * 가운데가 캔버스 밖이면 null(그 탭은 버튼에 안 닿을 수 있다).
 */
export function titleTapPoint(button: Rect, canvas: Rect): Point | null {
  return screenToInternal({ x: button.left + button.width / 2, y: button.top + button.height / 2 }, canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
}

async function stateOf(page: Page): Promise<CardState> {
  return page.evaluate<CardState>(STATE);
}

/** 로딩 화면이 사라질 때까지. 게임 쪽 상한(`core/restart.ts` LOAD_TIMEOUT_MS 10초)이 있어서 그만큼 더 기다린다. */
async function waitLoaded(page: Page): Promise<CardState> {
  const deadline = Date.now() + LOAD_TIMEOUT_MS + 2000;
  let s = await stateOf(page);
  while (s === 'loading') {
    if (Date.now() > deadline) throw new Error(`${LOAD_TIMEOUT_MS + 2000}ms 지나도 로딩 화면이 안 사라짐`);
    await sleep(50);
    s = await stateOf(page);
  }
  return s;
}

/**
 * 타이틀이 떠 있으면 `はじめ`를 실제로 눌러 지나가고, 시작 카드가 뜰 때까지 기다린다. 지나갔으면 true.
 * 세이브가 있어 `はじめ`가 확인을 받으면(노랑, 2-3절) 두 번째 누름 하한(`TITLE_SECOND_PRESS_MIN_MS`) 뒤 한 번 더 누른다.
 * 그래서 늘 첫 판 처음부터다(세이브는 지워진다. 도구는 새 프로필로 열어서 보통 세이브가 없다).
 * 타이틀 뒤에는 0.3초 밝아지는 동안(`entryLeft`) `#card`가 숨어 있다. 그 틈을 "카드 없음"으로 읽지 않게 카드가 뜰 때까지 본다(#891).
 */
export async function passTitle(page: Page, tapAt: TapAt): Promise<boolean> {
  if ((await waitLoaded(page)) !== 'title') return false;
  const deadline = Date.now() + 5000;
  for (let presses = 0; ; ) {
    const t = await page.evaluate<{ button: Rect; canvas: Rect; armed: boolean } | null>(TITLE_NEW);
    if (!t) break; // 타이틀이 닫혔다
    if (Date.now() > deadline) throw new Error(`타이틀 \`はじめ\`를 ${presses}번 눌렀는데 5000ms 지나도 타이틀이 안 닫힘`);
    if (presses === 0 || t.armed) {
      const at = titleTapPoint(t.button, t.canvas);
      if (!at) throw new Error('타이틀 `はじめ` 버튼 가운데가 캔버스 밖');
      if (presses > 0) await sleep(TITLE_SECOND_PRESS_MIN_MS + 100);
      await tapAt(at);
      presses++;
    }
    await sleep(50);
  }
  // 밝아짐(0.3초) + 판 그림 로딩. 로딩 상한만큼 기다린다.
  const cardDeadline = Date.now() + LOAD_TIMEOUT_MS + 2000;
  for (let s = await stateOf(page); s === 'none' || s === 'loading'; s = await stateOf(page)) {
    if (Date.now() > cardDeadline) throw new Error('타이틀을 지났는데 시작 카드가 안 뜸');
    await sleep(50);
  }
  return true;
}

/**
 * 타이틀이 있으면 먼저 지나간다(`passTitle`). 그다음 카드가 있으면 잠금(1.0초)이 풀릴 때까지 기다렸다가 화면 가운데를 눌러 닫는다. 닫혔으면 true.
 * 카드가 없으면 누르지 않고 false(카드 없는 빌드에서 그 탭은 바닥 걷기라 결과가 바뀐다).
 * `expect`(다음 판 짧은 카드, 11-1-1절 "재생 도구" 줄, #892): 밝아짐 0.3초 동안은 카드가 아직 없다. 그 틈을 "카드 없음"으로 읽지 않고
 * 뜰 때까지 기다린다. `timeoutMs` 안에 안 뜨면 실패다(그냥 지나가면 다음 첫 클릭이 카드에 먹힌다).
 */
export async function closeStartCard(page: Page, tapAt: TapAt, opts: { timeoutMs?: number; expect?: boolean } = {}): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  await passTitle(page, tapAt);
  let s = await waitLoaded(page);
  const deadline = Date.now() + timeoutMs;
  while (opts.expect && s === 'none') {
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 지나도 다음 판 시작 카드가 안 뜸`);
    await sleep(50);
    s = await stateOf(page);
  }
  if (s === 'none') return false;
  while (s === 'locked') {
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 지나도 시작 카드 잠금이 안 풀림`);
    await sleep(50);
    s = await stateOf(page);
  }
  await tapAt(CARD_TAP);
  while ((await stateOf(page)) !== 'none') {
    if (Date.now() > deadline) throw new Error('탭을 보냈는데 시작 카드가 안 닫힘');
    await sleep(50);
  }
  return true;
}
