// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 화면 1(magpie_nest, `?screen=<id>`로 다른 화면 #466)을 탭으로 처음부터 끝까지 푼다(#68). 캐릭터는 시트가 있으면 시트 그림(#140), 없으면 임시 실루엣이다.
// 배경·물건은 화면 시트가 있으면 시트 그림(#157), 없으면 임시 방·상자다(형식 기록 9절).
// 진행 로직은 core/scene.ts에 있다. 여기서는 입력을 넘기고, 결과를 그리고, DOM 말풍선·라벨을 띄운다.

import charactersJson from '../content/characters.json';
import texts from '../content/text/ja.json';
import { sayText } from './core/sayText';
import { bubbleBounds, bubbleFontPx, bubbleMaxWidth, bubbleTailInset, placeBubble, type BubbleAnchor, type BubbleOptions, type KeepBox } from './core/bubble';
import { CHARACTERS, type CharacterId } from './core/characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, walkAreaOf } from './core/config';
import { frameFallbacks, type FrameArt, type Loaded } from './core/fallbacks';
import { actorEdgeAt, besideFeetAt, dustPush, FX_COLORS, FX_STYLE, fxTextSpot, SHAKE_FX, shakeOffset } from './core/fx';
import { drawnByShape, frameNudges, fxNudges, particleFx, shapeParticles, type Nudge } from './core/fxShape';
import type { HitBox } from './core/hit';
import { cutCenter } from './core/cutPlace';
import { cardFacePx, cardInput, cardPointer, cardRowGapPx, cardReady, cardText, cardTick, cardTight, createStartCard, entryCardKind, reopenCard, type CardKind } from './core/startCard';
import { createFirstNotes, currentNote, labelKey, noteAction, noteGauge, noteHover, noteStood, noteSwitch, noteSwitched, noteTap, noteWalkDone, noteWalkSkipped, noteWalkStart, noteWalkTap, selectLabelText, standLabel, standSelect } from './core/firstNotes';
import { cutFontPx, firstSwitchText, GAUGE_BAND, GAUGE_SEGS, GAUGE_TRACK, GOAL_AT, goalMaxWidthPx, HUD_AREA, hudHoverText, hudTagFontPx, hudTags, hudTagTight, LABEL_BOTTOM, labelFontPx, switchText, type HudId } from './core/hud';
import { labelText, resolveTap, type Label } from './core/interact';
import { PICKER, type CharactersData, type ScreenData } from './core/puzzle/types';
import { pickScreen, screenTextKey } from './core/screenPick';
import { AFTER_MENU, cardLines, enterCharacter, flowTap, flowTick, flowView, nextIndex, parseOrder, PLAYING, playtestOrder, showCard, soloCardKey, startOrder, usesSave, type Flow } from './core/flow';
import { CONTENT_VERSION, saveOnCard, startFromSave } from './core/progress';
import { LocalSaveStore, probeStorage } from './core/save/store';
import type { SaveData } from './core/save/schema';
import orderJson from '../content/screens/order.json';
import { activeFx, activeMarkerVisible, boardDrop, carried, charPose, headAnchor, charWalking, createScene, currentBubble, drawOrder, speakerFaceBox, stepOffBubbleBox, gaugeDrop, introHoverScene, isBusy, isHanging, sceneArtView, shownFlags, sceneLayout, mouseHoverThroughSay, sceneTap, sceneTick, selectsDuringSay, takeHeldTap, takeWalkStart, tapContext, type SceneData, type SceneState } from './core/scene';
import { animFrameBox, carriedPlace, coveredIds, headKeepBoxes, headPlaces, litFrames, loopStarts, sceneDraws, type HeadPlaced, type LoopStarts, type SceneDraws, type SceneView } from './core/sceneArt';
import { internalToScreen, screenToInternal, type Point, type Rect } from './core/viewport';
import { isTapKey } from './core/keys';
import { createRestartButton, loadingDone, RESTART_BOX, restartArmed, restartPress } from './core/restart';
import { createPauseClock, gameNow, ROTATE_QUERY, setPaused } from './core/rotate';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawHud } from './engine/hud';
import { drawActiveMarker, drawCharacter, drawOutline, drawRoom, drawSpark, drawStompDust, drawTarget, drawTargets } from './engine/placeholder';
import { drawHeadFrame, drawParticles, drawSceneBg, drawSceneFrame, drawSceneFx, loadSceneArt, sceneArtMeta, type SceneArt } from './engine/sceneArt';
import { drawHead, drawSprite, spriteAlpha, spriteMetas, spriteState, type SpriteTop } from './engine/sprites';
import { drawFxText, fxTextState, fxTextWidth } from './engine/fxText';
import { hudIconState, paintHudIcon } from './engine/hudIcons';
import { fadeOutCanvas, runTitle } from './engine/title';
import { runMap } from './engine/map';
import { mapReady } from './core/map';
import { entryFadeCover, ENTRY_FADE_TICKS, loadingTextShown, skipsTitle, titleMenu, titleTextReady, withoutMap } from './core/title';

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

/** 번들에 든 화면 데이터(파일 이름 = 화면 ID). 13KB 안팎이라 다 넣고 `?screen=`으로 고른다(#466). `order.json`은 화면이 아니라 뺀다(#766). */
const SCREENS = new Map(
  Object.entries(import.meta.glob<ScreenData>(['../content/screens/*.json', '!../content/screens/order.json'], { eager: true, import: 'default' })).map(([path, s]) => [path.replace(/^.*\/|\.json$/g, ''), s]),
);
const query = (key: string): string | null => new URLSearchParams(location.search).get(key);
const picked = pickScreen(query('screen'), [...SCREENS.keys()]);
if (picked.unknown) console.warn(`?screen=${picked.unknown}: 없는 화면이라 ${picked.id}로 엽니다`);
const TEXT: Readonly<Record<string, string>> = texts;
/**
 * 플레이 순서(#230 여러 화면 연결, #766). 쿼리가 없으면 배포 순서 `content/screens/order.json`이다
 * (지금은 임시 순서, L1 기록 `2026-11-22-default-link-interim-order`). `?playtest=1&order=a,b`가 그보다 먼저다.
 * null이면 `?screen=<id>`로 연 화면 하나: 클리어 뒤 `soloCardKey` 카드에서 끝나고 연결 경로(카드 탭·전환)를 아예 타지 않는다.
 * 세이브(#767)는 배포 순서로 도는 판에서만 읽고 쓴다(아래 `saveStore`).
 */
