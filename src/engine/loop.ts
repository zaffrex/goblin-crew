// requestAnimationFrame 루프. 코어는 고정 틱(step)으로, 렌더는 프레임마다 한 번.

import { consumeFrame } from '../core/fixedStep';
import { TICK_MS } from '../core/config';

const MAX_STEPS_PER_FRAME = 5;

export interface LoopHandlers {
  step(): void;
  render(): void;
}

export function startLoop(handlers: LoopHandlers): () => void {
  let acc = 0;
  let last = performance.now();
  let rafId = 0;

  function frame(now: number): void {
    const r = consumeFrame(acc, now - last, TICK_MS, MAX_STEPS_PER_FRAME);
    last = now;
    acc = r.remainderMs;
    for (let i = 0; i < r.steps; i++) handlers.step();
    handlers.render();
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}
