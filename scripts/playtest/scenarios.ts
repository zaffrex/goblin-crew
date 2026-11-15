// 재생 도구 2부-b: M1 판정 1에서 재생할 행동 순서와 확인할 것 (#101, docs/team/m1-acceptance.md A1·A2·A3·A6②).
// 순수 데이터 + 확인 함수만 둔다. 같은 시나리오를 두 곳에서 돌린다:
// - `scenarios.test.ts`: 실제 `scene.ts`에 탭을 넣어 Chrome 없이 (시나리오가 맞는지, 게임이 맞는지)
// - `replay.ts`: 배포 URL을 headless Chrome에서 열고 실제 마우스·터치로 (판정 1)

import type { CharacterId } from '../../src/core/characters.ts';
import type { Action, Box, ScreenData } from '../../src/core/puzzle/types.ts';
import { outsidePoint } from './coords.ts';
import type { Layout } from './plan.ts';

export interface StepExpect {
  /** 이 행동 동안 말풍선(또는 게이지 0 컷 `#faint`)에 차례로 떠야 하는 글 id (`content/text/ko.json`). 다른 글이 사이에 있어도 된다. */
  says?: string[];
  /** 연출이 끝난 뒤 HUD 게이지. */
  gauge?: number;
  /** 게이지 0 리셋: 연출이 끝난 뒤 모두 시작 자리에 있다(ADR-0018 G2, 서는 자리만 리셋). */
  faint?: true;
  cleared?: boolean;
  /** 핫스팟 상자가 이 상자여야 한다. 상태에 따라 바뀌는 상자(까치 `variants`)로 플래그를 간접 확인한다. */
  hotspotBox?: { id: string; box: Box };
}

export interface Step {
  action: Action;
  /** 판정 표 칸 (m1-acceptance.md). 이 행동의 문제는 이 칸의 실패로 센다. */
  check: 'A1' | 'A2' | 'A3';
  /** 보고서 줄 이름. */
  label: string;
  expect?: StepExpect;
}

export interface Scenario {
  id: string;
  /** 판정 표의 어느 칸인가. */
  checks: string;
  title: string;
  steps: Step[];
}

const act = (char: CharacterId, verb: Action['verb'], target: string): Action => ({ char, verb, target });

/** 까치가 바닥에 내려온 상자 (`magpie.variants[0]`). 화면 데이터에서 읽어 숫자를 두 번 적지 않는다. */
export function magpieGroundBox(screen: ScreenData): Box {
  const v = screen.hotspots.magpie?.variants?.[0]?.box;
  if (!v) throw new Error('magpie 바닥 variant 상자 없음');
  return v;
}

export function scenarios(screen: ScreenData): Scenario[] {
  const solution = screen.solution ?? [];
  if (solution.length === 0) throw new Error(`${screen.id}: solution 없음`);
  const ground = { id: 'magpie', box: magpieGroundBox(screen) };
  const launch = (n: string, check: Step['check']): Step[] => [
    { check, action: act('jjuk', 'move', 'seesaw_left'), label: `${n} 쭉이 시소 왼쪽` },
    { check, action: act('mukjik', 'stomp', 'seesaw_right'), label: `${n} 묵직이 시소 오른쪽 쿵 → 쭉이 고리로` },
  ];
  return [
    {
      id: 'A1',
      checks: 'A1',
      title: '커밋된 solution 그대로',
      steps: solution.map((a, i) => ({
        check: 'A1',
        action: a,
        label: `solution ${i + 1}: ${a.char} ${a.verb} ${a.target}`,
        ...(i === solution.length - 1 ? { expect: { cleared: true, gauge: 5 } } : {}),
      })),
    },
    {
      // A2: 규칙 2(고리에서 둥지 뻗기 → 쪼임)·규칙 7(바닥 까치에 뻗기 → 쪼임)을 두 번씩, 두 번째 대사(L02b·L08b)까지.
      // A3: 규칙 7을 이어서 게이지를 0으로 → 서는 자리만 리셋 → 까치는 바닥에 그대로 → 남은 3행동으로 클리어.
      id: 'A2A3',
      checks: 'A2, A3',
      title: '오답 두 번씩 → 게이지 0 → 이어서 클리어',
      steps: [
        ...launch('규칙 2 1회:', 'A2'),
        { check: 'A2', action: act('jjuk', 'stretch', 'nest'), label: '규칙 2 1회: 고리에서 둥지 뻗기', expect: { says: ['magpie_nest.hook_pecked'], gauge: 4 } },
        ...launch('규칙 2 2회:', 'A2'),
        { check: 'A2', action: act('jjuk', 'stretch', 'nest'), label: '규칙 2 2회: 고리에서 둥지 뻗기', expect: { says: ['magpie_nest.hook_pecked_again'], gauge: 3 } },
        { check: 'A2', action: act('ppik', 'squeak', 'magpie'), label: '까치 내리기', expect: { hotspotBox: ground } },
        { check: 'A2', action: act('jjuk', 'stretch', 'magpie'), label: '규칙 7 1회', expect: { says: ['magpie_nest.magpie_pecked'], gauge: 2 } },
        { check: 'A2', action: act('jjuk', 'stretch', 'magpie'), label: '규칙 7 2회', expect: { says: ['magpie_nest.magpie_pecked_again'], gauge: 1 } },
        { check: 'A3', action: act('jjuk', 'stretch', 'magpie'), label: '규칙 7 3회 → 게이지 0', expect: { says: ['ui.faint'], faint: true, gauge: 5, hotspotBox: ground } },
        ...launch('리셋 뒤:', 'A3'),
        { check: 'A3', action: act('jjuk', 'stretch', 'nest'), label: '리셋 뒤: 고리에서 열쇠', expect: { cleared: true } },
      ],
    },
  ];
}

