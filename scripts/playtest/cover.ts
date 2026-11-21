// 말풍선 가림 측정 (#598, #356 C-7). `cases/<화면 ID>.ts` 사례를 화면 크기마다 실제 클릭·탭으로 돌리고, 마지막 탭부터
// 말풍선이 떠 있는 동안 50ms마다 `#bubble` DOM 상자와 화면의 핫스팟(화자 자신 제외)을 교차해 **핫스팟별 최대 가림 비율**을 적는다.
// 핫스팟마다 가장 많이 가린 순간의 스크린샷을 남긴다(가림이 0이면 말풍선이 처음 뜬 순간 한 장).
// 비율은 히트 박스 기준이라 "가림 상한"이다. 장난감(`hintAbility` 없음)은 ⚠️만, 단서 물건을 가리면 ❌.
//
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/cover.ts --screen park_fountain --url http://localhost:4173/ --no-sandbox [--only aha] [--out <폴더>]
// 결과: <out>/report.md, <out>/<사례>-<화면 크기>.png. <out> 기본값은 `playtest-out/cover/<화면 ID>`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ScreenData } from '../../src/core/puzzle/types.ts';
import { CARD_TAP, closeStartCard } from './card.ts';
import { CASES_BY_SCREEN, type FrameCase } from './cases/index.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { INTERNAL, internalToPage, type Rect } from './coords.ts';
import { planAction, type Input, type Layout } from './plan.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    out: { type: 'string', default: '' },
    screen: { type: 'string', default: 'park_fountain' },
    'no-sandbox': { type: 'boolean', default: false },
    only: { type: 'string', default: '' },
  },
});

/** #330 체크리스트 4개 화면 크기(ui-detail-checklist.md). */
const VIEWPORTS = [
  { name: 'D1', width: 1280, height: 720, dpr: 1, input: 'mouse' as Input },
  { name: 'D4', width: 1920, height: 1080, dpr: 1, input: 'mouse' as Input },
  { name: 'M3', width: 844, height: 390, dpr: 3, input: 'touch' as Input },
  { name: 'M1', width: 667, height: 375, dpr: 2, input: 'touch' as Input },
];
type Viewport = (typeof VIEWPORTS)[number];

const SCREEN_ID = args.screen!;
const CASES: readonly FrameCase[] = (CASES_BY_SCREEN[SCREEN_ID] ?? []).filter((c) => c.action && c.id.includes(args.only!));
if (!/^[a-z0-9_]+$/.test(SCREEN_ID) || CASES.length === 0) throw new Error(`--screen ${SCREEN_ID}: 사례가 없음`);
const screen = JSON.parse(readFileSync(`content/screens/${SCREEN_ID}.json`, 'utf8')) as ScreenData;
const TOYS = new Set(Object.entries(screen.hotspots).filter(([, h]) => !h.hintAbility).map(([id]) => id));

const layoutOf = (page: Page) => page.evaluate<Layout>('window.__gcLayout()');
const canvasRect = (page: Page) =>
  page.evaluate<Rect>(`(() => { const b = document.querySelector('#game').getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; })()`);
const bubbleState = (page: Page) =>
  page.evaluate<{ text: string; speaker: string; rect: Rect } | null>(`(() => {
    const b = document.querySelector('#bubble');
    if (!b || b.hidden || !b.textContent) return null;
    const r = b.getBoundingClientRect();
    return { text: b.textContent, speaker: b.dataset.speaker || '', rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  })()`);

