import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { CHARACTERS } from './characters';
import { INTERNAL_WIDTH } from './config';
import { abilityText, GAUGE_BOX, GAUGE_PLATE, GAUGE_SHAKE_TICKS, GAUGE_TAG_TOP, gaugeShakeX, HUD_AREA, hudHoverText, hudTags, VERB_SLOTS, VERB_TAG_TOP } from './hud';

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

  it('버튼 이름표는 버튼 가운데 아래 1px, 게이지 이름표는 게이지 가운데(x 440) 받침판 아래 2px', () => {
    const tags = hudTags('jjuk', t);
    for (const tag of tags.filter((x) => x.id !== 'gauge')) {
      const b = VERB_SLOTS[tag.id.slice('verb.'.length) as keyof typeof VERB_SLOTS];
      expect(tag.x).toBe(b.left + b.width / 2);
      expect(tag.top).toBe(b.top + b.height + 1);
    }
    const g = tags.find((x) => x.id === 'gauge')!;
    expect([g.x, g.top]).toEqual([440, GAUGE_TAG_TOP]);
    // 6-2-4절: 받침판 아래 끝 27(26행까지) + 2 → 28.
    expect(GAUGE_TAG_TOP).toBe(28);
    expect(GAUGE_TAG_TOP).toBe(GAUGE_PLATE.top + GAUGE_PLATE.height - 1 + 2);
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

  it('능력 버튼은 `{verb}: {desc}` — 무엇을 하는지 말한다(6-2-3절, #285)', () => {
    expect(hudHoverText('verb.ability', 'jjuk', t)).toBe('のばす: サオをのばして高い所に届く');
    expect(hudHoverText('verb.ability', 'mukjik', t)).toBe('ドスン: 全体重でドスンとふむ');
    expect(hudHoverText('verb.ability', 'ppik', t)).toBe('プピッ: ニワトリを鳴らして気を引く');
  });

  it('첫 무장 안내(abilityText)는 호버와 같은 글이고, 자리표시가 글자 그대로 남지 않는다', () => {
    for (const c of CHARACTERS) {
      const text = abilityText(c.id, t);
      expect(text).toBe(hudHoverText('verb.ability', c.id, t));
      expect(text).not.toMatch(/[{}]/);
      expect([...text].length).toBeLessThanOrEqual(20);
    }
  });

  it('손·보기·게이지는 고정 설명, 아이템 칸은 없음', () => {
    expect(hudHoverText('verb.hand', 'jjuk', t)).toBe('さわる: 動かす・拾う');
    expect(hudHoverText('verb.look', 'jjuk', t)).toBe('みる: よく調べる');
    expect(hudHoverText('gauge', 'jjuk', t)).toBe('ふわふわゲージ: ミスで1マス減る。0でみんなスタートへ');
    expect(hudHoverText('item.0', 'jjuk', t)).toBeNull();
  });
});

describe('게이지 받침판·흔들림 (6-2-4·6-2-5절, #285)', () => {
  it('받침판은 (401,9) 78×18, 세로는 HUD 영역 안이고 오른쪽 끝(479)은 화면 안이다', () => {
    expect(GAUGE_PLATE).toEqual({ left: 401, top: 9, width: 78, height: 18 });
    expect(GAUGE_PLATE.top).toBeGreaterThanOrEqual(HUD_AREA.top);
    expect(GAUGE_PLATE.top + GAUGE_PLATE.height).toBeLessThanOrEqual(HUD_AREA.top + HUD_AREA.height);
    // 판 오른쪽 3px(476–479)은 HUD_AREA(끝 476) 밖이다. 하늘 가장자리라 핫스팟이 없고, 입력 영역은 바꾸지 않는다(PR 본문 메모).
    expect(GAUGE_PLATE.left + GAUGE_PLATE.width).toBeLessThanOrEqual(INTERNAL_WIDTH);
  });

  it('흔들림은 0.3초 동안 ±1px, 그 뒤 0', () => {
    expect(GAUGE_SHAKE_TICKS).toBe(18);
    const xs = Array.from({ length: 24 }, (_, i) => gaugeShakeX(i));
    expect(new Set(xs.slice(0, 18))).toEqual(new Set([1, -1]));
    expect(xs.slice(18).every((x) => x === 0)).toBe(true);
    expect(gaugeShakeX(-1)).toBe(0);
  });
});

describe('GAUGE_BOX', () => {
  it('게이지 칸 5개를 감싸고 HUD 영역 안에 있다', () => {
    expect(GAUGE_BOX).toEqual({ left: 404, top: 12, width: 72, height: 12 });
    expect(GAUGE_BOX.left + GAUGE_BOX.width).toBeLessThanOrEqual(HUD_AREA.left + HUD_AREA.width);
  });
});
