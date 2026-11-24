// 타이틀 화면(#792 2/3, 설계 `docs/design/title-and-map.md` 2절). 게임 판을 만들기 전에 띄우고, 버튼을 누르면 어디서 시작할지 돌려준다.
// 판단(버튼 조건·두 번 누르기·자리 숫자)은 `core/title.ts`. 여기서는 캔버스에 배경·캐릭터·로고를 그리고 DOM 버튼(`#title`)을 놓는다.
// 게임 루프·입력이 아직 없을 때 돌아서 게임 쪽 입력 게이트(카드·흐름)를 건드리지 않는다.

import raw from '../../public/ui/title-logo.json';
import { FX_COLORS } from '../core/fx';
import type { Loaded } from '../core/fallbacks';
import { INTERNAL_WIDTH } from '../core/config';
import { centerIn, createTitle, titleArmed, titleButtonBox, titleCrew, titleFadeCover, titlePress, TITLE_CONFIRM_KEY, TITLE_LAYOUT, TITLE_TEXT_KEYS, type TitleMenu } from '../core/title';
import { loadingDone } from '../core/restart';
import type { SaveData } from '../core/save/schema';
import { startFromSave } from '../core/progress';
import { assetUrl } from './assets';
import type { Display } from './display';
import { drawSceneBg, loadSceneArt } from './sceneArt';
import { drawSprite, spriteState } from './sprites';
import type { MapResult } from './map';

interface LogoMeta {
  image: string;
  cells: Record<'ja' | 'en', number[]>;
}
const LOGO = raw as LogoMeta;

/** 타이틀에서 고른 시작. `index`는 배포 순서 안 위치, `activeCharacter`는 세이브 것(`つづき`일 때만). */
export interface TitleStart {
  index: number;
  prev: SaveData | null;
  activeCharacter: string | null;
  /** 맵에서 깬 카드를 골랐다(다시 하기). 그 판 클리어 카드가 다음 판 대신 맵으로 돌아간다(3-4절). */
  replay?: true;
}

export interface TitleDeps {
  display: Display;
  menu: TitleMenu;
  order: readonly string[];
  text: (id: string) => string;
  build: string;
  /** `つづき`를 누른 순간 세이브를 다시 읽는다(오래 열린 탭의 옛 스냅샷, #876 Ben 리뷰). */
  reload: () => Promise<SaveData | null>;
  /** 세로 안내가 떠 있나. 떠 있으면 버튼을 안 받는다(9-5절). */
  rotating: () => boolean;
  /** `マップ`(3절). 맵을 띄우고 닫힐 때까지 기다린다. 메뉴에 `マップ`가 없으면 안 불린다. */
  openMap: () => Promise<MapResult>;
}

/** 캔버스를 0.3초 ink로 덮어 간다(2-4절, 11-1절). 다 검은 프레임을 그린 뒤 끝난다. 타이틀과 맵이 같이 쓴다. */
export function fadeOutCanvas(draw: (cover: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const from = performance.now();
    const step = (): void => {
      const cover = titleFadeCover(performance.now() - from);
      draw(cover);
      if (cover < 1) requestAnimationFrame(step);
      else resolve();
    };
    step();
  });
}

function need<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`${selector}가 index.html에 없습니다`);
  return el;
}

function loadLogo(): { image: HTMLImageElement; state: () => Loaded } {
  let state: Loaded = 'loading';
  const image = new Image();
  image.onload = () => (state = 'ready');
  // 404면 로고 없이 띄운다(로딩에 안 갇히게). 버튼은 글자라 그대로 쓸 수 있다.
  image.onerror = () => (state = 'none');
  image.src = assetUrl(`ui/${LOGO.image}`);
  return { image, state: () => state };
}

/**
 * 타이틀을 띄우고 시작 버튼이 눌릴 때까지 기다린다. 로딩(`#loading`)은 배경·캐릭터·로고가 올 때까지(상한 `LOAD_TIMEOUT_MS`) 그대로 둔다.
 * 누르면 `#title`을 숨기고 캔버스를 0.3초 어둡게 한 뒤(2-4절) 끝난다. `#loading`은 다시 띄우지 않는다:
 * 게임 쪽이 로딩이 0.5초를 넘길 때만 띄우고(`loadingTextShown`), 다 오면 0.3초 밝아진 뒤 시작 카드다.
 */
