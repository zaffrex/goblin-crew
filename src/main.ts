// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 화면 1(magpie_nest)을 탭으로 처음부터 끝까지 푼다(#68). 캐릭터는 시트가 있으면 시트 그림(#140), 없으면 임시 실루엣이다.
// 배경·물건은 화면 시트가 있으면 시트 그림(#157), 없으면 임시 방·상자다(형식 기록 9절).
// 진행 로직은 core/scene.ts에 있다. 여기서는 입력을 넘기고, 결과를 그리고, DOM 말풍선·라벨을 띄운다.

import charactersJson from '../content/characters.json';
import screenJson from '../content/screens/magpie_nest.json';
import texts from '../content/text/ko.json';
import { type CharacterId } from './core/characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, TICK_MS, WALK_AREA } from './core/config';
import { frameFallbacks, type FrameArt, type Loaded } from './core/fallbacks';
import type { HitBox } from './core/hit';
import { GAUGE_CELLS, HUD_AREA } from './core/hud';
import { labelText, resolveTap, type Label } from './core/interact';
import type { CharactersData, ScreenData } from './core/puzzle/types';
import { activeFx, activeMarkerVisible, charPose, createScene, currentBubble, drawOrder, isBusy, isHanging, sceneLayout, sceneTap, sceneTick, shownFlags, tapContext, type SceneData } from './core/scene';
import { coveredIds, litFrames, sceneDraws } from './core/sceneArt';
import { internalToScreen, screenToInternal, type Point } from './core/viewport';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawActiveMarker, drawCharacter, drawHud, drawOutline, drawRoom, drawSpark, drawTarget, drawTargets } from './engine/placeholder';
import { drawSceneBg, drawSceneFrame, loadSceneArt, sceneArtMeta } from './engine/sceneArt';
import { drawSprite, spriteMetas, spriteState } from './engine/sprites';

