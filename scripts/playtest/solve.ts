// 화면의 정답(`solution`)을 실제 클릭·탭으로 끝까지 푼다 (#466). 화면 1 판정용 replay.ts와 달리 화면 데이터에 매이지 않는다.
// `?screen=<id>&playtest=1`로 열고, 정답 행동마다 plan.ts로 누를 곳을 고르고, 연출이 끝나길 기다린다. 끝에 `cleared`인지 본다.
// 게임 함수로 게임을 움직이지 않는다. 읽는 것은 읽기 전용 훅 `window.__gcLayout()`뿐이다.
//
// `--order a,b`(#230 여러 화면 연결, ui-interaction 11-6절)면 `?playtest=1&order=a,b`로 열어 화면을 차례로 푼다.
// 화면 사이에서는 11-6절 5번대로 `ui.next`가 보일 때(`#clear[data-next]`)까지 기다렸다가 가운데를 1번 누르고, 다음 화면이 `play`가 되길 기다린다.
// 마지막 화면 뒤에는 끝 카드가 떠 있는지 본다.
//
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --screen park_fountain [--url <URL>] [--out <폴더>] [--touch] [--no-sandbox]
//       node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --order magpie_nest,magpie_nest [...]
//       node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --deploy [...]
// `--deploy`(#766)는 `?playtest=1`만 붙여(훅용) 쿼리 없는 배포본 경로를 탄다. 순서는 로컬 `content/screens/order.json`이고, 게임이 같은 순서를 쓰는지 본다.
// 세이브(#767): `--deploy`면 카드가 뜰 때마다 localStorage 세이브의 checkpoint가 다음 화면(마지막은 자기)이고 깬 화면이 쌓였는지 본다.
// `--order`·`--screen`(세이브를 끄는 판)이면 끝까지 세이브가 하나도 안 생겼는지 본다. 헤드리스는 매번 새 프로필이라 빈 저장소에서 시작한다.
// 종료 코드: 클리어 못 했거나, 콘솔 에러가 있거나, 누를 곳을 못 찾거나, 화면 전환·끝 카드가 기대와 다르면 1.

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { soloCardKey } from '../../src/core/flow.ts';
import type { ScreenData } from '../../src/core/puzzle/types.ts';
import { CARD_TAP, closeStartCard } from './card.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { planAction, type Input, type Layout } from './plan.ts';

