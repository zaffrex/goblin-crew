// M1 재생 도구 2부-b: 판정 1 재생 (#101, docs/team/m1-acceptance.md A1·A2·A3·A4·A6②).
// 배포 URL을 `?playtest=1`로 열고, scenarios.ts의 행동을 plan.ts로 탭 목록으로 바꿔 **실제 마우스 클릭·터치 탭**으로 보낸다.
// 게임 함수로 게임을 움직이지 않는다. 읽는 것은 읽기 전용 훅 `window.__gcLayout()`(#68)과 DOM `#bubble`뿐이다.
// A5(첫 화면)·A6①(세로 안내)은 smoke.ts가 본다.
//
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/replay.ts [--url <URL>] [--out <폴더>] [--no-sandbox]
// 종료 코드: A1~A4 중 하나라도 실패면 1. A6②는 판정 절차대로 경고만.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ScreenData } from '../../src/core/puzzle/types.ts';
import { Browser, sleep, type ConsoleError, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { planAction, type Input, type Layout } from './plan.ts';
import { checkStep, scenarios, selectedTarget, slopProbes, type Step } from './scenarios.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    out: { type: 'string', default: 'playtest-out/replay' },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

const screen = JSON.parse(readFileSync('content/screens/magpie_nest.json', 'utf8')) as ScreenData;
const TEXT = JSON.parse(readFileSync('content/text/ko.json', 'utf8')) as Record<string, string>;
const text = (id: string): string => TEXT[id] ?? id;

/**
 * 관찰 전용: 말풍선 `#bubble`과 게이지 0 컷 `#faint`(#129)에 뜬 글을 차례로 적는다. 숨겨졌다가 같은 글이 다시 뜨면 다시 적는다.
 * 요소마다 따로 건다. `#faint`가 없는 옛 빌드에서도 말풍선 기록은 된다.
 */
const PROBE = `(() => {
  const said = (window.__ptSaid = []);
  const hook = (sel) => {
    const b = document.querySelector(sel);
    if (!b) return void requestAnimationFrame(() => hook(sel));
    let last = '';
    const note = () => {
      const t = b.hidden ? '' : (b.textContent || '');
      if (t && t !== last) said.push(t);
      last = t;
    };
    new MutationObserver(note).observe(b, { attributes: true, childList: true, characterData: true, subtree: true });
    note();
  };
  hook('#bubble');
  hook('#faint');
})();`;

interface Viewport {
  name: string;
  width: number;
  height: number;
  dpr: number;
  input: Input;
}

// smoke.ts와 같은 두 뷰포트(판정 절차 "뷰포트 2개").
const VIEWPORTS: Viewport[] = [
  { name: 'desktop', width: 1280, height: 720, dpr: 1, input: 'mouse' },
  { name: 'mobile', width: 844, height: 390, dpr: 3, input: 'touch' },
];

interface StepResult {
  scenario: string;
  check: Step['check'];
  label: string;
  taps: string[];
  said: string[];
  gauge: number | null;
  problems: string[];
  warnings: string[];
  shots: string[];
}

interface ProbeResult {
  label: string;
  expected: string | null;
  selected: string | null;
  ok: boolean;
  shot: string;
}

interface ViewportResult {
  viewport: Viewport;
  steps: StepResult[];
  probes: ProbeResult[];
  errors: ConsoleError[];
}

const layoutOf = (page: Page) => page.evaluate<Layout>('window.__gcLayout()');
const saidCount = (page: Page) => page.evaluate<number>('window.__ptSaid.length');
const canvasRect = (page: Page) =>
  page.evaluate<Rect>(`(() => { const b = document.querySelector('#game').getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; })()`);

function playtestUrl(raw: string): string {
  const u = new URL(raw);
  u.searchParams.set('playtest', '1');
  return u.href;
}

/** 훅이 생기고 처음 연출(onEnter)이 끝날 때까지. */
async function openGame(page: Page, v: Viewport): Promise<void> {
  await page.setViewport({ width: v.width, height: v.height, dpr: v.dpr, mobile: v.input === 'touch' });
  await page.goto(playtestUrl(args.url!));
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate<boolean>(`typeof window.__gcLayout === 'function'`)) {
      await waitIdle(page, async () => {});
      return;
    }
    await sleep(50);
  }
  throw new Error('5초 안에 window.__gcLayout 훅이 생기지 않음 (?playtest=1 빌드인가?)');
}

