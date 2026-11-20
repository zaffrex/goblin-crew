// QA용 브라우저 조작 (#516). 상태를 안 남기는 한 번짜리 실행이라, 매번 처음부터 actions 파일을 재생한 뒤 스크린샷을 찍는다.
// 입력은 실제 마우스 클릭/터치 탭뿐이다. 게임 내부 함수 호출, 소스·네트워크·콘솔 조회는 일부러 노출하지 않는다.
// 사용: node scripts/qa/browse.ts --url <URL> --viewport desktop|mobile --actions <파일> --shot <png> [--no-sandbox]
// actions 한 줄에 하나: `click <x> <y>` (스크린샷 픽셀 좌표) | `wait <ms>`. `#`로 시작하는 줄은 메모.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Browser, sleep } from '../playtest/cdp.ts';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'https://zaffrex.github.io/goblin-crew/' },
    viewport: { type: 'string', default: 'desktop' },
    actions: { type: 'string' },
    shot: { type: 'string' },
    'no-sandbox': { type: 'boolean', default: true },
  },
});
if (!args.shot) throw new Error('--shot <png> 필요');
const mobile = args.viewport === 'mobile';
if (args.viewport !== 'desktop' && !mobile) throw new Error('--viewport는 desktop 또는 mobile');
const url = new URL(args.url);
if (url.origin !== 'https://zaffrex.github.io' && url.hostname !== 'localhost') throw new Error('배포본 URL만 열 수 있어요');

const steps = args.actions
  ? readFileSync(args.actions, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : [];

const browser = await Browser.launch({ noSandbox: args['no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.init();
  await page.setViewport(mobile ? { width: 390, height: 844, dpr: 2, mobile: true } : { width: 1280, height: 720, dpr: 1, mobile: false });
  await page.goto(url.toString());
  await sleep(1500);
  for (const s of steps) {
    const [cmd, a, b] = s.split(/\s+/);
    if (cmd === 'click') {
      const p = { x: Number(a), y: Number(b) };
      if (mobile) await page.tap(p); else await page.click(p);
      await sleep(400);
    } else if (cmd === 'wait') await sleep(Math.min(Number(a), 5000));
    else throw new Error(`모르는 동작: ${s}`);
  }
  await page.screenshot(args.shot);
  console.log(`ok: ${steps.length} actions, screenshot ${args.shot}`);
} finally {
  await browser.close();
}
