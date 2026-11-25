// 회색 배치 검사(#768). 화면 JSON만 읽고 엔진 함수(`createScene`·`approachPoint`)로 실제로 서는 자리를 계산해
// 몸 상자 겹침을 본다. 정적 규칙(상자 크기·화면 밖·HUD·목표 줄·걷기 영역)은 `validate.ts`가 이미 본다.
// 여기는 그 다음 단계: 사람이 걸어가 섰을 때다. 설계 자료용이고 퍼즐 상태를 바꾸지 않는다.

import { CHARACTERS, characterDef, characterHitBox } from '../../src/core/characters';
import { HIGH_TARGET_LINE, walkAreaOf } from '../../src/core/config';
import type { HitBox } from '../../src/core/hit';
import type { WalkArea } from '../../src/core/walk';
import { hotspotBox } from '../../src/core/interact';
import { approachPoint, createScene, type SceneData } from '../../src/core/scene';
import type { CharacterId, PuzzleState, Verb } from '../../src/core/puzzle/types';

export interface LayoutProblem {
  /**
   * error `start-body`: 시작 몸이 바닥 물건 앞에 겹친다(첫 화면부터 물건을 가린다).
   * error `no-side`: 바닥 물건 양옆 어디에도 몸이 들어갈 자리가 없다(어디서 와도 물건 앞에 겹쳐 선다).
   * warning `stand-neighbor`: 바닥 물건 옆에 서면 몸이 이웃 바닥 물건 앞에 겹친다(두 물건 사이가 몸 폭보다 좁다).
   */
  code: 'start-body' | 'no-side' | 'stand-neighbor';
  level: 'error' | 'warning';
  message: string;
}

export interface StandRow {
  char: CharacterId;
  verb: Verb;
  target: string;
  /** 어느 쪽에서 걸어왔나. */
  side: 'left' | 'right';
  /** 처음 플래그 위에 얹은 것(핫스팟 변형 상자를 고른다). 처음 상태면 빈 객체. */
  flags: Readonly<Record<string, boolean>>;
  x: number;
  y: number;
}

export interface LayoutReport {
  screen: string;
  stands: StandRow[];
  problems: LayoutProblem[];
}

const overlaps = (a: HitBox, b: HitBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** 바닥 대상: 상자 아래 끝이 `HIGH_TARGET_LINE`보다 아래(`approachPoint`의 `high` 반대). 높은 대상 앞에 서는 건 정상이라 안 본다. */
const isFloor = (b: HitBox): boolean => b.top + b.height > HIGH_TARGET_LINE;

const fmt = (b: HitBox): string => `${b.left},${b.top} ${b.width}×${b.height}`;

/** 걸어가서 하는 동사: 걷는 특기(`stretch`·`stomp`) + 손. `squeak`·`look`은 돌아서기만 해서 설 곳이 안 바뀐다. */
function walkVerbs(char: CharacterId): Verb[] {
  const ability = characterDef(char).ability;
  return ability === 'stretch' || ability === 'stomp' ? [ability, 'hand'] : ['hand'];
}

/** 처음 상태 + 핫스팟 변형마다 그 `when` 플래그를 얹은 상태. 변형 상자도 한 번씩 본다. 클리어 뒤(`exitFlag`)는 입력이 없어 뺀다. */
function flagStates(data: SceneData): Record<string, boolean>[] {
  const out: Record<string, boolean>[] = [{}];
  const seen = new Set(['{}']);
  for (const hs of Object.values(data.screen.hotspots))
    for (const v of hs.variants ?? []) {
      if (v.when.flags[data.screen.exitFlag] === true) continue;
      const key = JSON.stringify(v.when.flags);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...v.when.flags });
    }
  return out;
}

/** 걷기 영역 안에서 `side` 쪽 끝 x. 그 x에서 몸이 대상과 안 겹치면 그쪽에 설 자리가 있다. */
function sideFrom(area: WalkArea, char: CharacterId, side: 'left' | 'right', y: number, target: HitBox): { x: number; y: number } | null {
  const x = side === 'left' ? area.left : area.right;
  const face = side === 'left' ? 1 : -1;
  return overlaps(characterHitBox(characterDef(char), x, y, face), target) ? null : { x, y };
}

