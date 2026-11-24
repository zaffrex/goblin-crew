import { describe, expect, it } from 'vitest';
import sheetJson from '../../public/scenes/magpie_nest-objects.json';
import screenJson from '../../content/screens/magpie_nest.json';
import parkJson from '../../content/screens/park_fountain.json';
import { FX_STYLE, FX_TICKS } from './fx';
import {
  drawnByShape, frameNudges, fxNudges, HOP_PX, HOP_TICKS, NUDGE_FX, nudgeOf, particleFx, RATTLE_TICKS, shapeParticles, SOIL_COLORS, SOIL_FROM, SOIL_HIGH, SOIL_WIDE,
  SPLASH_DROPS, SPLASH_TOP, TEXT_PARTICLE_FX, WATER_COLORS, WATER_FX,
} from './fxShape';
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

  it('rattle: 좌우로만 2px, 잦아들어 fx가 끝나기 전에 제자리(#556)', () => {
    const xs = Array.from({ length: FX_TICKS }, (_, t) => nudgeOf('rattle', t)?.dx ?? 0);
    const ys = Array.from({ length: FX_TICKS }, (_, t) => nudgeOf('rattle', t)?.dy ?? 0);
    expect(ys.every((y) => y === 0)).toBe(true);
    expect(Math.max(...xs)).toBe(2);
    expect(Math.min(...xs)).toBe(-2);
    // 첫 틱부터 보인다(별이 뜨던 자리에서 바로 덜컹), 좌우를 오간다
    expect(xs[0]).not.toBe(0);
    expect(new Set(xs.slice(0, RATTLE_TICKS).map(Math.sign))).toEqual(new Set([1, -1]));
    // 잦아든다: 뒤 절반은 1px 안
    expect(xs.slice(RATTLE_TICKS / 2, RATTLE_TICKS).every((x) => Math.abs(x) <= 1)).toBe(true);
    expect(RATTLE_TICKS).toBeLessThan(FX_TICKS);
    expect(xs.slice(RATTLE_TICKS).every((x) => x === 0)).toBe(true);
    expect(drawnByShape('rattle')).toBe(true);
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
    const draws: SceneDraws = { back: [], front: [], overlays: [], heads: [], byObject: { hook: [3, 4], nest: [1] } };
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
      const ps = shapeParticles(fx, at, t);
      expect(ps.length).toBeLessThanOrEqual(FX_MAX_PARTICLES);
      for (const p of ps) {
        expect(WATER_COLORS).toContain(p.color);
        expect([1, 2]).toContain(p.size);
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      }
      expect(shapeParticles(fx, at, t)).toEqual(ps);
    }
  });

  it.each(Object.keys(WATER_FX))('%s: 시작하면 보이고, 길이가 끝나면 없다', (fx) => {
    expect(shapeParticles(fx, at, 0).length).toBeGreaterThan(0);
    expect(shapeParticles(fx, at, FX_TICKS)).toEqual([]);
    expect(shapeParticles(fx, at, -1)).toEqual([]);
  });

  it('splash: 물벼락, 머리 위 30px 넘는 곳에서 쏟아져 내려와 좌우로 벌어지고, 끝나기 전에 다 떨어진다 (#525)', () => {
    const first = shapeParticles('splash', at, 0);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((p) => p.y <= at.y - SPLASH_TOP)).toBe(true);
    const meanY = (t: number) => { const ps = shapeParticles('splash', at, t); return ps.reduce((n, p) => n + p.y, 0) / ps.length; };
    expect(meanY(14)).toBeGreaterThan(meanY(4) + 10);
    const late = shapeParticles('splash', at, 14);
    expect(Math.min(...late.map((p) => p.x))).toBeLessThan(at.x - 6);
    expect(Math.max(...late.map((p) => p.x))).toBeGreaterThan(at.x + 6);
    // 머리 높이에 닿은 방울이 있다(물벼락을 "맞았다")
    expect(Array.from({ length: FX_TICKS }, (_, t) => shapeParticles('splash', at, t)).flat().some((p) => p.y >= at.y)).toBe(true);
    // 공중에서 한꺼번에 사라지지 않게: 끝나기 몇 틱 전이면 이미 0개 (#486 리뷰)
    expect(shapeParticles('splash', at, FX_TICKS - 4)).toEqual([]);
  });

  it('splash: 방울 수가 늘 32개 이하이고, 어느 방울도 솟지 않는다(머리에서 물을 뿜는 것처럼 보이지 않게, #486 리뷰)', () => {
    for (let t = 0; t < FX_TICKS; t++) expect(shapeParticles('splash', at, t).length).toBeLessThanOrEqual(SPLASH_DROPS);
    const all = Array.from({ length: FX_TICKS }, (_, t) => shapeParticles('splash', at, t)).flat();
    // 가장 높은 방울도 시작 높이(위 30~44px) 안, 가장 낮은 방울은 어깨(아래 12px) 위, 좌우 24px 안
    expect(Math.min(...all.map((p) => p.y))).toBeGreaterThanOrEqual(at.y - SPLASH_TOP - 14);
    expect(Math.max(...all.map((p) => p.y))).toBeLessThanOrEqual(at.y + 12);
    expect(Math.max(...all.map((p) => Math.abs(p.x - at.x)))).toBeLessThanOrEqual(24);
    expect(all.some((p) => p.color === WATER_COLORS[3])).toBe(false);
    // 틱이 갈수록 가장 낮은 방울은 내려가기만 한다(처음 몇 틱, 새 방울은 위에서 생긴다)
    const lowest = Array.from({ length: 10 }, (_, t) => Math.max(...shapeParticles('splash', at, t).map((p) => p.y)));
    for (let t = 1; t < lowest.length; t++) expect(lowest[t]).toBeGreaterThanOrEqual(lowest[t - 1]!);
  });

  it('ripple: 고리가 기준점 둘레에서 퍼지고 납작하다(가로 > 세로)', () => {
    const ps = shapeParticles('ripple', at, 12);
    const w = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    const h = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    expect(w).toBeGreaterThan(h * 2);
    const late = shapeParticles('ripple', at, 24);
    expect(Math.max(...late.map((p) => p.x))).toBeGreaterThan(Math.max(...shapeParticles('ripple', at, 4).map((p) => p.x)));
  });
});

