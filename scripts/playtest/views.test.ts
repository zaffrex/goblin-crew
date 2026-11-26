import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHECKLIST_VIEWS } from './views';

describe('checklist views', () => {
  it('체크리스트 1절 표와 크기·dpr이 같다', () => {
    const doc = readFileSync('docs/design/ui-detail-checklist.md', 'utf8');
    const rows = [...doc.matchAll(/^\| (D1|D4|M3|M1) \| (\d+)×(\d+) \| (\d+) \|/gm)].map((m) => ({
      name: m[1],
      width: Number(m[2]),
      height: Number(m[3]),
      dpr: Number(m[4]),
    }));
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      const v = CHECKLIST_VIEWS[r.name as keyof typeof CHECKLIST_VIEWS];
      expect({ name: v.name, width: v.width, height: v.height, dpr: v.dpr }).toEqual(r);
    }
  });

  it('cover.ts·menus.ts가 이 표 밖의 크기를 따로 적지 않는다', () => {
    for (const f of ['scripts/playtest/cover.ts', 'scripts/playtest/menus.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toContain('CHECKLIST_VIEWS');
      expect(src, f).not.toMatch(/width:\s*\d+,\s*height:\s*\d+/);
    }
  });
});