const DEPLOY_ORDER = parseOrder(orderJson, new Set(SCREENS.keys()));
if (!DEPLOY_ORDER.ok) console.error(`content/screens/order.json: ${DEPLOY_ORDER.error}. 화면 하나로 엽니다`);
const ORDER = startOrder(query, new Set(SCREENS.keys()), DEPLOY_ORDER);
if (query('order') !== null && !playtestOrder(query, new Set(SCREENS.keys()))) console.warn('?order=: playtest=1이 아니거나 모르는 화면 id가 있어 무시합니다');

/**
 * 세이브(#767, 설계 11-4절, ADR-0006 localStorage). 쿼리 없는 기본 링크에서 켜진다(기록 `default-link-always-latest`).
 * 끄는 판: `?screen=<id>` 화면 하나(`ORDER` null, 연결 경로를 안 탄다), `?playtest=1&order=` 덮어쓰기(같은 id 반복으로 "다 깸"이 일찍 참).
 * `?playtest=1`만 붙인 판(`solve.ts --deploy`)은 기본 링크와 같은 경로라 켜진다. 헤드리스 브라우저는 판마다 빈 저장소라 서로 새지 않는다.
 * 저장소가 막혀 있으면(쿠키 차단·사파리 개인 모드) 메모리에만 쓴다: 이 페이지 안에서는 그대로 돌고 새로고침하면 처음이다.
 */
const saveStore = ORDER && usesSave(playtestOrder(query, new Set(SCREENS.keys()))) ? new LocalSaveStore(probeStorage(() => window.localStorage).storage) : null;
/** 페이지를 열 때 읽은 세이브. 손상·상위 버전은 store가 백업에 옮기고 null을 준다(새로 하기). */
const LOADED_SAVE = saveStore && ORDER ? await saveStore.load() : null;
const START = saveStore && ORDER ? startFromSave(LOADED_SAVE, ORDER) : null;

// 타이틀이 먼저 캔버스를 쓴다(아래 판보다 앞).
const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });

/** 타이틀·맵 글(키가 없으면 키 그대로, 판에 묶인 `t`와 달리 화면별 덮어쓰기 없음)과 세로 안내. 아래 타이틀보다 먼저 있어야 한다. */
const menuText = (id: string): string => TEXT[id] ?? id;
const menuRotating = (): boolean => window.matchMedia?.(ROTATE_QUERY).matches ?? false;
/**
 * 타이틀(#792 2/3, 설계 `title-and-map.md`). 세이브가 켜진 기본 링크에서만 뜬다. 쿼리(팀 도구)면 건너뛴다(1절).
 * 버튼 글(Kai)이 글 파일에 아직 없으면 키 이름이 찍히지 않게 건너뛴다(`titleTextReady`). `マップ`는 맵 글이 있을 때만(`mapReady`, 3/3).
 * 판을 만들기 전에 기다리므로, 고른 시작 화면·세이브가 아래 판 만들기에 그대로 들어간다. 게임 입력 게이트는 안 바뀐다.
 */
const TITLE = saveStore && ORDER && !skipsTitle(query) && titleTextReady(TEXT) ? await showTitle(saveStore, ORDER, LOADED_SAVE) : null;

/**
 * 타이틀과 맵(#792 3/3). 맵 글(`ui.map.*`, `<id>.map.name`)이 다 있고 카드 자리(3개)에 판이 다 들어갈 때만 `マップ`를 둔다.
 * 맵에서 깬 카드를 누르면 그 판 처음부터 다시 한다(`prev` 그대로, `saveOnCard` 다시 하기 경로라 checkpoint 안 바뀜).
 */
function showTitle(store: LocalSaveStore, order: readonly string[], loaded: SaveData | null): ReturnType<typeof runTitle> {
  const menu = titleMenu(loaded, order);
  return runTitle({
    display,
    menu: mapReady(TEXT, order) ? menu : withoutMap(menu),
    order,
    text: menuText,
    build: buildTag(import.meta.env.VITE_BUILD_SHA),
    reload: () => store.load(),
    rotating: menuRotating,
    openMap: () => runMap(mapDeps(store, order, menu.prev)),
  });
}
/** 맵(3절). 타이틀에서 열 때와 다시 한 판 클리어 카드에서 돌아올 때(3-4절, `focus` = 그 판 카드) 같다. */
function mapDeps(store: LocalSaveStore, order: readonly string[], prev: SaveData | null, focus?: number): Parameters<typeof runMap>[0] {
  return { display, order, prev, text: menuText, reload: () => store.load(), rotating: menuRotating, fadeOut: fadeOutCanvas, startView: (id, art) => mapStartView(id, art), focus };
}
// `はじめ`(두 번 눌러 확인함)은 세이브를 지운다(2-2절 ①). 안 지우면 첫 카드 전에 새로고침했을 때 옛 `つづき`가 다시 뜬다.
if (TITLE && !TITLE.prev && LOADED_SAVE) await saveStore!.clear().catch((e: unknown) => console.warn('세이브를 지우지 못했습니다', e));
/** 타이틀 뒤 밝아짐 남은 틱(2-4절). 로딩이 끝난 뒤 줄고, 0이 되면 시작 카드가 뜬다. 타이틀 없이 연 판은 0. */
let entryLeft = TITLE ? ENTRY_FADE_TICKS : 0;
/** 클리어 카드가 이어 쓸 마지막 세이브(이 페이지에서 쓴 것 포함). */
let saved: SaveData | null = TITLE ? TITLE.prev : (START?.prev ?? null);

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

/**
 * 이번 페이지에서 클리어 연출을 끝까지 본 화면 ID(#765). 새 판(처음부터·다시 들어옴)의 `clearSeen`이 되어 두 번째부터 탭 하나로 카드까지 넘긴다.
 * UI 상태라 새로고침하면 지워진다(세이브 안 함, M2 회의록). 클리어 규칙의 `clear` 이벤트가 시작되면(`cleared`) 본 것으로 센다.
 */
