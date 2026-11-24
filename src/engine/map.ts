// 깬 판 맵(#792 3/3, 설계 `docs/design/title-and-map.md` 3절). 타이틀 `マップ`에서 연다.
// 판단(카드 깸/잠금, 누르면 어디서 시작)은 `core/title.ts`, 자리·썸네일·잠금 줄 숫자는 `core/map.ts`.
// 여기서는 캔버스에 바탕·길·카드·썸네일·도장을 그리고 DOM 버튼(`#map`)을 놓는다. 타이틀처럼 게임 루프 전에 돈다.

import mapJson from '../../content/map.json';
import { MAP_COLORS, MAP_LAYOUT, MAP_LOCKED_DIM, MAP_TEXT_KEYS, mapCardBox, mapLockedShown, mapPathDots, mapStampAt, mapThumbBox, thumbOrigin, type Box } from '../core/map';
import { mapCards, mapPress, type MapCard } from '../core/title';
import { INTERNAL_WIDTH } from '../core/config';
import { BOSONG_32 } from '../core/sceneFx';
import { sceneDraws, type SceneView } from '../core/sceneArt';
import type { SaveData } from '../core/save/schema';
import type { Display } from './display';
import { drawHudIcon } from './hudIcons';
import { drawSceneBg, drawSceneFrame, drawSceneFx, loadSceneArt, type SceneArt } from './sceneArt';
import type { TitleStart } from './title';

/** 맵을 닫은 결과. `back`이면 타이틀로, `start`면 그 판 처음부터(다시 하기). */
export type MapResult = { kind: 'back' } | { kind: 'start'; start: TitleStart };

export interface MapDeps {
  display: Display;
  order: readonly string[];
  /** 타이틀이 본 세이브(`startFromSave`를 거친 `prev`). 카드 깸/잠금을 고른다. */
  prev: SaveData | null;
  text: (id: string) => string;
  /** 깬 카드를 누른 순간 세이브를 다시 읽는다(오래 열린 탭, `つづき`와 같은 이유). */
  reload: () => Promise<SaveData | null>;
  /** 그 판 시작 상태의 그림 보기(캐릭터 없음, 3-3절). 화면 데이터가 없으면 null. */
  startView: (screenId: string, art: SceneArt) => SceneView | null;
  rotating: () => boolean;
  /** 맵을 닫고 판을 시작할 때 캔버스를 0.3초 어둡게 한다(타이틀과 같은 덮개). 다 어두워지면 끝난다. */
  fadeOut: (draw: (cover: number) => void) => Promise<void>;
}

function need<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`${selector}가 index.html에 없습니다`);
  return el;
}

const color = (k: keyof typeof MAP_COLORS): string => BOSONG_32[MAP_COLORS[k]]!;

/** 썸네일 하나: 시작 상태 장면을 화면 크기 캔버스에 한 번 그려 두고, 매 프레임 그 자리만 1:1로 자른다. */
interface Thumb {
  art: SceneArt | null;
  origin: { x: number; y: number } | null;
  /** 다 그린 장면(그림이 다 온 뒤 한 번). 아직이면 null. */
  scene: HTMLCanvasElement | null;
}

/**
 * 맵을 띄우고 돌아가기 또는 깬 카드가 눌릴 때까지 기다린다. 썸네일 그림은 기다리지 않는다(오기 전에는 dusk 한 색).
 * 타이틀에서 이미 첫 판 배경을 받았고, 다른 판도 카드 하나 크기라 눈에 띄는 기다림이 아니다.
 */
