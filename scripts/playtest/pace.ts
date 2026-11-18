// 느린 PC에서 게임 시간이 늦어지는지 잰다 (#286 4번 (b)).
// CDP `Emulation.setCPUThrottlingRate`로 CPU를 n배 느리게 하고, 바닥을 실제 클릭해서 지금 캐릭터가
// 화면을 가로질러 걷는 동안 (1) 벽시계 대비 걷기 속도 (2) 프레임 간격을 잰다.
// 게임은 고정 틱(60Hz)이라 프레임이 느려져도 틱 수는 따라잡아야 하지만, `engine/loop.ts`가
// 한 프레임에 최대 MAX_STEPS_PER_FRAME 틱만 돌고 남은 시간은 버린다. 그 상한에 걸리면 게임 시간이 벽시계보다 늦어진다.
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/pace.ts [--url <URL>] [--out <폴더>] [--rates 1,4,8,16] [--no-sandbox]
// 자동 판정 없음(측정 도구). 결과는 <out>/pace.md, pace.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CARD_TAP, closeStartCard } from './card.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { MAX_STEPS_PER_FRAME, TICK_MS, WALK_AREA, WALK_SPEED } from '../../src/core/config.ts';
import { consumeFrame } from '../../src/core/fixedStep.ts';


// 테스트가 순수 함수만 불러갈 때 명령줄을 읽지 않도록 main에서만 푼다.
const parseCli = () => parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    out: { type: 'string', default: 'playtest-out' },
    rates: { type: 'string', default: '1,4,8,16,32' },
    'no-sandbox': { type: 'boolean', default: false },
  },
}).values;
type Cli = ReturnType<typeof parseCli>;

/** 관찰 전용: rAF 간격만 적는다. 게임 코드를 부르지 않는다. 자체 rAF 하나가 더는 부하는 그리기에 비해 무시할 만하다. */
const FRAME_PROBE = `(() => {
  const iv = (window.__ptFrameIv = []);
  let last = 0;
  const f = (now) => { if (window.__ptRec && last) iv.push(now - last); last = now; requestAnimationFrame(f); };
  requestAnimationFrame(f);
})();`;

interface Viewport {
  name: string;
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
}

// 데스크톱 dpr 1(캔버스가 작음), 휴대폰 가로 dpr 3(장치 픽셀이 많아 그리기가 무거움).
const VIEWPORTS: Viewport[] = [
  { name: 'desktop-1280x720', width: 1280, height: 720, dpr: 1, mobile: false },
  { name: 'mobile-844x390', width: 844, height: 390, dpr: 3, mobile: true },
];

interface Sample {
  t: number;
  x: number;
  busy: boolean;
}

export interface PaceResult {
  viewport: string;
  rate: number;
  fromX: number;
  toX: number;
  walkedPx: number;
  wallMs: number;
  /** 벽시계 기준 걷기 속도(px/s). 정상은 WALK_SPEED × 60 = 90. */
  pxPerSec: number;
  /** 게임 시간 / 벽시계. 1이면 늦어지지 않음. */
  ratio: number;
  frames: number;
  frameMedianMs: number;
  frameP90Ms: number;
  /** 같은 프레임 간격을 `consumeFrame`에 넣었을 때 예상 비율(측정과 맞으면 원인이 상한이다). */
  predictedRatio: number;
}

const canvasRect = (page: Page) =>
  page.evaluate<Rect>(`(() => { const b = document.querySelector('#game').getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; })()`);

async function send(page: Page, v: Viewport, at: { x: number; y: number }): Promise<void> {
  const p = internalToPage(at, await canvasRect(page));
  if (v.mobile) await page.tap(p);
  else await page.click(p);
}

type Box = { left: number; top: number; width: number; height: number };
interface Layout {
  active: string;
  busy: boolean;
  chars: Record<string, Box>;
  hotspots: Record<string, Box>;
  spots: Record<string, Box>;
}
const layoutOf = (page: Page) => page.evaluate<Layout>('window.__gcLayout()');

const inside = (b: Box, p: { x: number; y: number }) => p.x >= b.left && p.x < b.left + b.width && p.y >= b.top && p.y < b.top + b.height;

/** 지금 캐릭터 반대쪽 바닥에서 어떤 상자에도 안 걸리는 점. 바닥 클릭 = 걷기만. */
export function floorTarget(l: Layout, fromX: number): { x: number; y: number } {
  const y = WALK_AREA.bottom - 4;
  const xs = fromX < 240 ? [440, 420, 400, 380, 360] : [40, 60, 80, 100, 120];
  const boxes = [...Object.values(l.chars), ...Object.values(l.hotspots), ...Object.values(l.spots)];
  const x = xs.find((cx) => !boxes.some((b) => inside(b, { x: cx, y })));
  if (x === undefined) throw new Error('비어 있는 바닥 점을 못 찾음');
  return { x, y };
}

const centerX = (b: Box) => b.left + b.width / 2;

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

/** 프레임 간격들을 실제 루프 규칙(`consumeFrame`, 상한 MAX_STEPS_PER_FRAME)에 넣었을 때 게임 시간 / 벽시계. */
export function predictRatio(intervals: number[], maxSteps = MAX_STEPS_PER_FRAME): number {
  let acc = 0;
  let steps = 0;
  let wall = 0;
  for (const ms of intervals) {
    const r = consumeFrame(acc, ms, TICK_MS, maxSteps);
    acc = r.remainderMs;
    steps += r.steps;
    wall += ms;
  }
  return wall > 0 ? (steps * TICK_MS) / wall : NaN;
}

