// 스프라이트 시트 메타데이터 해석과 프레임 고르기 (#140). 순수 로직이다. 이미지 로드·그리기는 engine/sprites.ts.
// 메타 형식은 docs/decisions/2026-11-15-sprite-asset-pipeline.md 5절(시트는 가로 한 줄, 좌표는 칸 왼쪽 위 기준 px).
//
// 시트에 없는 자세는 null을 돌려준다. 엔진은 null이면 임시 실루엣을 그린다.
// 그래서 한 캐릭터만, 한 자세만 그림이 생겨도 게임이 깨지지 않는다.

import { opaqueAt, type AlphaMask } from './alpha';
import { MIN_HIT_SIZE } from './characters';
import type { HitBox } from './hit';
import type { Facing } from './walk';

/**
 * n번째 변형 이름(#765 2/2, ADR-0761 H5 "두 번째부터는 짧은 판"): `이름#k`(k ≥ 2)는 같은 규칙·폴백이 k번째 이상 돌 때 `이름` 대신 쓴다.
 * 캐릭터 시트 `anims`와 물건 메타 `anims['대상.이름']` 둘 다 같은 꼴이다. 아니면 null.
 */
export function parseNthName(name: string): { base: string; k: number } | null {
  const m = /^(.+)#([0-9]+)$/.exec(name);
  if (!m) return null;
  const k = Number(m[2]);
  return k >= 2 && String(k) === m[2] ? { base: m[1]!, k } : null;
}

export type SpriteAnim = ({ frames: number[]; ms: number[] } | { frames: number[]; by: 'distance' }) & {
  /**
   * 이 자세 동안 고정할 방향. `hold`(고리 손 기준점이 이 방향으로 맞춰져 있다, #182)와,
   * 매달린 채 재생하는 연출(`reach_hang_up`)에 쓴다. 연출의 `facing`은 그 연출 동안 `hold`보다 앞선다(#189).
   */
  facing?: Facing;
  /**
   * 칸 위로 나가는 장대(파이프라인 기록 5-1절). 프레임마다 칸 안에서 장대가 나가는 점(오른쪽을 본 시트 기준).
   * x는 픽셀 경계(연속 좌표)라 2px 장대의 가운데선이다. 있으면 `claw`도 프레임마다 있다.
   * null인 칸은 장대가 칸 안에 들어와 잇지 않는다(#284 `reach_wobble` 3번 칸). 첫 칸은 null이 아니다.
   */
  tip?: ([x: number, y: number] | null)[];
  /**
   * 든 물건을 얹는 점(ADR-1031 4·5절, 쭉이 손 1칸). 프레임마다 [x, y](오른쪽을 본 시트 기준, 뒤집기는 `tip`과 같은 규칙).
   * x는 장대 가운데선(픽셀 경계), y는 장대 끝 갈고리 위 외곽선 행. 든 물건 그림의 아래 가운데를 이 점에 맞춘다.
   * 갈고리가 칸 안에 그려진 칸에만 쓰고, 장대를 이어 그리지 않는다(`tip`과 다른 점). 서 있기·걷기(`CARRY_FULL`)는 모든 칸에 있다.
   * 집기·내려놓기 연출(#1053)은 `null` 칸을 둘 수 있다: 그 칸 동안 물건은 쭉이 손이 아니라 놓인 자리에 그린다. 적어도 한 칸은 점이다.
   */
  carry?: ([x: number, y: number] | null)[];
  /** 프레임마다 집게 칸 번호(시트 최상위 `claw` 줄). tip이 null인 칸은 null. */
  claw?: (number | null)[];
  /**
   * 프레임마다 장대 마디 위상(#194, ADR-0007 장대 3조각 "마디 이음매 한 주기 = 8px"): tip 행부터 아래로 첫 마디 행까지 px(0~7).
   * 그 행(tip 4px)이 마디 그림이다. 엔진은 이은 구간에서 8px마다 이 행을 찍어 시트 장대의 마디 무늬를 위로 잇는다.
   * 없으면 마디 없이 tip 행만 늘인다. tip이 null인 칸은 null.
   */
  joint?: (number | null)[];
  /**
   * 실패 연출(#284 `reach_wobble`): 장대 끝(집게 기준점)이 대상 점 y보다 이만큼 아래에서 멈춘다(px). 집게 높이보다 크게 두면
   * 대상에 안 닿은 채 "바로 아래"에서 멈춘다. 없으면 대상 점까지 닿는다. tip 있는 자세에만.
   */
  short?: number;
  /**
   * 이 자세를 그리는 동안의 클릭 상자 [x, y, w, h](칸 왼쪽 위 기준, 오른쪽을 본 시트). 매달린 자세(`hand` 있음)에
   * `art/build.mjs`가 그 자세 모든 칸 그림 상자의 합집합으로 적는다(#203). 없으면 시트 최상위 `hit`(서 있기 0번).
   */
  hit?: [x: number, y: number, w: number, h: number];
  /**
   * 칸 신호(파이프라인 기록 5-2절, #199). 이 연출의 몇 번째 칸(0부터)이 "박자" 칸인가.
   * 화면 데이터 show에서 이 연출 바로 뒤의 `fx` 하나는 연출이 끝난 뒤가 아니라 이 칸이 시작될 때 뜬다(그 뒤 fx는 연출이 끝난 뒤 차례로).
   * 무엇을 띄울지는 화면 데이터가, 언제인지만 시트가 정한다(시트는 fx 이름을 모른다). `ms` 자세에만 둔다.
   * 오름차순 배열이면 신호가 여럿이다(`ability-feedback.md` 4절): k번째 신호는 이 연출 바로 뒤에 이어진 fx 중 k번째를 띄운다.
   * 숫자 하나는 `[n]`과 같다.
   */
  cue?: number | number[];
  /**
   * 공중 칸 [첫, 끝](칸 순서, 시트 파이프라인 기록 5-4절, #414). 이 칸들 동안 엔진이 몸을 궤적 위에 놓고, 끝 다음 칸(착지 칸)이
   * 시작되는 틱에 내려앉는다(묵직이 `seesaw_stomp`, `magpie_nest.md` 1-6-2절). 높이는 엔진 상수(`HOP`)다. `ms` 자세에만 둔다.
   */
  air?: [first: number, last: number];
};

