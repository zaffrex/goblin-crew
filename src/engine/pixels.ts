// 이미지 픽셀 읽기 (#464 칸 위끝, #736 그림 칸 알파). 시트를 읽을 때 한 번만 부른다.
// 캔버스를 못 쓰면(오래된 브라우저, 보안 제한) null이다. 호출하는 쪽은 픽셀 없이 예전 동작으로 돌아간다.

/** 이미지 전체 RGBA. 읽기 실패면 경고를 남기고 null. */
export function readRgba(image: HTMLImageElement): { rgba: Uint8ClampedArray; width: number; height: number } | null {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (width === 0 || height === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    return { rgba: ctx.getImageData(0, 0, width, height).data, width, height };
  } catch (e) {
    console.warn(`이미지 픽셀을 못 읽었어요(${image.src}): ${(e as Error).message}`);
    return null;
  }
}
