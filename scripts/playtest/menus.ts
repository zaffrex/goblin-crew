// 타이틀·맵 프레임 (#792 설계 `title-and-map.md` 6절, 보이는 모양 체크리스트 3-1절).
// 쿼리 없는 기본 링크를 세이브 상태 셋(없음 / 일부 깸 / 다 깸)으로 열어 타이틀과 맵을 찍는다. 판은 안 푼다.
// 세이브는 문서가 만들어지기 전에 localStorage에 심는다(`seed.ts`, 게임과 같은 `saveOnCard`로 만든 값). 게임 함수는 안 부른다.
// 누르는 것은 실제 클릭·탭이다: `はじめ` 첫 누름(확인 줄), `マップ`, 잠긴 카드(잠금 안내 줄).
// 통과/실패는 사람이 스크린샷을 보고 정한다. 이 도구가 실패하는 것은 "버튼·카드 상태가 기대와 다름"과 콘솔 에러뿐이다.
//
// 사용: node --import ./scripts/playtest/register.mjs scripts/playtest/menus.ts [--url <URL>] [--out <폴더>] [--view D1,M1|all | --touch] [--no-sandbox]
//   --view: 체크리스트 1절 화면 크기 이름(D1·D4·M3·M1, 쉼표로 여럿, `all`은 넷 다). 기본 D1, `--touch`만 주면 M3(#922 때와 같음). 둘을 같이 주면 에러.
//   M3·M1은 탭, D1·D4는 클릭으로 누른다.
// 결과: <out>/<D1|D4|M3|M1>-<none|some|all>-{title,title-confirm,map,map-locked}.png + <out>/report.md
// 맵에서 다시 깬 카드·돌아온 맵은 `solve.ts --deploy --via-map(-last) --out`이 찍는다(판을 실제로 풀어야 해서).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../src/core/config.ts';
import { titleMenu } from '../../src/core/title.ts';
import { screenToInternal } from '../../src/core/viewport.ts';
import { pressTitleMap } from './card.ts';
import { Browser, sleep, type Page } from './cdp.ts';
import { internalToPage, type Rect } from './coords.ts';
import { MENU_STATES, menuSeed, seedScript, type MenuState } from './seed.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    out: { type: 'string', default: 'playtest-out/menus' },
    view: { type: 'string' },
    touch: { type: 'boolean', default: false },
    'no-sandbox': { type: 'boolean', default: false },
  },
});

const ORDER = JSON.parse(readFileSync('content/screens/order.json', 'utf8')) as string[];
const TEXT = JSON.parse(readFileSync('content/text/ja.json', 'utf8')) as Record<string, string>;
const first = JSON.parse(readFileSync(`content/screens/${ORDER[0]}.json`, 'utf8')) as { start: { at: Record<string, unknown> } };
const ACTIVE = Object.keys(first.start.at)[0]!;

interface View {
  name: string;
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
}
/** `docs/design/ui-detail-checklist.md` 1절 표와 같은 네 크기. 휴대폰(mobile)은 탭으로 누른다. */
const VIEWS: Record<string, View> = {
  D1: { name: 'D1', width: 1280, height: 720, dpr: 1, mobile: false },
  D4: { name: 'D4', width: 1920, height: 1080, dpr: 1, mobile: false },
  M3: { name: 'M3', width: 844, height: 390, dpr: 3, mobile: true },
  // CSS 배율 1.11: 1.2배 미만 압축 모양이 실제로 나오는 화면(#714).
  M1: { name: 'M1', width: 640, height: 300, dpr: 2, mobile: true },
};
// 클릭·탭은 크기(`mobile`)가 정한다. 둘 다 주면 `--touch`가 말없이 무시되므로 막는다(#926 Sam nit).
if (args.view !== undefined && args.touch) throw new Error('--view와 --touch는 같이 못 써요. 탭은 M3·M1이 알아서 해요');
const viewNames = (args.view ?? (args.touch ? 'M3' : 'D1')).trim();
const RUN_VIEWS = (viewNames === 'all' ? Object.keys(VIEWS) : viewNames.split(',').map((n) => n.trim().toUpperCase())).map((n) => {
  const v = VIEWS[n];
  if (!v) throw new Error(`--view ${n}: ${Object.keys(VIEWS).join('·')}·all 중 하나`);
  return v;
});

const box = `(e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }`;
const canvasRect = (page: Page) => page.evaluate<Rect>(`(${box})(document.querySelector('#game'))`);
const shown = (page: Page, sel: string) => page.evaluate<boolean>(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.hidden; })()`);

async function tap(page: Page, view: View, at: { x: number; y: number }): Promise<void> {
  const p = internalToPage(at, await canvasRect(page));
  if (view.mobile) await page.tap(p);
  else await page.click(p);
}

async function waitFor(what: string, ok: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await ok())) {
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms: ${what}`);
    await sleep(50);
  }
}

