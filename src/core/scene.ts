// 화면 하나의 진행: 탭 → `step` → 이벤트 재생(busy) (docs/design/ui-interaction.md 5절, ADR-0065 6절).
// 순수 로직이다. DOM·Canvas를 모른다. 엔진(main.ts)은 sceneTap/sceneTick을 부르고 결과를 그리기만 한다.
// 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다(ADR-0004 결정 2). 화면 데이터는 상태에 넣지 않고 인자로 받는다.
//
// 엔진은 `step`이 돌려준 이벤트로만 반응한다(ADR-0065 5절). 퍼즐 상태를 들여다보고 연출을 추측하지 않는다.
// 예외: 바닥(`free`) 자리 캐릭터의 좌표는 퍼즐 상태에 없어서 엔진 걷기(walker)가 들고 있다.

import { CHARACTERS, characterHitBox, characterDef, type CharacterId } from './characters';
import { TICK_MS, WALK_AREA, WALK_SPEED } from './config';
import { hitTest, type HitBox } from './hit';
import { inHudZone } from './hud';
import { hotspotBox, hudTargets, tap, type Intent, type TapContext, type UiState } from './interact';
import { animOf, animTicks, type SceneAnim, type SceneArtMeta } from './sceneArt';
import { FX_TICKS, fxTicks } from './fx';
import { sayText, seenSayKey } from './sayText';
import { cueMs, spriteFacing, spriteFrame, spriteHit, type Pose, type SpriteMeta } from './sprite';
import { approachFor, initialState, step } from './puzzle/step';
import { GAUGE_MAX, type Action, type CharactersData, type PuzzleEvent, type PuzzleState, type ScreenData, type StepSource, type Verb } from './puzzle/types';
import type { Point } from './viewport';
import { clampToArea, createWalker, stepWalker, walkTo, type Facing, type Walker } from './walk';

/** 연출 시간(틱, 60Hz). 임시값이다. 실제 애니메이션 프레임 수가 나오면 그 길이로 바꾼다(ADR-0007). */
export const TIMING = {
  anim: 30,
  /** 시그니처가 아닌 fx 길이. 시그니처 글자는 `fx.ts` `SIGNATURE_TICKS`(0.6초). */
  fx: FX_TICKS,
  gauge: 20,
  item: 20,
  place: 12,
  release: 18,
  faint: 60,
  /** 게이지 0 컷 글(`ui.faint`)이 떠 있는 시간. `faint`(busy)보다 길고, 남는 동안은 입력을 막지 않는다(#129 Luna 제안 2). */
  faintCut: 90,
  /** 클리어 컷 글(L32, 화면 `clearLine`)이 떠 있는 시간. 끝나면 클리어 카드. `magpie_nest.md` 8절 "3초 안쪽"에서 카드 몫을 뺀 값. */
  clearCut: 120,
  /**
   * 말풍선: 기본 + 화면 글 글자당(#304 3번). 상한을 둔다.
   * 글자 수는 화면에 뜨는 글(`sayText`)에서 줄바꿈 자리(U+200B·`\n`)를 뺀 수다. 예전에는 글 ID 길이를 셌다.
   * 글자당 8틱 = 초당 7.5자. 한 줄 7~9자 두 줄(14~18자)이 2.9~3.4초다.
   * 상한 288틱(4.8초)은 말풍선 최대 28자(`ja-text.md` 2절, 14자 × 2줄 = 60 + 8×28 = 284틱)가 안 잘리는 값이다.
   * 규칙 안의 대사는 상한에 걸리지 않고, 상한은 ID 폴백이나 실수로 들어간 긴 글만 막는다(PR #377 Luna 리뷰).
   */
  sayBase: 60,
  sayPerChar: 8,
  sayMax: 288,
  /**
   * 말풍선이 뜬 뒤 이만큼 지나야 탭으로 넘길 수 있다(1.0초, #284 Luna 결정 11/18 `#goblin-dev`).
   * 일본어 한 줄(14자 이하)을 겨우 읽는 시간. 예전 0.4초는 판정 2 2차에서 "대사가 잠깐만 뜬다"로 읽혔다.
   * `sayBase`(60)보다 크면 짧은 대사를 아예 못 넘기게 되니 `sayBase` 이하로 둔다.
   */
  saySkipAfter: 60,
  /**
   * 이미 본 말풍선(같은 판에서 같은 글 ID를 끝까지 띄운 적 있음)은 0.4초 뒤 넘길 수 있다(`ability-feedback.md` 6절, #289).
   * 두 번째 보는 실패 대사를 기다리지 않게 한다(`ui-interaction.md` 5절). 값은 `clearSkipAfter`와 같지만 뜻이 달라 따로 둔다.
   */
  seenSaySkipAfter: 24,
  /** 클리어 컷 글이 뜬 뒤 이만큼 지나야 탭으로 넘길 수 있다(0.4초, `magpie_nest.md` 8절·`ui-interaction.md` 11-1절, #266). 말풍선과 따로 둔다. */
  clearSkipAfter: 24,
  /** 자동 걷기 속도. 엔진 걷기와 같다. */
  walkSpeed: WALK_SPEED,
} as const;

/**
 * 시소 끝 깡충(`magpie_nest.md` 1-5-3절, #397). 웅크림·공중 ms는 시트 `step_up`의 `ms`가 있으면 그것을 쓰고,
 * 없으면(실루엣·테스트) 아래 표를 쓴다. 착지는 웅크림 칸을 `landMs` 동안 다시 쓴다(셋 같음, 엔진 상수).
 * 내려서기는 웅크림 없이 공중 → 착지이고 셋이 같다. `h`는 솟는 높이(px): y = 직선 − h·4u(1−u).
 * h는 8 이상이어야 착지 직전 발이 판 윗면 위에서 내려온다(직선 기울기 26px / 4 = 6.5 초과, 1-5-3절).
 */
export const HOP = {
  up: {
    jjuk: { crouchMs: 100, airMs: 150, h: 10 },
    ppik: { crouchMs: 50, airMs: 150, h: 12 },
    mukjik: { crouchMs: 150, airMs: 150, h: 8 },
  } satisfies Record<CharacterId, { crouchMs: number; airMs: number; h: number }>,
  down: { airMs: 100, h: 8 },
  landMs: 50,
} as const;

/** 진행 중인 깡충 하나(틱 단위). 시작 틱이 t=0이고 `crouch + air + land` 틱에 `to`에 선다. */
export interface Hop {
  from: Point;
  to: Point;
  t: number;
  crouch: number;
  air: number;
  land: number;
  h: number;
}

/** `walk` 이벤트 하나를 이루는 구간(#397). 보통은 걷기 하나이고, 시소 끝에 오르내리면 걷기와 깡충 둘이다. */
export type WalkLeg = { kind: 'walk'; to: Point } | { kind: 'hop'; to: Point; up: boolean };

/**
 * 재생 중인 이벤트. `say`는 고른 문구 ID 하나로 바꿔 둔다(배열 변형은 발동 횟수로 고른다).
 * `walk.face`는 엔진이 넣은 "대상 앞까지 걷기"(설계 5-1절)에만 있다: 도착하면 그 방향(대상 쪽)을 본다.
 */
