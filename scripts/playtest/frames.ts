// 특기 연출 프레임 캡처 (#284·#285 재판정 조건, docs/team/m1-acceptance.md "PM 프레임 스크린샷 확인").
// 판정 1 재생(replay.ts)은 말풍선 DOM 글로 통과를 봐서, 사장님 눈에 "걸어가서 서기만 함"으로 읽히는 연출을 놓쳤다(#257 2차).
// 이 도구는 처음 상태(셋 다 바닥)에서 세 사람 특기를 대상마다 **실제 클릭·탭**으로 쓰고, 마지막 탭부터 일정 간격으로
// 화면을 찍어 사례별 한 장짜리 모음(contact sheet)을 만든다. 통과/실패는 사람이 모음을 보고 정한다(자동 판정 없음).
//
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/frames.ts [--url <URL>] [--out <폴더>] [--every 120] [--tail 1500] [--mobile] [--no-sandbox]
// 결과: <out>/<사례>/f00.png…, <out>/<사례>.png(모음), <out>/report.md(사례별 말풍선 글·게이지·프레임 수).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Action, ScreenData } from '../../src/core/puzzle/types.ts';
import { CARD_TAP, closeStartCard } from './card.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { planAction, type Input, type Layout } from './plan.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    out: { type: 'string', default: 'playtest-out/frames' },
    every: { type: 'string', default: '120' },
    tail: { type: 'string', default: '1500' },
    mobile: { type: 'boolean', default: false },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

const EVERY = Number(args.every);
/** 연출(busy)이 끝난 뒤에도 말풍선이 남아 있는 동안 더 찍는 시간(ms). */
const TAIL = Number(args.tail);
/** 한 사례 최대 프레임 수. 연출이 안 끝나는 버그에서 멈추지 않게. */
const MAX_FRAMES = 100;

const screen = JSON.parse(readFileSync('content/screens/magpie_nest.json', 'utf8')) as ScreenData;

/**
 * 처음 상태에서 쓰는 특기 사례. 사장님 2차 플레이에서 실제로 누른 조합(#284 PM 재현 표) + 대상별 하나씩.
 * 정답 경로(고리 → 둥지)는 replay.ts A1이 본다.
 */
