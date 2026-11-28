// 물건 사슬 검사(ADR-1031 2절 C1·C2·C4(b)·C7). 실패 검사라 reportErrors에 들어간다.
import { describe, expect, it } from 'vitest';
import { CHAIN_EXEMPT, CHAIN_TUTORIAL, PICK_MAX, chainErrors, chainSummary, checkScreen, reportErrors } from './check';
import type { RuleDef, ScreenData } from './types';

// 일반 화면 모형: 묵직이 쿵으로 양말 납작(변화) → 쭉이가 집어 건조기에 넣음(결합) → 삑삑이 소리로 물통이 뒤집혀 비누가 젖음(변화)
// → 쭉이가 젖은 비누를 건조기에 넣음(결합) → 삑삑이 소리로 건조기 켜기(쓰기). 결합+쓰기 3, 묵직이·삑삑이 각 1 이상.
function generalScreen(): ScreenData {
  return {
    id: 'chain_fixture',
    spots: { floor: { x: 0, y: 240, free: true } },
    hotspots: {
      sock: { box: [100, 220, 24, 16], present: { flags: { 'sock.used': false } } },
      soap: { box: [140, 220, 24, 16], present: { flags: { 'soap.used': false } } },
      bucket: { box: [180, 200, 24, 24] },
      dryer: { box: [240, 180, 40, 48] },
    },
    flags: {
      'sock.flat': false, 'sock.used': false, 'soap.wet': false, 'soap.used': false,
      'dryer.sock': false, 'dryer.soap': false, 'dryer.on': false,
    },
    start: { at: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' }, items: [] },
    exitFlag: 'dryer.on',
    rules: [
      { id: 'pick_sock', target: 'sock', verb: 'stretch', do: { pick: true } },
      { id: 'pick_soap', target: 'soap', verb: 'stretch', do: { pick: true } },
      // 내려놓기가 없으면 마르지 않은 비누를 들었을 때 막다른 상태가 된다(S3).
      { id: 'put_sock', target: 'sock', verb: 'item', when: { item: 'sock' }, do: { put: true } },
      { id: 'put_soap', target: 'soap', verb: 'item', when: { item: 'soap' }, do: { put: true } },
      { id: 'flatten_sock', target: 'sock', verb: 'stomp', chain: 'change', when: { flags: { 'sock.flat': false } }, do: { set: { 'sock.flat': true } } },
      { id: 'tip_bucket', target: 'bucket', verb: 'squeak', chain: 'change', when: { flags: { 'soap.wet': false } }, do: { set: { 'soap.wet': true } } },
      {
        id: 'load_sock', target: 'dryer', verb: 'item', chain: 'combine',
        when: { item: 'sock', flags: { 'sock.flat': true } }, do: { set: { 'dryer.sock': true, 'sock.used': true }, take: ['sock'] },
      },
      {
        id: 'load_soap', target: 'dryer', verb: 'item', chain: 'combine',
        when: { item: 'soap', flags: { 'soap.wet': true } }, do: { set: { 'dryer.soap': true, 'soap.used': true }, take: ['soap'] },
      },
      { id: 'start_dryer', target: 'dryer', verb: 'squeak', chain: 'use', when: { flags: { 'dryer.sock': true, 'dryer.soap': true } }, do: { set: { 'dryer.on': true } } },
    ],
    solution: [
      { char: 'mukjik', verb: 'stomp', target: 'sock' },
      { char: 'jjuk', verb: 'stretch', target: 'sock' },
      { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' },
      { char: 'ppik', verb: 'squeak', target: 'bucket' },
      { char: 'jjuk', verb: 'stretch', target: 'soap' },
      { char: 'jjuk', verb: 'item', target: 'dryer', item: 'soap' },
      { char: 'ppik', verb: 'squeak', target: 'dryer' },
    ],
  };
}

const rule = (s: ScreenData, id: string): RuleDef => s.rules.find((r) => r.id === id)!;
const errs = (s: ScreenData): string[] => chainErrors(s, chainSummary(s));

describe('chain checks (ADR-1031 C1·C2·C4(b)·C7)', () => {
  it('passes a general screen that meets C1·C2·C4(b)·C7, and the BFS report has no errors', () => {
    const s = generalScreen();
    const c = chainSummary(s);
    expect(c.uses).toBe(3);
    expect(c.picks).toBe(2);
    expect(c.changeIntoCombine).toEqual([[0, 2, 'sock.flat'], [3, 5, 'soap.wet']]);
    expect(c.stateChangers).toEqual({ mukjik: 1, ppik: 1 });
    expect(c.pickIds).toEqual(['soap', 'sock']);
    expect(errs(s)).toEqual([]);
    expect(reportErrors(checkScreen(s))).toEqual([]);
  });

  it('C1: fewer than 3 combine+use rules on the solution fails', () => {
    const s = generalScreen();
    rule(s, 'start_dryer').chain = 'change';
    expect(errs(s)).toEqual(['C1 solution의 결합+쓰기(chain combine·use) 2개 < 3']);
  });

  it('C1 counts rules that fired on the solution, not rules that exist', () => {
    const s = generalScreen();
    s.rules.push({ id: 'unused_use', target: 'bucket', verb: 'look', chain: 'use' });
    rule(s, 'start_dryer').chain = undefined;
    expect(errs(s)[0]).toMatch(/^C1 .* 2개 < 3$/);
  });

  it('C1 counts distinct rules: the same use rule fired three times is one link', () => {
    const s = generalScreen();
    rule(s, 'start_dryer').chain = undefined;
    rule(s, 'load_soap').chain = undefined;
    s.rules.push({ id: 'ring_bucket', target: 'bucket', verb: 'look', chain: 'use' });
    const ring = { char: 'jjuk' as const, verb: 'look' as const, target: 'bucket' };
    s.solution!.splice(6, 0, ring, ring, ring);
    expect(chainSummary(s).fired.filter((f) => f.rule.id === 'ring_bucket')).toHaveLength(3);
    expect(chainSummary(s).uses).toBe(2); // 행동 수로 세면 load_sock 1 + ring_bucket 3 = 4
    expect(errs(s)).toEqual(['C1 solution의 결합+쓰기(chain combine·use) 2개 < 3']);
  });

  it('C2: a change whose flag no later combine reads fails, and so does a change after the combine', () => {
    const s = generalScreen();
    rule(s, 'load_sock').when = { item: 'sock' };
    rule(s, 'load_soap').when = { item: 'soap' };
    expect(errs(s)).toEqual(['C2 변화가 켠 플래그를 그 뒤 결합 규칙이 보지 않음(when.flags true·재료 물건 present true 어디에도 없음, 변화된 물건이 결합 재료가 아님)']);
  });

  it('C2: a combine that only names a made item (when.item) reads that item\'s present flags', () => {
    const s = generalScreen();
    // 묵직이가 양말을 밟으면 양말이 사라지고 새 물건 pad가 나타난다. 결합은 when.item만 적는다(PR #1051 Kai 리뷰).
    s.hotspots.pad = { box: [120, 220, 24, 16], present: { flags: { 'pad.made': true, 'pad.used': false } } };
    Object.assign(s.flags, { 'pad.made': false, 'pad.used': false });
    rule(s, 'flatten_sock').do = { set: { 'sock.flat': true, 'sock.used': true, 'pad.made': true } };
    s.rules = s.rules.filter((r) => r.id !== 'load_sock');
    s.rules.push(
      { id: 'pick_pad', target: 'pad', verb: 'stretch', do: { pick: true } },
      { id: 'put_pad', target: 'pad', verb: 'item', when: { item: 'pad' }, do: { put: true } },
      {
        id: 'load_pad', target: 'dryer', verb: 'item', chain: 'combine',
        when: { item: 'pad' }, do: { set: { 'dryer.sock': true, 'pad.used': true }, take: ['pad'] },
      },
    );
    rule(s, 'load_soap').when = { item: 'soap' }; // 비누 쪽 간선은 끊는다. pad 간선만 남는다.
    s.solution![1] = { char: 'jjuk', verb: 'stretch', target: 'pad' };
    s.solution![2] = { char: 'jjuk', verb: 'item', target: 'dryer', item: 'pad' };
    expect(chainSummary(s).changeIntoCombine).toEqual([[0, 2, 'pad.made']]);
    expect(errs(s)).toEqual([]);
  });

  it('C2: no change or no combine on the solution fails', () => {
    const s = generalScreen();
    rule(s, 'flatten_sock').chain = undefined;
    rule(s, 'tip_bucket').chain = undefined;
    // 묵직이·삑삑이의 변화 고리도 같이 사라져 C4(b)도 둘 다 걸린다.
    expect(errs(s)).toEqual([
      'C2 solution에 변화(chain change) 0개',
      'C4(b) mukjik가 solution에서 물건 상태를 바꾸는 고리(change·combine) 0개',
      'C4(b) ppik가 solution에서 물건 상태를 바꾸는 고리(change·combine) 0개',
    ]);
  });

  it('C2 false conditions are not edges', () => {
    const s = generalScreen();
    rule(s, 'load_sock').when = { item: 'sock', flags: { 'sock.flat': true } };
    rule(s, 'flatten_sock').do = { set: { 'sock.flat': true } };
    const c = chainSummary(s);
    expect(c.changeIntoCombine.some(([, , k]) => k === 'sock.flat')).toBe(true);
    rule(s, 'load_soap').when = { item: 'soap', flags: { 'dryer.on': false } };
    expect(chainSummary(s).changeIntoCombine.some(([, , k]) => k === 'soap.wet')).toBe(false);
  });

  it('C4(b): a non-picker with no change/combine on the solution fails (a use alone is not enough)', () => {
    const s = generalScreen();
    // 삑삑이의 변화를 쭉이 장대로 옮긴다. 삑삑이는 쓰기(start_dryer)만 남는다.
    rule(s, 'tip_bucket').verb = 'stretch';
    s.solution![3] = { char: 'jjuk', verb: 'stretch', target: 'bucket' };
    expect(errs(s)).toEqual(['C4(b) ppik가 solution에서 물건 상태를 바꾸는 고리(change·combine) 0개']);
  });

  it('C7: more than 4 distinct pickable items fails, even on exempt screens', () => {
    const s = generalScreen();
    for (const id of ['a', 'b', 'c']) {
      s.hotspots[id] = { box: [0, 0, 24, 24] };
      s.rules.push({ id: `pick_${id}`, target: id, verb: 'stretch', do: { pick: true } });
    }
    expect(PICK_MAX).toBe(4);
    expect(errs(s)).toEqual(['C7 들 물건 5개 > 4: a,b,c,soap,sock']);
    expect(errs({ ...s, id: 'laundromat' })).toEqual(['C7 들 물건 5개 > 4: a,b,c,soap,sock']);
  });

  it('exempt screens skip C1·C2·C4(b); the tutorial needs one pick on the solution instead', () => {
    const bare = { ...generalScreen(), rules: [], solution: [] } as ScreenData;
    expect(errs({ ...bare, id: 'park_fountain' })).toEqual([]);
    const tutorial = { ...generalScreen(), id: CHAIN_TUTORIAL[0]! };
    expect(chainErrors(tutorial, { ...chainSummary(tutorial), picks: 0 })).toEqual([]); // 지금은 예외 목록에도 있다
    const notExempt = CHAIN_EXEMPT.filter((x) => x !== CHAIN_TUTORIAL[0]);
    expect(notExempt).not.toContain(CHAIN_TUTORIAL[0]);
  });

  // ADR-1031 2절: 예외 목록은 비어 가기만 한다. 새 화면은 여기에 못 넣는다.
  it('CHAIN_EXEMPT only shrinks from the first three screens', () => {
    for (const id of CHAIN_EXEMPT) expect(['magpie_nest', 'park_fountain', 'laundromat']).toContain(id);
    expect(new Set(CHAIN_EXEMPT).size).toBe(CHAIN_EXEMPT.length);
    expect(CHAIN_TUTORIAL).toEqual(['magpie_nest']);
  });
});
