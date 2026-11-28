// 탭 → 의도(intent) 판정 (docs/design/ui-interaction.md 2·4절·6-4절, 결정 기록 2026-11-15-default-tap-verb).
// 입력은 캐릭터 고르기 → 물건 누르기뿐이다. 동사 버튼(무장)은 없다(6-4절, #311 진마씨 결정).
// 순수 함수만 둔다. 퍼즐 상태를 바꾸지 않고, `step`을 부르지 않는다. 엔진(main.ts)이 의도를 받아 실행한다.
//
// 원칙 1: 기본 탭 동사는 대상 종류·자리 데이터·지금 캐릭터 위치로만 정한다. **규칙 데이터(screen.rules·fallbacks)는 읽지 않는다.**
// 읽으면 커서가 답을 알려 주게 된다(ADR-0018 F3). interact.test.ts가 이것을 검사한다.
// 특기 자리(6-4-1c, #723)도 자리의 `hintAbility`만 본다. "그 자리 × 그 특기 규칙이 있다"는 콘텐츠 테스트(screens-check)가 데이터로 보장한다.

import { characterDef, CHARACTERS, type CharacterId } from './characters';
import { hitTest, type HitBox, type HitTarget } from './hit';
import { CHAR_SLOTS, inHudZone, type HudId } from './hud';
import { FLOOR, hotspotPresent, PICKER, type Action, type Box, type PuzzleState, type ScreenData, type Verb } from './puzzle/types';
import type { Point } from './viewport';

/** UI 상태. 퍼즐 상태(PuzzleState)와 따로 둔다(ADR-0065 4절). JSON 직렬화 가능. */
export interface UiState {
  active: CharacterId;
  /** 터치 첫 탭으로 고른 행동(actionKey). 같은 행동을 다시 탭하면 실행한다(설계 4절). */
  selected: string | null;
}

/**
 * 판정에 필요한 지금 화면. 캐릭터 몸 박스는 엔진이 그린 위치 그대로 넘긴다
 * (바닥(`free`) 자리의 캐릭터는 좌표가 퍼즐 상태에 없기 때문이다).
 */
export interface TapContext {
  screen: Pick<ScreenData, 'spots' | 'hotspots'>;
  puzzle: PuzzleState;
  bodies: Readonly<Record<CharacterId, HitBox>>;
  /**
   * 얼굴 상자(시트 `head`를 몸처럼 발 위치·방향에 놓은 것, `characterFaceBox`). 바닥(`free` 자리)에 선 다른 캐릭터는
   * 몸 대신 이 상자만 전환 대상이다(설계 2-1절, #427).
   */
  faces: Readonly<Record<CharacterId, HitBox>>;
  /**
   * 이번 프레임에 그린 그림 칸(설계 2-1절, #736, `scene.ts` `drawnBodies`). 바닥에 선 다른 캐릭터는 얼굴 상자에 더해
   * 이 칸 위(여유 0)를 눌러도 전환된다. 없는 캐릭터(시트를 아직 못 읽음·실루엣)는 얼굴 상자만이다(11/19 규칙).
   */
  drawn?: Readonly<Partial<Record<CharacterId, DrawnBody>>>;
  /**
   * 캐릭터 그리는 순서(뒤 → 앞, `scene.ts` `drawOrder`). 있으면 겹친 캐릭터 중 나중에 그린 쪽이 클릭을 받는다.
   * 없으면 몸 상자 아래 끝(발 y)이 큰 쪽이 앞이다.
   */
  order?: readonly CharacterId[];
  /** 내려놓은 물건의 놓인 자리(`Placements`, ADR-1031 4절). 있으면 그 물건 상자가 `variants`보다 먼저 그리로 간다. */
  placed?: Placements;
}

/**
 * 쭉이가 내려놓은 물건의 놓인 자리(ADR-1031 4절 116줄, UI 상태). 물건 ID → 상자 아래 가운데 점(쭉이가 선 `free` 자리의 발 x·y).
 * 퍼즐 상태·BFS·세이브가 아니다(캐릭터 좌표와 같은 UI 상태, ADR-0065 4절). 엔진(`scene.ts`)이 적고 지운다.
 */
