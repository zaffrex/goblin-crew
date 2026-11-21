// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 화면 1(magpie_nest, `?screen=<id>`로 다른 화면 #466)을 탭으로 처음부터 끝까지 푼다(#68). 캐릭터는 시트가 있으면 시트 그림(#140), 없으면 임시 실루엣이다.
// 배경·물건은 화면 시트가 있으면 시트 그림(#157), 없으면 임시 방·상자다(형식 기록 9절).
// 진행 로직은 core/scene.ts에 있다. 여기서는 입력을 넘기고, 결과를 그리고, DOM 말풍선·라벨을 띄운다.

import charactersJson from '../content/characters.json';
import texts from '../content/text/ja.json';
import { sayText } from './core/sayText';
import { bubbleFontPx, bubbleMaxWidth, bubbleTailInset, placeBubble, type BubbleAnchor, type BubbleOptions } from './core/bubble';
import { CHARACTERS, type CharacterId } from './core/characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, TICK_MS, WALK_AREA } from './core/config';
import { frameFallbacks, type FrameArt, type Loaded } from './core/fallbacks';
import { actorEdgeAt, besideFeetAt, dustPush, FX_COLORS, FX_STYLE, fxTextSpot, SHAKE_FX, shakeOffset } from './core/fx';
import { drawnByShape, frameNudges, fxNudges, particleFx, shapeParticles, type Nudge } from './core/fxShape';
import type { HitBox } from './core/hit';
import { cardFacePx, cardInput, cardPointer, cardRowGapPx, cardReady, cardText, cardTick, cardTight, createStartCard } from './core/startCard';
import { createFirstNotes, currentNote, noteGauge, noteSwitch, noteTap } from './core/firstNotes';
import { abilityText, cutFontPx, GAUGE_BAND, GAUGE_SEGS, GAUGE_TRACK, GOAL_AT, goalMaxWidthPx, HUD_AREA, hudHoverText, hudTagFontPx, hudTags, hudTagTight, LABEL_BOTTOM, labelFontPx, type HudId } from './core/hud';
import { labelText, resolveTap, type Label } from './core/interact';
import type { CharactersData, ScreenData } from './core/puzzle/types';
import { pickScreen, screenTextKey } from './core/screenPick';
import { cardLines, enterCharacter, flowTap, flowTick, flowView, nextIndex, PLAYING, playtestOrder, showCard, type Flow } from './core/flow';
import { activeFx, activeMarkerVisible, boardDrop, charPose, createScene, cuedArtView, currentBubble, drawOrder, gaugeDrop, heldArtView, isBusy, isHanging, sceneLayout, sceneTap, sceneTick, shownFlags, tapContext, tiltOf, type SceneData, type SceneState } from './core/scene';
import { animFrameBox, coveredIds, litFrames, loopStarts, sceneDraws, type LoopStarts, type SceneDraws, type SceneView } from './core/sceneArt';
import { internalToScreen, screenToInternal, type Point, type Rect } from './core/viewport';
import { isTapKey } from './core/keys';
import { createRestartButton, loadingDone, RESTART_BOX, restartArmed, restartPress } from './core/restart';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawHud } from './engine/hud';
import { drawActiveMarker, drawCharacter, drawOutline, drawRoom, drawSpark, drawStompDust, drawTarget, drawTargets } from './engine/placeholder';
import { drawParticles, drawSceneBg, drawSceneFrame, drawSceneFx, loadSceneArt, sceneArtMeta, type SceneArt } from './engine/sceneArt';
import { drawHead, drawSprite, spriteMetas, spriteState, type SpriteTop } from './engine/sprites';
import { drawFxText, fxTextState, fxTextWidth } from './engine/fxText';
import { hudIconState, paintHudIcon } from './engine/hudIcons';

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
const cardEl = need('#card');
const loadingEl = need('#loading');
const restartEl = need<HTMLButtonElement>('#restart');

/** 번들에 든 화면 데이터(파일 이름 = 화면 ID). 13KB 안팎이라 다 넣고 `?screen=`으로 고른다(#466). */
const SCREENS = new Map(
  Object.entries(import.meta.glob<ScreenData>('../content/screens/*.json', { eager: true, import: 'default' })).map(([path, s]) => [path.replace(/^.*\/|\.json$/g, ''), s]),
);
const query = (key: string): string | null => new URLSearchParams(location.search).get(key);
const picked = pickScreen(query('screen'), [...SCREENS.keys()]);
if (picked.unknown) console.warn(`?screen=${picked.unknown}: 없는 화면이라 ${picked.id}로 엽니다`);
const TEXT: Readonly<Record<string, string>> = texts;
/**
 * 플레이 순서(#230 여러 화면 연결 2단계). 지금은 `?playtest=1&order=a,b`일 때만 있다(L1 기록 `2026-11-21-multi-screen-link-before-planning`).
 * null이면 배포본 그대로다: 화면 하나, 클리어 뒤 `ui.clear` 카드에서 끝나고 연결 경로(카드 탭·전환)를 아예 타지 않는다.
 * 배포 순서 `content/screens/order.json`과 세이브는 플래닝 결론 뒤에 붙인다(같은 기록 2·3번).
 */
const ORDER = playtestOrder(query, new Set(SCREENS.keys()));
if (query('order') !== null && !ORDER) console.warn('?order=: playtest=1이 아니거나 모르는 화면 id가 있어 화면 하나로 엽니다');

/**
 * 한 화면 판(#230 여러 화면 연결 1단계, 설계 `ui-interaction.md` 11절). 화면에 묶인 상태는 전부 여기 있다.
 * 다음 화면으로 넘어가면 `enterScreen`으로 통째로 새로 만든다. 그래서 이전 화면의 loop 시각·그림 앵커가 새지 않는다(#230 Q2 `loopClock`).
 * 다른 곳은 `session`을 매번 다시 읽는다(따로 붙잡아 두지 않는다). 화면을 바꾸는 연결(2단계)에서 `let`이 된다.
 */
