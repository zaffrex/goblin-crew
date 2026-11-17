// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 화면 1(magpie_nest)을 탭으로 처음부터 끝까지 푼다(#68). 캐릭터는 시트가 있으면 시트 그림(#140), 없으면 임시 실루엣이다.
// 배경·물건은 화면 시트가 있으면 시트 그림(#157), 없으면 임시 방·상자다(형식 기록 9절).
// 진행 로직은 core/scene.ts에 있다. 여기서는 입력을 넘기고, 결과를 그리고, DOM 말풍선·라벨을 띄운다.

import charactersJson from '../content/characters.json';
import screenJson from '../content/screens/magpie_nest.json';
import texts from '../content/text/ja.json';
import { characterDef, type CharacterId } from './core/characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, TICK_MS, WALK_AREA } from './core/config';
import { frameFallbacks, type FrameArt, type Loaded } from './core/fallbacks';
import { dustPush, FX_COLORS, FX_STYLE, SHAKE_FX, shakeOffset } from './core/fx';
import type { HitBox } from './core/hit';
import { createFirstNotes, currentNote, noteArmAbility, noteGauge, noteTap } from './core/firstNotes';
import { abilityText, GAUGE_BOX, GAUGE_CELLS, GAUGE_PLATE, HUD_AREA, hudHoverText, hudTags, type HudId } from './core/hud';
import { labelText, resolveTap, type Label } from './core/interact';
import type { CharactersData, ScreenData } from './core/puzzle/types';
import { activeFx, activeMarkerVisible, charPose, createScene, currentBubble, drawOrder, gaugeDrop, isBusy, isHanging, sceneLayout, sceneTap, sceneTick, shownFlags, tapContext, type SceneData } from './core/scene';
import { coveredIds, litFrames, loopStarts, sceneDraws, type LoopStarts, type SceneDraws } from './core/sceneArt';
import { internalToScreen, screenToInternal, type Point } from './core/viewport';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawHud } from './engine/hud';
import { drawActiveMarker, drawCharacter, drawOutline, drawRoom, drawSpark, drawStompDust, drawTarget, drawTargets } from './engine/placeholder';
import { drawSceneBg, drawSceneFrame, loadSceneArt, sceneArtMeta } from './engine/sceneArt';
import { drawHead, drawSprite, spriteMetas, spriteState } from './engine/sprites';
import { drawHudIcon } from './engine/hudIcons';
import { drawFxText, fxTextState } from './engine/fxText';

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
const hudTagLayer = need('#hudtags');

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
/** 데스크톱 호버 중인 HUD 칸(설명은 대상 라벨 자리에, 설계 6-1-3절). */
let hoverHud: HudId | 'gauge' | null = null;
/** 처음 한 번 안내(첫 무장 특기 설명, 첫 감소 게이지 뜻, 설계 6-2-3·6-2-5절). */
const notes = createFirstNotes(scene.shownGauge);

const inBox = (p: Point, b: HitBox): boolean => p.x >= b.left && p.x < b.left + b.width && p.y >= b.top && p.y < b.top + b.height;

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p, slop) => {
  noteTap(notes);
  const r = sceneTap(data, scene, p, slop, slop > 0);
  if (r.kind !== 'intent') return;
  touchLabel = r.intent.kind === 'select' ? r.intent.label : null;
  // 첫 무장 안내는 터치만(설계 6-2-3절, PR #295 리뷰). 마우스는 버튼 호버로 같은 글을 이미 봤고, 안내가 대상 호버 라벨을 가린다.
  if (slop > 0 && r.intent.kind === 'arm' && r.intent.armed?.verb === 'ability') noteArmAbility(notes, scene.ui.active, abilityText(scene.ui.active, t));
});
// 목표 줄(설계 6-2-2절): 첫 행동 뒤에도 늘 보인다. 클리어 뒤에만 숨긴다(render).
hud.textContent = t('ui.intro');
clearCut.textContent = t('ui.clear');

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const p = screenToInternal({ x: e.clientX, y: e.clientY }, display.rect(), display.internal);
  hoverLabel = null;
  hoverHud = null;
  canvas.style.cursor = 'default';
  if (!p || scene.cleared) return;
  // HUD 칸 설명은 busy 중에도 띄운다(칸은 busy 중에도 눌린다, #266). 월드 호버는 busy 중에는 끈다.
  if (inBox(p, HUD_AREA)) {
    // HUD 영역은 기본 화살표(PR #112 Luna 리뷰). 칸 위면 설명만 띄운다(누를 수 없는 게이지 포함).
    const hit = Object.entries(sceneLayout(data, scene).hud).find(([, b]) => inBox(p, b));
    hoverHud = hit ? (hit[0] as HudId) : inBox(p, GAUGE_BOX) ? 'gauge' : null;
    return;
  }
  if (isBusy(scene)) return;
  const r = resolveTap(tapContext(data, scene), scene.ui, p, 0);
  hoverLabel = 'label' in r ? r.label : null;
  canvas.style.cursor = r.kind === 'act' ? 'pointer' : 'default';
});

/** 물건별 loop 시작 시각(#237). anim이 끝나거나 멈춘 모습이 바뀌면 그 물건만 0부터 다시 센다. */
let loopClock: LoopStarts = {};

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