export type PlayEvent =
  | Exclude<PuzzleEvent, { type: 'say' } | { type: 'walk' }>
  | (Extract<PuzzleEvent, { type: 'walk' }> & { face?: Facing })
  | { type: 'say'; speaker: string; text: string };

export interface Playing {
  ev: PlayEvent;
  /** 시작한 뒤 지난 틱. */
  t: number;
  /** 이 이벤트가 끝나는 틱 수. 걷기는 도착할 때 끝나서 null. */
  duration: number | null;
  /** 몇 번째로 시작한 이벤트인가(0부터). 멈춘 모습이 바뀌는 시점(`shown`)을 맞추는 데 쓴다. */
  seq: number;
  /** 화면 시트에 있는 물건 anim이면 그 물건과 고른 갈래(형식 기록 4-1절). 엔진은 이걸 그린다. */
  art?: { object: string; anim: SceneAnim };
  /** 이 이벤트가 도는 동안 화면 가운데 띄울 컷 글 ID(클리어 컷 L32). */
  cut?: string;
  /**
   * 캐릭터 연출의 남은 칸 신호 시각(틱, 오름차순, 형식 기록 5-2절, #199·#284). 시각마다 대기열 맨 앞의 `fx` 하나를 `overlays`로 띄우고 지운다.
   * 맨 앞이 fx가 아니면(이어진 fx가 신호보다 적음) 그 신호는 아무것도 띄우지 않는다(`ability-feedback.md` 4절).
   */
  cues?: number[];
  /** `walk`의 남은 구간(#397). 앞 구간(걷기·깡충)이 끝나면 다음을 시작한다. 비면 도착이다. */
  legs?: WalkLeg[];
  /** `walk`가 끝날 때 설 점. 탭 건너뛰기가 여기로 바로 옮긴다(깡충까지 건너뜀, 1-5-2절). */
  end?: Point;
}

/**
 * 물건의 "보이는 플래그"가 진짜 플래그보다 늦게 바뀌는 동안의 기록(형식 기록 4-2절).
 * `seq`번째 이벤트가 시작(`start`)하거나 끝날(`end`) 때 지운다 → 그때부터 진짜 플래그로 그린다.
 */
export interface ShownFlags {
  flags: Record<string, boolean>;
  seq: number;
  edge: 'start' | 'end';
}

export interface SceneState {
  tick: number;
  puzzle: PuzzleState;
  ui: UiState;
  walkers: Record<CharacterId, Walker>;
  /** 아직 시작하지 않은 이벤트. */
  queue: PlayEvent[];
  current: Playing | null;
  /**
   * 칸 신호로 연출과 겹쳐 뜬 `fx`(#199). `current`와 따로 시간이 간다. 남아 있는 동안 busy다.
   * 신호 없는 시트·실루엣에서는 늘 비어 있다(fx는 지금처럼 연출이 끝난 뒤 `current`로 돈다).
   */
  overlays: Playing[];
  /**
   * 화면에 보이는 게이지. `gauge` 이벤트가 올 때 바뀐다(퍼즐 상태는 이미 확정이라 연출보다 앞선다).
   * `faint`는 "자리 리셋 + 게이지 가득"이다(ADR-0065 5절 6). `step`은 `faint` 뒤에 `gauge` 이벤트를 따로 내지 않으므로
   * `faint`가 끝날 때 가득으로 채운다. 컷 동안은 0을 보여 줘서 "0 → 리셋 → 다시 참" 순서가 보이게 한다(ADR-0018 G2, #129).
   */
  shownGauge: number;
  /** 게이지 0 컷 글이 이 틱 전까지 떠 있다. 0이면 없음. */
  faintCutUntil: number;
  /** 규칙·폴백별 발동 횟수(대사 변형 선택), 대상별 폴백 횟수(힌트 ②). UI 상태라 세이브·BFS에 넣지 않는다(ADR-0065 5절). */
  counts: Record<string, number>;
  /** 지금까지 시작한 이벤트 수. 다음에 시작할 이벤트의 `seq`다. */
  started: number;
  /** 물건 키 → 아직 옛 플래그로 그리는 물건(4-2절). 없으면 진짜 플래그로 그린다. 그림 전용이고 판정·히트 박스는 안 쓴다. */
  shown: Record<string, ShownFlags>;
  /** `move floor` 행동에서 걸어갈 바닥 점. 캐릭터별. */
  floorTo: Partial<Record<CharacterId, Point>>;
  /**
   * 화면에 보이는 자리(재생이 끝난 이벤트 기준). `s.puzzle.at`은 `step` 때 이미 바뀌어서, 기절 연출이 시작될 때
   * "기절 전에 어디 있었나"를 알려면 장면이 따로 들어야 한다(#215). `walk`·`release`·`place`·`faint`가 시작될 때 바뀐다.
   */
  spotOf: Record<CharacterId, string>;
  /**
   * 캐릭터가 순간 배치(손 놓기·`place`·기절)된 이벤트 순번. 발 y가 같으면 나중에 떨어진 사람이 앞에 그려지고
   * 클릭도 받는다(형식 기록 10절 2단계, 바구니 포개짐). 없으면 -1로 본다.
   */
  landed: Partial<Record<CharacterId, number>>;
  /**
   * 끝난 한 번 재생 캐릭터 연출(형식 기록 5절 "마지막 장 유지", #189). 그 캐릭터의 다음 `walk`·`release`·`place`·`anim`,
   * 기절, 또는 대기열이 빌 때까지 마지막 장으로 그린다. `ms`는 끝난 시점(연출 길이). 그림 전용이다.
   */
  held: Partial<Record<CharacterId, { name: string; ms: number }>>;
  /** 캐릭터가 마지막으로 한 행동의 대상 점(핫스팟 `reachPoint`, 없으면 대상 상자 아래 끝 가운데, #284). 장대 잇기(5-1절)가 쓴다. 상자도 없으면 키가 없다. */
  reach: Partial<Record<CharacterId, Point>>;
  /**
   * 끝까지 띄운 말풍선(#284, `ability-feedback.md` 6절). 키는 `seenSayKey(화자, 글 ID)`(#304: 화자별 변형 글은 따로 센다).
   * 여기 있으면 `seenSaySkipAfter` 뒤에 넘길 수 있다.
   * 넘기기는 `saySkipAfter` 뒤에만 되니 "끝까지 띄움 = 적어도 1.0초 보임"이다. UI 상태라 세이브하지 않고, 게이지 0 리셋에서도 지우지 않는다.
   */
  seenSay: Record<string, true>;
  /** 시소 끝에 오르내리는 중인 깡충(#397). 그림·판정은 걷기(walker) 좌표를 그대로 쓰고, 자세만 `step_up`으로 바뀐다. */
  hops: Partial<Record<CharacterId, Hop>>;
  cleared: boolean;
}