/** 장대 끝 집게 칸 줄(5-1절). `anchor`는 장대가 들어오는 아래 가운데(픽셀 경계). */
export interface ClawMeta {
  image: string;
  cell: [w: number, h: number];
  anchor: [x: number, y: number];
  /**
   * 장대가 칸 위로 늘어나는 최대 px(#284). 대상 점이 이보다 멀면 여기서 멈춘다(바닥에서 둥지 = "높이가 모자람"이 그림으로 보임).
   * 대상 점이 없는 연출(고리 등 `reachPoint` 없는 대상)은 이 길이까지 늘인다. 없으면 대상 점까지 다 잇고, 대상 점이 없으면 잇지 않는다.
   */
  max?: number;
  /** 연출 시작부터 다 늘어날 때까지 ms(#284). 그 사이 길이는 시간에 비례한다. 없으면 첫 장부터 다 늘어난 채. */
  growMs?: number;
}

export interface SpriteMeta {
  image: string;
  character: string;
  cell: [w: number, h: number];
  anchor: [x: number, y: number];
  hit: [x: number, y: number, w: number, h: number];
  /** UI 초상화(HUD 얼굴 칸)로 자를 칸 안 사각형 [x, y, w, h]. `idle` 첫 칸에서 자른다(ADR-0007 결정 4, 설계 6-1절). */
  head?: [x: number, y: number, w: number, h: number];
  walkCycle: number;
  anims: Record<string, SpriteAnim>;
  claw?: ClawMeta;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const intTuple = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every(isInt);

/** 장대 마디 주기(ADR-0007 장대 3조각: 마디 이음매 한 주기 = 8px). */
export const POLE_JOINT = 8;

/** 메타 JSON을 검사한다. 형식이 틀리면 그 캐릭터는 실루엣으로 남기도록 이유를 던진다. */

/**
 * `carry`가 모든 칸에 있어야 하는 자세(서 있기·걷기, ADR-1031). 이 자세를 그리는 동안 든 물건은 늘 손에 있다.
 * 다른 자세(집기·내려놓기 연출, #1053)는 `null` 칸으로 "아직/이미 놓인 자리" 칸을 적는다.
 */
export const CARRY_FULL: ReadonlySet<string> = new Set(['idle', 'walk']);
export function parseSpriteMeta(raw: unknown): SpriteMeta {
  const m = raw as Partial<SpriteMeta>;
  const fail = (why: string): never => {
    throw new Error(`스프라이트 메타 오류(${String(m?.character)}): ${why}`);
  };
  if (typeof m !== 'object' || m === null) return fail('객체가 아님');
  if (typeof m.image !== 'string' || typeof m.character !== 'string') fail('image·character 없음');
  if (!intTuple(m.cell, 2) || !intTuple(m.anchor, 2) || !intTuple(m.hit, 4)) fail('cell·anchor·hit 형식');
  if (m.head !== undefined) {
    const [hx, hy, hw, hh] = (intTuple(m.head, 4) ? m.head : fail('head는 [x, y, w, h]')) as number[];
    if (hx! < 0 || hy! < 0 || hw! <= 0 || hh! <= 0 || hx! + hw! > m.cell![0] || hy! + hh! > m.cell![1]) fail('head가 칸 밖');
  }
  if (!isInt(m.walkCycle) || m.walkCycle <= 0) fail('walkCycle');
  if (typeof m.anims !== 'object' || m.anims === null) fail('anims 없음');
  const claw = m.claw as Partial<ClawMeta> | undefined;
  if (claw !== undefined && (typeof claw.image !== 'string' || !intTuple(claw.cell, 2) || !intTuple(claw.anchor, 2))) fail('claw 형식');
  if (claw?.max !== undefined && (!isInt(claw.max) || claw.max <= 0)) fail('claw.max는 양의 정수 px');
  if (claw?.growMs !== undefined && (!isInt(claw.growMs) || claw.growMs <= 0)) fail('claw.growMs는 양의 정수 ms');
  type RawAnim = {
    frames?: unknown[];
    ms?: unknown[];
    by?: unknown;
    facing?: unknown;
    tip?: unknown;
    carry?: unknown;
    claw?: unknown;
    joint?: unknown;
    hit?: unknown;
    cue?: unknown;
    short?: unknown;
    air?: unknown;
  };
  for (const [name, a] of Object.entries(m.anims as Record<string, RawAnim>)) {
    if (!Array.isArray(a.frames) || a.frames.length === 0 || !a.frames.every(isInt)) fail(`${name}.frames`);
    if ('by' in a) {
      if (a.by !== 'distance') fail(`${name}.by`);
    } else if (!Array.isArray(a.ms) || a.ms.length !== a.frames!.length || !a.ms.every((t) => isInt(t) && t > 0)) {
      fail(`${name}.ms는 frames와 길이가 같은 양의 정수 배열`);
    }
    if ('facing' in a && a.facing !== 1 && a.facing !== -1) fail(`${name}.facing은 1 또는 -1`);
    if ('cue' in a) {
      const n = a.frames!.length;
      const cues = Array.isArray(a.cue) ? a.cue : [a.cue];
      const inRange = (c: unknown): boolean => isInt(c) && c >= 0 && c < n;
      const ascending = cues.every((c, i) => i === 0 || (c as number) > (cues[i - 1] as number));
      if (!('ms' in a) || cues.length === 0 || !cues.every(inRange) || !ascending) fail(`${name}.cue는 ms 자세의 칸 순서(0~${n - 1}) 하나 또는 오름차순 배열`);
    }
    if ('air' in a) {
      const n = a.frames!.length;
      const air = a.air as number[];
      if (!('ms' in a) || !intTuple(air, 2) || air[0]! < 0 || air[1]! < air[0]! || air[1]! >= n - 1) fail(`${name}.air는 ms 자세의 [첫, 끝] 칸 순서(끝 다음에 착지 칸, 0~${n - 2})`);
    }
    if ('tip' in a || 'claw' in a) {
      const n = a.frames!.length;
      if (!claw) fail(`${name}.tip이 있는데 시트 claw가 없음`);
      if (!Array.isArray(a.tip) || a.tip.length !== n || !a.tip.every((t) => t === null || intTuple(t, 2)) || a.tip[0] === null) {
        fail(`${name}.tip은 프레임마다 [x, y] 또는 null(첫 칸은 [x, y])`);
      }
      const tips = a.tip as unknown[];
      const some = (v: unknown, i: number): boolean => (tips[i] === null ? v === null : isInt(v) && v >= 0);
      if (!Array.isArray(a.claw) || a.claw.length !== n || !a.claw.every(some)) fail(`${name}.claw는 tip 있는 칸마다 집게 칸 번호, 없는 칸은 null`);
    }
    if ('carry' in a) {
      const [cw, ch] = m.cell as [number, number];
      const inCell = (c: unknown): boolean => intTuple(c, 2) && (c as number[])[0]! >= 0 && (c as number[])[0]! <= cw && (c as number[])[1]! >= 0 && (c as number[])[1]! < ch;
      const full = CARRY_FULL.has(name);
      const ok = (c: unknown): boolean => (c === null ? !full : inCell(c));
      if (!Array.isArray(a.carry) || a.carry.length !== a.frames!.length || !a.carry.every(ok) || !a.carry.some((c) => c !== null)) {
        fail(full ? `${name}.carry는 프레임마다 칸 안의 [x, y]` : `${name}.carry는 프레임마다 칸 안의 [x, y] 또는 null(점이 한 칸 이상)`);
      }
    }
    if ('joint' in a) {
      if (!('tip' in a)) fail(`${name}.joint는 tip 있는 자세에만`);
      const tips = a.tip as unknown[];
      const ok = (j: unknown, i: number): boolean => (tips[i] === null ? j === null : isInt(j) && j >= 0 && j < POLE_JOINT);
      if (!Array.isArray(a.joint) || a.joint.length !== a.frames!.length || !a.joint.every(ok)) {
        fail(`${name}.joint는 tip 있는 칸마다 0~${POLE_JOINT - 1}, 없는 칸은 null`);
      }
    }
    if ('short' in a && (!('tip' in a) || !isInt(a.short) || a.short < 0)) fail(`${name}.short는 tip 있는 자세에만, 0 이상 정수 px`);
    if ('hit' in a) {
      const h = a.hit as number[];
      if (!intTuple(h, 4) || h[2]! < MIN_HIT_SIZE || h[3]! < MIN_HIT_SIZE) fail(`${name}.hit은 [x, y, w, h], 폭·높이 ${MIN_HIT_SIZE} 이상`);
    }
    const nth = parseNthName(name);
    if (nth) {
      // n번째 변형(#765 2/2): 같은 자세의 짧은 판. 끝 칸이 같아야 말풍선 동안 남는 칸·다음 연출 이음매가 처음 판과 같다.
      const base = (m.anims as Record<string, RawAnim>)[nth.base];
      if (!base) fail(`${name}: 변형의 원래 자세 '${nth.base}'가 시트에 없음`);
      if (!('ms' in a) || !('ms' in base!)) fail(`${name}: 변형은 ms 자세만`);
      if ('air' in a || 'air' in base!) fail(`${name}: 공중 칸(air) 자세는 변형을 쓰지 않는다(뛰어오르기는 처음 판만)`);
      if (a.frames![a.frames!.length - 1] !== base!.frames![base!.frames!.length - 1]) fail(`${name}: 끝 칸이 '${nth.base}'의 끝 칸과 같아야 한다`);
    }
  }
  return m as SpriteMeta;
}

/** 그릴 때 필요한 캐릭터 상황. 엔진이 장면 상태에서 만든다. */
export interface Pose {
  /** 걷는 중이면 이번 걸음에서 걸은 거리(px). 서 있으면 null. */
  walkedPx: number | null;
  /** `hold` 자리(고리 등)에 매달려 있다. */
  holding: boolean;
  /** 이 캐릭터에게 재생 중인 `anim` 이벤트 이름(`common.bump_bottom` 등)과 시작 뒤 지난 ms. */
  event: { name: string; ms: number } | null;
  /**
   * 시소 끝에 오르내리는 깡충 중이면 `step_up` 칸 번호(0 웅크림·착지, 1 공중, `magpie_nest.md` 1-5-3절, #397). 아니면 null·없음.
   * 시트에 `step_up`이 없으면 서 있기(`idle`) 첫 칸으로 그린다.
   */
  hop?: 0 | 1 | null;
  /** 전역 시간(ms). 서 있기 반복용. */
  clockMs: number;
  /** 지금 행동의 대상 점(핫스팟 `reachPoint`). 장대를 칸 밖으로 이을 때 쓴다(5-1절). 없으면 잇지 않는다. */
  reach?: { x: number; y: number } | null;
}

/** 지금 그리는 자세. `spriteFrame`과 같은 우선순위이고, 시트에 없으면 undefined(실루엣). */
function poseAnim(meta: SpriteMeta, pose: Pose): SpriteAnim | undefined {
  if (pose.event) return meta.anims[pose.event.name];
  if (pose.hop != null) return meta.anims.step_up ?? meta.anims.idle;
  if (pose.holding) return meta.anims.hold;
  if (pose.walkedPx !== null) return meta.anims.walk;
  return meta.anims.idle;
}

/**
 * 지금 자세에 자기 클릭 상자(`hit`)가 있으면 화면 상자, 없으면 null(호출자가 서 있기 기준 상자를 쓴다, #203).
 * 그리는 위치와 같은 규칙이다(`spriteBox`). 왼쪽을 보면 칸을 뒤집으니 열 [x, x+w)는 칸 안 [cw−x−w, cw−x)로 간다.
 */
export function spriteHit(meta: SpriteMeta, pose: Pose, x: number, y: number, facing: Facing): HitBox | null {
  const hit = poseAnim(meta, pose)?.hit;
  if (!hit) return null;
  const [hx, hy, hw, hh] = hit;
  const box = spriteBox(meta, x, y, facing);
  const left = facing === 1 ? box.left + hx : box.left + (meta.cell[0] - hx - hw);
  return { left, top: box.top + hy, width: hw, height: hh };
}

/**
 * 그릴 프레임 번호. 시트에 그 자세가 없으면 null(실루엣).
 * 우선순위: 이벤트 연출 > 깡충(`step_up`, #397) > 매달림(`hold`) > 걷기(`walk`) > 서 있기(`idle`).
 * 이벤트 이름은 화면 데이터의 `anim` 이름 그대로 시트 `anims` 키로 찾는다(데이터만 더하면 붙는다).
 */
export function spriteFrame(meta: SpriteMeta, pose: Pose): number | null {
  if (pose.event) {
    const a = meta.anims[pose.event.name];
    return a ? a.frames[timedIndex(a, pose.event.ms, false)]! : null;
  }
  if (pose.hop != null) {
    const up = meta.anims.step_up;
    if (up) return up.frames[Math.min(pose.hop, up.frames.length - 1)]!;
    const idle = meta.anims.idle;
    return idle ? idle.frames[0]! : null;
  }
  if (pose.holding) {
    const a = meta.anims.hold;
    return a ? a.frames[timedIndex(a, pose.clockMs, true)]! : null;
  }
  if (pose.walkedPx !== null) {
    const a = meta.anims.walk;
    if (!a) return null;
    // 결정 기록 5절: 프레임 = floor(걸은 거리 / (walkCycle / 장 수)) % 장 수. 시간이 아니라 거리라 발이 안 미끄러진다.
    const n = a.frames.length;
    const i = Math.floor(pose.walkedPx / (meta.walkCycle / n)) % n;
    return a.frames[i]!;
  }
  const a = meta.anims.idle;
  return a ? a.frames[timedIndex(a, pose.clockMs, true)]! : null;
}

/**
 * 그릴 방향. 연출 자세에 `facing`이 있으면 그 연출 동안 그 방향(#189, 둥지 뻗기).
 * 매달린 동안은 시트 `hold.facing`이 있으면 그 방향이다(걸어온 방향과 상관없이 주먹이 고리에 맞게).
 * 매달린 채 `facing` 없는 연출(찌릿 등)이 재생돼도 같은 자리에 있으니 방향을 바꾸지 않는다. 그 밖에는 걷는 방향 그대로.
 */
export function spriteFacing(meta: SpriteMeta, pose: Pose, walking: Facing): Facing {
  const own = pose.event ? meta.anims[pose.event.name]?.facing : undefined;
  return own || (pose.holding && meta.anims.hold?.facing) || walking;
}

/**
 * 칸 신호가 오는 시각들(ms, 연출 시작 기준, 오름차순). 시트에 그 연출이나 `cue`가 없으면 빈 배열(→ 신호 없음, 연출 끝난 뒤 fx).
 */
export function cueMs(meta: SpriteMeta | undefined, name: string): number[] {
  const a = meta?.anims[name];
  if (!a || !('ms' in a) || a.cue === undefined) return [];
  const ms = a.ms;
  return (Array.isArray(a.cue) ? a.cue : [a.cue]).map((c) => ms.slice(0, c).reduce((x, y) => x + y, 0));
}

/** `ms` 애니메이션의 지금 칸 순서(0부터). 반복하지 않으면 마지막 칸에 머문다. 거리 넘김 애니메이션은 첫 칸. */
function timedIndex(a: SpriteAnim, ms: number, loop: boolean): number {
  if (!('ms' in a)) return 0;
  const total = a.ms.reduce((x, y) => x + y, 0);
  let t = loop ? ((ms % total) + total) % total : Math.max(0, ms);
  for (let i = 0; i < a.frames.length; i++) {
    t -= a.ms[i]!;
    if (t < 0) return i;
  }
  return a.frames.length - 1;
}

/**
 * 칸 위로 이은 장대와 끝 집게(파이프라인 기록 5-1절, #189). 모든 값은 내부 좌표 정수 px.
 * - 장대: 시트 이미지의 `src` 칸(가로 `width`, 세로 1행 = tip 0행)을 화면 `left`, `top`~`bottom`(미포함)으로 늘려 붙인다.
 * - 마디(#194): 시트 이미지 `jointSrcY` 행(같은 `src.x`·`width`, 1행)을 화면 `joints`의 각 y에 1행씩 덮어 붙인다.
 * - 집게: 집게 줄의 `claw`번 칸을 `clawLeft`·`clawTop`에 그린다. `flip`이면 둘 다 좌우로 뒤집어 붙인다(그 칸 안에서).
 */
export interface PoleDraw {
  src: { x: number; y: number; width: number };
  left: number;
  top: number;
  bottom: number;
  jointSrcY: number;
  joints: number[];
  claw: number;
  clawLeft: number;
  clawTop: number;
  flip: boolean;
}

/** 이은 장대 폭: 장대 2px + 양옆 잉크 1px. tip은 가운데선(픽셀 경계)이다. */
export const POLE_WIDTH = 4;


/**
 * 지금 자세가 `tip` 있는 연출이면 이을 장대. 아니면 null.
 * 장대는 직선(ADR-0003)이라 tip x에서 **수직으로** 대상 점 y 쪽으로 잇는다. 대상 점 x는 쓰지 않는다
 * (2px 장대를 뒤집으면 가운데선이 1px 옮겨 가서, 대상 점으로 꺾으면 중간에 1px 꺾임이 생긴다, PR #188 리뷰).
 * 길이(#284) = min(대상 점 − 자세 `short`까지, 시트 `claw.max`) × min(1, 연출 ms / `claw.growMs`). 대상 점이 없으면 `max`까지, `max`도 없으면 잇지 않는다.
 * 대상 점이 칸 위가 아니면 잇지 않는다. 길이 0(연출 첫 틱)이면 칸 위 끝에 집게만 그린다.
 */
export function spritePole(meta: SpriteMeta, pose: Pose, x: number, y: number, facing: Facing): PoleDraw | null {
  const name = pose.event?.name;
  const a = name ? meta.anims[name] : undefined;
  if (!a?.tip || !a.claw || !meta.claw) return null;
  const { max, growMs } = meta.claw;
  if (!pose.reach && max === undefined) return null;
  const i = timedIndex(a, pose.event!.ms, false);
  const tip = a.tip[i];
  if (!tip) return null;
  const [tx, ty] = tip;
  const box = spriteBox(meta, x, y, facing);
  // 칸 안 연속 좌표 c → 화면: 오른쪽이면 left + c, 왼쪽이면 칸을 뒤집어 left + (w − c).
  const sx = facing === 1 ? box.left + tx : box.left + (meta.cell[0] - tx);
  const bottom = box.top + ty;
  let full = pose.reach ? bottom - Math.round(pose.reach.y) - (a.short ?? 0) : max!;
  if (full <= 0) return null;
  if (max !== undefined) full = Math.min(full, max);
  const grown = growMs === undefined ? 1 : Math.min(1, Math.max(0, pose.event!.ms) / growMs);
  const top = bottom - Math.floor(full * grown);
  const [cw] = meta.claw.cell;
  const [cax, cay] = meta.claw.anchor;
  // 마디: 시트에서 tip 행 아래 joint px가 마디 행이고 8px마다 반복된다 → 이은 구간(top ≤ y < bottom)에서는 bottom + joint − 8m.
  const jp = a.joint?.[i] ?? undefined;
  const joints: number[] = [];
  if (jp !== undefined) for (let jy = bottom + jp - POLE_JOINT; jy >= top; jy -= POLE_JOINT) joints.push(jy);
  return {
    src: { x: frameSourceX(meta, a.frames[i]!) + tx - POLE_WIDTH / 2, y: ty, width: POLE_WIDTH },
    left: sx - POLE_WIDTH / 2,
    top,
    bottom,
    jointSrcY: ty + (jp ?? 0),
    joints,
    claw: a.claw[i]!,
    clawLeft: facing === 1 ? sx - cax : sx - (cw - cax),
    clawTop: top - cay,
    flip: facing === -1,
  };
}

/**
 * 칸을 화면 어디에 그리는지(내부 좌표). 발 위치(x, y)가 기준점이다.
 * 왼쪽을 볼 때는 기준점 `ax` 경계를 축으로 뒤집는다(결정 기록 5절, placeholder.ts와 같은 규칙).
 */
export function spriteBox(meta: SpriteMeta, x: number, y: number, facing: Facing): HitBox {
  const fx = Math.round(x);
  const fy = Math.round(y);
  const [w, h] = meta.cell;
  const [ax, ay] = meta.anchor;
  const left = facing === 1 ? fx - ax : fx - (w - ax);
  return { left, top: fy - ay, width: w, height: h };
}

/**
 * 그린 칸에서 화면 정수 픽셀 (px, py)가 불투명인가(설계 2-1절 그림 칸, #736). 자리·뒤집기는 `drawSprite`와 같다.
 * (x, y)는 그리는 발 위치(판 높이 포함, 반올림 전). 왼쪽을 보면 칸 열 c가 화면 x = 발 x + anchor x − c − 1에 간다.
 */
export function spriteOpaqueAt(meta: SpriteMeta, mask: AlphaMask, frame: number, x: number, y: number, facing: Facing, px: number, py: number): boolean {
  const box = spriteBox(meta, x, y, facing);
  const dx = px - box.left;
  const dy = py - box.top;
  if (dx < 0 || dy < 0 || dx >= box.width || dy >= box.height) return false;
  const cx = facing === 1 ? dx : meta.cell[0] - 1 - dx;
  return opaqueAt(mask, frameSourceX(meta, frame) + cx, dy);
}

/** 프레임 번호 → 시트 이미지 안의 원본 x(가로 한 줄 배치). */
/**
 * HUD 얼굴 칸에 그릴 시트 사각형(설계 6-1-1절). `idle` 첫 칸의 `head` 박스다.
 * `head`나 `idle`이 없으면 null(얼굴 대신 임시 색 칸).
 */
export function headSource(meta: SpriteMeta): { x: number; y: number; width: number; height: number } | null {
  const frame = meta.anims.idle?.frames[0];
  if (!meta.head || frame === undefined) return null;
  const [x, y, width, height] = meta.head;
  return { x: frameSourceX(meta, frame) + x, y, width, height };
}

export function frameSourceX(meta: SpriteMeta, frame: number): number {
  return frame * meta.cell[0];
}

/**
 * 낮은 자세 문턱(#464). 칸의 불투명 위끝이 시트 기본 `hit` 위끝보다 이만큼 **넘게** 낮을 때만 말풍선·별·▼가 따라 내려간다.
 * 걷기·숨쉬기·쿵처럼 서 있는 자세는 위끝이 최대 5px 출렁여서(세 시트 실측) 앵커가 흔들리지 않게 묶어 둔다.
 * 납작(27px 이상)·엉덩방아(10px 이상)·바구니에 숨기(13px 이상)는 넘는다. 값은 #464 완료 조건("머리 위 8px 안")과 같다.
 */
export const LOW_POSE_PX = 8;

/**
 * 칸마다 불투명 픽셀 위끝(칸 안 y, #464). 시트는 가로 한 줄(파이프라인 기록 5절)이다. 빈 칸은 null.
 * `rgba`는 시트 전체 RGBA 바이트(`ImageData.data`), `width`는 시트 폭 px. 시트를 읽을 때 한 번만 부른다.
 */
export function cellTops(rgba: ArrayLike<number>, width: number, cell: readonly [number, number], count: number): (number | null)[] {
  const [cw, ch] = cell;
  const tops: (number | null)[] = [];
  for (let i = 0; i < count; i++) {
    let top: number | null = null;
    for (let y = 0; y < ch && top === null; y++) {
      const row = y * width + i * cw;
      for (let x = 0; x < cw; x++) {
        if (rgba[(row + x) * 4 + 3]! > 0) {
          top = y;
          break;
        }
      }
    }
    tops.push(top);
  }
  return tops;
}

/**
 * 말풍선·별·▼의 높이(칸 안 y, #464). 기본은 시트 `hit` 위끝(지금까지와 같다).
 * 지금 칸의 불투명 위끝이 그보다 `LOW_POSE_PX` 넘게 낮으면(납작·엉덩방아) 그 위끝을 쓰고 `low`로 표시한다.
 * `low`면 호출자는 서 있기 히트 박스 위끝과 비교하지 않는다(그러면 다시 서 있는 높이로 올라간다).
 */
export function headTop(meta: SpriteMeta, cellTop: number | null): { y: number; low: boolean } {
  const base = meta.hit[1];
  if (cellTop !== null && cellTop - base > LOW_POSE_PX) return { y: cellTop, low: true };
  return { y: base, low: false };
}
