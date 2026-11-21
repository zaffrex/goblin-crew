// M1 재생 도구 1부: 배포본 스모크 (#101).
// 뷰포트 여러 개(데스크톱 2, 휴대폰 가로 3, 휴대폰 세로 1, 세로 모니터 1)에서 열고, 실제 마우스 클릭/터치 탭이 게임까지 가는지, 콘솔 에러(A4), 첫 화면 시간(A5)을 본다.
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
  /** CSS 배율 1.2 미만이라 압축 모양(`#card[data-tight]`, `#hudtags[data-tight]`)이어야 하는 뷰포트. 아래 TIGHT_STATE가 맞는지 본다. */
  tight?: true;
}

const VIEWPORTS: Viewport[] = [
  { name: 'desktop-1280x720', width: 1280, height: 720, dpr: 1, mobile: false },
  // 큰 데스크톱(CSS 배율 4). 고정 px 글자가 작게 뜨는 것(#336·#337)은 여기서만 보인다.
  { name: 'desktop-1920x1080', width: 1920, height: 1080, dpr: 1, mobile: false },
  { name: 'mobile-844x390', width: 844, height: 390, dpr: 3, mobile: true },
  // 작은 폰 가로(iPhone SE급). #713 뒤 CSS 배율 1.39라 압축 모양이 **아니다**(흔한 폰 회귀용).
  { name: 'mobile-667x375', width: 667, height: 375, dpr: 2, mobile: true },
  // 1.2배 미만이 실제로 나오는 화면(#714): 640×360 안드로이드 가로에서 주소창이 높이를 줄인 경우. CSS 배율 1.11이라
  // 카드·HUD 이름표가 압축 모양이 된다(#335, #325). ui-detail-checklist M1과 같은 크기.
  { name: 'mobile-640x300', width: 640, height: 300, dpr: 2, mobile: true, tight: true },
  { name: 'portrait-390x844', width: 390, height: 844, dpr: 3, mobile: true },
  // 세로 모니터(마우스). 너비 667 이상이라 세로 안내가 **안** 뜨고 그대로 플레이된다(설계 9-1절 경계, #624).
  { name: 'portrait-1080x1920', width: 1080, height: 1920, dpr: 1, mobile: false },
];

/** 세로 안내가 떠야 하는 뷰포트(설계 9-1절: 세로이고 너비 667 미만). `core/rotate.ts` ROTATE_QUERY와 같은 경계. */
const wantsRotate = (v: Viewport): boolean => v.width < v.height && v.width < 667;

/**
 * 세로 안내 검사(#624, 설계 9-6절). 안내가 떠야 하면: 창 전체를 덮고, 창 가운데·시작 카드 자리·목표 줄 자리에서
 * 맨 위 요소가 `#rotate`(또는 자식)이고, 보이는 글이 입력 방식과 맞다. 안 떠야 하면: 숨어 있다(회귀 없음).
 */
const ROTATE_CHECK = (want: boolean, touch: boolean) => `(() => {
  const r = document.querySelector('#rotate');
  if (!r) return ['#rotate 없음'];
  const shown = getComputedStyle(r).display !== 'none';
  if (!${want}) return shown ? ['떠서는 안 되는데 보임'] : [];
  if (!shown) return ['안 보임'];
  const out = [];
  const b = r.getBoundingClientRect();
  if (b.left > 0.5 || b.top > 0.5 || b.right < innerWidth - 0.5 || b.bottom < innerHeight - 0.5) out.push('창 전체를 덮지 않음');
  const spot = (name, el) => {
    if (!el || el.hidden) return;
    const e = el.getBoundingClientRect();
    const top = document.elementFromPoint(e.left + e.width / 2, e.top + e.height / 2);
    if (!top || !r.contains(top)) out.push(name + ' 자리 맨 위가 #rotate가 아님(' + (top ? top.id || top.tagName : 'null') + ')');
  };
  spot('창 가운데', { getBoundingClientRect: () => ({ left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }) });
  spot('시작 카드', document.querySelector('#card'));
  spot('목표 줄', document.querySelector('#hud'));
  const visible = [...r.querySelectorAll('span')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent);
  const want = ${touch} ? 'スマホを横にして遊ぼう！' : 'ウィンドウを横に広げて遊ぼう！';
  if (visible.length !== 1 || visible[0] !== want) out.push('글 [' + visible.join(', ') + '] ≠ ' + want);
  return out;
})()`;

