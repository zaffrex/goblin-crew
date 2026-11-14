// 가변 프레임 시간(rAF)을 고정 틱 횟수로 바꾼다. 탭 전환 후 긴 공백에서
// 수백 틱을 몰아서 돌지 않도록 한 프레임의 최대 틱 수를 제한한다.

export interface FixedStepResult {
  steps: number;
  remainderMs: number;
}

export function consumeFrame(accumulatedMs: number, frameMs: number, tickMs: number, maxSteps: number): FixedStepResult {
  let acc = accumulatedMs + Math.max(0, frameMs);
  let steps = Math.floor(acc / tickMs);
  if (steps > maxSteps) {
    steps = maxSteps;
    acc = 0; // 밀린 시간은 버린다 (따라잡기보다 멈췄다 이어가는 편이 퍼즐 게임에 자연스럽다)
  } else {
    acc -= steps * tickMs;
  }
  return { steps, remainderMs: acc };
}
