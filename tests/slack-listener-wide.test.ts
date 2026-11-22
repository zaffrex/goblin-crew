import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 스레드 원글이 72시간보다 오래돼도(예: 7일 전) 방금 달린 멘션 답글이 5분 주기 넓은 조회로 감지돼야 한다.
const script = fileURLToPath(new URL('../scripts/slack-listener.sh', import.meta.url));

const FAKE_CURL = `#!/usr/bin/env bash
args="$*"
now=$FAKE_NOW
case "$args" in
  *auth.test*) echo '{"ok":true,"user_id":"UPMBOT"}' ;;
  *conversations.open*) echo '{"ok":true,"channel":{"id":"DDM1"}}' ;;
  *conversations.history*)
    case "$args" in
      *channel=C0CHJNRF6FM*)
        oldest=$(grep -o 'oldest=[0-9]*' <<<"$args" | cut -d= -f2)
        if [ "$oldest" -lt $((now - 5 * 86400)) ]; then
          echo "{\\"ok\\":true,\\"messages\\":[{\\"ts\\":\\"$((now - 7 * 86400)).000100\\",\\"user\\":\\"UPMBOT\\",\\"thread_ts\\":\\"$((now - 7 * 86400)).000100\\",\\"latest_reply\\":\\"$((now - 5)).000200\\"}]}"
        else echo "{\\"ok\\":true,\\"messages\\":[{\\"ts\\":\\"$((now - 2)).000300\\",\\"user\\":\\"UPMBOT\\"}]}"; fi ;;
      *) echo '{"ok":true,"messages":[]}' ;;
    esac ;;
  *conversations.replies*)
    echo "{\\"ok\\":true,\\"messages\\":[{\\"ts\\":\\"$((now - 7 * 86400)).000100\\",\\"user\\":\\"UPMBOT\\"},{\\"ts\\":\\"$((now - 5)).000200\\",\\"user\\":\\"U0C8BUMA9CL\\",\\"text\\":\\"<@UPMBOT> hi\\",\\"thread_ts\\":\\"$((now - 7 * 86400)).000100\\"}]}" ;;
  *) echo '{"ok":true}' ;;
esac
`;

function run(wideEvery: string): string {
  const bin = mkdtempSync(join(tmpdir(), 'fakebin-'));
  writeFileSync(join(bin, 'curl'), FAKE_CURL);
  writeFileSync(join(bin, 'gh'), '#!/usr/bin/env bash\nexit 1\n');
  chmodSync(join(bin, 'curl'), 0o755);
  chmodSync(join(bin, 'gh'), 0o755);
  const r = spawnSync('bash', [script], {
    env: {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      REPO: 'x/y',
      SLACK_TOKEN_PM: 'dummy',
      DRY_RUN: '1',
      POLL_SECONDS: '0',
      MAX_SECONDS: '2',
      WIDE_EVERY_CYCLES: wideEvery,
      FAKE_NOW: String(Math.floor(Date.now() / 1000)),
    },
    encoding: 'utf8',
    timeout: 20000,
  });
  return r.stdout;
}

describe('scripts/slack-listener.sh wide thread scan', () => {
  it('dispatches pm for a fresh reply on a 7-day-old thread in the wide scan', () => {
    expect(run('1')).toMatch(/DISPATCH pm ::[\s\S]*channel=ceo [^\n]*thread_ts=\d+\.000100/);
  });

  it('does not see it on 72h-only ticks', () => {
    expect(run('100000')).not.toMatch(/DISPATCH pm/);
  });

  it('still wakes after a normal tick moved the cursor, and only once (separate wide cursor + SEEN)', () => {
    const out = run('2');
    expect(out.match(/DISPATCH pm ::/g)?.length).toBe(1);
  });
});
