// 탭 → 의도(intent) 판정 (docs/design/ui-interaction.md 2~4절, 결정 기록 2026-11-15-default-tap-verb).
// 순수 함수만 둔다. 퍼즐 상태를 바꾸지 않고, `step`을 부르지 않는다. 엔진(main.ts)이 의도를 받아 실행한다.
//
// 원칙 1: 기본 탭 동사는 대상 종류와 지금 캐릭터 위치로만 정한다. **규칙 데이터(screen.rules·fallbacks)는 읽지 않는다.**
// 읽으면 커서가 답을 알려 주게 된다(ADR-0018 F3). interact.test.ts가 이것을 검사한다.

import { characterDef, CHARACTERS, type CharacterId } from './characters';
import { hitTest, type HitBox, type HitTarget } from './hit';
import { CHAR_SLOTS, HUD_AREA, ITEM_SLOT, VERB_BUTTONS, VERB_SLOTS, type HudId, type VerbButton } from './hud';
import { FLOOR, type Action, type Box, type PuzzleState, type ScreenData, type Verb } from './puzzle/types';
import type { Point } from './viewport';

/** HUD 버튼으로 무장한 동사. 다음 실행 한 번에만 쓰인다(설계 3절). */
export type Armed = { verb: VerbButton } | { verb: 'item'; item: string };

/** UI 상태. 퍼즐 상태(PuzzleState)와 따로 둔다(ADR-0065 4절). JSON 직렬화 가능. */
export interface UiState {
  active: CharacterId;
  armed: Armed | null;
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
}

/** 라벨에 쓰는 동사 이름. `climb` = 서는 자리로 `move`, `walk` = 바닥, `release` = 매달린 채 바닥. null = 이름만(캐릭터). */
export type LabelVerb = 'climb' | 'walk' | 'release' | Exclude<Verb, 'move'> | null;

/** 라벨(설계 7절). 문구로 바꾸는 건 labelText(). */
export interface Label {
  verb: LabelVerb;
  /** 대상 ID(핫스팟·서는 자리·캐릭터). `walk`·`release`는 대상이 없다. */
  target: string | null;
  /** `verb === 'item'`일 때. */
  item?: string;
}

/** 월드 대상 종류. 히트 대상 id 앞에 붙여 이름 충돌을 막는다(`char:jjuk`, `spot:hook`, `hotspot:nest`). */
export type WorldKind = 'char' | 'spot' | 'hotspot';

export type Intent =
  /** 아무 일 없음. 라벨은 호버용(매달린 내 몸 = 이름). */
  | { kind: 'none'; label: Label | null }
  /** 캐릭터 전환. 퍼즐 행동이 아니다. */
  | { kind: 'switch'; char: CharacterId; label: Label }
  /** 무장/해제(null). */
  | { kind: 'arm'; armed: Armed | null }
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

/** 핫스팟의 지금 박스. `variants`는 플래그가 맞는 첫 것(step.ts approachFor와 같은 순서). */
export function hotspotBox(screen: TapContext['screen'], puzzle: PuzzleState, id: string): HitBox | null {
  const hs = screen.hotspots[id];
  if (!hs) return null;
  const v = hs.variants?.find((variant) => flagsMatch(puzzle, variant.when.flags));
  return toHitBox(v?.box ?? hs.box);
}

/** 지금 캐릭터가 유지 상태(`hold`) 자리에 있나. 자리 데이터만 본다. */
export function isHolding(ctx: TapContext, char: CharacterId): boolean {
  return ctx.screen.spots[ctx.puzzle.at[char]]?.hold === true;
}

/**
 * 월드 히트 대상. 엔진 그리기·재생 도구 훅(`?playtest=1`)도 이 배열을 그대로 쓴다.
 * - 지금 캐릭터 몸은 뺀다. 단 `hold` 자리에 있으면 넣는다(설계 2절).
 * - `withChars: false`면 캐릭터를 모두 뺀다(무장 중 캐릭터 건너뛰기, 설계 3절).
 */
export function worldTargets(ctx: TapContext, ui: UiState, withChars = true): WorldTarget[] {
  const out: WorldTarget[] = [];
  if (withChars) {
    for (const c of CHARACTERS) {
      if (c.id === ui.active && !isHolding(ctx, c.id)) continue;
      const box = ctx.bodies[c.id];
      out.push({ id: `char:${c.id}`, kind: 'char', ref: c.id, box, z: CHAR_Z_BASE + box.top + box.height });
    }
  }
  for (const [id, spot] of Object.entries(ctx.screen.spots)) {
    if (spot.box) out.push({ id: `spot:${id}`, kind: 'spot', ref: id, box: toHitBox(spot.box), z: 0 });
  }
  for (const id of Object.keys(ctx.screen.hotspots)) {
    const box = hotspotBox(ctx.screen, ctx.puzzle, id);
    if (box) out.push({ id: `hotspot:${id}`, kind: 'hotspot', ref: id, box, z: 0 });
  }
  return out;
}

/** HUD 히트 대상. 빈 아이템 칸은 대상이 아니다. */
export function hudTargets(puzzle: PuzzleState): (HitTarget & { id: HudId })[] {
  const out: (HitTarget & { id: HudId })[] = [];
  for (const c of CHARACTERS) out.push({ id: `char.${c.id}`, box: CHAR_SLOTS[c.id], z: 0 });
  for (const v of VERB_BUTTONS) out.push({ id: `verb.${v}`, box: VERB_SLOTS[v], z: 0 });
  if (puzzle.items.length > 0) out.push({ id: 'item.0', box: ITEM_SLOT, z: 0 });
  return out;
}