function need<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} 요소가 없습니다`);
  return el;
}
const canvas = need<HTMLCanvasElement>('#game');
const hud = need('#hud');
const bubble = need('#bubble');
const label = need('#label');
const clearCut = need('#clear');
const faintCut = need('#faint');

const screenData = screenJson as unknown as ScreenData;
const TEXT: Readonly<Record<string, string>> = texts;
const t = (id: string): string => TEXT[id] ?? id;
/** 클리어 컷 글(L32, 설계 8절). 화면 문법에 필드가 없어 `<화면 ID>.clear` 텍스트가 있으면 쓴다. */
const clearLine = `${screenData.id}.clear` in TEXT ? `${screenData.id}.clear` : undefined;
const data: SceneData = {
  screen: screenData,
  characters: charactersJson as CharactersData,
  art: sceneArtMeta(screenData.id) ?? undefined,
  sprites: spriteMetas(),
  clearLine,
};
const art = loadSceneArt(screenData.id);
/** 시트가 그리는 대상. 이 밖의 대상만 임시 상자로 그린다. */
const covered = art ? coveredIds(art.meta) : new Set<string>();

const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
const scene = createScene(data);

// M1 판정 재생 도구(#101)용 읽기 전용 훅. 입력 판정이 쓰는 상자 그대로 돌려준다(scene.ts sceneLayout).
const PLAYTEST = new URLSearchParams(location.search).get('playtest') === '1';
/** 그림이 다 읽힌 뒤에도 임시 그림으로 그린 것(#142, 판정 2 시작 조건). `?playtest=1`일 때만 모은다. */
const fallbacks = new Set<string>();
if (PLAYTEST) {
  const w = window as unknown as { __gcLayout: () => unknown; __gcFallbacks: () => string[] };
  w.__gcLayout = () => sceneLayout(data, scene);
  w.__gcFallbacks = () => [...fallbacks].sort();
}

/** 터치 첫 탭으로 고른 대상의 라벨. 실행하거나 다른 걸 누르면 지운다. */
let touchLabel: Label | null = null;
/** 데스크톱 호버 라벨. */
let hoverLabel: Label | null = null;

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p, slop) => {
  const r = sceneTap(data, scene, p, slop, slop > 0);
  if (r.kind !== 'intent') return;
  touchLabel = r.intent.kind === 'select' ? r.intent.label : null;
  // 첫 행동(걷기 포함)까지는 안내를 남겨 둔다.
  if (r.intent.kind === 'walk' || r.intent.kind === 'act') hud.hidden = true;
});
hud.textContent = '캐릭터를 바꾸고, 바닥이나 물건을 눌러 보세요';
clearCut.textContent = t('ui.clear');

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const p = screenToInternal({ x: e.clientX, y: e.clientY }, display.rect(), display.internal);
  hoverLabel = null;
  canvas.style.cursor = 'default';
  if (!p || isBusy(scene) || scene.cleared) return;
  const inHud = p.x >= HUD_AREA.left && p.x < HUD_AREA.left + HUD_AREA.width && p.y >= HUD_AREA.top && p.y < HUD_AREA.top + HUD_AREA.height;
  if (inHud) return; // HUD 영역은 기본 화살표(PR #112 Luna 리뷰)
  const r = resolveTap(tapContext(data, scene), scene.ui, p, 0);
  hoverLabel = 'label' in r ? r.label : null;
  canvas.style.cursor = r.kind === 'act' ? 'pointer' : 'default';
});

/** 이번 프레임에 시트 그림으로 그린 캐릭터의 그림 꼭대기. 실루엣으로 그렸으면 없다(히트 박스 위끝을 쓴다). */
const spriteTops: Partial<Record<CharacterId, number>> = {};

/** 연출 대상(캐릭터 ID 또는 핫스팟 ID)의 머리 위 점. 내부 좌표. */
function anchorOf(target: string, layout: ReturnType<typeof sceneLayout>): Point | null {
  const box: HitBox | undefined = layout.chars[target as CharacterId] ?? layout.hotspots[target] ?? layout.spots[target];
  if (!box) return null;
  const top = Math.min(box.top, spriteTops[target as CharacterId] ?? box.top);
  return { x: box.left + box.width / 2, y: top };
}

function placeDom(el: HTMLElement, at: Point): void {
  const s = internalToScreen(at, display.rect(), display.internal);
  el.style.left = `${Math.round(s.x)}px`;
  el.style.top = `${Math.round(s.y)}px`;
}

/** 대상 상자 중 시트가 그리지 않는 것만. 시트 이미지가 아직이면 전부(임시 상자). */
function uncovered(boxes: Record<string, HitBox>): Record<string, HitBox> {
  if (!art?.objectsReady) return boxes;
  return Object.fromEntries(Object.entries(boxes).filter(([id]) => !covered.has(id)));
}

function render(): void {
  const { ctx, internal } = display;
  const layout = sceneLayout(data, scene);
  // 라벨과 호버 외곽선(형식 기록 10-1절)은 같은 대상: 마우스 호버 또는 터치 첫 탭. busy·클리어 중에는 끈다.
  const shown = isBusy(scene) || scene.cleared ? null : (touchLabel ?? hoverLabel);
  const litTarget = shown?.target ?? null;
  if (!drawSceneBg(ctx, art)) drawRoom(ctx, internal, WALK_AREA);
  const boxSpots = uncovered(layout.spots);
  const boxHotspots = uncovered(layout.hotspots);
  drawTargets(ctx, boxSpots, boxHotspots);

  // 물건 그림(형식 기록 4·6절): 보이는 플래그로 멈춘 모습, 재생 중 물건 anim은 그 프레임.
  const playing = scene.current?.art ? { ...scene.current.art, ms: scene.current.t * TICK_MS } : null;
  const draws = art ? sceneDraws(art.meta, { flagsOf: (k) => shownFlags(scene, k), playing, clockMs: scene.tick * TICK_MS }) : null;
  const lit = draws ? litFrames(art!.meta, draws, litTarget) : new Set<number>();
  for (const f of draws?.back ?? []) drawSceneFrame(ctx, art!, f, lit.has(f));

  const me = scene.walkers[scene.ui.active];
  if (me.target && !isBusy(scene)) drawTarget(ctx, me.target, scene.tick);

  // 반응 애니메이션: 시트에 없는 연출(임시)은 대상 캐릭터 실루엣을 좌우로 1px 흔든다.
  const ev = scene.current?.ev;
  const shaking = ev?.type === 'anim' ? ev.target : null;
  // 6절 2·3: 캐릭터와 overlay(바구니 앞판)를 발 y로 섞는다. 발 y ≤ sortY면 조각 뒤. 고리에 매달린 캐릭터는 항상 맨 앞.
  // 캐릭터끼리는 `drawOrder`(클릭 판정과 같은 순서, 포개지면 나중에 떨어진 사람이 앞)를 그대로 쓴다.
  type Item = { y: number; k: number; char?: CharacterId; frame?: number };
  const items: Item[] = drawOrder(data, scene).map((id, k) => {
    const hanging = isHanging(data, scene, id);
    return { y: hanging ? Infinity : Math.round(scene.walkers[id].y), k, char: id };
  });
  for (const o of draws?.overlays ?? []) items.push({ y: o.sortY + 0.5, k: -1, frame: o.frame });
  items.sort((a, b) => (a.y === b.y ? a.k - b.k : a.y - b.y));
  const charArt: FrameArt['chars'][number][] = [];
  for (const it of items) {
    if (it.char === undefined) {
      drawSceneFrame(ctx, art!, it.frame!, lit.has(it.frame!));
      continue;
    }
    const id = it.char;
    const w = scene.walkers[id];
    // 시트에 그 연출이 있으면 시트가 재생하고(끝나면 마지막 장 유지, #189), 없으면 drawSprite가 null → 실루엣을 흔든다.
    const pose = charPose(data, scene, id);
    const top = drawSprite(ctx, w, pose, id === litTarget);
    if (PLAYTEST) charArt.push({ id, sheet: spriteState(id), drawn: top !== null, pose });
    if (top === null) {
      const dx = w.id === shaking && Math.floor(scene.tick / 3) % 2 === 1 ? 1 : 0;
      delete spriteTops[id];
      drawCharacter(ctx, dx ? { ...w, x: w.x + dx } : w);
    } else {
      spriteTops[id] = top;
    }
  }
  for (const f of draws?.front ?? []) drawSceneFrame(ctx, art!, f, lit.has(f));
  if (PLAYTEST) {
    const loaded = (img: unknown, ready: boolean): Loaded => (!img ? 'none' : ready ? 'ready' : 'loading');
    const frame: FrameArt = {
      bg: loaded(art?.bg, art?.bgReady ?? false),
      objects: loaded(art, art?.objectsReady ?? false),
      boxes: [...Object.keys(boxSpots), ...Object.keys(boxHotspots)],
      chars: charArt,
    };
    for (const name of frameFallbacks(frame)) fallbacks.add(name);
  }
  for (const f of activeFx(scene)) {
    const at = anchorOf(f.target, layout);
    if (at) drawSpark(ctx, at, f.t);
  }
  if (activeMarkerVisible(scene)) {
    const box = layout.chars[scene.ui.active];
    drawActiveMarker(ctx, Math.min(box.top, spriteTops[scene.ui.active] ?? box.top), me.x, scene.tick);
  }
  if (scene.ui.selected) {
    const target = scene.ui.selected.split('|')[2] ?? '';
    const box = layout.hotspots[target] ?? layout.spots[target];
    // 시트 그림이 외곽선으로 켜졌으면 임시 상자 테두리는 겹쳐 그리지 않는다(폴백 상자에만).
    if (box && !(art?.outlined && lit.size > 0)) drawOutline(ctx, box, scene.tick);
  }
  drawHud(ctx, layout.hud, GAUGE_CELLS, { active: layout.active, armed: layout.armed, gauge: layout.gauge });
  display.present();

  // DOM 말풍선(ADR-0004 결정 3). 화자 머리 위.
  const b = currentBubble(scene);
  const bubbleAt = b ? anchorOf(b.speaker, layout) : null;
  bubble.hidden = !b;
  if (b) {
    const text = t(b.text);
    if (bubble.textContent !== text) bubble.textContent = text;
    placeDom(bubble, bubbleAt ?? { x: INTERNAL_WIDTH / 2, y: 60 });
  }

  const labelString = shown ? labelText(shown, data.screen.id, t) : '';
  label.hidden = labelString === '';
  if (label.textContent !== labelString) label.textContent = labelString;
  placeDom(label, { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT - 4 });

  clearCut.hidden = !(scene.cleared && !isBusy(scene));
  // 게이지 0 컷(#129, L33)과 클리어 컷(L32). 그림 없는 M1 임시 연출: 클리어 카드와 같은 DOM 글 한 줄.
  const cut = layout.cut;
  faintCut.hidden = cut === null;
  if (cut !== null && faintCut.textContent !== t(cut)) faintCut.textContent = t(cut);
}

startLoop({ step: () => sceneTick(data, scene), render });
