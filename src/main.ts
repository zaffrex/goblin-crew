// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// M0: 캐릭터 1명이 클릭한 바닥으로 걸어간다 (#35). 그림은 임시(placeholder)다.

import { INTERNAL_HEIGHT, INTERNAL_WIDTH, WALK_AREA } from './core/config';
import { click, createGame, step } from './core/game';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawRoom, drawSock, drawTarget } from './engine/placeholder';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hud = document.querySelector<HTMLElement>('#hud');
if (!canvas || !hud) throw new Error('#game 또는 #hud 요소가 없습니다');

const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
const state = createGame();

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p) => {
  click(state, p);
  hud.hidden = true; // 안내는 첫 클릭 뒤 숨긴다
});
hud.textContent = '바닥을 클릭하거나 탭하면 쭉이가 걸어가요';

function render(): void {
  const { ctx, internal } = display;
  drawRoom(ctx, internal, WALK_AREA);
  if (state.actor.target) drawTarget(ctx, state.actor.target, state.tick);
  drawSock(ctx, state.actor);
  display.present();
}

startLoop({ step: () => step(state), render });