interface Session {
  data: SceneData;
  art: SceneArt | null;
  /** 시트가 그리는 대상. 이 밖의 대상만 임시 상자로 그린다. */
  covered: ReadonlySet<string>;
  /** 지금 판. 처음부터 버튼(#387)이 같은 화면 새 판으로 바꾼다. */
  scene: SceneState;
  /** 물건별 loop 시작 시각(#237). anim이 끝나거나 멈춘 모습이 바뀌면 그 물건만 0부터 다시 센다. */
  loopClock: LoopStarts;
  /** 이번 프레임에 시트 그림으로 그린 캐릭터의 앵커 높이. 실루엣으로 그렸으면 없다(히트 박스 위끝을 쓴다). */
  spriteTops: Partial<Record<CharacterId, SpriteTop>>;
}

function enterScreen(id: string): Session {
  const screen = SCREENS.get(id);
  if (!screen) throw new Error(`화면 ${id}가 번들에 없습니다`);
  const data: SceneData = {
    screen,
    characters: charactersJson as CharactersData,
    art: sceneArtMeta(id) ?? undefined,
    sprites: spriteMetas(),
    // 클리어 컷 글(L32, 설계 8절). 화면 문법에 필드가 없어 `<화면 ID>.clear` 텍스트가 있으면 쓴다.
    clearLine: `${id}.clear` in TEXT ? `${id}.clear` : undefined,
    texts: TEXT,
  };
  const art = loadSceneArt(id);
  return { data, art, covered: art ? coveredIds(art.meta) : new Set<string>(), scene: createScene(data), loopClock: {}, spriteTops: {} };
}

let session = enterScreen(ORDER ? ORDER[0]! : picked.id);
/** 순서 안 지금 위치. 같은 id가 두 번 나와도 위치로 센다(`flow.ts` nextIndex). */
let orderIndex = 0;
/** 화면 사이 흐름(ui-interaction 11-1절). `ORDER`가 없으면 늘 `play`다. */
let flow: Flow = PLAYING;
/** 클리어 카드가 뜰 때 미리 만든 다음 화면 판. 그림을 카드 보는 동안 받는다(11-1절 "다음 화면 그림 기다림 0초가 목표"). */
let pending: { index: number; session: Session } | null = null;
/** 글 ID → 지금 화면의 글(`<화면 ID>.card.goal` 등이 있으면 그것, #380). */
const t = (id: string): string => TEXT[screenTextKey(TEXT, session.data.screen.id, id)] ?? id;

const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });

/**
 * 로딩 화면(#387, #286 P1-7): 그림이 다 오기 전에는 장면 대신 `#loading`(index.html, JS 전부터 떠 있음)만 보인다.
 * 예전에는 이 동안 임시 방·상자(색 블록)가 그대로 보였다. 시작 카드도 그 뒤에 뜬다(카드 잠금 1초는 로딩 뒤부터 센다).
 */
const loadStart = performance.now();
let loaded = false;
function loadStates(art: SceneArt | null): Loaded[] {
  const bg: Loaded = !art?.bg ? 'none' : art.bgReady ? 'ready' : 'loading';
  const objects: Loaded = !art ? 'none' : art.objectsReady ? 'ready' : 'loading';
  return [bg, objects, ...CHARACTERS.map((c) => spriteState(c.id)), fxTextState(), hudIconState()];
}

// M1 판정 재생 도구(#101)용 읽기 전용 훅. 입력 판정이 쓰는 상자 그대로 돌려준다(scene.ts sceneLayout).
const PLAYTEST = new URLSearchParams(location.search).get('playtest') === '1';
/** 그림이 다 읽힌 뒤에도 임시 그림으로 그린 것(#142, 판정 2 시작 조건). `?playtest=1`일 때만 모은다. */
const fallbacks = new Set<string>();
if (PLAYTEST) {
  const w = window as unknown as { __gcLayout: () => unknown; __gcFallbacks: () => string[]; __gcFlow: () => unknown };
  w.__gcLayout = () => sceneLayout(session.data, session.scene);
  w.__gcFallbacks = () => [...fallbacks].sort();
  // 여러 화면 연결(11-6절): 재생 도구가 지금 화면·순서 위치·흐름 단계를 읽는다. `order`가 null이면 연결을 안 타는 판이다.
  w.__gcFlow = () => ({ order: ORDER, index: orderIndex, screen: session.data.screen.id, phase: flow.phase });
}

/** 터치 첫 탭으로 고른 대상의 라벨. 실행하거나 다른 걸 누르면 지운다. */
let touchLabel: Label | null = null;
/** 데스크톱 호버 라벨. */
let hoverLabel: Label | null = null;
/** 데스크톱 호버 중인 HUD 칸(설명은 대상 라벨 자리에, 설계 6-1-3절). */
let hoverHud: HudId | 'gauge' | null = null;
/** 처음 한 번 안내(첫 전환 특기 설명, 첫 감소 게이지 뜻, 설계 6-4-3·6-2-5절). */
const notes = createFirstNotes(session.scene.shownGauge, session.scene.ui.active);
/** 배포 빌드의 커밋 앞 7자리(#460). 로컬 빌드는 `dev`. */
function buildTag(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : 'dev';
}

/** 시작 카드(설계 6-2-1절). 떠 있는 동안 장면은 멈추고(진입 연출 포함) 입력은 카드만 받는다. */
const startCard = createStartCard();
/** 카드 특기 줄의 얼굴 칸. 얼굴 시트가 늦게 오면 다 그릴 때까지 프레임마다 다시 그린다. */
const cardFaces = buildCard();