const seenClears = new Set<string>();

/** 새 판. 이 화면 클리어를 이미 봤으면 건너뛰기를 켠다(#765). */
function newScene(data: SceneData): SceneState {
  const scene = createScene(data);
  scene.clearSeen = seenClears.has(data.screen.id);
  return scene;
}

function enterScreen(id: string): Session {
  const art = loadSceneArt(id);
  const data = screenData(id, art);
  return { data, art, covered: art ? coveredIds(art.meta) : new Set<string>(), scene: newScene(data), loopClock: {}, spriteTops: {} };
}

/** 맵 썸네일(3-3절): 그 판 시작 상태의 그림 보기. 새 판 하나를 만들어 보기만 읽는다(캐릭터는 맵이 안 그린다). */
function mapStartView(id: string, art: SceneArt): SceneView | null {
  if (!SCREENS.has(id)) return null;
  const data = screenData(id, art);
  return sceneArtView(data, createScene(data));
}

function screenData(id: string, art: SceneArt | null): SceneData {
  const screen = SCREENS.get(id);
  if (!screen) throw new Error(`화면 ${id}가 번들에 없습니다`);
  return {
    screen,
    characters: charactersJson as CharactersData,
    art: sceneArtMeta(id) ?? undefined,
    sprites: spriteMetas(),
    // 클리어 컷 글(L32, 설계 8절). 화면 문법에 필드가 없어 `<화면 ID>.clear` 텍스트가 있으면 쓴다.
    clearLine: `${id}.clear` in TEXT ? `${id}.clear` : undefined,
    texts: TEXT,
    // 바닥 동료의 보이는 그림 칸 판정(2-1절, #736). 이미지가 오기 전에는 null → 얼굴 상자만.
    alpha: { sprite: spriteAlpha, objects: () => (art?.objectsReady ? art.alpha : null) },
  };
}

/** 순서 안 지금 위치. 같은 id가 두 번 나와도 위치로 센다(`flow.ts` nextIndex). 세이브에서 이어 하면 그 화면 위치다. */
let orderIndex = TITLE ? TITLE.index : START?.resume.kind === 'continue' ? START.resume.index : 0;
let session = enterScreen(ORDER ? ORDER[orderIndex]! : picked.id);
// 이어 하는 화면의 지금 캐릭터: 저장한 캐릭터가 그 화면 `start.at`에 없으면 다음 화면 들어갈 때와 같은 대체 규칙(11-3절).
const resumeCharacter = TITLE ? TITLE.activeCharacter : START?.resume.kind === 'continue' ? START.resume.activeCharacter : null;
if (resumeCharacter !== null) session.scene.ui.active = enterCharacter(resumeCharacter, session.data.screen.start.at, CHARACTERS.map((c) => c.id)) as CharacterId;
/** 화면 사이 흐름(ui-interaction 11-1절). `ORDER`가 없으면 늘 `play`다. */
let flow: Flow = PLAYING;
/** 맵에서 고른 판을 다시 하는 중(#792 `title-and-map.md` 3-4절). 클리어 카드가 다음 판 대신 맵으로 돌아간다. */
let replaying = TITLE?.replay === true;
/** 맵·타이틀이 캔버스를 쓰는 중(3-4절). 그동안 판 시간도 그리기도 멈춘다. */
let menuOpen = false;
/**
 * 메뉴에서 고른 판에 들어갈 때 지금 캐릭터. `undefined`면 다음 판 규칙(지금 캐릭터 이어 감, 11-3절),
 * null이면 그 판 기본(타이틀 뒤 첫 판과 같다), 문자열이면 세이브 것(`つづき`).
 */
let pendingActive: string | null | undefined;
/** 클리어 카드가 뜰 때 미리 만든 다음 화면 판. 그림을 카드 보는 동안 받는다(11-1절 "다음 화면 그림 기다림 0초가 목표"). */
let pending: { index: number; session: Session } | null = null;
/** 글 ID → 지금 화면의 글(`<화면 ID>.card.goal` 등이 있으면 그것, #380). */
const t = (id: string): string => TEXT[screenTextKey(TEXT, session.data.screen.id, id)] ?? id;

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
  w.__gcFlow = () => ({ order: ORDER, index: orderIndex, screen: session.data.screen.id, phase: flow.phase, replay: replaying, card: startCard.open ? cardKind : null });
}

/** 터치 첫 탭으로 고른 대상의 라벨. 실행하거나 다른 걸 누르면 지운다. */
let touchLabel: Label | null = null;
/** 데스크톱 호버 라벨. */
let hoverLabel: Label | null = null;
/** 데스크톱 호버 중인 HUD 칸(설명은 대상 라벨 자리에, 설계 6-1-3절). */
let hoverHud: HudId | 'gauge' | null = null;
/** 처음 한 번 안내(첫 전환 특기 설명, 첫 감소 게이지 뜻, 올라선 뒤 그 자리 라벨, 설계 6-4-3·6-2-5·6-4-1a절). */
const notes = createFirstNotes(session.scene.shownGauge, session.scene.ui.active);
/** 마지막 마우스 자리(내부 좌표). busy가 풀리면 여기로 호버 라벨을 다시 잰다(6-4-1a절). 터치 탭이 오면 지운다. */
let lastMouse: Point | null = null;
/** 지난 틱에 busy였나. busy가 풀린 첫 틱을 알아본다. */
let wasBusy = false;
/** 배포 빌드의 커밋 앞 7자리(#460). 로컬 빌드는 `dev`. */
function buildTag(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : 'dev';
}

/** 시작 카드(설계 6-2-1절). 떠 있는 동안 장면은 멈추고(진입 연출 포함) 입력은 카드만 받는다. */
const startCard = createStartCard();
/**
 * 지금 카드 종류(11-1-1절, #892). 첫 판(또는 `?screen=` 화면 하나)은 전체, 그 밖은 짧은 카드다.
 * 페이지 첫 판은 여기서, 그 뒤 판(다음 판·게임 안 맵·타이틀)은 밝아짐이 끝난 틱에 `openEntryCard`가 정한다.
 */
let cardKind: CardKind = entryCardKind(ORDER, orderIndex);

