import { describe, expect, it } from 'vitest';
import { CHAR_SLOTS, GAUGE_BAND, GOAL_ZONE, HUD_AREA } from './hud';
import type { HitBox } from './hit';
import { HUD_BOX } from './puzzle/validate';
import { createRestartButton, loadingDone, LOAD_TIMEOUT_MS, RESTART_ARM_MS, RESTART_BOX, restartArmed, restartPress } from './restart';
import { INTERNAL_WIDTH } from './config';

const overlap = (a: HitBox, b: HitBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

describe('처음부터 버튼 자리 (#387)', () => {
  it('validate.ts HUD_BOX 안이다(화면 데이터가 이 자리에 대상을 못 둔다)', () => {
    const [x, y, w, h] = HUD_BOX;
    expect(RESTART_BOX.left).toBeGreaterThanOrEqual(x);
    expect(RESTART_BOX.top).toBeGreaterThanOrEqual(y);
    expect(RESTART_BOX.left + RESTART_BOX.width).toBeLessThanOrEqual(x + w);
    expect(RESTART_BOX.top + RESTART_BOX.height).toBeLessThanOrEqual(y + h);
    expect(RESTART_BOX.left + RESTART_BOX.width).toBeLessThanOrEqual(INTERNAL_WIDTH);
  });

  it('얼굴 칸·HUD 영역·목표 줄·게이지 띠와 안 겹치고, 마지막 얼굴 칸과 16px 이상 떨어져 있다', () => {
    for (const b of [HUD_AREA, GOAL_ZONE, GAUGE_BAND, ...Object.values(CHAR_SLOTS)]) expect(overlap(RESTART_BOX, b)).toBe(false);
    const lastFace = Math.max(...Object.values(CHAR_SLOTS).map((s) => s.left + s.width));
    expect(RESTART_BOX.left - lastFace).toBeGreaterThanOrEqual(16);
  });

  it('28×28 아이콘 버튼이다(#390, 얼굴 칸과 같은 크기, HUD 시트 칸 20×20 + 4px 여백). 시트 칸은 engine/hudIcons.test.ts가 본다', () => {
    expect(RESTART_BOX.width).toBe(28);
    expect(RESTART_BOX.height).toBe(28);
  });
});

describe('처음부터 버튼 두 번 누르기 (#387)', () => {
  it('첫 누름은 대기만, 3초 안 두 번째 누름이 재시작', () => {
    const r = createRestartButton();
    expect(restartPress(r, 1000)).toBe(false);
    expect(restartArmed(r, 1000 + RESTART_ARM_MS - 1)).toBe(true);
    expect(restartPress(r, 1000 + RESTART_ARM_MS - 1)).toBe(true);
    // 재시작 뒤엔 다시 처음부터 센다
    expect(restartArmed(r, 1000 + RESTART_ARM_MS)).toBe(false);
    expect(restartPress(r, 5000)).toBe(false);
  });

  it('3초가 지나면 풀려서 다음 누름은 다시 첫 누름이다', () => {
    const r = createRestartButton();
    restartPress(r, 0);
    expect(restartArmed(r, RESTART_ARM_MS)).toBe(false);
    expect(restartPress(r, RESTART_ARM_MS)).toBe(false);
    expect(restartPress(r, RESTART_ARM_MS + 10)).toBe(true);
  });
});

describe('로딩 끝 판정 (#387)', () => {
  it('읽히는 중인 그림이 하나라도 있으면 기다린다', () => {
    expect(loadingDone(['ready', 'loading', 'none'], 500)).toBe(false);
  });
  it('none(그림 없음)과 ready만 있으면 끝', () => {
    expect(loadingDone(['ready', 'none', 'ready'], 0)).toBe(true);
    expect(loadingDone([], 0)).toBe(true);
  });
  it('상한을 넘으면 다 안 와도 시작한다(404로 영영 loading인 경우)', () => {
    expect(loadingDone(['loading'], LOAD_TIMEOUT_MS - 1)).toBe(false);
    expect(loadingDone(['loading'], LOAD_TIMEOUT_MS)).toBe(true);
  });
});
