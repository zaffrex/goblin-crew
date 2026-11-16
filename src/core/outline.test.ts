import { describe, expect, it } from 'vitest';
import { HINT_RGB, outlineSheet, type Rect } from './outline';

// 글자 그림 → RGBA. '.' 투명, 'k' ink(0번), 'w' 흰색, 'p' 눈동자(ink와 같은 색).
const COLORS: Record<string, [number, number, number]> = { k: [0x1b, 0x17, 0x20], w: [0xff, 0xf8, 0xee], p: [0x1b, 0x17, 0x20] };
function sheet(rows: string[]): { data: Uint8ClampedArray; width: number } {
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      data.set([...COLORS[ch]!, 255], (y * width + x) * 4);
    }),
  );
  return { data, width };
}
/** RGBA → 글자 그림. hint는 'h', 그 밖은 원래 글자(색으로 되돌림). */
function draw(data: Uint8ClampedArray, width: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < data.length / 4 / width; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const rgb = [data[i], data[i + 1], data[i + 2]];
      if (data[i + 3] === 0) row += '.';
      else if (rgb.join() === HINT_RGB.join()) row += 'h';
      else if (rgb.join() === COLORS.w!.join()) row += 'w';
      else row += 'k';
    }
    rows.push(row);
  }
  return rows;
}

describe('호버 외곽선 (#157 3단계, ADR-0007 결정 2)', () => {
  it('투명과 4방향으로 맞닿은 픽셀만 hint가 되고, 안쪽 ink(눈동자)는 그대로다', () => {
    const { data, width } = sheet([
      '.......', //
      '.kkkkk.',
      '.kwwwk.',
      '.kwpwk.',
      '.kwwwk.',
      '.kkkkk.',
      '.......',
    ]);
    expect(draw(outlineSheet(data, width, [[0, 0, width, 7]]), width)).toEqual([
      '.......', //
      '.hhhhh.',
      '.hwwwh.',
      '.hwkwh.',
      '.hwwwh.',
      '.hhhhh.',
      '.......',
    ]);
  });

  it('대각선으로만 투명과 닿은 픽셀은 바깥이 아니다(4방향)', () => {
    const { data, width } = sheet([
      '..kk', //
      '.kkk',
      'kkkk',
      'kkkk',
    ]);
    // 사각형 밖은 투명으로 본다 → 시트 가장자리도 바깥.
    expect(draw(outlineSheet(data, width, [[0, 0, 4, 4]]), width)).toEqual([
      '..hh', //
      '.hkh',
      'hkkh',
      'hhhh',
    ]);
  });

  it('프레임 사각형마다 따로 본다: 옆 프레임과 맞붙은 픽셀도 바깥이고, 사각형 밖은 안 바뀐다', () => {
    const { data, width } = sheet([
      'kkkkkk', //
      'kkkkkk',
      'kkkkkk',
    ]);
    const rects: Rect[] = [
      [0, 0, 3, 3],
      [3, 0, 3, 2],
    ];
    expect(draw(outlineSheet(data, width, rects), width)).toEqual([
      'hhhhhh', //
      'hkhhhh',
      'hhhkkk', // 둘째 사각형(높이 2) 밖인 맨 아래 오른쪽 3칸은 그대로
    ]);
  });

  it('원본 버퍼는 바꾸지 않는다', () => {
    const { data, width } = sheet(['kk', 'kk']);
    const before = [...data];
    outlineSheet(data, width, [[0, 0, 2, 2]]);
    expect([...data]).toEqual(before);
  });
});