export type Placements = Readonly<Record<string, Point>>;

/** 그린 그림 칸 하나. `box`는 칸 전체 사각형(그리는 자리), `at`은 화면 점이 보이는 불투명 칸인가(물건·나중에 그린 사람에 덮인 칸은 아니다). */
export interface DrawnBody {
  box: HitBox;
  at: (p: Point) => boolean;
}

/**
 * 라벨에 쓰는 동사 이름. `climb` = 서는 자리로 `move`, `walk` = 바닥, `release` = 매달린 채 바닥,
 * `put` = 든 물건 내려놓기(ADR-1031 4절, 행동은 `item`). null = 이름만(캐릭터).
 */
export type LabelVerb = 'climb' | 'walk' | 'release' | 'put' | Exclude<Verb, 'move'> | null;

/** 라벨(설계 7절). 문구로 바꾸는 건 labelText(). */
export interface Label {
  verb: LabelVerb;
  /** 대상 ID(핫스팟·서는 자리·캐릭터). `walk`·`release`는 대상이 없다. */
  target: string | null;
  /** `verb === 'item'`·`'put'`일 때. */
  item?: string;
  /** `item`이 쭉이가 든 화면 물건(핫스팟 ID)이다(ADR-1031). 이름을 파티 아이템 키가 아니라 화면 이름 키에서 찾는다. */
  held?: true;
}

/** 월드 대상 종류. 히트 대상 id 앞에 붙여 이름 충돌을 막는다(`char:jjuk`, `spot:hook`, `hotspot:nest`). */
export type WorldKind = 'char' | 'spot' | 'hotspot';

export type Intent =
  /** 아무 일 없음. 라벨은 호버용(매달린 내 몸 = 이름). */
  | { kind: 'none'; label: Label | null }
  /** 캐릭터 전환. 퍼즐 행동이 아니다. */
  | { kind: 'switch'; char: CharacterId; label: Label }
  /** 퍼즐 상태가 그대로인 엔진 걷기(`floor`→`floor`). */
  | { kind: 'walk'; to: Point; label: Label }
  /** 터치 첫 탭: 고르기만 한다(라벨 + 외곽선). */
  | { kind: 'select'; key: string; label: Label }
  /** `step`에 넘길 행동. `to`는 바닥으로 내려오기(`move floor`)일 때 걸어갈 점. */
  | { kind: 'act'; action: Action; key: string; to: Point | null; label: Label };

/** resolveTap 결과. `select`는 tap()만 만든다. */
export type Resolved = Exclude<Intent, { kind: 'select' }>;

/** 판정 대상 하나. id는 `<kind>:<원래 ID>`. */
export interface WorldTarget extends HitTarget {
  kind: WorldKind;
  ref: string;
}

/** 캐릭터가 서는 자리·핫스팟과 같은 거리(0)로 겹치면 캐릭터가 이긴다. 그림도 앞에 있다. */
const CHAR_Z_BASE = 10_000;

const toHitBox = ([left, top, width, height]: Box): HitBox => ({ left, top, width, height });

function flagsMatch(puzzle: PuzzleState, flags: Record<string, boolean>): boolean {
  return Object.entries(flags).every(([k, v]) => puzzle.flags[k] === v);
}

/**
 * 핫스팟의 지금 박스. `variants`는 플래그가 맞는 첫 것(step.ts approachFor와 같은 순서).
 * 있음 조건(`present`)이 안 맞으면 null: 클릭 판정·행동 상자·라벨이 다 여기서 빠진다(ADR-1031, step `isValidAction`과 같은 판정).
 * 놓인 자리(`placed`, ADR-1031 4절)가 있으면 크기는 그대로 두고 아래 가운데를 그 점에 옮긴다(`variants`보다 먼저).
 */
