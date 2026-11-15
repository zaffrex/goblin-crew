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

/** `approach`: 서는 자리 ID 하나, 또는 동사별 맵(`default` 키 가능). `stay`는 걷지 않음. */
export type Approach = string | Partial<Record<Verb | 'default', string>>;

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
  /** 손 놓기 연출. 캐릭터 ID 키가 있으면 그것, 없으면 `default`. */
  releaseShow?: Partial<Record<CharacterId | 'default', ShowItem[]>>;
  /** 정원이 차서 못 갈 때 연출. */
  takenShow?: ShowItem[];
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

export type MoveEffect = { who: CharacterId | 'self'; to: string } | { from: string; to: string };

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
  show?: ShowItem[];
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
  | { type: 'place'; char: CharacterId; from: string; to: string }
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
