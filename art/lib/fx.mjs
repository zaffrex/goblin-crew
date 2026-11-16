// 연출 효과 (외곽선 없음, ADR-0007 결정 3-1: 검은 테두리 = 만질 수 있음). 칸 px 좌표.
// 쭉이(jjuk-v4.mjs)에서 만들어 묵직이가 같이 쓴다. K.outline() 뒤에 부른다.

import { C, EMPTY } from './pixel.mjs';

/**
 * 바닥 먼지 한 덩이: 가운데 x, 크기 0~2. 아래 행은 칸 마지막 행에 닿는다.
 * opt.behind: true면 이미 칠한 픽셀(몸)은 덮지 않는다(먼지가 신발 뒤에서 피어오른다).
 */
export function puff(K, cx, size, opt = {}) {
  const rows = [
    ['..cww..', '.cwwwc.', 'clwwwlc', '.lllll.'],
    ['...cww.cw...', '.cwwwwcwwwc.', 'cwwwwwwwwwlc', 'clwwlwwlwwll', '.llll.lllll.'],
    ['.c....w..', '...c.....', 'c.....l.c', '..l.c....'],
  ][size];
  const legend = { c: C.cotton, w: C.white, l: C.lint };
  const w = rows[0].length;
  const x0 = Math.round(cx - w / 2), y0 = K.h - rows.length;
  if (!opt.behind) {
    K.stamp(x0, y0, rows, legend);
    return;
  }
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (legend[ch] !== undefined && K.get(x0 + i, y0 + j) === EMPTY) K.dot(x0 + i, y0 + j, legend[ch]);
  }));
}

/**
 * 속도선: [x, 위 행, 아래 행]. 기본(위로 솟음)은 위가 흰색, 아래로 갈수록 옅은 회색으로 끊긴다.
 * opt.fall: true면 거꾸로(떨어짐): 아래(몸 쪽)가 흰색, 위로 갈수록 끊긴다.
 */
export function streaks(K, lines, opt = {}) {
  for (const [x, y0, y1] of lines)
    for (let y = y0; y <= y1; y++) {
      const t0 = (y - y0) / Math.max(1, y1 - y0);
      const t = opt.fall ? 1 - t0 : t0;
      if (t > 0.7 && (y % 2)) continue; // 꼬리는 점선
      K.dot(x, y, t < 0.35 ? C.white : t < 0.7 ? C.cotton : C.lint);
    }
}

/**
 * 떨어지는 몸 아래 바닥 그림자(외곽선 없음): 가운데 x, 폭 w(짝수 권장). 칸 마지막 2행.
 * 아랫줄은 dusk 한 줄, 윗줄은 가운데 절반만 듬성듬성(가장자리가 흐린 타원). 몸이 공중일 때 "여기로 떨어진다"를 보여 준다.
 */
export function shadow(K, cx, w) {
  const y = K.h - 1;
  const x0 = Math.round(cx - w / 2);
  for (let i = 0; i < w; i++) K.dot(x0 + i, y, i === 0 || i === w - 1 ? C.lav : C.dusk);
  const q = Math.round(w / 4);
  for (let i = q; i < w - q; i += 2) K.dot(x0 + i, y - 1, C.lav);
}

/**
 * 물방울(외곽선 없음): [x, y, 크기] 목록. 크기 0 = 한 점(튀는 물), 1 = 세로 2px(떨어지는 방울), 2 = 3×3 둥근 방울(왼쪽이 반짝).
 * 청록 중간·밝은 단(tealM·tealL)이라 배경 벽(크림)과 하늘 어디서나 1배에서 보인다(aqua는 크림 위에서 안 보였다).
 * 이미 칠한 픽셀도 덮는다(몸 위를 흐르는 물). 쭉이 `common.wet`에서 만들었고 다른 사람의 젖음도 같이 쓴다.
 */
export function drops(K, pts) {
  const rows = [['M'], ['L', 'M'], ['.L.', 'WLM', '.M.']];
  const legend = { W: C.white, L: C.tealL, M: C.tealM };
  for (const [x, y, s] of pts) K.stamp(x, y, rows[s], legend);
}