function buildCard(): { id: CharacterId; el: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; drawn: boolean }[] {
  const text = cardText(t, cardPointer(window.matchMedia?.bind(window)));
  need('#card .goal').textContent = text.goal;
  need('#card .why').textContent = text.why;
  need('#card .gauge').textContent = text.gauge;
  need('#card .start').textContent = `${text.start} ▶`;
  need('#card .build').textContent = buildTag(import.meta.env.VITE_BUILD_SHA);
  // 카드는 로딩이 끝난 뒤 renderCard가 띄운다(#387). 재생 도구(`card.ts`)는 `#loading`이 사라질 때까지 기다렸다가 카드를 찾는다.
  const list = need('#card ul');
  return text.rows.map((row) => {
    const li = document.createElement('li');
    // 얼굴: HUD 캐릭터 칸과 같은 head 24×24를 2배로(CSS 48px, pixelated). 시트가 없으면 빈 칸이고 글은 그대로다.
    const face = document.createElement('canvas');
    face.width = 24;
    face.height = 24;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = row.name;
    const ability = document.createElement('span');
    ability.textContent = row.ability;
    li.append(face, name, ability);
    list.append(li);
    return { id: row.id, el: face, ctx: face.getContext('2d'), drawn: false };
  });
}

// 카드 닫기: 카드 위·캔버스 밖·키보드 어디서든. 캔버스 탭은 캔버스 핸들러가 먼저 받아 버리고(카드가 떠 있으면 무시) 여기로 올라온다.
// 버블 단계라 닫는 탭이 같은 이벤트로 게임에 다시 들어가지 않는다.
// 클리어 카드도 같은 자리에서 받는다(11-1절: 화면 어디든 탭·클릭, Enter·Space). 시작 카드를 닫는 탭은 그 뒤 흐름이 `play`라 아무것도 안 한다.
window.addEventListener('pointerdown', (e) => {
  if (!loaded || !e.isPrimary || e.button !== 0) return;
  cardInput(startCard);
  tapFlow();
});
// 키는 "탭"으로 셀 수 있는 것만(반복·수정 키·브라우저 단축키 제외, PR #306 리뷰).
window.addEventListener('keydown', (e) => {
  if (!loaded || !isTapKey(e)) return;
  cardInput(startCard);
  tapFlow();
});

/** 클리어 카드 탭(0.6초 안은 무시). 타이틀이 아직 없어서 끝 카드에서는 머문다(11-5절). */
function tapFlow(): void {
  if (!ORDER || startCard.open) return;
  flow = flowTap(flow, false).flow;
}

/** 다음 화면 그림이 다 왔나. 없는 그림('none')은 기다리지 않는다. 캐릭터·글자 시트는 화면과 상관없이 이미 읽혔다. */
function artReady(art: SceneArt | null): boolean {
  return !art || ((!art.bg || art.bgReady) && art.objectsReady);
}

/**
 * 1틱 흐름(ORDER가 있을 때만). 클리어 컷이 끝나면 카드를 띄우고 다음 화면 판을 미리 만든다.
 * 덮개가 다 검은 틱(`swap`)에 판을 바꾼다. 다음 화면 규칙은 11-3절: 게이지 가득·무장 풀림·아이템 비움은 새 판이 원래 그렇고,
 * 지금 캐릭터만 이어 간다.
 */
function stepFlow(): void {
  if (!ORDER) return;
  if (flow.phase === 'play') {
    if (!session.scene.cleared || isBusy(session.scene)) return;
    const next = nextIndex(ORDER, orderIndex);
    flow = showCard(next === null);
    pending = next === null ? null : { index: next, session: enterScreen(ORDER[next]!) };
    return;
  }
  const r = flowTick(flow, pending !== null && artReady(pending.session.art));
  flow = r.flow;
  if (!r.swap || !pending) return;
  const prev = session.scene.ui.active;
  session = pending.session;
  orderIndex = pending.index;
  pending = null;
  session.scene.ui.active = enterCharacter(prev, session.data.screen.start.at, CHARACTERS.map((c) => c.id)) as CharacterId;
  touchLabel = null;
  hoverLabel = null;
  hoverHud = null;
  noteTap(notes);
  notes.lastGauge = session.scene.shownGauge;
}

const inBox = (p: Point, b: HitBox): boolean => p.x >= b.left && p.x < b.left + b.width && p.y >= b.top && p.y < b.top + b.height;

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p, slop) => {
  if (!loaded || startCard.open || flow.phase !== 'play') return; // 로딩 중이거나 카드 몫(window 핸들러가 닫는다)
  noteTap(notes);
  const r = sceneTap(session.data, session.scene, p, slop, slop > 0);
  if (r.kind !== 'intent') return;
  touchLabel = r.intent.kind === 'select' ? r.intent.label : null;
  // 첫 전환 안내는 터치만(설계 6-4-3절, PR #295 리뷰). 마우스는 얼굴 호버로 같은 글을 이미 봤고, 안내가 대상 호버 라벨을 가린다.
  // 얼굴 탭·몸 탭 둘 다 전환이다. 처음 캐릭터는 시작 카드가 말했으니 띄우지 않는다(createFirstNotes).
  if (slop > 0 && r.intent.kind === 'switch') noteSwitch(notes, r.intent.char, abilityText(r.intent.char, t));
});
/**
 * 처음부터 버튼(#387): 두 번 눌러야 한다(3초 안, `core/restart.ts`). 새로고침 없이 장면만 새 판으로 바꾼다.
 * 시작 카드는 다시 띄우지 않고, 처음 한 번 안내(firstNotes)도 이미 본 건 다시 안 띄운다(같은 사람이 다시 하는 것).
 * DOM 버튼이라 캔버스 탭(걷기)으로 새지 않는다. 클릭이라 키보드(Enter·Space)로도 누를 수 있다.
 */