export interface SceneData {
  screen: ScreenData;
  characters?: CharactersData;
  /** 화면 배경·물건 그림 메타(#157). 있으면 물건 anim 길이가 busy 길이가 되고, 보이는 플래그를 따로 센다. */
  art?: SceneArtMeta;
  /**
   * 캐릭터 ID → 시트 메타(#140). 있으면 캐릭터 연출(`anim` 대상이 캐릭터)도 시트 `ms` 합이 busy 길이다(#182 질문 3).
   * 엔진은 `public/sprites/*-base.json`을 그대로 넣는다(engine/sprites.ts `spriteMetas`). 없으면 `TIMING.anim`.
   */
  sprites?: Readonly<Record<string, SpriteMeta>>;
  /**
   * 클리어 컷 글 ID(L32, `magpie_nest.md` 8절). 있으면 `clear` 이벤트가 이 글을 `TIMING.clearCut` 동안 띄우고(busy), 그 뒤 클리어 카드.
   * 화면 문법에 클리어 연출 필드가 없어서(설계 14절) 엔진이 `<화면 ID>.clear` 텍스트가 있을 때 채운다.
   */
  clearLine?: string;
  /**
   * 글 ID → 화면 글(`content/text/ja.json`). 있으면 말풍선 길이를 화면 글 글자 수로 잰다(#304 3번).
   * 코어는 글을 그리지 않고 길이만 본다. 없으면 글 ID 길이로 잰다(옛 동작, 테스트용).
   */
  texts?: Readonly<Record<string, string>>;
}

/** busy = 재생할 이벤트가 하나라도 남아 있다(설계 5절). */
export function isBusy(s: SceneState): boolean {
  return s.current !== null || s.queue.length > 0 || s.overlays.length > 0;
}

/**
 * ▼ 조작 표시를 그릴지(#46). 행동 중·클리어 뒤에는 숨긴다.
 * 말풍선(`currentBubble`)은 `current`가 있을 때만 뜨니 busy이고, 그래서 ▼와 같은 순간에 나오지 않는다.
 */
export function activeMarkerVisible(s: SceneState): boolean {
  return !isBusy(s) && !s.cleared;
}

function spotPoint(data: SceneData, spotId: string): Point {
  const spot = data.screen.spots[spotId];
  if (!spot) throw new Error(`알 수 없는 자리: ${spotId}`);
  return { x: spot.x, y: spot.y };
}

const isFree = (data: SceneData, spotId: string): boolean => data.screen.spots[spotId]?.free === true;

/** 처음 배치. 바닥 자리에 선 캐릭터는 자리 좌표를 중심으로 40px씩 벌려 세운다. */
export function createScene(data: SceneData): SceneState {
  const puzzle = initialState(data.screen);
  const walkers = {} as Record<CharacterId, Walker>;
  CHARACTERS.forEach((c, i) => {
    const spotId = puzzle.at[c.id];
    const p = spotPoint(data, spotId);
    const at = isFree(data, spotId) ? clampToArea({ x: p.x + (i - 1) * 40, y: p.y }, WALK_AREA) : p;
    walkers[c.id] = createWalker(c.id, at);
  });
  const s: SceneState = {
    tick: 0,
    puzzle,
    ui: { active: CHARACTERS[0]!.id, selected: null },
    walkers,
    queue: [],
    current: null,
    overlays: [],
    shownGauge: puzzle.gauge,
    faintCutUntil: 0,
    started: 0,
    shown: {},
    counts: {},
    floorTo: {},
    spotOf: { ...puzzle.at },
    landed: {},
    held: {},
    reach: {},
    seenSay: {},
    hops: {},
    cleared: false,
  };
  // onEnter는 상태를 바꾸지 않는 연출이다(ADR-0065 5절). say 화자는 캐릭터 ID만 온다.
  for (const item of data.screen.onEnter ?? []) {
    if ('anim' in item) s.queue.push({ type: 'anim', target: item.anim[0], name: item.anim[1] });
    else if ('fx' in item) s.queue.push({ type: 'fx', effect: item.fx[0], target: item.fx[1] });
    else s.queue.push({ type: 'say', speaker: item.say[0], text: pickText(item.say[1], 1) });
  }
  return s;
}

/**
 * 그리는 방향. engine/sprites.ts `drawSprite`와 같은 규칙이다: 시트에 지금 자세가 있으면 `spriteFacing`
 * (매달린 동안 `hold.facing`, 연출 자세의 `facing`), 없으면 실루엣이라 걷는 방향(#186).
 * 시트 이미지가 아직 로드 중인 몇 프레임은 실루엣이 걷는 방향으로 그려져 어긋날 수 있다(core는 로드 상태를 모른다).
 */
export function charFacing(data: SceneData, s: SceneState, id: CharacterId): Facing {
  const w = s.walkers[id];
  const meta = data.sprites?.[id];
  if (!meta) return w.facing;
  const pose = charPose(data, s, id);
  return spriteFrame(meta, pose) === null ? w.facing : spriteFacing(meta, pose, w.facing);
}

/**
 * 판정용 캐릭터 몸 박스. 엔진이 그리는 위치·방향 그대로다(`charFacing`, #186).
 * 지금 자세에 시트 `hit`이 있으면(매달린 자세, #203) 그 상자, 없으면 서 있기 기준 `characterHitBox`.
 */
export function bodies(data: SceneData, s: SceneState): Record<CharacterId, HitBox> {
  const out = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const w = s.walkers[c.id];
    const facing = charFacing(data, s, c.id);
    const meta = data.sprites?.[c.id];
    const own = meta ? spriteHit(meta, charPose(data, s, c.id), w.x, w.y, facing) : null;
    out[c.id] = own ?? characterHitBox(characterDef(c.id), w.x, w.y, facing);
  }
  return out;
}

/**
 * 캐릭터 그리는 순서(뒤 → 앞). 엔진 그리기와 클릭 판정(`TapContext.order`)이 같이 쓴다(형식 기록 6절 2·3).
 * 1. `hold` 자리(고리)에 매달린 캐릭터(`isHanging`)는 맨 앞 2. 발 y가 작을수록 뒤 3. 같으면 나중에 떨어진 사람이 앞
 * 4. 그래도 같으면 CHARACTERS 순서의 앞쪽(쭉이)이 앞(예전 엔진 순서 그대로).
 */
export function drawOrder(data: SceneData, s: SceneState): CharacterId[] {
  const y = (c: CharacterId): number => (isHanging(data, s, c) ? Infinity : Math.round(s.walkers[c].y));
  const rank = (c: CharacterId): number => CHARACTERS.findIndex((d) => d.id === c);
  return CHARACTERS.map((c) => c.id).sort((a, b) => {
    const ya = y(a);
    const yb = y(b);
    if (ya !== yb) return ya - yb;
    const la = s.landed[a] ?? -1;
    const lb = s.landed[b] ?? -1;
    if (la !== lb) return la - lb;
    return rank(b) - rank(a);
  });
}

export function tapContext(data: SceneData, s: SceneState): TapContext {
  return { screen: data.screen, puzzle: s.puzzle, bodies: bodies(data, s), order: drawOrder(data, s) };
}

function pickText(text: string | string[], count: number): string {
  if (!Array.isArray(text)) return text;
  return text[Math.min(count, text.length) - 1] ?? '';
}

/** 대사 변형 키: 규칙은 규칙 ID, 폴백은 출처·대상·동사·캐릭터. */
function variantKey(source: StepSource, ruleId: string | undefined, a: Action): string {
  return source === 'rule' ? `rule:${ruleId}` : `${source}:${a.target}:${a.verb}:${a.char}`;
}

function bump(s: SceneState, key: string): number {
  const n = (s.counts[key] ?? 0) + 1;
  s.counts[key] = n;
  return n;
}