async function waitBusy(page: Page, busy: boolean, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((await layoutOf(page)).busy !== busy) {
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 안에 busy=${busy}가 되지 않음`);
    await sleep(50);
  }
}

function covered(b: Rect, k: Rect): number {
  const w = Math.min(b.left + b.width, k.left + k.width) - Math.max(b.left, k.left);
  const h = Math.min(b.top + b.height, k.top + k.height) - Math.max(b.top, k.top);
  return w <= 0 || h <= 0 ? 0 : (w * h) / (k.width * k.height);
}

interface Result {
  texts: string[];
  /** 핫스팟별 최대 가림 비율과 그때 스크린샷 파일. */
  worst: Record<string, { ratio: number; file: string }>;
  error: string | null;
}

async function runCase(browser: Browser, c: FrameCase, vp: Viewport, outDir: string): Promise<Result> {
  const r: Result = { texts: [], worst: {}, error: null };
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: vp.width, height: vp.height, dpr: vp.dpr, mobile: vp.input === 'touch' });
    const u = new URL(args.url!);
    u.searchParams.set('playtest', '1');
    u.searchParams.set('screen', SCREEN_ID);
    await page.goto(u.href);
    for (let i = 0; !(await page.evaluate<boolean>(`typeof window.__gcLayout === 'function'`)); i++) {
      if (i > 100) throw new Error('5초 안에 window.__gcLayout 훅이 생기지 않음');
      await sleep(50);
    }
    const send = async (at: { x: number; y: number }) => {
      const p = internalToPage(at, await canvasRect(page));
      if (vp.input === 'touch') await page.tap(p);
      else await page.click(p);
    };
    await closeStartCard(page, () => send(CARD_TAP));
    await waitBusy(page, false);
    const opts = c.floor ? { floorPoint: { x: c.floor[0], y: c.floor[1] } } : {};
    for (const a of c.pre ?? []) {
      for (const t of planAction(screen, await layoutOf(page), a, vp.input, opts).taps) {
        await send(t.at);
        await sleep(80);
        await waitBusy(page, false);
      }
      await sleep(600);
    }
    const plan = planAction(screen, await layoutOf(page), c.action!, vp.input, opts);
    for (const t of plan.taps.slice(0, -1)) {
      await send(t.at);
      await sleep(80);
      await waitBusy(page, false);
    }
    await send(plan.taps[plan.taps.length - 1]!.at);
    const t0 = Date.now();
    let idleAt: number | null = null;
    let first = true;
    while (Date.now() - t0 < 20_000) {
      const [layout, rect, b] = [await layoutOf(page), await canvasRect(page), await bubbleState(page)];
      if (!layout.busy && idleAt === null && Date.now() - t0 > 200) idleAt = Date.now();
      if (idleAt !== null && !b && Date.now() - idleAt > 500) break;
      if (b) {
        if (!r.texts.includes(b.text)) r.texts.push(b.text);
        const scale = rect.width / INTERNAL.width;
        for (const [id, box] of Object.entries(layout.hotspots)) {
          if (id === b.speaker) continue;
          const tl = internalToPage({ x: box.left, y: box.top }, rect);
          const ratio = covered(b.rect, { left: tl.x, top: tl.y, width: box.width * scale, height: box.height * scale });
          const prev = r.worst[id]?.ratio ?? 0;
          if (ratio > prev + 0.005 || (first && !r.worst[id])) {
            const file = `${c.id}-${vp.name}${ratio > 0 ? `-${id}` : ''}.png`;
            if (ratio > prev + 0.005 || first) await page.screenshot(join(outDir, file));
            r.worst[id] = { ratio, file };
          }
        }
        first = false;
      }
      await sleep(50);
    }
  } catch (e) {
    r.error = (e as Error).message;
  }
  return r;
}

async function main(): Promise<number> {
  const outDir = args.out || join('playtest-out', 'cover', SCREEN_ID);
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const L = [`# 말풍선 가림 \`${SCREEN_ID}\` (${new Date().toISOString()})`, '', `- URL: ${args.url}`, '- 핫스팟별 최대 가림 비율(히트 박스 기준, 화자 제외). 단서 물건 > 0 → ❌, 장난감 > 0 → ⚠️', '', `| 사례 | ${VIEWPORTS.map((v) => v.name).join(' | ')} |`, `|---|${VIEWPORTS.map(() => '---').join('|')}|`];
  let failed = false;
  try {
    for (const c of CASES) {
      const cells: string[] = [];
      for (const vp of VIEWPORTS) {
        const r = await runCase(browser, c, vp, outDir);
        if (r.error) {
          failed = true;
          cells.push(`❗ ${r.error}`);
          continue;
        }
        const hits = Object.entries(r.worst).filter(([, w]) => w.ratio > 0).sort((a, b) => b[1].ratio - a[1].ratio);
        const bad = hits.some(([id]) => !TOYS.has(id));
        const mark = bad ? '❌' : hits.length ? '⚠️' : '✅';
        cells.push(`${mark} ${hits.map(([id, w]) => `${id} ${Math.round(w.ratio * 100)}%`).join(', ') || '-'}`);
      }
      L.push(`| ${c.id} | ${cells.join(' | ')} |`);
      console.log(L[L.length - 1]);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(outDir, 'report.md'), L.join('\n') + '\n');
  return failed ? 1 : 0;
}

process.exitCode = await main();
