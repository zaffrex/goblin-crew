import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// #57: usage-report.sh 루프 감지(tick/event 별도 임계, 연속 실패)와 usage-daily.sh의 WARN 포함·중복 방지.
const report = fileURLToPath(new URL('../scripts/usage-report.sh', import.meta.url));
const daily = fileURLToPath(new URL('../scripts/usage-daily.sh', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'usage-'));

type Run = { name: string; createdAt: string; updatedAt: string; conclusion: string; status: string };
const base = Date.now() - 3 * 3600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
function runs(role: string, mode: string, n: number, spacingMin: number, conclusion = 'success', offset = 0): Run[] {
  return Array.from({ length: n }, (_, i) => {
    const t = base + offset + i * spacingMin * 60_000;
    return { name: `${role} · ${mode}`, createdAt: iso(t), updatedAt: iso(t + 60_000), conclusion, status: 'completed' };
  });
}
function runReport(rs: Run[]): string {
  const f = join(dir, `r${Math.random()}.json`);
  writeFileSync(f, JSON.stringify(rs));
  const r = spawnSync('bash', [report, '24'], { env: { PATH: process.env.PATH ?? '', USAGE_RUNS_JSON: f }, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout;
}

describe('usage-report.sh loop detection', () => {
  it('flags 6 tick runs within an hour', () => {
    expect(runReport(runs('pm', 'tick', 6, 5))).toMatch(/LOOP\? pm: 1시간 안에 tick 6회/);
  });
  it('does not flag 8 event runs within an hour (normal mention burst)', () => {
    expect(runReport(runs('designer', 'event', 8, 5))).not.toContain('LOOP?');
  });
  it('flags 12 event runs within an hour', () => {
    expect(runReport(runs('frontend', 'event', 12, 3))).toMatch(/LOOP\? frontend: 1시간 안에 event 12회/);
  });
  it('flags 3 consecutive failures but not 2', () => {
    expect(runReport(runs('infra', 'tick', 3, 30, 'failure'))).toMatch(/LOOP\? infra: 연속 실패 3회/);
    expect(runReport(runs('infra', 'tick', 2, 30, 'failure'))).not.toContain('LOOP?');
  });
  it('resets the failure streak on a success', () => {
    const rs = [...runs('be', 'tick', 2, 20, 'failure'), ...runs('be', 'tick', 1, 20, 'success', 3 * 20 * 60_000), ...runs('be', 'tick', 2, 20, 'failure', 4 * 20 * 60_000)];
    expect(runReport(rs)).not.toContain('LOOP?');
  });
});

describe('usage-daily.sh', () => {
  function stubs(historyOut: string): NodeJS.ProcessEnv {
    const bin = mkdtempSync(join(tmpdir(), 'bin-'));
    // fake gh: total_count 5 but only 2 runs returned -> truncation WARN
    writeFileSync(
      join(bin, 'gh'),
      `#!/usr/bin/env bash\nif [[ "$*" == *total_count* ]]; then echo 5; else echo '{"name":"pm · tick","createdAt":"2026-11-21T00:00:00Z","updatedAt":"2026-11-21T00:01:00Z","conclusion":"success","status":"completed"}'; fi\n`,
    );
    chmodSync(join(bin, 'gh'), 0o755);
    const slack = join(bin, 'slack.sh');
    writeFileSync(slack, `#!/usr/bin/env bash\necho "$*" > "${join(bin, 'args')}"\ncat <<'EOF'\n${historyOut}\nEOF\n`);
    chmodSync(slack, 0o755);
    return { PATH: `${bin}:${process.env.PATH ?? ''}`, SLACK_SH: slack, TZ: 'UTC' };
  }
  const hourKst = Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Seoul' }).format(new Date()));

  it.skipIf(hourKst < 9)('includes truncation WARN and passes oldest_ts of 09:00 KST', () => {
    const r = spawnSync('bash', [daily, '--dry'], { env: stubs('--- ts=1 | x\nhello'), encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/WARN: truncated/);
    expect(r.stdout).toMatch(/^\[사용량 기록 \d{4}-\d{2}-\d{2}\]/);
  });
  it.skipIf(hourKst < 9)('skips when the marker is already in the window', () => {
    const today = new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(new Date());
    const r = spawnSync('bash', [daily, '--dry'], { env: stubs(`--- ts=1 | x\n[사용량 기록 ${today}] ...`), encoding: 'utf8' });
    expect(r.stdout).toContain('already posted today');
  });
});
