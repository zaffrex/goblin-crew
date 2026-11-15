// 부트스트랩: 엔진(브라우저)과 코어(순수 로직)를 연결한다.
// 화면 1(magpie_nest)을 탭으로 처음부터 끝까지 푼다(#68). 그림은 임시(placeholder)다.
// 진행 로직은 core/scene.ts에 있다. 여기서는 입력을 넘기고, 결과를 그리고, DOM 말풍선·라벨을 띄운다.

import charactersJson from '../content/characters.json';
import screenJson from '../content/screens/magpie_nest.json';
import texts from '../content/text/ko.json';
import { CHARACTERS, type CharacterId } from './core/characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, WALK_AREA } from './core/config';
import type { HitBox } from './core/hit';
import { GAUGE_CELLS, HUD_AREA } from './core/hud';
import { labelText, resolveTap, type Label } from './core/interact';
import type { CharactersData, ScreenData } from './core/puzzle/types';
import { createScene, currentBubble, isBusy, sceneLayout, sceneTap, sceneTick, tapContext, type SceneData } from './core/scene';
import { internalToScreen, screenToInternal, type Point } from './core/viewport';
import { createDisplay } from './engine/display';
import { onPointerTap } from './engine/input';
import { startLoop } from './engine/loop';
import { drawActiveMarker, drawCharacter, drawHud, drawOutline, drawRoom, drawSpark, drawTarget, drawTargets } from './engine/placeholder';

function need<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} 요소가 없습니다`);
  return el;
}
const canvas = need<HTMLCanvasElement>('#game');
const hud = need('#hud');
const bubble = need('#bubble');
const label = need('#label');
const clearCut = need('#clear');

const data: SceneData = { screen: screenJson as unknown as ScreenData, characters: charactersJson as CharactersData };
const TEXT: Readonly<Record<string, string>> = texts;
const t = (id: string): string => TEXT[id] ?? id;

const display = createDisplay(canvas, { width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT });
const scene = createScene(data);

// M1 판정 재생 도구(#101)용 읽기 전용 훅. 입력 판정이 쓰는 상자 그대로 돌려준다(scene.ts sceneLayout).
if (new URLSearchParams(location.search).get('playtest') === '1') {
  (window as unknown as { __gcLayout: () => unknown }).__gcLayout = () => sceneLayout(data, scene);
}

/** 터치 첫 탭으로 고른 대상의 라벨. 실행하거나 다른 걸 누르면 지운다. */
let touchLabel: Label | null = null;
/** 데스크톱 호버 라벨. */
let hoverLabel: Label | null = null;

window.addEventListener('resize', () => display.resize());
onPointerTap(canvas, display.rect, display.internal, (p, slop) => {
  const r = sceneTap(data, scene, p, slop, slop > 0);
  if (r.kind !== 'intent') return;
  touchLabel = r.intent.kind === 'select' ? r.intent.label : null;
  // 첫 행동(걷기 포함)까지는 안내를 남겨 둔다.
  if (r.intent.kind === 'walk' || r.intent.kind === 'act') hud.hidden = true;
});
hud.textContent = '캐릭터를 바꾸고, 바닥이나 물건을 눌러 보세요';
clearCut.textContent = t('ui.clear');

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const p = screenToInternal({ x: e.clientX, y: e.clientY }, display.rect(), display.internal);
  hoverLabel = null;
  canvas.style.cursor = 'default';
  if (!p || isBusy(scene) || scene.cleared) return;
  const inHud = p.x >= HUD_AREA.left && p.x < HUD_AREA.left + HUD_AREA.width && p.y >= HUD_AREA.top && p.y < HUD_AREA.top + HUD_AREA.height;
  if (inHud) return; // HUD 영역은 기본 화살표(PR #112 Luna 리뷰)
  const r = resolveTap(tapContext(data, scene), scene.ui, p, 0);
  hoverLabel = 'label' in r ? r.label : null;
  canvas.style.cursor = r.kind === 'act' ? 'pointer' : 'default';
});

/** 연출 대상(캐릭터 ID 또는 핫스팟 ID)의 머리 위 점. 내부 좌표. */
function anchorOf(target: string, layout: ReturnType<typeof sceneLayout>): Point | null {
  const box: HitBox | undefined = layout.chars[target as CharacterId] ?? layout.hotspots[target] ?? layout.spots[target];
  return box ? { x: box.left + box.width / 2, y: box.top } : null;
}

function placeDom(el: HTMLElement, at: Point): void {
  const s = internalToScreen(at, display.rect(), display.internal);
  el.style.left = `${Math.round(s.x)}px`;
  el.style.top = `${Math.round(s.y)}px`;
}

function render(): void {
  const { ctx, internal } = display;
  const layout = sceneLayout(data, scene);
  drawRoom(ctx, internal, WALK_AREA);
  drawTargets(ctx, layout.spots, layout.hotspots);

  const me = scene.walkers[scene.ui.active];
  if (me.target && !isBusy(scene)) drawTarget(ctx, me.target, scene.tick);

  // 반응 애니메이션(임시): 대상 캐릭터를 좌우로 1px 흔든다.
  const ev = scene.current?.ev;
  const shaking = ev?.type === 'anim' ? ev.target : null;
  const order = CHARACTERS.map((c) => scene.walkers[c.id]).sort(
    (a, b) => Math.round(a.y) - Math.round(b.y) || (a.id < b.id ? 1 : -1),
  );
  for (const w of order) {
    const dx = w.id === shaking && Math.floor(scene.tick / 3) % 2 === 1 ? 1 : 0;
    drawCharacter(ctx, dx ? { ...w, x: w.x + dx } : w);
  }
  if (ev?.type === 'fx') {
    const at = anchorOf(ev.target, layout);
    if (at) drawSpark(ctx, at, scene.current?.t ?? 0);
  }
  if (!isBusy(scene) && !scene.cleared) {
    const box = layout.chars[scene.ui.active];
    drawActiveMarker(ctx, box.top, me.x, scene.tick);
  }
  if (scene.ui.selected) {
    const target = scene.ui.selected.split('|')[2] ?? '';
    const box = layout.hotspots[target] ?? layout.spots[target];
    if (box) drawOutline(ctx, box, scene.tick);
  }
  drawHud(ctx, layout.hud, GAUGE_CELLS, { active: layout.active, armed: layout.armed, gauge: layout.gauge });
  display.present();

  // DOM 말풍선(ADR-0004 결정 3). 화자 머리 위.
  const b = currentBubble(scene);
  const bubbleAt = b ? anchorOf(b.speaker, layout) : null;
  bubble.hidden = !b;
  if (b) {
    const text = t(b.text);
    if (bubble.textContent !== text) bubble.textContent = text;
    placeDom(bubble, bubbleAt ?? { x: INTERNAL_WIDTH / 2, y: 60 });
  }

  const shown = isBusy(scene) || scene.cleared ? null : (touchLabel ?? hoverLabel);
  const labelString = shown ? labelText(shown, data.screen.id, t) : '';
  label.hidden = labelString === '';
  if (label.textContent !== labelString) label.textContent = labelString;
  placeDom(label, { x: INTERNAL_WIDTH / 2, y: INTERNAL_HEIGHT - 4 });

  clearCut.hidden = !(scene.cleared && !isBusy(scene));
}

startLoop({ step: () => sceneTick(data, scene), render });