export function hotspotBox(screen: TapContext['screen'], puzzle: PuzzleState, id: string, placed?: Placements): HitBox | null {
  const hs = screen.hotspots[id];
  if (!hs || !hotspotPresent(screen, puzzle.flags, id)) return null;
  // 든 물건은 쭉이 장대 끝에 있어 화면 대상이 아니다(ADR-1031 1절, step `isValidAction`과 같은 판정).
  if (puzzle.hands === id) return null;
  const v = hs.variants?.find((variant) => flagsMatch(puzzle, variant.when.flags));
  const box = toHitBox(v?.box ?? hs.box);
  const at = placed?.[id];
  return at ? placedBox(box, at) : box;
}

/**
 * 핫스팟 라벨 이름 ID(#1031). 상자와 같은 첫 일치 `variants`의 `name`, 없으면 핫스팟 ID 그대로.
 * 핫스팟이 아닌 ID(서는 자리·캐릭터)도 그대로 돌려준다. `labelText`의 `nameOf`로 넘긴다.
 */
export function hotspotNameId(screen: Pick<ScreenData, 'hotspots'>, puzzle: PuzzleState, id: string): string {
  const v = screen.hotspots[id]?.variants?.find((variant) => flagsMatch(puzzle, variant.when.flags));
  return v?.name ?? id;
}

/** 상자를 크기 그대로, 아래 가운데가 `at`에 오게 옮긴다. 가로는 `at.x − 폭/2` 반올림(`carriedPlace`와 같은 셈). */
export function placedBox(box: HitBox, at: Point): HitBox {
  return { left: Math.round(at.x - box.width / 2), top: at.y - box.height, width: box.width, height: box.height };
}

/** 지금 캐릭터가 유지 상태(`hold`) 자리에 있나. 자리 데이터만 본다. */
export function isHolding(ctx: TapContext, char: CharacterId): boolean {
  return ctx.screen.spots[ctx.puzzle.at[char]]?.hold === true;
}

/** 캐릭터가 바닥(`free` 자리)에 있나. 자리 데이터만 본다(`floorIntent`와 같은 식). */
export function isOnFloor(ctx: TapContext, char: CharacterId): boolean {
  const here = ctx.puzzle.at[char];
  return here === FLOOR || ctx.screen.spots[here]?.free === true;
}

/**
 * 캐릭터가 지금 선 "누를 수 있는 서는 자리"의 ID. `box`가 있고 `free`·`hold`가 아닌 자리(화면 1 시소 끝)만이다. 아니면 null.
 * 여기 선 지금 캐릭터의 몸을 누르면 그 자리를 누른 것과 같다(설계 6-4-1b절, #630 2단계).
 * `box` 없는 자리(화면 2 `fountain_seat`)는 원래 누를 수 없는 자리라 몸으로도 새 행동을 열지 않는다.
 */
export function standSpot(ctx: PuzzleView, char: CharacterId): string | null {
  const here = ctx.puzzle.at[char];
  const spot = ctx.screen.spots[here];
  return spot?.box && !spot.free && !spot.hold ? here : null;
}

/**
 * 몸 대신 얼굴 상자로 전환을 받는 자리에 있나(설계 2-1절 #427). 바닥(`free`)과, 바닥 앞에 놓인 고정 점(상자·`hold`·`board`가 없는
 * 자리, 화면 2 `fountain_seat` #517)이다. 판 끝·고리에 있는 사람은 몸 전체가 대상이다.
 */
export function usesFaceBox(ctx: TapContext, char: CharacterId): boolean {
  if (isOnFloor(ctx, char)) return true;
  const spot = ctx.screen.spots[ctx.puzzle.at[char]];
  return spot !== undefined && !spot.hold && !spot.board && !spot.box;
}

/**
 * 월드 히트 대상. 엔진 그리기·재생 도구 훅(`?playtest=1`)도 이 배열을 그대로 쓴다.
 * 지금 캐릭터 몸은 뺀다. 단 `hold` 자리(설계 2절)나 누를 수 있는 서는 자리(`standSpot`, 6-4-1b절)에 있으면 넣는다.
 * 서는 자리 위 내 몸은 다른 사람 몸·얼굴과 겹치면 늘 진다(전환 우선, 6-4-1b절).
 * 바닥(또는 바닥 앞 고정 점, `usesFaceBox`)에 선 다른 캐릭터는 몸 상자 대신 **얼굴 상자 + 보이는 그림 칸**(여유 0) 두 대상이다
 * (설계 2-1절, #427 → #736). 둘 다 아닌 곳(그림 옆 투명 칸, 물건에 덮인 칸)을 누르면 그 사람이 없는 것처럼 뒤의 대상이나 바닥으로 판정한다.
 * 두 대상은 id·z가 같다. 겹친 순서(z)는 그대로 몸 기준이다.
 */
