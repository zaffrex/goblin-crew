// 퍼즐 데이터 모델 타입 (ADR-0065). 화면 JSON(content/screens/*.json)이 이 모양이다.
// 모든 값은 JSON 직렬화 가능해야 한다(ADR-0004 결정 2).

import type { CharacterId } from '../characters';

export type { CharacterId };

export type Verb = 'move' | 'look' | 'hand' | 'stretch' | 'stomp' | 'squeak' | 'item';
export type AbilityVerb = 'stretch' | 'stomp' | 'squeak';
export const VERBS: readonly Verb[] = ['move', 'look', 'hand', 'stretch', 'stomp', 'squeak', 'item'];

/** 내부 좌표 사각형 [x, y, w, h]. */
export type Box = [number, number, number, number];

/** 연출 한 줄(ADR-0065 5절 `show`). 상태를 바꾸지 않는다. */
export type ShowItem =
  | { anim: [target: string, name: string] }
  | { say: [speaker: string, text: string | string[]] }
  | { fx: [effect: string, target: string] };

/**
 * 효과 위치 표시(ADR-0065 5절, #206). 규칙 `show` 안 이 자리에서 그 규칙 `do`의 이벤트(`item`·`place`·`gauge`)를 낸다.
 * 규칙 `show`에서만 쓴다. 그래서 `ShowItem`이 아니라 `RuleShowItem`에만 있다.
 */
export interface DoHere {
  do: 'here';
}

/** 규칙 `show` 한 줄. 연출 + 효과 위치 표시(한 번까지). */
export type RuleShowItem = ShowItem | DoHere;

export function isDoHere(item: RuleShowItem): item is DoHere {
  return 'do' in item;
}

/** 동사별 맵(`default` 키 가능). 값은 서는 자리 ID 또는 `stay`. */
export type ApproachByVerb = Partial<Record<Verb | 'default', string>>;

/**
 * `approach`: 서는 자리 ID 하나, 또는 동사별 맵(`default` 키 가능). `stay`는 걷지 않음.
 * 맵에는 선택으로 `from`(행동하는 사람이 **지금 선 자리**별 예외, #688)을 둔다. 값은 자리 ID·`stay` 또는 동사별 맵이다.
 * 지금 선 자리가 `from`에 있으면 그 값을 먼저 보고(동사 → `default`), 거기 없는 동사는 바깥 맵으로 내려간다.
 * 예: 시소 끝에 선 사람이 둥지에 `stretch`를 쓰면 그 자리에서 뻗는다 `{ "default": "floor", "from": { "seesaw_left": { "stretch": "stay" } } }`.
 */
export type Approach = string | (ApproachByVerb & { from?: Record<string, string | ApproachByVerb> });

export interface SpotDef {
  x: number;
  y: number;
  /** 자유 바닥(정원 없음). 화면마다 `floor` 하나는 꼭 `free: true`. */
  free?: boolean;
  /** 정원. 기본 1. `free`면 무시. */
  capacity?: number;
  /** 있으면 클릭 대상. */
  box?: Box;
  /** 유지 상태(ADR-0018 S2). `move`로 갈 수 없고 규칙 효과로만 들어간다. */
  hold?: boolean;
  /** `hold` 자리에서 손을 놓으면 갈 자리(`free` 자리). */
  releaseTo?: string;
  /**
   * `hold` 자리에서 `releaseTo`로 내려올 때 설 발 위치(엔진 전용, 코어 규칙은 안 쓴다). 없으면 "지금 x 바로 아래".
   * 화면 1은 바구니 안 (160, 235)(형식 기록 6절 2번). 손 놓기·이 자리에서의 `move`·`via`로 이 자리를 지나는 `move`에 쓴다.
   */
  releasePoint?: [number, number];
  /** 손 놓기 연출. 캐릭터 ID 키가 있으면 그것, 없으면 `default`. */
  releaseShow?: Partial<Record<CharacterId | 'default', ShowItem[]>>;
  /** 정원이 차서 못 갈 때 연출. */
  takenShow?: ShowItem[];
  /**
   * 바닥보다 높은 자리(시소 끝)에 오르내릴 때 디딜 바닥 점(엔진 전용, 코어 규칙과 BFS는 안 쓴다, #397).
   * 이 자리로 걷는 `walk`는 이 점까지 바닥을 걸은 뒤 깡충 올라서고, 이 자리에서 떠나는 `walk`는 먼저 이 점으로 뛰어내린다.
   * 예외: `board` 자리끼리(시소 끝 ↔ 끝)는 판 위로 걷는다(깡충 없음). 정원이 차서 못 가면(`takenShow`) 이 점까지만 걸어가 멈춘다.
   * `free`·`hold` 자리에는 둘 수 없다. 화면 1 시소 끝은 판 앞 바닥(`magpie_nest.md` 1-5-2절).
   */
  board?: [number, number];
  /** 이 자리를 대상으로 다른 동사를 쓸 때 걸어갈 자리. 기본 `floor`. */
  approach?: Approach;
  /** 힌트 ②에서 가리킬 능력(핫스팟과 같음). 서는 자리도 클릭 대상이라 둘 수 있다(PR #99 리뷰). */
  hintAbility?: AbilityVerb;
  note?: string;
}

export interface HotspotVariant {
  when: { flags: Record<string, boolean> };
  box?: Box;
  approach?: Approach;
}

