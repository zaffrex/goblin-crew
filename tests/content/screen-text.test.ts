import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCREEN, SCREEN_TEXT, screenTextKey } from '../../src/core/screenPick';

// #380: 화면마다 바뀌는 공용 글(목표 줄·시작 카드). 화면 1이 아닌 화면에 자기 글이 없으면 화면 1 목표(店のカギ)가 그대로 뜬다.
// 화면 목록은 main.ts가 번들에 넣는 content/screens/*.json과 같다(order.json이 생기면 화면이 아니라 뺀다).
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const texts = JSON.parse(readFileSync(dir('../../content/text/ja.json'), 'utf8')) as Record<string, string>;
const screens = readdirSync(dir('../../content/screens'))
  .filter((f) => f.endsWith('.json') && f !== 'order.json')
  .map((f) => f.replace(/\.json$/, ''));

describe('화면별 목표 줄·카드 글 (#380)', () => {
  it('화면 1이 아닌 화면은 SCREEN_TEXT 키를 전부 자기 글로 가진다', () => {
    expect(screens).toContain(DEFAULT_SCREEN);
    expect(screens).toContain('park_fountain');
    const missing = screens
      .filter((s) => s !== DEFAULT_SCREEN)
      .flatMap((s) => Object.keys(SCREEN_TEXT).filter((id) => screenTextKey(texts, s, id) === id).map((id) => `${s} ${id}`));
    expect(missing).toEqual([]);
  });
});
