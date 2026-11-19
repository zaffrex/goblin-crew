import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// #463 (주간 회고 #1 액션 b): status.md는 모든 에이전트가 매 실행마다 읽는 "지금 상태" 요약이다.
// 11/20에 126줄인데 65KB까지 불어났다(줄 하나가 1,300자). 줄 수만 세면 긴 줄로 다시 불어나서 바이트도 같이 본다.
// 실패하면 지난 점검 기록을 docs/team/status-log/로 옮긴다. 상한을 올리지 않는다.
const MAX_LINES = 150;
const MAX_BYTES = 16 * 1024;

const status = readFileSync(fileURLToPath(new URL('../docs/team/status.md', import.meta.url)));

describe('docs/team/status.md', () => {
  it(`stays within ${MAX_LINES} lines`, () => {
    const lines = status.toString('utf8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(MAX_LINES);
  });

  it(`stays within ${MAX_BYTES} bytes`, () => {
    expect(status.byteLength).toBeLessThanOrEqual(MAX_BYTES);
  });
});
