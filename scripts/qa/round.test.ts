import { describe, expect, it } from 'vitest';
import { findDuplicate, normalizeRound, readRounds, run, type Ledger } from './round.ts';

function fake(texts: string[]) {
  const posted: string[] = [];
  const ledger: Ledger = {
    texts: () => [...texts, ...posted],
    post: (_i, body) => void posted.push(body),
  };
  return { ledger, posted };
}

describe('QA round ledger (#1012 A2)', () => {
  it('reads QA-ROUND lines from body and comments, ignores prose that merely mentions it', () => {
    const got = readRounds(['본문\nQA-ROUND: 모바일 2회\n', '**[PM Noah]**\n\nQA-ROUND: 데스크톱 묶음 2', '설명: QA-ROUND: 는 줄 처음에만']);
    expect(got).toEqual(['모바일 2회', '데스크톱 묶음 2']);
  });

  it('treats spacing, case and full-width forms as the same round', () => {
    expect(normalizeRound('  Mobile   2회 ')).toBe(normalizeRound('mobile 2회'));
    expect(normalizeRound('ＭＯＢＩＬＥ 2회')).toBe('mobile 2회');
    expect(findDuplicate(['데스크톱 묶음 2'], '데스크톱  묶음 2')).toBe('데스크톱 묶음 2');
    expect(findDuplicate(['데스크톱 묶음 2'], '데스크톱 묶음 2 다시 2')).toBeUndefined();
  });

  it('claim writes once; the second claim of the same round exits 1 and writes nothing', () => {
    const { ledger, posted } = fake([]);
    expect(run(ledger, 'claim', 935, '데스크톱 묶음 2').code).toBe(0);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain('QA-ROUND: 데스크톱 묶음 2');
    const again = run(ledger, 'claim', 935, '데스크톱 묶음 2');
    expect(again.code).toBe(1);
    expect(again.message).toContain('Mia를 부르지 않아요');
    expect(posted).toHaveLength(1);
  });

  it('check never writes', () => {
    const { ledger, posted } = fake(['QA-ROUND: a']);
    expect(run(ledger, 'check', 1, 'b').code).toBe(0);
    expect(run(ledger, 'check', 1, 'a').code).toBe(1);
    expect(posted).toHaveLength(0);
  });

  it('rejects bad input with exit 2 (empty name, bad issue, unknown command)', () => {
    const { ledger } = fake([]);
    expect(run(ledger, 'claim', 5, '  ').code).toBe(2);
    expect(run(ledger, 'claim', NaN, 'x').code).toBe(2);
    expect(run(ledger, 'nope', 5, 'x').code).toBe(2);
  });

  it('gh failure is exit 3, not the duplicate code', () => {
    const bad: Ledger = { texts: () => { throw new Error('gh: HTTP 502'); }, post: () => {} };
    expect(run(bad, 'check', 1, 'a').code).toBe(3);
    expect(run(bad, 'claim', 1, 'a').code).toBe(3);
  });

  it('claim backs off (exit 1) when another claim of the same round landed first', () => {
    const rival = '**[PM Noah]**\n\nQA-ROUND: a\nclaim-id: other';
    const posted: string[] = [];
    // 내가 적는 순간 경쟁자 댓글이 내 것보다 앞에 보이는 경우
    const racy: Ledger = {
      texts: () => (posted.length ? [rival, ...posted] : []),
      post: (_i, b) => void posted.push(b),
    };
    expect(run(racy, 'claim', 1, 'a').code).toBe(1);
  });
});
