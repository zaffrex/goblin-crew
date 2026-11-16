// 스프라이트 시트 메타데이터 해석과 프레임 고르기 (#140). 순수 로직이다. 이미지 로드·그리기는 engine/sprites.ts.
// 메타 형식은 docs/decisions/2026-11-15-sprite-asset-pipeline.md 5절(시트는 가로 한 줄, 좌표는 칸 왼쪽 위 기준 px).
//
// 시트에 없는 자세는 null을 돌려준다. 엔진은 null이면 임시 실루엣을 그린다.
// 그래서 한 캐릭터만, 한 자세만 그림이 생겨도 게임이 깨지지 않는다.

import type { HitBox } from './hit';
import type { Facing } from './walk';

export type SpriteAnim = ({ frames: number[]; ms: number[] } | { frames: number[]; by: 'distance' }) & {
  /** 이 자세 동안 고정할 방향. 지금은 `hold`만 쓴다(고리 손 기준점이 이 방향으로 맞춰져 있다, #182). */
  facing?: Facing;
};

export interface SpriteMeta {
  image: string;
  character: string;
  cell: [w: number, h: number];
  anchor: [x: number, y: number];
  hit: [x: number, y: number, w: number, h: number];
  walkCycle: number;
  anims: Record<string, SpriteAnim>;
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
  for (const [name, a] of Object.entries(m.anims as Record<string, { frames?: unknown[]; ms?: unknown[]; by?: unknown; facing?: unknown }>)) {
    if (!Array.isArray(a.frames) || a.frames.length === 0 || !a.frames.every(isInt)) fail(`${name}.frames`);
    if ('by' in a) {
      if (a.by !== 'distance') fail(`${name}.by`);
    } else if (!Array.isArray(a.ms) || a.ms.length !== a.frames!.length || !a.ms.every((t) => isInt(t) && t > 0)) {
      fail(`${name}.ms는 frames와 길이가 같은 양의 정수 배열`);
    }
    if ('facing' in a && a.facing !== 1 && a.facing !== -1) fail(`${name}.facing은 1 또는 -1`);
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
}

/**
 * 그릴 프레임 번호. 시트에 그 자세가 없으면 null(실루엣).
 * 우선순위: 이벤트 연출 > 매달림(`hold`) > 걷기(`walk`) > 서 있기(`idle`).
 * 이벤트 이름은 화면 데이터의 `anim` 이름 그대로 시트 `anims` 키로 찾는다(데이터만 더하면 붙는다).
 */
export function spriteFrame(meta: SpriteMeta, pose: Pose): number | null {
  if (pose.event) {
    const a = meta.anims[pose.event.name];
    return a ? timedFrame(a, pose.event.ms, false) : null;
  }
  if (pose.holding) {
    const a = meta.anims.hold;
    return a ? timedFrame(a, pose.clockMs, true) : null;
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
  return a ? timedFrame(a, pose.clockMs, true) : null;
}

/**
 * 그릴 방향. 매달린 동안은 시트 `hold.facing`이 있으면 그 방향이다(걸어온 방향과 상관없이 주먹이 고리에 맞게).
 * 매달린 채 연출(찌릿 등)이 재생돼도 같은 자리에 있으니 방향을 바꾸지 않는다. 그 밖에는 걷는 방향 그대로.
 */
export function spriteFacing(meta: SpriteMeta, pose: Pose, walking: Facing): Facing {
  return (pose.holding && meta.anims.hold?.facing) || walking;
}

/** `ms` 애니메이션의 지금 프레임. 반복하지 않으면 마지막 프레임에 머문다. 거리 넘김 애니메이션은 첫 프레임. */
function timedFrame(a: SpriteAnim, ms: number, loop: boolean): number {
  if (!('ms' in a)) return a.frames[0]!;
  const total = a.ms.reduce((x, y) => x + y, 0);
  let t = loop ? ((ms % total) + total) % total : Math.max(0, ms);
  for (let i = 0; i < a.frames.length; i++) {
    t -= a.ms[i]!;
    if (t < 0) return a.frames[i]!;
  }
  return a.frames[a.frames.length - 1]!;
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