const restart = createRestartButton();
/** 마우스가 버튼 위에 있나(설명은 대상 라벨 자리에, HUD 칸 호버와 같다). */
let restartHover = false;
// 아이콘 버튼(#390, 설계 6-7-1절): 글자는 화면에 안 쓰고 읽기 프로그램용 이름으로만 둔다. 설명은 호버·확인 글이 대상 라벨 자리에.
restartEl.setAttribute('aria-label', t('ui.restart'));
const restartIcon = document.createElement('span');
restartIcon.className = 'icon';
restartIcon.setAttribute('aria-hidden', 'true');
restartEl.append(restartIcon);
restartEl.addEventListener('click', () => {
  if (!loaded || startCard.open || flow.phase !== 'play') return;
  if (!restartPress(restart, performance.now())) return;
  // 누른 뒤 초점이 남으면 Space 한 번에 다시 눌려서(두 번째 누름) 판이 또 날아간다.
  restartEl.blur();
  session.scene = createScene(session.data);
  session.loopClock = {};
  touchLabel = null;
  hoverLabel = null;
  hoverHud = null;
  noteTap(notes);
  notes.lastGauge = session.scene.shownGauge;
});
restartEl.addEventListener('pointerenter', (e) => {
  if (e.pointerType === 'mouse') restartHover = true;
});
restartEl.addEventListener('pointerleave', () => {
  restartHover = false;
});

// 목표 줄(설계 6-2-2절): 첫 행동 뒤에도 늘 보인다. 클리어 뒤에만 숨긴다. 글·줄바꿈은 render의 placeGoal이 넣는다.
// 클리어 카드 글은 render의 placeClearCut이 넣는다(여러 화면 연결 때 화면마다 바뀐다).

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const p = screenToInternal({ x: e.clientX, y: e.clientY }, display.rect(), display.internal);
  hoverLabel = null;
  hoverHud = null;
  canvas.style.cursor = 'default';
  const { data, scene } = session;
  if (!p || scene.cleared || startCard.open || flow.phase !== 'play') return;
  // HUD 칸 설명은 busy 중에도 띄운다(칸은 busy 중에도 눌린다, #266). 월드 호버는 busy 중에는 끈다.
  // 게이지 띠(6-3-5절): 어디든 올리면 게이지 설명. 누를 수 없으니 기본 화살표.
  if (inBox(p, GAUGE_BAND)) {
    hoverHud = 'gauge';
    return;
  }
  if (inBox(p, HUD_AREA)) {
    // HUD 영역은 기본 화살표(PR #112 Luna 리뷰). 칸 위면 설명만 띄운다.
    const hit = Object.entries(sceneLayout(data, scene).hud).find(([, b]) => inBox(p, b));
    hoverHud = hit ? (hit[0] as HudId) : null;
    return;
  }
  if (isBusy(scene)) return;
  const r = resolveTap(tapContext(data, scene), scene.ui, p, 0);
  hoverLabel = 'label' in r ? r.label : null;
  canvas.style.cursor = r.kind === 'act' ? 'pointer' : 'default';
});

/**
 * 상자 위끝과 그림 앵커 중 머리 위 높이(내부 y). 보통은 둘 중 위쪽(매달린 자세는 자세 `hit` 상자가 더 위).
 * 낮은 자세(납작·엉덩방아, #464)면 상자는 서 있는 높이 그대로라 그림 앵커만 쓴다.
 */
function headY(box: HitBox, sprite: SpriteTop | undefined): number {
  if (!sprite) return box.top;
  return sprite.low ? sprite.top : Math.min(box.top, sprite.top);
}

/** 연출 대상(캐릭터 ID 또는 핫스팟 ID)의 머리 위 점. 내부 좌표. */
function anchorOf(target: string, layout: ReturnType<typeof sceneLayout>): Point | null {
  const box: HitBox | undefined = layout.chars[target as CharacterId] ?? layout.hotspots[target] ?? layout.spots[target];
  if (!box) return null;
  return { x: box.left + box.width / 2, y: headY(box, session.spriteTops[target as CharacterId]) };
}

/**
 * 소리 글자 자리 예외(`fx.ts` `FX_TEXT_SPOT`)의 기준점. 고정 점은 그대로, `'actor'`는 그 효과를 낸 캐릭터 쪽 대상 끝(#530),
 * `'feet'`는 대상 캐릭터 몸 옆 발치(#553).
 * 예외가 없거나, 상자를 모르면(입장 연출 등) null → 대상 위 끝 가운데.
 */
function fxTextSpotAt(f: { effect: string; target: string; by?: CharacterId }, layout: ReturnType<typeof sceneLayout>): Point | null {
  const { data, scene } = session;
  const spot = fxTextSpot(f.effect, f.target, data.screen.id);
  if (spot === 'feet') {
    const body: HitBox | undefined = layout.chars[f.target as CharacterId];
    return body ? besideFeetAt(body, fxTextWidth(f.effect)) : null;
  }
  if (spot !== 'actor') return spot;
  const box: HitBox | undefined = layout.hotspots[f.target] ?? layout.spots[f.target];
  const actor = f.by === undefined ? undefined : scene.walkers[f.by];
  return box && actor ? actorEdgeAt(box, actor.x, fxTextWidth(f.effect)) : null;
}

/** 대상 상자 아래 끝 가운데(내부 좌표). 물결(`ripple`)처럼 물에 닿은 자리에 띄우는 fx 기준점. */
function footOf(target: string, layout: ReturnType<typeof sceneLayout>): Point | null {
  const box: HitBox | undefined = layout.chars[target as CharacterId] ?? layout.hotspots[target] ?? layout.spots[target];
  return box ? { x: box.left + box.width / 2, y: box.top + box.height } : null;
}

/** 임시 상자를 옮기는 fx(`nod`)만큼 옮긴 사본. 클릭 판정 상자(layout)는 그대로다. */
function nudgeBoxes(boxes: Record<string, HitBox>, nudges: Readonly<Record<string, Nudge>>): Record<string, HitBox> {
  if (Object.keys(nudges).length === 0) return boxes;
  return Object.fromEntries(Object.entries(boxes).map(([id, b]) => {
    const n = nudges[id];
    return [id, n ? { ...b, left: b.left + n.dx, top: b.top + n.dy } : b];
  }));
}

/**
 * 말풍선 화자 상자(#329): 가운데 x, 머리 위끝, 발끝. 내부 좌표. 위로 넘치면 발 아래로 뒤집는다.
 * `frameBox`(그 물건이 지금 그리는 anim 칸 상자, 그림 형식 13절 #450)가 있으면 핫스팟 상자 대신 그걸 쓴다.
 */
