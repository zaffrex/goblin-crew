import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import nestJson from '../../content/screens/magpie_nest.json';
import fountainJson from '../../content/screens/park_fountain.json';
import laundromatJson from '../../content/screens/laundromat.json';
import { createScene, currentBubble, introHoverScene, isBusy, sceneTap, sceneTick, tapContext, type SceneData, type SceneState } from './scene';
import { hotspotBox, resolveTap } from './interact';
import { inHudZone } from './hud';
import type { CharactersData, ScreenData } from './puzzle/types';
import type { Point } from './viewport';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './config';

// ui-interaction.md 5절 예외 넷 1 (#798): 시작 연출(`onEnter`) 중 마우스 클릭은 남은 시작 연출을 끝내고 쉴 때처럼 처리된다.
// 그러니 호버 라벨·외곽선·커서도 쉴 때와 같아야 한다. "라벨이 보이면 그 클릭은 그대로 된다"가 시작 연출에서도 지켜지는지 본다.

const characters = charactersJson as CharactersData;
const screens = [
  ['magpie_nest', { screen: nestJson as unknown as ScreenData, characters }],
  ['park_fountain', { screen: fountainJson as unknown as ScreenData, characters }],
  ['laundromat', { screen: laundromatJson as unknown as ScreenData, characters }],
] as const satisfies readonly (readonly [string, SceneData])[];
// core tsconfig에는 DOM 타입이 없다. Node 17+ 전역이라 실행은 된다(sceneSayClick.test.ts와 같다).
declare function structuredClone<T>(value: T): T;
const MOUSE = 0;

function idle(data: SceneData, s: SceneState): void {
  for (let i = 0; i < 20_000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
}
/** 시작 연출 첫 틱(효과음 글자), 또는 시작 대사가 뜬 틱. */
function introAt(data: SceneData, moment: 'first' | 'say'): SceneState {
  const s = createScene(data);
  sceneTick(data, s);
  if (moment === 'say') {
    for (let i = 0; i < 5000 && currentBubble(s)?.text !== `${data.screen.id}.enter`; i++) sceneTick(data, s);
    expect(currentBubble(s)?.text).toBe(`${data.screen.id}.enter`);
  }
  expect(s.intro && isBusy(s)).toBe(true);
  return s;
}
const hoverAt = (data: SceneData, s: SceneState, p: Point) => resolveTap(tapContext(data, s), s.ui, p, MOUSE);

describe('시작 연출 중 마우스 호버 = 쉴 때 (#798, 예외 넷 1)', () => {
  it('쉴 때·클리어 뒤에는 null, 시작 연출 중에는 시작 연출이 끝난 복사본이고 원본은 그대로다', () => {
    const [, data] = screens[0];
    const s = introAt(data, 'first');
    const before = structuredClone(s);
    const h = introHoverScene(s)!;
    expect(h).not.toBeNull();
    expect(h.intro || isBusy(h)).toBe(false);
    expect(s).toEqual(before);
    idle(data, s);
    expect(introHoverScene(s)).toBeNull();
  });

  it('까치 위 호버: 시작 연출 첫 틱에 라벨이 뜨고, 연출이 끝나도 같은 라벨이다', () => {
    const [, data] = screens[0];
    const s = introAt(data, 'first');
    const b = hotspotBox(data.screen, s.puzzle, 'magpie')!;
    const p = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const during = hoverAt(data, introHoverScene(s)!, p);
    expect(during.kind).toBe('act');
    expect('label' in during && during.label).toBeTruthy();
    idle(data, s);
    expect(hoverAt(data, s, p)).toEqual(during);
  });

  // 화면 전체 6px 격자(#796과 같은 촘촘함): 호버 판정 = 시작 연출이 끝난 뒤 쉴 때 판정 = 실제 클릭이 낸 의도.
  it.each(screens.flatMap(([name, data]) => (['first', 'say'] as const).map((m) => [`${name} ${m === 'first' ? '첫 틱' : '시작 대사'}`, data, m] as const)))(
    '격자 전체에서 호버 판정 = 쉴 때 판정 = 클릭 결과 (%s)',
    (_name, data, moment) => {
      const base = introAt(data, moment);
      const hs = introHoverScene(base)!;
      const after = structuredClone(base);
      idle(data, after);
      let acts = 0;
      for (let y = 1; y < INTERNAL_HEIGHT; y += 6) {
        for (let x = 1; x < INTERNAL_WIDTH; x += 6) {
          const p = { x, y };
          const h = hoverAt(data, hs, p);
          expect({ p, h }).toEqual({ p, h: hoverAt(data, after, p) });
          // HUD 영역은 호버가 따로(칸 설명)라 월드 점만 클릭과 맞춘다. 얼굴 칸 클릭은 시작 연출을 안 끝내는 전환이다(예외 셋).
          if (inHudZone(p)) continue;
          const s = structuredClone(base);
          const r = sceneTap(data, s, p, MOUSE, false);
          expect({ p, r }).toEqual({ p, r: { kind: 'intent', intent: h } });
          if (h.kind === 'act') acts++;
        }
      }
      expect(acts).toBeGreaterThan(0);
    },
  );
});
