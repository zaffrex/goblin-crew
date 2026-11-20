// 얼굴 상자 판정의 화면 데이터 불변식 (설계 2-1절 "자리가 자기 클릭 상자를 가지나", PR #521·#522).
// 엔진 `usesFaceBox`(core/interact.ts)는 `free`이거나 `hold`·`board`·`box`가 모두 없을 때 얼굴로 판정한다.
// 문서 기준은 "자리에 상자가 있나"다. 아래 두 조건이 지켜지는 동안 둘의 결과가 같다.
// 깨지면 새 자리가 그 예외다. 문서와 엔진 중 무엇을 따를지 정하고 고친다.
// 화면 목록을 glob으로 읽으려고 engine에 둔다(core 타입체크는 vite 타입이 없다).
import { describe, expect, it } from 'vitest';
import type { ScreenData } from '../core/puzzle/types';

const SCREENS = Object.entries(
  import.meta.glob<ScreenData>('../../content/screens/*.json', { eager: true, import: 'default' }),
).map(([path, s]) => [path.replace(/^.*\/|\.json$/g, ''), s] as const);

function spotsWhere(pred: (spot: ScreenData['spots'][string]) => boolean): string[] {
  return SCREENS.flatMap(([screen, s]) =>
    Object.entries(s.spots)
      .filter(([, spot]) => pred(spot))
      .map(([id]) => `${screen}.${id}`),
  );
}

describe('자리 데이터: 얼굴 상자 문서 기준과 usesFaceBox가 같은 결과 (2-1절)', () => {
  it('화면을 둘 이상 읽는다(magpie_nest, park_fountain)', () => {
    expect(SCREENS.map(([id]) => id)).toEqual(expect.arrayContaining(['magpie_nest', 'park_fountain']));
  });

  it('`hold`·`board` 자리는 모두 자기 상자(`box`)가 있다', () => {
    expect(spotsWhere((spot) => !!(spot.hold || spot.board) && !spot.box)).toEqual([]);
  });

  it('`free` 자리는 상자가 없다', () => {
    expect(spotsWhere((spot) => !!spot.free && !!spot.box)).toEqual([]);
  });
});