export function runMap(deps: MapDeps): Promise<MapResult> {
  const { display, order, text } = deps;
  const root = need<HTMLElement>(document, '#map');
  const list = need<HTMLElement>(root, '.cards');
  const back = need<HTMLButtonElement>(root, '.back');
  const lockedEl = need<HTMLElement>(root, '.locked');
  back.textContent = text(MAP_TEXT_KEYS.back);
  lockedEl.textContent = text(MAP_TEXT_KEYS.locked);
  const { internal } = display;

  const cards = mapCards(deps.prev, order);
  const boxes = cards.map((c) => mapCardBox(c.index)).filter((b): b is Box => b !== null);
  const dots = mapPathDots(boxes, internal.width);
  const thumbs: Thumb[] = cards.map((c) => {
    const { origin, error } = thumbOrigin(mapJson, c.screenId, internal);
    if (error) console.warn(error);
    return { art: loadSceneArt(c.screenId), origin, scene: null };
  });

  const pct = (v: number, of: number): string => `${(v / of) * 100}%`;
  const place = (el: HTMLElement, b: Box): void => {
    el.style.left = pct(b.left, INTERNAL_WIDTH);
    el.style.top = pct(b.top, internal.height);
    el.style.width = pct(b.width, INTERNAL_WIDTH);
    el.style.height = pct(b.height, internal.height);
  };
  const L = MAP_LAYOUT;
  place(back, { left: L.back.x, top: L.back.y, width: L.back.w, height: L.back.h });

  const buttons = cards.map((c, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.screen = c.screenId;
    el.dataset.state = c.state;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = text(`${c.screenId}.map.name`);
    el.append(name);
    if (c.state === 'locked') {
      const q = document.createElement('span');
      q.className = 'q';
      q.textContent = '？';
      q.setAttribute('aria-hidden', 'true');
      el.append(q);
      el.setAttribute('aria-description', text(MAP_TEXT_KEYS.locked));
    }
    place(el, boxes[k]!);
    list.append(el);
    return el;
  });

  return new Promise<MapResult>((resolve) => {
    let done = false;
    let frame = 0;
    let lockedAt: number | null = null;

    function close(result: MapResult): void {
      done = true;
      cancelAnimationFrame(frame);
      root.hidden = true;
      list.replaceChildren();
      lockedEl.hidden = true;
      window.removeEventListener('keydown', onKey);
      resolve(result);
    }

    async function press(card: MapCard): Promise<void> {
      if (done || deps.rotating()) return;
      // 잠긴 카드도 반응한다(3-1절 "눌렀을 때 반응 없는 카드는 없다"): 안내 줄 2초, 다시 누르면 다시 2초.
      const action = mapPress(card, deps.prev);
      if (!action || action.kind !== 'start') {
        lockedAt = performance.now();
        return;
      }
      done = true;
      // 다른 탭이 그 사이 더 갔으면 그 세이브를 이어 쓴다. 읽기에 실패하면 타이틀이 본 세이브 그대로.
      const fresh = await deps.reload().catch(() => null);
      root.hidden = true;
      await deps.fadeOut(draw);
      close({ kind: 'start', start: { index: action.index, prev: fresh ?? action.prev, activeCharacter: null } });
    }
    cards.forEach((c, k) => buttons[k]!.addEventListener('click', () => void press(c)));
    back.onclick = () => {
      if (!done && !deps.rotating()) close({ kind: 'back' });
    };
    // Esc는 돌아가기와 같다(키보드로 들어온 사람이 나갈 길).
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') back.click();
    }
    window.addEventListener('keydown', onKey);

    function paintThumb(t: Thumb, id: string): void {
      if (t.scene || !t.origin || !t.art) return;
      const art = t.art;
      if (!art.bg || !art.bgReady || !art.objectsReady) return;
      const view = deps.startView(id, art);
      if (!view) return;
      const c = document.createElement('canvas');
      c.width = internal.width;
      c.height = internal.height;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      drawSceneBg(ctx, art);
      // 시작 상태 그대로(캐릭터 없음): 뒤 → 앞판(발 y 순) → 앞. 효과 자리는 시계 0의 한 장.
      const draws = sceneDraws(art.meta, view);
      for (const f of draws.back) {
        if (typeof f === 'number') drawSceneFrame(ctx, art, f);
        else drawSceneFx(ctx, f);
      }
      for (const o of [...draws.overlays].sort((a, b) => a.sortY - b.sortY)) drawSceneFrame(ctx, art, o.frame);
      for (const f of draws.front) drawSceneFrame(ctx, art, f);
      t.scene = c;
    }

    function draw(cover = 0): void {
      const { ctx } = display;
      ctx.fillStyle = color('ink');
      ctx.fillRect(0, 0, internal.width, internal.height);
      ctx.fillStyle = color('lint');
      for (const x of dots) ctx.fillRect(x, L.pathY, L.dot.size, L.dot.size);
      cards.forEach((c, k) => {
        const box = boxes[k]!;
        const th = mapThumbBox(box);
        const t = thumbs[k]!;
        paintThumb(t, c.screenId);
        ctx.fillStyle = color('plum');
        ctx.fillRect(box.left, box.top, box.width, box.height);
        if (t.scene && t.origin) ctx.drawImage(t.scene, t.origin.x, t.origin.y, th.width, th.height, th.left, th.top, th.width, th.height);
        else {
          ctx.fillStyle = color('dusk');
          ctx.fillRect(th.left, th.top, th.width, th.height);
        }
        if (c.state === 'locked') {
          ctx.save();
          ctx.globalAlpha = MAP_LOCKED_DIM;
          ctx.fillStyle = color('ink');
          ctx.fillRect(th.left, th.top, th.width, th.height);
          ctx.restore();
        }
        // 테두리: 깸 = 노랑 2px, 잠금 = lint 1px(3-1절). 상자 안쪽으로 칠한다.
        const line = c.state === 'cleared' ? 2 : 1;
        ctx.fillStyle = color(c.state === 'cleared' ? 'yel' : 'lint');
        ctx.fillRect(box.left, box.top, box.width, line);
        ctx.fillRect(box.left, box.top + box.height - line, box.width, line);
        ctx.fillRect(box.left, box.top, line, box.height);
        ctx.fillRect(box.left + box.width - line, box.top, line, box.height);
        if (c.state === 'cleared') {
          const at = mapStampAt(box);
          drawHudIcon(ctx, 'stamp', at.x, at.y);
        }
      });
      if (cover > 0) {
        ctx.save();
        ctx.globalAlpha = cover;
        ctx.fillStyle = color('ink');
        ctx.fillRect(0, 0, internal.width, internal.height);
        ctx.restore();
      }
      display.present();
    }

    function placeRoot(): void {
      const r = display.rect();
      const set = (k: 'left' | 'top' | 'width' | 'height', v: number): void => {
        const px = `${Math.round(v)}px`;
        if (root.style[k] !== px) root.style[k] = px;
      };
      set('left', r.left);
      set('top', r.top);
      set('width', r.width);
      set('height', r.height);
      const s = String(r.width / INTERNAL_WIDTH);
      if (root.style.getPropertyValue('--s') !== s) root.style.setProperty('--s', s);
    }

    function tick(): void {
      if (done) return;
      frame = requestAnimationFrame(tick);
      draw();
      placeRoot();
      lockedEl.hidden = !mapLockedShown(lockedAt, performance.now());
    }

    root.hidden = false;
    lockedEl.hidden = true;
    // 초점: 첫 깬 카드(맵은 깬 판이 1개 이상일 때만 열린다). 없으면 돌아가기.
    (buttons[cards.findIndex((c) => c.state === 'cleared')] ?? back).focus({ preventScroll: true });
    tick();
  });
}
