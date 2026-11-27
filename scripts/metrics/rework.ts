// 팀 기준선(#746) 1~4번 숫자를 한 번에 센다(#89 실험). 지금까지 PM이 손으로 세서, 다시 셀 때마다 숫자가 조금씩 달라졌다.
// 정의는 docs/decisions/2026-11-22-external-decision-tool-trial.md 그대로다. 여기서 바꾸지 않는다.
//   1 머지된 PR 수
//   2 🔁 / PR 100: 코멘트·리뷰 본문에 나온 `🔁 수정 요청` 횟수(글 하나에 두 번이면 2회, M1 88회가 이 셈법이다)
//   3 그중 본문에 `docs/decisions`·`docs/adr`·`ADR-숫자`·`결정 기록`이 나오는 글의 횟수(근사치)
//   4 그 밖의 🔁
// 쓰는 법:
//   node scripts/metrics/rework.ts <시작 ISO> <끝 ISO>   예: 2026-11-22T05:19:00Z 2026-11-27T05:15:00Z
//   node scripts/metrics/rework.ts m2                    M2-가 / M2-나(11/30 00:00 KST 조건 바뀜, 나는 지금까지)
// 한 번에 받으면 GraphQL 502가 나서(11/27) 하루씩 나눠 받는다.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const REWORK = '🔁 수정 요청';
export const DECISION_REF = /docs\/decisions|docs\/adr|ADR-\d+|결정 기록/;

/** 조건 바뀐 시각: 2026-11-30 00:00 KST. 가·나를 한 숫자로 합치지 않는다. */
export const M2_START = '2026-11-22T05:19:00Z';
export const RULE_START = '2026-11-29T15:00:00Z';

export interface Pr {
  number: number;
  mergedAt?: string;
  comments?: { body?: string }[];
  reviews?: { body?: string }[];
}

export interface Counts {
  prs: number;
  rework: number;
  reworkPrs: number;
  decision: number;
  other: number;
}

export function countRework(prs: readonly Pr[]): Counts {
  const c: Counts = { prs: prs.length, rework: 0, reworkPrs: 0, decision: 0, other: 0 };
  for (const pr of prs) {
    const bodies = [...(pr.comments ?? []), ...(pr.reviews ?? [])].map((x) => x.body ?? '');
    let prHits = 0;
    for (const b of bodies) {
      const n = b.split(REWORK).length - 1;
      if (!n) continue;
      prHits += n;
      if (DECISION_REF.test(b)) c.decision += n;
      else c.other += n;
    }
    c.rework += prHits;
    if (prHits) c.reworkPrs++;
  }
  return c;
}

export function per100(n: number, prs: number): string {
  return prs ? ((n / prs) * 100).toFixed(1) : '-';
}

/** [from, to)를 하루 이하 조각으로 나눈다. */
export function dayChunks(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  const end = Date.parse(to);
  let t = Date.parse(from);
  if (Number.isNaN(t) || Number.isNaN(end)) throw new Error(`날짜를 못 읽음: ${from} ${to}`);
  while (t < end) {
    const next = Math.min(t + 86_400_000, end);
    out.push([iso(t), iso(next)]);
    t = next;
  }
  return out;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** 조각끼리 경계가 겹치면 같은 PR이 두 번 올 수 있어 번호로 한 번만 센다. */
export function dedupe(prs: readonly Pr[]): Pr[] {
  const seen = new Map<number, Pr>();
  for (const p of prs) seen.set(p.number, p);
  return [...seen.values()];
}

/**
 * 검색 `merged:a..b`는 양끝을 포함해서, 가의 끝과 나의 시작(RULE_START)에 딱 머지된 PR이 양쪽에 다 세진다(#1025 Sam 리뷰).
 * `mergedAt`으로 [from, to) 반열린 구간만 남긴다. `mergedAt`이 없으면 구간을 못 정하니 멈춘다.
 */
export function inWindow(prs: readonly Pr[], from: string, to: string): Pr[] {
  const a = Date.parse(from);
  const b = Date.parse(to);
  return prs.filter((p) => {
    const t = Date.parse(p.mergedAt ?? '');
    if (Number.isNaN(t)) throw new Error(`PR #${p.number} mergedAt 없음`);
    return t >= a && t < b;
  });
}

export const FETCH_LIMIT = 1000;

/** 한 조각이 상한만큼 오면 잘렸는지 알 수 없다. 조용히 틀린 숫자를 내느니 멈춘다(#1025 Sam 리뷰). */
export function assertNotTruncated(n: number, a: string, b: string): void {
  if (n >= FETCH_LIMIT) throw new Error(`${a}..${b} 조각이 ${n}건(상한 ${FETCH_LIMIT}): 잘렸을 수 있어 멈춤. 조각을 더 잘게 나눈다`);
}

function fetchWindow(from: string, to: string): Pr[] {
  const all: Pr[] = [];
  for (const [a, b] of dayChunks(from, to)) {
    const out = execFileSync('gh', [
      'pr', 'list', '--state', 'merged', '--search', `merged:${a}..${b}`,
      '--limit', String(FETCH_LIMIT), '--json', 'number,mergedAt,comments,reviews',
    ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const got = JSON.parse(out) as Pr[];
    assertNotTruncated(got.length, a, b);
    all.push(...got);
  }
  return inWindow(dedupe(all), from, to);
}

export function row(label: string, from: string, to: string, c: Counts): string {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return `| ${label} | ${from} ~ ${to} (${days.toFixed(1)}일) | ${c.prs} | ${per100(c.rework, c.prs)} (${c.rework}회, PR ${c.reworkPrs}개) | ${per100(c.decision, c.prs)} (${c.decision}회) | ${per100(c.other, c.prs)} (${c.other}회) |`;
}

export const HEADER = [
  '| 구간 | 기간(UTC) | 1 머지된 PR | 2 🔁 / PR 100 | 3 결정·ADR을 가리킨 🔁 / PR 100 | 4 그 밖의 🔁 / PR 100 |',
  '|---|---|---|---|---|---|',
  '| M1 (고정값) | 11/15 00:00 ~ 11/22 14:19 KST | 525 | 16.8 (88회, PR 65개) | 7.0 (37회) | 9.7 (51회) |',
].join('\n');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const now = iso(Date.now());
  let windows: [string, string, string][];
  if (args[0] === 'm2') {
    windows = [['M2-가 (도구만)', M2_START, now < RULE_START ? now : RULE_START]];
    if (now > RULE_START) windows.push(['M2-나 (도구+찾아보기 규칙)', RULE_START, now]);
  } else if (args.length === 2) {
    windows = [['지정 구간', args[0], args[1]]];
  } else {
    console.error('쓰는 법: node scripts/metrics/rework.ts m2 | <시작 ISO> <끝 ISO>');
    process.exit(2);
  }
  console.log(HEADER);
  for (const [label, from, to] of windows) console.log(row(label, from, to, countRework(fetchWindow(from, to))));
  if (args[0] === 'm2') console.log('\n11/30 00:00 KST(= 11/29 15:00 UTC) 조건 바뀜. 가와 나를 합치지 않는다.');
}
