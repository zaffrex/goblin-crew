import { describe, expect, it } from 'vitest';
import { CHARACTERS, MIN_HIT_SIZE, characterDef, characterHitBox } from './characters';
import { parseSpriteMeta } from './sprite';

// 시트가 있는 캐릭터만. 시트가 새로 생기거나 바뀌면 여기서 characters.ts에 넣을 숫자를 알려 준다.
const SHEET_METAS = Object.values(
  import.meta.glob<unknown>('../../public/sprites/*-base.json', { eager: true, import: 'default' }),
).map(parseSpriteMeta);

describe('캐릭터 3인 히트 영역 (ADR-0007 결정 4·6)', () => {
  it('ADR-0003 안정 ID 3개', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['jjuk', 'mukjik', 'ppik']);
  });

  it.each(CHARACTERS)('$id: 최소 24×24이고 발 바닥(y)에서 끝난다', (def) => {
    const b = characterHitBox(def, 100, 200, 1);
    expect(b.width).toBeGreaterThanOrEqual(MIN_HIT_SIZE);
    expect(b.height).toBeGreaterThanOrEqual(MIN_HIT_SIZE);
    expect(b.top + b.height).toBe(200);
    expect(b.left).toBeLessThan(100);
    expect(b.left + b.width).toBeGreaterThan(100);
  });

  it.each(CHARACTERS)('$id: 왼쪽을 보면 기준점 축으로 뒤집힌다', (def) => {
    const r = characterHitBox(def, 100, 200, 1);
    const l = characterHitBox(def, 100, 200, -1);
    expect(l.width).toBe(r.width);
    expect(l.top).toBe(r.top);
    // 기준점에서 왼쪽 끝까지 거리 ↔ 오른쪽 끝까지 거리가 서로 바뀐다
    expect(100 - l.left).toBe(r.left + r.width - 100);
    expect(l.left + l.width - 100).toBe(100 - r.left);
  });

  it('소수 좌표는 그릴 때처럼 반올림한다', () => {
    const def = characterDef('jjuk');
    expect(characterHitBox(def, 100.4, 199.6, 1)).toEqual(characterHitBox(def, 100, 200, 1));
  });

  it('시트가 하나 이상 있다(glob 경로 확인)', () => {
    expect(SHEET_METAS.length).toBeGreaterThan(0);
  });

  it.each(SHEET_METAS.map((m) => [m.character, m] as const))('%s: 히트 영역이 시트 메타 hit·anchor와 같다 (#46)', (_, m) => {
    const [hx, hy, hw, hh] = m.hit;
    const [ax, ay] = m.anchor;
    const want = { dx: hx - ax, dy: hy - ay, width: hw, height: hh };
    const def = characterDef(m.character);
    expect(def.hit, `characters.ts의 ${m.character} hit를 ${JSON.stringify(want)}로 맞춰 주세요`).toEqual(want);
  });
});
