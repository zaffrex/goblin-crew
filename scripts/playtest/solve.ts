// 화면의 정답(`solution`)을 실제 클릭·탭으로 끝까지 푼다 (#466). 화면 1 판정용 replay.ts와 달리 화면 데이터에 매이지 않는다.
// `?screen=<id>&playtest=1`로 열고, 정답 행동마다 plan.ts로 누를 곳을 고르고, 연출이 끝나길 기다린다. 끝에 `cleared`인지 본다.
// 게임 함수로 게임을 움직이지 않는다. 읽는 것은 읽기 전용 훅 `window.__gcLayout()`뿐이다.
//
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --screen park_fountain [--url <URL>] [--out <폴더>] [--touch] [--no-sandbox]
// 종료 코드: 클리어 못 했거나, 콘솔 에러가 있거나, 누를 곳을 못 찾으면 1.

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ScreenData } from '../../src/core/puzzle/types.ts';
import { CARD_TAP, closeStartCard } from './card.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { planAction, type Input, type Layout } from './plan.ts';

const { values: args } = parseArgs({
  options: {
    screen: { type: 'string', default: 'magpie_nest' },
    url: { type: 'string', default: 'http://localhost:4173/' },
    out: { type: 'string', default: 'playtest-out/solve' },
    touch: { type: 'boolean', default: false },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

const id = args.screen!;
if (!/^[a-z0-9_]+$/.test(id)) throw new Error(`--screen ${id}: 화면 ID 형식이 아님`);
const screen = JSON.parse(readFileSync(`content/screens/${id}.json`, 'utf8')) as ScreenData;
const solution = screen.solution ?? [];
if (!solution.length) throw new Error(`${id}: 화면 JSON에 solution이 없음`);
const input: Input = args.touch ? 'touch' : 'mouse';
const viewport = args.touch ? { width: 844, height: 390, dpr: 3, mobile: true } : { width: 1280, height: 720, dpr: 1, mobile: false };

const layoutOf = (page: Page) => page.evaluate<Layout>('window.__gcLayout()');
const canvasRect = (page: Page) =>
  page.evaluate<Rect>(`(() => { const b = document.querySelector('#game').getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; })()`);

async function send(page: Page, at: { x: number; y: number }): Promise<void> {
  const p = internalToPage(at, await canvasRect(page));
  if (input === 'touch') await page.tap(p);
  else await page.click(p);
}

async function waitIdle(page: Page, timeoutMs = 60_000): Promise<Layout> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const l = await layoutOf(page);
    if (!l.busy) return l;
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 지나도 연출이 끝나지 않음`);
    await sleep(50);
  }
}

async function main(): Promise<number> {
  mkdirSync(args.out!, { recursive: true });
  const u = new URL(args.url!);
  u.searchParams.set('playtest', '1');
  u.searchParams.set('screen', id);
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const problems: string[] = [];
  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(u.href);
    for (let i = 0; !(await page.evaluate<boolean>(`typeof window.__gcLayout === 'function'`)); i++) {
      if (i > 100) throw new Error('5초 안에 window.__gcLayout 훅이 생기지 않음 (?playtest=1 빌드인가?)');
      await sleep(50);
    }
    await closeStartCard(page, () => send(page, CARD_TAP));
    await waitIdle(page);
    await page.screenshot(join(args.out!, `${id}-0-start.png`));
    for (const [i, action] of solution.entries()) {
      const plan = planAction(screen, await layoutOf(page), action, input);
      for (const w of plan.warnings) console.log(`  ⚠️ ${w}`);
      for (const t of plan.taps) {
        await send(page, t.at);
        await sleep(80);
        await waitIdle(page);
      }
      const l = await layoutOf(page);
      console.log(`${i + 1}. ${action.char} ${action.verb} ${action.target} → 게이지 ${l.gauge}, cleared ${l.cleared}`);
      await page.screenshot(join(args.out!, `${id}-${i + 1}.png`));
    }
    const end = await layoutOf(page);
    if (!end.cleared) problems.push('정답을 다 눌렀는데 cleared가 아님');
    for (const e of page.errors) problems.push(`콘솔(${e.source}): ${e.text}`);
  } finally {
    await browser.close();
  }
  console.log(`URL: ${u.href}`);
  console.log(problems.length ? problems.map((p) => `❌ ${p}`).join('\n') : `✅ ${id} 클리어 (${solution.length}행동, ${input})`);
  return problems.length ? 1 : 0;
}

process.exitCode = await main();