export function layoutReport(data: SceneData): LayoutReport {
  const s = createScene(data);
  const area = walkAreaOf(data.screen);
  const problems: LayoutProblem[] = [];
  const stands: StandRow[] = [];
  const ids = Object.keys(data.screen.hotspots);
  const floorBoxes = (p: PuzzleState): [string, HitBox][] =>
    ids.flatMap((id) => {
      const b = hotspotBox(data.screen, p, id);
      return b && isFloor(b) ? [[id, b] as [string, HitBox]] : [];
    });

  // 1. 시작 배치. 처음 보는 방향은 화면마다 달라서 두 방향 다 본다.
  for (const c of CHARACTERS) {
    const w = s.walkers[c.id]!;
    for (const [id, b] of floorBoxes(s.puzzle)) {
      if (([1, -1] as const).some((f) => overlaps(characterHitBox(characterDef(c.id), w.x, w.y, f), b)))
        problems.push({ code: 'start-body', level: 'error', message: `${c.id} 시작 ${w.x},${w.y}: 몸이 ${id}(${fmt(b)}) 앞에 겹친다` });
    }
  }

  // 2. 설 곳. 바닥 자리(`free`)에 선 사람이 걷기 영역 양 끝에서 각 대상으로 걸어갔을 때.
  const y = s.walkers[CHARACTERS[0]!.id]!.y;
  const seenMsg = new Set<string>();
  const add = (p: LayoutProblem): void => {
    if (seenMsg.has(p.message)) return;
    seenMsg.add(p.message);
    problems.push(p);
  };
  for (const flags of flagStates(data)) {
    const puzzle: PuzzleState = { ...s.puzzle, flags: { ...s.puzzle.flags, ...flags } };
    const floors = floorBoxes(puzzle);
    const tag = Object.keys(flags).length ? ` [${Object.entries(flags).map(([k, v]) => `${k}=${v}`).join(', ')}]` : '';
    for (const c of CHARACTERS) {
      if (!data.screen.spots[puzzle.at[c.id] ?? '']?.free) continue;
      for (const verb of walkVerbs(c.id))
        for (const target of ids) {
          const tb = hotspotBox(data.screen, puzzle, target);
          if (!tb) continue;
          const floorTarget = isFloor(tb);
          const sides = (['left', 'right'] as const).filter((side) => !floorTarget || sideFrom(area, c.id, side, y, tb));
          if (floorTarget && sides.length === 0)
            add({ code: 'no-side', level: 'error', message: `${c.id} → ${target}(${fmt(tb)})${tag}: 양옆 어디에도 몸이 들어갈 자리가 없다` });
          for (const side of sides) {
            const from = floorTarget ? sideFrom(area, c.id, side, y, tb)! : { x: side === 'left' ? area.left : area.right, y };
            const ap = approachPoint(data, puzzle, { char: c.id, verb, target }, from);
            if (!ap) continue;
            stands.push({ char: c.id, verb, target, side, flags, x: ap.x, y: ap.y });
            if (!floorTarget) continue; // 높은 대상 아래 바닥 물건 앞에 서는 건 설계대로다(장대 밑 바구니 등)
            const body = characterHitBox(characterDef(c.id), ap.x, ap.y, ap.face ?? (side === 'left' ? 1 : -1));
            for (const [id, b] of floors)
              if (id !== target && overlaps(body, b))
                add({
                  code: 'stand-neighbor',
                  level: 'warning',
                  message: `${c.id} → ${target} ${side === 'left' ? '왼쪽' : '오른쪽'}에 서면(${ap.x},${ap.y})${tag}: 몸이 ${id}(${fmt(b)}) 앞에 겹친다`,
                });
          }
        }
    }
  }
  return { screen: data.screen.id, stands, problems };
}