/**
 * 세로 화면 안내(설계 9절, #624). 안내 자체는 index.html CSS가 같은 쿼리로 띄운다(JS 전부터 보인다).
 * 여기서는 떠 있는 동안 게임을 멈춘다(9-5절): 고정 틱을 건너뛰고(카드 잠금·연출·말풍선·걷기·게이지), 입력을 버리고,
 * 처음부터 버튼 3초(벽시계)도 멈춘 시간만큼 미룬다. 그림 읽기는 멈추지 않는다.
 */
const rotateMq = window.matchMedia?.(ROTATE_QUERY);
const rotating = (): boolean => rotateMq?.matches ?? false;
const pause = createPauseClock();
/** 처음부터 버튼이 쓰는 시각. 안내가 떠 있던 시간은 빠진다. */
const playNow = (): number => gameNow(pause, performance.now());
/** 카드 특기 줄의 얼굴 칸. 얼굴 시트가 늦게 오면 다 그릴 때까지 프레임마다 다시 그린다. */
const cardFaces = buildCard();

function buildCard(): { id: CharacterId; el: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; drawn: boolean }[] {
  // 특기 줄은 화면과 상관없어서 한 번만 만든다. 화면마다 바뀌는 줄·카드 종류는 `fillCard`가 넣는다.
  const text = cardText(t, 'mouse', 'full');
  need('#card .build').textContent = buildTag(import.meta.env.VITE_BUILD_SHA);
  fillCard();
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

/**
 * 카드 글을 지금 판·종류로(11-1-1절). 짧은 카드는 특기 줄(`ul`)·게이지 줄을 숨긴다. 목표·이유는 `t`가 지금 화면 키로 찾는다(#380).
 * 시작 줄은 띄울 때마다 장치 특성으로 다시 고른다(#364).
 */
function fillCard(): void {
  const text = cardText(t, cardPointer(window.matchMedia?.bind(window)), cardKind);
  need('#card .goal').textContent = text.goal;
  need('#card .why').textContent = text.why;
  need('#card .start').textContent = `${text.start} ▶`;
  const gauge = need('#card .gauge');
  gauge.hidden = text.gauge === null;
  gauge.textContent = text.gauge ?? '';
  need('#card ul').hidden = cardKind === 'short';
  cardEl.dataset.kind = cardKind;
}

/** 다음 판·메뉴에서 고른 판이 다 밝아진 틱에 카드를 띄운다(11-1 표 "밝아짐 → 짧은 시작 카드"). 닫기 전까지 진입 연출은 멈춰 있다. */
function openEntryCard(): void {
  cardKind = entryCardKind(ORDER, orderIndex);
  fillCard();
  reopenCard(startCard);
}

// 카드 닫기: 카드 위·캔버스 밖·키보드 어디서든. 캔버스 탭은 캔버스 핸들러가 먼저 받아 버리고(카드가 떠 있으면 무시) 여기로 올라온다.
// 버블 단계라 닫는 탭이 같은 이벤트로 게임에 다시 들어가지 않는다.
// 클리어 카드도 같은 자리에서 받는다(11-1절: 화면 어디든 탭·클릭, Enter·Space). 시작 카드를 닫는 탭은 그 뒤 흐름이 `play`라 아무것도 안 한다.
// 안내(#rotate) 위 탭도 여기로 올라온다. 떠 있으면 버린다(9-5절: 돌리자마자 카드가 닫히거나 클리어 카드가 넘어가면 안 된다).
window.addEventListener('pointerdown', (e) => {
  if (!loaded || rotating() || !e.isPrimary || e.button !== 0) return;
  cardInput(startCard);
  tapFlow();
});
// 키는 "탭"으로 셀 수 있는 것만(반복·수정 키·브라우저 단축키 제외, PR #306 리뷰).
window.addEventListener('keydown', (e) => {
  if (!loaded || rotating() || !isTapKey(e)) return;
  cardInput(startCard);
  tapFlow();
});

/** 클리어 카드 탭(0.6초 안은 무시). 타이틀이 아직 없어서 끝 카드에서는 머문다(11-5절). */
function tapFlow(): void {
  if (!ORDER || startCard.open) return;
  flow = flowTap(flow, false).flow;
}

/** 클리어 카드 세이브(11-4절). 실패해도 판은 계속한다(store 계약: 실패하면 기존 세이브 유지). */
function writeSave(index: number, activeCharacter: string): void {
  if (!saveStore || !ORDER) return;
  saved = saveOnCard({ prev: saved, order: ORDER, index, activeCharacter, contentVersion: CONTENT_VERSION, now: new Date() });
  saveStore.save(saved).catch((e: unknown) => console.warn('세이브를 쓰지 못했습니다', e));
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
    flow = showCard(next === null, replaying);
    // 다시 하는 판은 맵으로 돌아가니 다음 판을 미리 안 만든다. 세이브는 `saveOnCard` 다시 하기 경로라 checkpoint가 그대로다.
    pending = next === null || replaying ? null : { index: next, session: enterScreen(ORDER[next]!) };
    // 카드가 뜨는 순간 저장(11-4절). 다음 화면 캐릭터는 swap 때와 같은 계산이다(카드 동안 전환 입력이 없어 지금 캐릭터가 안 바뀐다).
    const active = session.scene.ui.active;
    writeSave(orderIndex, pending ? enterCharacter(active, pending.session.data.screen.start.at, CHARACTERS.map((c) => c.id)) : active);
    return;
  }
  const fadingIn = flow.phase === 'fadeIn';
  const r = flowTick(flow, pending !== null && artReady(pending.session.art));
  flow = r.flow;
  if (fadingIn && flow.phase === 'play') openEntryCard();
  if (flow.phase === 'menu') {
    if (!menuOpen) void openMenu();
    return;
  }
  if (!r.swap || !pending) return;
  const prev = pendingActive === undefined ? session.scene.ui.active : pendingActive;
  pendingActive = undefined;
  session = pending.session;
  orderIndex = pending.index;
  pending = null;
  if (prev !== null) session.scene.ui.active = enterCharacter(prev, session.data.screen.start.at, CHARACTERS.map((c) => c.id)) as CharacterId;
  touchLabel = null;
  hoverLabel = null;
  hoverHud = null;
  noteTap(notes);
  notes.lastGauge = session.scene.shownGauge;
  notes.climbing = null;
}

