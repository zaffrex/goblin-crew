// 처음부터 버튼과 로딩 화면 (#387, #286 P1-7). 판정만 여기 두고 DOM·장면 교체는 main.ts가 한다.
// 진마씨 2차 플레이: 꼬이거나 기절한 뒤 다시 하려면 새로고침뿐이었고, 그림이 읽히는 동안 색 블록(임시 방·상자)이 보였다.

import type { Loaded } from './fallbacks';
import type { HitBox } from './hit';

/**
 * 처음부터 버튼 자리(내부 px): HUD 영역 오른쪽, x 416–476 × y 4–32. 높이는 얼굴 칸(28)과 같아 휴대폰에서도 누를 만하다.
 * 얼굴 칸 끝(x 392)과 24px 떨어뜨려 얼굴을 누르려다 잘못 누르지 않게 한다. `validate.ts` `HUD_BOX`(300,4,176,72) 안이라
 * 화면 데이터의 핫스팟·서는 자리와 겹치지 않는다(테스트가 본다).
 */
export const RESTART_BOX: HitBox = { left: 416, top: 4, width: 60, height: 28 };

/** 첫 번째 누름 뒤 두 번째를 기다리는 시간(ms). 지나면 다시 처음 누름으로 센다. */
export const RESTART_ARM_MS = 3000;

/** 버튼 상태. `armedAt`: 첫 번째로 누른 시각(ms). 안 눌렸으면 null. */
export interface RestartButton {
  armedAt: number | null;
}

export function createRestartButton(): RestartButton {
  return { armedAt: null };
}

/** 지금 두 번째 누름을 기다리는 중인가. 시간이 지났으면 풀어 둔다. */
export function restartArmed(r: RestartButton, now: number): boolean {
  if (r.armedAt !== null && now - r.armedAt >= RESTART_ARM_MS) r.armedAt = null;
  return r.armedAt !== null;
}

/**
 * 버튼을 눌렀다. 두 번째 누름(3초 안)이면 true → 호출한 쪽이 처음 상태로 되돌린다.
 * 한 번에 되돌리지 않는 이유: 진행이 다 날아가는 버튼인데, 휴대폰에서 얼굴 칸·나무 쪽을 누르다 닿을 수 있다.
 */
export function restartPress(r: RestartButton, now: number): boolean {
  if (restartArmed(r, now)) {
    r.armedAt = null;
    return true;
  }
  r.armedAt = now;
  return false;
}

/**
 * 로딩이 이보다 길면 남은 그림을 기다리지 않고 시작한다(ms). 이미지가 404·끊김이면 `loading`에서 영영 안 바뀌어서,
 * 상한이 없으면 화면이 로딩에 갇힌다. 그때는 예전처럼 임시 그림으로 그린다(A4 콘솔 에러가 따로 잡는다).
 */
export const LOAD_TIMEOUT_MS = 10000;

/** 그림이 다 왔나(`none`은 그림 자체가 없어서 기다릴 것이 없다). 시간이 상한을 넘었으면 다 안 와도 true. */
export function loadingDone(states: readonly Loaded[], elapsedMs: number): boolean {
  return elapsedMs >= LOAD_TIMEOUT_MS || states.every((s) => s !== 'loading');
}
