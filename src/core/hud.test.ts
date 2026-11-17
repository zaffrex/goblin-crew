import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { CHARACTERS } from './characters';
import { GAUGE_BOX, GAUGE_CELLS, GAUGE_TAG_TOP, HUD_AREA, hudHoverText, hudTags, VERB_SLOTS, VERB_TAG_TOP } from './hud';

const TEXT: Record<string, string> = texts;
const t = (id: string): string => TEXT[id] ?? id;

describe('hudTags (늘 보이는 이름표, 설계 6-1절)', () => {
  it('능력 버튼 이름표는 지금 캐릭터 능력 동사다', () => {
    const ability = (id: (typeof CHARACTERS)[number]['id']) => hudTags(id, t).find((x) => x.id === 'verb.ability')!.text;
    expect(ability('jjuk')).toBe('のばす');
    expect(ability('mukjik')).toBe('ドスン');
    expect(ability('ppik')).toBe('プピッ');
  });

  it('손·보기·게이지 이름표는 키 글자 그대로이고, 대상 라벨 동사와 같은 낱말이다', () => {
    const tags = Object.fromEntries(hudTags('jjuk', t).map((x) => [x.id, x.text]));
    expect(tags['verb.hand']).toBe(TEXT['ui.verb.hand']);
    expect(tags['verb.look']).toBe(TEXT['ui.verb.look']);
    expect(tags.gauge).toBe('ふわふわゲージ');
  });

  it('버튼 이름표는 버튼 가운데 아래 1px, 게이지 이름표는 게이지 가운데(x 440) 아래 1px', () => {
    const tags = hudTags('jjuk', t);
    for (const tag of tags.filter((x) => x.id !== 'gauge')) {
      const b = VERB_SLOTS[tag.id.slice('verb.'.length) as keyof typeof VERB_SLOTS];
      expect(tag.x).toBe(b.left + b.width / 2);
      expect(tag.top).toBe(b.top + b.height + 1);
    }
    const g = tags.find((x) => x.id === 'gauge')!;
    expect([g.x, g.top]).toEqual([440, GAUGE_TAG_TOP]);
    expect(GAUGE_TAG_TOP).toBe(GAUGE_CELLS[0]!.top + GAUGE_CELLS[0]!.height + 1);
    expect(VERB_TAG_TOP).toBe(65);
  });

  it('키가 없으면 키 이름이 보인다(빠진 번역을 숨기지 않는다)', () => {
    const tags = hudTags('jjuk', (id) => ({ 'ui.verb.hand': 'さわる' })[id] ?? id);
    expect(tags.find((x) => x.id === 'gauge')!.text).toBe('ui.hud.gauge');
  });
});

describe('hudHoverText (데스크톱 호버 설명, 6-1-3절)', () => {
  it('캐릭터 칸은 그 사람 이름으로 채운다', () => {
    expect(hudHoverText('char.mukjik', 'jjuk', t)).toBe('ズッシーに交代');
  });

  it('능력 버튼은 지금 캐릭터 이름과 능력 동사로 채운다', () => {
    expect(hudHoverText('verb.ability', 'jjuk', t)).toBe('ノビーの特技: のばす');
    expect(hudHoverText('verb.ability', 'ppik', t)).toBe('プピの特技: プピッ');
  });

  it('손·보기·게이지는 고정 설명, 아이템 칸은 없음', () => {
    expect(hudHoverText('verb.hand', 'jjuk', t)).toBe('さわる: 動かす・拾う');
    expect(hudHoverText('verb.look', 'jjuk', t)).toBe('みる: よく調べる');
    expect(hudHoverText('gauge', 'jjuk', t)).toBe('ふわふわゲージ: ミスで1マス減る。0でみんなスタートへ');
    expect(hudHoverText('item.0', 'jjuk', t)).toBeNull();
  });
});

describe('GAUGE_BOX', () => {
  it('게이지 칸 5개를 감싸고 HUD 영역 안에 있다', () => {
    expect(GAUGE_BOX).toEqual({ left: 404, top: 12, width: 72, height: 12 });
    expect(GAUGE_BOX.left + GAUGE_BOX.width).toBeLessThanOrEqual(HUD_AREA.left + HUD_AREA.width);
  });
});
