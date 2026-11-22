import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// #751: Mia(qa)는 #goblin-general에 쓰기만 하고 읽지 못한다. 읽는 건 진마씨가 Mia를 멘션한 글 하나뿐이다.
const slack = fileURLToPath(new URL('../scripts/slack.sh', import.meta.url));
const listener = fileURLToPath(new URL('../scripts/slack-listener.sh', import.meta.url));
const team = JSON.parse(readFileSync(fileURLToPath(new URL('../team/team.json', import.meta.url)), 'utf8')) as {
  ceo: { slack_user_id: string };
  slack_channels: Record<string, string>;
};
const CEO = team.ceo.slack_user_id;
const GENERAL = team.slack_channels.general;
const QA_UID = 'UQABOT';
const TS = '1700000001.000100';
const THREAD = '1700000000.000100';

// 토큰 'qatok'은 Mia, 그 외는 PM으로 인식하는 가짜 Slack.
function fakeCurl(messages: object[]): string {
  return `#!/usr/bin/env bash
args="$*"
case "$args" in
  *auth.test*) case "$args" in *qatok*) echo '{"ok":true,"user_id":"${QA_UID}"}' ;; *) echo '{"ok":true,"user_id":"UPMBOT"}' ;; esac ;;
  *conversations.open*) echo '{"ok":true,"channel":{"id":"DDM1"}}' ;;
  *users.info*) echo '{"ok":true,"user":{"name":"x"}}' ;;
  *conversations.replies*|*conversations.history*)
    case "$args" in
      *${GENERAL}*) echo '{"ok":true,"messages":${JSON.stringify(messages).replace(/'/g, '')}}' ;;
      *) echo '{"ok":true,"messages":[]}' ;;
    esac ;;
  *) echo '{"ok":true}' ;;
esac
`;
}

function withBin(messages: object[]): string {
  const bin = mkdtempSync(join(tmpdir(), 'fakebin-'));
  writeFileSync(join(bin, 'curl'), fakeCurl(messages));
  writeFileSync(join(bin, 'gh'), '#!/usr/bin/env bash\nexit 1\n');
  chmodSync(join(bin, 'curl'), 0o755);
  chmodSync(join(bin, 'gh'), 0o755);
  return bin;
}

function qa(args: string[], messages: object[] = []) {
  const bin = withBin(messages);
  return spawnSync('bash', [slack, '--as', 'qa', ...args], {
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, AGENT_ROLE: 'qa', SLACK_TOKEN_QA: 'qatok', SLACK_DRY_RUN: '1' },
    encoding: 'utf8',
  });
}

describe('slack.sh qa: write general, never read it', () => {
  it('allows post to general and dev', () => {
    for (const ch of ['general', 'dev']) {
      const r = qa(['post', ch, 'hi']);
      expect(r.status, r.stderr).toBe(0);
    }
  });
  it('still blocks other channels for post', () => {
    expect(qa(['post', 'ceo', 'hi']).status).not.toBe(0);
    expect(qa(['post', 'meeting', 'hi']).status).not.toBe(0);
  });
  it('keeps history and thread blocked', () => {
    expect(qa(['history', 'general']).status).not.toBe(0);
    expect(qa(['thread', 'general', TS]).status).not.toBe(0);
  });
});

describe('slack.sh qa read-mention', () => {
  const ok = { ts: TS, user: CEO, text: `<@${QA_UID}> 안녕` };
  it('returns the one CEO message that mentions qa', () => {
    const r = qa(['read-mention', 'general', TS], [ok]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('안녕');
  });
  it('returns a thread reply by exact ts and prints nothing else', () => {
    const parent = { ts: THREAD, user: 'UOTHER', text: 'secret clue' };
    const r = qa(['read-mention', 'general', TS, THREAD], [parent, { ...ok, thread_ts: THREAD }]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).not.toContain('secret clue');
  });
  it('rejects a message not written by the CEO', () => {
    expect(qa(['read-mention', 'general', TS], [{ ...ok, user: 'UOTHER' }]).status).not.toBe(0);
  });
  it('rejects a CEO message without a qa mention', () => {
    expect(qa(['read-mention', 'general', TS], [{ ts: TS, user: CEO, text: 'no mention' }]).status).not.toBe(0);
  });
  it('rejects when the requested ts is a different message (thread parent)', () => {
    const parent = { ts: THREAD, user: CEO, text: `<@${QA_UID}> parent` };
    expect(qa(['read-mention', 'general', TS, THREAD], [parent]).status).not.toBe(0);
  });
  it('rejects other channels, malformed ts, and non-qa actors', () => {
    expect(qa(['read-mention', 'dev', TS], [ok]).status).not.toBe(0);
    expect(qa(['read-mention', 'general', 'abc'], [ok]).status).not.toBe(0);
    const r = spawnSync('bash', [slack, '--as', 'infra', 'read-mention', 'general', TS], {
      env: { PATH: `${withBin([ok])}:${process.env.PATH ?? ''}`, SLACK_TOKEN_INFRA: 'dummy' },
      encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
  });
});

describe('slack-listener.sh qa chat dispatch', () => {
  function run(msg: object): string {
    const bin = withBin([msg]);
    const r = spawnSync('bash', [listener], {
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        REPO: 'x/y',
        SLACK_TOKEN_PM: 'pmtok',
        SLACK_TOKEN_QA: 'qatok',
        DRY_RUN: '1',
        POLL_SECONDS: '0',
        MAX_SECONDS: '2',
        LOOKBACK_SECONDS: '100000',
      },
      encoding: 'utf8',
      timeout: 20000,
    });
    return r.stdout;
  }
  const now = () => Math.floor(Date.now() / 1000);
  it('wakes qa for a CEO mention in general, without logging the body', () => {
    const out = run({ ts: `${now() - 3}.000100`, user: CEO, text: `<@${QA_UID}> 비밀본문` });
    expect(out).toMatch(/DISPATCH qa :: QA 대화 모드[\s\S]*channel=general ts=\d+\.000100/);
    expect(out).not.toContain('비밀본문');
  });
  it('ignores a qa mention from someone other than the CEO', () => {
    expect(run({ ts: `${now() - 3}.000100`, user: 'UPMBOT', text: `<@${QA_UID}> hi` })).not.toMatch(/DISPATCH qa/);
  });
  it('ignores a CEO message that does not mention qa', () => {
    expect(run({ ts: `${now() - 3}.000100`, user: CEO, text: 'hello' })).not.toMatch(/DISPATCH qa/);
  });
});
