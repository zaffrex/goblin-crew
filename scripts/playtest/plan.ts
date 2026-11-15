// 재생 도구 2부-a: 정답 행동 `{char, verb, target}` → 실제로 누를 곳 목록 (#101).
// 순수 함수만 둔다. Chrome 없이 테스트한다. 규칙 출처: docs/design/ui-interaction.md 2·3·4·10절.
//
// 입력은 게임의 읽기 전용 훅 `window.__gcLayout()`(`?playtest=1`일 때만, #68)이 돌려주는 배치다.
// 훅은 입력 판정이 쓰는 바로 그 히트 대상을 돌려준다(Slack #goblin-dev 11/15 Theo 합의). 그래서 여기서 상자를
// 따로 계산하지 않고, 훅 상자 안에서 "다른 대상에 가리지 않은 점"만 고른다.

import { characterDef, type CharacterId } from '../../src/core/characters.ts';
import { distanceToBox, type HitBox } from '../../src/core/hit.ts';
import { HUD_AREA, type HudId } from '../../src/core/hud.ts';
import type { Action, ScreenData, Verb } from '../../src/core/puzzle/types.ts';
import type { Point } from '../../src/core/viewport.ts';

/**
 * `window.__gcLayout()` 모양 (내부 px). Theo 제안 모양에 `at` 하나를 더한 것이다.
 * `at`이 없으면 기본 탭 동사(서는 자리에 내가 있나)를 정할 수 없다. 캐릭터 상자만으로는 어느 자리인지 모른다.
 */
export interface Layout {
  active: CharacterId;
  /** 무장한 HUD 버튼 id(`verb.ability` 등). 없으면 null. */
  armed: HudId | null;
  selected: string | null;
  busy: boolean;
  cleared: boolean;
  gauge: number;
  /** 캐릭터별 지금 퍼즐 자리 id (`state.at`의 사본). */
  at: Record<CharacterId, string>;
  chars: Partial<Record<CharacterId, HitBox>>;
  spots: Record<string, HitBox>;
  hotspots: Record<string, HitBox>;
  hud: Record<string, HitBox>;
}

/**
 * HUD 버튼 id. `src/core/hud.ts` `HudId`와 같은 점(`.`) 표기다(PR #111 Theo 리뷰).
 * 콜론(`char:jjuk`)은 월드 대상인 캐릭터 몸 id라서, 점으로 HUD 칸과 몸을 구분한다. 좌표는 훅에서 받는다.
 */
export const HUD = {
  char: (c: CharacterId): HudId => `char.${c}`,
  ability: 'verb.ability',
  hand: 'verb.hand',
  look: 'verb.look',
  item: 'item.0',
} as const satisfies Record<string, HudId | ((c: CharacterId) => HudId)>;

/** 터치 여유(ADR-0007 결정 6). HUD는 거리 비교 없이 먼저 판정되니 월드 점은 HUD 영역에서 이만큼 떨어져야 한다. */
const TOUCH_SLOP = 8;
const HUD_GUARD: HitBox = {
  left: HUD_AREA.left - TOUCH_SLOP,
  top: HUD_AREA.top - TOUCH_SLOP,
  width: HUD_AREA.width + 2 * TOUCH_SLOP,
  height: HUD_AREA.height + 2 * TOUCH_SLOP,
};

export type Input = 'mouse' | 'touch';

export interface Tap {
  /** 누르는 대상 id (HUD id, 서는 자리, 핫스팟, `floor`). 보고서용. */
  id: string;
  /** 내부 px 정수. 페이지 좌표는 coords.ts `internalToPage`로 바꾼다. */
  at: Point;
  why: string;
}

export interface Plan {
  taps: Tap[];
  /** 기본 탭이 이 동사를 고르는지 (false면 동사 버튼으로 무장). */
  verbByDefault: boolean;
  warnings: string[];
}

export interface PlanOptions {
  /** 바닥 탭에 쓸 빈 점. `floor` 대상 행동에만 필요하다(화면 1 정답에는 없음). */
  floorPoint?: Point;
}

const abilityOf = (c: CharacterId): Verb => characterDef(c).ability;

/**
 * 무장 없이 대상을 누르면 고르는 동사 (ui-interaction 2절, `interact.ts` `resolveTap`). 규칙 데이터는 보지 않는다(원칙 1).
 * 서는 자리: 내가 서 있거나 `hold` 자리면 능력, 아니면 `move` (hold 자리 = 능력은 PR #115·#116).
 */
export function defaultVerb(screen: ScreenData, char: CharacterId, charAt: string, target: string): Verb {
  if (target === 'floor') return 'move';
  const spot = screen.spots[target];
  if (spot) return charAt === target || spot.hold === true ? abilityOf(char) : 'move';
  if (screen.hotspots[target]) return abilityOf(char);
  throw new Error(`화면 ${screen.id}에 없는 대상: ${target}`);
}