export function worldTargets(ctx: TapContext, ui: UiState): WorldTarget[] {
  const out: WorldTarget[] = [];
  for (const c of CHARACTERS) {
    if (c.id === ui.active && !isHolding(ctx, c.id) && !standSpot(ctx, c.id)) continue;
    const body = ctx.bodies[c.id];
    const floorMate = c.id !== ui.active && usesFaceBox(ctx, c.id);
    const box = floorMate ? ctx.faces[c.id] : body;
    const rank = ctx.order?.indexOf(c.id) ?? -1;
    // 서는 자리 위 내 몸은 다른 사람 몸·얼굴 아래(전환 우선), 핫스팟·자리 위다(6-4-1b절 히트 순서).
    const own = c.id === ui.active && !isHolding(ctx, c.id);
    const z = own ? CHAR_Z_BASE - 1 : CHAR_Z_BASE + (rank >= 0 ? rank : body.top + body.height);
    out.push({ id: `char:${c.id}`, kind: 'char', ref: c.id, box, z });
    const drawn = floorMate ? ctx.drawn?.[c.id] : undefined;
    if (drawn) out.push({ id: `char:${c.id}`, kind: 'char', ref: c.id, box: drawn.box, z, mask: drawn.at });
  }
  for (const [id, spot] of Object.entries(ctx.screen.spots)) {
    if (spot.box) out.push({ id: `spot:${id}`, kind: 'spot', ref: id, box: toHitBox(spot.box), z: 0 });
  }
  for (const id of Object.keys(ctx.screen.hotspots)) {
    const box = hotspotBox(ctx.screen, ctx.puzzle, id, ctx.placed);
    if (box) out.push({ id: `hotspot:${id}`, kind: 'hotspot', ref: id, box, z: 0 });
  }
  return out;
}

/** HUD 히트 대상: 얼굴 칸 3개뿐(6-4-2절). 아이템 칸은 M2(6-4-6절). */
export function hudTargets(): (HitTarget & { id: HudId })[] {
  return CHARACTERS.map((c) => ({ id: `char.${c.id}` as const, box: CHAR_SLOTS[c.id], z: 0 }));
}

/** 행동 비교 키. 터치 "같은 대상 다시 탭"은 같은 행동(동사·대상·아이템까지)일 때만 실행한다. */
export function actionKey(a: Action): string {
  return [a.char, a.verb, a.target, a.item ?? ''].join('|');
}

function act(action: Action, label: Label, to: Point | null = null): Resolved {
  return { kind: 'act', action, key: actionKey(action), to, label };
}

/** 퍼즐 행동을 정하는 데 필요한 것만. 몸·얼굴 상자(입력층)는 빼서 테스트가 퍼즐 상태만으로 부를 수 있게 한다. */
export type PuzzleView = Pick<TapContext, 'screen' | 'puzzle'>;

/** 퍼즐 행동이 될 수 있는 월드 대상. null = 바닥(아무 대상도 안 맞음). 캐릭터는 전환이라 넣지 않는다. */
export type PuzzleTarget = { kind: 'spot' | 'hotspot'; ref: string } | null;

/** 대상에 자기 능력을 쓰는 행동. */
function ability(char: CharacterId, target: string): Resolved {
  const verb = characterDef(char).ability;
  return act({ char, verb, target }, { verb, target });
}