/** DOM 요소 가운데를 게임 내부 좌표로(가운데가 캔버스 밖이면 null). */
async function centerOf(page: Page, sel: string): Promise<{ x: number; y: number } | null> {
  const r = await page.evaluate<Rect | null>(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? (${box})(e) : null; })()`);
  if (!r) return null;
  return screenToInternal({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, await canvasRect(page), { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
}

interface Shot {
  view: string;
  state: MenuState;
  file: string;
  note: string;
}

async function oneState(browser: Browser, view: View, state: MenuState, shots: Shot[], problems: string[]): Promise<void> {
  const tag = `${view.name}-${state}`;
  const save = menuSeed(state, ORDER, ACTIVE);
  const want = titleMenu(save, ORDER).buttons;
  const page = await browser.newPage();
  await page.setViewport(view);
  await page.addInitScript(seedScript(save));
  await page.goto(args.url!);
  await waitFor('타이틀이 안 뜸(쿼리 있는 URL인가? 세이브가 꺼진 빌드인가?)', () => shown(page, '#title'));
  // 버튼이 다 놓인 뒤(한 프레임) 찍는다.
  await sleep(300);
  const got = await page.evaluate<{ buttons: string[]; labels: string[] }>(`(() => {
    const bs = [...document.querySelectorAll('#title .buttons button')];
    return { buttons: bs.map((b) => b.dataset.button), labels: bs.map((b) => b.textContent) };
  })()`);
  const shot = async (name: string, note: string) => {
    const file = `${tag}-${name}.png`;
    await page.screenshot(join(args.out!, file));
    shots.push({ view: view.name, state, file, note });
  };
  await shot('title', `버튼 ${got.labels.join(' / ')}`);
  if (got.buttons.join() !== want.join()) problems.push(`${tag}: 타이틀 버튼 ${got.buttons.join(',')} (기대 ${want.join(',')})`);

  // 세이브가 있을 때만 `はじめ`가 확인을 받는다(2-3절).
  if (titleMenu(save, ORDER).newNeedsConfirm) {
    const at = await centerOf(page, '#title button[data-button="new"]');
    if (!at) problems.push(`${tag}: \`はじめ\` 가운데가 캔버스 밖`);
    else {
      await tap(page, view, at);
      try {
        await waitFor('`はじめ` 첫 누름 뒤 확인 줄이 안 뜸', () => shown(page, '#title .confirm'), 2000);
        await shot('title-confirm', `확인 줄 ${JSON.stringify(TEXT['ui.title.new_confirm'])}`);
      } catch (e) {
        problems.push(`${tag}: ${(e as Error).message}`);
      }
      // 두 번째 누름이 안 되게 확인이 풀릴 때까지 기다린다(3초, `RESTART_ARM_MS`).
      await waitFor('확인 줄이 3초 뒤에도 안 사라짐', async () => !(await shown(page, '#title .confirm')), 5000);
      if (!(await shown(page, '#title'))) return void problems.push(`${tag}: 확인 줄 뒤 타이틀이 닫힘(세이브가 지워졌을 수 있음)`);
    }
  }

  if (want.includes('map')) {
    await pressTitleMap(page, (at) => tap(page, view, at));
    await sleep(300);
    const cards = await page.evaluate<Record<string, string>>(`Object.fromEntries([...document.querySelectorAll('#map .cards button')].map((b) => [b.dataset.screen, b.dataset.state]))`);
    const solved = new Set(save?.progress.solvedScreens ?? []);
    const wantCards = Object.fromEntries(ORDER.map((id) => [id, solved.has(id) ? 'cleared' : 'locked']));
    if (JSON.stringify(cards) !== JSON.stringify(wantCards)) problems.push(`${tag}: 맵 카드 ${JSON.stringify(cards)} (기대 ${JSON.stringify(wantCards)})`);
    await shot('map', `카드 ${ORDER.map((id) => `${id}:${cards[id]}`).join(' · ')}`);
    const locked = ORDER.find((id) => cards[id] === 'locked');
    if (locked) {
      const at = await centerOf(page, `#map .cards button[data-screen="${locked}"]`);
      if (!at) problems.push(`${tag}: 잠긴 카드 ${locked} 가운데가 캔버스 밖`);
      else {
        await tap(page, view, at);
        try {
          await waitFor('잠긴 카드를 눌렀는데 잠금 안내 줄이 안 뜸', () => shown(page, '#map .locked'), 1000);
          await shot('map-locked', `${locked} 누른 직후, ${JSON.stringify(TEXT['ui.map.locked'])}`);
        } catch (e) {
          problems.push(`${tag}: ${(e as Error).message}`);
        }
      }
    }
  }
  for (const e of page.errors) problems.push(`${tag}: 콘솔 ${e.source}: ${e.text}`);
}

async function main(): Promise<number> {
  mkdirSync(args.out!, { recursive: true });
  const u = new URL(args.url!);
  if ([...u.searchParams.keys()].length) throw new Error(`--url에 쿼리가 있으면 타이틀을 건너뛴다(${u.search}). 쿼리 없는 주소를 준다`);
  const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
  const shots: Shot[] = [];
  const problems: string[] = [];
  try {
    // 상태마다 새 컨텍스트(localStorage 분리)라 서로 안 섞인다.
    for (const view of RUN_VIEWS) for (const state of MENU_STATES) await oneState(browser, view, state, shots, problems);
  } finally {
    await browser.close();
  }
  const report = [
    `# 타이틀·맵 프레임 (${RUN_VIEWS.map((v) => `${v.name} ${v.width}×${v.height} @${v.dpr}`).join(', ')}, ${args.url})`,
    '',
    `순서 ${ORDER.join(' → ')}. 체크리스트 \`docs/design/ui-detail-checklist.md\` 3-1절 표로 본다.`,
    '',
    '| 크기 | 세이브 | 파일 | 메모 |',
    '|---|---|---|---|',
    ...shots.map((s) => `| ${s.view} | ${s.state} | \`${s.file}\` | ${s.note} |`),
    '',
    problems.length ? `## 문제 ${problems.length}\n\n${problems.map((p) => `- ${p}`).join('\n')}` : '문제 0',
    '',
  ].join('\n');
  writeFileSync(join(args.out!, 'report.md'), report);
  console.log(report);
  return problems.length ? 1 : 0;
}

process.exitCode = await main();
