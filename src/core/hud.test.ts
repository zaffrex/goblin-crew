import { describe, expect, it } from 'vitest';
import texts from '../../content/text/ja.json';
import { CHARACTERS } from './characters';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, WALK_AREA } from './config';
import {
  abilityText,
  GAUGE_BAND,
  GAUGE_CHIP_HOLD_TICKS,
  GAUGE_CHIP_SHRINK_TICKS,
  GAUGE_SEGS,
  GAUGE_SHAKE_TICKS,
  GAUGE_TAG_AT,
  GAUGE_TRACK,
  gaugeChipWidth,
  gaugeShakeX,
  HUD_AREA,
  hudHoverText,
  hudTags,
  inHudZone,
  LABEL_BOTTOM,
  VERB_SLOTS,
  VERB_TAG_TOP,
} from './hud';
import { TIMING } from './scene';

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

  it('버튼 이름표는 버튼 가운데 아래 1px(top-center), 게이지 이름표는 띠 왼쪽 x 4·세로 가운데 y 263(middle-left, 6-3-2절)', () => {
    const tags = hudTags('jjuk', t);
    for (const tag of tags.filter((x) => x.id !== 'gauge')) {
      const b = VERB_SLOTS[tag.id.slice('verb.'.length) as keyof typeof VERB_SLOTS];
      expect(tag.x).toBe(b.left + b.width / 2);
      expect(tag.y).toBe(b.top + b.height + 1);
      expect(tag.anchor).toBe('top-center');
    }
    const g = tags.find((x) => x.id === 'gauge')!;
    expect([g.x, g.y, g.anchor]).toEqual([4, 263, 'middle-left']);
    expect(GAUGE_TAG_AT.y).toBe(GAUGE_BAND.top + GAUGE_BAND.height / 2);
    expect(GAUGE_TAG_AT.x).toBeLessThan(GAUGE_TRACK.left);
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

describe('게이지 띠·막대 (6-3-2절, #312)', () => {
  it('띠는 화면 맨 아래 14px 전체 폭(y 256–269)', () => {
    expect(GAUGE_BAND).toEqual({ left: 0, top: 256, width: INTERNAL_WIDTH, height: 14 });
    expect(GAUGE_BAND.top + GAUGE_BAND.height).toBe(INTERNAL_HEIGHT);
  });

  it('막대 테두리 x 84–474·y 258–268, 칸 5개 77×9가 85/163/241/319/397에서 시작하고 끝 x 473', () => {
    expect(GAUGE_TRACK).toEqual({ left: 84, top: 258, width: 391, height: 11 });
    expect(GAUGE_SEGS.map((b) => b.left)).toEqual([85, 163, 241, 319, 397]);
    for (const b of GAUGE_SEGS) expect([b.top, b.width, b.height]).toEqual([259, 77, 9]);
    const last = GAUGE_SEGS[GAUGE_SEGS.length - 1]!;
    expect(last.left + last.width - 1).toBe(473);
    // 칸 둘레 ink 1px: 테두리 안쪽에 딱 맞는다(칸 5 × 77 + 눈금 4 = 389 = 391 − 2).
    expect(GAUGE_SEGS[0]!.left).toBe(GAUGE_TRACK.left + 1);
    expect(last.left + last.width).toBe(GAUGE_TRACK.left + GAUGE_TRACK.width - 1);
    expect(GAUGE_SEGS[0]!.top + GAUGE_SEGS[0]!.height).toBe(GAUGE_TRACK.top + GAUGE_TRACK.height - 1);
  });

  it('흔들려도(±1px) 막대는 띠 안이다', () => {
    expect(GAUGE_TRACK.left - 1).toBeGreaterThanOrEqual(GAUGE_BAND.left);
    expect(GAUGE_TRACK.left + GAUGE_TRACK.width + 1).toBeLessThanOrEqual(GAUGE_BAND.left + GAUGE_BAND.width);
    expect(GAUGE_TRACK.top).toBeGreaterThan(GAUGE_BAND.top);
  });

  it('걷기 영역 아래끝(252)과 대상 라벨 아래끝(254)은 띠(256) 위다(6-3-5절)', () => {
    expect(WALK_AREA.bottom).toBe(252);
    expect(LABEL_BOTTOM).toBe(254);
    expect(WALK_AREA.bottom).toBeLessThan(GAUGE_BAND.top);
  });

  it('inHudZone: 오른쪽 위 HUD 영역과 맨 아래 띠만', () => {
    expect(inHudZone({ x: HUD_AREA.left + 2, y: HUD_AREA.top + 2 })).toBe(true);
    expect(inHudZone({ x: 0, y: 256 })).toBe(true);
    expect(inHudZone({ x: 479, y: 269 })).toBe(true);
    expect(inHudZone({ x: 240, y: 255 })).toBe(false);
    expect(inHudZone({ x: 240, y: WALK_AREA.bottom })).toBe(false);
  });
});

describe('게이지 흔들림·크림 조각 (6-3-4절)', () => {
  it('흔들림은 0.3초 동안 ±1px, 그 뒤 0', () => {
    expect(GAUGE_SHAKE_TICKS).toBe(18);
    const xs = Array.from({ length: 24 }, (_, i) => gaugeShakeX(i));
    expect(new Set(xs.slice(0, 18))).toEqual(new Set([1, -1]));
    expect(xs.slice(18).every((x) => x === 0)).toBe(true);
    expect(gaugeShakeX(-1)).toBe(0);
  });

  it('조각은 8틱 그대로, 그 뒤 12틱 동안 줄어 `gauge` 이벤트 마지막 틱(19)에 0', () => {
    expect(GAUGE_CHIP_HOLD_TICKS + GAUGE_CHIP_SHRINK_TICKS).toBe(TIMING.gauge);
    const w = Array.from({ length: 21 }, (_, t) => gaugeChipWidth(77, t));
    expect(w.slice(0, 8).every((x) => x === 77)).toBe(true);
    expect(w[8]).toBe(Math.round((77 * 11) / 12));
    expect(w[19]).toBe(0);
    expect(w[20]).toBe(0);
    // 줄기만 한다(다시 늘지 않는다).
    for (let t = 1; t < w.length; t++) expect(w[t]!).toBeLessThanOrEqual(w[t - 1]!);
  });
});
