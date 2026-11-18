import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initialState, step } from '../../src/core/puzzle/step';
import type { CharacterId, PuzzleEvent, ScreenData } from '../../src/core/puzzle/types';

// ADR-0065 7절: 화면의 solution을 처음부터 step으로 재생한다.
// 모든 행동이 rule 또는 기본 move, 게이지 0 없음, 마지막 행동에서 clear.
const load = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const screen = load('../../content/screens/magpie_nest.json') as ScreenData;
const text = load('../../content/text/ja.json') as Record<string, string>;

describe('magpie_nest solution playthrough', () => {
  it('clears with rule/move actions only and never faints', () => {
    const solution = screen.solution ?? [];
    expect(solution.length).toBe(4);
    let s = initialState(screen);
    solution.forEach((a, i) => {
      const r = step(screen, s, a);
      expect(['rule', 'move'], `step ${i} ${JSON.stringify(a)}`).toContain(r.source);
      expect(r.events.some((e) => e.type === 'faint')).toBe(false);
      expect(r.events.some((e) => e.type === 'clear')).toBe(i === solution.length - 1);
      s = r.state;
    });
    expect(s.flags[screen.exitFlag]).toBe(true);
    expect(s.items).toContain('item.shop_key');
  });

  it('every say text ID exists in content/text/ja.json', () => {
    const ids = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (k === 'say' && Array.isArray(x)) [x[1]].flat().forEach((id) => ids.add(String(id)));
          else walk(x);
        }
      }
    };
    walk(screen);
    expect([...ids].filter((id) => !(id in text))).toEqual([]);
  });

  // #286: 대상별 みる는 화자 `self` 한 줄이라, 세 사람 말투는 글 파일의 `<id>.<화자>` 변형으로 나눈다(src/core/sayText.ts).
  it('every target look line has a variant for each of the three characters', () => {
    const lookIds = Object.values(screen.fallbacks ?? {}).flatMap((byVerb) =>
      (byVerb.look?.show ?? []).flatMap((item) => ('say' in item ? [item.say[1]].flat() : [])),
    );
    expect(lookIds.length).toBeGreaterThan(0);
    const missing = lookIds.flatMap((id) => ['jjuk', 'mukjik', 'ppik'].map((c) => `${id}.${c}`)).filter((k) => !(k in text));
    expect(missing).toEqual([]);
  });
});

// #206·#339: 11·13·14·15번 `show`의 효과 위치 표시 `{ "do": "here" }`(ADR-0065 5절).
// 실제 화면 데이터로 이벤트 순서와, 표시 뒤 `@자리`가 푼 화자 ID(효과 전 자리 = 날아간/맞은 사람)를 단언한다.
describe('magpie_nest 효과 위치 표시 순서 (#206, #339)', () => {
  const line = (e: PuzzleEvent): string => {
    switch (e.type) {
      case 'anim':
        return `anim ${e.target} ${e.name}`;
      case 'fx':
        return `fx ${e.effect} ${e.target}`;
      case 'place':
        return `place ${e.char} ${e.from}>${e.to}${e.via ? ` via ${e.via}` : ''}`;
      case 'say':
        return `say ${e.speaker}`;
      case 'gauge':
        return `gauge ${e.delta}`;
      default:
        return e.type;
    }
  };
  const stomp = (at: Partial<Record<CharacterId, string>>, target: string) => {
    const s0 = initialState(screen);
    const r = step(screen, { ...s0, at: { ...s0.at, ...at } }, { char: 'mukjik', verb: 'stomp', target });
    expect(r.source).toBe('rule');
    return r.events.map(line);
  };
  const STOMP = ['anim mukjik common.stomp', 'fx stomp_text mukjik'];

  // 정답 발사(#339): 고리에 놓인 다음 말풍선. 화자는 발사된 사람(쭉이·삑삑이 둘 다).
  for (const who of ['jjuk', 'ppik'] as const) {
    it(`11번 seesaw_launch(${who}): launch_to_hook → 고리에 놓임 → say ${who}`, () => {
      expect(stomp({ [who]: 'seesaw_left' }, 'seesaw_right')).toEqual([
        ...STOMP,
        'anim seesaw_right plank_bounce',
        `anim ${who} launch_to_hook`,
        `place ${who} seesaw_left>hook`,
        `say ${who}`,
      ]);
    });
  }

  // 부딪힘: 날아간 사람 → 둘 다 바구니로 → 게이지 → 납작 둘 → 고리에 있던 사람이 말한다.
  for (const [flyer, hung] of [['ppik', 'jjuk'], ['jjuk', 'ppik']] as const) {
    it(`13번 seesaw_launch_bump(${flyer}→${hung}): 떨어진 뒤 납작해지고 say ${hung}`, () => {
      expect(stomp({ [flyer]: 'seesaw_left', [hung]: 'hook' }, 'seesaw_right')).toEqual([
        ...STOMP,
        'anim seesaw_right plank_bounce',
        `anim ${flyer} launch_to_hook`,
        `place ${flyer} seesaw_left>floor via hook`,
        `place ${hung} hook>floor`,
        'gauge -1',
        `anim ${flyer} common.flatten`,
        `anim ${hung} common.flatten`,
        `say ${hung}`,
      ]);
    });
  }

  it('14번 seesaw_launch_wrong_way: 내복 펄럭 → 바닥에 놓임 → 엉덩방아 → say (널빤지 위 사람)', () => {
    expect(stomp({ ppik: 'seesaw_right' }, 'seesaw_left')).toEqual([
      ...STOMP,
      'anim seesaw_left plank_bounce',
      'anim long_johns flutter',
      'place ppik seesaw_right>floor',
      'gauge -1',
      'anim ppik common.bump_bottom',
      'say ppik',
    ]);
  });

  it('15번 seesaw_self_smack_right(자리 이동 없음): 납작 바로 뒤 게이지, 별은 그 뒤', () => {
    expect(stomp({}, 'seesaw_right')).toEqual([
      ...STOMP,
      'anim seesaw_left plank_bounce',
      'anim mukjik common.flatten',
      'gauge -1',
      'fx stars mukjik',
      'say mukjik',
    ]);
  });

  it('특기 연출 뒤 시그니처 fx(stomp_text)는 표시보다 앞이다(#253 PM 리뷰)', () => {
    for (const id of ['seesaw_launch', 'seesaw_launch_bump', 'seesaw_launch_wrong_way', 'seesaw_self_smack_right']) {
      const show = screen.rules.find((r) => r.id === id)!.show!;
      const mark = show.findIndex((x) => 'do' in x);
      const sig = show.findIndex((x) => 'fx' in x && x.fx[0] === 'stomp_text');
      expect(mark, id).toBeGreaterThan(sig);
      expect(sig, id).toBeGreaterThanOrEqual(0);
    }
  });
});
