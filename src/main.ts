// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 양말 3명. 다른 양말을 누르면 조작 캐릭터가 바뀌고, 바닥을 누르면 걸어간다 (#43). 그림은 임시(placeholder)다.

import { walkerHitBox } from './core/characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, WALK_AREA } from './core/config';
import { activeChar, click, createGame, step } from './core/game';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawActiveMarker, drawRoom, drawSock, drawTarget } from './engine/placeholder';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hud = document.querySelector<HTMLElement>('#hud');
if (!canvas || !hud) throw new Error('#game 또는 #hud 요소가 없습니다');

const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
const state = createGame();

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p, slop) => {
  // 첫 '걷기'까지는 안내를 남겨 둔다. 양말만 바꿔 본 사람도 바닥을 누르는 법을 알아야 한다.
  if (click(state, p, slop).kind === 'walk') hud.hidden = true;
});
hud.textContent = '양말을 누르면 그 양말로 바뀌고, 바닥을 누르면 걸어가요';

function render(): void {
  const { ctx, internal } = display;
  drawRoom(ctx, internal, WALK_AREA);
  const me = activeChar(state);
  if (me.target) drawTarget(ctx, me.target, state.tick);
  // 깊이 순서: 발이 위(y가 작음)인 캐릭터부터. 판정의 z(발 y)와 같은 기준이다.
  const order = [...state.chars].sort((a, b) => Math.round(a.y) - Math.round(b.y) || (a.id < b.id ? 1 : -1));
  for (const c of order) drawSock(ctx, c);
  const box = walkerHitBox(me);
  drawActiveMarker(ctx, box.top, me.x, state.tick);
  display.present();
}

startLoop({ step: () => step(state), render });
