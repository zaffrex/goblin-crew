import { describe, expect, it } from 'vitest';
import meta from '../../public/ui/hud-icons.json';
import { RESTART_BOX } from '../core/restart';

// 시트 메타만 본다(hudIcons.ts는 불러오는 순간 Image를 만들어서 node에서 못 부른다).
describe('HUD 아이콘 시트 (#390)', () => {
  it('처음부터 버튼 아이콘 칸이 있고, 칸이 버튼 28×28 가운데에 4px 여백으로 들어간다', () => {
    expect(meta.icons).toHaveProperty('restart');
    expect(meta.cell).toEqual([20, 20]);
    expect(RESTART_BOX.width - meta.cell[0]!).toBe(8);
    expect(RESTART_BOX.height - meta.cell[1]!).toBe(8);
  });

  it('칸 번호가 0부터 빈틈없이 이어진다(배경 위치 = -칸 × 20 × 배율이 맞으려면)', () => {
    expect(Object.values(meta.icons).sort((a, b) => a - b)).toEqual([...Object.keys(meta.icons).keys()]);
  });
});
