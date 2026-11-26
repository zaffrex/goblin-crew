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
// `--via-map`(#792 완료 조건 4, `--deploy`와 같이): `?playtest=1&title=1`로 열어 타이틀 `はじめ` → 첫 판 클리어 → 카드 → 둘째 판까지 간 뒤,
// 같은 프로필로 다시 열어 타이틀 `マップ` → 첫 판 카드 → 다시 클리어 → 카드 다음 줄 `ui.map.return` → 탭 → 맵인지 본다.
// 다시 깨는 동안 세이브 checkpoint·깬 화면이 그대로인지도 본다(`saveOnCard` 다시 하기 경로, 설계 3-4절).
// `--via-map-last`(설계 7절 5번, `--deploy`와 같이): 타이틀 `はじめ` → 모든 판 클리어 → 끝 카드까지 간 뒤 같은 프로필로 다시 열어
// `マップ` → 마지막 판 카드 → 다시 클리어 → 끝 카드(`ui.end` + `ui.map.return`) → 탭 → 맵(타이틀 아님)인지 본다. 세 판을 다 깨서 약 2분 더 걸린다.
// 종료 코드: 클리어 못 했거나, 콘솔 에러가 있거나, 누를 곳을 못 찾거나, 화면 전환·끝 카드가 기대와 다르면 1.

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { cardLines, soloCardKey } from '../../src/core/flow.ts';
import type { ScreenData } from '../../src/core/puzzle/types.ts';
import { CARD_TAP, closeStartCard, pressTitleMap } from './card.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../src/core/config.ts';
import { screenToInternal } from '../../src/core/viewport.ts';
import { planAction, type Input, type Layout } from './plan.ts';

