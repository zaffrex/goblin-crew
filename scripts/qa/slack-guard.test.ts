// QA 실행의 Slack 채널 차단 회귀 테스트 (#516, #535 리뷰). 가짜 토큰만 쓰고 가드에서 멈추는지만 본다.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (env: Record<string, string>, ...args: string[]) => {
  const r = spawnSync('scripts/slack.sh', args, {
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 10_000,
  });
  return { code: r.status, err: r.stderr };
};

const ALL = { AGENT_ROLE: 'qa', SLACK_TOKEN_QA: 'fake-qa', SLACK_TOKEN_PM: 'fake-pm', SLACK_BOT_TOKEN: 'fake-legacy' };

describe('slack.sh qa guard', () => {
  it('blocks dev history for qa', () => {
    const r = run(ALL, 'history', 'dev');
    expect(r.code).not.toBe(0);
    expect(r.err).toContain('qa는 이 채널을 쓸 수 없어요');
  });
  it('blocks --as pm in a qa run', () => {
    const r = run(ALL, '--as', 'pm', 'history', 'dev');
    expect(r.code).not.toBe(0);
    expect(r.err).toContain('qa 실행은 --as qa만');
  });
  it('does not fall back to another role token or legacy token when qa token is missing', () => {
    const env: Record<string, string> = { ...ALL };
    delete env.SLACK_TOKEN_QA;
    const r = run(env, 'history', 'dev');
    expect(r.code).not.toBe(0);
    expect(r.err).toContain("no Slack token for role 'qa'");
  });
});
