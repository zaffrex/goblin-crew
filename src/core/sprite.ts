// 스프라이트 시트 메타데이터 해석과 프레임 고르기 (#140). 순수 로직이다. 이미지 로드·그리기는 engine/sprites.ts.
// 메타 형식은 docs/decisions/2026-11-15-sprite-asset-pipeline.md 5절(시트는 가로 한 줄, 좌표는 칸 왼쪽 위 기준 px).
//
// 시트에 없는 자세는 null을 돌려준다. 엔진은 null이면 임시 실루엣을 그린다.
// 그래서 한 캐릭터만, 한 자세만 그림이 생겨도 게임이 깨지지 않는다.

import { MIN_HIT_SIZE } from './characters';
import type { HitBox } from './hit';
import type { Facing } from './walk';

export type SpriteAnim = ({ frames: number[]; ms: number[] } | { frames: number[]; by: 'distance' }) & {
  /**
   * 이 자세 동안 고정할 방향. `hold`(고리 손 기준점이 이 방향으로 맞춰져 있다, #182)와,
   * 매달린 채 재생하는 연출(`reach_hang_up`)에 쓴다. 연출의 `facing`은 그 연출 동안 `hold`보다 앞선다(#189).
   */
  facing?: Facing;
  /**
   * 칸 위로 나가는 장대(파이프라인 기록 5-1절). 프레임마다 칸 안에서 장대가 나가는 점(오른쪽을 본 시트 기준).
   * x는 픽셀 경계(연속 좌표)라 2px 장대의 가운데선이다. 있으면 `claw`도 프레임마다 있다.
   */
  tip?: [x: number, y: number][];
  /** 프레임마다 집게 칸 번호(시트 최상위 `claw` 줄). */
  claw?: number[];
  /**
   * 이 자세를 그리는 동안의 클릭 상자 [x, y, w, h](칸 왼쪽 위 기준, 오른쪽을 본 시트). 매달린 자세(`hand` 있음)에
   * `art/build.mjs`가 그 자세 모든 칸 그림 상자의 합집합으로 적는다(#203). 없으면 시트 최상위 `hit`(서 있기 0번).
   */
  hit?: [x: number, y: number, w: number, h: number];
};

/** 장대 끝 집게 칸 줄(5-1절). `anchor`는 장대가 들어오는 아래 가운데(픽셀 경계). */
export interface ClawMeta {
  image: string;
  cell: [w: number, h: number];
  anchor: [x: number, y: number];
}

