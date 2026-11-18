import { describe, expect, it } from 'vitest';
import screenJson from '../../content/screens/magpie_nest.json';
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
  goalMaxWidthPx,
  GOAL_AT,
  GOAL_RIGHT,
  GOAL_ZONE,
  CHAR_SLOTS,
  CHAR_TAG_TOP,
  HUD_AREA,
  hudTagFontPx,
  hudTagTight,
  hudHoverText,
  hudTags,
  inHudZone,
  LABEL_BOTTOM,
  cutFontPx,
  labelFontPx,
} from './hud';
import type { HitBox } from './hit';
import { TIMING } from './scene';

const TEXT: Record<string, string> = texts;
const t = (id: string): string => TEXT[id] ?? id;

describe('hudTags (늘 보이는 이름표, 설계 6-4-2절)', () => {
  it('얼굴 아래 특기 이름표 = 그 사람 능력 동사. 지금 캐릭터와 상관없이 셋 다 늘 보인다', () => {
    const tags = Object.fromEntries(hudTags(t).map((x) => [x.id, x.text]));
    expect(tags).toEqual({ 'char.jjuk': 'のばす', 'char.mukjik': 'ドスン', 'char.ppik': 'プピッ', gauge: 'ふわふわゲージ' });
    // 대상 라벨 동사(7절)와 같은 낱말: 얼굴 아래 `ドスン`을 본 사람이 `ドスン: シーソーの右はし`를 잇는다.
    for (const c of CHARACTERS) expect(tags[`char.${c.id}`]).toBe(TEXT[`ui.verb.${c.ability}`]);
  });

  it('특기 이름표는 칸 가운데 아래, 위끝 y 36(막대 33–34 아래 1px). 게이지 이름표는 띠 왼쪽 x 4·세로 가운데 y 263', () => {
    const tags = hudTags(t);
    expect(CHAR_TAG_TOP).toBe(36);
    for (const c of CHARACTERS) {
      const tag = tags.find((x) => x.id === `char.${c.id}`)!;
      const b = CHAR_SLOTS[c.id];
      expect([tag.x, tag.y, tag.anchor]).toEqual([b.left + b.width / 2, b.top + b.height + 4, 'top-center']);
    }
    const g = tags.find((x) => x.id === 'gauge')!;
    expect([g.x, g.y, g.anchor]).toEqual([4, 263, 'middle-left']);
    expect(GAUGE_TAG_AT.y).toBe(GAUGE_BAND.top + GAUGE_BAND.height / 2);
    expect(GAUGE_TAG_AT.x).toBeLessThan(GAUGE_TRACK.left);
  });

  it('이름표 폭(6-4-2절 표): 실제로 나오는 CSS 배율에서 이웃 이름표와 붙지 않고, 아래끝이 HUD 영역 안이다', () => {
    // index.html: 얼굴 이름표 padding 1px 2px, line-height 1. 1.2배 미만은 padding 0(#325). 전각 3자 폭 = 글자 × 3(palt 전 상한).
    const pad = (scale: number) => (hudTagTight(scale) ? { x: 0, y: 0 } : { x: 2, y: 1 });
    const box = (scale: number) => {
      const font = hudTagFontPx(scale);
      return { w: (font * 3 + 2 * pad(scale).x) / scale, h: (font + 2 * pad(scale).y) / scale };
    };
    const gap = CHAR_SLOTS.mukjik.left - CHAR_SLOTS.jjuk.left;
    // 1280×720 @1, 915×412 @2.625, 844×390 @3 (computeScale: 장치 정수 배율 ÷ dpr)
    expect(gap - box(2).w).toBeGreaterThanOrEqual(9);
    expect(gap - box(1.524).w).toBeGreaterThan(7);
    expect(gap - box(1.333).w).toBeGreaterThan(4);
    // 1.2배 이상에서 지금 padding으로 가장 빡빡한 경계
    expect(gap - box(1.2).w).toBeGreaterThan(1);
    // 667×375 @2 = 1.0: palt 없이도 padding 0이면 33 CSS → 1px 겹침. palt 실측(31.6/28.4/29)이면 틈 2 / 3.3(설계 표).
    expect(hudTagTight(1)).toBe(true);
    expect(gap - (31.6 + 28.4) / 2).toBeCloseTo(2);
    for (const s of [1, 1.09, 1.2, 1.333, 1.524, 2]) {
      expect(CHAR_TAG_TOP + box(s).h).toBeLessThanOrEqual(HUD_AREA.top + HUD_AREA.height);
    }
  });

  it('1.2배 경계: 바로 아래만 tight. 글자 크기는 배율과 상관없이 11px 아래로 내려가지 않는다', () => {
    expect([hudTagTight(1.19), hudTagTight(1.2), hudTagTight(1.333)]).toEqual([true, false, false]);
    expect([hudTagFontPx(1), hudTagFontPx(1.524), hudTagFontPx(2), hudTagFontPx(4)]).toEqual([11, 11, 14, 28]);
  });

  it('키가 없으면 키 이름이 보인다(빠진 번역을 숨기지 않는다)', () => {
    const tags = hudTags((id) => ({ 'ui.verb.stretch': 'のばす' })[id] ?? id);
    expect(tags.find((x) => x.id === 'gauge')!.text).toBe('ui.hud.gauge');
    expect(tags.find((x) => x.id === 'char.mukjik')!.text).toBe('ui.verb.stomp');
  });
});

