// 아주 작은 Chrome DevTools Protocol 클라이언트. 의존성 없음 (Node 22 내장 WebSocket).
// 게임은 실제 입력 이벤트(Input.dispatchMouseEvent / dispatchTouchEvent)로만 움직인다.
// Runtime.evaluate는 관찰(좌표, DOM 상태 읽기)에만 쓴다 (docs/team/m1-acceptance.md 판정 1).

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Point } from './coords.ts';

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChrome(): string {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome을 찾지 못했어요. CHROME_PATH로 경로를 주세요.');
  return found;
}

type Json = Record<string, unknown>;
type Listener = (params: Json, sessionId?: string) => void;

export class Browser {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void }>();
  private readonly listeners = new Map<string, Listener[]>();

  private readonly ws: WebSocket;
  private readonly proc: ChildProcess;
  private readonly profileDir: string;

  // 매개변수 프로퍼티는 쓰지 않는다: Node의 타입 제거 실행(--experimental-strip-types)이 지원하지 않는다.
  private constructor(ws: WebSocket, proc: ChildProcess, profileDir: string) {
    this.ws = ws;
    this.proc = proc;
    this.profileDir = profileDir;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; method?: string; params?: Json; result?: Json; error?: { message: string }; sessionId?: string };
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result ?? {});
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params ?? {}, msg.sessionId);
      }
    });
  }

  /** headless Chrome을 새 프로필로 띄운다. 캐시 없는 첫 방문을 재기 위해 매번 새 프로필이다. */
  static async launch(opts: { noSandbox?: boolean } = {}): Promise<Browser> {
    const profileDir = mkdtempSync(join(tmpdir(), 'gc-playtest-'));
    const args = [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
      ...(opts.noSandbox ? ['--no-sandbox'] : []),
      'about:blank',
    ];
    const proc = spawn(findChrome(), args, { stdio: 'ignore' });
    const portFile = join(profileDir, 'DevToolsActivePort');
    const deadline = Date.now() + 15_000;
    while (!existsSync(portFile) || readFileSync(portFile, 'utf8').split('\n').length < 2) {
      if (Date.now() > deadline || proc.exitCode !== null) {
        proc.kill();
        throw new Error('Chrome이 디버깅 포트를 열지 않았어요 (샌드박스 문제면 --no-sandbox)');
      }
      await sleep(50);
    }
    const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP WebSocket 연결 실패')), { once: true });
    });
    return new Browser(ws, proc, profileDir);
  }

  send(method: string, params: Json = {}, sessionId?: string): Promise<Json> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method: string, fn: Listener): void {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn]);
  }

  /** 새 브라우저 컨텍스트(쿠키·캐시·localStorage 분리)에 탭 하나. 뷰포트마다 따로 쓴다. */
  async newPage(): Promise<Page> {
    const { browserContextId } = (await this.send('Target.createBrowserContext')) as { browserContextId: string };
    const { targetId } = (await this.send('Target.createTarget', { url: 'about:blank', browserContextId })) as { targetId: string };
    const { sessionId } = (await this.send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
    const page = new Page(this, sessionId);
    await page.init();
    return page;
  }

  async close(): Promise<void> {
    try {
      await Promise.race([this.send('Browser.close'), sleep(2000)]);
    } catch {
      // 이미 닫힘
    }
    this.ws.close();
    this.proc.kill();
    rmSync(this.profileDir, { recursive: true, force: true });
  }
}

export interface ConsoleError {
  source: 'console' | 'exception' | 'log';
  text: string;
}

export class Page {
  readonly errors: ConsoleError[] = [];
  private loadWaiters: (() => void)[] = [];

  private readonly browser: Browser;
  private readonly sessionId: string;

  constructor(browser: Browser, sessionId: string) {
    this.browser = browser;
    this.sessionId = sessionId;
    browser.on('Runtime.consoleAPICalled', (p, sid) => {
      if (sid !== this.sessionId || p.type !== 'error') return;
      const args = (p.args as { value?: unknown; description?: string }[]) ?? [];
      this.errors.push({ source: 'console', text: args.map((a) => a.description ?? String(a.value)).join(' ') });
    });
    browser.on('Runtime.exceptionThrown', (p, sid) => {
      if (sid !== this.sessionId) return;
      const d = p.exceptionDetails as { text?: string; exception?: { description?: string } };
      this.errors.push({ source: 'exception', text: d.exception?.description ?? d.text ?? 'exception' });
    });
    // 네트워크 실패(404 등)는 콘솔 API가 아니라 Log 도메인으로 온다.
    browser.on('Log.entryAdded', (p, sid) => {
      if (sid !== this.sessionId) return;
      const e = p.entry as { level: string; text: string; url?: string };
      if (e.level === 'error') this.errors.push({ source: 'log', text: `${e.text}${e.url ? ` (${e.url})` : ''}` });
    });
    browser.on('Page.loadEventFired', (_p, sid) => {
      if (sid !== this.sessionId) return;
      const waiters = this.loadWaiters;
      this.loadWaiters = [];
      for (const w of waiters) w();
    });
  }

  send(method: string, params: Json = {}): Promise<Json> {
    return this.browser.send(method, params, this.sessionId);
  }

  async init(): Promise<void> {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
    await this.send('Network.setCacheDisabled', { cacheDisabled: true });
  }

  /** 뷰포트. 모바일이면 터치 이벤트를 켠다(마우스 이벤트를 터치로 바꾸지는 않는다). */
  async setViewport(v: { width: number; height: number; dpr: number; mobile: boolean }): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: v.width,
      height: v.height,
      deviceScaleFactor: v.dpr,
      mobile: v.mobile,
    });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: v.mobile, maxTouchPoints: v.mobile ? 5 : 1 });
  }

  /** 문서가 만들어질 때마다 먼저 돌 스크립트. 관찰용 기록기만 넣는다. */
  async addInitScript(source: string): Promise<void> {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async goto(url: string, timeoutMs = 15_000): Promise<void> {
    const loaded = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`load 이벤트 시간 초과: ${url}`)), timeoutMs);
      this.loadWaiters.push(() => {
        clearTimeout(t);
        resolve();
      });
    });
    const res = (await this.send('Page.navigate', { url })) as { errorText?: string };
    if (res.errorText) throw new Error(`이동 실패 ${url}: ${res.errorText}`);
    await loaded;
  }

  /** 관찰 전용. 페이지에서 식을 계산해 JSON 값으로 받는다. */
  async evaluate<T>(expression: string): Promise<T> {
    const r = (await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })) as {
      result: { value?: T };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    };
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  }

  /** 마우스 왼쪽 클릭 (CSS px). */
  async click(p: Point): Promise<void> {
    const base = { x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' };
    await this.send('Input.dispatchMouseEvent', { ...base, type: 'mouseMoved' });
    await this.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed', buttons: 1 });
    await this.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
  }

  /** 손가락 한 번 탭 (CSS px). 선택+실행이 "탭 2번"인 UI라면 이걸 두 번 부른다 (ADR-0007 결정 5). */
  async tap(p: Point): Promise<void> {
    await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
    await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  async screenshot(file: string): Promise<void> {
    const { data } = (await this.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
    writeFileSync(file, Buffer.from(data, 'base64'));
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
