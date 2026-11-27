// QA 회차 번호 기록·중복 확인 (#1012 A2). 같은 회차를 두 번 부르면 사용량이 두 번 든다(#764, 11/25).
// 장부는 이슈 댓글이다: 한 줄 `QA-ROUND: <회차>`. PR 없이 바로 쓰고, 어느 역할이 깨어나도 같은 곳을 본다.
// 쓰는 법: node scripts/qa/round.ts check|claim <이슈번호> <배포 해시> <기기> <n> [꼬리...]
//   예: node scripts/qa/round.ts claim 935 c32c154 데스크톱 3
//   check = 읽기만. claim = 없으면 댓글로 적고 0, 이미 있으면 적지 않고 1(= Mia를 부르지 않는다).
// 이름 형식은 고정이다: 사람이 매번 새로 쓰면 '모바일 2회'·'모바일 2 회'가 다른 회차로 빠진다(#1019 리뷰).
// 같은 회차를 다시 돌려야 하면(상한 전 멈춤 등) 끝에 "다시 2"처럼 꼬리를 붙인다. 그게 눈에 남는 기록이다.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

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

const DEVICES: Record<string, string> = {
  데스크톱: '데스크톱', desktop: '데스크톱', pc: '데스크톱',
  휴대폰: '휴대폰', 모바일: '휴대폰', mobile: '휴대폰', phone: '휴대폰', 폰: '휴대폰',
};

export const FORMAT = '<배포 해시 7자 이상> <데스크톱|휴대폰> <n> [꼬리]';

/**
 * 고정 형식 이름을 한 가지 표기로 바꾼다. 형식이 아니면 undefined.
 * 해시는 앞 7자, 기기는 별칭을 묶고, n은 `2`·`2회`·`2 회`·`2회차`·`02`를 같게 본다.
 */
export function canonicalRound(name: string): string | undefined {
  const m = normalizeRound(name).match(/^([0-9a-f]{7,40}) (\S+) 0*(\d+)(?: ?(?:회차|회)(?= |$))?(?: (.+))?$/);
  if (!m) return undefined;
  const device = DEVICES[m[2]];
  if (!device) return undefined;
  return [m[1].slice(0, 7), device, m[3], m[4]].filter(Boolean).join(' ');
}

/** 비교 열쇠. 형식 이전 자유 이름(장부에 남은 옛 줄)은 정규화만 한다. */
function roundKey(name: string): string {
  return canonicalRound(name) ?? normalizeRound(name);
}

export function findDuplicate(existing: readonly string[], name: string): string | undefined {
  const key = roundKey(name);
  return existing.find((r) => roundKey(r) === key);
}

export interface Ledger {
  texts(issue: number): string[];
  post(issue: number, body: string): void;
}

export interface Result {
  code: 0 | 1 | 2 | 3; // 0 새 회차, 1 중복(Mia 부르지 않음), 2 잘못된 입력, 3 장부를 못 읽거나 못 씀(중복 아님)
  message: string;
}

export function run(ledger: Ledger, cmd: string, issue: number, name: string, sig = '**[PM Noah]**'): Result {
  if (cmd !== 'check' && cmd !== 'claim') return { code: 2, message: `모르는 명령 "${cmd}". check 또는 claim.` };
  if (!Number.isInteger(issue) || issue <= 0) return { code: 2, message: '이슈 번호가 필요해요.' };
  if (!normalizeRound(name)) return { code: 2, message: '회차 이름이 비었어요.' };
  const canon = canonicalRound(name);
  if (!canon) return { code: 2, message: `회차 이름 형식이 아니에요: "${name.trim()}". ${FORMAT} (예: c32c154 데스크톱 3)` };
  let existing: string[];
  try {
    existing = readRounds(ledger.texts(issue));
  } catch (e) {
    return { code: 3, message: `장부를 못 읽었어요(중복 아님): ${(e as Error).message.split('\n')[0]}` };
  }
  const dup = findDuplicate(existing, name);
  if (dup) {
    return { code: 1, message: `이미 있는 회차예요: "${dup}" (#${issue}). Mia를 부르지 않아요. 다시 돌릴 거면 이름에 "다시 2"처럼 꼬리를 붙여요.` };
  }
  if (cmd === 'claim') {
    // 다시 읽기: 적은 뒤 같은 회차의 첫 댓글이 내 것(claim-id)이 아니면 동시에 끼어든 쪽이 먼저다 → 중복으로 물러난다.
    const id = randomUUID();
    try {
      ledger.post(issue, `${sig}\n\n${MARK} ${canon}\nclaim-id: ${id}`);
    } catch (e) {
      return { code: 3, message: `장부에 못 썼어요(중복 아님, 적힌 것 없음). 같은 이름으로 다시 돌려도 돼요: ${(e as Error).message.split('\n')[0]}` };
    }
    // 여기부터는 댓글이 이미 남았을 수 있다. 같은 이름으로 다시 claim하면 내 댓글에 걸려 1이 나온다.
    const unsure = `#${issue}에 "${MARK} ${canon}" 댓글이 남았을 수 있어요(claim-id: ${id}). 같은 회차 첫 줄이 이 claim-id면 Mia를 불러도 되고, 아니면 부르지 않아요. 같은 이름으로 다시 claim하지 않아요`;
    let first: string | undefined;
    try {
      first = ledger.texts(issue).find((t) => readRounds([t]).some((r) => roundKey(r) === canon));
    } catch (e) {
      return { code: 3, message: `적은 뒤 다시 못 읽었어요(중복 아님). ${unsure}: ${(e as Error).message.split('\n')[0]}` };
    }
    if (!first) {
      // 읽기 지연으로 내 댓글이 아직 안 보임. 0으로 넘기면 다른 쪽과 둘 다 통과할 수 있다.
      return { code: 3, message: `적었는데 다시 읽을 때 안 보여요(읽기 지연, 중복 아님). ${unsure}.` };
    }
    if (!first.includes(`claim-id: ${id}`)) {
      return { code: 1, message: `동시에 다른 쪽이 먼저 적었어요: "${canon}" (#${issue}). Mia를 부르지 않아요.` };
    }
  }
  return { code: 0, message: `${cmd === 'claim' ? '적었어요' : '새 회차예요'}: "${canon}" (#${issue}, 지금까지 ${existing.length}개).` };
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

// pathToFileURL: 경로에 `#`·공백이 있어도 `file://` 문자열 비교가 어긋나 조용히 exit 0으로 끝나지 않게(#1021 nit).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd = '', issue = '', ...rest] = process.argv.slice(2);
  const r = run(ghLedger(), cmd, Number(issue), rest.join(' '), process.env.QA_ROUND_SIG);
  (r.code === 0 ? console.log : console.error)(r.message);
  process.exit(r.code);
}
