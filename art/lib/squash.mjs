// 공용 "납작"(common.flatten) 찌그러뜨리기 (#142 묶음 ②). 세 사람이 같이 쓴다.
// 몸을 다시 그리지 않고, 다 그린 몸(외곽선 전)을 바닥 기준으로 세로로 누르고 가로로 퍼뜨린다(가장 가까운 픽셀).
// 색과 부품 번호를 같이 옮기므로 뒤에 도는 K.outline()이 눌린 모양을 그대로 감싼다(외곽선이 끊기지 않는다).
// 순서: 부품 → colorLines → 손·머리 stamp → rimShade → soles → **squash** → K.outline() → fx

import { EMPTY } from './pixel.mjs';

/**
 * K를 바닥(맨 아랫줄)에 붙인 채 세로 sy배, 가로 sx배로 다시 뽑는다.
 * - keep [[행0, 행1]]: 그 칸 행들은 누르지도 늘이지도 않고 한 번씩 그대로 옮긴다. 눈·입이 눌려 사라지거나
 *   늘어나 두꺼워지지 않게 쓴다. 나머지 행이 남은 높이를 고르게 나눠 갖는다.
 * - 가로 기준은 맨 아래 3줄(발)의 가운데다. 기준점(두 발 가운데)이 움직이지 않는다.
 * - 칸을 넘치지 않게 줄인다: 위는 1행부터, 옆은 1~w−2열(외곽선 1px 자리). sy·sx는 그 안에서만 쓴다.
 * 돌려주는 값: 실제로 쓴 {sx, sy} (미리보기·검사용)
 */
export function squash(K, { sx = 1, sy = 1, keep = [] }) {
  const b = K.bbox();
  if (!b) return { sx, sy };
  const bottom = b.y + b.h - 1;

  // 가로 기준: 발(맨 아래 3줄) 가운데
  const foot = K.bbox(bottom - 2, bottom);
  const ax = foot.x + foot.w / 2;
  // 옆으로 넘치지 않는 가장 큰 배율
  const fit = Math.min((ax - 1) / (ax - b.x), (K.w - 1 - ax) / (b.x + b.w - ax));
  const usx = Math.min(sx, fit);

  // 세로: 아래에서 위로 원래 행을 무게만큼 늘어놓고 고르게 뽑는다
  const H = Math.max(1, Math.min(Math.round(b.h * sy), bottom)); // 위 끝은 1행까지(0행엔 외곽선을 못 단다)
  const rows = [];
  for (let y = bottom; y >= b.y; y--) rows.push({ y, keep: keep.some(([a, c]) => y >= a && y <= c) });
  const nKeep = rows.filter((r) => r.keep).length;
  if (H <= nKeep) throw new Error(`[squash] 높이 ${H}행이 지킬 행 ${nKeep}개보다 작다`);
  // 지킬 행은 정확히 1행, 나머지는 (H − 지킬 행) / (나머지 행 수)씩
  const rest = (H - nKeep) / (rows.length - nKeep);
  for (const r of rows) r.w = r.keep ? 1 : rest;

  const c = new Int16Array(K.c.length).fill(EMPTY);
  const p = new Int16Array(K.p.length).fill(EMPTY);
  let i = 0, acc = rows[0].w;
  for (let j = 0; j < H; j++) {
    const t = j + 0.5; // 누적 무게 = 칸 행
    while (acc < t && i < rows.length - 1) acc += rows[++i].w;
    const sy0 = rows[i].y, dy = bottom - j;
    for (let x = 0; x < K.w; x++) {
      const sx0 = Math.floor(ax + (x + 0.5 - ax) / usx);
      if (sx0 < 0 || sx0 >= K.w) continue;
      const s = sy0 * K.w + sx0, d = dy * K.w + x;
      c[d] = K.c[s];
      p[d] = K.p[s];
    }
  }
  K.c = c;
  K.p = p;
  return { sx: usx, sy: H / b.h };
}