/** 시작 카드 맞춤 검사(#335). 카드가 없으면 빈 목록(카드 없음은 아래 경고가 잡는다). */
const CARD_FIT = `(() => {
  const c = document.querySelector('#card');
  if (!c || c.hidden) return [];
  const out = [];
  if (c.scrollHeight > c.clientHeight + 1) out.push('세로 스크롤 ' + c.scrollHeight + ' > ' + c.clientHeight + 'px');
  if (c.scrollWidth > c.clientWidth + 1) out.push('가로 스크롤 ' + c.scrollWidth + ' > ' + c.clientWidth + 'px');
  const b = c.getBoundingClientRect();
  const s = c.querySelector('.start')?.getBoundingClientRect();
  if (!s) out.push('.start 없음');
  else if (s.bottom > b.bottom + 1 || s.bottom > innerHeight) out.push('시작 줄이 카드/창 아래로 잘림');
  if (b.top < 0 || b.left < 0 || b.right > innerWidth || b.bottom > innerHeight) out.push('카드가 창 밖으로 나감');
  return out;
})()`;

/** 압축 모양 여부(#714): 시작 카드와 HUD 이름표 층의 `data-tight`. 카드가 없으면 null. */
const TIGHT_STATE = `({
  card: document.querySelector('#card:not([hidden])')?.hasAttribute('data-tight') ?? null,
  tags: document.querySelector('#hudtags')?.hasAttribute('data-tight') ?? null,
})`;

/**
 * 목표 줄 맞춤 검사(#336, 설계 6-2-2절): 캔버스 안, 오른쪽 끝이 내부 x 118(`core/hud.ts` `GOAL_RIGHT`, 둥지 그림 앞) 이하,
 * 글이 상자 밖으로 넘치지 않음. 숨겨져 있으면(클리어) 빈 목록.
 */
const GOAL_RIGHT = 118;
const GOAL_FIT = `(() => {
  const h = document.querySelector('#hud');
  const c = document.querySelector('#game');
  if (!h || !c) return ['#hud 또는 #game 없음'];
  if (h.hidden) return [];
  const b = h.getBoundingClientRect();
  const g = c.getBoundingClientRect();
  const out = [];
  if (b.left < g.left - 0.5 || b.top < g.top - 0.5) out.push('게임 화면 밖에서 시작 (' + Math.round(b.left - g.left) + ',' + Math.round(b.top - g.top) + ')');
  const right = ((b.right - g.left) * 480) / g.width;
  if (right > ${GOAL_RIGHT} + 0.5) out.push('오른쪽 끝 내부 x ' + right.toFixed(1) + ' > ${GOAL_RIGHT} (둥지를 가림)');
  if (h.scrollWidth > h.clientWidth + 1) out.push('글이 상자 밖으로 넘침 ' + h.scrollWidth + ' > ' + h.clientWidth + 'px');
  return out;
})()`;

/**
 * 얼굴 이름표 틈 검사(#675, 설계 6-4-2절): 이웃 얼굴 이름표(`.hudtag[data-anchor="top-center"]`) 사이가 CSS 1px 이상 떨어져 있다.
 * 이름 4자 규칙(ja-text 2절)은 글자 수로만 세서, 작은 가나 없는 전각 4자 이름은 통과해도 1.0배에서 겹칠 수 있다. 실폭은 여기서 본다.
 * 틈은 결과에 같이 적는다(PR에 실측값을 남기기 위해).
 */
