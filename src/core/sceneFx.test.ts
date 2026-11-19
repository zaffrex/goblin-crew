// 팔레트·빌드 표와 같은지는 tests/art/scene-fx.test.ts(노드 파일 읽기가 필요해서 core 밖)에서 본다.
import { describe, expect, it } from 'vitest';
import { FX_MAX_PARTICLES, fxParticles, WATER_FLIGHT_MS, type FxParticle, type SceneFxDraw } from './sceneFx';

/** #424 회색 배치 값 */
const AREA = [152, 8, 144, 172] as const;
const COLORS = [26, 25, 6, 24] as const;
const water = (over: Partial<SceneFxDraw> = {}): SceneFxDraw => ({
  key: 'water',
  effect: 'fountain_water',
  area: AREA,
  colors: COLORS,
  mode: 'on',
  clockMs: 0,
  slotMs: 0,
  durMs: 0,
  ...over,
});
const key = (ps: FxParticle[]) => ps.map((p) => `${p.x},${p.y},${p.size},${p.color}`).join(' ');
const top = (ps: FxParticle[]) => Math.min(...ps.map((p) => p.y));

describe('fountain_water (11-4절)', () => {
  it('on: 입자 96개 이하, area 안, 정수, 1~2px, colors 4색만', () => {
    for (const clockMs of [0, 17, 400, 799, 12345]) {
      const ps = fxParticles(water({ clockMs }));
      expect(ps.length).toBeGreaterThan(0);
      expect(ps.length).toBeLessThanOrEqual(FX_MAX_PARTICLES);
      for (const p of ps) {
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        expect([1, 2]).toContain(p.size);
        expect(COLORS).toContain(p.color);
        expect(p.x).toBeGreaterThanOrEqual(AREA[0]);
        expect(p.y).toBeGreaterThanOrEqual(AREA[1]);
        expect(p.x + p.size).toBeLessThanOrEqual(AREA[0] + AREA[2]);
        expect(p.y + p.size).toBeLessThanOrEqual(AREA[1] + AREA[3]);
      }
    }
  });

  it('결정적: 같은 시계면 같은 픽셀, 시계가 흐르면 움직인다', () => {
    expect(key(fxParticles(water({ clockMs: 1234 })))).toBe(key(fxParticles(water({ clockMs: 1234 }))));
    expect(key(fxParticles(water({ clockMs: 1234 })))).not.toBe(key(fxParticles(water({ clockMs: 1250 }))));
  });

  it('on 높이는 area 높이 ÷ 1.5 안쪽이다(위쪽은 burst 몫)', () => {
    const onTop = Math.min(...Array.from({ length: 50 }, (_, i) => top(fxParticles(water({ clockMs: i * 16 })))));
    const onH = AREA[3] / 1.5;
    expect(onTop).toBeGreaterThanOrEqual(Math.floor(AREA[1] + AREA[3] - onH));
    expect(onTop).toBeLessThan(AREA[1] + AREA[3] - onH * 0.7); // 꽤 높이 솟는다
  });

  it('off: 아무것도 안 그린다', () => {
    expect(fxParticles(water({ mode: 'off', clockMs: 500 }))).toEqual([]);
  });

  it('stop: 시작 순간은 on과 같고, 점점 줄다가 비행 시간 뒤에는 비어 off와 이어진다', () => {
    const c0 = 5000;
    expect(key(fxParticles(water({ mode: 'stop', clockMs: c0, slotMs: 0, durMs: 900 })))).toBe(key(fxParticles(water({ clockMs: c0 }))));
    const counts = [0, 200, 400, 600, 799].map((t) => fxParticles(water({ mode: 'stop', clockMs: c0 + t, slotMs: t, durMs: 900 })).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1]!);
    expect(fxParticles(water({ mode: 'stop', clockMs: c0 + WATER_FLIGHT_MS, slotMs: WATER_FLIGHT_MS, durMs: 900 }))).toEqual([]);
  });

  it('stop: 아래부터 꺼진다(남은 물방울은 이미 떠서 떨어지는 중)', () => {
    // 반쯤 지나면 바닥 근처에서 막 뿜은(올라가는) 물방울이 없다 → 남은 것은 전부 비행 후반
    const c0 = 5000, t = 400;
    const left = fxParticles(water({ mode: 'stop', clockMs: c0 + t, slotMs: t, durMs: 900 }));
    const all = fxParticles(water({ clockMs: c0 + t }));
    expect(left.length).toBeLessThan(all.length);
    // 남은 것 중 올라가는 물방울(물 밝음 색)은 없다. 올라가는 물이 있는 on과 대비
    expect(left.filter((p) => p.color === COLORS[0])).toEqual([]);
    expect(all.filter((p) => p.color === COLORS[0]).length).toBeGreaterThan(0);
  });

  it('burst: 꺼진 물에서 시작해 on보다 높이 솟고, 끝나면 on 첫 박자와 같다', () => {
    const c0 = 8000, dur = 1200;
    expect(fxParticles(water({ mode: 'burst', clockMs: c0, slotMs: 0, durMs: dur })).length).toBeLessThanOrEqual(1);
    const burstTop = Math.min(...Array.from({ length: 75 }, (_, i) => top(fxParticles(water({ mode: 'burst', clockMs: c0 + i * 16, slotMs: i * 16, durMs: dur }))) || Infinity));
    const onTop = Math.min(...Array.from({ length: 75 }, (_, i) => top(fxParticles(water({ clockMs: c0 + i * 16 })))));
    expect(burstTop).toBeLessThan(onTop - 20);
    expect(burstTop).toBeGreaterThanOrEqual(AREA[1]);
    // anim 끝(slotMs = dur) = on의 그 화면 시계
    expect(key(fxParticles(water({ mode: 'burst', clockMs: c0 + dur, slotMs: dur, durMs: dur })))).toBe(key(fxParticles(water({ clockMs: c0 + dur }))));
  });

  it('모르는 효과는 빈 목록(빌드 검사가 먼저 막는다)', () => {
    expect(fxParticles(water({ effect: 'washer_foam' }))).toEqual([]);
  });
});