/**
 * 힌트 ②(ADR-0018 F3, 화면 1 설계 5절): 같은 대상에서 핫스팟 폴백 2번째에 한 번.
 * 대상의 `hintAbility`가 행동한 캐릭터 자기 능력이면 그 폴백은 **세지도 않는다**.
 * 먼저 세면 자기 능력 캐릭터가 2번째를 써 버려 그 대상의 힌트가 다시는 안 뜬다(#122 리뷰).
 */
function hintEvent(data: SceneData, s: SceneState, source: StepSource, a: Action): PlayEvent | null {
  // みる는 대상별 폴백(①)이어도 세지 않는다(#286). 조사만 반복해도 힌트가 앞당겨지지 않게 한다(ADR-0065 5절 취지).
  if (source !== 'hotspotFallback' || a.verb === 'look') return null;
  const ability = data.screen.hotspots[a.target]?.hintAbility ?? data.screen.spots[a.target]?.hintAbility;
  if (!ability || ability === characterDef(a.char).ability) return null;
  if (bump(s, `hint:${a.target}`) !== 2) return null;
  const text = data.characters?.hints?.[a.char]?.[ability];
  return text ? { type: 'say', speaker: a.char, text } : null;
}

/**
 * 형식 기록 4-2절: `step`은 이벤트 재생 전에 플래그를 바꾸지만, 그림은 그 행동의 이전 플래그로 그리다가
 * (a) 그 물건(`ids` 포함)의 anim이 시작될 때, (b) 없으면 첫 anim이 끝날 때 바꾼다. anim이 하나도 없으면 바로 바꾼다.
 * 시트에 그 anim이 있는지는 보지 않는다(그림이 붙는 순서와 상관없이 시점이 같다).
 */
function deferShown(data: SceneData, s: SceneState, before: Record<string, boolean>, events: readonly PuzzleEvent[]): void {
  const art = data.art;
  if (!art) return;
  const after = s.puzzle.flags;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  if ([...keys].every((k) => (before[k] ?? false) === (after[k] ?? false))) return;
  // 지금 재생 중인 이벤트는 이미 `started`에 들어 있다. 새 이벤트는 대기열 뒤에 붙는다.
  const base = s.started + s.queue.length;
  const firstAnim = events.findIndex((e) => e.type === 'anim');
  if (firstAnim < 0) return;
  for (const o of art.objects) {
    const own = events.findIndex((e) => e.type === 'anim' && o.ids.includes(e.target));
    s.shown[o.key] = own >= 0 ? { flags: { ...before }, seq: base + own, edge: 'start' } : { flags: { ...before }, seq: base + firstAnim, edge: 'end' };
  }
}

/** 물건 하나의 보이는 플래그(4-2절). 그림 전용. */
export function shownFlags(s: SceneState, objectKey: string): Readonly<Record<string, boolean>> {
  return s.shown[objectKey]?.flags ?? s.puzzle.flags;
}

function commitShown(s: SceneState, seq: number, edge: 'start' | 'end'): void {
  for (const [k, v] of Object.entries(s.shown)) if (v.seq === seq && v.edge === edge) delete s.shown[k];
}

/** 설계 5-1절: 바닥에서 대상 앞까지 걸어가는 동사. `move`는 `step`이 `walk`를 내서 뺀다. */
const APPROACH_VERBS: ReadonlySet<Verb> = new Set<Verb>(['stretch', 'stomp', 'hand', 'item']);
/** 원거리 동사(5-1절): 걷지 않고 대상 쪽으로 돌아서기만 한다(#219 Theo 코멘트). */
const TURN_VERBS: ReadonlySet<Verb> = new Set<Verb>(['squeak', 'look']);
/** 이만큼 가까우면 이미 설 곳이다(걷지 않음). 대상 가운데가 이만큼 가까우면 방향을 정하지 않는다(5-1절 ±2px). */
const APPROACH_SLOP = 2;
/** 바닥 대상 옆에 설 때 몸 상자와 대상 상자 사이 가로 틈(5-1절). */
const APPROACH_GAP = 2;

/** 행동 대상의 상자: 핫스팟(지금 `variants` 반영) 또는 상자 있는 서는 자리. 캐릭터·상자 없는 대상은 null. */
function targetBox(screen: ScreenData, puzzle: PuzzleState, id: string): HitBox | null {
  const hs = hotspotBox(screen, puzzle, id);
  if (hs) return hs;
  const b = screen.spots[id]?.box;
  return b ? { left: b[0], top: b[1], width: b[2], height: b[3] } : null;
}

/**
 * 설계 5-1절 "대상 앞까지 걷기"의 설 곳(발밑 x)과 도착 뒤 볼 방향. `puzzle`은 행동 **전** 상태다.
 * 바닥이 아니거나 `move`이거나 상자 없는 대상(캐릭터)이면 null.
 * 원거리 동사(`squeak`·`look`)와 대상 `approach`가 `stay`인 동사는 걷지 않는다(x = 지금 x) — 대상 쪽으로 돌아서기만 한다.
 * `face`가 null이면 대상 가운데가 설 곳과 ±2px 안이라 방향을 바꾸지 않는다.
 * - `stretch`: 높은 대상이면 `reachPoint` x, 없으면 상자 가운데 x. 바닥 대상이면 아래 줄과 같다(땅의 까치에 겹쳐 서지 않게, PR #221 Luna).
 * - `stomp`·`hand`·`item`: 높은 대상(상자 아래쪽이 `WALK_AREA.top` 위)은 상자 가운데 x, 바닥 대상은 가까운 쪽 가장자리 옆
 *   (대상을 바라본 몸 상자 `characterHitBox`가 대상 상자와 가로로 2px 떨어지는 가장 가까운 x).
 * 설 곳은 걷기 영역 안으로 자른다. `step`·BFS와 무관한 연출 계산이다(퍼즐 상태를 바꾸지 않는다).
 */
export function approachPoint(data: SceneData, puzzle: PuzzleState, action: Action, from: Point): { x: number; face: Facing | null } | null {
  const walks = APPROACH_VERBS.has(action.verb);
  if ((!walks && !TURN_VERBS.has(action.verb)) || !isFree(data, puzzle.at[action.char] ?? '')) return null;
  const box = targetBox(data.screen, puzzle, action.target);
  if (!box) return null;
  const mid = box.left + box.width / 2;
  let x: number;
  const rp = data.screen.hotspots[action.target]?.reachPoint;
  if (!walks || approachFor(data.screen, puzzle, action.target, action.verb) === 'stay') x = from.x;
  else if (action.verb === 'stretch' && rp) x = rp[0];
  else if (box.top + box.height <= WALK_AREA.top) x = mid;
  else {
    const { dx, width } = characterDef(action.char).hit;
    // 오른쪽에서 오면 왼쪽을 본다: 몸 왼쪽 = x - (dx + width). 왼쪽에서 오면 오른쪽을 본다: 몸 오른쪽 = x + dx + width.
    x = from.x >= mid ? box.left + box.width + APPROACH_GAP + dx + width : box.left - APPROACH_GAP - dx - width;
  }
  x = clampToArea({ x, y: from.y }, WALK_AREA).x;
  const face: Facing | null = Math.abs(mid - x) <= APPROACH_SLOP ? null : mid > x ? 1 : -1;
  return { x, face };
}