export interface SpriteMeta {
  image: string;
  character: string;
  cell: [w: number, h: number];
  anchor: [x: number, y: number];
  hit: [x: number, y: number, w: number, h: number];
  walkCycle: number;
  anims: Record<string, SpriteAnim>;
  claw?: ClawMeta;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const intTuple = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every(isInt);

/** 메타 JSON을 검사한다. 형식이 틀리면 그 캐릭터는 실루엣으로 남기도록 이유를 던진다. */
export function parseSpriteMeta(raw: unknown): SpriteMeta {
  const m = raw as Partial<SpriteMeta>;
  const fail = (why: string): never => {
    throw new Error(`스프라이트 메타 오류(${String(m?.character)}): ${why}`);
  };
  if (typeof m !== 'object' || m === null) return fail('객체가 아님');
  if (typeof m.image !== 'string' || typeof m.character !== 'string') fail('image·character 없음');
  if (!intTuple(m.cell, 2) || !intTuple(m.anchor, 2) || !intTuple(m.hit, 4)) fail('cell·anchor·hit 형식');
  if (!isInt(m.walkCycle) || m.walkCycle <= 0) fail('walkCycle');
  if (typeof m.anims !== 'object' || m.anims === null) fail('anims 없음');
  const claw = m.claw as Partial<ClawMeta> | undefined;
  if (claw !== undefined && (typeof claw.image !== 'string' || !intTuple(claw.cell, 2) || !intTuple(claw.anchor, 2))) fail('claw 형식');
  type RawAnim = { frames?: unknown[]; ms?: unknown[]; by?: unknown; facing?: unknown; tip?: unknown; claw?: unknown; hit?: unknown };
  for (const [name, a] of Object.entries(m.anims as Record<string, RawAnim>)) {
    if (!Array.isArray(a.frames) || a.frames.length === 0 || !a.frames.every(isInt)) fail(`${name}.frames`);
    if ('by' in a) {
      if (a.by !== 'distance') fail(`${name}.by`);
    } else if (!Array.isArray(a.ms) || a.ms.length !== a.frames!.length || !a.ms.every((t) => isInt(t) && t > 0)) {
      fail(`${name}.ms는 frames와 길이가 같은 양의 정수 배열`);
    }
    if ('facing' in a && a.facing !== 1 && a.facing !== -1) fail(`${name}.facing은 1 또는 -1`);
    if ('tip' in a || 'claw' in a) {
      const n = a.frames!.length;
      if (!claw) fail(`${name}.tip이 있는데 시트 claw가 없음`);
      if (!Array.isArray(a.tip) || a.tip.length !== n || !a.tip.every((t) => intTuple(t, 2))) fail(`${name}.tip은 프레임마다 [x, y]`);
      if (!Array.isArray(a.claw) || a.claw.length !== n || !a.claw.every((c) => isInt(c) && c >= 0)) fail(`${name}.claw는 프레임마다 집게 칸 번호`);
    }
    if ('hit' in a) {
      const h = a.hit as number[];
      if (!intTuple(h, 4) || h[2]! < MIN_HIT_SIZE || h[3]! < MIN_HIT_SIZE) fail(`${name}.hit은 [x, y, w, h], 폭·높이 ${MIN_HIT_SIZE} 이상`);
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
  /** 전역 시간(ms). 서 있기 반복용. */
  clockMs: number;
  /** 지금 행동의 대상 점(핫스팟 `reachPoint`). 장대를 칸 밖으로 이을 때 쓴다(5-1절). 없으면 잇지 않는다. */
  reach?: { x: number; y: number } | null;
}

/** 지금 그리는 자세. `spriteFrame`과 같은 우선순위이고, 시트에 없으면 undefined(실루엣). */
function poseAnim(meta: SpriteMeta, pose: Pose): SpriteAnim | undefined {
  if (pose.event) return meta.anims[pose.event.name];
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
 * 우선순위: 이벤트 연출 > 매달림(`hold`) > 걷기(`walk`) > 서 있기(`idle`).
 * 이벤트 이름은 화면 데이터의 `anim` 이름 그대로 시트 `anims` 키로 찾는다(데이터만 더하면 붙는다).
 */
export function spriteFrame(meta: SpriteMeta, pose: Pose): number | null {
  if (pose.event) {
    const a = meta.anims[pose.event.name];
    return a ? a.frames[timedIndex(a, pose.event.ms, false)]! : null;
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
 * - 집게: 집게 줄의 `claw`번 칸을 `clawLeft`·`clawTop`에 그린다. `flip`이면 둘 다 좌우로 뒤집어 붙인다(그 칸 안에서).
 */
export interface PoleDraw {
  src: { x: number; y: number; width: number };
  left: number;
  top: number;
  bottom: number;
  claw: number;
  clawLeft: number;
  clawTop: number;
  flip: boolean;
}

/** 이은 장대 폭: 장대 2px + 양옆 잉크 1px. tip은 가운데선(픽셀 경계)이다. */
export const POLE_WIDTH = 4;

/**
 * 지금 자세가 `tip` 있는 연출이고 대상 점이 칸 위에 있으면 이을 장대. 아니면 null.
 * 장대는 직선(ADR-0003)이라 tip x에서 **수직으로** 대상 점 y까지 잇는다. 대상 점 x는 쓰지 않는다
 * (2px 장대를 뒤집으면 가운데선이 1px 옮겨 가서, 대상 점으로 꺾으면 중간에 1px 꺾임이 생긴다, PR #188 리뷰).
 */
export function spritePole(meta: SpriteMeta, pose: Pose, x: number, y: number, facing: Facing): PoleDraw | null {
  const name = pose.event?.name;
  const a = name ? meta.anims[name] : undefined;
  if (!a?.tip || !a.claw || !meta.claw || !pose.reach) return null;
  const i = timedIndex(a, pose.event!.ms, false);
  const [tx, ty] = a.tip[i]!;
  const box = spriteBox(meta, x, y, facing);
  // 칸 안 연속 좌표 c → 화면: 오른쪽이면 left + c, 왼쪽이면 칸을 뒤집어 left + (w − c).
  const sx = facing === 1 ? box.left + tx : box.left + (meta.cell[0] - tx);
  const bottom = box.top + ty;
  const top = Math.round(pose.reach.y);
  if (top >= bottom) return null;
  const [cw] = meta.claw.cell;
  const [cax, cay] = meta.claw.anchor;
  return {
    src: { x: frameSourceX(meta, a.frames[i]!) + tx - POLE_WIDTH / 2, y: ty, width: POLE_WIDTH },
    left: sx - POLE_WIDTH / 2,
    top,
    bottom,
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

/** 프레임 번호 → 시트 이미지 안의 원본 x(가로 한 줄 배치). */
export function frameSourceX(meta: SpriteMeta, frame: number): number {
  return frame * meta.cell[0];
}
