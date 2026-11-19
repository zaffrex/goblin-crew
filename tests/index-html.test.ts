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

  // #109: 아이콘 링크가 없으면 Pages 하위 경로 배포에서 도메인 루트 /favicon.ico가 404 → 콘솔 에러(M1 판정 A4).
  // 실제 아이콘으로 바꿀 때는 public/ 파일을 "/파일명"으로 걸면 Vite가 base를 붙인다. 배포 후 smoke로 A4를 다시 본다.
  it('declares a favicon that never hits the domain-root /favicon.ico', () => {
    const icon = /<link\s+rel="icon"\s+href="([^"]*)"/i.exec(html);
    expect(icon).not.toBeNull();
    expect(icon![1]).not.toBe('/favicon.ico');
  });

  // #479: 시작 카드 목표·이유 줄이 `出られ／ない`처럼 낱말 중간에서 접히지 않게(PR #478 667×375 스크린샷). 구두점·U+200B 뒤에서만 접는다.
  it('start card goal/why lines break only at punctuation or ZWSP, never mid-word', () => {
    const rule = /#card \.goal, #card \.why \{([^}]*)\}/.exec(html);
    expect(rule?.[1]).toMatch(/word-break:\s*keep-all/);
    expect(rule?.[1]).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule?.[1]).not.toMatch(/white-space:\s*nowrap/);
  });
});