/**
 * 게이지 감소 시점(설계 6-2-5절, #285): 줄어드는 `gauge`를 그 규칙의 첫 `say` 바로 앞으로 당긴다.
 * "쿵 → 납작 → 별 → 칸 터짐 + 게이지 흔들림 → 말풍선" 순서가 돼서 "아프다 = 게이지"가 이어진다.
 * 코어 `step`의 순서(show 다음 do, ADR-0065 5절)는 BFS·테스트 계약이라 그대로 두고 장면 대기열만 바꾼다.
 * 그대로 두는 경우: 늘어나는 게이지, `say`가 게이지보다 앞에 없음, `faint`가 같이 옴(기절 연출은 따로 있다).
 */
export function gaugeBeforeSay(events: readonly PuzzleEvent[]): readonly PuzzleEvent[] {
  if (events.some((e) => e.type === 'faint')) return events;
  const g = events.findIndex((e) => e.type === 'gauge' && e.delta < 0);
  const say = events.findIndex((e) => e.type === 'say');
  if (g < 0 || say < 0 || say > g) return events;
  const out = events.filter((_, i) => i !== g);
  out.splice(say, 0, events[g]!);
  return out;
}

export function runAction(data: SceneData, s: SceneState, action: Action, to: Point | null): void {
  const before = s.puzzle.flags;
  const prev = s.puzzle;
  const r = step(data.screen, s.puzzle, action, data.characters);
  s.puzzle = r.state;
  const events = gaugeBeforeSay(r.events);
  // 행동하는 캐릭터의 엔진 걷기는 멈춘다. 바닥에 섰으면 대상 앞까지 걸어간 뒤 행동한다(설계 5-1절).
  const w = s.walkers[action.char];
  w.target = null;
  w.walkTicks = 0;
  const first = events[0];
  const ap = first?.type === 'walk' && first.char === action.char ? null : approachPoint(data, prev, action, w);
  if (ap && Math.abs(ap.x - w.x) > APPROACH_SLOP) {
    // `floor`→`floor` 걷기. `walk` 이벤트와 똑같이 busy이고 탭으로 건너뛴다(5절 예외 둘). 설 점은 `floorPoint`가 쓴다.
    const spot = prev.at[action.char]!;
    s.floorTo[action.char] = { x: ap.x, y: w.y };
    s.queue.push(ap.face === null ? { type: 'walk', char: action.char, from: spot, to: spot } : { type: 'walk', char: action.char, from: spot, to: spot, face: ap.face });
  } else if (ap?.face != null) {
    w.facing = ap.face;
  }
  const board = r.source === 'blocked' && action.verb === 'move' ? data.screen.spots[action.target]?.board : undefined;
  if (board && isFree(data, prev.at[action.char] ?? '') && (w.x !== board[0] || w.y !== board[1])) {
    // 끝이 차 있으면(`takenShow`) 바닥 점까지 걸어가 그 끝을 보고 멈춘다. 뛰어오르지 않는다(1-5-2절, 16번 "끝 앞에서 멈춘다").
    const spot = prev.at[action.char]!;
    const target = spotPoint(data, action.target);
    s.floorTo[action.char] = { x: board[0], y: board[1] };
    const face: Facing | null = target.x === board[0] ? null : target.x > board[0] ? 1 : -1;
    s.queue.push(face === null ? { type: 'walk', char: action.char, from: spot, to: spot } : { type: 'walk', char: action.char, from: spot, to: spot, face });
  }
  deferShown(data, s, before, events);
  if (to) s.floorTo[action.char] = to;
  // 장대 대상 점: `reachPoint`, 없으면 대상 상자 아래 끝 가운데(#284: 고리 뻗기 실패는 집게가 고리 "바로 아래"에서 멈춘다).
  const rp = data.screen.hotspots[action.target]?.reachPoint;
  const tb = rp ? null : targetBox(data.screen, prev, action.target);
  if (rp) s.reach[action.char] = { x: rp[0], y: rp[1] };
  else if (tb) s.reach[action.char] = { x: tb.left + tb.width / 2, y: tb.top + tb.height };
  else delete s.reach[action.char];
  const n = bump(s, variantKey(r.source, r.ruleId, action));
  for (const ev of events) s.queue.push(ev.type === 'say' ? { ...ev, text: pickText(ev.text, n) } : ev);
  const hint = hintEvent(data, s, r.source, action);
  if (hint) s.queue.push(hint);
}

/** 바닥(`free`) 자리로 갈 때 설 점. `move floor`는 누른 점, 그 밖에는 지금 있는 곳 바로 아래(손 놓기·발사·기절). */
function floorPoint(data: SceneData, s: SceneState, char: CharacterId, to: string): Point {
  const picked = s.floorTo[char];
  if (picked) {
    delete s.floorTo[char];
    return clampToArea(picked, WALK_AREA);
  }
  return clampToArea({ x: s.walkers[char].x, y: spotPoint(data, to).y }, WALK_AREA);
}

function destination(data: SceneData, s: SceneState, char: CharacterId, to: string): Point {
  return isFree(data, to) ? floorPoint(data, s, char, to) : spotPoint(data, to);
}

/**
 * 순간 배치될 때 설 점. `hold` 자리(또는 `via`로 거친 자리)에서 그 `releaseTo`로 떨어지면 `releasePoint`(바구니 안 착지 점),
 * 아니면 `destination`. 두 사람이 같은 점에 떨어져도 된다(포개짐, 형식 기록 6절 2번).
 */
function landing(data: SceneData, s: SceneState, char: CharacterId, from: string, to: string): Point {
  const h = data.screen.spots[from];
  if (h?.hold === true && h.releasePoint && h.releaseTo === to) {
    delete s.floorTo[char];
    return { x: h.releasePoint[0], y: h.releasePoint[1] };
  }
  return destination(data, s, char, to);
}

/**
 * 기절 리셋에서 설 점. 기절 전에 이미 리셋 자리(`free`)에 있던 사람은 지금 점에 그대로 둔다(#215).
 * 바닥을 걸어 (60, 210)에 선 사람이 남 때문에 기절해도 바닥 y로 튀지 않고, 고리에서 맞아 `place`(바구니) 바로 뒤에
 * `faint`가 와도 바구니 착지 점에 남는다(#176, 바구니도 이미 그 바닥 자리). 그 밖(시소·고리에서 내려오는 사람)은 `destination`.
 */
function faintPoint(data: SceneData, s: SceneState, char: CharacterId, to: string): Point {
  const w = s.walkers[char];
  if (s.spotOf[char] === to && isFree(data, to)) {
    delete s.floorTo[char];
    return { x: w.x, y: w.y };
  }
  return destination(data, s, char, to);
}

function teleport(w: Walker, p: Point): void {
  w.x = p.x;
  w.y = p.y;
  w.target = null;
  w.walkTicks = 0;
}

/** 말풍선 길이를 재는 글자 수(#304 3번). 줄바꿈 자리(U+200B, `\n`)는 안 보이니 빼고, 글자는 코드 포인트로 센다. */
export function sayChars(display: string): number {
  return [...display.replace(/[\u200b\n]/g, '')].length;
}

