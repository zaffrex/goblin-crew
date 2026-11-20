import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// #566: 커밋 제목 같은 외부 입력을 Slack에 올릴 때 {@role}·{CEO}·<@U..>가 실제 멘션이 되면 안 된다.
const script = fileURLToPath(new URL('../scripts/slack.sh', import.meta.url));

function post(text: string, ...extra: string[]): string {
  const r = spawnSync('bash', [script, '--as', 'infra', 'post', 'C0TEST', text, ...extra], {
    env: { PATH: process.env.PATH ?? '', SLACK_BOT_TOKEN: 'dummy', SLACK_DRY_RUN: '1' },
    encoding: 'utf8',
  });
  expect(r.status, r.stderr).toBe(0);
  return (JSON.parse(r.stdout) as { text: string }).text;
}

describe('scripts/slack.sh post --no-mentions', () => {
  it('keeps role/CEO tokens verbatim and escapes Slack control characters', () => {
    const t = post('fix {@pm} {CEO} <@U123> <!channel> a&b', '--no-mentions');
    expect(t).toBe('fix {@pm} {CEO} &lt;@U123&gt; &lt;!channel&gt; a&amp;b');
  });

  it('still expands {CEO} by default', () => {
    expect(post('hi {CEO}')).toMatch(/^hi <@\w+>$/);
  });

  it('accepts --thread together with --no-mentions', () => {
    const r = spawnSync('bash', [script, '--as', 'infra', 'post', 'C0TEST', 'x', '--no-mentions', '--thread', '1.2'], {
      env: { PATH: process.env.PATH ?? '', SLACK_BOT_TOKEN: 'dummy', SLACK_DRY_RUN: '1' },
      encoding: 'utf8',
    });
    expect(JSON.parse(r.stdout).thread_ts).toBe('1.2');
  });
});