describe('hudHoverText (데스크톱 호버 설명, 6-4-3절)', () => {
  it('얼굴 칸은 `{name}: {desc}` — 누구로 바꾸는지와 그 사람 특기를 말한다(#311)', () => {
    expect(hudHoverText('char.jjuk', t)).toBe('ノビー: サオを伸ばして高い所に届く');
    expect(hudHoverText('char.mukjik', t)).toBe('ズッシー: 全体重でドスンと踏む');
    expect(hudHoverText('char.ppik', t)).toBe('プピ: ニワトリを鳴らして気を引く');
  });

  it('터치 첫 전환 안내(abilityText)는 호버와 같은 글이고, 자리표시가 남지 않고 20자 이하다', () => {
    for (const c of CHARACTERS) {
      const text = abilityText(c.id, t);
      expect(text).toBe(hudHoverText(`char.${c.id}`, t));
      expect(text).not.toMatch(/[{}]/);
      expect([...text].length).toBeLessThanOrEqual(20);
    }
  });

  it('게이지는 고정 설명', () => {
    expect(hudHoverText('gauge', t)).toBe('ふわふわゲージ: ミスで1マス減る。0でみんなスタートへ');
  });

  it('없앤 버튼 설명 키(능력·손·보기)는 텍스트에 없다', () => {
    for (const k of ['ui.hud.ability_hover', 'ui.hud.hand_hover', 'ui.hud.look_hover']) expect(TEXT[k]).toBeUndefined();
  });
});