/**
 * 다시 한 판의 카드를 탭해 다 어두워지면 맵(3-4절). 맵 `もどる`는 타이틀이고, 거기서 다시 고른 판으로 들어간다.
 * 고른 판은 다음 판 넘어가기와 같은 길(다 검은 채 그림 기다림 → 바꾸기 → 밝아짐 → 시작 카드)이다. 카드 종류는 고른 판 위치로 정한다(`entryCardKind`, #892).
 * `はじめ`(두 번 눌러 확인)면 페이지 첫 타이틀과 같이 세이브를 지운다.
 */
async function openMenu(): Promise<void> {
  if (!saveStore || !ORDER) return;
  const store = saveStore;
  const order = ORDER;
  menuOpen = true;
  for (const el of [hud, hudTagLayer, bubble, label, clearCut, faintCut, cardEl, restartEl]) el.hidden = true;
  const r = await runMap(mapDeps(store, order, saved, orderIndex));
  const start = r.kind === 'start' ? r.start : await showTitle(store, order, saved);
  if (!start.prev && saved) await store.clear().catch((e: unknown) => console.warn('세이브를 지우지 못했습니다', e));
  saved = start.prev;
  replaying = start.replay === true;
  pending = { index: start.index, session: enterScreen(order[start.index]!) };
  pendingActive = start.activeCharacter;
  flow = AFTER_MENU;
  menuOpen = false;
}

const inBox = (p: Point, b: HitBox): boolean => p.x >= b.left && p.x < b.left + b.width && p.y >= b.top && p.y < b.top + b.height;

window.addEventListener('resize', () => display.resize());
/** 캔버스 탭 하나(마우스 slop 0). 맡아 둔 클릭(`takeHeldTap`, #601)도 같은 길로 다시 누른다. */
function worldTap(p: Point, slop: number): void {
  if (!loaded || rotating() || startCard.open || flow.phase !== 'play') return; // 로딩·세로 안내 중이거나 카드 몫(window 핸들러가 닫는다)
  noteTap(notes); // 걷기 안내가 떠 있었으면 그 주인을 남긴다: 같은 사람이 목표를 바꾸면 횟수 없이 이어 띄운다(#755)
  if (slop > 0) lastMouse = null;
  lastTapTouch = slop > 0;
  const before = { ...session.scene.puzzle.at };
  const r = sceneTap(session.data, session.scene, p, slop, slop > 0);
  if (r.kind === 'skipWalk') noteWalkSkipped(notes);
  // 터치로 걷기 영역 밖(벽·소품 그림)을 눌러 바닥 걷기가 됐으면 `あるく`(5-2-6절). 몸이 누른 데가 아닌 아래 바닥으로 가서 반응 없음과 구분이 안 됐다(#601).
  // 걷기 시작(`pollWalkStart`) 전이라 이 탭에서는 긴 걷기 안내가 안 뜨고 횟수도 안 센다.
  if (slop > 0 && r.kind === 'intent' && r.intent.kind === 'walk') noteWalkTap(notes, p, walkAreaOf(session.data.screen), t('ui.verb.walk'), session.scene.tick);
  pollWalkStart();
  if (r.kind !== 'intent') return;
  touchLabel = r.intent.kind === 'select' ? r.intent.label : null;
  if (r.intent.kind === 'act') noteAction(notes, r.intent.action, before[r.intent.action.char], slop > 0);
  // 첫 전환 안내는 터치만(설계 6-4-3절, PR #295 리뷰). 마우스는 얼굴 호버로 특기 설명을 이미 봤고, 안내가 대상 호버 라벨을 가린다.
  // 글은 `{name}に交代（{desc}）`(#692 Luna 리뷰): 호버 글과 같으면 "바뀌었다"가 안 읽힌다.
  // 얼굴 탭·몸 탭 둘 다 전환이다. 처음 캐릭터는 시작 카드가 말했으니 띄우지 않는다(createFirstNotes).
  if (slop > 0 && r.intent.kind === 'switch') noteSwitch(notes, r.intent.char, firstSwitchText(r.intent.char, t));
  // 전환 알림 `{name}に交代`(#692): 마우스·터치, 몸 탭·얼굴 탭 모두. 위 첫 전환 안내가 떴으면 그게 먼저다(그 글도 `交代`로 시작한다).
  if (r.intent.kind === 'switch') {
    // 마우스는 바뀐 사람 기준으로 호버를 다시 잰다. 안 그러면 1px만 움직여도 "다른 대상"으로 읽혀 알림이 바로 꺼진다.
    if (slop === 0) updateHover(p);
    noteSwitched(notes, switchText(r.intent.char, t), session.scene.tick, slop > 0, labelKey(hoverLabel));
  }
}
onPointerTap(canvas, display.rect, display.internal, worldTap);
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
  // 안내 밑에 숨은 버튼에 초점이 남아 Enter·Space가 올 수 있다.
  if (!loaded || rotating() || startCard.open || flow.phase !== 'play') return;
  if (!restartPress(restart, playNow())) return;
  // 누른 뒤 초점이 남으면 Space 한 번에 다시 눌려서(두 번째 누름) 판이 또 날아간다.
  restartEl.blur();
  session.scene = newScene(session.data);
  session.loopClock = {};
  touchLabel = null;
  hoverLabel = null;
  hoverHud = null;
  noteTap(notes);
  notes.lastGauge = session.scene.shownGauge;
  notes.climbing = null;
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
  lastMouse = p;
  updateHover(p);
  noteHover(notes, labelKey(hoverLabel));
});
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') lastMouse = null;
});

/** 마우스 자리(내부 좌표, 캔버스 밖이면 null)로 호버 라벨·HUD 칸 설명·커서를 정한다. */
function updateHover(p: Point | null): void {
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
  // busy 중에는 끈다. 예외 둘:
  // - 시작 연출 중(#798, 예외 넷 1): 클릭이 남은 시작 연출을 끝내고 쉴 때처럼 처리되니, 라벨도 그 뒤 상태로 쉴 때 그대로 띄운다.
  // - 행동 뒤 마지막 말풍선 중(#776, 예외 넷 3): 그 클릭이 말풍선을 닫고 그대로 실행될 때만 띄운다.
  const intro = introHoverScene(scene);
  if (!intro && isBusy(scene) && !mouseHoverThroughSay(data, scene, p)) return;
  const hs = intro ?? scene;
  const r = resolveTap(tapContext(data, hs), hs.ui, p, 0);
  hoverLabel = 'label' in r ? r.label : null;
  canvas.style.cursor = r.kind === 'act' ? 'pointer' : 'default';
}

