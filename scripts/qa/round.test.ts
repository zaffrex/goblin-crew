import { describe, expect, it } from 'vitest';
import { canonicalRound, findDuplicate, normalizeRound, readRounds, run, type Ledger } from './round.ts';

const R = 'c32c154 데스크톱 2';

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

  it('fixed format folds the spellings that slipped through free names (#1019 review)', () => {
    const same = ['c32c154 데스크톱 2', 'C32C154 desktop 2회', 'c32c154abcdef 데스크톱 02', 'c32c154 PC 2 회', 'c32c154 데스크톱 2회차'];
    for (const n of same) expect(canonicalRound(n), n).toBe('c32c154 데스크톱 2');
    expect(canonicalRound('c32c154 모바일 2회')).toBe(canonicalRound('c32c154 휴대폰 2'));
    expect(canonicalRound('c32c154 휴대폰 2회 다시 2')).toBe('c32c154 휴대폰 2 다시 2');
    expect(canonicalRound('c32c154 휴대폰 2 회의')).toBe('c32c154 휴대폰 2 회의'); // 꼬리 첫 글자를 '회'로 먹지 않음
    expect(findDuplicate(['C32C154 Desktop 2회'], 'c32c154 데스크톱 2')).toBe('C32C154 Desktop 2회');
    expect(findDuplicate(['c32c154 데스크톱 2'], 'c32c154 데스크톱 3')).toBeUndefined();
    expect(findDuplicate(['c32c154 데스크톱 2'], 'ea340c7 데스크톱 2')).toBeUndefined();
    for (const bad of ['데스크톱 묶음 2', '모바일 2회', 'c32c15 데스크톱 2', 'c32c154 태블릿 2', 'c32c154 데스크톱', 'c32c154 데스크톱 둘']) {
      expect(canonicalRound(bad), bad).toBeUndefined();
    }
  });

  it('claim writes once; the second claim of the same round exits 1 and writes nothing', () => {
    const { ledger, posted } = fake([]);
    expect(run(ledger, 'claim', 935, R).code).toBe(0);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain(`QA-ROUND: ${R}`);
    const again = run(ledger, 'claim', 935, 'c32c154 desktop 2회');
    expect(again.code).toBe(1);
    expect(again.message).toContain('Mia를 부르지 않아요');
    expect(posted).toHaveLength(1);
  });

  it('check never writes', () => {
    const { ledger, posted } = fake([`QA-ROUND: ${R}`]);
    expect(run(ledger, 'check', 1, 'c32c154 데스크톱 3').code).toBe(0);
    expect(run(ledger, 'check', 1, R).code).toBe(1);
    expect(posted).toHaveLength(0);
  });

  it('rejects bad input with exit 2 (empty name, bad issue, unknown command)', () => {
    const { ledger } = fake([]);
    expect(run(ledger, 'claim', 5, '  ').code).toBe(2);
    expect(run(ledger, 'claim', NaN, R).code).toBe(2);
    expect(run(ledger, 'nope', 5, R).code).toBe(2);
  });

  it('free-form names are exit 2 and write nothing; old free-form ledger lines still read', () => {
    const { ledger, posted } = fake(['QA-ROUND: 데스크톱 묶음 2']);
    const r = run(ledger, 'claim', 935, '데스크톱 묶음 2');
    expect(r.code).toBe(2);
    expect(r.message).toContain('c32c154 데스크톱 3');
    expect(posted).toHaveLength(0);
    expect(run(ledger, 'check', 935, R).code).toBe(0);
  });

  it('gh failure is exit 3, not the duplicate code', () => {
    const bad: Ledger = { texts: () => { throw new Error('gh: HTTP 502'); }, post: () => {} };
    expect(run(bad, 'check', 1, R).code).toBe(3);
    expect(run(bad, 'claim', 1, R).code).toBe(3);
  });

  it('post failure says nothing was written; re-read failure says it may be written (Luna #1021 1)', () => {
    const noPost: Ledger = { texts: () => [], post: () => { throw new Error('gh: HTTP 502'); } };
    const a = run(noPost, 'claim', 1, R);
    expect(a.code).toBe(3);
    expect(a.message).toContain('적힌 것 없음');
    let reads = 0;
    const posted: string[] = [];
    const noReread: Ledger = {
      texts: () => { if (reads++ > 0) throw new Error('gh: HTTP 502'); return []; },
      post: (_i, b) => void posted.push(b),
    };
    const b = run(noReread, 'claim', 1, R);
    expect(b.code).toBe(3);
    expect(b.message).toContain('남았을 수 있어요');
    expect(b.message).toContain(posted[0].match(/claim-id: (\S+)/)![1]);
  });

  it('own claim not visible on re-read (read lag) is exit 3, not a silent pass (Luna #1021 2)', () => {
    const lag: Ledger = { texts: () => [], post: () => {} };
    expect(run(lag, 'claim', 1, R).code).toBe(3);
  });

  it('claim passes (exit 0) when mine is first and a rival landed after (Luna #1021 3)', () => {
    const rival = `**[PM Noah]**\n\nQA-ROUND: c32c154 desktop 2회\nclaim-id: other`;
    const posted: string[] = [];
    const racy: Ledger = {
      texts: () => (posted.length ? [...posted, rival] : []),
      post: (_i, b) => void posted.push(b),
    };
    expect(run(racy, 'claim', 1, R).code).toBe(0);
  });

  it('claim backs off (exit 1) when another claim of the same round landed first', () => {
    const rival = '**[PM Noah]**\n\nQA-ROUND: c32c154 PC 2\nclaim-id: other';
    const posted: string[] = [];
    // 내가 적는 순간 경쟁자 댓글이 내 것보다 앞에 보이는 경우
    const racy: Ledger = {
      texts: () => (posted.length ? [rival, ...posted] : []),
      post: (_i, b) => void posted.push(b),
    };
    expect(run(racy, 'claim', 1, R).code).toBe(1);
  });
});
