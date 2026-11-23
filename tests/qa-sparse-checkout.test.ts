import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

// #601 모바일 1회(11/23 20:20): #850이 `scripts/qa/seen.ts`에서 `content/text/ja.json`을 읽게 해서, `content/`를 안 받는
// QA sparse-checkout(`agent.yml`)에서 browse.ts가 시작 전에 멈췄다. CI는 전체 checkout이라 초록이었다.
// 그래서 agent.yml의 QA sparse 목록만 임시 폴더에 복사하고 browse.ts를 띄워, import·모듈 최상위 읽기가 목록 밖을 안 건드리는지 본다.
// 한계: URL 검사 뒤(브라우저 실행 중)에 읽는 파일은 못 잡는다.
const root = fileURLToPath(new URL('..', import.meta.url));

/** agent.yml QA checkout의 `sparse-checkout: |` 블록 경로들. */
function qaSparsePaths(workflow: string): string[] {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => /^\s*sparse-checkout:\s*\|\s*$/.test(l));
  if (start < 0) throw new Error('agent.yml에 sparse-checkout 블록이 없어요');
  const paths: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^\s+(\/\S+)\s*$/.exec(l);
    if (!m) break;
    paths.push(m[1]!.replace(/^\//, ''));
  }
  return paths;
}

describe('QA sparse-checkout만으로 QA 도구가 뜬다 (#601)', () => {
  const paths = qaSparsePaths(readFileSync(join(root, '.github/workflows/agent.yml'), 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'qa-sparse-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('목록에 QA 도구가 있고 정답 쪽(content/, docs/, src/)은 없다', () => {
    expect(paths).toContain('scripts/qa/');
    for (const p of paths) expect(p).not.toMatch(/^(content|docs|src)(\/|$)/);
  });

  it('browse.ts가 import 단계에서 안 멈추고 URL 검사까지 간다', () => {
    for (const p of paths) cpSync(join(root, p), join(dir, p), { recursive: true });
    // 일부러 막히는 URL을 줘서 브라우저는 안 띄운다. 여기까지 왔으면 import와 모듈 최상위 코드는 다 돈 것이다.
    const r = spawnSync(process.execPath, ['scripts/qa/browse.ts', '--url', 'https://example.com/', '--shot', join(dir, 'x.png')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 20_000,
    });
    expect(r.stderr).not.toMatch(/ENOENT|ERR_MODULE_NOT_FOUND|Cannot find module/);
    expect(r.stderr).toContain('배포본 첫 페이지');
  });
});