/** 마지막 캔버스 탭이 터치였나. 긴 걷기 안내 글(`タップ`/`クリック`)을 고른다(#38 5-2-2절, `ui.next`와 같은 나누기). */
let lastTapTouch = false;

/**
 * 방금 시작한 걷기가 길면 걷기 건너뛰기 안내를 라벨 자리에 띄운다(#38 5-2-2절). 탭 뒤와 매 틱 뒤(`noteWalkDone` 전)에 부른다.
 * 물건 탭의 걷기는 다음 틱에 시작한다. 목표 바꾸기 판단(`walkCarry`)은 `firstNotes`가 탭 뒤 첫 틱까지 들고 있는다(#755).
 */
function pollWalkStart(): void {
  const ws = takeWalkStart(session.scene);
  if (ws) noteWalkStart(notes, ws.char, ws.dist, t(lastTapTouch ? 'ui.hud.walk_skip' : 'ui.hud.walk_skip_click'));
}

/**
 * busy가 풀린 첫 틱(6-4-1a절). 방금 서는 자리에 선 사람이 지금 고른 사람이면 그 자리 특기 라벨을 2.5초 띄우고
 * (터치로 올라섰으면 대신 그 자리 특기를 고른다, 6-4-1a-1절), 마우스가 캔버스 위에 있으면 그 자리로 호버 라벨을 다시 잰다(탭 때 지운 라벨이 마우스를 움직여야만 돌아오던 것).
 */
