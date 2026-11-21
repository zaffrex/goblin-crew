import { describe, expect, it } from 'vitest';
import { createPauseClock, gameNow, ROTATE_ARROW, ROTATE_BOX, ROTATE_COLORS, ROTATE_PHONE, rotateGridCW, setPaused } from './rotate';
import { createRestartButton, RESTART_ARM_MS, restartArmed, restartPress } from './restart';

describe('아이콘 격자 (9-3절)', () => {
  it('휴대폰 12×20, 화살표 12×10, 팔레트 글자만 쓴다', () => {
    expect(ROTATE_PHONE).toHaveLength(20);
    expect(ROTATE_ARROW).toHaveLength(10);
    for (const row of ROTATE_PHONE) expect(row).toHaveLength(12);
    for (const row of ROTATE_ARROW) expect(row).toHaveLength(12);
    for (const row of [...ROTATE_PHONE, ...ROTATE_ARROW]) for (const ch of row) expect(ch === '.' || ch in ROTATE_COLORS).toBe(true);
  });

  it('90° 돌리면 20×12이고 네 번 돌리면 제자리다', () => {
    const b = rotateGridCW(ROTATE_PHONE);
    expect(b).toHaveLength(12);
    for (const row of b) expect(row).toHaveLength(20);
    expect(rotateGridCW(rotateGridCW(rotateGridCW(b)))).toEqual([...ROTATE_PHONE]);
    // 시계 방향: 원래 맨 위 줄(테두리)이 오른쪽 끝 열이 된다.
    expect(b.map((r) => r[19]).join('')).toBe(ROTATE_PHONE[0]);
  });

  it('돌린 휴대폰(0,6)~(19,17)이 화살표(18,0)~(29,9) 칸과 안 겹친다', () => {
    const cells = (grid: readonly string[], ox: number, oy: number): Set<string> => {
      const out = new Set<string>();
      grid.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && out.add(`${ox + x},${oy + y}`)));
      return out;
    };
    const arrow = cells(ROTATE_ARROW, 18, 0);
    for (const [grid, ox, oy] of [[ROTATE_PHONE, 4, 2], [rotateGridCW(ROTATE_PHONE), 0, 6]] as const) {
      for (const c of cells(grid, ox, oy)) {
        expect(arrow.has(c)).toBe(false);
        const [x, y] = c.split(',').map(Number) as [number, number];
        expect(x).toBeLessThan(ROTATE_BOX.width);
        expect(y).toBeLessThan(ROTATE_BOX.height);
      }
    }
  });
});

describe('안내 중 멈추는 시계 (9-5절)', () => {
  it('멈춘 동안은 그 시각에 머물고, 풀린 뒤엔 멈춘 시간만큼 뒤로 간다', () => {
    const c = createPauseClock();
    expect(gameNow(c, 1000)).toBe(1000);
    expect(setPaused(c, true, 1000)).toBe(true);
    expect(setPaused(c, true, 1500)).toBe(false);
    expect(gameNow(c, 4000)).toBe(1000);
    expect(setPaused(c, false, 5000)).toBe(true);
    expect(gameNow(c, 5000)).toBe(1000);
    expect(gameNow(c, 6000)).toBe(2000);
  });

  it('처음부터 버튼 3초가 안내 동안 풀리지 않는다(돌아오면 남은 시간 그대로)', () => {
    const c = createPauseClock();
    const r = createRestartButton();
    restartPress(r, gameNow(c, 0));
    setPaused(c, true, 1000);
    expect(restartArmed(r, gameNow(c, 60_000))).toBe(true);
    setPaused(c, false, 60_000);
    expect(restartArmed(r, gameNow(c, 60_000 + RESTART_ARM_MS - 1000 - 1))).toBe(true);
    expect(restartArmed(r, gameNow(c, 60_000 + RESTART_ARM_MS - 1000))).toBe(false);
  });
});
