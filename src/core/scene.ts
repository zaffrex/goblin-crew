// 화면 하나의 진행: 탭 → `step` → 이벤트 재생(busy) (docs/design/ui-interaction.md 5절, ADR-0065 6절).
// 순수 로직이다. DOM·Canvas를 모른다. 엔진(main.ts)은 sceneTap/sceneTick을 부르고 결과를 그리기만 한다.
// 상태는 JSON 직렬화 가능한 평범한 객체만 쓴다(ADR-0004 결정 2). 화면 데이터는 상태에 넣지 않고 인자로 받는다.
//
// 엔진은 `step`이 돌려준 이벤트로만 반응한다(ADR-0065 5절). 퍼즐 상태를 들여다보고 연출을 추측하지 않는다.
// 예외: 바닥(`free`) 자리 캐릭터의 좌표는 퍼즐 상태에 없어서 엔진 걷기(walker)가 들고 있다.

import { CHARACTERS, characterFaceBox, characterHitBox, characterDef, type CharacterId } from './characters';
import { TICK_MS, WALK_AREA, WALK_SPEED } from './config';
import { hitTest, type HitBox } from './hit';
import { inHudZone } from './hud';
import type { AlphaMask } from './alpha';
import { hotspotBox, hudTargets, tap, type DrawnBody, type Intent, type TapContext, type UiState } from './interact';
import { animOf, animTicks, coverFrames, frameOpaqueAt, restingBox, tiltDrop, timedIndex, type SceneAnim, type SceneArtMeta, type SceneObject, type SceneView } from './sceneArt';
import { FX_TICKS, fxTicks } from './fx';
import { sayText, seenSayKey } from './sayText';
import { cueMs, spriteBox, spriteFacing, spriteFrame, spriteHit, spriteOpaqueAt, type Pose, type SpriteAnim, type SpriteMeta } from './sprite';
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
 * 공중 마지막 틱 발이 판 윗면 이하여야 위에서 내려와 선다. 쉬는 판(1-7-3절)에서는 들린 끝(발 203)까지 37px라 h 10이 여유 0px다.
 * 시트 `step_up` 공중 ms를 바꾸면 `sceneTilt.test.ts` 18가지 올라서기 검사가 잡는다.
 */
export const HOP = {
  up: {
    jjuk: { crouchMs: 100, airMs: 150, h: 10 },
    ppik: { crouchMs: 50, airMs: 150, h: 12 },
    mukjik: { crouchMs: 150, airMs: 150, h: 10 },
  } satisfies Record<CharacterId, { crouchMs: number; airMs: number; h: number }>,
  down: { airMs: 100, h: 8 },
  landMs: 50,
  /**
   * 묵직이 쿵 = 판 끝에 뛰어올라 쿵(`magpie_nest.md` 1-6-2절, #414). 시간은 시트 자세의 `air` 칸이 정하고 높이만 여기 둔다.
   * 바닥 점에서 뛰면 `h`, 이미 그 끝에 서 있으면(제자리) `hOnBoard`.
   */
  stomp: { h: 32, hOnBoard: 24 },
  /** 15번: 빈 판에 쿵 하면 U6가 끝나는 틱에 판이 묵직이를 튕겨 낸다(1-6-5절). 바닥 점 바깥(+x)으로 `dx`, 바닥 y `y`. */
  eject: { h: 24, airMs: 250, dx: 12, y: 244 },
  /** 무게 `weight` 이상인 사람이 걸어서 한 끝에 올라서면 반대쪽 끝에 탄 사람이 들썩한다(1-6-6절). 수평 이동 없음. */
  jostle: { h: 4, airMs: 100, landMs: 50, weight: 2 },
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
  /** 올라서기면 true, 내려서기면 false. */
  up: boolean;
  /** 깡충의 판 쪽 자리 ID(올라서기 = 도착, 내려서기 = 출발). 기울기 물건을 찾는 데 쓴다(형식 기록 12절). */
  spot: string;
  /** 내려서기: 뜰 때 판 위 발이 내려가 있던 px(그 순간의 기울기). 공중 동안 0으로 줄인다. 올라서기는 0. */
  fromDrop: number;
  /**
   * 걷기 깡충이 아닌 것(#414). 없으면 `walk` 구간의 올라서기·내려서기다.
   * - `stomp`: 시트 자세(`anim`, `air` 칸이 있는 `seesaw_stomp`)를 따라 판 끝에 뛰어올라 쿵. 착지 뒤 남은 칸은 대기열 밖에서 돌고, 끝나면 `after`로 내려선다(1-6-2절 ⑦).
   * - `eject`: 15번 튕겨 나가기(1-6-5절). 공중 동안 `anim`의 `airMs` 칸에 멈춘다.
   * - `jostle`: 반대쪽 들썩(1-6-6절). 공중 동안 `anim`의 `airMs` 칸, 착지 동안 서 있기 첫 칸.
   */
  kind?: 'stomp' | 'eject' | 'jostle';
  /** 깡충 동안 `step_up` 대신 그릴 시트 자세. 시트에 그 자세가 없으면 비워 둔다(→ `step_up`). */
  anim?: string;
  /** `eject`·`jostle`의 공중 칸 시각(ms, `anim` 안). */
  airMs?: number;
  /** 출발점이 판 위다(제자리 쿵). 공중 동안도 판에 탄 것으로 센다(1-7-6절): 판은 쿵 칸까지 그대로이고 발은 판에서 뛰어 판에 내린다. */
  onBoard?: boolean;
  /** `stomp`: 남은 칸이 끝나면 뛰어내릴 바닥 점(`board`). */
  after?: Point;
}

/** `walk` 이벤트 하나를 이루는 구간(#397). 보통은 걷기 하나이고, 시소 끝에 오르내리면 걷기와 깡충 둘이다. */
export type WalkLeg = { kind: 'walk'; to: Point } | { kind: 'hop'; to: Point; up: boolean };

/**
 * 재생 중인 이벤트. `say`는 고른 문구 ID 하나로 바꿔 둔다(배열 변형은 발동 횟수로 고른다).
 * `walk.face`는 엔진이 넣은 "대상 앞까지 걷기"(설계 5-1절)에만 있다: 도착하면 그 방향(대상 쪽)을 본다.
 */