describe('HUD 영역 (6-4-2절)', () => {
  it('얼굴 3칸 + 이름표 띠 = (300,4)–(392,48). 오른쪽 하늘(x 392–)은 월드다', () => {
    expect(HUD_AREA).toEqual({ left: 300, top: 4, width: 92, height: 44 });
    const last = CHAR_SLOTS.ppik;
    expect(last.left + last.width).toBeLessThanOrEqual(HUD_AREA.left + HUD_AREA.width);
    expect(inHudZone({ x: 390, y: 46 })).toBe(true);
    expect(inHudZone({ x: 400, y: 20 })).toBe(false);
    expect(inHudZone({ x: 340, y: 60 })).toBe(false);
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

const boxesOverlap = (a: HitBox, b: HitBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

describe('목표 줄(#hud, 6-2-2절, #336)', () => {
  // index.html `#hud`: padding 0.1em 0.35em, line-height 1.25. 한 줄이 넘치면 main.ts가 U+200B에서만 접는다. 전각 1자 = 글자 크기.
  const goal = TEXT['ui.intro']!;
  const parts = goal.split('\u200b');
  const width = (chars: number, font: number) => chars * font + 2 * 0.35 * font;
  const SCALES = [1, 1.333, 1.524, 2, 4]; // 667×375 @2, 844×390 @3, 915×412 @2.625, 1280×720, 1920×1080

  it('줄바꿈 자리는 하나(U+200B)이고 글은 20자 이하다', () => {
    expect(parts).toEqual(['目標：巣から', '店のカギを取り返す']);
    expect([...parts.join('')].length).toBeLessThanOrEqual(20);
  });

  it('배율마다 최대 폭 안에 들어가고(넘치면 두 줄), 높이는 GOAL_ZONE 안이다', () => {
    for (const s of SCALES) {
      const font = hudTagFontPx(s);
      const max = goalMaxWidthPx(s);
      const oneLine = width([...parts.join('')].length, font) <= max;
      const lines = oneLine ? 1 : parts.length;
      for (const p of oneLine ? [parts.join('')] : parts) expect(width([...p].length, font), `${s}배 "${p}"`).toBeLessThanOrEqual(max);
      expect((lines * 1.25 * font + 0.2 * font) / s, `${s}배 높이`).toBeLessThanOrEqual(GOAL_ZONE.height);
    }
    // 1.0·1.333배는 두 줄, 2·4배는 한 줄(1280에서 210 + 10 ≤ 228 CSS px)
    expect(width(15, hudTagFontPx(1)) > goalMaxWidthPx(1)).toBe(true);
    expect(width(15, hudTagFontPx(1.333)) > goalMaxWidthPx(1.333)).toBe(true);
    expect(width(15, hudTagFontPx(2)) <= goalMaxWidthPx(2)).toBe(true);
    expect(width(15, hudTagFontPx(4)) <= goalMaxWidthPx(4)).toBe(true);
  });

  it('GOAL_ZONE은 화면 1 핫스팟·서는 자리·HUD 영역과 겹치지 않는다', () => {
    expect([GOAL_AT.x, GOAL_AT.y, GOAL_RIGHT]).toEqual([4, 4, 118]);
    const screen = screenJson as unknown as { hotspots: Record<string, { box?: number[] }>; spots: Record<string, { box?: number[] }> };
    const boxes = [...Object.entries(screen.hotspots), ...Object.entries(screen.spots)].filter(([, v]) => v.box);
    expect(boxes.length).toBeGreaterThan(5);
    for (const [id, v] of boxes) {
      const [left, top, w, h] = v.box!;
      expect(boxesOverlap(GOAL_ZONE, { left: left!, top: top!, width: w!, height: h! }), id).toBe(false);
    }
    expect(boxesOverlap(GOAL_ZONE, HUD_AREA)).toBe(false);
  });
});

describe('대상 라벨 글자 크기(#label, #337)', () => {
  it('내부 7px × 배율, 최소 14: 1.0·1.333·2배는 14 그대로, 4배는 이름표와 같은 28', () => {
    expect([1, 1.333, 2, 4].map(labelFontPx)).toEqual([14, 14, 14, 28]);
    expect(labelFontPx(4)).toBe(hudTagFontPx(4));
  });

  it('가장 긴 라벨(게이지 설명)이 1.0배에서 게임 폭 안 한 줄이다(padding 0.6em)', () => {
    const longest = hudHoverText('gauge', t);
    for (const s of [1, 1.333, 2, 4]) {
      const font = labelFontPx(s);
      expect(([...longest].length * font + 1.2 * font) / s, `${s}배`).toBeLessThanOrEqual(INTERNAL_WIDTH);
    }
  });
});

describe('cutFontPx (#352, 6-6절)', () => {
  it('is internal 14px × scale, at least 20: 2x stays 28px, 4x 56px', () => {
    expect([1, 1.333, 1.524, 2, 4].map(cutFontPx)).toEqual([20, 20, 21, 28, 56]);
  });

  it('is always bigger than the speech bubble at the same scale', () => {
    for (const s of [0.8, 1, 1.333, 1.524, 2, 2.667, 4]) expect(cutFontPx(s)).toBeGreaterThan(Math.max(16, Math.round(9 * s)));
  });
});