/** 행동 비교 키. 터치 "같은 대상 다시 탭"은 같은 행동(동사·대상·아이템까지)일 때만 실행한다. */
export function actionKey(a: Action): string {
  return [a.char, a.verb, a.target, a.item ?? ''].join('|');
}

function inBox(p: Point, b: HitBox): boolean {
  return p.x >= b.left && p.x < b.left + b.width && p.y >= b.top && p.y < b.top + b.height;
}

function sameArmed(a: Armed | null, b: Armed): boolean {
  return a !== null && a.verb === b.verb && (a.verb !== 'item' || (b.verb === 'item' && a.item === b.item));
}

function act(action: Action, label: Label, to: Point | null = null): Resolved {
  return { kind: 'act', action, key: actionKey(action), to, label };
}

/** 무장한 동사 또는 기본(자기 능력)으로 대상에 쓸 행동. */
function armedOrAbility(char: CharacterId, armed: Armed | null, target: string): Resolved {
  if (armed?.verb === 'item') return act({ char, verb: 'item', target, item: armed.item }, { verb: 'item', target, item: armed.item });
  const verb = !armed || armed.verb === 'ability' ? characterDef(char).ability : armed.verb;
  return act({ char, verb, target }, { verb, target });
}

/** 바닥(대상 없음). 무장은 풀린다. */
function floorIntent(ctx: TapContext, char: CharacterId, p: Point): Resolved {
  const here = ctx.puzzle.at[char];
  const spot = ctx.screen.spots[here];
  if (here === FLOOR || spot?.free) return { kind: 'walk', to: p, label: { verb: 'walk', target: null } };
  const verb: LabelVerb = spot?.hold ? 'release' : 'walk';
  return act({ char, verb: 'move', target: FLOOR }, { verb, target: null }, p);
}

/**
 * 탭 하나를 판정한다(터치 2번 규칙은 빼고). 데스크톱 호버 라벨도 이것으로 만든다.
 * slop: 마우스 0, 터치 8(ADR-0007 결정 6). busy(연출 중) 처리는 엔진이 먼저 한다(설계 5절).
 */
export function resolveTap(ctx: TapContext, ui: UiState, p: Point, slop: number): Resolved {
  const me = ui.active;

  // 1. HUD. 영역 안이면 월드로 넘기지 않는다.
  const hud = hitTest(hudTargets(ctx.puzzle), p, slop);
  if (hud) {
    if (hud.id.startsWith('char.')) {
      const char = hud.id.slice('char.'.length) as CharacterId;
      return char === me ? { kind: 'none', label: { verb: null, target: char } } : { kind: 'switch', char, label: { verb: null, target: char } };
    }
    if (hud.id === 'item.0') {
      const item = ctx.puzzle.items[0] as string;
      const armed: Armed = { verb: 'item', item };
      return { kind: 'arm', armed: sameArmed(ui.armed, armed) ? null : armed };
    }
    const armed: Armed = { verb: hud.id.slice('verb.'.length) as VerbButton };
    return { kind: 'arm', armed: sameArmed(ui.armed, armed) ? null : armed };
  }
  if (inBox(p, HUD_AREA)) return { kind: 'none', label: null };

  // 2. 월드. 무장 중이면 캐릭터를 건너뛰고, 뒤에 아무것도 없을 때만 캐릭터를 본다.
  const hit = hitTest(worldTargets(ctx, ui, ui.armed === null), p, slop);
  if (!hit && ui.armed !== null) {
    const char = hitTest(worldTargets(ctx, ui, true), p, slop);
    if (char?.kind === 'char') {
      const id = char.ref as CharacterId;
      return id === me ? { kind: 'arm', armed: null } : { kind: 'switch', char: id, label: { verb: null, target: id } };
    }
  }

  if (!hit) return floorIntent(ctx, me, p);
  switch (hit.kind) {
    case 'char': {
      const id = hit.ref as CharacterId;
      // 매달린 내 몸(설계 2절 hold 예외): 아무 일 없음.
      if (id === me) return { kind: 'none', label: { verb: null, target: id } };
      return { kind: 'switch', char: id, label: { verb: null, target: id } };
    }
    case 'spot':
      if (ui.armed === null && ctx.puzzle.at[me] !== hit.ref) {
        return act({ char: me, verb: 'move', target: hit.ref }, { verb: 'climb', target: hit.ref });
      }
      return armedOrAbility(me, ui.armed, hit.ref);
    case 'hotspot':
      return armedOrAbility(me, ui.armed, hit.ref);
  }
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
      return { ui: { active: intent.char, armed: null, selected: null }, intent };
    case 'arm':
      return { ui: { ...ui, armed: intent.armed, selected: null }, intent };
    case 'walk':
      return { ui: { ...ui, armed: null, selected: null }, intent };
    case 'act':
      if (touch && ui.selected !== intent.key) {
        return { ui: { ...ui, selected: intent.key }, intent: { kind: 'select', key: intent.key, label: intent.label } };
      }
      return { ui: { ...ui, armed: null, selected: null }, intent };
  }
}

const characterNames: Readonly<Record<string, true>> = Object.fromEntries(CHARACTERS.map((c) => [c.id, true]));

/** 라벨 문구(설계 7절). t는 텍스트 ID → 문자열(없으면 ID를 그대로 돌려줘도 된다). */
export function labelText(label: Label, screenId: string, t: (id: string) => string): string {
  const name = (id: string): string =>
    id in characterNames ? t(`char.${id}.name`) : t(`${screenId}.name.${id}`);
  if (label.verb === null) return label.target === null ? '' : name(label.target);
  const verb = label.verb === 'item' ? t('ui.verb.item').replace('{item}', t(`${label.item ?? ''}.name`)) : t(`ui.verb.${label.verb}`);
  return label.target === null ? verb : `${verb}: ${name(label.target)}`;
}
