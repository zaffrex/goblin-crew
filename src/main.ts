// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 지금은 스캐폴딩이라 빈 화면과 클릭 좌표 표시만 한다 (#22).

import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './core/config';
import { click, createGame, step } from './core/game';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hud = document.querySelector<HTMLElement>('#hud');
if (!canvas || !hud) throw new Error('#game 또는 #hud 요소가 없습니다');

const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
const state = createGame();

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p) => {
  click(state, p);
  hud.textContent = `클릭: (${p.x}, ${p.y})`;
});
hud.textContent = '화면을 클릭하거나 탭해 보세요';

function render(): void {
  const { ctx } = display;
  const { width: w, height: h } = display.internal;

  // 바닥 격자: 16px 칸. 배율이 고른지(픽셀 굵기) 눈으로 확인하는 용도.
  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#34374f';
  for (let y = 0; y < h; y += 16) {
    for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < w; x += 32) ctx.fillRect(x, y, 16, 16);
  }
  // 테두리 1px: 가장자리 픽셀이 잘리지 않는지 확인.
  ctx.fillStyle = '#8d99ae';
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h - 1, w, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(w - 1, 0, 1, h);

  // 마지막 클릭 위치 십자 표시.
  if (state.lastClick) {
    const { x, y } = state.lastClick;
    ctx.fillStyle = '#ef233c';
    ctx.fillRect(x - 4, y, 9, 1);
    ctx.fillRect(x, y - 4, 1, 9);
  }

  // 틱이 도는지 보이는 1px 점 (1초에 한 바퀴).
  ctx.fillStyle = '#edf2f4';
  ctx.fillRect(2 + (state.tick % 60), h - 4, 1, 1);

  display.present();
}

startLoop({ step: () => step(state), render });
