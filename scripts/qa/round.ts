// QA 회차 번호 기록·중복 확인 (#1012 A2). 같은 회차를 두 번 부르면 사용량이 두 번 든다(#764, 11/25).
// 장부는 이슈 댓글이다: 한 줄 `QA-ROUND: <회차>`. PR 없이 바로 쓰고, 어느 역할이 깨어나도 같은 곳을 본다.
// 쓰는 법: node scripts/qa/round.ts check|claim <이슈번호> <회차 이름...>
//   check = 읽기만. claim = 없으면 댓글로 적고 0, 이미 있으면 적지 않고 1(= Mia를 부르지 않는다).
// 같은 회차를 다시 돌려야 하면(상한 전 멈춤 등) 이름에 "다시 2"처럼 다른 꼬리를 붙인다. 그게 눈에 남는 기록이다.
import { execFileSync } from 'node:child_process';

export const MARK = 'QA-ROUND:';

/** 비교용 이름. 공백·대소문자 차이로 같은 회차를 놓치지 않는다. */
export function normalizeRound(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 본문·댓글 글자들에서 `QA-ROUND:` 줄을 모은다(원래 표기 유지, 순서 유지). */
export function readRounds(texts: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^\s*QA-ROUND:\s*(.+?)\s*$/);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

export function findDuplicate(existing: readonly string[], name: string): string | undefined {
  const key = normalizeRound(name);
  return existing.find((r) => normalizeRound(r) === key);
}

export interface Ledger {
  texts(issue: number): string[];
  post(issue: number, body: string): void;
}

export interface Result {
  code: 0 | 1 | 2;
  message: string;
}

export function run(ledger: Ledger, cmd: string, issue: number, name: string, sig = '**[PM Noah]**'): Result {
  if (cmd !== 'check' && cmd !== 'claim') return { code: 2, message: `모르는 명령 "${cmd}". check 또는 claim.` };
  if (!Number.isInteger(issue) || issue <= 0) return { code: 2, message: '이슈 번호가 필요해요.' };
  if (!normalizeRound(name)) return { code: 2, message: '회차 이름이 비었어요.' };
  const existing = readRounds(ledger.texts(issue));
  const dup = findDuplicate(existing, name);
  if (dup) {
    return { code: 1, message: `이미 있는 회차예요: "${dup}" (#${issue}). Mia를 부르지 않아요. 다시 돌릴 거면 이름에 "다시 2"처럼 꼬리를 붙여요.` };
  }
  if (cmd === 'claim') ledger.post(issue, `${sig}\n\n${MARK} ${name.trim()}`);
  return { code: 0, message: `${cmd === 'claim' ? '적었어요' : '새 회차예요'}: "${name.trim()}" (#${issue}, 지금까지 ${existing.length}개).` };
}

function ghLedger(): Ledger {
  return {
    texts(issue) {
      const j = JSON.parse(execFileSync('gh', ['issue', 'view', String(issue), '--json', 'body,comments'], { encoding: 'utf8' }));
      return [j.body ?? '', ...(j.comments ?? []).map((c: { body?: string }) => c.body ?? '')];
    },
    post(issue, body) {
      execFileSync('gh', ['issue', 'comment', String(issue), '--body', body], { encoding: 'utf8' });
    },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [cmd = '', issue = '', ...rest] = process.argv.slice(2);
  const r = run(ghLedger(), cmd, Number(issue), rest.join(' '), process.env.QA_ROUND_SIG);
  (r.code === 0 ? console.log : console.error)(r.message);
  process.exit(r.code);
}
