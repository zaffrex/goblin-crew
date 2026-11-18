// M1 재생 도구 1부: 배포본 스모크 (#101).
// 뷰포트 3개에서 열고, 실제 마우스 클릭/터치 탭이 게임까지 가는지, 콘솔 에러(A4), 첫 화면 시간(A5)을 본다.
// 사용: node scripts/playtest/smoke.ts [--url <배포 URL>] [--out <폴더>] [--no-sandbox]
// 종료 코드: A4 콘솔 에러나 입력 경로 실패면 1. A5·A6는 판정 절차대로 경고만 한다.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CARD_TAP, closeStartCard } from './card.ts';
import { Browser, sleep, type ConsoleError, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    out: { type: 'string', default: 'playtest-out' },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

/** 관찰 전용 기록기. 게임 코드를 부르지 않고, 창에 들어온 포인터 이벤트와 첫 그림 시각만 적는다. */
const PROBE = `(() => {
  const log = (window.__ptPointers = []);
  addEventListener('pointerdown', (e) => {
    log.push({ pointerType: e.pointerType, x: e.clientX, y: e.clientY, onCanvas: e.target && e.target.id === 'game' });
  }, { capture: true, passive: true });
  const watch = () => {
    const c = document.querySelector('#game');
    if (c && c.width > 0 && c.getBoundingClientRect().width > 0) {
      // 캔버스 크기가 잡힌 뒤 한 프레임 더: 첫 present()가 끝난 시점에 가깝게.
      requestAnimationFrame(() => { window.__ptFirstFrameMs = performance.now(); });
      return;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
})();`;

interface Viewport {
  name: string;
  width: number;
  height: number;
  /** 모바일은 실제 기기에 가깝게 3배. 게임 배율 계산이 장치 픽셀 기준이라 dpr에 따라 CSS 크기가 달라진다. */
  dpr: number;
  mobile: boolean;
}

const VIEWPORTS: Viewport[] = [
  { name: 'desktop-1280x720', width: 1280, height: 720, dpr: 1, mobile: false },
  { name: 'mobile-844x390', width: 844, height: 390, dpr: 3, mobile: true },
  { name: 'portrait-390x844', width: 390, height: 844, dpr: 3, mobile: true },
];

/** 바닥 한가운데쯤. 지금 빌드(#43)에서 바닥을 누르면 걷고 안내(#hud)가 사라진다. */
const FLOOR_POINT = { x: 240, y: 236 };

interface Result {
  viewport: Viewport;
  firstFrameMs: number | null;
  canvas: Rect | null;
  input: { sent: 'mouse' | 'touch'; seen: string[]; onCanvas: boolean; hudHidden: boolean } | null;
  errors: ConsoleError[];
  shots: string[];
  problems: string[];
  warnings: string[];
}

async function runViewport(browser: Browser, v: Viewport, outDir: string): Promise<Result> {
  const page: Page = await browser.newPage();
  const r: Result = { viewport: v, firstFrameMs: null, canvas: null, input: null, errors: page.errors, shots: [], problems: [], warnings: [] };
  const shot = async (label: string) => {
    const file = `${v.name}-${String(r.shots.length + 1).padStart(2, '0')}-${label}.png`;
    await page.screenshot(join(outDir, file));
    r.shots.push(file);
  };

  await page.setViewport(v);
  await page.addInitScript(PROBE);
  await page.goto(args.url!);

  // A5: 첫 화면 (headless, 캐시 없음).
  for (let i = 0; i < 100 && r.firstFrameMs === null; i++) {
    r.firstFrameMs = await page.evaluate<number | null>('window.__ptFirstFrameMs ?? null');
    if (r.firstFrameMs === null) await sleep(50);
  }
  if (r.firstFrameMs === null) r.problems.push('5초 안에 캔버스가 그려지지 않음');
  else if (r.firstFrameMs > 3000) r.warnings.push(`A5 첫 화면 ${Math.round(r.firstFrameMs)}ms > 3000ms`);
  await sleep(300);
  await shot('start');

  r.canvas = await page.evaluate<Rect | null>(`(() => {
    const c = document.querySelector('#game');
    if (!c) return null;
    const b = c.getBoundingClientRect();
    return { left: b.left, top: b.top, width: b.width, height: b.height };
  })()`);
  if (!r.canvas) {
    r.problems.push('#game 캔버스 없음');
    return r;
  }

  if (v.width < v.height) {
    // A6①: 세로 회전 안내는 #68에서 생긴다. 그 전에는 스크린샷만 남기고 사람이 본다.
    r.warnings.push('A6① 세로 회전 안내: 자동 판정 없음, 스크린샷으로 확인');
    return r;
  }

  // 입력 경로: 실제 이벤트 → 브라우저 → 게임. 모바일은 터치, 데스크톱은 마우스.
  const sent = v.mobile ? 'touch' : 'mouse';
  // 시작 카드(#285)가 있으면 먼저 닫는다. 닫는 탭은 카드가 받으니 포인터 기록에서 뺀다.
  const canvas = r.canvas;
  const tapAt = async (at: { x: number; y: number }) => {
    const q = internalToPage(at, canvas);
    if (v.mobile) await page.tap(q);
    else await page.click(q);
  };
  if (await closeStartCard(page, () => tapAt(CARD_TAP))) {
    await shot('card-closed');
    await page.evaluate('window.__ptPointers.length = 0');
  } else r.warnings.push('시작 카드(#285)가 없음');
  const p = internalToPage(FLOOR_POINT, r.canvas);
  if (v.mobile) await page.tap(p);
  else await page.click(p);
  await sleep(1500);
  const seen = await page.evaluate<{ pointerType: string; onCanvas: boolean }[]>('window.__ptPointers');
  const hudHidden = await page.evaluate<boolean>(`document.querySelector('#hud')?.hidden === true`);
  r.input = { sent, seen: seen.map((s) => s.pointerType), onCanvas: seen.some((s) => s.onCanvas), hudHidden };
  if (seen.length !== 1 || seen[0]!.pointerType !== sent) {
    r.problems.push(`보낸 입력 ${sent} 1번 ↔ 게임이 받은 pointerdown [${r.input.seen.join(', ')}]`);
  }
  if (!r.input.onCanvas) r.problems.push('pointerdown이 캔버스에 닿지 않음');
  // 목표 줄(#285, ui-interaction.md 6-2-2절)은 첫 행동 뒤에도 늘 보여야 한다.
  if (hudHidden) r.warnings.push('바닥 탭 뒤에 #hud 목표 줄이 사라짐 (6-2-2절: 늘 보임)');
  await shot('after-floor-tap');

  if (page.errors.length > 0) r.problems.push(`A4 콘솔 에러 ${page.errors.length}개`);
  return r;
}

function toMarkdown(results: Result[], url: string): string {
  const yes = (b: boolean) => (b ? '✅' : '❌');
  const lines = [
    `# playtest smoke (${new Date().toISOString()})`,
    '',
    `- URL: ${url}`,
    '',
    '| 뷰포트 | dpr | 캔버스 CSS px | A5 첫 화면 | 입력(보냄→받음) | A4 콘솔 에러 | 판정 |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    const c = r.canvas ? `${Math.round(r.canvas.width)}×${Math.round(r.canvas.height)}` : '-';
    const ff = r.firstFrameMs === null ? '-' : `${Math.round(r.firstFrameMs)}ms`;
    const input = r.input ? `${r.input.sent}→${r.input.seen.join(',') || '없음'}` : '-';
    lines.push(`| ${r.viewport.name} | ${r.viewport.dpr} | ${c} | ${ff} | ${input} | ${r.errors.length} | ${yes(r.problems.length === 0)} |`);
  }
  lines.push('');
  for (const r of results) {
    for (const p of r.problems) lines.push(`- ❌ ${r.viewport.name}: ${p}`);
    for (const w of r.warnings) lines.push(`- ⚠️ ${r.viewport.name}: ${w}`);
    for (const e of r.errors) lines.push(`- 콘솔(${e.source}) ${r.viewport.name}: ${e.text}`);
  }
  lines.push('', '스크린샷: ' + results.flatMap((r) => r.shots).join(', '), '');
  return lines.join('\n');
}

async function main(): Promise<number> {
  const outDir = args.out!;
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const results: Result[] = [];
  try {
    for (const v of VIEWPORTS) results.push(await runViewport(browser, v, outDir));
  } finally {
    await browser.close();
  }
  const md = toMarkdown(results, args.url!);
  writeFileSync(join(outDir, 'report.md'), md);
  writeFileSync(join(outDir, 'report.json'), JSON.stringify({ url: args.url, results }, null, 2));
  console.log(md);
  return results.some((r) => r.problems.length > 0) ? 1 : 0;
}

process.exitCode = await main();
