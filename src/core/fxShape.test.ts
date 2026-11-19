import { describe, expect, it } from 'vitest';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import screenJson from '../../content/screens/magpie_nest.json';
import parkJson from '../../content/screens/park_fountain.json';
import { FX_STYLE, FX_TICKS } from './fx';
import { drawnByShape, frameNudges, fxNudges, HOP_PX, HOP_TICKS, NUDGE_FX, nudgeOf, SPLASH_DROPS, WATER_COLORS, WATER_FX, waterParticles } from './fxShape';
import { parseSceneArt, type SceneDraws } from './sceneArt';
import { FX_MAX_PARTICLES } from './sceneFx';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** 화면 JSON의 fx 이름 전부. */
function fxNamesOf(o: unknown): string[] {
  if (Array.isArray(o)) {
    if (o.length === 2 && typeof o[0] === 'string' && typeof o[1] === 'string') return [];
    return o.flatMap(fxNamesOf);
  }
  if (typeof o !== 'object' || o === null) return [];
  return Object.entries(o).flatMap(([k, v]) => (k === 'fx' && Array.isArray(v) && typeof v[0] === 'string' ? [v[0] as string] : fxNamesOf(v)));
}

describe('hop·nod: 물건 그림 옮기기 (#485)', () => {
  it('6틱마다 숙였다 펴기를 두 번, 아래로 1px만', () => {
    const ys = Array.from({ length: FX_TICKS }, (_, t) => nudgeOf('nod', t)?.dy ?? 0);
    expect(ys.slice(0, 24)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    expect(Array.from({ length: FX_TICKS }, (_, t) => nudgeOf('nod', t)?.dx ?? 0).every((x) => x === 0)).toBe(true);
  });

  it('hop: 위로만 한 번 솟았다(최고 3px) 제자리로', () => {
    const ys = Array.from({ length: FX_TICKS }, (_, t) => nudgeOf('hop', t)?.dy ?? 0);
    expect(Math.min(...ys)).toBe(-HOP_PX);
    expect(ys.every((y) => y <= 0)).toBe(true);
    expect(ys[0]).toBe(0);
    expect(ys.slice(HOP_TICKS).every((y) => y === 0)).toBe(true);
  });

  it('끝난 뒤·시작 전·모르는 fx는 옮기지 않는다', () => {
    expect(nudgeOf('nod', FX_TICKS)).toBeNull();
    expect(nudgeOf('nod', -1)).toBeNull();
    expect(nudgeOf('squeak_text', 7)).toBeNull();
  });

  it('shake는 화면 1 재플레이 답 전에는 켜지 않는다(#485)', () => {
    expect(NUDGE_FX.shake).toBeUndefined();
    expect(drawnByShape('shake')).toBe(false);
    // 화면 1이 쓰는 fx 중 여기서 그리는 것이 없어야 배포본 화면 1 모습이 그대로다.
    expect(fxNamesOf(screenJson).filter(drawnByShape)).toEqual([]);
  });

  it('fxNudges: 대상별로 모으고, 0이면 넣지 않는다', () => {
    expect(fxNudges([{ effect: 'nod', target: 'jacket', t: 0 }])).toEqual({});
    expect(fxNudges([{ effect: 'nod', target: 'jacket', t: 7 }, { effect: 'squeak_text', target: 'ppik', t: 7 }])).toEqual({ jacket: { dx: 0, dy: 1 } });
  });
});

describe('frameNudges: 대상 물건의 칸이 다 같이 움직인다', () => {
  it('대상 ID → 물건 키 → 이번 프레임 칸', () => {
    const meta = parseSceneArt(clone(sheetJson));
    const hook = meta.objects.find((o) => o.key === 'hook')!;
    const target = hook.ids[0]!;
    const draws: SceneDraws = { back: [], front: [], overlays: [], byObject: { hook: [3, 4], nest: [1] } };
    const m = frameNudges(meta, draws, { [target]: { dx: 0, dy: 1 } });
    expect([...m.entries()]).toEqual([
      [3, { dx: 0, dy: 1 }],
      [4, { dx: 0, dy: 1 }],
    ]);
    expect(frameNudges(meta, draws, { no_such: { dx: 0, dy: 1 } }).size).toBe(0);
  });
});

describe('splash·ripple: 물 4색 입자 (#485)', () => {
  const at = { x: 200, y: 100 };

  it.each(Object.keys(WATER_FX))('%s: 물 4색만, 1~2px, 상한 안, 결정적', (fx) => {
    for (let t = 0; t < FX_TICKS; t++) {
      const ps = waterParticles(fx, at, t);
      expect(ps.length).toBeLessThanOrEqual(FX_MAX_PARTICLES);
      for (const p of ps) {
        expect(WATER_COLORS).toContain(p.color);
        expect([1, 2]).toContain(p.size);
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      }
      expect(waterParticles(fx, at, t)).toEqual(ps);
    }
  });

  it.each(Object.keys(WATER_FX))('%s: 시작하면 보이고, 길이가 끝나면 없다', (fx) => {
    expect(waterParticles(fx, at, 0).length).toBeGreaterThan(0);
    expect(waterParticles(fx, at, FX_TICKS)).toEqual([]);
    expect(waterParticles(fx, at, -1)).toEqual([]);
  });

  it('splash: 처음엔 위로 솟고(기준점보다 위) 좌우로 퍼진다, 끝나기 전에 다 떨어진다', () => {
    const early = waterParticles('splash', at, 8);
    expect(early.length).toBe(SPLASH_DROPS);
    expect(early.every((p) => p.y < at.y)).toBe(true);
    expect(Math.min(...early.map((p) => p.x))).toBeLessThan(at.x - 3);
    expect(Math.max(...early.map((p) => p.x))).toBeGreaterThan(at.x + 3);
    // 공중에서 한꺼번에 사라지지 않게: 끝나기 몇 틱 전이면 이미 0개 (#486 리뷰)
    expect(waterParticles('splash', at, FX_TICKS - 4)).toEqual([]);
  });

  it('splash: 머리 위 16px·좌우 24px 안에서만 튄다(머리에서 물을 뿜는 것처럼 보이지 않게, #486 리뷰)', () => {
    const all = Array.from({ length: FX_TICKS }, (_, t) => waterParticles('splash', at, t)).flat();
    expect(Math.min(...all.map((p) => p.y))).toBeGreaterThanOrEqual(at.y - 16);
    expect(Math.max(...all.map((p) => Math.abs(p.x - at.x)))).toBeLessThanOrEqual(24);
    expect(all.some((p) => p.color === WATER_COLORS[3])).toBe(false);
  });

  it('ripple: 고리가 기준점 둘레에서 퍼지고 납작하다(가로 > 세로)', () => {
    const ps = waterParticles('ripple', at, 12);
    const w = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    const h = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    expect(w).toBeGreaterThan(h * 2);
    const late = waterParticles('ripple', at, 24);
    expect(Math.max(...late.map((p) => p.x))).toBeGreaterThan(Math.max(...waterParticles('ripple', at, 4).map((p) => p.x)));
  });
});

describe('park_fountain 글자 아닌 fx (#483 Luna가 찾은 5개 + hop)', () => {
  it('hop·nod·splash·ripple은 여기서 그리고, 비둘기 2개만 임시 별로 남는다(shake는 #485 밖)', () => {
    const names = new Set(fxNamesOf(parkJson));
    const notText = [...names].filter((n) => !FX_STYLE[n] && n !== 'shake').sort();
    expect(notText).toEqual(['hop', 'nod', 'pigeons_turn', 'pigeons_up', 'ripple', 'splash']);
    expect(notText.filter((n) => !drawnByShape(n))).toEqual(['pigeons_turn', 'pigeons_up']);
  });
});
