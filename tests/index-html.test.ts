import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROTATE_QUERY, rotateIconSvg } from '../src/core/rotate';

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

// #624: 세로 화면 안내(설계 ui-interaction.md 9절). 안내는 JS 전부터 보여야 해서 index.html에 직접 있다.
// 원본(쿼리·아이콘 격자)은 src/core/rotate.ts. 그쪽을 바꾸면 이 테스트가 index.html도 같이 고치라고 알려 준다.
describe('세로 화면 안내 index.html (#624, 설계 9절)', () => {
  it('CSS @media가 JS와 같은 쿼리 하나를 쓴다(9-1절)', () => {
    expect(html).toContain(`@media ${ROTATE_QUERY} { #rotate { display: flex; } }`);
  });

  it('너비 667(가장 작은 가로 화면)은 걸리지 않고 666은 걸린다', () => {
    expect(ROTATE_QUERY).toContain('(orientation: portrait)');
    expect(ROTATE_QUERY).toContain('(max-width: 666px)');
  });

  it('아이콘은 격자 원본에서 만든 SVG 그대로다(격자를 바꾸면 index.html도 같이)', () => {
    expect(html).toContain(rotateIconSvg());
  });

  it('아이콘이 2KB 안이다(미리보기 32KB를 그대로 넣지 않는다, 9-3절)', () => {
    expect(rotateIconSvg().length).toBeLessThan(2048);
  });

  it('글 두 줄이 9-4절 그대로다(터치/마우스). 가장 긴 줄 15자 × 18px이 320px 폰 좌우 16px 여백 안', () => {
    expect(html).toContain('<span class="touch">スマホを横にして遊ぼう！</span>');
    expect(html).toContain('<span class="mouse">ウィンドウを横に広げて遊ぼう！</span>');
    expect(html).toContain('@media (hover: none) and (pointer: coarse) { #rotate .touch');
    expect([...'ウィンドウを横に広げて遊ぼう！'].length * 18).toBeLessThanOrEqual(320 - 2 * 16);
  });

  it('안내는 body 끝(시작 카드·로딩 뒤)이고 z-index로 맨 위다', () => {
    expect(html.indexOf('<div id="rotate">')).toBeGreaterThan(html.indexOf('<div id="card"'));
    expect(html.indexOf('<div id="rotate">')).toBeGreaterThan(html.indexOf('<p id="loading"'));
    expect(html).toMatch(/#rotate \{[^}]*z-index: 10;[^}]*background: #1b1720;[^}]*pointer-events: auto;/);
  });
});