function speakerBox(target: string, layout: ReturnType<typeof sceneLayout>, frameBox: HitBox | null = null): BubbleAnchor | null {
  if (frameBox) {
    const b = frameBox;
    return { x: b.left + b.width / 2, top: b.top, bottom: b.top + b.height, left: b.left, right: b.left + b.width };
  }
  const box: HitBox | undefined = layout.chars[target as CharacterId] ?? layout.hotspots[target] ?? layout.spots[target];
  const head = anchorOf(target, layout);
  if (!box || !head) return null;
  return { x: head.x, top: head.y, bottom: box.top + box.height, left: box.left, right: box.left + box.width };
}

/**
 * 말풍선이 가리면 안 되는 물건(#356): 화자를 뺀 화면의 핫스팟(둥지·까치·바구니·내복). 내부 좌표.
 * 위·아래 자리가 여기에 걸리면 `placeBubble`이 화자 옆으로 옮긴다. 서는 자리(`spots`)는 사람이 가리는 곳이라 넣지 않는다.
 */
function bubbleKeepBoxes(speaker: string, layout: ReturnType<typeof sceneLayout>): HitBox[] {
  return Object.entries(layout.hotspots).filter(([id]) => id !== speaker).map(([, box]) => box);
}

/** 옆 배치가 가리면 안 되는 다른 사람 몸(#356). 위·아래 자리는 예전처럼 이걸 보지 않는다. 내부 좌표. */
function bubbleBodyBoxes(speaker: string, layout: ReturnType<typeof sceneLayout>): HitBox[] {
  return Object.entries(layout.chars).filter(([id]) => id !== speaker).map(([, box]) => box);
}

/** 말풍선 틈(CSS px). gap 안에 꼬리(index.html `#bubble::after`, 아래로 7px)가 들어간다. tailInset은 글자 크기를 따른다. */
const BUBBLE_OPTS: Omit<BubbleOptions, 'tailInset'> = { margin: 4, gap: 9, avoidGap: 4 };
/** 글·최대 폭·글자 크기가 같으면 크기도 같다. 매 프레임 재면 레이아웃을 강제로 다시 하므로 바뀔 때만 잰다. */
let bubbleMeasured = { key: '', width: 0, height: 0 };

function placeBubbleDom(text: string, speaker: BubbleAnchor | null, keep: readonly HitBox[] = [], bodies: readonly HitBox[] = []): void {
  const r = display.rect();
  const fontPx = bubbleFontPx(r.width / INTERNAL_WIDTH);
  const fontSize = `${fontPx}px`;
  if (bubble.style.fontSize !== fontSize) bubble.style.fontSize = fontSize;
  const maxWidth = `${bubbleMaxWidth(r, BUBBLE_OPTS)}px`;
  if (bubble.style.maxWidth !== maxWidth) bubble.style.maxWidth = maxWidth;
  if (bubble.textContent !== text) bubble.textContent = text;
  const key = `${fontSize}|${maxWidth}|${text}`;
  if (bubbleMeasured.key !== key) bubbleMeasured = { key, width: bubble.offsetWidth, height: bubble.offsetHeight };
  const toScreen = (x: number, y: number): Point => internalToScreen({ x, y }, r, display.internal);
  // 화자가 없으면(대상 상자가 없는 연출) 예전처럼 화면 위쪽 가운데.
  const a = speaker ?? { x: INTERNAL_WIDTH / 2, top: 60, bottom: 60 };
  const head = toScreen(a.x, a.top);
  const anchor: BubbleAnchor = { x: head.x, top: head.y, bottom: toScreen(a.x, a.bottom).y };
  if (a.left !== undefined && a.right !== undefined) {
    anchor.left = toScreen(a.left, a.top).x;
    anchor.right = toScreen(a.right, a.top).x;
  }
  const boxToScreen = (k: HitBox): Rect => {
    const tl = toScreen(k.left, k.top);
    const br = toScreen(k.left + k.width, k.top + k.height);
    return { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  };
  const p = placeBubble(anchor, bubbleMeasured, r, { ...BUBBLE_OPTS, tailInset: bubbleTailInset(fontPx) }, bubbleAvoidBoxes(), keep.map(boxToScreen), bodies.map(boxToScreen));
  bubble.style.left = `${Math.round(p.left)}px`;
  bubble.style.top = `${Math.round(p.top)}px`;
  bubble.style.setProperty('--tail-x', `${Math.round(p.tailX)}px`);
  bubble.style.setProperty('--tail-y', `${Math.round(p.tailY ?? 0)}px`);
  bubble.toggleAttribute('data-below', p.below);
  if (p.side) bubble.dataset.side = p.side;
  else delete bubble.dataset.side;
}

/**
 * 말풍선이 피할 상자(#351, 설계 6-5절): 목표 줄 `#hud`와 얼굴 아래 특기 이름표. 실제 DOM 상자를 쓴다(글꼴·배율마다 폭이
 * 달라 상수로는 못 맞춘다). 그래서 이 함수는 목표 줄·이름표를 놓은 **뒤에** 불러야 한다(render 끝).
 */
function bubbleAvoidBoxes(): Rect[] {
  const els = [hud, ...hudTagLayer.querySelectorAll<HTMLElement>('.hudtag[data-anchor="top-center"]')];
  return els.filter((el) => !el.hidden).map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0)
    .map((b) => ({ left: b.left, top: b.top, width: b.width, height: b.height }));
}

function placeDom(el: HTMLElement, at: Point): void {
  const s = internalToScreen(at, display.rect(), display.internal);
  el.style.left = `${Math.round(s.x)}px`;
  el.style.top = `${Math.round(s.y)}px`;
}

