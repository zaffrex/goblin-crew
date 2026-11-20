import { describe, expect, it } from 'vitest';
import { INTERNAL_WIDTH } from './config';
import screenJson from '../../content/screens/magpie_nest.json';
import { FX_STYLE, FX_TEXT_SPOT, FX_TICKS, SIGNATURE_TICKS } from './fx';
// eslint-disable-next-line no-restricted-imports -- public/ui는 에셋 JSON이다(src/ui 아님). ADR-0004 규칙이 경로 패턴으로 같이 걸린다.
import raw from '../../public/ui/fx-text.json';
import { BOUNCE_FX, BOUNCE_GONE, bounceDy, fxTextAt, parseFxTextMeta, TEXT_LIFT, TING_SPARK, tingSparkAt, type FxCell } from './fxText';

const meta = parseFxTextMeta(raw);
const W = INTERNAL_WIDTH;

describe('parseFxTextMeta', () => {
  it('커밋된 시트 메타를 읽고, FX_STYLE의 fx마다 칸과 ting_spark 칸이 있다', () => {
    for (const fx of Object.keys(FX_STYLE)) expect(meta.cells[fx], fx).toBeDefined();
    expect(meta.cells[TING_SPARK]).toBeDefined();
  });

  it('틀린 메타는 이유와 함께 던진다(엔진은 경고 후 임시 별)', () => {
    expect(() => parseFxTextMeta(null)).toThrow('객체가 아님');
    expect(() => parseFxTextMeta({ anchor: 'bottom-center', cells: {} })).toThrow('image 없음');
    expect(() => parseFxTextMeta({ image: 'a.png', anchor: 'top-left', cells: {} })).toThrow('anchor');
    expect(() => parseFxTextMeta({ image: 'a.png', anchor: 'bottom-center' })).toThrow('cells 없음');
    expect(() => parseFxTextMeta({ image: 'a.png', anchor: 'bottom-center', cells: { x: [0, 0, 5] } })).toThrow('x: 칸은 정수 4개');
    expect(() => parseFxTextMeta({ image: 'a.png', anchor: 'bottom-center', cells: { x: [0, 0, 0, 5] } })).toThrow('크기가 0');
  });
});

describe('fxTextAt (ability-feedback.md 2절 위치)', () => {
  const cell: FxCell = [0, 0, 31, 10];

  it('칸 아래 가운데가 기준점 4px 위에 오고, 6틱마다 1px 뜬다(drawSpark와 같은 움직임)', () => {
    const at = { x: 200, y: 120 };
    expect(fxTextAt('squeak_text', cell, at, 0, W)).toEqual({ x: 200 - 15, y: 120 - TEXT_LIFT - 10 });
    expect(fxTextAt('squeak_text', cell, at, 5, W)!.y).toBe(106);
    expect(fxTextAt('squeak_text', cell, at, 6, W)!.y).toBe(105);
    expect(fxTextAt('squeak_text', cell, at, SIGNATURE_TICKS - 1, W)!.y).toBe(106 - 5);
  });

  it('소수 기준점은 반올림해서 픽셀에 맞춘다', () => {
    expect(fxTextAt('kkak_text', cell, { x: 99.5, y: 50.4 }, 0, W)).toEqual({ x: 100 - 15, y: 50 - 4 - 10 });
  });

  it('화면 끝: 왼쪽·오른쪽·위로 나가지 않는다(둥지·고리처럼 화면 위쪽, 가장자리 대상)', () => {
    expect(fxTextAt('squeak_text', cell, { x: 3, y: 100 }, 0, W)!.x).toBe(0);
    expect(fxTextAt('squeak_text', cell, { x: W - 2, y: 100 }, 0, W)!.x).toBe(W - 31);
    expect(fxTextAt('squeak_text', cell, { x: 100, y: 8 }, 30, W)!.y).toBe(0);
  });

  it('시트의 모든 소리 글자가 화면 1 너비 안 어디서나 화면 안에 그려진다', () => {
    for (const fx of Object.keys(FX_STYLE)) {
      const c = meta.cells[fx]!;
      for (const x of [0, 1, W / 2, W - 1, W]) {
        for (const t of [0, 12, FX_TICKS - 1]) {
          const p = fxTextAt(fx, c, { x, y: 4 }, t, W);
          if (!p) continue;
          expect(p.x >= 0 && p.x + c[2] <= W && p.y >= 0, `${fx} x=${x} t=${t}`).toBe(true);
        }
      }
    }
  });
});