const { values: args } = parseArgs({
  options: {
    screen: { type: 'string', default: 'magpie_nest' },
    order: { type: 'string' },
    deploy: { type: 'boolean', default: false },
    'via-map': { type: 'boolean', default: false },
    'via-map-last': { type: 'boolean', default: false },
    url: { type: 'string', default: 'http://localhost:4173/' },
    out: { type: 'string', default: 'playtest-out/solve' },
    touch: { type: 'boolean', default: false },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

if (args.deploy && args.order) throw new Error('--deploy와 --order는 같이 못 쓴다');
if ((args['via-map'] || args['via-map-last']) && !args.deploy) throw new Error('--via-map·--via-map-last는 --deploy와 같이 쓴다(세이브가 켜진 배포 순서라야 맵이 있다)');
if (args['via-map'] && args['via-map-last']) throw new Error('--via-map과 --via-map-last는 같이 못 쓴다');
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

interface FlowState { order: string[] | null; index: number; screen: string; phase: string; replay?: boolean; card?: 'full' | 'short' | null }
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
async function solveScreen(page: Page, screen: ScreenData, k: number, problems: string[], tagAs?: string): Promise<void> {
  const tag = tagAs ?? (ids.length > 1 ? `${k + 1}-${screen.id}` : screen.id);
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
 * 마지막이면 끝 카드(`cardLines`: 결과 줄 + `ui.end`)가 떠 있고 `ui.next`가 없는지(타이틀 전, 11-5절) 본다.
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

/** 마지막 판 끝 카드 본문(다음 줄 빼고). `main.ts` `placeClearCut`과 같이 `cardLines` 키를 줄바꿈으로 잇는다(#935). */
function endCardText(id: string): string {
  return cardLines(id, true, (k) => k in texts).body.map((k) => texts[k] ?? '').join('\n');
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
    const endText = endCardText(id);
    if (c.text !== endText) problems.push(`${tag}: 끝 카드 글이 ${JSON.stringify(endText)}가 아님: ${JSON.stringify(c.text)}`);
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

const mapShown = (page: Page) => page.evaluate<boolean>(`!document.querySelector('#map').hidden`);
/** 맵 카드 상태(`data-state`)와 초점 받은 카드 화면 id. */
const mapState = (page: Page) =>
  page.evaluate<{ cards: Record<string, string>; focus: string | null }>(`(() => {
    const cards = {};
    for (const b of document.querySelectorAll('#map .cards button')) cards[b.dataset.screen] = b.dataset.state;
    const a = document.activeElement;
    return { cards, focus: a && a.closest('#map') && a.dataset.screen ? a.dataset.screen : null };
  })()`);
const mapCardBox = (page: Page, id: string) =>
  page.evaluate<Rect | null>(`(() => { const b = document.querySelector('#map .cards button[data-screen="${id}"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);

async function waitHooks(page: Page): Promise<void> {
  for (let i = 0; !(await page.evaluate<boolean>(`typeof window.__gcLayout === 'function'`)); i++) {
    if (i > 100) throw new Error('5초 안에 window.__gcLayout 훅이 생기지 않음 (?playtest=1 빌드인가?)');
    await sleep(50);
  }
}

/**
 * `--via-map`·`--via-map-last` 뒷부분(#792 완료 조건 4, 설계 3-4절·7절 5번). `k`번째 판까지 깬 페이지를 같은 프로필로 다시 연다.
 * 타이틀 `マップ` → 맵(0..k cleared, 나머지 locked) → `k`번째 판 카드 → 시작 카드(첫 판이면 전체, 아니면 짧은 카드) → 다시 클리어 →
 * 카드 다음 줄이 `ui.map.return`(터치)·`_click`(마우스) → 탭 → 맵(그 판 카드에 초점). 마지막 판이면 카드 본문이 끝 카드 `ui.end`다.
 * 그동안 세이브가 그대로인지 본다.
 */
async function viaMap(page: Page, href: string, k: number, problems: string[]): Promise<void> {
  const id = ids[k]!;
  const last = k === ids.length - 1;
  const tag = `map-${id}`;
  const before = await savedOf(page);
  if (!before) return void problems.push(`${tag}: 첫 판을 깼는데 세이브가 없음`);
  await page.goto(href);
  await pressTitleMap(page, (at) => send(page, at));
  const m = await mapState(page);
  await page.screenshot(join(args.out!, `${tag}-0-map.png`));
  const wantCards = Object.fromEntries(ids.map((s, j) => [s, j <= k ? 'cleared' : 'locked']));
  if (JSON.stringify(m.cards) !== JSON.stringify(wantCards)) problems.push(`${tag}: 맵 카드 ${JSON.stringify(m.cards)} (기대 ${JSON.stringify(wantCards)})`);
  const box = await mapCardBox(page, id);
  const at = box && screenToInternal({ x: box.left + box.width / 2, y: box.top + box.height / 2 }, await canvasRect(page), { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
  if (!at) return void problems.push(`${tag}: 맵에 ${id} 카드가 없거나 가운데가 캔버스 밖`);
  await send(page, at);
  // 맵 → 어두워짐 → 그 판. 훅은 타이틀이 끝난 뒤 붙는다(타이틀이 판보다 먼저, top-level await).
  await waitHooks(page);
  const kind = await waitFor('맵에서 연 판 시작 카드가 안 뜸', () => flowOf(page), (f) => f?.card !== null && f?.card !== undefined);
  const wantKind = k === 0 ? 'full' : 'short';
  if (kind?.card !== wantKind) problems.push(`${tag}: 맵에서 연 판 시작 카드가 ${wantKind}가 아님(${kind?.card})`);
  await closeStartCard(page, (p) => send(page, p), { expect: true });
  const f = await flowOf(page);
  if (f?.screen !== id || f.index !== k || !f.replay) problems.push(`${tag}: 맵에서 연 판이 ${id} 다시 하기가 아님: ${JSON.stringify(f)}`);
  await waitIdle(page);
  await solveScreen(page, screens[k]!, k, problems, tag);
  if (problems.length) return;
  const c = await waitFor('다시 한 판 카드에 다음 줄이 안 보임', () => clearCard(page), (c) => c.next);
  await page.screenshot(join(args.out!, `${tag}-card.png`));
  const returns = [texts['ui.map.return'], texts['ui.map.return_click']].filter((x): x is string => x !== undefined);
  if (!returns.some((r) => c.text.endsWith(r))) problems.push(`${tag}: 카드 다음 줄이 ui.map.return이 아님: ${JSON.stringify(c.text)}`);
  if (last && !c.text.startsWith(endCardText(id))) problems.push(`${tag}: 마지막 판을 다시 깼는데 카드 본문이 끝 카드(결과 줄 + ui.end)가 아님: ${JSON.stringify(c.text)}`);
  const same = (s: SavedState | null) => s !== null && s.screenId === before.screenId && s.solved.join() === before.solved.join();
  const onCard = await savedOf(page);
  if (!same(onCard)) problems.push(`${tag}: 다시 깬 카드에서 세이브가 바뀜 ${JSON.stringify(onCard)} (전 ${JSON.stringify(before)})`);
  await send(page, CARD_TAP);
  await waitFor('카드를 눌렀는데 맵이 안 뜸', () => mapShown(page), (v) => v, 5000);
  const back = await mapState(page);
  await page.screenshot(join(args.out!, `${tag}-1-map-again.png`));
  if (back.focus !== id) problems.push(`${tag}: 돌아온 맵 초점이 ${id} 카드가 아님(${back.focus})`);
  const after = await savedOf(page);
  if (!same(after)) problems.push(`${tag}: 맵으로 돌아온 뒤 세이브가 바뀜 ${JSON.stringify(after)} (전 ${JSON.stringify(before)})`);
  if (!problems.length) console.log(`${tag} ✅ 타이틀 マップ → ${id} 다시 클리어 → ${JSON.stringify(c.text.split('\n').at(-1))} → 맵(초점 ${back.focus}), 세이브 checkpoint ${before.screenId}·깬 화면 ${before.solved.join(',')} 그대로`);
}

async function main(): Promise<number> {
  mkdirSync(args.out!, { recursive: true });
  const u = new URL(args.url!);
  u.searchParams.set('playtest', '1');
  const viaMapFirst = args['via-map'] === true;
  const viaMapLast = args['via-map-last'] === true;
  const viaMapMode = viaMapFirst || viaMapLast;
  if (viaMapMode) u.searchParams.set('title', '1');
  if (args.order) u.searchParams.set('order', ids.join(','));
  else if (!args.deploy) u.searchParams.set('screen', ids[0]!);
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const problems: string[] = [];
  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(u.href);
    if (viaMapMode) {
      // 타이틀이 판보다 먼저라 훅은 `はじめ` 뒤에 생긴다. 타이틀이 뜰 때까지 보고 지나간다(`passTitle`은 로딩 뒤 상태로 판단한다).
      await waitFor('타이틀이 안 뜸(`?playtest=1&title=1`을 모르는 빌드인가?)', () => page.evaluate<boolean>(`!document.querySelector('#title').hidden`), (v) => v, 15_000);
      await closeStartCard(page, (at) => send(page, at));
      await waitHooks(page);
    } else {
      await waitHooks(page);
      await closeStartCard(page, (at) => send(page, at));
    }
    await waitIdle(page);
    if (linked) {
      const f = await flowOf(page);
      if (!f?.order) throw new Error(`순서가 안 먹음(훅 __gcFlow: ${JSON.stringify(f)}). ${args.deploy ? '배포 순서(#766)' : '연결 2단계'} 이전 빌드인가?`);
      if (f.order.join() !== ids.join()) throw new Error(`게임 순서 ${f.order.join(',')}가 기대 ${ids.join(',')}와 다름(배포본이 로컬 order.json과 다른가?)`);
    }
    // `--via-map`은 첫 판만 깨고 둘째 판에 들어간 뒤(세이브: 첫 판 깸) 맵 길로 간다. `--via-map-last`는 끝 카드까지 다 깬 뒤 간다.
    for (const [k, screen] of (viaMapFirst ? screens.slice(0, 1) : screens).entries()) {
      await solveScreen(page, screen, k, problems);
      if (problems.length) break;
      if (linked) await crossCard(page, k, problems);
      else await soloCard(page, problems);
    }
    if (viaMapMode && !problems.length) await viaMap(page, u.href, viaMapFirst ? 0 : ids.length - 1, problems);
    if (!args.deploy && (await savedOf(page)) !== null) problems.push('세이브를 끄는 판(--order·--screen)인데 세이브가 생김');
    for (const e of page.errors) problems.push(`콘솔(${e.source}): ${e.text}`);
  } finally {
    await browser.close();
  }
  console.log(`URL: ${u.href}`);
  const all = screens.reduce((n, s) => n + s.solution!.length, 0);
  const acts = viaMapFirst ? 2 * screens[0]!.solution!.length : viaMapLast ? all + screens.at(-1)!.solution!.length : all;
  const route = viaMapFirst
    ? `${ids[0]} → ${ids[1]} 입구 → 타이틀 マップ → ${ids[0]} 다시 → 맵`
    : viaMapLast
      ? `${ids.join(' → ')} 끝 카드 → 타이틀 マップ → ${ids.at(-1)} 다시 → 끝 카드 → 맵`
      : ids.join(' → ');
  console.log(problems.length ? problems.map((p) => `❌ ${p}`).join('\n') : `✅ ${route} 클리어 (${acts}행동, ${input})`);
  return problems.length ? 1 : 0;
}

process.exitCode = await main();