/** 늘 보이는 HUD 이름표(설계 6-4-2절: 얼굴 아래 특기, 6-3-2절: 게이지). 글자 = 내부 7px × 화면 배율, 최소 11 CSS px. */
const hudTagEls = new Map<string, HTMLElement>();
function placeHudTags(): void {
  const scale = display.rect().width / INTERNAL_WIDTH;
  const size = `${hudTagFontPx(scale)}px`;
  // 1.2배 미만(667×375 @2 등)은 `palt` + padding 0. CSS는 index.html `#hudtags[data-tight]`.
  hudTagLayer.toggleAttribute('data-tight', hudTagTight(scale));
  for (const tag of hudTags(t)) {
    let el = hudTagEls.get(tag.id);
    if (!el) {
      el = document.createElement('span');
      el.className = 'hudtag';
      el.dataset.id = tag.id;
      el.dataset.anchor = tag.anchor;
      hudTagLayer.append(el);
      hudTagEls.set(tag.id, el);
    }
    if (el.textContent !== tag.text) el.textContent = tag.text;
    if (el.style.fontSize !== size) el.style.fontSize = size;
    placeDom(el, { x: tag.x, y: tag.y });
  }
}

/**
 * 목표 줄(설계 6-2-2절, #336): 게임 화면 내부 (4,4). 글자는 이름표와 같은 식.
 * 한 줄 폭이 최대 폭(둥지 앞 x 118)을 넘으면 글의 U+200B를 줄바꿈으로 바꿔 두 줄로 쓴다. 브라우저 자동 줄바꿈에 맡기면
 * 상자가 최대 폭까지 늘어나 첫 줄 오른쪽에 빈 바탕이 남아서, 폭은 늘 max-content(글에 딱 맞게)로 두고 줄은 여기서 정한다.
 */
let goalMeasured = { key: '', width: 0 };
function placeGoal(scale: number): void {
  const size = `${hudTagFontPx(scale)}px`;
  if (hud.style.fontSize !== size) hud.style.fontSize = size;
  const goal = t('ui.intro');
  const oneLine = goal.replaceAll('\u200b', '');
  const key = `${size}|${goal}`;
  if (goalMeasured.key !== key) {
    hud.textContent = oneLine;
    goalMeasured = { key, width: hud.offsetWidth };
  }
  const text = goalMeasured.width <= goalMaxWidthPx(scale) ? oneLine : goal.replaceAll('\u200b', '\n');
  if (hud.textContent !== text) hud.textContent = text;
  placeDom(hud, GOAL_AT);
}

/** 대상 상자 중 시트가 그리지 않는 것만. 시트 이미지가 아직이면 전부(임시 상자). */
function uncovered(boxes: Record<string, HitBox>): Record<string, HitBox> {
  const { art, covered } = session;
  if (!art?.objectsReady) return boxes;
  return Object.fromEntries(Object.entries(boxes).filter(([id]) => !covered.has(id)));
}

/** 로딩 중 한 프레임: 캔버스는 잉크로 덮고 DOM 글자는 `#loading`만 남긴다. */
function renderLoading(): void {
  const { ctx, internal } = display;
  ctx.fillStyle = FX_COLORS.ink;
  ctx.fillRect(0, 0, internal.width, internal.height);
  display.present();
  for (const el of [hud, bubble, label, clearCut, faintCut, cardEl, restartEl]) el.hidden = true;
  loadingEl.hidden = false;
  placeDom(loadingEl, { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT / 2 });
}

/** 처음부터 버튼: HUD 오른쪽 위 `RESTART_BOX`(28×28 아이콘). 크기는 상자 × 배율, 아이콘은 시트 칸 20×20 × 배율. 카드가 떠 있으면 숨긴다. */
function placeRestart(scale: number, armed: boolean): void {
  restartEl.hidden = startCard.open;
  if (restartEl.hidden) return;
  restartEl.toggleAttribute('data-armed', armed);
  paintHudIcon(restartIcon, 'restart', scale);
  const w = `${Math.round(RESTART_BOX.width * scale)}px`;
  const h = `${Math.round(RESTART_BOX.height * scale)}px`;
  if (restartEl.style.width !== w) restartEl.style.width = w;
  if (restartEl.style.height !== h) restartEl.style.height = h;
  placeDom(restartEl, { x: RESTART_BOX.left, y: RESTART_BOX.top });
}