const FACE_TAG_MIN_GAP = 1;
const FACE_TAG_GAPS = `(() => {
  const tags = [...document.querySelectorAll('.hudtag[data-anchor="top-center"]')]
    .filter((el) => !el.hidden && getComputedStyle(el).display !== 'none')
    .map((el) => ({ text: el.textContent, b: el.getBoundingClientRect() }))
    .sort((a, b) => a.b.left - b.b.left);
  return tags.slice(1).map((t, i) => ({ pair: tags[i].text + '–' + t.text, gap: Math.round((t.b.left - tags[i].b.right) * 10) / 10 }));
})()`;

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
  /** 얼굴 이름표 이웃 틈(CSS px, #675). */
  faceTagGaps?: { pair: string; gap: number }[];
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

  // A6①: 세로 회전 안내(#624). 작은 세로 화면은 안내만 보고 끝낸다(게임 입력은 안내가 삼킨다). 카드 맞춤 검사도 안내 뒤라 안 한다.
  const rotate = wantsRotate(v);
  for (const p of await page.evaluate<string[]>(ROTATE_CHECK(rotate, v.mobile))) r.problems.push(`세로 안내: ${p}`);
  if (rotate) {
    if (page.errors.length > 0) r.problems.push(`A4 콘솔 에러 ${page.errors.length}개`);
    return r;
  }

  // 입력 경로: 실제 이벤트 → 브라우저 → 게임. 모바일은 터치, 데스크톱은 마우스.
  const sent = v.mobile ? 'touch' : 'mouse';
  // 시작 카드가 스크롤 없이 다 보이나(#335): 카드 안 스크롤이 없고, 시작 줄이 카드·창 안에 있고, 글 줄이 카드 폭을 넘지 않는다.
  for (const p of await page.evaluate<string[]>(CARD_FIT)) r.problems.push(`시작 카드: ${p}`);
  // 압축 모양이 기대와 같은가(#714): 1.2배 미만 뷰포트가 압축 경로를 실제로 지나야 위 맞춤 검사가 그 경로를 잰다.
  const tight = await page.evaluate<{ card: boolean | null; tags: boolean | null }>(TIGHT_STATE);
  const wantTight = v.tight === true;
  if (tight.card !== null && tight.card !== wantTight) r.problems.push(`시작 카드: data-tight ${tight.card} ≠ 기대 ${wantTight}`);
  if (tight.tags !== null && tight.tags !== wantTight) r.problems.push(`얼굴 이름표: data-tight ${tight.tags} ≠ 기대 ${wantTight}`);
  // 시작 줄 문구가 입력 방식과 맞나(#364): 터치 에뮬레이션이면 タップ, 마우스면 クリック.
  const start = await page.evaluate<string | null>(`document.querySelector('#card:not([hidden]) .start')?.textContent ?? null`);
  const want = v.mobile ? 'タップ' : 'クリック';
  if (start !== null && !start.includes(want)) r.problems.push(`시작 카드: 시작 줄 \`${start}\`에 ${want}가 없음`);
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
  const tagGaps = await page.evaluate<{ pair: string; gap: number }[]>(FACE_TAG_GAPS);
  if (tagGaps.length !== 2) r.problems.push(`얼굴 이름표: 이웃 쌍이 ${tagGaps.length}개 (2개여야 함)`);
  for (const g of tagGaps) {
    if (g.gap < FACE_TAG_MIN_GAP) r.problems.push(`얼굴 이름표: ${g.pair} 틈 ${g.gap}px < ${FACE_TAG_MIN_GAP}px`);
  }
  r.faceTagGaps = tagGaps;
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
  for (const p of await page.evaluate<string[]>(GOAL_FIT)) r.problems.push(`목표 줄: ${p}`);
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
  const gaps = results.filter((r) => r.faceTagGaps?.length);
  if (gaps.length > 0) {
    lines.push('', '얼굴 이름표 틈(CSS px, #675): ' + gaps.map((r) => `${r.viewport.name} ${r.faceTagGaps!.map((g) => `${g.pair} ${g.gap}`).join(' / ')}`).join(', '));
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