/** 샘플에서 움직이기 시작한 시각(마지막 정지 샘플)과 멈춘 시각(처음 도착 샘플). 50ms 간격이라 오차는 ±50ms. */
export function walkSpan(samples: Sample[]): { fromX: number; toX: number; wallMs: number } | null {
  if (samples.length < 3) return null;
  const fromX = samples[0]!.x;
  const toX = samples[samples.length - 1]!.x;
  const startIdx = samples.findIndex((s) => s.x !== fromX);
  const endIdx = samples.findIndex((s) => s.x === toX);
  if (startIdx <= 0 || endIdx < startIdx) return null;
  return { fromX, toX, wallMs: samples[endIdx]!.t - samples[startIdx - 1]!.t };
}

async function measure(args: Cli, browser: Browser, v: Viewport, rate: number): Promise<PaceResult> {
  const page = await browser.newPage();
  await page.setViewport(v);
  await page.addInitScript(FRAME_PROBE);
  const url = new URL(args.url!);
  url.searchParams.set('playtest', '1');
  await page.goto(url.toString());
  await closeStartCard(page, () => send(page, v, CARD_TAP));
  // 진입 연출이 끝날 때까지
  for (let i = 0; (await layoutOf(page)).busy; i++) {
    if (i > 400) throw new Error('진입 연출이 20초 넘게 안 끝남');
    await sleep(50);
  }
  await page.send('Emulation.setCPUThrottlingRate', { rate });
  await sleep(500); // 느려진 상태가 자리 잡을 때까지
  const l = await layoutOf(page);
  const fromX = centerX(l.chars[l.active]!);
  const target = floorTarget(l, fromX);
  await page.evaluate('(window.__ptFrameIv.length = 0, window.__ptRec = true)');
  await send(page, v, target);

  const samples: Sample[] = [];
  const deadline = Date.now() + 90_000;
  let still = 0;
  for (;;) {
    const s = await page.evaluate<{ t: number; x: number; busy: boolean }>(
      `(() => { const l = window.__gcLayout(); const b = l.chars[l.active]; return { t: performance.now(), x: b.left + b.width / 2, busy: l.busy }; })()`,
    );
    samples.push(s);
    const prev = samples[samples.length - 2];
    still = prev && prev.x === s.x && s.x !== fromX ? still + 1 : 0;
    if (still >= 6 && !s.busy) break; // 도착 뒤 0.3초 이상 그대로
    if (Date.now() > deadline) throw new Error(`${v.name} ×${rate}: 90초 안에 도착 못 함`);
    await sleep(50);
  }
  const intervals = await page.evaluate<number[]>('(window.__ptRec = false, window.__ptFrameIv.slice())');
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  if (page.errors.length > 0) console.warn(`${v.name} ×${rate}: 콘솔 에러 ${page.errors.length}개: ${page.errors[0]!.text}`);

  const span = walkSpan(samples);
  if (!span) throw new Error(`${v.name} ×${rate}: 걷기를 못 잼 (샘플 ${samples.length}개)`);
  const walkedPx = Math.abs(span.toX - span.fromX);
  const pxPerSec = walkedPx / (span.wallMs / 1000);
  return {
    viewport: v.name,
    rate,
    fromX: span.fromX,
    toX: span.toX,
    walkedPx,
    wallMs: Math.round(span.wallMs),
    pxPerSec: Math.round(pxPerSec * 10) / 10,
    ratio: Math.round((pxPerSec / (WALK_SPEED * 1000 / TICK_MS)) * 100) / 100,
    frames: intervals.length,
    frameMedianMs: Math.round(quantile(intervals, 0.5) * 10) / 10,
    frameP90Ms: Math.round(quantile(intervals, 0.9) * 10) / 10,
    predictedRatio: Math.round(predictRatio(intervals) * 100) / 100,
  };
}

function report(args: Cli, rows: PaceResult[]): string {
  const lines = [
    '# 느린 PC 게임 시간 측정 (#286 4번 (b))',
    '',
    `URL: ${args.url} · 정상 걷기 속도 ${WALK_SPEED * 1000 / TICK_MS}px/s · 한 프레임 최대 ${MAX_STEPS_PER_FRAME}틱(${Math.round(MAX_STEPS_PER_FRAME * TICK_MS * 10) / 10}ms)`,
    '',
    '| 뷰포트 | CPU 감속 | 걸은 px | 걸린 시간 | px/s | 게임/벽시계 | 프레임 중앙 | 프레임 p90 | 루프 규칙 예상 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.viewport} | ×${r.rate} | ${r.walkedPx} | ${(r.wallMs / 1000).toFixed(2)}초 | ${r.pxPerSec} | ${r.ratio} | ${r.frameMedianMs}ms | ${r.frameP90Ms}ms | ${r.predictedRatio} |`),
    '',
    '- 게임/벽시계 = 측정 px/s ÷ 정상 px/s. 샘플 간격 50ms라 ±약 3% 오차.',
    '- 루프 규칙 예상 = 기록한 프레임 간격을 `consumeFrame`에 넣은 값. 측정과 같으면 늦어지는 원인이 프레임당 틱 상한이다.',
  ];
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  const args = parseCli();
  const rates = args.rates!.split(',').map(Number);
  mkdirSync(args.out!, { recursive: true });
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const rows: PaceResult[] = [];
  try {
    for (const v of VIEWPORTS) {
      for (const rate of rates) {
        const r = await measure(args, browser, v, rate);
        console.log(`${v.name} ×${rate}: ${r.walkedPx}px ${r.wallMs}ms → ${r.pxPerSec}px/s (게임/벽시계 ${r.ratio}, 예상 ${r.predictedRatio}), 프레임 중앙 ${r.frameMedianMs}ms`);
        rows.push(r);
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(args.out!, 'pace.json'), JSON.stringify(rows, null, 2));
  writeFileSync(join(args.out!, 'pace.md'), report(args, rows));
  console.log(`→ ${join(args.out!, 'pace.md')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