function onSettled(): void {
  const { data, scene } = session;
  const view = { screen: data.screen, puzzle: scene.puzzle };
  const stood = noteStood(notes, scene.ui.active, scene.tick, ({ char, spot }) => {
    const l = standLabel(view, data.screen.rules, char, spot);
    return l ? labelText(l, data.screen.id, t) : null;
  });
  // 터치로 올라섰으면 글 대신 그 자리 특기를 첫 탭으로 고른 상태로(6-4-1a-1절, #710). 라벨은 터치 선택 라벨 그대로라 꼬리가 붙는다.
  // 플레이어가 이미 뭔가 골라 뒀으면 덮지 않는다.
  if (stood && scene.ui.selected === null) {
    const sel = standSelect(view, data.screen.rules, stood.char, stood.spot);
    if (sel) {
      scene.ui = { ...scene.ui, selected: sel.key };
      touchLabel = sel.label;
    }
  }
  if (lastMouse) updateHover(lastMouse);
}

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
 * `hintAbility`가 없는 핫스팟은 장난감(#598 Luna)이라 `toy`로 표시한다. 다 막혔을 때 가장 나중에 지킨다.
 */
function bubbleKeepBoxes(speaker: string, layout: ReturnType<typeof sceneLayout>, heads: readonly HeadPlaced[] = []): KeepBox[] {
  const hotspots = session.data.screen.hotspots;
  return [
    ...Object.entries(layout.hotspots).filter(([id]) => id !== speaker)
      .map(([id, box]) => (hotspots[id]?.hintAbility ? box : { ...box, toy: true })),
    // 다른 사람 머리 위 칸(형식 16절, #947). 머리 위 물건은 핫스팟이 아니라 위 목록에 없다.
    ...headKeepBoxes(heads, speaker),
  ];
}

/** 옆 배치가 가리면 안 되는 다른 사람 몸(#356). 위·아래 자리는 예전처럼 이걸 보지 않는다. 내부 좌표. */
function bubbleBodyBoxes(speaker: string, layout: ReturnType<typeof sceneLayout>): HitBox[] {
  return Object.entries(layout.chars).filter(([id]) => id !== speaker).map(([, box]) => box);
}

/** 말풍선 틈(CSS px). gap 안에 꼬리(index.html `#bubble::after`, 아래로 7px)가 들어간다. tailInset은 글자 크기를 따른다. */
const BUBBLE_OPTS: Omit<BubbleOptions, 'tailInset'> = { margin: 4, gap: 9, avoidGap: 4 };
/** 글·최대 폭·글자 크기가 같으면 크기도 같다. 매 프레임 재면 레이아웃을 강제로 다시 하므로 바뀔 때만 잰다. */
let bubbleMeasured = { key: '', width: 0, height: 0 };

function placeBubbleDom(text: string, speaker: BubbleAnchor | null, keep: readonly KeepBox[] = [], bodies: readonly HitBox[] = [], face: HitBox | null = null): void {
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
  if (face) anchor.face = boxToScreen(face);
  // 아래 라벨 줄·게이지 띠는 말풍선 자리가 아니다(#601 묶음 1-1). 최대 폭은 예전처럼 게임 화면 폭.
  const area = bubbleBounds(r, toScreen(0, LABEL_BOTTOM).y, labelFontPx(r.width / INTERNAL_WIDTH));
  const p = placeBubble(anchor, bubbleMeasured, area, { ...BUBBLE_OPTS, tailInset: bubbleTailInset(fontPx) }, bubbleAvoidBoxes(), keep.map((k) => ({ ...boxToScreen(k), toy: k.toy })), bodies.map(boxToScreen));
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
  // 1.2배 미만(640×300 @2 등, #714. 667×375 @2는 #713 뒤 1.39배)은 `palt` + padding 0. CSS는 index.html `#hudtags[data-tight]`.
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
  // 타이틀 뒤에는 0.5초 넘게 걸릴 때만 글을 띄운다(번쩍임 방지). 캔버스는 타이틀 어두워짐 끝과 같은 ink다.
  loadingEl.hidden = !loadingTextShown(TITLE !== null, performance.now() - loadStart);
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
  if (menuOpen) return; // 맵·타이틀이 캔버스를 그린다(3-4절)
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
  // 예외: 행동 뒤 마지막 말풍선 중 터치로 고른 대상(예외 넷 2, #700)은 말풍선과 함께 보인다. 안 그러면 첫 탭이 먹혔는지 안 보인다(#704).
  // 마우스는 그 클릭이 말풍선을 닫고 그대로 실행될 때만(예외 넷 3, #776). 잠금이 풀리는 순간은 마우스가 안 움직여도 오니 매 프레임 다시 잰다.
  // 시작 연출 중 마우스 호버는 쉴 때와 같다(#798, 예외 넷 1). 카드를 닫은 순간처럼 마우스가 가만히 있어도 뜨게 매 프레임 다시 잰다.
  // `updateHover`가 busy 중에는 이 두 때만 `hoverLabel`을 채운다.
  const sayingToMouse = lastMouse !== null && (selectsDuringSay(scene) || (scene.intro && isBusy(scene)));
  if (sayingToMouse) updateHover(lastMouse);
  const sayHover = sayingToMouse ? hoverLabel : null;
  const busyShown = (scene.ui.selected !== null && selectsDuringSay(scene) ? touchLabel : null) ?? sayHover;
  const shown = scene.cleared ? null : isBusy(scene) ? busyShown : (touchLabel ?? hoverLabel);
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
  if (!bgDrawn) drawRoom(ctx, internal, walkAreaOf(session.data.screen));
  const boxSpots = uncovered(layout.spots);
  const boxHotspots = uncovered(layout.hotspots);
  // 글자 아닌 fx 중 물건을 옮기는 것(`nod`, #485): 임시 상자는 여기서, 시트 칸은 아래 `nudged`로 옮긴다.
  const nudges = fxNudges(fxNow);
  drawTargets(ctx, boxSpots, nudgeBoxes(boxHotspots, nudges));

  // 물건 그림(형식 기록 4·6절): 보이는 플래그로 멈춘 모습, 재생 중 물건 anim은 그 프레임.
  let draws: SceneDraws | null = null;
  let artView: SceneView | null = null;
  if (art) {
    const view: SceneView = sceneArtView(data, scene);
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
  // 쭉이 손의 물건(ADR-1031 5절): 쭉이를 그린 바로 뒤에 `carry` 점에 얹는다. 앞에 선 동료·front 층은 그 위에 그린다.
  const hand = art ? carried(data, scene) : null;
  const handAt = hand?.at ? carriedPlace(art!.meta, hand.item, (k) => shownFlags(scene, k), hand.at) : null;
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
    if (handAt && id === PICKER) drawHeadFrame(ctx, art!, handAt.frame, { x: handAt.x, y: handAt.y, flip: false });
  }
  for (const f of draws?.front ?? []) drawSceneFrame(ctx, art!, f, lit.has(f), nudged.get(f));
  // 머리 위 칸(형식 기록 16절, #901): 그 캐릭터 얼굴 상자 위 가운데 기준, 왼쪽을 보면 뒤집는다. 사람·front 위.
  // 같은 자리를 말풍선 keep 상자로도 쓴다(#947).
  const heads = draws ? headPlaces(art!.meta, draws.heads, (id) => headAnchor(data, scene, id)) : [];
  for (const h of heads) drawHeadFrame(ctx, art!, h.frame, h.at);
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
  // 화면 전환 덮개(11-1절): 0번 ink로 HUD까지 덮는다. ORDER가 없으면 늘 0이다. 타이틀 뒤 밝아짐(2-4절)도 같은 덮개다.
  const fv = flowView(flow, false);
  const cover = Math.max(fv.cover, entryFadeCover(entryLeft));
  if (cover > 0) {
    ctx.globalAlpha = Math.min(1, cover);
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
  const armed = restartArmed(restart, playNow());
  const restartText = armed ? t('ui.restart_confirm') : restartHover ? t('ui.restart_hover') : null;
  // 터치 첫 탭 라벨에는 그 판 내내 "한 번 더 탭" 줄을 붙인다(#661 → #680). 호버 라벨(마우스)에는 안 붙는다.
  const shownText = shown ? labelText(shown, data.screen.id, t) : null;
  const targetText = shownText !== null && shown === touchLabel ? selectLabelText(shownText, t('ui.touch.tap_again')) : shownText;
  const labelString = restartText ?? note ?? targetText ?? hudHover ?? '';
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
  const covered = cover > 0;
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
  // 클리어 컷(L32)과 화면 하나 클리어 카드는 캐릭터 머리 위로(#662). 열쇠를 든 사람이 보여야 왜 클리어인지 안다.
  // 게이지 0 컷(`ui.faint`)과 연결 순서(ORDER)의 카드는 캐릭터를 피하지 않고 게임 화면 가운데다(#683, 설계 6-6절).
  // CSS 기본(창 가운데)은 667×375에서 캔버스가 위로 치우쳐 26 CSS px 아래로 떴다.
  // 단 연결 순서 카드도 머리 위 칸(형식 16절, 빨래방 둥지 모자·까치)은 피한다(#975). 클리어 뒤 남는 펀치라인 그림이라(#974),
  // 압축 배율(640×300 @2)에서 글자 최소 20px로 커진 상자가 그 칸을 덮었다. 머리 위 칸이 없는 판(화면 1·2)은 그대로 가운데다.
  const cast = Object.values(layout.chars);
  const headBoxes = heads.map((h) => ({ left: h.at.x, top: h.at.y, width: h.at.w, height: h.at.h }));
  placeCut(faintCut, cut === 'ui.faint' ? [] : cast, scale);
  placeCut(clearCut, ORDER ? headBoxes : cast, scale);

  // DOM 말풍선(ADR-0004 결정 3). 화자 머리 위. 카드가 떠 있으면 진입 대사는 아직이다.
  // 폭은 글로만 정하고(화자 위치와 무관), 게임 화면 안으로 민다(#329). 목표 줄·이름표를 피하므로(#351) 그것들을 놓은 뒤에 둔다.
  const b = startCard.open || covered ? null : currentBubble(scene);
  bubble.hidden = !b;
  if (b) {
    // 재생 도구(#356 C-7 가림 검사)가 화자 자신의 핫스팟을 빼려고 읽는다.
    if (bubble.dataset.speaker !== b.speaker) bubble.dataset.speaker = b.speaker;
    // 핫스팟 화자가 지금 anim 칸(재생 중·붙든 hold)을 그리면 그 칸에 붙인다(#450). 캐릭터 ID는 물건 `ids`에 없어서(ADR-0065 예약어) null이다.
    const frameBox = art && artView ? animFrameBox(art.meta, artView, b.speaker) : null;
    // 비켜 서는 화자(#862)는 도착점 몸으로 자리를 한 번 정한다(#866). 걷는 동안 프레임마다 다시 고르면 휴대폰에서 튄다.
    const stepBox = stepOffBubbleBox(data, scene);
    const at = stepBox ? { ...layout, chars: { ...layout.chars, [b.speaker]: stepBox } } : layout;
    // 화자 얼굴(#967·#970)은 말풍선이 가장 나중에 덮는다. 물건 화자는 얼굴이 없다.
    const face = !frameBox && b.speaker in layout.chars ? speakerFaceBox(data, scene, b.speaker as CharacterId) : null;
    placeBubbleDom(sayText(TEXT, b.text, b.speaker), speakerBox(b.speaker, at, frameBox), bubbleKeepBoxes(b.speaker, layout, heads), bubbleBodyBoxes(b.speaker, layout), face);
  }
}

/** 컷 상자를 `cutCenter(size, cast)` 자리에 둔다. `cast`가 비면 게임 화면 가운데다. 숨으면 인라인 자리를 지운다. */
function placeCut(el: HTMLElement, cast: readonly HitBox[], scale: number): void {
  if (el.hidden) {
    el.style.left = el.style.top = '';
    return;
  }
  // offset 크기는 transform(translate -50%) 전 CSS px다. 글·글자 크기를 넣은 뒤에 잰다.
  const size = { width: el.offsetWidth / scale, height: el.offsetHeight / scale };
  placeDom(el, cutCenter(size, cast));
}

/**
 * 클리어 카드 `#clear`. ORDER가 없으면 클리어 컷이 끝난 뒤 `soloCardKey`(#597): 화면 1은 지금 배포본 그대로 `ui.clear`,
 * `?screen=<id>`로 연 다른 화면은 `<id>.clear_card` 또는 끝 카드 `ui.end`.
 * ORDER가 있으면 결과 줄 `<id>.clear_card` + 0.6초 뒤 `ui.next`(11-2절), 마지막 화면은 결과 줄 + 끝 카드 `ui.end`(11-5절, #935).
 * 다음 화면 그림을 0.5초 넘게 기다리면 같은 자리에 `…`(11-1절). 재생 도구는 `data-next`를 보고 카드를 누른다(11-6절 5번).
 */
function placeClearCut(fv: ReturnType<typeof flowView>, scene: SceneState): void {
  let text: string | null;
  if (!ORDER) text = scene.cleared && !isBusy(scene) ? t(soloCardKey(session.data.screen.id, (k) => k in TEXT)) : null;
  else if (fv.dots) text = '…';
  else if (fv.card && flow.phase === 'card') {
    const lines = cardLines(session.data.screen.id, flow.last, (k) => k in TEXT, flow.toMap === true);
    const next = fv.next && lines.next ? t(cardPointer(window.matchMedia?.bind(window)) === 'mouse' ? `${lines.next}_click` : lines.next) : null;
    text = [...lines.body.map((k) => t(k)), next].filter(Boolean).join('\n') || null;
  } else text = null;
  clearCut.hidden = text === null;
  clearCut.toggleAttribute('data-next', fv.next);
  if (text !== null && clearCut.textContent !== text) clearCut.textContent = text;
}

/**
 * 카드 글자 = 내부 8px × 화면 배율, 최소 13 CSS px. 폭은 캔버스의 80%, 높이는 85% 이하(6-2-1절).
 * 배율 1.2 미만(640×300 @2 등, #714)은 압축 카드(#335): 폭 90%, 얼굴 작게, 줄 간격 1.25(CSS `#card[data-tight]`).
 * 13px 글자가 1.0배에서 내부 13px이라 80% 폭에 게이지 줄이 한 줄로 안 들어가고, 높이도 상한을 넘었다.
 */
const CARD_PX = 8;
const CARD_MIN_CSS = 13;
function renderCard(): void {
  // 타이틀 뒤 밝아지는 동안은 카드를 아직 안 띄운다(2-4절: 밝아짐 → 시작 카드).
  cardEl.hidden = !startCard.open || entryLeft > 0;
  if (cardEl.hidden) return;
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
    if (!loaded || menuOpen) return;
    // 안내가 떠 있으면 판 시간을 멈춘다. 뜨는 순간 카드가 떠 있으면 잠금 1초를 처음부터 다시 센다(9-5절: 안내가 사라진 뒤부터).
    if (setPaused(pause, rotating(), performance.now()) && pause.since !== null && startCard.open) startCard.ticks = 0;
    if (pause.since !== null) return;
    // 타이틀 뒤 밝아짐(2-4절). 이 동안 판은 멈추고 카드 잠금도 안 센다. 카드가 떠 있어 캔버스·카드 입력은 원래 막혀 있다.
    if (entryLeft > 0) {
      entryLeft--;
      return;
    }
    cardTick(startCard);
    if (startCard.open) return;
    // 어두워지는 동안까지는 지난 판이 움직이고, 다 검어진 뒤(기다림·밝아짐)는 멈춘다. 새 판 진입 연출은 밝아진 뒤에 시작한다(11-1절).
    if (flow.phase === 'play' || flow.phase === 'card' || flow.phase === 'fadeOut') sceneTick(session.data, session.scene);
    if (session.scene.cleared) seenClears.add(session.data.screen.id);
    pollWalkStart();
    noteWalkDone(notes, (c) => charWalking(session.scene, c));
    const busy = isBusy(session.scene);
    if (wasBusy && !busy && flow.phase === 'play' && !session.scene.cleared) onSettled();
    wasBusy = busy;
    // 말풍선 잠금 전에 맡아 둔 마우스 클릭(예외 넷 3, #601 6회차): 잠금이 풀리는 틱에 같은 점을 다시 누른다.
    if (flow.phase === 'play') {
      const held = takeHeldTap(session.data, session.scene);
      if (held) worldTap(held, 0);
    }
    stepFlow();
  },
  render,
});
