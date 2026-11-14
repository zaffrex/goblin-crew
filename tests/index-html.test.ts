import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ADR-0005: L3 정식 런칭 전까지 모든 빌드는 검색 노출을 막는다.
// 이 테스트가 실패하면 noindex가 빠진 것이다. 런칭 L3 결정 PR에서만 이 테스트와 meta를 같이 지운다.
const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

describe('index.html', () => {
  it('blocks search indexing until the L3 launch decision', () => {
    const robots = /<meta\s+name="robots"\s+content="([^"]*)"/i.exec(html);
    expect(robots?.[1]).toMatch(/\bnoindex\b/);
  });
});