const { values: args } = parseArgs({
  options: {
    screen: { type: 'string', default: 'magpie_nest' },
    order: { type: 'string' },
    deploy: { type: 'boolean', default: false },
    url: { type: 'string', default: 'http://localhost:4173/' },
    out: { type: 'string', default: 'playtest-out/solve' },
    touch: { type: 'boolean', default: false },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

if (args.deploy && args.order) throw new Error('--deploy와 --order는 같이 못 쓴다');
const linked = args.deploy || args.order !== undefined;
const ids: string[] = args.deploy
  ? (JSON.parse(readFileSync('content/screens/order.json', 'utf8')) as string[])
  : args.order
    ? args.order.split(',')
    : [args.screen!];
const screens = ids.map((id) => {
  if (!/^[a-z0-9_]+$/.test(id)) throw new Error(`화면 ID 형식이 아님: ${id}`);
  const screen = JSON.parse(readFileSync(`content/screens/${id}.json`, 'utf8')) as ScreenData;
  if (!screen.solution?.length) throw new Error(`${id}: 화면 JSON에 solution이 없음`);
  return screen;
});
const texts = JSON.parse(readFileSync('content/text/ja.json', 'utf8')) as Record<string, string>;
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

interface FlowState { order: string[] | null; index: number; screen: string; phase: string; card?: 'full' | 'short' | null }
const flowOf = (page: Page) => page.evaluate<FlowState | null>(`typeof window.__gcFlow === 'function' ? window.__gcFlow() : null`);
const clearCard = (page: Page) =>
  page.evaluate<{ shown: boolean; next: boolean; text: string }>(`(() => { const c = document.querySelector('#clear'); return { shown: !c.hidden, next: c.hasAttribute('data-next'), text: c.textContent }; })()`);

interface SavedState { screenId: string; activeCharacter: string; solved: string[] }
/** localStorage 세이브(관찰만). 없으면 null. 키는 `src/core/save/schema.ts` SAVE_KEY. */
const savedOf = (page: Page) =>
  page.evaluate<SavedState | null>(`(() => { const t = localStorage.getItem('goblincrew.save.v1'); if (t === null) return null; const d = JSON.parse(t); return { screenId: d.checkpoint.screenId, activeCharacter: d.checkpoint.activeCharacter, solved: d.progress.solvedScreens }; })()`);

/** `--deploy` 카드에서 본 세이브가 11-4절과 맞나: checkpoint = 다음 화면(마지막은 자기), solvedScreens = 지금까지 깬 화면. */
async function checkSave(page: Page, k: number, tag: string, problems: string[]): Promise<void> {
  if (!args.deploy) return;
  const s = await savedOf(page);
  const want = ids[k + 1] ?? ids[k]!;
  const solved = ids.slice(0, k + 1).join();
  if (!s) problems.push(`${tag}: 카드가 떴는데 세이브가 없음`);
  else if (s.screenId !== want || s.solved.join() !== solved) problems.push(`${tag}: 세이브 checkpoint ${s.screenId}·깬 화면 ${s.solved.join()} (기대 ${want}·${solved})`);
  else console.log(`${tag} 세이브 ✅ checkpoint ${s.screenId} (${s.activeCharacter}), 깬 화면 ${s.solved.join(',')}`);
}

async function waitFor<T>(what: string, read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await read();
    if (ok(v)) return v;
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 지나도 ${what}: ${JSON.stringify(v)}`);
    await sleep(30);
  }
}

/** 화면 하나의 정답을 누른다. 끝에 cleared가 아니면 problems에 적는다. */
async function solveScreen(page: Page, screen: ScreenData, k: number, problems: string[]): Promise<void> {
  const tag = ids.length > 1 ? `${k + 1}-${screen.id}` : screen.id;
  await page.screenshot(join(args.out!, `${tag}-0-start.png`));
  for (const [i, action] of screen.solution!.entries()) {
    const plan = planAction(screen, await layoutOf(page), action, input);
    for (const w of plan.warnings) console.log(`  ⚠️ ${w}`);
    for (const t of plan.taps) {
      await send(page, t.at);
      await sleep(80);
      await waitIdle(page);
    }
    const l = await layoutOf(page);
    console.log(`${tag} ${i + 1}. ${action.char} ${action.verb} ${action.target} → 게이지 ${l.gauge}, cleared ${l.cleared}`);
    await page.screenshot(join(args.out!, `${tag}-${i + 1}.png`));
  }
  if (!(await layoutOf(page)).cleared) problems.push(`${tag}: 정답을 다 눌렀는데 cleared가 아님`);
}

/**
 * 클리어 뒤 화면 사이(11-1·11-6절). 마지막이 아니면 카드 결과 줄·`ui.next`를 보고 가운데를 눌러 다음 화면 `play`까지 기다린다.
 * 마지막이면 끝 카드 `ui.end`가 떠 있고 `ui.next`가 없는지(타이틀 전, 11-5절) 본다.
 */
/** 순서 없이 화면 하나(#597): 클리어 컷 뒤 카드 글이 `soloCardKey` 규칙과 같은가. ui.next는 없다(다음 화면이 없다). */
async function soloCard(page: Page, problems: string[]): Promise<void> {
  const id = ids[0]!;
  const key = soloCardKey(id, (k) => k in texts);
  const c = await waitFor('클리어 카드가 안 뜸', () => clearCard(page), (c) => c.shown);
  await page.screenshot(join(args.out!, `1-${id}-clear-card.png`));
  if (c.text !== texts[key]) problems.push(`1-${id}: 클리어 카드 글이 ${key}가 아님: ${JSON.stringify(c.text)}`);
  if (c.next) problems.push(`1-${id}: 화면 하나인데 클리어 카드에 ui.next가 보임`);
  console.log(`1-${id} 클리어 카드 ✅ ${key} ${JSON.stringify(c.text)}`);
}

async function crossCard(page: Page, k: number, problems: string[]): Promise<void> {
  const id = ids[k]!;
  const last = k === ids.length - 1;
  const tag = `${k + 1}-${id}`;
  if (last) {
    const c = await waitFor('끝 카드가 안 뜸', () => clearCard(page), (c) => c.shown);
    await sleep(800); // 0.6초 무시가 지나도 ui.next가 안 생겨야 한다
    const after = await clearCard(page);
    await page.screenshot(join(args.out!, `${tag}-end-card.png`));
    if (c.text !== texts['ui.end']) problems.push(`${tag}: 끝 카드 글이 ui.end가 아님: ${JSON.stringify(c.text)}`);
    if (after.next) problems.push(`${tag}: 타이틀이 없는데 끝 카드에 ui.next가 보임`);
    console.log(`${tag} 끝 카드 ✅ ${JSON.stringify(c.text)}`);
    await checkSave(page, k, tag, problems);
    return;
  }
  const shownAt = Date.now();
  const c = await waitFor('ui.next가 안 보임', () => clearCard(page), (c) => c.next);
  const waited = Date.now() - shownAt;
  await page.screenshot(join(args.out!, `${tag}-card.png`));
  const body = texts[`${id}.clear_card`];
  if (body !== undefined && !c.text.startsWith(body)) problems.push(`${tag}: 카드 결과 줄이 ${id}.clear_card가 아님: ${JSON.stringify(c.text)}`);
  await checkSave(page, k, tag, problems);
  const before = await flowOf(page);
  const prevActive = (await layoutOf(page)).active;
  const tapAt = Date.now();
  await send(page, CARD_TAP);
  const f = (await waitFor('다음 화면이 play가 안 됨', () => flowOf(page), (f) => f !== null && f.index === k + 1 && f.phase === 'play'))!;
  const took = Date.now() - tapAt;
  // 밝아진 뒤 짧은 시작 카드(11-1-1절, #892). 닫아야 진입 연출이 돈다. 안 뜨면 실패.
  const kind = await waitFor('다음 화면 시작 카드가 안 뜸', () => flowOf(page), (f) => f?.card !== null && f?.card !== undefined);
  await page.screenshot(join(args.out!, `${tag}-short-card.png`));
  if (kind?.card !== 'short') problems.push(`${tag}: 다음 화면 카드가 짧은 카드가 아님(${kind?.card})`);
  await closeStartCard(page, (at) => send(page, at), { expect: true });
  const now = await layoutOf(page);
  if (f.screen !== ids[k + 1]) problems.push(`${tag}: 다음 화면이 ${ids[k + 1]}가 아니라 ${f.screen}`);
  if (now.gauge !== 5) problems.push(`${tag}: 다음 화면 게이지가 가득이 아님(${now.gauge})`);
  if (now.cleared) problems.push(`${tag}: 다음 화면이 이미 cleared(이전 판이 샘)`);
  console.log(`${tag} 카드 ✅ ${JSON.stringify(c.text)} (ui.next까지 ${waited}ms) → 탭 → ${f.screen} play (${took}ms, 이전 ${before?.screen}, 캐릭터 ${prevActive} → ${now.active})`);
  await waitIdle(page);
}

async function main(): Promise<number> {
  mkdirSync(args.out!, { recursive: true });
  const u = new URL(args.url!);
  u.searchParams.set('playtest', '1');
  if (args.order) u.searchParams.set('order', ids.join(','));
  else if (!args.deploy) u.searchParams.set('screen', ids[0]!);
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
    await closeStartCard(page, (at) => send(page, at));
    await waitIdle(page);
    if (linked) {
      const f = await flowOf(page);
      if (!f?.order) throw new Error(`순서가 안 먹음(훅 __gcFlow: ${JSON.stringify(f)}). ${args.deploy ? '배포 순서(#766)' : '연결 2단계'} 이전 빌드인가?`);
      if (f.order.join() !== ids.join()) throw new Error(`게임 순서 ${f.order.join(',')}가 기대 ${ids.join(',')}와 다름(배포본이 로컬 order.json과 다른가?)`);
    }
    for (const [k, screen] of screens.entries()) {
      await solveScreen(page, screen, k, problems);
      if (problems.length) break;
      if (linked) await crossCard(page, k, problems);
      else await soloCard(page, problems);
    }
    if (!args.deploy && (await savedOf(page)) !== null) problems.push('세이브를 끄는 판(--order·--screen)인데 세이브가 생김');
    for (const e of page.errors) problems.push(`콘솔(${e.source}): ${e.text}`);
  } finally {
    await browser.close();
  }
  console.log(`URL: ${u.href}`);
  const acts = screens.reduce((n, s) => n + s.solution!.length, 0);
  console.log(problems.length ? problems.map((p) => `❌ ${p}`).join('\n') : `✅ ${ids.join(' → ')} 클리어 (${acts}행동, ${input})`);
  return problems.length ? 1 : 0;
}

process.exitCode = await main();