export function runTitle(deps: TitleDeps): Promise<TitleStart> {
  const { display, menu, order, text } = deps;
  const root = need<HTMLElement>(document, '#title');
  const list = need<HTMLElement>(root, '.buttons');
  const confirm = need<HTMLElement>(root, '.confirm');
  const loadingEl = need<HTMLElement>(document, '#loading');
  need<HTMLElement>(root, '.build').textContent = deps.build;
  confirm.textContent = text(TITLE_CONFIRM_KEY);

  const art = loadSceneArt(order[0]!);
  const logo = loadLogo();
  const crew = titleCrew();
  const states = (): Loaded[] => [!art?.bg ? 'none' : art.bgReady ? 'ready' : 'loading', logo.state(), ...crew.map((c) => spriteState(c.id))];
  const t0 = performance.now();
  const title = createTitle(menu);

  const buttons = menu.buttons.map((b, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.button = b;
    if (k === 0) el.dataset.primary = '';
    el.textContent = text(TITLE_TEXT_KEYS[b]);
    const box = titleButtonBox(k);
    // 자리는 내부 px 비율로 둔다. `#title`이 캔버스 크기를 따라가서 배율이 바뀌어도 다시 잴 것이 없다.
    el.style.left = `${(box.left / INTERNAL_WIDTH) * 100}%`;
    el.style.top = `${(box.top / display.internal.height) * 100}%`;
    el.style.width = `${(box.width / INTERNAL_WIDTH) * 100}%`;
    el.style.height = `${(box.height / display.internal.height) * 100}%`;
    list.append(el);
    return el;
  });

  return new Promise<TitleStart>((resolve) => {
    let shown = false;
    let done = false;
    /** 맵이 떠 있나. 그동안 타이틀은 그리지도 누르지도 않는다(캔버스는 맵이 쓴다). */
    let inMap = false;
    let frame = 0;

    /** `faded`: 맵이 이미 어둡게 덮었으면 타이틀 그림으로 다시 덮지 않는다. */
    function finish(start: TitleStart, faded = false): void {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      root.hidden = true;
      list.replaceChildren();
      // 어두워짐(2-4절, 11-1절 0.3초). 버튼 DOM은 바로 숨기고 캔버스(배경·셋·로고)만 ink로 덮어 간다. 다 검은 프레임을 그린 뒤 넘긴다.
      void (faded ? Promise.resolve() : fadeOutCanvas(draw)).then(() => {
        window.removeEventListener('resize', onResize);
        resolve(start);
      });
    }

    async function openMap(): Promise<void> {
      inMap = true;
      root.hidden = true;
      confirm.hidden = true;
      const r = await deps.openMap();
      if (r.kind === 'start') return finish(r.start, true);
      inMap = false;
      root.hidden = false;
      // 돌아오면 `マップ` 버튼에 초점(들어간 곳으로 돌아온다).
      buttons.find((el) => el.dataset.button === 'map')?.focus({ preventScroll: true });
    }

    async function press(el: HTMLButtonElement): Promise<void> {
      if (done || inMap || !shown || deps.rotating()) return;
      const b = el.dataset.button as keyof typeof TITLE_TEXT_KEYS;
      const action = titlePress(title, b, performance.now());
      if (!action) return;
      if (action.kind === 'map') return openMap();
      if (action.kind === 'arm') return; // 노랑·확인 줄은 프레임에서 `titleArmed`로 그린다
      if (b !== 'continue') return finish(action);
      // 다른 탭이 그 사이 더 갔으면 그 세이브로 이어 간다. 이어 할 곳이 없어졌으면(다른 탭이 다 깸) 처음 화면에서 그 세이브를 이어 쓴다.
      const fresh = startFromSave(await deps.reload().catch(() => null), order);
      if (!fresh.prev) return finish(action);
      finish(fresh.resume.kind === 'continue' ? { index: fresh.resume.index, prev: fresh.prev, activeCharacter: fresh.resume.activeCharacter } : { index: 0, prev: fresh.prev, activeCharacter: null });
    }
    for (const el of buttons) el.addEventListener('click', () => void press(el));

    function onResize(): void {
      display.resize();
    }
    window.addEventListener('resize', onResize);

    /** `cover`: 어두워짐 덮개(ink 불투명도). 0이면 안 그린다. */
    function draw(cover = 0): void {
      const { ctx, internal } = display;
      if (!drawSceneBg(ctx, art)) {
        ctx.fillStyle = FX_COLORS.ink;
        ctx.fillRect(0, 0, internal.width, internal.height);
      }
      ctx.save();
      ctx.globalAlpha = TITLE_LAYOUT.dim;
      ctx.fillStyle = FX_COLORS.ink;
      ctx.fillRect(0, 0, internal.width, internal.height);
      ctx.restore();
      // 셋은 덮개 위에 밝게(키 순서, 뒤 → 앞). 서 있기 첫 장, 오른쪽을 본다. 시트가 없으면 안 그린다(실루엣 대신 빈자리).
      const clockMs = performance.now() - t0;
      for (const c of crew) drawSprite(ctx, { id: c.id, x: c.x, y: c.y, target: null, facing: 1, walkTicks: 0 }, { walkedPx: null, holding: false, event: null, clockMs });
      if (logo.state() === 'ready') {
        for (const key of ['ja', 'en'] as const) {
          const [sx = 0, sy = 0, w = 0, h = 0] = LOGO.cells[key];
          const at = centerIn(TITLE_LAYOUT[key], w, h);
          ctx.drawImage(logo.image, sx, sy, w, h, at.x, at.y, w, h);
        }
      }
      if (cover > 0) {
        ctx.save();
        ctx.globalAlpha = cover;
        ctx.fillStyle = FX_COLORS.ink;
        ctx.fillRect(0, 0, internal.width, internal.height);
        ctx.restore();
      }
      display.present();
    }

    function placeRoot(): void {
      const r = display.rect();
      const scale = r.width / INTERNAL_WIDTH;
      const set = (k: 'left' | 'top' | 'width' | 'height', v: number): void => {
        const px = `${Math.round(v)}px`;
        if (root.style[k] !== px) root.style[k] = px;
      };
      set('left', r.left);
      set('top', r.top);
      set('width', r.width);
      set('height', r.height);
      const s = String(scale);
      if (root.style.getPropertyValue('--s') !== s) root.style.setProperty('--s', s);
    }

    function tick(): void {
      if (done) return;
      frame = requestAnimationFrame(tick);
      if (!shown) {
        if (!loadingDone(states(), performance.now() - t0)) return;
        shown = true;
        loadingEl.hidden = true;
        root.hidden = false;
        // 주 버튼에 초점(2-1절). Enter·Space로 바로 누른다.
        buttons[0]?.focus({ preventScroll: true });
      }
      if (inMap) return;
      draw();
      placeRoot();
      const armed = titleArmed(title, performance.now());
      for (const el of buttons) el.toggleAttribute('data-armed', armed && el.dataset.button === 'new');
      confirm.hidden = !armed;
    }
    tick();
  });
}
