import { describe, expect, it } from 'vitest';
import { characterDef } from '../core/characters';
import { parseSpriteMeta } from '../core/sprite';

// core 숫자(characters.ts hit)가 시트 메타와 같은지 본다. glob(vite/client 타입)은 core 타입체크
// (tsconfig.core.json, types: [])에 못 들어가서 시트를 읽는 engine 쪽에 둔다(#170 리뷰).
// 시트가 새로 생기거나 바뀌면 여기서 characters.ts에 넣을 숫자를 알려 준다.
const SHEET_METAS = Object.values(
  import.meta.glob<unknown>('../../public/sprites/*-base.json', { eager: true, import: 'default' }),
).map(parseSpriteMeta);

describe('캐릭터 히트 영역 = 시트 메타 (#46)', () => {
  it('시트가 하나 이상 있다(glob 경로 확인)', () => {
    expect(SHEET_METAS.length).toBeGreaterThan(0);
  });

  it.each(SHEET_METAS.map((m) => [m.character, m] as const))('%s: 히트 영역이 시트 메타 hit·anchor와 같다', (_, m) => {
    const [hx, hy, hw, hh] = m.hit;
    const [ax, ay] = m.anchor;
    const want = { dx: hx - ax, dy: hy - ay, width: hw, height: hh };
    const def = characterDef(m.character);
    expect(def.hit, `characters.ts의 ${m.character} hit를 ${JSON.stringify(want)}로 맞춰 주세요`).toEqual(want);
  });

  it.each(SHEET_METAS.map((m) => [m.character, m] as const))('%s: 얼굴 상자가 시트 메타 head·anchor와 같다(#427)', (_, m) => {
    expect(m.head, `${m.character} 시트에 head가 없어요(얼굴 전환 상자 2-1절)`).toBeDefined();
    const [hx, hy, hw, hh] = m.head!;
    const [ax, ay] = m.anchor;
    const want = { dx: hx - ax, dy: hy - ay, width: hw, height: hh };
    const def = characterDef(m.character);
    expect(def.face, `characters.ts의 ${m.character} face를 ${JSON.stringify(want)}로 맞춰 주세요`).toEqual(want);
  });
});