export interface HotspotDef {
  box: Box;
  /** 기본 `floor`. */
  approach?: Approach;
  variants?: HotspotVariant[];
  hintAbility?: AbilityVerb;
  reachPoint?: [number, number];
  note?: string;
}

/** 조건(ADR-0065 5절). 모두 AND. */
export interface Condition {
  who?: CharacterId[];
  at?: string[];
  flags?: Record<string, boolean>;
  has?: string[];
  lacks?: string[];
  item?: string;
  occupied?: Record<string, boolean>;
}

/**
 * `via`: 이 `hold` 자리를 거쳐 떨어진 것으로 본다 → 엔진이 그 자리의 `releasePoint`에 세운다(연출 전용, 상태와 BFS는 같다).
 * 화면 1의 13번(포개짐)에서 시소에서 날아간 사람이 고리에 부딪혀 바구니로 떨어지는 경우다.
 */
export type MoveEffect = ({ who: CharacterId | 'self'; to: string } | { from: string; to: string }) & { via?: string };

/** 효과(ADR-0065 5절). set → give/take → move → gauge 순서로 적용한다. */
export interface Effect {
  set?: Record<string, boolean>;
  give?: string[];
  take?: string[];
  move?: MoveEffect[];
  gauge?: number;
}

export interface RuleDef {
  id: string;
  target: string;
  verb: Verb;
  when?: Condition;
  do?: Effect;
  /** `{ "do": "here" }`가 있으면 효과 이벤트를 그 자리에, 없으면 맨 뒤에 낸다. */
  show?: RuleShowItem[];
  note?: string;
}

/** 폴백 ①. 상태를 바꾸지 않는다. 예외로 게이지만 허용(다치는 실패). */
export interface HotspotFallbackDef {
  do?: { gauge?: number };
  show?: ShowItem[];
  note?: string;
}

export interface Action {
  char: CharacterId;
  verb: Verb;
  target: string;
  /** `verb === 'item'`일 때만. */
  item?: string;
}

export interface ScreenData {
  id: string;
  spots: Record<string, SpotDef>;
  hotspots: Record<string, HotspotDef>;
  /** 선언 + 초깃값. 불리언만. */
  flags: Record<string, boolean>;
  start: { at: Record<CharacterId, string>; items: string[] };
  exitFlag: string;
  onEnter?: ShowItem[];
  rules: RuleDef[];
  fallbacks?: Record<string, Partial<Record<Verb, HotspotFallbackDef>>>;
  solution?: Action[];
  /**
   * 이 화면 걷기 영역(#938). 적은 키만 공통 `WALK_AREA`(`core/config.ts`)를 덮는다. 공통 영역 안으로 줄이기만 한다.
   * 그림 바닥이 공통 위 끝(y 200)보다 낮은 화면(빨래방 바닥 y 236~)에서 벽 띠에 서지 않게 한다.
   */
  walkArea?: { left?: number; top?: number; right?: number; bottom?: number };
  note?: string;
}

/** `content/characters.json`. 폴백 ②(캐릭터 공통 실패 리액션)와 힌트 대사. */
export interface CharactersData {
  fallbacks?: Partial<Record<CharacterId, Partial<Record<Verb, { show: ShowItem[] }>>>>;
  hints?: Partial<Record<CharacterId, Partial<Record<AbilityVerb, string>>>>;
}

/** 퍼즐 상태의 전부(ADR-0065 4절). UI 상태(조작 캐릭터, 좌표, 카운터)는 넣지 않는다. */
export interface PuzzleState {
  screen: string;
  at: Record<CharacterId, string>;
  /** 선언된 플래그 전부. 키 순서는 선언 순서. */
  flags: Record<string, boolean>;
  /** 파티 공용, 정렬. */
  items: string[];
  /** 보송 게이지 0..5 (ADR-0018 G1). 행동 사이에는 항상 1..5. */
  gauge: number;
}

/** 엔진이 순서대로 재생할 연출. 엔진은 이것으로만 반응한다. */
export type PuzzleEvent =
  | { type: 'walk'; char: CharacterId; from: string; to: string }
  | { type: 'release'; char: CharacterId; from: string; to: string }
  /** 규칙 효과 `move`로 자리가 바뀜(시소 발사 등). 걷기가 아니라 순간 배치다. */
  | { type: 'place'; char: CharacterId; from: string; to: string; via?: string }
  | { type: 'anim'; target: string; name: string }
  | { type: 'say'; speaker: string; text: string | string[] }
  | { type: 'fx'; effect: string; target: string }
  | { type: 'gauge'; delta: number; value: number }
  | { type: 'item'; op: 'give' | 'take'; item: string }
  | { type: 'faint'; to: Record<CharacterId, string> }
  | { type: 'clear' };

export type StepSource =
  | 'rule'
  | 'move'
  | 'hotspotFallback'
  | 'characterFallback'
  | 'release'
  | 'blocked'
  | 'invalid';

export interface StepResult {
  /** 새 객체. 입력 state는 바꾸지 않는다. */
  state: PuzzleState;
  events: PuzzleEvent[];
  source: StepSource;
  /** `source === 'rule'`일 때. */
  ruleId?: string;
}

export const GAUGE_MAX = 5;
export const FLOOR = 'floor';
export const STAY = 'stay';