/** 말풍선이 떠 있는 틱 수. `texts`가 있으면 화면 글(화자 변형 포함)로, 없으면 글 ID로 잰다(테스트용 폴백). */
export function sayDuration(data: Pick<SceneData, 'texts'>, speaker: string, id: string): number {
  const shown = data.texts ? sayText(data.texts, id, speaker) : id;
  return Math.min(TIMING.sayMax, TIMING.sayBase + TIMING.sayPerChar * sayChars(shown));
}

/** 이벤트 하나를 시작한다. `seq`는 시작 순번. 보이는 플래그(4-2절 (a))도 여기서 바꾼다. */
function start(data: SceneData, s: SceneState, ev: PlayEvent): Playing {
  const seq = s.started++;
  const p = begin(data, s, ev, seq);
  commitShown(s, seq, 'start');
  return p;
}

/** 즉시 끝나는 효과(배치·게이지 값)는 여기서 적용한다. */
function begin(data: SceneData, s: SceneState, ev: PlayEvent, seq: number): Playing {
  // 그 캐릭터가 움직이거나 다른 연출을 시작하면 붙들고 있던 마지막 장을 놓는다(#189).
  if (ev.type === 'walk' || ev.type === 'release' || ev.type === 'place') delete s.held[ev.char];
  else if (ev.type === 'anim') delete s.held[ev.target as CharacterId];
  else if (ev.type === 'faint') s.held = {};
  switch (ev.type) {
    case 'walk': {
      const p = destination(data, s, ev.char, ev.to);
      s.spotOf[ev.char] = ev.to;
      const playing: Playing = { ev, t: 0, duration: null, seq, legs: walkLegs(data, ev.from, ev.to, p), end: p };
      nextLeg(data, s, playing);
      return playing;
    }
    case 'release':
      teleport(s.walkers[ev.char], landing(data, s, ev.char, ev.from, ev.to));
      s.spotOf[ev.char] = ev.to;
      s.landed[ev.char] = seq;
      return { ev, t: 0, duration: TIMING.release, seq };
    case 'place':
      teleport(s.walkers[ev.char], landing(data, s, ev.char, ev.via ?? ev.from, ev.to));
      s.spotOf[ev.char] = ev.to;
      s.landed[ev.char] = seq;
      return { ev, t: 0, duration: TIMING.place, seq };
    case 'faint':
      for (const c of CHARACTERS) {
        teleport(s.walkers[c.id], faintPoint(data, s, c.id, ev.to[c.id]));
        s.spotOf[c.id] = ev.to[c.id];
        s.landed[c.id] = seq;
      }
      s.faintCutUntil = s.tick + TIMING.faintCut;
      return { ev, t: 0, duration: TIMING.faint, seq };
    case 'gauge':
      s.shownGauge = ev.value;
      return { ev, t: 0, duration: TIMING.gauge, seq };
    case 'clear':
      s.cleared = true;
      return data.clearLine ? { ev, t: 0, duration: TIMING.clearCut, seq, cut: data.clearLine } : { ev, t: 0, duration: 0, seq };
    case 'say':
      return { ev, t: 0, duration: sayDuration(data, ev.speaker, ev.text), seq };
    case 'anim': {
      // 물건 anim은 갈래를 anim 직전 보이는 플래그로 고르고(4-1절), 그 길이가 busy 길이다(5절). 없으면 임시 길이.
      const obj = data.art?.objects.find((o) => o.ids.includes(ev.target));
      const art = data.art && obj ? animOf(data.art, ev.target, ev.name, shownFlags(s, obj.key)) : null;
      if (art) return { ev, t: 0, duration: animTicks(art.anim), seq, art };
      const p: Playing = { ev, t: 0, duration: charAnimTicks(data, ev.target, ev.name) ?? TIMING.anim, seq };
      const cues = cueMs(data.sprites?.[ev.target], ev.name).map((ms) => Math.ceil(ms / TICK_MS - 1e-9));
      if (cues.length > 0) p.cues = cues;
      return p;
    }
    case 'fx':
      return { ev, t: 0, duration: fxTicks(ev.effect), seq };
    case 'item':
      return { ev, t: 0, duration: TIMING.item, seq };
  }
}

/**
 * `walk` 구간(#397, `magpie_nest.md` 1-5-2절). `board`가 있는 자리로 바닥에서 오면 바닥 점까지 걷고 깡충 올라서고,
 * 그 자리에서 바닥으로 떠나면 먼저 바닥 점으로 뛰어내린 뒤 걷는다. `board` 자리끼리(시소 끝 ↔ 끝)는 판 위로 걷는다.
 */
function walkLegs(data: SceneData, from: string, to: string, p: Point): WalkLeg[] {
  const up = data.screen.spots[to]?.board;
  const down = data.screen.spots[from]?.board;
  if (up && !down) return [{ kind: 'walk', to: { x: up[0], y: up[1] } }, { kind: 'hop', to: p, up: true }];
  if (down && !up) return [{ kind: 'hop', to: { x: down[0], y: down[1] }, up: false }, { kind: 'walk', to: p }];
  return [{ kind: 'walk', to: p }];
}

const msTicks = (ms: number): number => Math.max(1, Math.round(ms / TICK_MS));

/** 깡충 시간(틱). 웅크림·공중은 시트 `step_up` `ms`가 있으면 그 값(ADR-0007: 지속 시간은 시트 데이터), 없으면 `HOP` 표. */
function hopTiming(data: SceneData, id: CharacterId, up: boolean): Pick<Hop, 'crouch' | 'air' | 'land' | 'h'> {
  const land = msTicks(HOP.landMs);
  if (!up) return { crouch: 0, air: msTicks(HOP.down.airMs), land, h: HOP.down.h };
  const def = HOP.up[id];
  const a = data.sprites?.[id]?.anims.step_up;
  const ms = a && 'ms' in a && a.ms.length >= 2 ? a.ms : [def.crouchMs, def.airMs];
  return { crouch: msTicks(ms[0]!), air: msTicks(ms[1]!), land, h: def.h };
}

/** 깡충 t틱의 발 위치. 웅크림 동안 `from`, 공중은 x 직선 + y 포물선, 착지 동안 `to`. 소수 좌표다(그릴 때 반올림). */
export function hopPoint(h: Hop): Point {
  if (h.t < h.crouch) return { ...h.from };
  if (h.t >= h.crouch + h.air) return { ...h.to };
  const u = (h.t - h.crouch) / h.air;
  return { x: h.from.x + (h.to.x - h.from.x) * u, y: h.from.y + (h.to.y - h.from.y) * u - h.h * 4 * u * (1 - u) };
}

/** 깡충 t틱의 `step_up` 칸: 웅크림·착지 0, 공중 1(1-5-3절). */
export function hopFrame(h: Hop): 0 | 1 {
  return h.t >= h.crouch && h.t < h.crouch + h.air ? 1 : 0;
}

/** 깡충을 한 틱 보낸다. 끝나면 `to`에 세우고 지운다. */
function tickHops(s: SceneState): void {
  for (const c of CHARACTERS) {
    const h = s.hops[c.id];
    if (!h) continue;
    h.t += 1;
    const w = s.walkers[c.id];
    if (h.t >= h.crouch + h.air + h.land) {
      teleport(w, h.to);
      delete s.hops[c.id];
    } else {
      const q = hopPoint(h);
      w.x = q.x;
      w.y = q.y;
    }
  }
}