/** 바닥(대상 없음). */
function floorIntent(ctx: PuzzleView, char: CharacterId, p: Point): Resolved {
  const here = ctx.puzzle.at[char];
  const spot = ctx.screen.spots[here];
  if (here === FLOOR || spot?.free) return { kind: 'walk', to: p, label: { verb: 'walk', target: null } };
  const verb: LabelVerb = spot?.hold ? 'release' : 'walk';
  return act({ char, verb: 'move', target: FLOOR }, { verb, target: null }, p);
}

/**
 * 누르면 올라서기 대신 내 능력이 나가는 서는 자리인가. `hold` 자리(누구든, 설계 2절)와
 * `hintAbility`가 내 특기인 자리(특기 자리, 6-4-1c #723)다. 자리 데이터만 본다(원칙 1).
 */
export function specialtySpot(screen: Pick<ScreenData, 'spots'>, me: CharacterId, spotId: string): boolean {
  const spot = screen.spots[spotId];
  return spot?.hold === true || (spot?.hintAbility !== undefined && spot.hintAbility === characterDef(me).ability);
}

/**
 * 지금 캐릭터가 대상 하나(또는 바닥)를 눌렀을 때의 의도. `resolveTap`이 히트 판정 뒤에 부르는 바로 그 함수다.
 * 테스트(`tests/art/screen-poses.test.ts` 반응 없는 행동, #469)가 "누를 수 있는 행동"을 이것으로 만들어
 * 판정 규칙을 손으로 옮겨 적지 않는다(#476 리뷰 후속). p는 바닥 걷기 목적지로만 쓴다.
 */
export function targetIntent(ctx: PuzzleView, me: CharacterId, target: PuzzleTarget, p: Point): Resolved {
  if (!target) return floorIntent(ctx, me, p);
  // 든 채로 쭉이: 아무 대상이든 든 물건 쓰기. 장대 능력·올라서기는 안 나간다(ADR-1031 4절 표). 바닥은 위처럼 든 채로 걷기.
  const held = heldBy(ctx, me);
  if (held !== undefined) {
    if (target.ref === held) return { kind: 'none', label: null };
    return act({ char: me, verb: 'item', target: target.ref, item: held }, { verb: 'item', target: target.ref, item: held, held: true });
  }
  if (target.kind === 'hotspot') return ability(me, target.ref);
  // hold 자리는 move로 못 간다(ADR-0065). 핫스팟처럼 내 능력(설계 2절, PR #115).
  // 내가 선 자리를 다시 누르면 내 능력(6-4-1절).
  // 그 자리 `hintAbility`가 내 특기면 올라서지 않고 바로 내 능력(특기 자리, 6-4-1c #723: 화면 1 묵직이 × 시소 끝 = 첫 클릭 쿵).
  if (ctx.puzzle.at[me] !== target.ref && !specialtySpot(ctx.screen, me, target.ref)) {
    return act({ char: me, verb: 'move', target: target.ref }, { verb: 'climb', target: target.ref });
  }
  return ability(me, target.ref);
}

/** `me`가 들고 있는 화면 물건. 드는 사람은 쭉이뿐이다(ADR-1031, `PICKER`). */
function heldBy(ctx: PuzzleView, me: CharacterId): string | undefined {
  return me === PICKER ? ctx.puzzle.hands : undefined;
}

/**
 * 지금 캐릭터 얼굴 칸(HUD)을 눌렀을 때. 든 채로 쭉이가 `free` 자리에 서 있으면 내려놓기, 아니면 아무 일 없음(ADR-1031 4절 표).
 * 내려놓기 행동 모양은 코어와 같다: `{ jjuk, item, item: X, target: X }`(step `isPutAction`). 걷지 않는다.
 */
function ownFaceIntent(ctx: PuzzleView, me: CharacterId): Resolved {
  const held = heldBy(ctx, me);
  if (held !== undefined && ctx.screen.spots[ctx.puzzle.at[me]]?.free === true) {
    return act({ char: me, verb: 'item', target: held, item: held }, { verb: 'put', target: null, item: held, held: true });
  }
  return { kind: 'none', label: { verb: null, target: me } };
}

