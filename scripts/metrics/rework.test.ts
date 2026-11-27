import { describe, expect, it } from 'vitest';
import { assertNotTruncated, countRework, dayChunks, dedupe, FETCH_LIMIT, inWindow, M2_START, per100, row, RULE_START } from './rework.ts';

describe('countRework (팀 기준선 #746 2~4번)', () => {
  it('🔁 횟수를 글이 아니라 나온 횟수로 센다 (M1 88회 셈법)', () => {
    const c = countRework([
      { number: 1, reviews: [{ body: '**[FE Theo]**\n🔁 수정 요청\n...\n두 번째 🔁 수정 요청' }] },
      { number: 2, comments: [{ body: '✅ 승인' }] },
    ]);
    expect(c).toEqual({ prs: 2, rework: 2, reworkPrs: 1, decision: 0, other: 2 });
  });

  it('결정·ADR을 가리키는 글은 3번, 나머지는 4번', () => {
    const c = countRework([
      { number: 1, comments: [{ body: '🔁 수정 요청\nADR-0761 5절과 어긋나요' }] },
      { number: 2, comments: [{ body: '🔁 수정 요청\n`docs/decisions/x.md` 참고' }, { body: '🔁 수정 요청 결정 기록에 없어요' }] },
      { number: 3, reviews: [{ body: '🔁 수정 요청 테스트가 빠졌어요' }] },
    ]);
    expect(c.rework).toBe(4);
    expect(c.decision).toBe(3);
    expect(c.other).toBe(1);
    expect(c.reworkPrs).toBe(3);
  });

  it('이모지만 있거나 "🔁 반영"은 세지 않는다', () => {
    const c = countRework([{ number: 1, comments: [{ body: 'Luna 🔁 반영했어요' }, { body: '🔁 그대로' }, {}] }]);
    expect(c.rework).toBe(0);
  });
});

describe('구간', () => {
  it('하루 이하 조각으로 나누고 끝을 넘지 않는다', () => {
    const ch = dayChunks('2026-11-22T05:19:00Z', '2026-11-24T00:00:00Z');
    expect(ch).toEqual([
      ['2026-11-22T05:19:00Z', '2026-11-23T05:19:00Z'],
      ['2026-11-23T05:19:00Z', '2026-11-24T00:00:00Z'],
    ]);
  });

  it('조각 경계에서 겹친 PR은 한 번만', () => {
    expect(dedupe([{ number: 5 }, { number: 6 }, { number: 5 }]).map((p) => p.number)).toEqual([5, 6]);
  });

  it('조건 바뀐 시각은 11/30 00:00 KST', () => {
    expect(new Date(RULE_START).getTime()).toBe(new Date('2026-11-30T00:00:00+09:00').getTime());
  });

  it('M1 기준선 숫자를 같은 모양으로 낸다', () => {
    const r = row('M1', '2026-11-14T15:00:00Z', '2026-11-22T05:19:00Z', { prs: 525, rework: 88, reworkPrs: 65, decision: 37, other: 51 });
    expect(r).toContain('| 525 | 16.8 (88회, PR 65개) | 7.0 (37회) | 9.7 (51회) |');
    expect(per100(1, 0)).toBe('-');
  });

  it('가의 끝 = 나의 시작에 머지된 PR은 나에만 (반열린 구간)', () => {
    const prs = [
      { number: 1, mergedAt: '2026-11-29T14:59:59Z' },
      { number: 2, mergedAt: RULE_START },
      { number: 3, mergedAt: '2026-11-29T15:00:01Z' },
    ];
    expect(inWindow(prs, M2_START, RULE_START).map((p) => p.number)).toEqual([1]);
    expect(inWindow(prs, RULE_START, '2026-12-06T00:00:00Z').map((p) => p.number)).toEqual([2, 3]);
  });

  it('mergedAt이 없으면 멈춘다', () => {
    expect(() => inWindow([{ number: 9 }], M2_START, RULE_START)).toThrow('#9');
  });

  it('조각이 상한만큼 오면 잘렸을 수 있어 멈춘다', () => {
    expect(() => assertNotTruncated(FETCH_LIMIT - 1, 'a', 'b')).not.toThrow();
    expect(() => assertNotTruncated(FETCH_LIMIT, 'a', 'b')).toThrow('잘렸을 수 있어');
  });
});
