// 시트 이미지의 불투명 칸 표 (설계 `ui-interaction.md` 2-1절, #736). 순수 데이터다.
// 엔진은 시트 이미지를 읽을 때 한 번 만들고(engine/pixels.ts), 노드 테스트는 커밋된 PNG를 디코드해 만든다(tests/art/png.ts).
// "보이는 그림 칸을 누르면 그 사람"을 판정할 때 쓴다. 칸 위끝(#464 `cellTops`)과 같은 알파 기준(0보다 크면 불투명)이다.

/** 시트 전체 픽셀마다 불투명이면 1. `width`·`height`는 시트 크기 px. */
export interface AlphaMask {
  width: number;
  height: number;
  opaque: Uint8Array;
}

/** RGBA 바이트(`ImageData.data`) → 불투명 표. */
export function alphaMask(rgba: ArrayLike<number>, width: number, height: number): AlphaMask {
  const opaque = new Uint8Array(width * height);
  for (let i = 0; i < opaque.length; i++) opaque[i] = rgba[i * 4 + 3]! > 0 ? 1 : 0;
  return { width, height, opaque };
}

/** 시트 안 정수 픽셀 (x, y)가 불투명인가. 시트 밖이면 false. */
export function opaqueAt(m: AlphaMask, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return false;
  return m.opaque[y * m.width + x] === 1;
}
