// 화면별 걷기 영역(#938, 진마씨 "노비가 공중에 떠 있네" 11/25). 빨래방은 그림 바닥(woodL)이 y 236부터라
// 공통 `WALK_AREA`(y 200~252) 그대로면 아래 벽 띠(y 172~235)를 눌렀을 때 발이 벽 위에 섰다.
// 위 끝은 바닥 첫 줄(236)이 아니라 셔터 아래 끝(244)이다: 236이면 셔터 앞(x 24~151)에서 발이 셔터 판 위에 떴다(Luna #940).
import { describe, expect, it } from 'vitest';
import charactersJson from '../../content/characters.json';
import laundromatJson from '../../content/screens/laundromat.json';
import magpieJson from '../../content/screens/magpie_nest.json';
import parkJson from '../../content/screens/park_fountain.json';
import sheetJson from '../../public/scenes/laundromat-objects.json';
import { CHARACTERS } from './characters';
import { HIGH_TARGET_LINE, WALK_AREA, walkAreaOf } from './config';
import type { CharacterId, CharactersData, ScreenData } from './puzzle/types';
import { approachPoint, charWalking, createScene, isBusy, sceneTap, sceneTick, type SceneData, type SceneState } from './scene';
import { parseSceneArt, type SceneArtMeta } from './sceneArt';

const characters = charactersJson as CharactersData;
const laundromat = laundromatJson as unknown as ScreenData;
const data: SceneData = { screen: laundromat, characters, art: parseSceneArt(sheetJson as unknown as SceneArtMeta) };

/** 셔터 아래 끝(`art/scenes/laundromat.shutter.mjs` `SHUTTER.y + h`). 이 화면에서 가장 앞으로 나온 바닥 물건이라 발을 이 줄에 맞춘다. */
const FEET_TOP = 244;

/** 이슈 #938 재현 자리: 건조기와 자판기 사이 벽, 3번 세탁기 앞 벽 띠, 셔터 오른쪽 벽 띠 맨 위. */
const WALL_TAPS = [
  { x: 420, y: 204 },
  { x: 300, y: 212 },
  { x: 180, y: 200 },
];

/** onEnter가 끝난 판. 지금 캐릭터 말고 둘은 왼쪽 끝(16, 252)에 몰아 둬서 비켜 서기(#825)가 x만 옮기게 한다. */
function ready(char: CharacterId): SceneState {
  const s = createScene(data);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(data, s);
  expect(isBusy(s)).toBe(false);
  for (const c of CHARACTERS) if (c.id !== char) Object.assign(s.walkers[c.id], { x: 16, y: 252 });
  s.ui.active = char;
  return s;
}

function walkUntilStill(s: SceneState, char: CharacterId): void {
  for (let i = 0; i < 2000 && charWalking(s, char); i++) sceneTick(data, s);
  expect(charWalking(s, char)).toBe(false);
}

describe('화면별 걷기 영역 (#938)', () => {
  it('빨래방 walkArea 위 끝은 셔터 아래 끝(244)이고, 나머지 세 변은 공통 값이다', () => {
    const [, y, , h] = laundromat.hotspots.shutter!.box;
    expect(y + h, '셔터 히트 상자 아래 끝이 바뀌면 walkArea.top도 같이 본다').toBe(FEET_TOP);
    expect(walkAreaOf(laundromat)).toEqual({ ...WALK_AREA, top: FEET_TOP });
  });

  it('다른 두 화면은 walkArea가 없어서 공통 WALK_AREA 그대로다(바닥 위 끝 196·198 < 200)', () => {
    for (const s of [magpieJson, parkJson] as unknown as ScreenData[]) {
      expect(s.walkArea).toBeUndefined();
      expect(walkAreaOf(s)).toBe(WALK_AREA);
    }
  });

  for (const c of CHARACTERS)
    for (const [input, slop] of [['마우스', 0], ['터치', 8]] as const)
      it(`${c.id} ${input}: 아래 벽 띠를 눌러도 발이 셔터 아래 끝 줄(y ${FEET_TOP})에 선다`, () => {
        for (const p of WALL_TAPS) {
          const s = ready(c.id);
          const r = sceneTap(data, s, p, slop, slop > 0);
          expect(r, `${p.x},${p.y}`).toMatchObject({ kind: 'intent', intent: { kind: 'walk' } });
          walkUntilStill(s, c.id);
          const w = s.walkers[c.id];
          expect(w.y, `${p.x},${p.y}`).toBe(FEET_TOP);
          expect(Math.abs(w.x - p.x), `${p.x},${p.y}`).toBeLessThanOrEqual(1);
        }
      });

  it('처음 배치는 바닥 줄(y 244) 그대로다', () => {
    const s = createScene(data);
    for (const c of CHARACTERS) expect(s.walkers[c.id].y).toBe(244);
  });

  it('높은/바닥 대상 기준은 화면별 위 끝을 안 따른다: dryer_3(아래 끝 236)은 바닥 대상이라 옆에 선다', () => {
    expect(HIGH_TARGET_LINE).toBe(200);
    const s = createScene(data);
    const ap = approachPoint(data, s.puzzle, { char: 'mukjik', verb: 'stomp', target: 'dryer_3' }, { x: 280, y: 244 });
    // 건조기 상자 x 344~392. 가운데(368)가 아니라 왼쪽 가장자리 밖에 선다.
    expect(ap).not.toBeNull();
    expect(ap!.x).toBeLessThan(344);
    expect(ap!.y).toBe(244);
  });
});