export type PlayEvent =
  | Exclude<PuzzleEvent, { type: 'say' } | { type: 'walk' } | { type: 'anim' } | { type: 'fx' }>
  /** `stay`: 그리지 않는 걷기(제자리 쿵 전에 퍼즐이 먼저 내려서게 한 것, 1-6-2절 "제자리"). 내려서기는 쿵 뒤 ⑦로 미룬다. */
  | (Extract<PuzzleEvent, { type: 'walk' }> & { face?: Facing; stay?: true })
  /** `onto`: 이 캐릭터 연출이 시트 `air` 칸을 따라 그 `board` 자리(판 끝)에 뛰어오른다(#414). */
  | (Extract<PuzzleEvent, { type: 'anim' }> & { onto?: string })
  /** `by`: 이 효과를 낸 행동의 캐릭터(#530). 소리 글자 자리 `'actor'`(`fx.ts` `fxTextSpot`)가 쓴다. 입장 연출은 없다. */
  | (Extract<PuzzleEvent, { type: 'fx' }> & { by?: CharacterId })
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
   * 맨 앞이 물건 anim이면 그 anim을 겹쳐 시작한다(#507). 그 밖이면(말풍선·캐릭터 연출 등) 그 신호는 아무것도 띄우지 않는다(`ability-feedback.md` 4절).
   */
  cues?: number[];
  /** `walk`의 남은 구간(#397). 앞 구간(걷기·깡충)이 끝나면 다음을 시작한다. 비면 도착이다. */
  legs?: WalkLeg[];
  /** `walk`가 끝날 때 설 점. 탭 건너뛰기가 여기로 바로 옮긴다(깡충까지 건너뜀, 1-5-2절). */
  end?: Point;
  /** 캐릭터 연출이 시작되기 전 틱 수(15번 튕겨 나가기 공중, 1-6-5절). 자세 시각과 칸 신호를 이만큼 늦춘다. */
  lead?: number;
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
   * 칸 신호로 연출과 겹쳐 뜬 `fx`(#199)와 물건 anim(#507). `current`와 따로 시간이 간다. 남아 있는 동안 busy다.
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
  /**
   * 물건 키 → 끝난 `hold` 물건 anim(그림 형식 13절, 개정 8, #450)과 그 anim을 시작한 틱. 대기열이 빌 때까지(캐릭터 `held`와 같은 때),
   * 기절, 또는 같은 물건의 다음 anim이 시작될 때까지 마지막 칸으로 그린다. 그림 전용이다(판정·히트 박스는 안 쓴다).
   */
  heldArt: Record<string, { anim: SceneAnim; since: number }>;
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
  /**
   * "보이는 탑승"(`magpie_nest.md` 1-5-4절, 형식 기록 12절): 판(`board` 자리) 위에 **그려지고 있는** 사람 → 올라탄 자리 ID.
   * 퍼즐 `at`은 걷기 전에 바뀌어서 쓰지 않는다(`isHanging`과 같은 이유). 켜기: 올라서기 착지 칸 시작, `board` 자리로 순간 배치·기절 리셋·처음 배치.
   * 끄기: 내려서기가 뜰 때, 그 사람의 캐릭터 anim이 시작될 때 `at`이 이미 `board` 자리가 아니면(발사 `launch_to_hook`), 다른 자리로 순간 배치.
   * 그림 전용이다(기울기 칸, 판 위 발 높이). 판정·히트 박스는 안 쓴다.
   */
  riding: Partial<Record<CharacterId, string>>;
  /**
   * 판에서 빠진 채 그 자리에서 연출하는 사람의 발 높이(발사 `launch_to_hook`, 설계 1-7-8절). 빠지는 틱의 `boardDrop`을 잡아 두고,
   * 몸이 그 점(`x`, `y`)을 떠나거나 다시 판에 타거나 깡충을 시작하면 쓰지 않는다. 그림 전용이다.
   */
  pinDrop: Partial<Record<CharacterId, { x: number; y: number; drop: number }>>;
  cleared: boolean;
  /**
   * 남은 이벤트가 모두 시작 연출(`onEnter`)인가(`ui-interaction.md` 5절 예외 넷 1, #700). 월드 탭이 오면 남은 시작 연출을 끝내고 그 탭을 평소대로 처리한다.
   * 시작 연출 중에는 행동이 대기열에 들어갈 수 없어서(HUD 칸은 이벤트를 안 넣는다) 이 표시 하나로 "남은 게 다 시작 연출"이 된다. 대기열이 다 비면 끈다.
   */
  intro: boolean;
  /**
   * 이번 틱(또는 이번 탭)에 시작한 걷기와 그 길이(px, #38 5-2-2절). 엔진이 `takeWalkStart`로 읽고 지운다. 긴 걷기 안내를 띄우는 데만 쓴다.
   * 자동 걷기(`walk` 이벤트)는 구간 길이 합, 바닥 걷기는 목표까지 직선 거리. 시작 연출(`intro`) 중 걷기는 넣지 않는다(탭이 시작 연출을 통째로 넘긴다).
   */
  walkStart: { char: CharacterId; dist: number } | null;
  /**
   * 마지막으로 탭으로 시작한 행동의 키(`actionKey`). 마우스로 행동 뒤 마지막 말풍선을 누를 때, 같은 행동이면 닫기만 하고
   * 다른 행동이면 닫고 실행하는 데 쓴다(`ui-interaction.md` 5절 예외 넷 3, #601). UI 상태라 세이브하지 않는다.
   */
  lastActKey: string | null;
  /**
   * 이 화면의 클리어 연출을 이번 페이지에서 이미 끝까지 봤다(#765, M2 플래닝 회의록 "확인한 것"). 엔진이 새 판을 만들 때 채운다.
   * 참이면 클리어 규칙 연출 중 월드 탭 하나가 남은 연출을 끝 상태로 돌리고 카드로 넘긴다(`skipClearRule`). UI 상태라 세이브하지 않는다.
   */
  clearSeen: boolean;
  /** `clear` 이벤트를 대기열에 넣은 틱(정답 행동을 시작한 틱). 클리어 건너뛰기 잠금(`clearSkipAfter`)을 여기서 센다. 없으면 null. */
  clearAt: number | null;
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
  /**
   * 엔진이 읽은 시트 알파(설계 2-1절 그림 칸, #736). 시트 이미지가 아직이거나 못 읽었으면 각 함수가 null을 돌려준다.
   * 없으면 바닥에 선 동료는 얼굴 상자로만 전환된다(11/19 규칙, 노드 테스트 기본값).
   */
  alpha?: SceneAlpha;
}

/** 시트 알파 조회. 이미지가 늦게 오니 값이 아니라 함수로 넘긴다(엔진 `spriteAlpha`, `SceneArt.alpha`). */
export interface SceneAlpha {
  /** 캐릭터 ID → 기본 시트 알파. */
  sprite(id: string): AlphaMask | null;
  /** 이 화면 물건 시트 알파. */
  objects(): AlphaMask | null;
}

/**
 * busy = 재생할 이벤트가 하나라도 남아 있다(설계 5절). 깡충도 센다: 쿵 남은 칸·⑦ 내려서기·들썩은 대기열 밖에서 돈다(#414 1-6-4·1-6-6절).
 * 걷기 구간의 깡충은 그 `walk`가 `current`라 원래 busy다.
 */
export function isBusy(s: SceneState): boolean {
  return s.current !== null || nothingAfterCurrent(s) === false;
}

/**
 * `current` 뒤에 재생할 것이 없다: 대기열·겹친 fx/물건 anim·깡충이 다 비었다. `isBusy`에서 `current`만 뺀 것이다.
 * 말풍선이 마지막 이벤트인지(`ui-interaction.md` 5절 예외 넷 2, #700) 이걸로 본다. 엔진 걷기(바닥→바닥)는 원래 busy가 아니라 안 센다.
 */
function nothingAfterCurrent(s: SceneState): boolean {
  return s.queue.length === 0 && s.overlays.length === 0 && Object.keys(s.hops).length === 0;
}

/**
 * busy 중에도 터치 고르기(select)를 받는 때: 행동 뒤 말풍선이 마지막 이벤트로 떠 있다(`ui-interaction.md` 5절 예외 넷 2, #700).
 * 엔진은 이때 터치 라벨·외곽선을 말풍선과 함께 보여 준다(#704 Luna 리뷰). 다른 busy(연출 중간·시작 연출)에는 고르기가 없다.
 */
export function selectsDuringSay(s: SceneState): boolean {
  return s.current?.ev.type === 'say' && !s.intro && nothingAfterCurrent(s);
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
/** 올라탈 판 끝(`board` 바닥 점이 있는 서는 자리)인가. */
const hasBoard = (data: SceneData, spotId: string): boolean => data.screen.spots[spotId]?.board !== undefined;

/** 순간 배치·리셋으로 `spot`에 놓였다: 판 끝이면 탄 것으로, 아니면 내린 것으로 센다(1-5-4절 "리셋·로드는 바로 센다"). */
function setRiding(data: SceneData, s: SceneState, char: CharacterId, spot: string): void {
  if (hasBoard(data, spot)) s.riding[char] = spot;
  else delete s.riding[char];
}

/** 바닥 걷기 목표가 물건의 `noFloor` 상자 안이면 그 y로 옮긴다(형식 기록 12절, 설계 1-5-2절 "바닥 클릭 구멍 막기"). */
export function floorTarget(data: SceneData, p: Point): Point {
  for (const o of data.art?.objects ?? []) {
    const nf = o.noFloor;
    if (!nf) continue;
    const [x, y, w, h] = nf.box;
    if (p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return { x: p.x, y: nf.y };
  }
  return p;
}

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
  const riding: Partial<Record<CharacterId, string>> = {};
  for (const c of CHARACTERS) if (hasBoard(data, puzzle.at[c.id]!)) riding[c.id] = puzzle.at[c.id]!;
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
    heldArt: {},
    reach: {},
    seenSay: {},
    hops: {},
    riding,
    pinDrop: {},
    cleared: false,
    intro: false,
    walkStart: null,
    lastActKey: null,
    clearSeen: false,
    clearAt: null,
  };
  // onEnter는 상태를 바꾸지 않는 연출이다(ADR-0065 5절). say 화자는 캐릭터 ID만 온다.
  for (const item of data.screen.onEnter ?? []) {
    if ('anim' in item) s.queue.push({ type: 'anim', target: item.anim[0], name: item.anim[1] });
    else if ('fx' in item) s.queue.push({ type: 'fx', effect: item.fx[0], target: item.fx[1] });
    else s.queue.push({ type: 'say', speaker: item.say[0], text: pickText(item.say[1], 1) });
  }
  s.intro = s.queue.length > 0;
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
    // 판 위 사람은 그린 자리(발 + 판 높이)를 누른다(1-7-9절). 쉬는 판이라 걷기 좌표와 최대 11px 어긋난다.
    const y = w.y + Math.round(boardDrop(data, s, c.id));
    const own = meta ? spriteHit(meta, charPose(data, s, c.id), w.x, y, facing) : null;
    out[c.id] = own ?? characterHitBox(characterDef(c.id), w.x, y, facing);
  }
  return out;
}

/**
 * 캐릭터 그리는 순서(뒤 → 앞). 엔진 그리기와 클릭 판정(`TapContext.order`)이 같이 쓴다(형식 기록 6절 2·3).
 * 1. `hold` 자리(고리)에 매달린 캐릭터(`isHanging`)는 맨 앞 2. 발 y가 작을수록 뒤 3. 같으면 나중에 떨어진 사람이 앞
 * 4. 그래도 같으면 지금 연출 중인 캐릭터(`current`가 그 캐릭터 anim)가 앞, 그다음 조작 중인 캐릭터(`ui.active`)가 앞(#506).
 *    같은 바닥 줄에서 연출 자리가 다른 사람 자리와 겹쳐도 특기를 쓰는 몸이 가려지지 않는다(화면 2 쿵 자리 x 339 ≈ 쭉이 시작 x 336).
 *    연출이 끝나도 조작 중인 사람이 앞이라 엉덩방아 뒤에 갑자기 뒤로 숨지 않는다. 클릭도 같은 순서라 "보이는 사람이 눌린다".
 * 5. 그래도 같으면 CHARACTERS 순서의 앞쪽(쭉이)이 앞(예전 엔진 순서 그대로).
 */
export function drawOrder(data: SceneData, s: SceneState): CharacterId[] {
  const y = (c: CharacterId): number => (isHanging(data, s, c) ? Infinity : Math.round(s.walkers[c].y));
  const rank = (c: CharacterId): number => CHARACTERS.findIndex((d) => d.id === c);
  const ev = s.current?.ev;
  const performer = ev?.type === 'anim' && ev.target in s.walkers ? ev.target : null;
  const focus = (c: CharacterId): number => (c === performer ? 2 : c === s.ui.active ? 1 : 0);
  return CHARACTERS.map((c) => c.id).sort((a, b) => {
    const ya = y(a);
    const yb = y(b);
    if (ya !== yb) return ya - yb;
    const la = s.landed[a] ?? -1;
    const lb = s.landed[b] ?? -1;
    if (la !== lb) return la - lb;
    const fa = focus(a);
    const fb = focus(b);
    if (fa !== fb) return fa - fb;
    return rank(b) - rank(a);
  });
}

/**
 * 판정용 얼굴 상자(설계 2-1절, #427). 몸 상자와 같은 발 위치·방향(`charFacing`)에 `characterFaceBox`를 놓는다.
 * 바닥에 선 다른 캐릭터의 전환 상자로만 쓴다. 바닥에서 busy가 아닐 때는 늘 서 있기 자세라 서 있기 기준 값 하나면 된다
 * (연출 자세는 busy라 월드 탭을 판정하지 않는다).
 */
export function faces(data: SceneData, s: SceneState): Record<CharacterId, HitBox> {
  const out = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const w = s.walkers[c.id];
    out[c.id] = characterFaceBox(characterDef(c.id), w.x, w.y, charFacing(data, s, c.id));
  }
  return out;
}

/** 그린 자리 하나(그리기 `drawSprite`와 같은 칸 번호·발 위치·방향). 시트·알파가 없거나 실루엣이면 null. */
interface Placed {
  meta: SpriteMeta;
  mask: AlphaMask;
  frame: number;
  x: number;
  y: number;
  facing: Facing;
}

function placed(data: SceneData, s: SceneState, id: CharacterId): Placed | null {
  const meta = data.sprites?.[id];
  const mask = data.alpha?.sprite(id) ?? null;
  if (!meta || !mask) return null;
  const frame = spriteFrame(meta, charPose(data, s, id));
  if (frame === null) return null;
  const w = s.walkers[id];
  return { meta, mask, frame, x: w.x, y: w.y + boardDrop(data, s, id), facing: charFacing(data, s, id) };
}

