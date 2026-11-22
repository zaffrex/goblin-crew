import { describe, expect, it } from 'vitest';
import { layoutReport } from './check';
import { loadScene, screenIds } from './load';
import type { SceneData } from '../../src/core/scene';

const clone = (d: SceneData): SceneData => ({ ...d, screen: structuredClone(d.screen) });

describe('layout-check (#768)', () => {
  it.each(screenIds())('%s: error 0 (시작 몸 겹침 없음, 바닥 물건마다 설 자리 있음)', (id) => {
    const r = layoutReport(loadScene(id));
    expect(r.problems.filter((p) => p.level === 'error')).toEqual([]);
    expect(r.stands.length).toBeGreaterThan(0);
  });

  it('설 곳은 엔진 approachPoint 그대로: laundromat 셔터 오른쪽 옆, 몸 왼쪽이 모서리에서 2px', () => {
    const r = layoutReport(loadScene('laundromat'));
    const s = r.stands.find((x) => x.char === 'mukjik' && x.target === 'shutter' && x.side === 'right')!;
    // 셔터 오른쪽 끝 152 + 틈 2 + 묵직이 몸(dx −22, 폭 39) → 152 + 2 + (−22) + 39 = 171
    expect(s).toMatchObject({ x: 171, y: 244 });
    // 왼쪽은 걷기 영역 끝(16)에서도 셔터와 겹쳐서 그쪽 설 곳이 없다
    expect(r.stands.some((x) => x.target === 'shutter' && x.side === 'left')).toBe(false);
  });

  it('stand-neighbor: 두 바닥 물건 사이가 몸 폭보다 좁으면 warning (laundromat dryer_3 ↔ soap_vending 16px)', () => {
    const r = layoutReport(loadScene('laundromat'));
    const w = r.problems.filter((p) => p.code === 'stand-neighbor');
    expect(w.every((p) => p.level === 'warning')).toBe(true);
    expect(w.some((p) => p.message.includes('dryer_3 오른쪽') && p.message.includes('soap_vending('))).toBe(true);
  });

  it('start-body: 시작 자리를 셔터 쪽으로 옮기면 error', () => {
    const d = clone(loadScene('laundromat'));
    d.screen.spots.floor!.x = 170; // ノビー 130, 셔터는 24–152
    const r = layoutReport(d);
    expect(r.problems.some((p) => p.code === 'start-body' && p.level === 'error' && p.message.startsWith('jjuk'))).toBe(true);
  });

  it('no-side: 걷기 영역을 다 덮는 바닥 물건은 error', () => {
    const d = clone(loadScene('laundromat'));
    d.screen.hotspots.wall = { box: [0, 180, 480, 64] };
    const r = layoutReport(d);
    expect(r.problems.some((p) => p.code === 'no-side' && p.message.includes('wall('))).toBe(true);
  });

  it('높은 대상 아래 바닥 물건 앞에 서는 건 보고하지 않는다 (magpie_nest 둥지 밑 바구니)', () => {
    const r = layoutReport(loadScene('magpie_nest'));
    expect(r.stands.some((s) => s.target === 'nest')).toBe(true);
    expect(r.problems.some((p) => p.message.includes('→ nest'))).toBe(false);
  });
});
