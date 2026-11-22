import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateCharacters, validateScreen, validateTexts, type ValidationIssue } from '../../src/core/puzzle/validate';
import { parseOrder } from '../../src/core/flow';

// ADR-0065 1절·ADR-0004 결정 7: 콘텐츠 검증을 npm test에서 돌린다. 실패는 테스트 실패, 경고는 출력만.
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const load = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const show = (xs: ValidationIssue[]): string[] => xs.map((x) => `${x.path} [${x.code}] ${x.message}`);

const texts = load(dir('../../content/text/ja.json')) as Record<string, string>;
const ctx = { texts };
const screens = readdirSync(dir('../../content/screens')).filter((f) => f.endsWith('.json') && f !== 'order.json');

describe('content validation', () => {
  it('text/ja.json', () => {
    expect(show(validateTexts(texts).errors)).toEqual([]);
  });

  it('characters.json', () => {
    const r = validateCharacters(load(dir('../../content/characters.json')), ctx);
    expect(show(r.errors)).toEqual([]);
  });

  it('has at least one screen', () => {
    expect(screens.length).toBeGreaterThan(0);
  });

  // #766: 쿼리 없는 배포본은 이 순서로 이어 간다. 틀리면 main.ts가 화면 하나로 떨어지므로 여기서 막는다(ADR-0065 8절).
  it('screens/order.json', () => {
    const ids = new Set(screens.map((f) => f.replace(/\.json$/, '')));
    expect(parseOrder(load(dir('../../content/screens/order.json')), ids)).toMatchObject({ ok: true });
  });

  it.each(screens)('screens/%s', (file) => {
    const raw = load(dir(`../../content/screens/${file}`));
    const r = validateScreen(raw, ctx);
    for (const w of show(r.warnings)) console.warn(`[content warning] ${file}: ${w}`);
    expect(show(r.errors)).toEqual([]);
    // 파일 이름 = 화면 ID (ADR-0065 1절)
    expect((raw as { id?: unknown }).id).toBe(file.replace(/\.json$/, ''));
  });
});