describe('park_fountain 글자 아닌 fx (#483 Luna가 찾은 5개 + hop)', () => {
  // 비둘기 2개(`pigeons_up`·`pigeons_turn`)는 #526에서 물건 anim(`floor.pigeons_*`, 시트 칸)으로 옮겨 fx가 아니다.
  // `shake`는 #556에서 `rattle`로 바꿨다(화면 1 `shake`는 #485대로 그대로 둔다).
  // `ripple`은 S2(#802)에서 쓰는 곳(`fountain_stomp_done` 연못 물결)이 없어졌다. 화면 2가 안 써도 fx 표와 위 모양 검사는 그대로 둔다.
  it('hop·nod·rattle·splash는 여기서 그리고, 임시 별로 남는 글자 아닌 fx가 없다', () => {
    const names = new Set(fxNamesOf(parkJson));
    const notText = [...names].filter((n) => !FX_STYLE[n]).sort();
    expect(notText).toEqual(['hop', 'nod', 'rattle', 'splash']);
    expect(notText.filter((n) => !drawnByShape(n))).toEqual([]);
  });
});

describe('poof_text 흙먼지: 글자 곁 입자 (#526)', () => {
  const at = { x: 224, y: 244 };
  const all = Array.from({ length: FX_TICKS }, (_, t) => shapeParticles('poof_text', at, t));

  it('글자는 그대로 그린다(임시 별·글자 생략 대상이 아니다), 입자 표에서는 발 기준', () => {
    expect(drawnByShape('poof_text')).toBe(false);
    expect(FX_STYLE.poof_text).toBeDefined();
    expect(particleFx('poof_text')).toBe(TEXT_PARTICLE_FX.poof_text);
    expect(TEXT_PARTICLE_FX.poof_text!.anchor).toBe('foot');
    // 화면 1이 쓰는 fx에는 글자 곁 입자가 없다(배포본 화면 1 모습 그대로)
    expect(fxNamesOf(screenJson).filter((n) => particleFx(n) !== undefined)).toEqual([]);
  });

  it('흙 3색만, 1~2px, 상한 안, 결정적, 시작하면 보이고 끝나면 없다', () => {
    all.forEach((ps, t) => {
      expect(ps.length).toBeLessThanOrEqual(FX_MAX_PARTICLES);
      for (const p of ps) {
        expect(SOIL_COLORS).toContain(p.color);
        expect([1, 2]).toContain(p.size);
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      }
      expect(shapeParticles('poof_text', at, t)).toEqual(ps);
    });
    expect(all[0]!.length).toBeGreaterThan(0);
    expect(shapeParticles('poof_text', at, FX_TICKS)).toEqual([]);
    expect(shapeParticles('poof_text', at, -1)).toEqual([]);
  });

  it('낮고 옆으로 넓다: 높이는 발에서 SOIL_HIGH+4px 안, 가로 폭은 높이의 4배 넘게, 양옆으로', () => {
    const flat = all.flat();
    const top = Math.min(...flat.map((p) => p.y));
    expect(top).toBeGreaterThanOrEqual(at.y - SOIL_HIGH - 4);
    expect(Math.max(...flat.map((p) => p.y + p.size))).toBeLessThanOrEqual(at.y);
    expect(Math.max(...flat.map((p) => Math.abs(p.x - at.x)))).toBeLessThanOrEqual(SOIL_WIDE + 2);
    const mid = all[12]!;
    const w = Math.max(...mid.map((p) => p.x)) - Math.min(...mid.map((p) => p.x));
    const h = Math.max(...mid.map((p) => p.y)) - Math.min(...mid.map((p) => p.y));
    expect(w).toBeGreaterThan(h * 4);
    expect(mid.some((p) => p.x < at.x - SOIL_FROM - 4)).toBe(true);
    expect(mid.some((p) => p.x > at.x + SOIL_FROM + 4)).toBe(true);
  });

  it('발 밑(±SOIL_FROM−1px)은 비운다, 시간이 갈수록 더 멀리 번진다', () => {
    for (const p of all.flat()) expect(p.x + p.size <= at.x - SOIL_FROM + 1 || p.x >= at.x + SOIL_FROM - 1).toBe(true);
    const far = (t: number) => Math.max(...all[t]!.map((p) => Math.abs(p.x - at.x)));
    expect(far(14)).toBeGreaterThan(far(2) + 8);
  });

  it('흙길 바탕색(12 c48a52)은 쓰지 않는다: 바탕에 묻힌다', () => {
    expect(SOIL_COLORS).not.toContain(12);
  });
});
