import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PR 코멘트의 [[puzzle]] 토큰이 Kai(puzzle)를 깨워야 한다(결정 기록 2026-11-22 puzzle-gag-writer-role).
// qa는 토큰으로 깨우지 않는다(#516 격리 실행).
const script = fileURLToPath(new URL('../scripts/route-event.sh', import.meta.url));

// gh api(루프 방지 숫자)는 0, gh workflow run은 인자를 로그에 남긴다.
const FAKE_GH = `#!/usr/bin/env bash
case "$1" in
  api) echo 0 ;;
  workflow) echo "$*" >> "$GH_LOG" ;;
esac
`;

function wakes(body: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'route-'));
  writeFileSync(join(dir, 'gh'), FAKE_GH);
  chmodSync(join(dir, 'gh'), 0o755);
  const ev = join(dir, 'event.json');
  writeFileSync(
    ev,
    JSON.stringify({
      issue: { number: 900, pull_request: {}, html_url: 'u', labels: [] },
      comment: { body, user: { login: 'claude[bot]' }, author_association: 'NONE', html_url: 'u' },
    }),
  );
  const log = join(dir, 'gh.log');
  const r = spawnSync('bash', [script], {
    env: {
      PATH: `${dir}:${process.env.PATH ?? ''}`,
      GITHUB_EVENT_PATH: ev,
      GITHUB_REPOSITORY: 'x/y',
      EVENT_NAME: 'issue_comment',
      ACTION: 'created',
      GH_LOG: log,
    },
    encoding: 'utf8',
    timeout: 20000,
  });
  expect(r.status, r.stderr).toBe(0);
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((l) => /role=(\w+)/.exec(l)?.[1] ?? '')
    .sort();
}

describe('route-event role tokens', () => {
  it('wakes puzzle on [[puzzle]]', () => {
    expect(wakes('**[디자이너 Luna]**\n\n[[puzzle]] 반영 부탁해요.')).toEqual(['puzzle']);
  });

  it('wakes puzzle and frontend together, not the author', () => {
    expect(wakes('**[퍼즐 Kai]**\n\n[[designer]] [[frontend]] [[puzzle]] 다시 봐 주세요.')).toEqual([
      'designer',
      'frontend',
    ]);
  });

  it('does not wake qa by token', () => {
    expect(wakes('**[PM Noah]**\n\n[[qa]] 돌려 주세요.')).toEqual([]);
  });

  it('ignores [[puzzle]] inside inline code', () => {
    expect(wakes('**[인프라 Sam]**\n\n토큰 `[[puzzle]]` 설명이에요.')).toEqual([]);
  });
});
