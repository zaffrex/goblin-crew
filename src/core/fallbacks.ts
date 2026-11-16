// 임시 그림 세기 (#142, M1 판정 2 시작 조건 "배포본에 실루엣 없음").
// 엔진이 한 프레임을 그리면서 실제 그림 대신 임시 그림(캐릭터 실루엣, 임시 방, 임시 상자)을 쓴 곳을 이름으로 돌려준다.
// 재생 도구 `scripts/playtest/replay.ts`가 `?playtest=1` 훅으로 모아 A7 칸에 적는다. 그림이 아직 읽히는 중인 프레임은 세지 않는다.

import type { Pose } from './sprite';

/** 그림 한 장의 상태. `none`: 그림 자체가 없음(시트 없음, 배경 draft). `loading`: 요청했지만 아직 안 옴. */
export type Loaded = 'none' | 'loading' | 'ready';

/** 시트 자세 이름. 재생 중인 연출이 있으면 그 이름, 아니면 매달림·걷기·서 있기. `spriteFrame`이 고르는 순서와 같다. */
export function poseKey(p: Pose): string {
  if (p.event) return p.event.name;
  if (p.holding) return 'hold';
  return p.walkedPx !== null ? 'walk' : 'idle';
}

export interface FrameArt {
  /** 화면 배경. */
  bg: Loaded;
  /** 화면 물건 시트. */
  objects: Loaded;
  /** 이번 프레임에 임시 상자로 그린 대상 ID(물건 시트가 그리지 않는 것). */
  boxes: readonly string[];
  /** 캐릭터마다: 시트 상태, 이번 프레임에 시트 그림으로 그렸는지, 자세. */
  chars: readonly { id: string; sheet: Loaded; drawn: boolean; pose: Pose }[];
}

/**
 * 이번 프레임의 임시 그림 목록. 이름은 `bg`, `box:<대상 ID>`, `char:<캐릭터 ID>:<자세>`.
 * 읽히는 중인 그림은 빼서, 첫 몇 프레임 실루엣 때문에 거짓 경고가 나지 않게 한다.
 * 로드 실패는 `loading`으로 남아 여기서 안 잡힌다. 그건 A4(콘솔 에러, 404)가 잡는다.
 */
export function frameFallbacks(f: FrameArt): string[] {
  const out: string[] = [];
  if (f.bg === 'none') out.push('bg');
  if (f.objects !== 'loading') for (const id of f.boxes) out.push(`box:${id}`);
  for (const c of f.chars) {
    if (c.drawn || c.sheet === 'loading') continue;
    out.push(`char:${c.id}:${poseKey(c.pose)}`);
  }
  return out;
}