function render(): void {
  if (!loaded) {
    renderLoading();
    return;
  }
  loadingEl.hidden = true;
  const { ctx, internal } = display;
  const s = session;
  const { data, scene, art, spriteTops } = s;
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
  const bgDrawn = drawSceneBg(ctx, art);
  if (!bgDrawn) drawRoom(ctx, internal, WALK_AREA);
  const boxSpots = uncovered(layout.spots);
  const boxHotspots = uncovered(layout.hotspots);
  // 글자 아닌 fx 중 물건을 옮기는 것(`nod`, #485): 임시 상자는 여기서, 시트 칸은 아래 `nudged`로 옮긴다.
  const nudges = fxNudges(fxNow);
  drawTargets(ctx, boxSpots, nudgeBoxes(boxHotspots, nudges));

  // 물건 그림(형식 기록 4·6절): 보이는 플래그로 멈춘 모습, 재생 중 물건 anim은 그 프레임.
  const playing = scene.current?.art ? { ...scene.current.art, ms: scene.current.t * TICK_MS } : null;
  let draws: SceneDraws | null = null;
  let artView: SceneView | null = null;
  if (art) {
    const view: SceneView = { flagsOf: (k: string) => shownFlags(scene, k), playing, cued: cuedArtView(scene), held: heldArtView(scene), clockMs: scene.tick * TICK_MS, tiltOf: (k: string) => tiltOf(data, scene, k) };
    artView = view;
    s.loopClock = loopStarts(art.meta, view, s.loopClock);
    draws = sceneDraws(art.meta, { ...view, loopStarts: s.loopClock });
  }
  const lit = draws ? litFrames(art!.meta, draws, litTarget) : new Set<number>();
  const nudged = draws ? frameNudges(art!.meta, draws, nudges) : new Map<number, Nudge>();
  // 효과 자리(형식 기록 11절)는 적힌 순서 그 자리에서 입자를 그린다. 배경이 없으면(9절 폴백) 효과도 그리지 않는다.
  for (const f of draws?.back ?? []) {
    if (typeof f === 'number') drawSceneFrame(ctx, art!, f, lit.has(f), nudged.get(f));
    else if (bgDrawn) drawSceneFx(ctx, f);
  }

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
      drawSceneFrame(ctx, art!, it.frame!, lit.has(it.frame!), nudged.get(it.frame!));
      continue;
    }
    const id = it.char;
    // 판 위 발은 기울기만큼 내려 그린다(형식 기록 12절). 히트 박스(`bodies`)도 같은 값을 따르고, 발 y 순서만 걷기 좌표 그대로다.
    const drop = boardDrop(data, scene, id);
    const w = drop === 0 ? scene.walkers[id] : { ...scene.walkers[id], y: scene.walkers[id].y + drop };
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
  for (const f of draws?.front ?? []) drawSceneFrame(ctx, art!, f, lit.has(f), nudged.get(f));
  const fxArt: NonNullable<FrameArt['fx']>[number][] = [];
  for (const f of fxNow) {
    // 물 입자 fx(`splash`·`ripple`, #485)는 물 4색 입자로. 옮기는 fx(`nod`)는 위에서 그림을 옮겼다. 둘 다 임시 별을 안 그린다.
    // 글자 곁 입자(`poof_text` 흙먼지, #526)는 입자를 먼저 그리고 글자를 그 위에 그린다.
    const shape = particleFx(f.effect);
    if (shape) {
      const at = shape.anchor === 'foot' ? footOf(f.target, layout) : anchorOf(f.target, layout);
      if (at) drawParticles(ctx, shapeParticles(f.effect, at, f.t));
    }
    if (drawnByShape(f.effect)) continue;
    const style = FX_STYLE[f.effect];
    // 소리 글자는 자리 예외(`fxTextSpot`)가 있으면 그 자리, 아니면 대상 그림 위 끝 가운데.
    const at = (style && fxTextSpotAt(f, layout)) || anchorOf(f.target, layout);
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
    drawActiveMarker(ctx, headY(box, spriteTops[scene.ui.active]), me.x, scene.tick);
  }
  if (scene.ui.selected) {
    const target = scene.ui.selected.split('|')[2] ?? '';
    const box = layout.hotspots[target] ?? layout.spots[target];
    // 시트 그림이 외곽선으로 켜졌으면 임시 상자 테두리는 겹쳐 그리지 않는다(폴백 상자에만).
    if (box && !(art?.outlined && lit.size > 0)) drawOutline(ctx, box, scene.tick);
  }
  ctx.restore();
  drawHud(ctx, layout.hud, { band: GAUGE_BAND, track: GAUGE_TRACK, segs: GAUGE_SEGS }, { active: layout.active, gauge: layout.gauge, gaugeDrop: gaugeDrop(scene) }, drawHead);
  // 화면 전환 덮개(11-1절): 0번 ink로 HUD까지 덮는다. ORDER가 없으면 늘 0이다.
  const fv = flowView(flow, false);
  if (fv.cover > 0) {
    ctx.globalAlpha = Math.min(1, fv.cover);
    ctx.fillStyle = FX_COLORS.ink;
    ctx.fillRect(0, 0, internal.width, internal.height);
    ctx.globalAlpha = 1;
  }
  display.present();

  renderCard();

  placeHudTags();
  const hudHover = scene.cleared || hoverHud === null ? null : hudHoverText(hoverHud, t);
  noteGauge(notes, layout.gauge, scene.tick, t('ui.hud.gauge_first_drop'));
  // 처음 한 번 안내가 떠 있으면 그게 먼저다(첫 감소는 busy 중에 뜬다). 다음 탭이나 2.5초 뒤 지운다.
  const note = scene.cleared ? null : currentNote(notes, scene.tick);
  // 처음부터 버튼 첫 누름 뒤에는 확인 글이 무엇보다 먼저다(두 번째 누름을 기다린다는 걸 알려야 한다, #387).
  const armed = restartArmed(restart, performance.now());
  const restartText = armed ? t('ui.restart_confirm') : restartHover ? t('ui.restart_hover') : null;
  const labelString = restartText ?? note ?? (shown ? labelText(shown, data.screen.id, t) : (hudHover ?? ''));
  label.hidden = labelString === '';
  if (label.textContent !== labelString) label.textContent = labelString;
  // 글자 = 내부 7px × 배율, 최소 14(#337). 아래끝은 게이지 띠 위 2px(6-3-5절). 띠 위에 두면 막대를 덮는다.
  const scale = display.rect().width / INTERNAL_WIDTH;
  placeRestart(scale, armed);
  const labelSize = `${labelFontPx(scale)}px`;
  if (label.style.fontSize !== labelSize) label.style.fontSize = labelSize;
  placeDom(label, { x: INTERNAL_WIDTH / 2, y: LABEL_BOTTOM });

  placeClearCut(fv, scene);
  // 덮개가 있는 동안은 캔버스 위 DOM(목표 줄·이름표·라벨·말풍선·처음부터)도 숨긴다. 안 그러면 검은 화면 위에 글자만 떠 있다.
  const covered = fv.cover > 0;
  hudTagLayer.hidden = covered;
  if (flow.phase !== 'play') label.hidden = restartEl.hidden = true;
  hud.hidden = scene.cleared || covered;
  if (!hud.hidden) placeGoal(scale);
  // 게이지 0 컷(#129, L33)과 클리어 컷(L32). 그림 없는 M1 임시 연출: 클리어 카드와 같은 DOM 글 한 줄.
  const cut = layout.cut;
  faintCut.hidden = cut === null;
  if (cut !== null && faintCut.textContent !== t(cut)) faintCut.textContent = t(cut);
  const cutSize = `${cutFontPx(scale)}px`;
  const cutMax = `${bubbleMaxWidth(display.rect(), BUBBLE_OPTS)}px`;
  for (const el of [clearCut, faintCut]) {
    if (el.hidden) continue;
    if (el.style.fontSize !== cutSize) el.style.fontSize = cutSize;
    if (el.style.maxWidth !== cutMax) el.style.maxWidth = cutMax;
  }

  // DOM 말풍선(ADR-0004 결정 3). 화자 머리 위. 카드가 떠 있으면 진입 대사는 아직이다.
  // 폭은 글로만 정하고(화자 위치와 무관), 게임 화면 안으로 민다(#329). 목표 줄·이름표를 피하므로(#351) 그것들을 놓은 뒤에 둔다.
  const b = startCard.open || covered ? null : currentBubble(scene);
  bubble.hidden = !b;
  if (b) {
    // 재생 도구(#356 C-7 가림 검사)가 화자 자신의 핫스팟을 빼려고 읽는다.
    if (bubble.dataset.speaker !== b.speaker) bubble.dataset.speaker = b.speaker;
    // 핫스팟 화자가 지금 anim 칸(재생 중·붙든 hold)을 그리면 그 칸에 붙인다(#450). 캐릭터 ID는 물건 `ids`에 없어서(ADR-0065 예약어) null이다.
    const frameBox = art && artView ? animFrameBox(art.meta, artView, b.speaker) : null;
    placeBubbleDom(sayText(TEXT, b.text, b.speaker), speakerBox(b.speaker, layout, frameBox), bubbleKeepBoxes(b.speaker, layout), bubbleBodyBoxes(b.speaker, layout));
  }
}