/** busy가 거짓이 될 때까지 기다린다(ui-interaction 10절 4). 새 말풍선이 뜰 때마다 onBubble. */
async function waitIdle(page: Page, onBubble: () => Promise<void>, timeoutMs = 60_000): Promise<Layout> {
  const deadline = Date.now() + timeoutMs;
  let seen = await saidCount(page);
  for (;;) {
    const l = await layoutOf(page);
    const n = await saidCount(page);
    if (n > seen) {
      seen = n;
      await onBubble();
    }
    if (!l.busy) return l;
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 지나도 연출이 끝나지 않음`);
    await sleep(50);
  }
}

async function send(page: Page, v: Viewport, at: { x: number; y: number }): Promise<void> {
  const p = internalToPage(at, await canvasRect(page));
  if (v.input === 'touch') await page.tap(p);
  else await page.click(p);
}

async function runScenarios(browser: Browser, v: Viewport, outDir: string, errors: ConsoleError[]): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const sc of scenarios(screen)) {
    const page = await browser.newPage();
    await page.addInitScript(PROBE);
    try {
      await openGame(page, v);
      for (const [i, step] of sc.steps.entries()) {
        const base = `${v.name}-${sc.id}-${String(i + 1).padStart(2, '0')}`;
        const r: StepResult = { scenario: sc.id, check: step.check, label: step.label, taps: [], said: [], gauge: null, problems: [], warnings: [], shots: [] };
        results.push(r);
        const shot = async (suffix: string) => {
          const file = `${base}${suffix}.png`;
          await page.screenshot(join(outDir, file));
          r.shots.push(file);
        };
        try {
          const before = await layoutOf(page);
          const plan = planAction(screen, before, step.action, v.input);
          r.warnings.push(...plan.warnings);
          const from = await saidCount(page);
          for (const t of plan.taps) {
            r.taps.push(`${t.id}(${t.at.x},${t.at.y})`);
            await send(page, v, t.at);
            await sleep(80); // 한두 프레임: 탭이 처리되고 연출이 시작될 시간
            let b = 0;
            await waitIdle(page, () => shot(`-b${++b}`));
          }
          const after = await layoutOf(page);
          r.said = (await page.evaluate<string[]>('window.__ptSaid')).slice(from);
          r.gauge = after.gauge;
          r.problems.push(...checkStep(screen, step, after, r.said, text));
          await shot('');
        } catch (e) {
          r.problems.push(`재생 중단: ${(e as Error).message}`);
          await shot('-error').catch(() => {});
          break; // 상태가 시나리오와 어긋났으니 이 시나리오의 나머지는 의미가 없다.
        }
      }
    } finally {
      errors.push(...page.errors);
    }
  }
  return results;
}

async function runProbes(browser: Browser, v: Viewport, outDir: string, errors: ConsoleError[]): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  const page = await browser.newPage();
  await page.addInitScript(PROBE);
  try {
    for (const [i, p] of slopProbes(screen).entries()) {
      await openGame(page, v);
      await send(page, v, p.at);
      await sleep(150);
      const selected = selectedTarget((await layoutOf(page)).selected);
      const expected = p.selects ? p.target : null;
      const shot = `${v.name}-A6-${String(i + 1).padStart(2, '0')}.png`;
      await page.screenshot(join(outDir, shot));
      out.push({ label: p.label, expected, selected, ok: selected === expected, shot });
    }
  } finally {
    errors.push(...page.errors);
  }
  return out;
}

function verdict(r: ViewportResult, check: Step['check'] | 'A4' | 'A6'): string {
  if (check === 'A4') return r.errors.length === 0 ? '✅' : `❌ ${r.errors.length}개`;
  if (check === 'A6') return r.probes.length === 0 ? '—' : r.probes.every((p) => p.ok) ? '✅' : '⚠️';
  const steps = r.steps.filter((s) => s.check === check);
  if (steps.length === 0) return '—';
  return steps.every((s) => s.problems.length === 0) ? '✅' : '❌';
}

function toMarkdown(results: ViewportResult[], sha: string): string {
  const L: string[] = [`# playtest replay (${new Date().toISOString()})`, '', `- URL: ${playtestUrl(args.url!)}`, `- 시나리오·화면 데이터: 로컬 \`${sha}\` (배포본과 다르면 결과가 어긋날 수 있음)`, ''];
  L.push('| # | ' + results.map((r) => r.viewport.name).join(' | ') + ' |', '|---|' + results.map(() => '---').join('|') + '|');
  for (const c of ['A1', 'A2', 'A3', 'A4', 'A6'] as const) L.push(`| ${c} | ${results.map((r) => verdict(r, c)).join(' | ')} |`);
  L.push('', 'A5(첫 화면)·A6①(세로 안내)은 `smoke.ts` 결과를 본다.', '');
  for (const r of results) {
    L.push(`## ${r.viewport.name} (${r.viewport.width}×${r.viewport.height}, ${r.viewport.input})`, '');
    L.push('| 시나리오 | 칸 | 행동 | 탭 | 말풍선 | 게이지 | 결과 |', '|---|---|---|---|---|---|---|');
    for (const s of r.steps) {
      const said = s.said.map((t) => t.replace(/\n/g, ' / ')).join(' ⏵ ') || '-';
      const res = s.problems.length === 0 ? '✅' : `❌ ${s.problems.join('; ')}`;
      L.push(`| ${s.scenario} | ${s.check} | ${s.label} | ${s.taps.length} | ${said} | ${s.gauge ?? '-'} | ${res}${s.warnings.length ? ` ⚠️ ${s.warnings.join('; ')}` : ''} |`);
    }
    if (r.probes.length > 0) {
      L.push('', '| A6② 탭 | 기대 선택 | 실제 선택 | 결과 |', '|---|---|---|---|');
      for (const p of r.probes) L.push(`| ${p.label} | ${p.expected ?? '없음'} | ${p.selected ?? '없음'} | ${p.ok ? '✅' : '⚠️'} |`);
    }
    for (const e of r.errors) L.push(`- 콘솔(${e.source}): ${e.text}`);
    L.push('');
  }
  return L.join('\n');
}

async function main(): Promise<number> {
  const outDir = args.out!;
  mkdirSync(outDir, { recursive: true });
  let sha = 'unknown';
  try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    // git 밖에서 실행
  }
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const results: ViewportResult[] = [];
  try {
    for (const v of VIEWPORTS) {
      const errors: ConsoleError[] = [];
      const steps = await runScenarios(browser, v, outDir, errors);
      const probes = v.input === 'touch' ? await runProbes(browser, v, outDir, errors) : [];
      results.push({ viewport: v, steps, probes, errors });
    }
  } finally {
    await browser.close();
  }
  const md = toMarkdown(results, sha);
  writeFileSync(join(outDir, 'report.md'), md);
  writeFileSync(join(outDir, 'report.json'), JSON.stringify({ url: args.url, sha, results }, null, 2));
  console.log(md);
  const failed = results.some((r) => r.errors.length > 0 || r.steps.some((s) => s.problems.length > 0));
  return failed ? 1 : 0;
}

process.exitCode = await main();