describe('squeak_bounce (3절 표: 떨어져 4px 튀고 사라짐)', () => {
  it('8px 위에서 떨어져 6틱에 닿고, 12틱에 4px 튀고, 18틱에 다시 닿고, 24틱에 사라진다', () => {
    expect(bounceDy(0)).toBe(-8);
    expect(bounceDy(6)).toBe(-0);
    expect(bounceDy(12)).toBe(-4);
    expect(bounceDy(18)).toBe(0);
    expect(bounceDy(BOUNCE_GONE - 1)).toBe(0);
    expect(bounceDy(BOUNCE_GONE)).toBeNull();
    expect(bounceDy(-1)).toBeNull();
  });

  it('떨어지는 동안은 아래로만, 튀는 동안은 4px를 넘지 않는다', () => {
    for (let t = 1; t < 6; t++) expect(bounceDy(t)!).toBeGreaterThanOrEqual(bounceDy(t - 1)!);
    for (let t = 6; t < 18; t++) expect(bounceDy(t)!).toBeGreaterThanOrEqual(-4);
  });

  it('fx 길이(30틱)보다 먼저 사라지고, 글자는 뜨지 않고 시소 판(기준점) 위에 앉는다', () => {
    expect(BOUNCE_GONE).toBeLessThan(FX_TICKS);
    const c = meta.cells[BOUNCE_FX]!;
    expect(fxTextAt(BOUNCE_FX, c, { x: 300, y: 150 }, 20, W)).toEqual({ x: 300 - Math.floor(c[2] / 2), y: 150 - c[3] });
    expect(fxTextAt(BOUNCE_FX, c, { x: 300, y: 150 }, 12, W)!.y).toBe(150 - 4 - c[3]);
    expect(fxTextAt(BOUNCE_FX, c, { x: 300, y: 150 }, BOUNCE_GONE, W)).toBeNull();
  });
});

describe('tingSparkAt (3절 비고: キン 옆 반짝, 6틱마다 켜짐/꺼짐)', () => {
  const word = meta.cells.ting_text!;
  const spark = meta.cells[TING_SPARK]!;

  it('글자 칸 오른쪽 위 모서리에 반짝 가운데가 온다', () => {
    const p = { x: 100, y: 40 };
    expect(tingSparkAt(p, word, spark, 0, W)).toEqual({ x: 100 + word[2] - Math.floor(spark[2] / 2), y: 40 - Math.floor(spark[3] / 2) });
  });

  it('0~5틱 켜짐, 6~11틱 꺼짐, 12틱 다시 켜짐', () => {
    const p = { x: 100, y: 40 };
    expect(tingSparkAt(p, word, spark, 5, W)).not.toBeNull();
    expect(tingSparkAt(p, word, spark, 6, W)).toBeNull();
    expect(tingSparkAt(p, word, spark, 11, W)).toBeNull();
    expect(tingSparkAt(p, word, spark, 12, W)).not.toBeNull();
  });

  it('화면 오른쪽·위 끝에서도 화면 안이다', () => {
    const p = tingSparkAt({ x: W - word[2], y: 0 }, word, spark, 0, W)!;
    expect(p.x + spark[2]).toBeLessThanOrEqual(W);
    expect(p.y).toBe(0);
  });
});

describe('FX_TEXT_SPOT (둥지 글자 자리 예외, PR #299 리뷰)', () => {
  type Box = [number, number, number, number];
  const hs = screenJson.hotspots as Record<string, { box: number[]; variants?: { box: number[] }[] }>;
  const boxesOf = (id: string): Box[] => [hs[id]!.box, ...(hs[id]!.variants ?? []).map((v) => v.box)] as Box[];
  const overlaps = (a: Box, b: Box): boolean => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

  const NEST = FX_TEXT_SPOT.nest as { x: number; y: number };

  it('대상 전체 예외는 둥지 하나뿐이다(#289 리스크). 나머지는 `효과@대상` 한 글자 예외다(#530)', () => {
    expect(Object.keys(FX_TEXT_SPOT).filter((k) => !k.includes('@'))).toEqual(['nest']);
  });

  it('둥지 プピッ！ 칸은 왼쪽 x 173·아래 y 42에서 시작하고, 화면 끝에 붙잡히지 않는다', () => {
    const c = meta.cells.squeak_text!;
    const p = fxTextAt('squeak_text', c, NEST, 0, W)!;
    expect(p.x).toBe(173);
    expect(p.y + c[3]).toBe(42);
  });

  it('둥지 자리에 뜨는 글자는 사는 동안 까치(둥지 위·바닥)와 둥지 상자 어느 것과도 겹치지 않는다', () => {
    const shown = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const fx = (o as { fx?: unknown }).fx;
        if (Array.isArray(fx) && fx[1] === 'nest') shown.add(fx[0] as string);
        Object.values(o).forEach(walk);
      }
    };
    walk(screenJson);
    expect([...shown].sort()).toEqual(['squeak_text']);
    for (const fx of shown) {
      const c = meta.cells[fx]!;
      for (let t = 0; t < SIGNATURE_TICKS; t++) {
        const p = fxTextAt(fx, c, NEST, t, W)!;
        const cellBox: Box = [p.x, p.y, c[2], c[3]];
        for (const b of [...boxesOf('magpie'), ...boxesOf('nest')]) expect(overlaps(cellBox, b), `${fx} t=${t} vs ${b.join(',')}`).toBe(false);
      }
    }
  });
});