/** 동사 → 무장 버튼 id. `move`는 버튼이 없다(3절). */
function verbButton(verb: Verb, char: CharacterId): HudId {
  if (verb === abilityOf(char)) return HUD.ability;
  if (verb === 'hand') return HUD.hand;
  if (verb === 'look') return HUD.look;
  if (verb === 'item') throw new Error('item 동사는 M1 재생 범위 밖 (화면 1은 열쇠를 얻는 순간 클리어)');
  if (verb === 'move') throw new Error('move는 무장 버튼이 없다: 지금 서 있는 자리나 hold 자리로 move는 탭으로 못 고른다');
  throw new Error(`${char}는 ${verb} 능력이 없다`);
}

const inside = (p: Point, b: HitBox) => distanceToBox(p, b) === 0;

/**
 * 상자 안에서 다른 대상(blockers)에 닿지 않는 점. 중심에서 가까운 순으로 찾는다.
 * 다른 대상과 거리가 0보다 크면 판정(hit.ts: 가까운 대상 우선)에서 이 대상이 이긴다. 터치 8px 여유가 있어도 같다.
 */
export function clearPoint(box: HitBox, blockers: readonly HitBox[]): Point | null {
  const cx = Math.floor(box.left + box.width / 2);
  const cy = Math.floor(box.top + box.height / 2);
  const pts: Point[] = [];
  for (let y = box.top; y <= box.top + box.height; y++) {
    for (let x = box.left; x <= box.left + box.width; x++) pts.push({ x, y });
  }
  pts.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.y - b.y || a.x - b.x);
  return pts.find((p) => blockers.every((b) => !inside(p, b))) ?? null;
}

/** 정답 행동 하나 → 누를 곳 (10절). 배치 사본 하나로 전환·무장 뒤 상태까지 따라간다. */
export function planAction(screen: ScreenData, layout: Layout, action: Action, input: Input, opts: PlanOptions = {}): Plan {
  const char = action.char;
  const taps: Tap[] = [];
  const warnings: string[] = [];
  let armed = layout.armed;

  const hudTap = (id: string, why: string) => {
    const b = layout.hud[id];
    if (!b) throw new Error(`훅 hud에 ${id} 없음`);
    taps.push({ id, at: clearPoint(b, [])!, why });
  };

  // 1. 캐릭터 전환 (전환하면 무장이 풀린다, 3절)
  if (layout.active !== char) {
    hudTap(HUD.char(char), `${char}로 전환`);
    armed = null;
  }

  // 2. 동사: 기본 탭과 같으면 대상만, 다르면 무장
  const charAt = layout.at[char];
  if (charAt === undefined) throw new Error(`훅 at에 ${char} 없음`);
  const def = defaultVerb(screen, char, charAt, action.target);
  const verbByDefault = def === action.verb;
  if (!verbByDefault) {
    const btn = verbButton(action.verb, char);
    if (armed !== btn) hudTap(btn, `${action.verb} 무장`);
    armed = btn;
  } else if (armed !== null) {
    // 남은 무장을 풀어야 기본 동사가 나온다. 같은 버튼을 다시 누르면 풀린다.
    hudTap(armed, '남은 무장 해제');
    armed = null;
  }

  // 3. 대상 점: 다른 대상에 가리지 않는 곳
  const holdNow = screen.spots[charAt]?.hold === true;
  let point: Point;
  if (action.target === 'floor') {
    if (!opts.floorPoint) throw new Error('floor 대상에는 floorPoint가 필요하다');
    point = opts.floorPoint;
  } else {
    const box = layout.spots[action.target] ?? layout.hotspots[action.target];
    if (!box) throw new Error(`훅에 대상 상자 없음: ${action.target}`);
    const blockers: HitBox[] = [
      HUD_GUARD,
      ...Object.entries(layout.spots).filter(([id]) => id !== action.target).map(([, b]) => b),
      ...Object.entries(layout.hotspots).filter(([id]) => id !== action.target).map(([, b]) => b),
    ];
    // 무장 중에는 캐릭터를 건너뛴다(3절). 무장 없으면 다른 캐릭터는 가리고, 내 몸은 hold일 때만 가린다(2절).
    if (armed === null) {
      for (const [id, b] of Object.entries(layout.chars) as [CharacterId, HitBox][]) {
        if (id !== char || holdNow) blockers.push(b);
      }
    }
    const p = clearPoint(box, blockers);
    if (!p) {
      warnings.push(`${action.target}: 다른 대상에 다 가려서 중심을 누름 (판정이 다른 대상으로 갈 수 있음)`);
      point = clearPoint(box, [])!;
    } else point = p;
  }

  // 4. 터치는 step 행동이 되는 탭을 2번 (4절). 바닥(`free` 자리)에서 바닥 걷기만 1번(`interact.ts` floorIntent).
  const fromFree = charAt === 'floor' || screen.spots[charAt]?.free === true;
  const isStepTap = action.target !== 'floor' || !fromFree;
  const times = input === 'touch' && isStepTap ? 2 : 1;
  for (let i = 0; i < times; i++) {
    taps.push({ id: action.target, at: point, why: times === 2 ? (i === 0 ? '선택(첫 탭)' : '실행(같은 대상 다시 탭)') : `${action.verb} 실행` });
  }
  return { taps, verbByDefault, warnings };
}