const placedOpaque = (p: Placed, px: number, py: number): boolean => spriteOpaqueAt(p.meta, p.mask, p.frame, p.x, p.y, p.facing, px, py);

/**
 * 물건 그림 고르기에 넘길 지금 장면(`sceneDraws`). 엔진 그리기와 판정의 덮개(`drawnBodies`)가 같이 쓴다.
 * 반복 시작 시각(`loopStarts`)은 엔진 상태라 넣지 않는다. 엔진은 그리기 전에 덧붙인다.
 */
export function sceneArtView(data: SceneData, s: SceneState): SceneView {
  const playing = s.current?.art ? { ...s.current.art, ms: s.current.t * TICK_MS } : null;
  return { flagsOf: (k: string) => shownFlags(s, k), playing, cued: cuedArtView(s), held: heldArtView(s), clockMs: s.tick * TICK_MS, tiltOf: (k: string) => tiltOf(data, s, k) };
}

/**
 * 캐릭터마다 이번 프레임에 그린 그림 칸(설계 2-1절, #736). 점이 그 사람의 불투명 칸이고, 그 위에 나중에 그린 것
 * (물건 `front` 층·발 y가 `sortY` 이하일 때 앞판, `drawOrder`에서 뒤에 오는 사람)의 불투명 칸이 없을 때만 참이다.
 * 나중에 그린 사람에는 지금 캐릭터도 들어간다: 내 몸 뒤에 깔린 동료 칸은 보이지 않으니 동료가 아니다(#738 Theo 리뷰).
 * 시트 알파가 없으면(엔진이 아직 못 읽음, 노드 기본) 빈 표 → 얼굴 상자만(11/19 규칙).
 */
export function drawnBodies(data: SceneData, s: SceneState): Partial<Record<CharacterId, DrawnBody>> {
  const out: Partial<Record<CharacterId, DrawnBody>> = {};
  if (!data.alpha) return out;
  const order = drawOrder(data, s);
  const all = order.map((id) => placed(data, s, id));
  const objects = data.art ? data.alpha.objects() : null;
  const covers = objects ? coverFrames(data.art!, sceneArtView(data, s)) : null;
  order.forEach((id, k) => {
    const me = all[k];
    if (!me) return;
    const later = all.slice(k + 1).filter((p): p is Placed => p !== null);
    // 그리기(main.ts render)는 사람을 발 y 반올림으로, 앞판을 sortY + 0.5로 섞는다. 매달린 사람은 늘 맨 앞.
    const footY = isHanging(data, s, id) ? Infinity : Math.round(s.walkers[id].y);
    const over = covers ? [...covers.front, ...covers.overlays.filter((o) => o.sortY + 0.5 > footY).map((o) => o.frame)] : [];
    out[id] = {
      box: spriteBox(me.meta, me.x, me.y, me.facing),
      at: (p: Point): boolean => {
        const px = Math.floor(p.x);
        const py = Math.floor(p.y);
        if (!placedOpaque(me, px, py)) return false;
        if (later.some((o) => placedOpaque(o, px, py))) return false;
        return !over.some((f) => frameOpaqueAt(data.art!, objects!, f, px, py));
      },
    };
  });
  return out;
}

export function tapContext(data: SceneData, s: SceneState): TapContext {
  return { screen: data.screen, puzzle: s.puzzle, bodies: bodies(data, s), faces: faces(data, s), drawn: drawnBodies(data, s), order: drawOrder(data, s) };
}

function pickText(text: string | string[], count: number): string {
  if (!Array.isArray(text)) return text;
  return text[Math.min(count, text.length) - 1] ?? '';
}

/**
 * n번째 anim 변형(#765 2/2, ADR-0761 H5 "두 번째부터는 짧은 판"). 대사 변형(`pickText`)과 같은 발동 횟수 `n`을 쓴다.
 * 그림 쪽(캐릭터 시트 `anims`, 물건 메타 `anims['대상.이름']`)에 `이름#k`(2 ≤ k ≤ n)가 있으면 가장 큰 k, 없으면 그대로.
 * 화면 데이터는 안 바꾼다: 짧은 판은 그림이 붙는 대로 생기고, 없으면 지금과 같다. 퍼즐 상태·세이브·BFS와 무관한 UI 상태다.
 */
