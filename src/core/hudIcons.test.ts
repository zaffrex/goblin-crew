import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { hudIconId, parseHudIconMeta } from './hudIcons';
import { VERB_BUTTONS } from './hud';

// core는 `**/ui/**` import가 막혀 있어서(ADR-0004 lint, src/ui용 규칙에 public/ui도 걸린다) glob으로 읽는다.
const sheet: unknown = Object.values(import.meta.glob('../../public/ui/hud-icons.json', { eager: true, import: 'default' }))[0];

describe('parseHudIconMeta (#255)', () => {
  it('커밋된 시트 메타를 읽는다', () => {
    const meta = parseHudIconMeta(sheet);
    expect(meta.image).toBe('hud-icons.png');
  });

  it('모든 캐릭터·모든 동사 버튼의 아이콘이 시트에 있다', () => {
    const meta = parseHudIconMeta(sheet);
    for (const c of CHARACTERS)
      for (const v of VERB_BUTTONS) {
        const icon = hudIconId(`verb.${v}`, c.id);
        expect(icon, `${c.id} verb.${v}`).not.toBeNull();
        expect(meta.icons[icon!], `${c.id} ${icon}`).toBeTypeOf('number');
      }
  });

  it('틀린 메타는 오류(엔진은 임시 글자로 둔다)', () => {
    const ok = { image: 'a.png', cell: [20, 20], icons: { hand: 0, look: 1 } };
    expect(() => parseHudIconMeta(ok)).not.toThrow();
    expect(() => parseHudIconMeta(null)).toThrow();
    expect(() => parseHudIconMeta({ ...ok, image: '' })).toThrow(/image/);
    expect(() => parseHudIconMeta({ ...ok, cell: [16, 16] })).toThrow(/cell/);
    expect(() => parseHudIconMeta({ ...ok, icons: { hand: -1 } })).toThrow(/칸 번호/);
    expect(() => parseHudIconMeta({ ...ok, icons: { hand: 1.5 } })).toThrow(/칸 번호/);
    expect(() => parseHudIconMeta({ ...ok, icons: { hand: 0, look: 0 } })).toThrow(/같이/);
  });
});

describe('hudIconId', () => {
  it('능력 버튼은 지금 캐릭터 능력 동사 id다', () => {
    expect(hudIconId('verb.ability', 'jjuk')).toBe('stretch');
    expect(hudIconId('verb.ability', 'mukjik')).toBe('stomp');
    expect(hudIconId('verb.ability', 'ppik')).toBe('squeak');
  });

  it('손·보기는 캐릭터와 상관없고, 얼굴 칸·아이템 칸은 아이콘이 없다', () => {
    expect(hudIconId('verb.hand', 'ppik')).toBe('hand');
    expect(hudIconId('verb.look', 'mukjik')).toBe('look');
    expect(hudIconId('char.jjuk', 'jjuk')).toBeNull();
    expect(hudIconId('item.0', 'jjuk')).toBeNull();
  });
});