/** `walk`의 앞 구간이 끝났으면 다음 구간을 시작한다. 이미 그 자리면(걸을 거리 0) 바로 그다음으로 넘어간다. */
function nextLeg(data: SceneData, s: SceneState, p: Playing): void {
  if (p.ev.type !== 'walk' || !p.legs) return;
  const id = p.ev.char;
  const w = s.walkers[id];
  while (w.target === null && !s.hops[id] && p.legs.length > 0) {
    const leg = p.legs.shift()!;
    if (leg.to.x !== w.x) w.facing = leg.to.x > w.x ? 1 : -1;
    if (leg.kind === 'walk') {
      w.target = leg.to.x === w.x && leg.to.y === w.y ? null : { ...leg.to };
      w.walkTicks = 0;
    } else {
      s.hops[id] = { from: { x: w.x, y: w.y }, to: { ...leg.to }, t: 0, ...hopTiming(data, id, leg.up) };
    }
  }
}

/**
 * 캐릭터 연출의 busy 길이: 시트에 시간으로 넘기는 그 자세가 있으면 `ms` 합(물건 anim과 같은 올림, 형식 기록 5절).
 * 시트·자세가 없거나 거리로 넘기는 자세면 null(→ 임시 길이). 그림이 그 길이 동안 마지막 장까지 다 보인다.
 */
function charAnimTicks(data: SceneData, target: string, name: string): number | null {
  const a = data.sprites?.[target]?.anims[name];
  return a && 'ms' in a ? animTicks(a) : null;
}

const isCharacter = (id: string): id is CharacterId => CHARACTERS.some((c) => c.id === id);

/** 캐릭터 대상 연출이 끝나면 마지막 장을 붙든다(형식 기록 5절). 물건 anim은 시트 갈래가 따로 멈춘 모습을 정한다. */
function holdLast(s: SceneState, p: Playing): void {
  if (p.ev.type !== 'anim' || p.art || !isCharacter(p.ev.target)) return;
  s.held[p.ev.target] = { name: p.ev.name, ms: p.t * TICK_MS };
}

/** 이 캐릭터의 지금 연출: 재생 중이면 그것, 아니면 붙들고 있는 마지막 장. 없으면 null. */
export function charEvent(s: SceneState, id: CharacterId): { name: string; ms: number } | null {
  const ev = s.current?.ev;
  if (ev?.type === 'anim' && ev.target === id) return { name: ev.name, ms: s.current!.t * TICK_MS };
  return s.held[id] ?? null;
}

/**
 * 몸이 `hold` 자리(고리) 점에 놓여 있다 = 그림상 매달려 있다. 퍼즐 상태(`at`)는 연출 전에 바뀌므로 보지 않는다(#189).
 * 시소 발사 연출 동안은 `at`이 이미 고리지만 몸은 시소라 아니고, 둥지 뻗기 연출 동안은 `at`이 이미 바닥이지만 몸은 고리라 맞다.
 * 바닥 걷기 영역(`WALK_AREA`)은 고리 높이에 닿지 않아서 걸어서 그 점에 설 수는 없다. busy가 아니면 `at`과 같다.
 */
export function isHanging(data: SceneData, s: SceneState, id: CharacterId): boolean {
  const w = s.walkers[id];
  return Object.values(data.screen.spots).some((spot) => spot.hold === true && spot.x === w.x && spot.y === w.y);
}

/** 장면 상태 → 시트 자세(engine/sprites.ts `drawSprite`). 연출은 이벤트로만 안다(ADR-0065 5절). */
export function charPose(data: SceneData, s: SceneState, id: CharacterId): Pose {
  const w = s.walkers[id];
  return {
    walkedPx: w.target ? w.walkTicks * WALK_SPEED : null,
    holding: isHanging(data, s, id),
    event: charEvent(s, id),
    hop: s.hops[id] ? hopFrame(s.hops[id]) : null,
    clockMs: s.tick * TICK_MS,
    reach: s.reach[id] ?? null,
  };
}

/**
 * 칸 신호(#199): 재생 중인 캐릭터 연출이 신호 칸에 닿으면, show에서 그 연출 바로 뒤에 붙은 `fx` **하나만** 지금 띄운다.
 * 신호가 여럿(`cue` 배열, #284)이면 k번째 신호가 이어진 fx 중 k번째를 띄운다(앞 신호가 앞 fx를 이미 꺼냈으니 늘 맨 앞).
 * 그 뒤의 fx는 지금처럼 연출이 끝난 뒤 차례로 뜬다(둥지 삑의 메아리가 원래 삑보다 늦게 와야 한다, ADR-0003). 신호 하나 = fx 하나.
 * 바로 뒤가 fx가 아니면 아무것도 띄우지 않는다. 순번(`seq`)은 대기열 순서 그대로다.
 */
function fireCue(data: SceneData, s: SceneState, p: Playing): void {
  while (p.cues && p.cues.length > 0 && p.t >= p.cues[0]!) {
    p.cues.shift();
    if (s.queue[0]?.type === 'fx') s.overlays.push(start(data, s, s.queue.shift()!));
  }
  if (p.cues?.length === 0) delete p.cues;
}

/** 겹쳐 뜬 fx의 시간을 한 틱 보내고, 끝난 것을 내린다. */
function tickOverlays(s: SceneState): void {
  s.overlays = s.overlays.filter((o) => {
    o.t += 1;
    if (!finished(s, o)) return true;
    commitShown(s, o.seq, 'end');
    return false;
  });
}

/** 지금 화면에 뜬 효과(fx)들: 대기열 차례로 도는 것 + 칸 신호로 겹쳐 뜬 것. 엔진은 이것만 그린다. */
export function activeFx(s: SceneState): { effect: string; target: string; t: number }[] {
  const out: { effect: string; target: string; t: number }[] = [];
  for (const p of [...s.overlays, s.current]) if (p?.ev.type === 'fx') out.push({ effect: p.ev.effect, target: p.ev.target, t: p.t });
  return out;
}

function finished(s: SceneState, p: Playing): boolean {
  if (p.ev.type === 'walk') return s.walkers[p.ev.char].target === null && !s.hops[p.ev.char] && !p.legs?.length;
  return p.duration !== null && p.t >= p.duration;
}

/** 고정 틱 하나. 세로 화면 안내가 떠 있으면 엔진이 부르지 않는다(설계 9절, 연출 시계 정지). */
export function sceneTick(data: SceneData, s: SceneState): void {
  s.tick += 1;
  // 엔진 걷기와 자동 걷기 모두 같은 속도로 진행한다. 다른 캐릭터의 걷기는 연출 중에도 계속된다.
  for (const c of CHARACTERS) stepWalker(s.walkers[c.id], TIMING.walkSpeed);
  tickHops(s);
  tickOverlays(s);
  // 이벤트를 시작한 틱이 그 이벤트의 t=0 프레임이다. 길이 0 이벤트(clear)나 이미 도착한 걷기는 같은 틱에 다음으로 넘어간다.
  for (let guard = 0; guard < 64; guard++) {
    if (s.current === null) {
      const next = s.queue.shift();
      if (!next) {
        if (s.overlays.length === 0) s.held = {};
        return;
      }
      s.current = start(data, s, next);
    } else {
      s.current.t += 1;
    }
    fireCue(data, s, s.current);
    nextLeg(data, s, s.current);
    if (!finished(s, s.current)) return;
    if (s.current.ev.type === 'faint') s.shownGauge = GAUGE_MAX;
    if (s.current.ev.type === 'walk' && s.current.ev.face !== undefined) s.walkers[s.current.ev.char].facing = s.current.ev.face;
    if (s.current.ev.type === 'say') s.seenSay[seenSayKey(s.current.ev.speaker, s.current.ev.text)] = true;
    holdLast(s, s.current);
    commitShown(s, s.current.seq, 'end');
    s.current = null;
  }
}