/**
 * 탭 하나를 판정한다(터치 2번 규칙은 빼고). 데스크톱 호버 라벨도 이것으로 만든다.
 * slop: 마우스 0, 터치 8(ADR-0007 결정 6). busy(연출 중) 처리는 엔진이 먼저 한다(설계 5절).
 */
export function resolveTap(ctx: TapContext, ui: UiState, p: Point, slop: number): Resolved {
  const me = ui.active;

  // 1. HUD. 영역 안이면 월드로 넘기지 않는다.
  const hud = hitTest(hudTargets(), p, slop);
  if (hud) {
    const char = hud.id.slice('char.'.length) as CharacterId;
    return char === me ? ownFaceIntent(ctx, me) : { kind: 'switch', char, label: { verb: null, target: char } };
  }
  if (inHudZone(p)) return { kind: 'none', label: null };

  // 2. 월드.
  const hit = hitTest(worldTargets(ctx, ui), p, slop);
  if (!hit) return targetIntent(ctx, me, null, p);
  if (hit.kind === 'char') {
    const id = hit.ref as CharacterId;
    if (id === me) {
      // 서는 자리 위 내 몸 = 그 자리(6-4-1b절, #630 2단계). 묵직이 머리를 눌러도 쿵이다. 걸어 내려가지 않는다.
      const spot = standSpot(ctx, me);
      if (spot) return targetIntent(ctx, me, { kind: 'spot', ref: spot }, p);
      // 매달린 내 몸(설계 2절 hold 예외): 아무 일 없음.
      return { kind: 'none', label: { verb: null, target: id } };
    }
    return { kind: 'switch', char: id, label: { verb: null, target: id } };
  }
  return targetIntent(ctx, me, { kind: hit.kind, ref: hit.ref }, p);
}

/**
 * 실제 탭. 터치는 `step` 행동만 2번(첫 탭 = 선택, 같은 행동 다시 탭 = 실행)이다(설계 4절).
 * 새 UiState를 돌려준다(입력은 바꾸지 않는다).
 */
export function tap(ctx: TapContext, ui: UiState, p: Point, slop: number, touch: boolean): { ui: UiState; intent: Intent } {
  const intent = resolveTap(ctx, ui, p, slop);
  switch (intent.kind) {
    case 'none':
      return { ui, intent };
    case 'switch':
      return { ui: { active: intent.char, selected: null }, intent };
    case 'walk':
      return { ui: { ...ui, selected: null }, intent };
    case 'act':
      if (touch && ui.selected !== intent.key) {
        return { ui: { ...ui, selected: intent.key }, intent: { kind: 'select', key: intent.key, label: intent.label } };
      }
      return { ui: { ...ui, selected: null }, intent };
  }
}

const characterNames: Readonly<Record<string, true>> = Object.fromEntries(CHARACTERS.map((c) => [c.id, true]));

/**
 * 라벨 문구(설계 7절). t는 텍스트 ID → 문자열(없으면 ID를 그대로 돌려줘도 된다).
 * 대상이 있으면 `ui.label.<verb>` 패턴(`{target}にのる`, `{target}に{item}を使う`)으로 `<이름><조사><동사>`를 만든다(#703).
 * 대상이 없으면(`walk`·`release`) 동사 이름표 `ui.verb.<verb>`만, 동사가 없으면(캐릭터) 이름만.
 * `nameOf`는 대상·든 물건 ID → 이름 ID(상태별 이름, `hotspotNameId`). 없으면 ID 그대로.
 */
export function labelText(label: Label, screenId: string, t: (id: string) => string, nameOf: (id: string) => string = (id) => id): string {
  const name = (id: string): string =>
    id in characterNames ? t(`char.${id}.name`) : t(`${screenId}.name.${nameOf(id)}`);
  if (label.verb === null) return label.target === null ? '' : name(label.target);
  const item = label.verb !== 'item' && label.verb !== 'put' ? '' : label.held ? name(label.item ?? '') : t(`${label.item ?? ''}.name`);
  if (label.target === null) return t(`ui.verb.${label.verb}`).replace('{item}', item);
  const vars: Record<string, string> = { target: name(label.target), item };
  return t(`ui.label.${label.verb}`).replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