export interface SlopProbe {
  label: string;
  target: string;
  /** 내부 px. 상자 밖, 게임 거리로 정확히 `dist`. */
  at: { x: number; y: number };
  dist: number;
  /** 첫 탭에 이 대상이 선택돼야 하나 (8px 안: 예, 9px: 아니오). */
  selects: boolean;
}

/** A6②: 고리·바구니 근처 바닥을 터치 1회. 8px은 대상 선택, 9px은 선택 안 됨(ADR-0007 결정 6). */
export function slopProbes(screen: ScreenData): SlopProbe[] {
  const hook = screen.spots.hook?.box;
  const basket = screen.hotspots.basket?.box;
  if (!hook || !basket) throw new Error('hook·basket 상자 없음');
  const probes: SlopProbe[] = [];
  for (const dist of [8, 9]) {
    probes.push({ label: `고리 왼쪽 ${dist}px`, target: 'hook', at: outsidePoint(hook, 'left', dist), dist, selects: dist <= 8 });
    probes.push({ label: `바구니 아래 ${dist}px`, target: 'basket', at: outsidePoint(basket, 'bottom', dist), dist, selects: dist <= 8 });
  }
  return probes;
}

/** `ui.selected`(`char|verb|target|item`)가 이 대상을 골랐나. */
export function selectedTarget(selected: string | null): string | null {
  return selected === null ? null : (selected.split('|')[2] ?? null);
}

const sameBox = (a: { left: number; top: number; width: number; height: number } | undefined, b: Box) =>
  a !== undefined && a.left === b[0] && a.top === b[1] && a.width === b[2] && a.height === b[3];

/**
 * 한 행동이 끝난 뒤 확인. 문제 문장 목록(비면 통과).
 * `said`는 이 행동 동안 실제로 뜬 말풍선 글, `text`는 글 id → 화면 글(Chrome) 또는 그대로(테스트).
 */
export function checkStep(
  screen: ScreenData,
  step: Step,
  after: Layout,
  said: readonly string[],
  text: (id: string) => string,
): string[] {
  const e = step.expect;
  if (!e) return [];
  const problems: string[] = [];
  if (e.says) {
    let i = 0;
    for (const s of said) if (i < e.says.length && s === text(e.says[i]!)) i++;
    if (i < e.says.length) problems.push(`말풍선 ${e.says[i]} 안 뜸 (뜬 것: ${said.map((s) => JSON.stringify(s)).join(', ') || '없음'})`);
  }
  if (e.gauge !== undefined && after.gauge !== e.gauge) problems.push(`게이지 ${after.gauge} (기대 ${e.gauge})`);
  if (e.faint) {
    const off = Object.entries(screen.start.at).filter(([c, spot]) => after.at[c as CharacterId] !== spot);
    if (off.length > 0) problems.push(`리셋 안 됨: ${off.map(([c]) => `${c}@${after.at[c as CharacterId]}`).join(', ')}`);
  }
  if (e.cleared !== undefined && after.cleared !== e.cleared) problems.push(`클리어 ${after.cleared} (기대 ${e.cleared})`);
  if (e.hotspotBox && !sameBox(after.hotspots[e.hotspotBox.id], e.hotspotBox.box)) {
    problems.push(`${e.hotspotBox.id} 상자 ${JSON.stringify(after.hotspots[e.hotspotBox.id])} (기대 ${JSON.stringify(e.hotspotBox.box)})`);
  }
  return problems;
}
