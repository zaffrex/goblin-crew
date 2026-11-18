// 시작 카드 닫기(#285, ui-interaction.md 6-2-1절). 재생 도구(replay·frames·smoke)가 게임을 연 직후 부른다.
// 카드가 떠 있는 동안 장면은 멈춰 있어서(진입 연출 포함) 닫지 않으면 busy가 영영 안 풀린다.

import { sleep, type Page } from './cdp.ts';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../src/core/config.ts';

/** 화면 가운데(내부 좌표). 카드가 덮고 있는 자리라 이 탭은 캔버스(게임)에 닿지 않는다. */
export const CARD_TAP = { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT / 2 };

const STATE = `(() => {
  const c = document.querySelector('#card');
  if (!c || c.hidden) return 'none';
  return c.hasAttribute('data-ready') ? 'ready' : 'locked';
})()`;

/**
 * 카드가 있으면 잠금(1.0초)이 풀릴 때까지 기다렸다가 `tap`으로 닫는다. 닫혔으면 true.
 * 카드가 없으면 누르지 않고 false(카드 없는 빌드에서 그 탭은 바닥 걷기라 결과가 바뀐다).
 */
export async function closeStartCard(page: Page, tap: () => Promise<void>, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let s = await page.evaluate<string>(STATE);
  if (s === 'none') return false;
  while (s === 'locked') {
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 지나도 시작 카드 잠금이 안 풀림`);
    await sleep(50);
    s = await page.evaluate<string>(STATE);
  }
  await tap();
  while ((await page.evaluate<string>(STATE)) !== 'none') {
    if (Date.now() > deadline) throw new Error('탭을 보냈는데 시작 카드가 안 닫힘');
    await sleep(50);
  }
  return true;
}