const CASES: { id: string; action: Action; why: string }[] = [
  { id: 'jjuk-stretch-nest', action: { char: 'jjuk', verb: 'stretch', target: 'nest' }, why: '바닥에서 둥지: 장대가 늘어나다 모자라야 한다(#284 완료 조건 2)' },
  { id: 'jjuk-stretch-hook', action: { char: 'jjuk', verb: 'stretch', target: 'hook' }, why: '바닥에서 고리: 집게가 고리 아래에서 멈춤' },
  { id: 'jjuk-stretch-magpie', action: { char: 'jjuk', verb: 'stretch', target: 'magpie' }, why: '바닥에서 까치' },
  { id: 'mukjik-stomp-seesaw_left', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' }, why: '반대쪽 빈 시소 쿵: 흔들림 + "반대쪽" 암시 대사(#284 완료 조건 3)' },
  { id: 'mukjik-stomp-hook', action: { char: 'mukjik', verb: 'stomp', target: 'hook' }, why: '고리에 쿵' },
  { id: 'ppik-squeak-nest', action: { char: 'ppik', verb: 'squeak', target: 'nest' }, why: '둥지에 삑: 소리 글자' },
  { id: 'ppik-squeak-magpie', action: { char: 'ppik', verb: 'squeak', target: 'magpie' }, why: '까치에 삑: 까치가 내려옴' },
];

/** replay.ts와 같은 관찰 전용 말풍선 기록기. */
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

const VIEWPORT = args.mobile
  ? { name: 'mobile', width: 844, height: 390, dpr: 3, input: 'touch' as Input }
  : { name: 'desktop', width: 1280, height: 720, dpr: 1, input: 'mouse' as Input };

const layoutOf = (page: Page) => page.evaluate<Layout>('window.__gcLayout()');
const canvasRect = (page: Page) =>
  page.evaluate<Rect>(`(() => { const b = document.querySelector('#game').getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; })()`);

async function waitBusy(page: Page, busy: boolean, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((await layoutOf(page)).busy !== busy) {
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 안에 busy=${busy}가 되지 않음`);
    await sleep(50);
  }
}

interface CaseResult {
  id: string;
  why: string;
  frames: { file: string; ms: number; busy: boolean }[];
  said: string[];
  gauge: number | null;
  error: string | null;
}

async function runCase(browser: Browser, c: (typeof CASES)[number], outDir: string): Promise<CaseResult> {
  const r: CaseResult = { id: c.id, why: c.why, frames: [], said: [], gauge: null, error: null };
  const dir = join(outDir, c.id);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.addInitScript(PROBE);
  try {
    await page.setViewport({ width: VIEWPORT.width, height: VIEWPORT.height, dpr: VIEWPORT.dpr, mobile: VIEWPORT.input === 'touch' });
    const u = new URL(args.url!);
    u.searchParams.set('playtest', '1');
    await page.goto(u.href);
    for (let i = 0; !(await page.evaluate<boolean>(`typeof window.__gcLayout === 'function'`)); i++) {
      if (i > 100) throw new Error('5초 안에 window.__gcLayout 훅이 생기지 않음');
      await sleep(50);
    }
    const send = async (at: { x: number; y: number }) => {
      const p = internalToPage(at, await canvasRect(page));
      if (VIEWPORT.input === 'touch') await page.tap(p);
      else await page.click(p);
    };
    await closeStartCard(page, () => send(CARD_TAP)); // 시작 카드(#285): 닫아야 장면이 돈다
    await waitBusy(page, false); // 처음 연출(onEnter)
    const plan = planAction(screen, await layoutOf(page), c.action, VIEWPORT.input);
    // 마지막 탭 전까지는 그냥 누르고 연출이 끝나길 기다린다(전환·무장).
    for (const t of plan.taps.slice(0, -1)) {
      await send(t.at);
      await sleep(80);
      await waitBusy(page, false);
    }
    const from = await page.evaluate<number>('window.__ptSaid.length');
    await send(plan.taps[plan.taps.length - 1]!.at);
    const t0 = Date.now();
    let idleAt: number | null = null;
    for (let n = 0; n < MAX_FRAMES; n++) {
      const ms = Date.now() - t0;
      const busy = (await layoutOf(page)).busy;
      if (!busy && idleAt === null && ms > 200) idleAt = ms;
      if (idleAt !== null && ms - idleAt > TAIL) break;
      const file = `f${String(n).padStart(2, '0')}.png`;
      await page.screenshot(join(dir, file));
      r.frames.push({ file, ms, busy });
      const next = t0 + (n + 1) * EVERY;
      await sleep(Math.max(0, next - Date.now()));
    }
    r.said = (await page.evaluate<string[]>('window.__ptSaid')).slice(from);
    r.gauge = (await layoutOf(page)).gauge;
  } catch (e) {
    r.error = (e as Error).message;
  }
  return r;
}

/** 프레임을 4분의 1 크기로 줄여 한 장에 모은다. Chrome으로 HTML을 그려 찍는다(의존성 없음). */
async function contactSheet(browser: Browser, r: CaseResult, outDir: string): Promise<string | null> {
  if (r.frames.length === 0) return null;
  const cols = 6;
  const w = Math.round(VIEWPORT.width / 4);
  const h = Math.round(VIEWPORT.height / 4);
  const rows = Math.ceil(r.frames.length / cols);
  const cells = r.frames
    .map((f) => `<figure><img src="${r.id}/${f.file}" width="${w}" height="${h}"><figcaption>${f.ms}ms${f.busy ? '' : ' · idle'}</figcaption></figure>`)
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#222;color:#eee;font:12px monospace;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:4px;padding:4px}
figure{margin:0}img{display:block;image-rendering:pixelated}figcaption{padding:1px 2px}
</style>${cells}`;
  const htmlFile = join(outDir, `${r.id}.html`);
  writeFileSync(htmlFile, html);
  const page = await browser.newPage();
  await page.setViewport({ width: cols * (w + 4) + 4, height: rows * (h + 22) + 4, dpr: 1, mobile: false });
  await page.goto(pathToFileURL(resolve(htmlFile)).href);
  const png = `${r.id}.png`;
  await page.screenshot(join(outDir, png));
  return png;
}

async function main(): Promise<number> {
  const outDir = args.out!;
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const L = [`# 특기 연출 프레임 (${new Date().toISOString()})`, '', `- URL: ${args.url} (${VIEWPORT.name} ${VIEWPORT.width}×${VIEWPORT.height})`, `- 마지막 탭부터 ${EVERY}ms마다, 연출이 끝난 뒤 ${TAIL}ms까지`, '- 판정은 사람이 모음 그림을 보고 한다: **말풍선을 안 읽어도 특기를 썼다는 게 보이는가**', '', '| 사례 | 보는 것 | 프레임 | 말풍선 | 게이지 | 모음 |', '|---|---|---|---|---|---|'];
  let failed = false;
  try {
    for (const c of CASES) {
      const r = await runCase(browser, c, outDir);
      const sheet = await contactSheet(browser, r, outDir);
      const said = r.said.map((t) => t.replace(/\n/g, ' / ')).join(' ⏵ ') || '-';
      if (r.error) failed = true;
      L.push(`| ${r.id} | ${r.why} | ${r.frames.length} | ${said} | ${r.gauge ?? '-'} | ${sheet ?? '-'}${r.error ? ` ❌ ${r.error}` : ''} |`);
    }
  } finally {
    await browser.close();
  }
  const md = L.join('\n') + '\n';
  writeFileSync(join(outDir, 'report.md'), md);
  console.log(md);
  return failed ? 1 : 0;
}

process.exitCode = await main();