/**
 * 클리어 카드 `#clear`. ORDER가 없으면 지금 배포본 그대로 `ui.clear`(클리어 컷이 끝나면 뜬다).
 * ORDER가 있으면 결과 줄 `<id>.clear_card` + 0.6초 뒤 `ui.next`(11-2절), 마지막 화면은 끝 카드 `ui.end`(11-5절).
 * 다음 화면 그림을 0.5초 넘게 기다리면 같은 자리에 `…`(11-1절). 재생 도구는 `data-next`를 보고 카드를 누른다(11-6절 5번).
 */
function placeClearCut(fv: ReturnType<typeof flowView>, scene: SceneState): void {
  let text: string | null;
  if (!ORDER) text = scene.cleared && !isBusy(scene) ? t('ui.clear') : null;
  else if (fv.dots) text = '…';
  else if (fv.card && flow.phase === 'card') {
    const lines = cardLines(session.data.screen.id, flow.last, (k) => k in TEXT);
    const next = fv.next && lines.next ? t(cardPointer(window.matchMedia?.bind(window)) === 'mouse' ? `${lines.next}_click` : lines.next) : null;
    text = [lines.body && t(lines.body), next].filter(Boolean).join('\n') || null;
  } else text = null;
  clearCut.hidden = text === null;
  clearCut.toggleAttribute('data-next', fv.next);
  if (text !== null && clearCut.textContent !== text) clearCut.textContent = text;
}

/**
 * 카드 글자 = 내부 8px × 화면 배율, 최소 13 CSS px. 폭은 캔버스의 80%, 높이는 85% 이하(6-2-1절).
 * 배율 1.2 미만(667×375 @2 등)은 압축 카드(#335): 폭 90%, 얼굴 작게, 줄 간격 1.25(CSS `#card[data-tight]`).
 * 13px 글자가 1.0배에서 내부 13px이라 80% 폭에 게이지 줄이 한 줄로 안 들어가고, 높이도 상한을 넘었다.
 */
const CARD_PX = 8;
const CARD_MIN_CSS = 13;
function renderCard(): void {
  cardEl.hidden = !startCard.open;
  if (!startCard.open) return;
  const r = display.rect();
  const scale = r.width / INTERNAL_WIDTH;
  const fontPx = Math.max(CARD_MIN_CSS, Math.round(CARD_PX * scale));
  const size = `${fontPx}px`;
  if (cardEl.style.fontSize !== size) cardEl.style.fontSize = size;
  // 특기 줄 사이 0.15em을 장치 px 정수로(#342). CSS `#card li + li`가 읽는다.
  const dpr = window.devicePixelRatio || 1;
  const rowGap = `${cardRowGapPx(fontPx, dpr)}px`;
  if (cardEl.style.getPropertyValue('--row-gap') !== rowGap) cardEl.style.setProperty('--row-gap', rowGap);
  // 얼굴 = head 24px × 정수 배율, 최소 2배. 글자가 배율로 커지는데 얼굴이 48px로 고정이면 큰 화면에서 줄보다 작아진다(PR #306 리뷰).
  const tight = cardTight(scale);
  cardEl.toggleAttribute('data-tight', tight);
  const face = `${cardFacePx(scale, dpr)}px`;
  for (const f of cardFaces) if (f.el.style.width !== face) f.el.style.width = f.el.style.height = face;
  cardEl.style.maxWidth = `${Math.floor(r.width * (tight ? 0.9 : 0.8))}px`;
  cardEl.style.maxHeight = `${Math.floor(r.height * 0.85)}px`;
  // 뷰포트가 아니라 캔버스 가운데(캔버스가 세로 가운데가 아닐 때가 있다).
  placeDom(cardEl, { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT / 2 });
  // 재생 도구(#101·#292)는 이 표시를 보고 닫는 탭을 보낸다.
  cardEl.toggleAttribute('data-ready', cardReady(startCard));
  for (const f of cardFaces) if (!f.drawn && f.ctx) f.drawn = drawHead(f.ctx, f.id, { x: 0, y: 0 });
}

startLoop({
  step: () => {
    // 로딩이 끝나야 카드 잠금·장면 시간이 흐른다(#387). 한 번 끝나면 다시 보지 않는다.
    loaded ||= loadingDone(loadStates(session.art), performance.now() - loadStart);
    if (!loaded) return;
    cardTick(startCard);
    if (startCard.open) return;
    // 어두워지는 동안까지는 지난 판이 움직이고, 다 검어진 뒤(기다림·밝아짐)는 멈춘다. 새 판 진입 연출은 밝아진 뒤에 시작한다(11-1절).
    if (flow.phase === 'play' || flow.phase === 'card' || flow.phase === 'fadeOut') sceneTick(session.data, session.scene);
    stepFlow();
  },
  render,
});