export function nthAnim(data: SceneData, target: string, name: string, n: number): string {
  const sheet = data.sprites?.[target]?.anims;
  const art = data.art?.anims;
  for (let k = n; k >= 2; k--) {
    const v = `${name}#${k}`;
    if (sheet?.[v] || art?.[`${target}.${v}`]) return v;
  }
  return name;
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
 * (a) 그 물건(`ids` 포함, 효과 자리면 그 자리를 바꾸는 효과 anim)의 anim이 시작될 때, (b) 없으면 첫 anim이 끝날 때 바꾼다. anim이 하나도 없으면 바로 바꾼다.
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
    // 효과 자리(11-3절)는 ID가 없다. 메타에서 그 자리를 바꾸는 효과 anim(`object` = 자리 키)이 자기 anim이다.
    const own = events.findIndex((e) => e.type === 'anim' && (o.ids.includes(e.target) || art.anims[`${e.target}.${e.name}`]?.object === o.key));
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
/**
 * 높은 대상 앞에 섰을 때 몸 상자가 대상 그림을 이 비율보다 많이 가리면 앞(아래)으로 내려선다(#575).
 * 화면 1 `long_johns`는 위쪽 바닥(발 y 200)에서 약 3할을 가려서 그대로 둔다. 화면 2 오리(14×9)는 몸에 다 덮인다.
 */
const HIDE_MAX = 0.5;
/**
 * 내려설 때 몸 상자 위 끝과 대상 그림 아래 끝 사이 세로 틈(#575, PR #577·#580 Luna 리뷰). 몸 상자 위 끝을 그림 아래 끝에서
 * 4px 떼면 실제 머리 그림과는 약 6px(화면 2 오리: 물 2, 물가 테두리 선 1, 돌 3)이 남는다(묵직이 머리 그림 위 끝은 발 y − 59로
 * 상자보다 낮다). 0이면 머리 외곽선이 물가 테두리 선에 붙어 "머리에 올라탄 오리"로 읽힌다.
 */
const CLEAR_GAP = 4;
/**
 * 머리(얼굴 상자 24px)보다 작은 높은 대상 그림(#585). 화면 2 오리(16×11)·자명종(20×18). 이런 그림은 반만 가려도,
 * 머리 위 끝에 붙기만 해도 "머리에 올라탄 것"으로 읽혀서 `HIDE_MAX`와 상관없이 내려선다. 큰 그림(화면 1 `long_johns` 34×44,
 * 화면 2 관리인 46×38)은 몸이 앞에 선 것으로 읽혀서 그대로 둔다.
 */
const SMALL_ART = 24;
/** 작은 그림 아래 끝과 얼굴 그림 위 끝 사이가 이보다 좁으면 붙어 보인다(#585 완료 조건, PR #577 Luna 리뷰의 3px). */
const TOUCH_GAP = 3;

/** 얼굴 상자가 그림과 가로로 겹치고, 그림 아래 끝에서 `TOUCH_GAP`보다 가깝거나 그림 위로 올라와 있다(#585). */
function headTouches(art: HitBox, head: HitBox): boolean {
  const w = Math.min(art.left + art.width, head.left + head.width) - Math.max(art.left, head.left);
  return w > 0 && head.top - (art.top + art.height) < TOUCH_GAP;
}

/** 그림 상자 넓이 중 몸 상자에 덮인 비율(0~1). */
function hiddenShare(art: HitBox, body: HitBox): number {
  const w = Math.min(art.left + art.width, body.left + body.width) - Math.max(art.left, body.left);
  const h = Math.min(art.top + art.height, body.top + body.height) - Math.max(art.top, body.top);
  return w <= 0 || h <= 0 ? 0 : (w * h) / (art.width * art.height);
}

/** 행동 대상의 상자: 핫스팟(지금 `variants` 반영) 또는 상자 있는 서는 자리. 캐릭터·상자 없는 대상은 null. */
function targetBox(screen: ScreenData, puzzle: PuzzleState, id: string): HitBox | null {
  const hs = hotspotBox(screen, puzzle, id);
  if (hs) return hs;
  const b = screen.spots[id]?.box;
  return b ? { left: b[0], top: b[1], width: b[2], height: b[3] } : null;
}

/**
 * 설계 5-1절 "대상 앞까지 걷기"의 설 곳(발밑 x)과 도착 뒤 볼 방향. `puzzle`은 행동 **전** 상태다.
 * `move`이거나 상자 없는 대상(캐릭터)이면 null. 바닥이 아니어도 판 끝(`board` 자리)에서 걷지 않는 행동이면 돌아서기만 준다(#419).
 * 그 밖의 자리(`hold` 고리 등)는 null.
 * 원거리 동사(`squeak`·`look`)와 대상 `approach`가 `stay`인 동사는 걷지 않는다(x = 지금 x) — 대상 쪽으로 돌아서기만 한다.
 * `face`가 null이면 대상 가운데가 설 곳과 ±2px 안이라 방향을 바꾸지 않는다.
 * - `stretch`: 높은 대상이면 `reachPoint` x, 없으면 상자 가운데 x. 바닥 대상이면 아래 줄과 같다(땅의 까치에 겹쳐 서지 않게, PR #221 Luna).
 * - `stomp`·`hand`·`item`: 높은 대상(상자 아래쪽이 `WALK_AREA.top` 위)은 상자 가운데 x, 바닥 대상은 가까운 쪽 가장자리 옆
 *   (대상을 바라본 몸 상자 `characterHitBox`가 대상 상자와 가로로 2px 떨어지는 가장 가까운 x).
 * - 높은 대상의 발 y는 지금 y다. 그 자리에서 몸이 대상 그림을 반 넘게 가리거나 작은 그림에 머리가 붙으면 앞(아래)으로 내려선다
 *   (#575·#585, `clearOf`). 바닥 대상은 지금 y.
 * 설 곳은 걷기 영역 안으로 자른다. `step`·BFS와 무관한 연출 계산이다(퍼즐 상태를 바꾸지 않는다).
 */
export function approachPoint(data: SceneData, puzzle: PuzzleState, action: Action, from: Point): { x: number; y: number; face: Facing | null } | null {
  const walks = APPROACH_VERBS.has(action.verb);
  if (!walks && !TURN_VERBS.has(action.verb)) return null;
  const at = puzzle.at[action.char] ?? '';
  const stays = !walks || approachFor(data.screen, puzzle, action.char, action.target, action.verb) === 'stay';
  // 판 끝(`board` 자리)에서 걷지 않는 행동은 그 자리에서 돌아서기만 한다(#419, 1-5-2절 "판 위에서 `squeak`·`look`").
  if (!isFree(data, at) && !(stays && data.screen.spots[at]?.board)) return null;
  const box = targetBox(data.screen, puzzle, action.target);
  if (!box) return null;
  const mid = box.left + box.width / 2;
  let x: number;
  const rp = data.screen.hotspots[action.target]?.reachPoint;
  const high = box.top + box.height <= WALK_AREA.top;
  if (stays) x = from.x;
  else if (action.verb === 'stretch' && rp) x = rp[0];
  else if (high) x = mid;
  else {
    const { dx, width } = characterDef(action.char).hit;
    // 오른쪽에서 오면 왼쪽을 본다: 몸 왼쪽 = x - (dx + width). 왼쪽에서 오면 오른쪽을 본다: 몸 오른쪽 = x + dx + width.
    x = from.x >= mid ? box.left + box.width + APPROACH_GAP + dx + width : box.left - APPROACH_GAP - dx - width;
  }
  x = clampToArea({ x, y: from.y }, WALK_AREA).x;
  const face: Facing | null = Math.abs(mid - x) <= APPROACH_SLOP ? null : mid > x ? 1 : -1;
  const y = stays || !high ? from.y : clearOf(data, puzzle, action, box, x, from.y, face);
  return { x, y, face };
}

/**
 * 높은 대상 앞 발 y(#575). 대상 지금 그림(시트 없으면 핫스팟 상자)을 몸 상자가 `HIDE_MAX`보다 많이 가리거나,
 * 작은 그림(`SMALL_ART`)에 얼굴이 붙으면(`headTouches`, #585) 몸 위 끝이 그림 아래 끝보다 `CLEAR_GAP` 아래가 되는 y까지
 * 앞(아래)으로 내려선다. 걷기 영역 아래 끝에서 멈춘다. 위로는 가지 않는다.
 * 방향이 정해지지 않았으면(가운데에 섬) 두 방향 중 더 가리는 쪽으로 본다.
 */
function clearOf(data: SceneData, puzzle: PuzzleState, action: Action, box: HitBox, x: number, y: number, face: Facing | null): number {
  const art = (data.art && restingBox(data.art, action.target, puzzle.flags)) ?? box;
  const def = characterDef(action.char);
  const faces: Facing[] = face === null ? [1, -1] : [face];
  const hidden = Math.max(...faces.map((f) => hiddenShare(art, characterHitBox(def, x, y, f))));
  const touches = art.height <= SMALL_ART && faces.some((f) => headTouches(art, characterFaceBox(def, x, y, f)));
  if (hidden <= HIDE_MAX && !touches) return y;
  return Math.max(y, Math.min(WALK_AREA.bottom, art.top + art.height - def.hit.dy + CLEAR_GAP));
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

/**
 * 행동하는 캐릭터가 바닥이 아닌 서는 자리에서 바닥(`free` 자리)으로 떠나는 `walk`로 `step` 결과가 시작하면 그 이벤트와,
 * 걷기를 이어 갈 바닥 점(판 끝이면 그 `board`, 아니면 null = 지금 x·바닥 자리 y). 대상의 `approach`가 바닥이라 `step`이
 * 먼저 바닥으로 내려보낸 경우다(1-5-2절 내려서기, 화면 2 `fountain_seat` #517). `hold` 자리는 `releasePoint`가 따로 있어 뺀다. 아니면 null.
 */
function stepDownWalk(
  data: SceneData,
  events: readonly PuzzleEvent[],
  char: CharacterId,
): { walk: Extract<PuzzleEvent, { type: 'walk' }>; board: readonly [number, number] | null } | null {
  const first = events[0];
  if (first?.type !== 'walk' || first.char !== char || !isFree(data, first.to) || isFree(data, first.from)) return null;
  const spot = data.screen.spots[first.from];
  if (!spot || spot.hold) return null;
  return { walk: first, board: spot.board ?? null };
}

/**
 * `stomp`으로 `board`가 있는 자리(판 끝)를 누르면 설 곳은 그 바닥 점이다(x·y 둘 다, `magpie_nest.md` 1-6-2절 ①·10번, #417 리뷰 (e)).
 * 그 끝(서는 자리)을 본다. 아니면 null(→ 5-1절 `approachPoint`).
 */
function stompBoard(data: SceneData, action: Action): { p: Point; face: Facing | null } | null {
  const spot = action.verb === 'stomp' ? data.screen.spots[action.target] : undefined;
  if (!spot?.board) return null;
  const [x, y] = spot.board;
  return { p: { x, y }, face: spot.x === x ? null : spot.x > x ? 1 : -1 };
}

/** 이 캐릭터 시트 자세에 공중 칸(`air`)이 있으면 그 자세(#414). */
function airAnim(data: SceneData, id: string, name: string): (SpriteAnim & { ms: number[]; air: [number, number] }) | null {
  const a = data.sprites?.[id]?.anims[name];
  return a && 'ms' in a && a.air ? (a as SpriteAnim & { ms: number[]; air: [number, number] }) : null;
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
  const leaving = stepDownWalk(data, events, action.char);
  const sb = stompBoard(data, action);
  // 판 끝에 뛰어오르는 연출(#414): 이 캐릭터의 `air` 칸 자세. 그 끝에 이미 서 있으면 퍼즐의 내려서기는 그리지 않는다(1-6-2절 "제자리").
  const jump = sb ? events.find((e) => e.type === 'anim' && e.target === action.char && airAnim(data, action.char, e.name) !== null) : undefined;
  const stay = leaving !== null && jump !== undefined && leaving.walk.from === action.target ? leaving.walk : null;
  let downFace: Facing | null = null;
  if (leaving && !stay && sb) {
    // 다른 끝에서 판 끝을 쿵: 그 끝에서 내려선 뒤 누른 끝의 바닥 점까지 걷는다(1-6-2절 "다른 끝에 서 있을 때").
    s.floorTo[action.char] = sb.p;
    downFace = sb.face;
  } else if (leaving && !stay) {
    // 판 끝에서 바닥으로 내려서는 `walk`로 시작하면(#416): 바닥 점에 내려선 뒤 그 걷기의 끝을 5-1절 설 곳으로 잇는다(1-5-2절
    // "내려서기 → 대상 앞까지 걷기"). 설 곳·방향은 바닥 점에 선 사람 기준이다. 퍼즐 상태와 이벤트 순서는 그대로다.
    // 판이 없는 자리(`fountain_seat`)는 지금 x·바닥 자리 y에서 걷기 시작한 것으로 본다(#517: 안 그러면 바로 아래로 내려와 그 자리에서 행동한다).
    const [bx, by] = leaving.board ?? [w.x, spotPoint(data, leaving.walk.to).y];
    const down = approachPoint(data, { ...prev, at: { ...prev.at, [action.char]: leaving.walk.to } }, action, { x: bx, y: by });
    if (down) {
      s.floorTo[action.char] = { x: down.x, y: down.y };
      downFace = down.face;
    }
  }
  const fromFloor = !(first?.type === 'walk' && first.char === action.char);
  if (fromFloor && sb && isFree(data, prev.at[action.char] ?? '') && (w.x !== sb.p.x || w.y !== sb.p.y)) {
    // 바닥에서 판 끝을 쿵: 그 끝의 바닥 점(x·y)까지 걸어가 그 끝을 본다(1-6-2절 ①). 끝이 차 있어도(10번) 같은 점에서 멈춘다.
    const spot = prev.at[action.char]!;
    s.floorTo[action.char] = sb.p;
    s.queue.push(sb.face === null ? { type: 'walk', char: action.char, from: spot, to: spot } : { type: 'walk', char: action.char, from: spot, to: spot, face: sb.face });
  }
  const ap = !fromFloor || sb ? null : approachPoint(data, prev, action, w);
  if (sb && fromFloor && sb.face !== null && w.x === sb.p.x && w.y === sb.p.y) w.facing = sb.face;
  if (ap && (Math.abs(ap.x - w.x) > APPROACH_SLOP || ap.y !== w.y)) {
    // `floor`→`floor` 걷기. `walk` 이벤트와 똑같이 busy이고 탭으로 건너뛴다(5절 예외 둘). 설 점은 `floorPoint`가 쓴다.
    // 높은 대상 그림을 몸이 가리면 앞으로 내려선다(#575, `clearOf`).
    const spot = prev.at[action.char]!;
    s.floorTo[action.char] = { x: ap.x, y: ap.y };
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
  if (to) s.floorTo[action.char] = floorTarget(data, to);
  // 장대 대상 점: `reachPoint`, 없으면 대상 상자 아래 끝 가운데(#284: 고리 뻗기 실패는 집게가 고리 "바로 아래"에서 멈춘다).
  const rp = data.screen.hotspots[action.target]?.reachPoint;
  const tb = rp ? null : targetBox(data.screen, prev, action.target);
  if (rp) s.reach[action.char] = { x: rp[0], y: rp[1] };
  else if (tb) s.reach[action.char] = { x: tb.left + tb.width / 2, y: tb.top + tb.height };
  else delete s.reach[action.char];
  const n = bump(s, variantKey(r.source, r.ruleId, action));
  for (const ev of events) {
    if (ev.type === 'say') s.queue.push({ ...ev, text: pickText(ev.text, n) });
    else if (ev.type === 'fx') s.queue.push({ ...ev, by: action.char });
    else if (ev === stay) s.queue.push({ ...ev, stay: true });
    else if (ev === jump && ev.type === 'anim') s.queue.push({ ...ev, onto: action.target });
    else if (ev.type === 'anim') s.queue.push({ ...ev, name: nthAnim(data, ev.target, ev.name, n) });
    else s.queue.push(ev === leaving?.walk && downFace !== null ? { ...ev, face: downFace } : ev);
  }
  const hint = hintEvent(data, s, r.source, action);
  if (hint) s.queue.push(hint);
  if (events.some((e) => e.type === 'clear')) s.clearAt = s.tick;
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
 * 같은 착지 점(`releasePoint`)에 두 번째 사람이 떨어질 때 벌리는 px(#357 2번). 먼저 있던 사람은 왼쪽으로, 새로 온 사람은
 * 오른쪽으로 이만큼 옮긴다(둘 사이 12px). 화면 1 바구니(x 144~176) 안에 두 사람 발이 다 들어가는 값이다.
 */
export const RELEASE_SPREAD = 6;

/**
 * 순간 배치될 때 설 점. `hold` 자리(또는 `via`로 거친 자리)에서 그 `releaseTo`로 떨어지면 `releasePoint`(바구니 안 착지 점),
 * 아니면 `destination`. 두 사람이 같은 점에 떨어지면 포개지되(형식 기록 6절 2번) 좌우로 조금 벌린다(#357 2번):
 * 그 점에 멈춰 선 사람이 이미 있으면 그 사람을 `RELEASE_SPREAD`만큼 왼쪽으로, 새로 온 사람을 오른쪽으로 놓는다.
 * 그림 전용이다(퍼즐 자리는 둘 다 같은 바닥 자리).
 */
function landing(data: SceneData, s: SceneState, char: CharacterId, from: string, to: string): Point {
  const h = data.screen.spots[from];
  if (h?.hold === true && h.releasePoint && h.releaseTo === to) {
    delete s.floorTo[char];
    const [x, y] = h.releasePoint;
    const there = CHARACTERS.find((c) => {
      const w = s.walkers[c.id];
      return c.id !== char && w.target === null && w.x === x && w.y === y;
    });
    if (!there) return { x, y };
    s.walkers[there.id].x = x - RELEASE_SPREAD;
    return { x: x + RELEASE_SPREAD, y };
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

/** 지금 점에서 구간 끝점들을 차례로 이은 길이(깡충도 직선으로 센다). 긴 걷기 안내(#38)용이다. */
function legsLength(from: Point, legs: readonly WalkLeg[]): number {
  let at = from;
  let d = 0;
  for (const leg of legs) {
    d += Math.hypot(leg.to.x - at.x, leg.to.y - at.y);
    at = leg.to;
  }
  return d;
}

/**
 * 바닥 걷기 건너뛰기(#38, `ui-interaction.md` 5-2-1절): 걷는 중 자른 탭 점이 지금 목표에서 이 거리(내부 px, 유클리드) 안이면 "같은 점"이다.
 * 휴대폰 가로에서 손가락 폭 약 24px의 반지름.
 */
export const WALK_SKIP_SAME = 12;

/** 이번에 시작한 걷기를 꺼내고 지운다(#38 긴 걷기 안내). 없으면 null. */
export function takeWalkStart(s: SceneState): { char: CharacterId; dist: number } | null {
  const w = s.walkStart;
  s.walkStart = null;
  return w;
}

/** 그 캐릭터가 아직 걷는 중인가: 바닥 걷기, 자동 걷기의 걷기·깡충 구간 모두(#38 안내를 걷기가 끝날 때 지운다). */
export function charWalking(s: SceneState, char: CharacterId): boolean {
  const cur = s.current?.ev;
  return s.walkers[char].target !== null || s.hops[char] !== undefined || (cur?.type === 'walk' && cur.char === char);
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
  else if (ev.type === 'faint') {
    s.held = {};
    s.heldArt = {};
  }
  switch (ev.type) {
    case 'walk': {
      if (ev.stay) {
        // 제자리 쿵(1-6-2절): 퍼즐은 먼저 바닥으로 내려섰지만 몸은 판 위에 그대로 둔다. 내려서기는 쿵 뒤 ⑦이다.
        const w = s.walkers[ev.char];
        s.spotOf[ev.char] = ev.to;
        return { ev, t: 0, duration: null, seq, legs: [], end: { x: w.x, y: w.y } };
      }
      const p = destination(data, s, ev.char, ev.to);
      s.spotOf[ev.char] = ev.to;
      // 판 끝 ↔ 끝은 판 위로 걷는다(깡충 없음). 계속 탄 채라 자리만 바꾼다(어느 쪽 무게인지는 지금 x로 센다).
      if (s.riding[ev.char] !== undefined && hasBoard(data, ev.to)) s.riding[ev.char] = ev.to;
      const playing: Playing = { ev, t: 0, duration: null, seq, legs: walkLegs(data, ev.from, ev.to, p), end: p };
      if (!s.intro) s.walkStart = { char: ev.char, dist: legsLength(s.walkers[ev.char], playing.legs!) };
      nextLeg(data, s, playing);
      return playing;
    }
    case 'release':
      teleport(s.walkers[ev.char], landing(data, s, ev.char, ev.from, ev.to));
      s.spotOf[ev.char] = ev.to;
      setRiding(data, s, ev.char, ev.to);
      s.landed[ev.char] = seq;
      return { ev, t: 0, duration: TIMING.release, seq };
    case 'place':
      teleport(s.walkers[ev.char], landing(data, s, ev.char, ev.via ?? ev.from, ev.to));
      s.spotOf[ev.char] = ev.to;
      setRiding(data, s, ev.char, ev.to);
      s.landed[ev.char] = seq;
      return { ev, t: 0, duration: TIMING.place, seq };
    case 'faint':
      for (const c of CHARACTERS) {
        // 대기열 밖 깡충(쿵 남은 칸·⑦·튕겨 나가기) 도중이면 그 깡충이 끝날 바닥 점에 먼저 세운다(판 위 좌표로 바닥에 남지 않게).
        const h = s.hops[c.id];
        if (h) teleport(s.walkers[c.id], h.after ?? h.to);
        teleport(s.walkers[c.id], faintPoint(data, s, c.id, ev.to[c.id]));
        delete s.hops[c.id];
        s.spotOf[c.id] = ev.to[c.id];
        setRiding(data, s, c.id, ev.to[c.id]);
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
      const char = isCharacter(ev.target) ? ev.target : null;
      const cueTicks = (lead: number): number[] => cueMs(data.sprites?.[ev.target], ev.name).map((ms) => ceilTicks(ms) + lead);
      // 판 끝에 뛰어올라 쿵(#414 1-6-2·1-6-4절): 이 이벤트는 착지 칸이 시작되는 틱에 끝나서 대기열이 U6로 넘어간다.
      // 남은 칸(쿵·여운)과 ⑦ 내려서기는 깡충(`hops`)으로 대기열 밖에서 돈다.
      const jump = char && ev.onto ? stompHop(data, s, char, ev.name, ev.onto) : null;
      if (char && jump) {
        s.hops[char] = jump;
        const p: Playing = { ev, t: 0, duration: jump.crouch + jump.air, seq };
        const cues = cueTicks(0);
        if (cues.length > 0) p.cues = cues;
        return p;
      }
      // 15번(1-6-5절): 그림으로만 판에 탄 사람(쿵 남은 칸)에게 다음 캐릭터 연출이 오면 판이 튕겨 낸다. 그 연출은 착지하면서 시작한다.
      const eject = char ? ejectHop(data, s, char) : null;
      // 캐릭터 anim이 시작될 때 퍼즐 자리가 이미 판 끝이 아니면 판에서 빠진다(발사 `launch_to_hook`, 1-5-4절). 이름은 보지 않는다.
      // 몸은 그 틱의 판 높이에 둔 채 연출한다(1-7-8절: 들린 판에 발이 묻히지 않게). 다음에 움직일 때 푼다.
      if (char && s.riding[char] !== undefined && !hasBoard(data, s.puzzle.at[char] ?? '')) {
        const w = s.walkers[char];
        s.pinDrop[char] = { x: w.x, y: w.y, drop: boardDrop(data, s, char) };
        delete s.riding[char];
      }
      if (char && eject) {
        s.hops[char] = eject;
        const lead = eject.air;
        const p: Playing = { ev, t: 0, duration: lead + (charAnimTicks(data, char, ev.name) ?? TIMING.anim), seq, lead };
        const cues = cueTicks(lead);
        if (cues.length > 0) p.cues = cues;
        return p;
      }
      // 물건 anim은 갈래를 anim 직전 보이는 플래그로 고르고(4-1절), 그 길이가 busy 길이다(5절). 없으면 임시 길이.
      const obj = data.art?.objects.find((o) => o.ids.includes(ev.target));
      const art = data.art && obj ? animOf(data.art, ev.target, ev.name, shownFlags(s, obj.key)) : null;
      if (art) {
        // 같은 물건의 다음 anim이 붙든 칸을 바꾼다(13절). 끝나면 이 anim이 `hold`인지에 따라 다시 붙들거나 멈춘 모습이다.
        delete s.heldArt[art.object];
        return { ev, t: 0, duration: animTicks(art.anim), seq, art };
      }
      const p: Playing = { ev, t: 0, duration: charAnimTicks(data, ev.target, ev.name) ?? TIMING.anim, seq };
      const cues = cueTicks(0);
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
/** 시트 ms → 틱(올림). 물건 anim 길이(`animTicks`)·칸 신호와 같은 셈이라 착지 칸 시작이 `cue` 틱과 맞는다. */
const ceilTicks = (ms: number): number => Math.ceil(ms / TICK_MS - 1e-9);

/**
 * 판 끝에 뛰어오르는 쿵(#414, `magpie_nest.md` 1-6-2절). 시트 자세의 `air` 칸 앞이 웅크림, `air` 칸이 공중, 그 뒤가 착지 칸부터 끝까지다.
 * 바닥 점에서 뛰면 `HOP.stomp.h`, 이미 그 끝에 타 있으면 제자리에서 `hOnBoard`로 뛴다(공중 동안도 탄 채, 1-7-6절). 착지 목표는 그 끝 서는 자리이고,
 * 발 높이는 올라서기와 같이 착지 전 기울기를 향한다(1-5-4절 #406). 자세에 `air`가 없거나 그 자리에 `board`가 없으면 null(그냥 연출).
 */
function stompHop(data: SceneData, s: SceneState, id: CharacterId, name: string, onto: string): Hop | null {
  const a = airAnim(data, id, name);
  const board = data.screen.spots[onto]?.board;
  if (!a || !board) return null;
  const upTo = (k: number): number => ceilTicks(a.ms.slice(0, k).reduce((x, y) => x + y, 0));
  const crouch = upTo(a.air[0]);
  const landAt = upTo(a.air[1] + 1);
  const w = s.walkers[id];
  const onBoard = s.riding[id] === onto;
  return {
    from: { x: w.x, y: w.y },
    to: spotPoint(data, onto),
    t: 0,
    crouch,
    air: landAt - crouch,
    land: upTo(a.ms.length) - landAt,
    h: onBoard ? HOP.stomp.hOnBoard : HOP.stomp.h,
    up: true,
    spot: onto,
    fromDrop: 0,
    kind: 'stomp',
    anim: name,
    onBoard,
    after: { x: board[0], y: board[1] },
  };
}

/** 시트 자세 `name`의 k번째 칸이 시작되는 ms. 시트에 그 자세(ms)나 칸이 없으면 null. */
function frameStartMs(data: SceneData, id: string, name: string, k: number): number | null {
  const a = data.sprites?.[id]?.anims[name];
  if (!a || !('ms' in a) || k >= a.ms.length) return null;
  return a.ms.slice(0, k).reduce((x, y) => x + y, 0);
}

/** 튕겨 나가기·들썩의 공중 칸: `common.flatten` 2번(뿅, 놀란 눈, 1-6-5·1-6-6절). */
const SURPRISE = { name: 'common.flatten', frame: 2 } as const;

/**
 * 15번 튕겨 나가기(1-6-5절). 쿵 남은 칸으로 판에 그림으로만 탄 사람에게 캐릭터 연출이 오면, 판 위 자리에서 바닥 점 바깥
 * (`board.x + dx`, y `HOP.eject.y`)으로 H 24 공중을 돈 뒤 그 연출을 처음부터 시작한다. ⑦ 내려서기는 없다. 해당 없으면 null.
 * 출발 발 높이는 그 틱의 판 높이다(판이 비어 수평으로 돌아온다).
 * 공중 칸은 뒤에 올 연출 이름과 상관없이 늘 `SURPRISE`다(들썩과 같다). 15번이 `common.flatten_stay`를 써도 뿅이 남는다(#433).
 */
function ejectHop(data: SceneData, s: SceneState, id: CharacterId): Hop | null {
  const h = s.hops[id];
  if (h?.kind !== 'stomp' || h.t < h.crouch + h.air || !h.after) return null;
  const w = s.walkers[id];
  delete s.riding[id];
  const o = tiltObject(data, h.spot);
  const fromDrop = o ? tiltDrop(o.tilt, tiltOf(data, s, o.key), w.x) : 0;
  const ms = frameStartMs(data, id, SURPRISE.name, SURPRISE.frame);
  const hop: Hop = {
    from: { x: w.x, y: w.y },
    to: { x: h.after.x + HOP.eject.dx, y: HOP.eject.y },
    t: 0,
    crouch: 0,
    air: msTicks(HOP.eject.airMs),
    land: 0,
    h: HOP.eject.h,
    up: false,
    spot: h.spot,
    fromDrop,
    kind: 'eject',
  };
  if (ms !== null) Object.assign(hop, { anim: SURPRISE.name, airMs: ms });
  return hop;
}

/**
 * 무게 `HOP.jostle.weight` 이상인 사람이 걸어서 `spot` 끝에 올라선 착지 틱(1-6-6절)이나 걸어서 내려서며 뜨는 틱(1-7-5절)에,
 * 같은 판 반대쪽 끝에 탄 사람의 들썩.
 * 이름이 아니라 기울기 무게로 본다(#417 리뷰 (c)). 탄 채로 제자리에서 뜨니 발은 판을 따른다. 퍼즐 상태는 안 바뀐다.
 */
function jostleHops(data: SceneData, s: SceneState, id: CharacterId, spot: string): [CharacterId, Hop][] {
  const o = tiltObject(data, spot);
  if (!o || (o.tilt.weight[id] ?? 1) < HOP.jostle.weight) return [];
  const out: [CharacterId, Hop][] = [];
  for (const c of CHARACTERS) {
    const other = s.riding[c.id];
    if (c.id === id || other === undefined || other === spot || !o.ids.includes(other) || s.hops[c.id]) continue;
    const w = s.walkers[c.id];
    const ms = frameStartMs(data, c.id, SURPRISE.name, SURPRISE.frame);
    const hop: Hop = {
      from: { x: w.x, y: w.y },
      to: { x: w.x, y: w.y },
      t: 0,
      crouch: 0,
      air: msTicks(HOP.jostle.airMs),
      land: msTicks(HOP.jostle.landMs),
      h: HOP.jostle.h,
      up: true,
      spot: other,
      fromDrop: 0,
      kind: 'jostle',
    };
    if (ms !== null) Object.assign(hop, { anim: SURPRISE.name, airMs: ms });
    out.push([c.id, hop]);
  }
  return out;
}

/** 깡충 시간(틱). 웅크림·공중은 시트 `step_up` `ms`가 있으면 그 값(ADR-0007: 지속 시간은 시트 데이터), 없으면 `HOP` 표. */
function hopTiming(data: SceneData, id: CharacterId, up: boolean): Pick<Hop, 'crouch' | 'air' | 'land' | 'h' | 'up'> {
  const land = msTicks(HOP.landMs);
  if (!up) return { crouch: 0, air: msTicks(HOP.down.airMs), land, h: HOP.down.h, up };
  const def = HOP.up[id];
  const a = data.sprites?.[id]?.anims.step_up;
  const ms = a && 'ms' in a && a.ms.length >= 2 ? a.ms : [def.crouchMs, def.airMs];
  return { crouch: msTicks(ms[0]!), air: msTicks(ms[1]!), land, h: def.h, up };
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

/**
 * 깡충을 한 틱 보낸다. 끝나면 `to`에 세우고 지운다. 쿵(`stomp`)이 끝나면 이어서 바닥 점으로 내려선다(1-6-2절 ⑦).
 * 이 틱에 새로 생긴 깡충(⑦, 들썩)은 다음 틱부터 센다(그 틱이 t=0).
 */
function tickHops(data: SceneData, s: SceneState): void {
  const born: [CharacterId, Hop][] = [];
  for (const c of CHARACTERS) {
    const h = s.hops[c.id];
    if (!h) continue;
    h.t += 1;
    const w = s.walkers[c.id];
    const landed = h.t >= h.crouch + h.air;
    // 착지 칸이 시작되는 틱에 판에 탄다 → 같은 틱에 기울기·이미 서 있던 사람 발이 새 값으로 간다(1-5-4절).
    // 걸어서 올라선 사람이 무거우면 같은 틱에 반대쪽 사람이 들썩한다(1-6-6절).
    if (h.up && landed && s.riding[c.id] !== h.spot) {
      s.riding[c.id] = h.spot;
      if (h.kind === undefined) born.push(...jostleHops(data, s, c.id, h.spot));
    }
    if (h.t >= h.crouch + h.air + h.land) {
      teleport(w, h.to);
      delete s.hops[c.id];
      if (h.after) {
        // ⑦ 내려서기(1-5-2절 그대로): 뜨는 틱에 판에서 빠지고, 바닥 점 쪽을 본다.
        const fromDrop = boardDrop(data, s, c.id);
        delete s.riding[c.id];
        if (h.after.x !== w.x) w.facing = h.after.x > w.x ? 1 : -1;
        born.push([c.id, { from: { x: w.x, y: w.y }, to: { ...h.after }, t: 0, ...hopTiming(data, c.id, false), spot: h.spot, fromDrop }]);
      }
    } else {
      const q = hopPoint(h);
      w.x = q.x;
      w.y = q.y;
    }
  }
  for (const [id, h] of born) s.hops[id] = h;
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
      // 올라서기는 도착 자리, 내려서기는 떠나는 자리가 판 끝이다. 내려서기는 뜨는 틱에 판에서 빠진다(1-5-4절).
      const spot = leg.up ? p.ev.to : p.ev.from;
      const fromDrop = leg.up ? 0 : boardDrop(data, s, id);
      s.hops[id] = { from: { x: w.x, y: w.y }, to: { ...leg.to }, t: 0, ...hopTiming(data, id, leg.up), spot, fromDrop };
      if (!leg.up) {
        delete s.riding[id];
        // 무거운 사람이 내려서며 뜨면 판이 반대쪽을 떨어뜨린다 → 그 끝 사람이 들썩(1-7-5절). 같은 틱에 생겨 다음 틱부터 센다.
        for (const [other, hop] of jostleHops(data, s, id, spot)) s.hops[other] = hop;
      }
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

/**
 * 캐릭터 대상 연출이 끝나면 마지막 장을 붙든다(형식 기록 5절). 물건 anim은 시트 갈래가 따로 멈춘 모습을 정한다.
 * 판 끝 쿵은 착지 칸에서 이벤트가 끝나도 남은 칸이 깡충으로 이어지니 붙들지 않는다(#414).
 */
function holdLast(s: SceneState, p: Playing): void {
  // 물건 anim은 `hold`가 있을 때만 붙든다(13절, #450). 없으면 지금처럼 멈춘 모습으로 돌아간다.
  if (p.art?.anim.hold) s.heldArt[p.art.object] = { anim: p.art.anim, since: s.tick - p.t };
  if (p.ev.type !== 'anim' || p.art || !isCharacter(p.ev.target)) return;
  if (s.hops[p.ev.target]?.kind === 'stomp') return;
  s.held[p.ev.target] = { name: p.ev.name, ms: p.t * TICK_MS };
}

/**
 * 칸 신호로 겹쳐 재생 중인 물건 anim(#507)을 그리기 쪽 모양(`SceneView.cued`)으로. ms는 그 anim 시작 뒤 지난 시간이다.
 * `current`의 물건 anim은 `SceneView.playing`이 따로 맡는다.
 */
export function cuedArtView(s: SceneState): Record<string, { anim: SceneAnim; ms: number }> {
  const out: Record<string, { anim: SceneAnim; ms: number }> = {};
  for (const o of s.overlays) if (o.art) out[o.art.object] = { anim: o.art.anim, ms: o.t * TICK_MS };
  return out;
}

/** 붙든 물건 anim(13절)을 그리기 쪽 모양(`SceneView.held`)으로. ms는 그 anim 시작 뒤 지난 시간이다. */
export function heldArtView(s: SceneState): Record<string, { anim: SceneAnim; ms: number }> {
  const out: Record<string, { anim: SceneAnim; ms: number }> = {};
  for (const [k, h] of Object.entries(s.heldArt)) out[k] = { anim: h.anim, ms: (s.tick - h.since) * TICK_MS };
  return out;
}

/** 깡충이 정한 자세(#414): 쿵은 시작부터 지난 시간, 튕겨 나가기·들썩 공중은 멈춘 칸, 들썩 착지는 서 있기 첫 칸. 걷기 깡충은 null(`step_up`). */
function hopPose(h: Hop): { name: string; ms: number } | null {
  if (h.anim === undefined) return null;
  if (h.kind === 'stomp') return { name: h.anim, ms: h.t * TICK_MS };
  if (h.t < h.crouch + h.air) return { name: h.anim, ms: h.airMs ?? 0 };
  return h.kind === 'jostle' ? { name: 'idle', ms: 0 } : null;
}

/** 이 캐릭터의 지금 연출: 깡충이 정한 자세, 재생 중인 연출(튕겨 나가기 뒤면 그만큼 늦게), 아니면 붙들고 있는 마지막 장. 없으면 null. */
export function charEvent(s: SceneState, id: CharacterId): { name: string; ms: number } | null {
  const h = s.hops[id];
  const own = h ? hopPose(h) : null;
  if (own) return own;
  const cur = s.current;
  if (cur?.ev.type === 'anim' && cur.ev.target === id) return { name: cur.ev.name, ms: Math.max(0, cur.t - (cur.lead ?? 0)) * TICK_MS };
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

/** 기울기 물건(형식 기록 12절) 중 이 자리를 맡은 것. 없으면 null. */
function tiltObject(data: SceneData, spot: string): (SceneObject & { tilt: NonNullable<SceneObject['tilt']> }) | null {
  const o = data.art?.objects.find((x) => x.tilt && x.ids.includes(spot));
  return o?.tilt ? (o as SceneObject & { tilt: NonNullable<SceneObject['tilt']> }) : null;
}

/**
 * 물건의 지금 기울기 d(`magpie_nest.md` 1-7-1절, 형식 기록 12절 개정 7). 그 물건 자리에 "보이게 탄"(`riding`) 사람만 센다.
 * 쉬는 판: 무게 차의 부호만 본다. 무게가 다르면 무거운 쪽 끝이 `rest`만큼 내려가 쉬고, 같으면 수평이다.
 * 어느 쪽 무게인지는 자리 이름이 아니라 지금 발 x가 축(`pivot`) 어느 쪽인가로 정한다(판 위 끝 ↔ 끝 걷기는 축을 넘는 틱에 바뀐다).
 * 그림 전용이다. 퍼즐 코어·규칙은 무게를 모른다.
 */
export function tiltOf(data: SceneData, s: SceneState, objectKey: string): number {
  const o = data.art?.objects.find((x) => x.key === objectKey);
  const t = o?.tilt;
  if (!o || !t) return 0;
  let sum = 0;
  for (const c of CHARACTERS) {
    const spot = s.riding[c.id];
    if (spot === undefined || !o.ids.includes(spot)) continue;
    const x = s.walkers[c.id].x;
    sum += (x > t.pivot ? 1 : x < t.pivot ? -1 : 0) * (t.weight[c.id] ?? 1);
  }
  return t.rest * Math.sign(sum);
}

/**
 * 판 위 발이 따를 널빤지 d. 그 물건 anim이 칸별 기울기(`tilt`, 형식 기록 12-5절)를 갖고 재생 중이면 지금 칸의 d,
 * 아니면 멈춘 기울기(`tiltOf`). 칸 고르기는 그리는 쪽(`sceneDraws`)과 같은 시계(`current.t`)라 판과 발이 같은 틱에 바뀐다.
 */
function boardTilt(data: SceneData, s: SceneState, objectKey: string): number {
  const p = s.current?.art;
  if (p && p.object === objectKey && p.anim.tilt) return p.anim.tilt[timedIndex(p.anim, s.current!.t * TICK_MS, false)]!;
  return tiltOf(data, s, objectKey);
}

/**
 * 판 위 발이 내려간 px(그리기 전용, 1-5-4절). 엔진은 캐릭터를 (x, y + 이 값)에 그리고, 히트 박스·말풍선 자리(`bodies`)도 따른다(1-7-9절).
 * 발 y 그리기 순서(`drawOrder`)는 걷기 좌표 그대로다.
 * - 탄 사람: 지금 기울기로 지금 x 열의 판 높이. U6처럼 칸별 기울기가 있는 물건 anim 동안은 그 칸의 판 높이(2026-11-19 개정).
 *   제자리 쿵 공중(1-7-6절)도 탄 사람이라 판 높이 위에서 포물선을 돈다.
 * - 올라서기 공중: **착지 전** 기울기의 도착 열 높이를 향해 0 → 그 값으로(#406). 착지 칸부터는 탄 사람이다.
 * - 내려서기 공중: 뜰 때 높이 → 0. 바닥 점은 판 앞 바닥이라 0이다.
 * - 발사 중(1-7-8절): 판에서 빠진 틱의 높이 그대로(`pinDrop`).
 */
export function boardDrop(data: SceneData, s: SceneState, id: CharacterId): number {
  const h = s.hops[id];
  const pin = s.pinDrop[id];
  const w = s.walkers[id];
  if (pin && !h && s.riding[id] === undefined && pin.x === w.x && pin.y === w.y) return pin.drop;
  if (h && !h.up) return h.t < h.air ? h.fromDrop * (1 - h.t / h.air) : 0;
  const spot = s.riding[id] ?? (h?.up ? h.spot : undefined);
  const o = spot === undefined ? null : tiltObject(data, spot);
  if (!o) return 0;
  if (s.riding[id] !== undefined) return tiltDrop(o.tilt, boardTilt(data, s, o.key), s.walkers[id].x);
  if (!h || h.t < h.crouch) return 0;
  return ((h.t - h.crouch) / h.air) * tiltDrop(o.tilt, tiltOf(data, s, o.key), h.to.x);
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
 * 그 뒤의 fx는 지금처럼 연출이 끝난 뒤 차례로 뜬다(둥지 삑의 메아리가 원래 삑보다 늦게 와야 한다, ADR-0003). 신호 하나 = 한 줄.
 * 맨 앞이 **물건 anim**이면 그 anim을 겹쳐 시작한다(#507: 장대가 자명종에 닿는 칸에 용수철이 튄다. 원인과 결과가 같은 프레임).
 * 그 밖(말풍선, 캐릭터 연출 등)이면 아무것도 띄우지 않는다. 순번(`seq`)은 대기열 순서 그대로다.
 */
function fireCue(data: SceneData, s: SceneState, p: Playing): void {
  while (p.cues && p.cues.length > 0 && p.t >= p.cues[0]!) {
    p.cues.shift();
    const next = s.queue[0];
    if (next?.type === 'fx' || (next?.type === 'anim' && !isCharacter(next.target))) s.overlays.push(start(data, s, s.queue.shift()!));
  }
  if (p.cues?.length === 0) delete p.cues;
}

/** 겹쳐 뜬 fx·물건 anim의 시간을 한 틱 보내고, 끝난 것을 내린다. 물건 anim은 `current`처럼 `hold`면 붙든다. */
function tickOverlays(s: SceneState): void {
  s.overlays = s.overlays.filter((o) => {
    o.t += 1;
    if (!finished(s, o)) return true;
    holdLast(s, o);
    commitShown(s, o.seq, 'end');
    return false;
  });
}

/** 지금 화면에 뜬 효과(fx)들: 대기열 차례로 도는 것 + 칸 신호로 겹쳐 뜬 것. 엔진은 이것만 그린다. */
export function activeFx(s: SceneState): { effect: string; target: string; t: number; by?: CharacterId }[] {
  const out: { effect: string; target: string; t: number; by?: CharacterId }[] = [];
  for (const p of [...s.overlays, s.current]) {
    if (p?.ev.type !== 'fx') continue;
    out.push(p.ev.by === undefined ? { effect: p.ev.effect, target: p.ev.target, t: p.t } : { effect: p.ev.effect, target: p.ev.target, t: p.t, by: p.ev.by });
  }
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
  tickHops(data, s);
  tickOverlays(s);
  // 이벤트를 시작한 틱이 그 이벤트의 t=0 프레임이다. 길이 0 이벤트(clear)나 이미 도착한 걷기는 같은 틱에 다음으로 넘어간다.
  for (let guard = 0; guard < 64; guard++) {
    if (s.current === null) {
      const next = s.queue.shift();
      if (!next) {
        settle(s);
        return;
      }
      s.current = start(data, s, next);
    } else {
      s.current.t += 1;
    }
    fireCue(data, s, s.current);
    nextLeg(data, s, s.current);
    if (!finished(s, s.current)) return;
    endCurrent(s);
  }
}

/** 끝난 `current`를 내린다: 끝날 때 바뀌는 것(게이지·방향·본 대사·마지막 장·보이는 플래그)을 적용한다. */
function endCurrent(s: SceneState): void {
  const c = s.current!;
  if (c.ev.type === 'faint') s.shownGauge = GAUGE_MAX;
  if (c.ev.type === 'walk' && c.ev.face !== undefined) s.walkers[c.ev.char].facing = c.ev.face;
  if (c.ev.type === 'say') s.seenSay[seenSayKey(c.ev.speaker, c.ev.text)] = true;
  holdLast(s, c);
  commitShown(s, c.seq, 'end');
  s.current = null;
}

/** 대기열이 다 비었을 때 정리(`sceneTick`이 대기열 끝에서 하는 것과 같다): 마지막 장 유지를 풀고 시작 연출 표시를 끈다. */
function settle(s: SceneState): void {
  if (s.overlays.length > 0) return;
  s.held = {};
  s.heldArt = {};
  s.intro = false;
}

/**
 * 남은 시작 연출을 잠금 시간 없이 다 끝낸다(`ui-interaction.md` 5절 예외 넷 1, #700). `onEnter`는 상태를 안 바꾸니(ADR-0065 5절) 버려도 퍼즐은 그대로다.
 * 끝까지 안 본 시작 대사는 본 대사(`seenSay`)에 넣지 않는다.
 */
function skipIntro(s: SceneState): void {
  for (const p of [...s.overlays, ...(s.current ? [s.current] : [])]) commitShown(s, p.seq, 'end');
  s.current = null;
  s.queue = [];
  s.overlays = [];
  settle(s);
}

/** 클리어 규칙 연출(`clear` 이벤트가 아직 끝나지 않았다)이 도는 중인가(#765). */
function clearPending(s: SceneState): boolean {
  return s.current?.ev.type === 'clear' || s.queue.some((e) => e.type === 'clear');
}

/** 클리어 건너뛰기 상한(틱). 지금 가장 긴 클리어 연출이 약 4초(240틱)라 넉넉히 1분. 넘으면 남은 것은 보통 재생으로 돈다. */
const CLEAR_SKIP_MAX_TICKS = 3600;

/**
 * 남은 클리어 규칙 연출을 끝 상태로 돌린다(#765). 지켜볼 때와 **같은 `sceneTick`을 화면 없이 돌려서** 끝 상태(보이는 플래그·마지막 장·
 * 자리·기울기)가 어긋날 틈을 없앤다(#452와 같은 종류의 어긋남 방지). 클리어 컷 글도 바로 내리니 다음 틱에 카드 조건(`cleared && !busy`)이 선다.
 * 카드는 뜬 뒤 0.6초를 따로 무시하니(`ui-interaction.md` 11-1절) 이 탭이 카드까지 넘기지 않는다.
 */
function skipClearRule(data: SceneData, s: SceneState): void {
  for (let i = 0; i < CLEAR_SKIP_MAX_TICKS && isBusy(s); i++) {
    const c = s.current;
    if (c?.ev.type === 'clear') c.duration = c.t;
    sceneTick(data, s);
  }
}

/** 탭 결과. 엔진이 효과음·안내 문구를 고르는 데 쓴다. */
export type SceneTapResult =
  | { kind: 'ignored' }
  | { kind: 'skipWalk' }
  | { kind: 'skipSay' }
  /** 이미 본 클리어 연출을 통째로 넘겼다(#765). */
  | { kind: 'skipClear' }
  | { kind: 'intent'; intent: Intent };

/**
 * 탭 하나. busy 동안은 새 행동을 받지 않고, 월드 탭으로 하는 전환도 받지 않는다(설계 5절).
 * - 얼굴 칸: busy 중에도 바로 전환한다(예외 셋, #266·6-4-2절). HUD 영역의 빈 곳은 무시.
 * - 시작 연출(`onEnter`)만 남았으면: 그것을 다 끝내고 평소대로 처리한다(예외 넷 1, #700).
 * - 자동 걷기 중: 걷기만 끝 위치로 건너뛴다. 남은 이벤트는 그대로 재생한다.
 * - 바닥 걷기 중(busy 아님): 같은 캐릭터로 지금 목표에서 `WALK_SKIP_SAME` 안을 다시 누르면 목표에 바로 선다(`skipWalk`, #38 5-2-1절).
 * - 말풍선이 뜬 뒤 1.0초(`saySkipAfter`, 이미 본 글이면 0.4초 `seenSaySkipAfter`)가 지났으면: 그 말풍선만 끝낸다.
 *   터치이고 그 말풍선이 마지막 이벤트면(예외 넷 2): 잠금 전에는 선택만 받고, 잠금 뒤에는 닫고 평소대로 처리한다.
 */
export function sceneTap(data: SceneData, s: SceneState, p: Point, slop: number, touch: boolean): SceneTapResult {
  // #765: 이미 본 클리어 연출은 정답 행동 0.4초 뒤 월드 탭 하나로 카드까지 넘긴다(anim·fx·걷기·대사·컷 글 모두).
  // 처음 보는 클리어는 그대로 둔다(처음 보는 사람은 끝까지 본다, M2 회의록). HUD 영역 탭은 아래 예외 셋 그대로다.
  if (s.clearSeen && s.clearAt !== null && clearPending(s) && !inHudZone(p)) {
    if (s.tick - s.clearAt < TIMING.clearSkipAfter) return { kind: 'ignored' };
    skipClearRule(data, s);
    return { kind: 'skipClear' };
  }
  const clearing = s.current;
  // 클리어 컷은 0.4초 뒤 탭으로 넘긴다(`magpie_nest.md` 8절·`ui-interaction.md` 11-1절: 다시 볼 때 기다리지 않게). 말풍선(1.0초)과 따로다. 클리어 뒤 다른 입력은 받지 않는다.
  if (clearing?.ev.type === 'clear') {
    if (clearing.t < TIMING.clearSkipAfter) return { kind: 'ignored' };
    clearing.duration = clearing.t;
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
  // 예외 넷 1(#700): 시작 연출 중 월드 탭은 남은 시작 연출을 끝내고 아래에서 평소대로 처리한다. 마우스·터치 같다.
  if (s.intro && isBusy(s)) skipIntro(s);
  const cur = s.current;
  if (cur) {
    if (cur.ev.type === 'walk') {
      // 남은 걷기·깡충을 다 건너뛰고 끝 점에 선다(1-5-2절: 깡충까지 건너뛴다).
      const w = s.walkers[cur.ev.char];
      delete s.hops[cur.ev.char];
      cur.legs = [];
      // 깡충까지 건너뛰니 기울기도 바로 새 값이다(1-5-2절). 판 끝으로 가면 탄 것, 아니면 내린 것.
      setRiding(data, s, cur.ev.char, cur.ev.to);
      if (cur.end) teleport(w, cur.end);
      else if (w.target) teleport(w, w.target);
      return { kind: 'skipWalk' };
    }
    if (cur.ev.type !== 'say') return { kind: 'ignored' };
    const unlocked = sayUnlocked(s, cur.ev, cur.t);
    const last = nothingAfterCurrent(s);
    if (!unlocked) {
      // 예외 넷 2(#700): 터치, 행동 뒤 마지막 말풍선의 잠금 전에는 말풍선은 그대로 두고 고르기(select)만 받는다.
      // 걷기·전환·실행(같은 대상 다시 탭)은 버리고 선택도 그대로 둔다. 마우스·연출 중간 말풍선은 다 버린다.
      if (!touch || !last) return { kind: 'ignored' };
      const r = tap(tapContext(data, s), s.ui, p, slop, touch);
      if (r.intent.kind !== 'select') return { kind: 'ignored' };
      s.ui = r.ui;
      return { kind: 'intent', intent: r.intent };
    }
    // 잠금 뒤 말풍선을 닫고 같은 탭을 아래에서 평소대로 처리하는 때:
    // - 예외 넷 2(#700): 터치, 마지막 말풍선. 닫는 탭이 선택에서 멈추니 같은 행동이 또 나가지 않는다.
    // - 예외 넷 3(#601): 마우스, 마지막 말풍선, 호버 라벨이 보여 준 *다른* 행동이나 전환. 방금 한 행동과 같은 클릭
    //   (대사를 넘기려고 같은 자리를 다시 누름)·바닥·빈 곳은 닫기만 한다(💥 두 번 방지, 대사 넘기다 걷지 않게).
    // 연출 중간 말풍선(예외 넷 4)은 마우스·터치 모두 닫기만 한다.
    if (!last || (!touch && !mouseActsThroughSay(data, s, p, slop))) {
      cur.duration = cur.t;
      return { kind: 'skipSay' };
    }
    // 말풍선을 지금 닫고(쉴 때와 같은 상태로) 같은 탭을 아래에서 평소대로 처리한다.
    endCurrent(s);
    settle(s);
  }
  // 대기열 밖 깡충(쿵 남은 칸·⑦·들썩)도 busy다. 건너뛸 수 없다(1-6-2절 "탭 건너뛰기").
  if (isBusy(s)) return { kind: 'ignored' };

  const r = tap(tapContext(data, s), s.ui, p, slop, touch);
  s.ui = r.ui;
  const intent = r.intent;
  // 컷이 남은 동안(faint 뒤 0.5초) 새 행동을 시작하면 컷을 바로 내린다. 말풍선과 겹치지 않게.
  if (intent.kind === 'walk' || intent.kind === 'act') s.faintCutUntil = 0;
  if (intent.kind === 'walk') {
    const w = s.walkers[s.ui.active];
    const to = clampToArea(floorTarget(data, intent.to), WALK_AREA);
    // 5-2-1절: 같은 캐릭터가 걷는 중 지금 목표와 같은 점(12px 안)을 다시 누르면 목표에 바로 선다. 다른 점은 목표를 바꾼다.
    if (w.target && Math.hypot(to.x - w.target.x, to.y - w.target.y) <= WALK_SKIP_SAME) {
      teleport(w, w.target);
      return { kind: 'skipWalk' };
    }
    walkTo(w, to, WALK_AREA);
    if (w.target) s.walkStart = { char: s.ui.active, dist: Math.hypot(w.target.x - w.x, w.target.y - w.y) };
  } else if (intent.kind === 'act') {
    s.lastActKey = intent.key;
    runAction(data, s, intent.action, intent.to);
  }
  return { kind: 'intent', intent };
}

/**
 * 마우스 클릭이 행동 뒤 마지막 말풍선을 닫고 그대로 처리될지(`ui-interaction.md` 5절 예외 넷 3, #601).
 * 호버 라벨이 보여 준 행동이 방금 한 행동과 다르면(다른 사람·다른 대상·다른 동사) 실행, 화면 속 동료 몸 클릭(전환)도 처리한다.
 * 바닥 걷기·빈 곳은 대사를 넘기려는 클릭으로 보고 닫기만 한다. 판정만 하고 `s.ui`는 바꾸지 않는다.
 */
function mouseActsThroughSay(data: SceneData, s: SceneState, p: Point, slop: number): boolean {
  const intent = tap(tapContext(data, s), s.ui, p, slop, false).intent;
  if (intent.kind === 'switch') return true;
  return intent.kind === 'act' && intent.key !== s.lastActKey;
}

/** 말풍선 잠금(처음 보는 글 `saySkipAfter`, 본 글 `seenSaySkipAfter`)이 풀렸나. `sceneTap`과 호버 판정이 같은 값을 쓴다. */
function sayUnlocked(s: SceneState, ev: { speaker: string; text: string }, t: number): boolean {
  return t >= (s.seenSay[seenSayKey(ev.speaker, ev.text)] ? TIMING.seenSaySkipAfter : TIMING.saySkipAfter);
}

/**
 * busy 중 마우스 호버 라벨·외곽선을 띄울지(#776, `ui-interaction.md` 5절 예외 넷 3).
 * 지금 p를 클릭하면 `sceneTap`이 행동 뒤 마지막 말풍선을 닫고 그 클릭을 그대로 처리하는 때만 참이다:
 * 마지막 말풍선이 잠금 뒤이고, 판정이 방금과 다른 행동이거나 화면 속 동료 몸(전환)이다.
 * 같은 행동·바닥·빈 곳·잠금 전·연출 중간 말풍선·시작 연출·HUD 영역은 거짓이다. "라벨이 보이면 그 클릭은 그대로 된다".
 * 마우스 전용이다(터치는 호버가 없고 예외 넷 2의 선택 라벨을 쓴다). `s`는 바꾸지 않는다.
 */
export function mouseHoverThroughSay(data: SceneData, s: SceneState, p: Point): boolean {
  const cur = s.current;
  if (s.cleared || cur?.ev.type !== 'say' || !selectsDuringSay(s)) return false;
  // `sceneTap`과 같은 순서: 얼굴 칸(경계 1px 포함)은 말풍선을 안 닫는 전환, HUD 영역·게이지 띠는 무시다.
  if (hitTest(hudTargets(), p, 0) || inHudZone(p)) return false;
  // 이미 본 클리어 연출은 월드 클릭이 건너뛰기라(#765) 행동이 나가지 않는다.
  if (s.clearSeen && s.clearAt !== null && clearPending(s)) return false;
  return sayUnlocked(s, cur.ev, cur.t) && mouseActsThroughSay(data, s, p, 0);
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