/** 늘 보이는 HUD 이름표(설계 6-1-2절). 글자 = 내부 7px × 화면 배율, 최소 11 CSS px. */
const HUD_TAG_PX = 7;
const HUD_TAG_MIN_CSS = 11;
const hudTagEls = new Map<string, HTMLElement>();
function placeHudTags(active: CharacterId): void {
  const scale = display.rect().width / INTERNAL_WIDTH;
  const size = `${Math.max(HUD_TAG_MIN_CSS, Math.round(HUD_TAG_PX * scale))}px`;
  for (const tag of hudTags(active, t)) {
    let el = hudTagEls.get(tag.id);
    if (!el) {
      el = document.createElement('span');
      el.className = 'hudtag';
      el.dataset.id = tag.id;
      hudTagLayer.append(el);
      hudTagEls.set(tag.id, el);
    }
    if (el.textContent !== tag.text) el.textContent = tag.text;
    if (el.style.fontSize !== size) el.style.fontSize = size;
    placeDom(el, { x: tag.x, y: tag.top });
  }
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
  // 쿵 흔들림(`ability-feedback.md` 2-1절 2): 장면 층(배경·물건·캐릭터·fx)만 세로로 민다. HUD·DOM 글자는 그대로.
  const fxNow = activeFx(scene);
  const shakeY = fxNow.reduce((y, f) => y || shakeOffset(f.effect, f.t), 0);
  if (shakeY !== 0) {
    // 밀려서 드러나는 가장자리 줄은 잉크로 덮는다(지난 프레임이 남지 않게).
    ctx.fillStyle = FX_COLORS.ink;
    ctx.fillRect(0, 0, internal.width, internal.height);
  }
  ctx.save();
  ctx.translate(0, shakeY);
  if (!drawSceneBg(ctx, art)) drawRoom(ctx, internal, WALK_AREA);
  const boxSpots = uncovered(layout.spots);
  const boxHotspots = uncovered(layout.hotspots);
  drawTargets(ctx, boxSpots, boxHotspots);

  // 물건 그림(형식 기록 4·6절): 보이는 플래그로 멈춘 모습, 재생 중 물건 anim은 그 프레임.
  const playing = scene.current?.art ? { ...scene.current.art, ms: scene.current.t * TICK_MS } : null;
  let draws: SceneDraws | null = null;
  if (art) {
    const view = { flagsOf: (k: string) => shownFlags(scene, k), playing, clockMs: scene.tick * TICK_MS };
    loopClock = loopStarts(art.meta, view, loopClock);
    draws = sceneDraws(art.meta, { ...view, loopStarts: loopClock });
  }
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
  const fxArt: NonNullable<FrameArt['fx']>[number][] = [];
  for (const f of fxNow) {
    const at = anchorOf(f.target, layout);
    const style = FX_STYLE[f.effect];
    // 소리 글자(3절 표에 있는 fx)는 글자 시트로. 시트가 아직이거나 표 밖의 fx(물건 그림, P1 #286)는 임시 별.
    const drawn = at !== null && style !== undefined && drawFxText(ctx, f.effect, at, f.t, internal.width);
    if (at && !drawn) drawSpark(ctx, at, f.t, style ? FX_COLORS[style.color] : undefined);
    if (PLAYTEST && at && style) fxArt.push({ effect: f.effect, sheet: fxTextState(), drawn });
    const push = f.effect === SHAKE_FX ? dustPush(f.t) : null;
    const foot = scene.walkers[f.target as CharacterId];
    if (push !== null && foot) drawStompDust(ctx, foot, push, FX_COLORS.lint, FX_COLORS.dusk);
  }
  if (PLAYTEST) {
    const loaded = (img: unknown, ready: boolean): Loaded => (!img ? 'none' : ready ? 'ready' : 'loading');
    const frame: FrameArt = {
      bg: loaded(art?.bg, art?.bgReady ?? false),
      objects: loaded(art, art?.objectsReady ?? false),
      boxes: [...Object.keys(boxSpots), ...Object.keys(boxHotspots)],
      chars: charArt,
      fx: fxArt,
    };
    for (const name of frameFallbacks(frame)) fallbacks.add(name);
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
  ctx.restore();
  const abilityGlyph = [...t(`ui.verb.${characterDef(layout.active).ability}`)][0] ?? '?';
  drawHud(
    ctx,
    layout.hud,
    { plate: GAUGE_PLATE, cells: GAUGE_CELLS },
    { active: layout.active, armed: layout.armed, gauge: layout.gauge, gaugeDrop: gaugeDrop(scene), abilityGlyph },
    drawHead,
    drawHudIcon,
  );
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

  placeHudTags(layout.active);
  const hudHover = scene.cleared || hoverHud === null ? null : hudHoverText(hoverHud, layout.active, t);
  noteGauge(notes, layout.gauge, scene.tick, t('ui.hud.gauge_first_drop'));
  // 처음 한 번 안내가 떠 있으면 그게 먼저다(첫 감소는 busy 중에 뜬다). 다음 탭이나 2.5초 뒤 지운다.
  const note = scene.cleared ? null : currentNote(notes, scene.tick);
  const labelString = note ?? (shown ? labelText(shown, data.screen.id, t) : (hudHover ?? ''));
  label.hidden = labelString === '';
  if (label.textContent !== labelString) label.textContent = labelString;
  placeDom(label, { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT - 4 });

  clearCut.hidden = !(scene.cleared && !isBusy(scene));
  hud.hidden = scene.cleared;
  // 게이지 0 컷(#129, L33)과 클리어 컷(L32). 그림 없는 M1 임시 연출: 클리어 카드와 같은 DOM 글 한 줄.
  const cut = layout.cut;
  faintCut.hidden = cut === null;
  if (cut !== null && faintCut.textContent !== t(cut)) faintCut.textContent = t(cut);
}

startLoop({ step: () => sceneTick(data, scene), render });
