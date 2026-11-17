import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../core/characters';
import { ACTIVE_MARKER_ROWS, activeMarkerRects, FIGURES, INK, WHITE } from './placeholder';

const HAS_SHEET = new Set(
  Object.keys(import.meta.glob('../../public/sprites/*-base.json')).map((p) => p.replace(/^.*\/(\w+)-base\.json$/, '$1')),
);

// 임시 그림이 히트 영역 밖으로 나가면 "보이는 곳을 눌렀는데 안 바뀜"이 생긴다 (ADR-0007 결정 6).
// 서 있는 프레임 기준. 걷기 들썩임(1px 위)은 판정에 넣지 않는다.
describe('임시 캐릭터 그림은 히트 영역 안에 들어간다', () => {
  it.each(CHARACTERS)('$id', (def) => {
    const { dx, dy, width, height } = def.hit;
    const parts = FIGURES[def.id];
    expect(parts.length).toBeGreaterThan(0);
    for (const [px, py, pw, ph] of parts) {
      expect(px).toBeGreaterThanOrEqual(dx);
      expect(px + pw).toBeLessThanOrEqual(dx + width);
      expect(py).toBeGreaterThanOrEqual(dy);
      expect(py + ph).toBeLessThanOrEqual(dy + height);
    }
    // 시트가 없는 캐릭터는 키가 히트 영역 높이를 다 쓴다 (머리 꼭대기 = 히트 영역 위끝).
    // 시트가 있으면 히트 영역은 시트 그림을 따르고(#46), 실루엣은 시트에 없는 자세의 대역이라 그보다 작다.
    if (!HAS_SHEET.has(def.id)) expect(Math.min(...parts.map((p) => p[1]))).toBe(dy);
  });
});

// #46: ▼ 조작 표시 규격 (Luna 2026-11-17). 흰 채움 + ink 1px, 9×6, 끝이 히트 박스 top 2px 위.
describe('▼ 조작 표시', () => {
  const pixels = (top: number, cx: number, tick: number) => {
    const out = new Map<string, string>();
    for (const [x, y, w, h, c] of activeMarkerRects(top, cx, tick))
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
        const k = `${x + i},${y + j}`;
        expect(out.has(k)).toBe(false); // 겹쳐 칠하지 않는다
        out.set(k, c);
      }
    return out;
  };

  it('픽셀이 규격 그림과 같다 (9×6, ink 테두리, 흰 채움 7×4)', () => {
    const px = pixels(100, 50, 0);
    const xs = [...px.keys()].map((k) => Number(k.split(',')[0]));
    const ys = [...px.keys()].map((k) => Number(k.split(',')[1]));
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    expect(Math.max(...xs) - x0 + 1).toBe(9);
    expect(Math.max(...ys) - y0 + 1).toBe(6);
    const drawn = ACTIVE_MARKER_ROWS.map((row, dy) =>
      [...row].map((_, dx) => ({ [INK]: '#', [WHITE]: 'W' })[px.get(`${x0 + dx},${y0 + dy}`) ?? ''] ?? '.').join(''),
    );
    expect(drawn).toEqual([...ACTIVE_MARKER_ROWS]);
    expect([...px.values()].filter((c) => c === WHITE)).toHaveLength(7 + 5 + 3 + 1);
  });

  it('끝은 가운데 x, 히트 박스 top에서 2px 위 (흔들림 1px)', () => {
    for (const [tick, tip] of [[0, 97], [20, 96]] as const) {
      const px = pixels(100, 50.4, tick);
      const bottom = Math.max(...[...px.keys()].map((k) => Number(k.split(',')[1])));
      expect(bottom).toBe(tip);
      expect([...px.keys()].filter((k) => k.endsWith(`,${bottom}`))).toEqual([`50,${bottom}`]);
    }
  });

  it('top이 0 근처여도 화면 위로 잘리지 않는다 (고리에 매달린 쭉이)', () => {
    for (const tick of [0, 20]) {
      const ys = activeMarkerRects(2, 50, tick).map((r) => r[1]);
      expect(Math.min(...ys)).toBe(0);
    }
  });
});
