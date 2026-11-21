// QA용 브라우저 조작 (#516). 상태를 안 남기는 한 번짜리 실행이라, 매번 처음부터 actions 파일을 재생한 뒤 스크린샷을 찍는다.
// 입력은 실제 마우스 클릭/터치 탭뿐이다. 게임 내부 함수 호출, 소스·네트워크·콘솔 조회는 일부러 노출하지 않는다.
// 사용: node scripts/qa/browse.ts --url <URL> --viewport desktop|mobile (--actions <파일> | --steps "<동작>; <동작>") --shot <png> [--no-sandbox]
// 동작 하나: `click <x> <y>` (스크린샷 픽셀 좌표) | `wait <ms>`. 파일은 한 줄에 하나, `--steps`는 `;`로 구분. `#`로 시작하면 메모.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { Browser, sleep } from '../playtest/cdp.ts';
import { parseSteps } from './steps.ts';
import { assertPlayableUrl } from './url-guard.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    viewport: { type: 'string', default: 'desktop' },
    actions: { type: 'string' },
    steps: { type: 'string' },
    shot: { type: 'string' },
    'no-sandbox': { type: 'boolean', default: true },
  },
});
if (!args.shot) throw new Error('--shot <png> 필요');
const mobile = args.viewport === 'mobile';
if (args.viewport !== 'desktop' && !mobile) throw new Error('--viewport는 desktop 또는 mobile');
const url = assertPlayableUrl(args.url);

if (args.actions && args.steps) throw new Error('--actions와 --steps 중 하나만');
const steps = parseSteps(args.actions ? readFileSync(args.actions, 'utf8') : (args.steps ?? ''));
mkdirSync(dirname(args.shot), { recursive: true });

const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.init();
  const vp = mobile ? { width: 390, height: 844, dpr: 2, mobile: true } : { width: 1280, height: 720, dpr: 1, mobile: false };
  await page.setViewport(vp);
  await page.goto(url.toString());
  await sleep(1500);
  for (const s of steps) {
    if (s.cmd === 'click') {
      // 스크린샷은 기기 픽셀(모바일 780x1688)이고 입력 이벤트는 CSS 픽셀(390x844)이다. 스크린샷 좌표를 dpr로 나눠 넘긴다.
      const p = { x: s.x / vp.dpr, y: s.y / vp.dpr };
      if (mobile) await page.tap(p); else await page.click(p);
      await sleep(400);
    } else await sleep(s.ms);
  }
  await page.screenshot(args.shot);
  console.log(`ok: ${steps.length} actions, screenshot ${args.shot}`);
} finally {
  await browser.close();
}