/** 탭 결과. 엔진이 효과음·안내 문구를 고르는 데 쓴다. */
export type SceneTapResult =
  | { kind: 'ignored' }
  | { kind: 'skipWalk' }
  | { kind: 'skipSay' }
  | { kind: 'intent'; intent: Intent };

/**
 * 탭 하나. busy 동안은 새 행동을 받지 않고, 월드 탭으로 하는 전환도 받지 않는다(설계 5절).
 * - 얼굴 칸: busy 중에도 바로 전환한다(예외 셋, #266·6-4-2절). HUD 영역의 빈 곳은 무시.
 * - 자동 걷기 중: 걷기만 끝 위치로 건너뛴다. 남은 이벤트는 그대로 재생한다.
 * - 말풍선이 뜬 뒤 1.0초(`saySkipAfter`, 이미 본 글이면 0.4초 `seenSaySkipAfter`)가 지났으면: 그 말풍선만 끝낸다.
 */
export function sceneTap(data: SceneData, s: SceneState, p: Point, slop: number, touch: boolean): SceneTapResult {
  const cur = s.current;
  // 클리어 컷은 0.4초 뒤 탭으로 넘긴다(`magpie_nest.md` 8절·`ui-interaction.md` 11-1절: 다시 볼 때 기다리지 않게). 말풍선(1.0초)과 따로다. 클리어 뒤 다른 입력은 받지 않는다.
  if (cur?.ev.type === 'clear') {
    if (cur.t < TIMING.clearSkipAfter) return { kind: 'ignored' };
    cur.duration = cur.t;
    return { kind: 'skipSay' };
  }
  if (s.cleared) return { kind: 'ignored' };
  // 예외 셋(#266): busy 중에도 얼굴 칸은 평소처럼 바로 받는다(전환). 진행 중 이벤트·시간은 건드리지 않는다.
  // HUD 영역 안인데 칸이 아니거나(빈 띠) 맨 아래 게이지 띠면 무시한다(6-3-5절). 대사 넘기기는 월드 탭으로만 한다.
  if (isBusy(s)) {
    if (hitTest(hudTargets(), p, slop)) {
      const r = tap(tapContext(data, s), s.ui, p, slop, touch);
      s.ui = r.ui;
      return { kind: 'intent', intent: r.intent };
    }
    if (inHudZone(p)) return { kind: 'ignored' };
  }
  if (cur) {
    if (cur.ev.type === 'walk') {
      // 남은 걷기·깡충을 다 건너뛰고 끝 점에 선다(1-5-2절: 깡충까지 건너뛴다).
      const w = s.walkers[cur.ev.char];
      delete s.hops[cur.ev.char];
      cur.legs = [];
      if (cur.end) teleport(w, cur.end);
      else if (w.target) teleport(w, w.target);
      return { kind: 'skipWalk' };
    }
    if (cur.ev.type === 'say' && cur.t >= (s.seenSay[seenSayKey(cur.ev.speaker, cur.ev.text)] ? TIMING.seenSaySkipAfter : TIMING.saySkipAfter)) {
      cur.duration = cur.t;
      return { kind: 'skipSay' };
    }
    return { kind: 'ignored' };
  }
  if (s.queue.length > 0 || s.overlays.length > 0) return { kind: 'ignored' };

  const r = tap(tapContext(data, s), s.ui, p, slop, touch);
  s.ui = r.ui;
  const intent = r.intent;
  // 컷이 남은 동안(faint 뒤 0.5초) 새 행동을 시작하면 컷을 바로 내린다. 말풍선과 겹치지 않게.
  if (intent.kind === 'walk' || intent.kind === 'act') s.faintCutUntil = 0;
  if (intent.kind === 'walk') walkTo(s.walkers[s.ui.active], intent.to, WALK_AREA);
  else if (intent.kind === 'act') runAction(data, s, intent.action, intent.to);
  return { kind: 'intent', intent };
}

/** 게이지가 줄어드는 연출(`gauge` 이벤트, 감소) 중이면 잃은 칸 [from, to)와 경과 틱. 엔진이 칸 터짐·흔들림을 그린다(설계 6-2-5절). */
export function gaugeDrop(s: SceneState): { from: number; to: number; t: number } | null {
  const c = s.current;
  if (c?.ev.type !== 'gauge' || c.ev.delta >= 0) return null;
  return { from: c.ev.value, to: Math.min(GAUGE_MAX, c.ev.value - c.ev.delta), t: c.t };
}

/** 지금 떠 있는 말풍선. 없으면 null. */
export function currentBubble(s: SceneState): { speaker: string; text: string } | null {
  const ev = s.current?.ev;
  return ev?.type === 'say' ? { speaker: ev.speaker, text: ev.text } : null;
}

/** 지금 떠 있는 화면 가운데 컷 글 ID. 없으면 null. busy가 끝난 뒤에도 잠깐 남을 수 있다. */
export function currentCut(s: SceneState): string | null {
  if (s.current?.cut) return s.current.cut;
  return s.tick < s.faintCutUntil ? 'ui.faint' : null;
}

/**
 * 재생 도구 훅 `window.__gcLayout()`(`?playtest=1`) 모양. `scripts/playtest/plan.ts` `Layout`과 같다.
 * 상자는 입력 판정이 쓰는 바로 그 값이다(훅 상자 = 판정 상자).
 */
export interface SceneLayout {
  active: CharacterId;
  selected: string | null;
  busy: boolean;
  cleared: boolean;
  gauge: number;
  /** 화면 가운데 컷 글 ID(`ui.faint`). 없으면 null. */
  cut: string | null;
  at: Record<CharacterId, string>;
  chars: Record<CharacterId, HitBox>;
  spots: Record<string, HitBox>;
  hotspots: Record<string, HitBox>;
  hud: Record<string, HitBox>;
}

export function sceneLayout(data: SceneData, s: SceneState): SceneLayout {
  const spots: Record<string, HitBox> = {};
  for (const [id, spot] of Object.entries(data.screen.spots)) {
    if (spot.box) {
      const [left, top, width, height] = spot.box;
      spots[id] = { left, top, width, height };
    }
  }
  const hotspots: Record<string, HitBox> = {};
  for (const id of Object.keys(data.screen.hotspots)) {
    const box = hotspotBox(data.screen, s.puzzle, id);
    if (box) hotspots[id] = box;
  }
  const hud: Record<string, HitBox> = {};
  for (const t of hudTargets()) hud[t.id] = t.box;
  return {
    active: s.ui.active,
    selected: s.ui.selected,
    busy: isBusy(s),
    cleared: s.cleared,
    gauge: s.shownGauge,
    cut: currentCut(s),
    at: { ...s.puzzle.at },
    chars: bodies(data, s),
    spots,
    hotspots,
    hud,
  };
}
