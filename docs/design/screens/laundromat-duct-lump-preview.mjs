// 스테이지 3 `laundromat` O6 덕트 혹 3칸(`DUCT_LUMP`, 설계 laundromat.md 4절 1-2·3-2·2-2·6, 9-2 O6, E2) 미리보기·검사 (#764).
// 아직 빌드에 안 붙였다. 설계 9-3: 단서 칸은 빌드에 붙이기 전에 1배 그림 블라인드("무엇이 달라졌나")를 먼저 본다.
// 실행: node docs/design/screens/laundromat-duct-lump-preview.mjs
// 출력(같은 폴더):
//   laundromat-duct-lump-4x.png        걸린 자리 둘레 56×64, 혹 없음 → 걸림 → 끙끙 → 어깨 반짝(#935 (다)), 4배
//   laundromat-duct-lump-gray-4x.png   같은 줄 명도(흑백, ADR-0007 결정 3-6)
//   laundromat-duct-lump-path-2x.png   덕트 전체 308×132에 lump_travel 자리 여섯 곳을 한 장에 겹친 것, 2배
//   laundromat-duct-lump-anim-2x.png   lump_travel → 끙끙 두 바퀴 → lump_back → lump_travel → lump_pop, APNG 2배
//   laundromat-duct-lump-blind-1x.png  블라인드용 1배 두 장(왼쪽 혹 없음, 오른쪽 걸린 혹 멈춘 모습). 글·표시 없음
//   laundromat-duct-lump-soft-4x.png   각진 열쇠 혹 ↔ 말랑한 양말 혹(#935 S3), 가로 칸 위·세로 칸 아래, 4배
//   laundromat-duct-lump-soft-anim-2x.png  sock_through(말랑한 혹이 건조기 뒤로 쑥), APNG 2배
//   laundromat-duct-lump-tail-2x.png   양말 혹 꼬리 전(위)·후(아래), 왼쪽 가로 cx 330 / 오른쪽 세로 cy 96, 2배 (#935 (가))
// 검사(어기면 종료 코드 1):
//   - 혹 그림이 쓰는 덕트 값이 방 껍데기 DUCT와 같다
//   - 걸린 혹(멈춘 모습·끙끙) 그린 픽셀 전부 `duct` 핫스팟 안 = 혹을 누르면 덕트가 받는다(★③ S6). 혹 가운데 = reachPoint
//   - 어느 칸도 건조기 위 끝(164) 아래에 안 그린다, 빈 칸(0px)이 없다(빌드 picture() 실패)
//   - 가로 칸은 가로 구간 위아래 4px 안, 판자 구멍(x ≤ 96)·걸이와 안 겹치는 x
//   - 혹이 벽에 닿는 테두리는 전부 ink, 관 안쪽엔 ink 세로줄 없음
//   - 혹 없음 ↔ 걸린 혹 다른 픽셀 ≥ 120, 멈춘 모습 ↔ 끙끙 다른 픽셀 ≥ 40(1배에서 보일 크기)
//   - lump_travel 첫 칸 = 창 쪽 가로 자리, 마지막 칸 = stuck 첫 칸 / lump_back = 거꾸로 / stuck 첫 칸 = 멈춘 모습
//   - stuck 끝 칸 = 어깨 반짝(별 하나, 둥지 대기 반짝과 같은 ms), 끙끙은 그대로 두 번 (#935 (다))
//   - lump_travel 첫 칸 ≥ 160ms(창 쪽 머묾), 마지막 칸 80~120ms(덜컥과 깃털 한 박자), 다른 칸 80ms(E2)
//   - lump_travel·lump_back·lump_pop 칸 시간 합 ≤ 1500(형식 기록 8절)
//   - sock_through(#935 S3, PM 결정 (나)): 각진 혹보다 덜 부풀고(최대 2px) 반짝(white) 없음, 벽 쪽 테두리 ink·관 안 ink 0,
//     걸린 자리 칸(stuck)과 같은 칸이 없고 마지막 칸은 건조기 위 끝 바로 위, 칸 시간 합 ≤ 1500
//   - 양말 혹 꼬리(#935 (가)): 관 속 lav만, 혹 뒤쪽(가로 = 창 쪽, 세로 = 위쪽)에만, 판자 구멍·걸린 자리(지난 뒤)엔 안 그림.
//     가로 둘째 칸부터 ≥ 16px. 각진 열쇠 혹엔 꼬리 없음

import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng, animatedPng } from '../../../art/lib/pixel.mjs';
import { room, W, H, DUCT } from '../../../art/scenes/laundromat.room.mjs';
import { washer } from '../../../art/scenes/laundromat.washer.mjs';
import { shutter } from '../../../art/scenes/laundromat.shutter.mjs';
import { dryer } from '../../../art/scenes/laundromat.dryer.mjs';
import { vending } from '../../../art/scenes/laundromat.vending.mjs';
import { nestEmpty, NEST_KEY, DUCT_LUMP, LUMP_PATH, LUMP_STUCK, lumpV, lumpH, lumpSoftH, lumpSoftV } from '../../../art/scenes/laundromat.objects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/laundromat.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));
const DRYER_TOP = SCREEN.hotspots.dryer_3.box[1];

function base() {
  const img = new Image(W, H);
  room(img);
  ['open', 'load', 'empty', 'load'].forEach((door, i) => washer(img, 176 + i * 40 + 1, 180, { n: i + 1, door }));
  shutter(img, 'locked');
  dryer(img, SCREEN.hotspots.dryer_3.box[0], SCREEN.hotspots.dryer_3.box[1]);
  vending(img, SCREEN.hotspots.soap_vending.box[0], SCREEN.hotspots.soap_vending.box[1]);
  nestEmpty(img);
  return img;
}
const layer = (draw) => { const t = new Image(W, H); draw(t); return t; };
const over = (img, ...ts) => { const o = new Image(W, H); o.c.set(img.c); for (const t of ts) o.blit(t, 0, 0); return o; };
const pixels = (t) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) !== EMPTY) out.push([x, y, t.get(x, y)]); return out; };
const same = (a, b) => a.c.every((v, i) => v === b.c[i]);
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.c.length; i++) if (a.c[i] !== b.c[i]) n++; return n; };

const bg = base();
const stuck = layer((t) => lumpV(t, LUMP_STUCK.y));
const strain = layer((t) => lumpV(t, LUMP_STUCK.y, { strain: true }));
const glint = layer((t) => lumpV(t, LUMP_STUCK.y, { glint: true }));
const anims = Object.fromEntries(Object.entries(DUCT_LUMP).map(([k, a]) => [k, a.frames.map(layer)]));

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
check(DUCT.x === 360 && DUCT.w === 14 && DUCT.runY === 52 && DUCT.runH === 12 && DUCT.endX === 92 && DUCT.bottom === DRYER_TOP,
  `혹 덕트 값 = 방 껍데기 DUCT(x ${DUCT.x}, w ${DUCT.w}, runY ${DUCT.runY}, runH ${DUCT.runH}, endX ${DUCT.endX}, bottom ${DUCT.bottom} = 건조기 위 ${DRYER_TOP})`);
{
  const [bx, by, bw, bh] = SCREEN.hotspots.duct.box;
  const [rx, ry] = SCREEN.hotspots.duct.reachPoint;
  for (const [name, t] of Object.entries({ stuck, strain, glint })) {
    const out = pixels(t).filter(([x, y]) => x < bx || x >= bx + bw || y < by || y >= by + bh);
    check(out.length === 0, `${name}: 그린 픽셀 전부 duct 핫스팟 ${bx},${by} ${bw}×${bh} 안 (밖 ${out.length})`);
  }
  check(rx === LUMP_STUCK.x && ry === LUMP_STUCK.y, `걸린 혹 가운데 ${LUMP_STUCK.x},${LUMP_STUCK.y} = reachPoint ${rx},${ry}`);
}
for (const [k, fs] of Object.entries(anims)) {
  const low = fs.reduce((n, t) => n + pixels(t).filter(([, y]) => y >= DRYER_TOP).length, 0);
  const emptyAt = fs.findIndex((t) => pixels(t).length === 0);
  check(low === 0, `${k}: 건조기 위 끝 ${DRYER_TOP} 아래 픽셀 ${low} = 0`);
  check(emptyAt < 0, `${k}: 빈 칸 없음${emptyAt < 0 ? '' : ` (${emptyAt}번 칸이 비었다)`}`);
}
{
  const hangers = [150, 236, 316];
  const fs = anims.lump_travel.slice(0, LUMP_PATH.h.length);
  const ys = fs.flatMap((t) => pixels(t).map(([, y]) => y));
  const xs = fs.flatMap((t) => pixels(t).map(([x]) => x));
  check(Math.min(...ys) >= DUCT.runY - 4 && Math.max(...ys) <= DUCT.runY + DUCT.runH + 3, `가로 칸 y ${Math.min(...ys)}~${Math.max(...ys)}: 가로 구간 위아래 4px 안`);
  check(Math.min(...xs) > DUCT.endX + 4, `가로 칸 왼쪽 끝 x ${Math.min(...xs)} > 판자 구멍 ${DUCT.endX + 4}`);
  check(fs.every((t) => pixels(t).every(([x, y]) => !hangers.includes(x) || y >= DUCT.runY - 1)), '가로 칸이 걸이 줄(x 150·236·316)을 관 위에서 안 덮는다');
}
{
  const inside = (x, y) => (y >= DUCT.runY && y < DUCT.runY + DUCT.runH && x >= DUCT.endX && x < DUCT.x + DUCT.w) || (x >= DUCT.x && x < DUCT.x + DUCT.w && y >= DUCT.runY && y < DUCT.bottom);
  let edgeBad = 0, inkInside = 0;
  for (const t of [...anims.lump_travel, strain]) {
    for (const [x, y, c] of pixels(t)) {
      if (inside(x, y) && c === C.ink) inkInside++;
      const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]);
      if (c !== C.ink && n4.some(([nx, ny]) => t.get(nx, ny) === EMPTY && !inside(nx, ny) && ny < DUCT.bottom)) edgeBad++;
    }
  }
  check(edgeBad === 0, `혹이 벽에 닿는 테두리 ink 아닌 픽셀 ${edgeBad} = 0`);
  check(inkInside === 0, `관 안쪽 ink 픽셀 ${inkInside} = 0 (관과 이어지는 끝에 세로 ink 줄 없음)`);
}
{
  const d0 = diff(bg, over(bg, stuck)), d1 = diff(over(bg, stuck), over(bg, strain));
  check(d0 >= 120, `혹 없음 ↔ 걸린 혹 다른 픽셀 ${d0} ≥ 120`);
  check(d1 >= 40, `멈춘 모습 ↔ 끙끙 다른 픽셀 ${d1} ≥ 40`);
  check(Math.abs(Y[C.lint] - Y[C.cotton]) >= 30, `혹 몸 lint(Y${Y[C.lint]}) vs 벽 cotton(Y${Y[C.cotton]}): 차 ${Math.abs(Y[C.lint] - Y[C.cotton])}, 테두리 ink(Y${Y[C.ink]})가 가른다`);
}
{
  const { lump_travel: tr, lump_back: bk, stuck: st, lump_pop: pop } = anims;
  const firstH = layer((t) => DUCT_LUMP.lump_travel.frames[0](t));
  check(same(tr[0], firstH) && pixels(tr[0]).every(([x]) => x < 140), 'lump_travel: 첫 칸 = 창 쪽 판자 앞 가로 자리');
  check(same(tr.at(-1), stuck) && same(st[0], stuck), 'lump_travel: 마지막 칸 = 걸린 멈춘 모습 = stuck 첫 칸');
  check(bk.length === tr.length && bk.every((t, i) => same(t, tr[tr.length - 1 - i])), 'lump_back: lump_travel 칸 거꾸로(0칸)');
  check(same(st[1], strain), 'stuck: 둘째 칸 = 끙끙');
  {
    const dg = diff(over(bg, stuck), over(bg, glint));
    const gms = DUCT_LUMP.stuck.ms.at(-1), nms = NEST_KEY.loop.ms.at(-1);
    check(same(st.at(-1), glint) && dg >= 8 && dg <= 25, `stuck: 끝 칸 = 어깨 반짝(멈춘 모습과 다른 픽셀 ${dg}, 8~25: 별 하나 크기, #935 (다))`);
    check(gms === nms, `stuck 반짝 ${gms}ms = 둥지 대기 반짝 ${nms}ms(같은 낱말)`);
    check(st.filter((t) => same(t, strain)).length === 2, 'stuck: 반짝을 더해도 끙끙은 두 번(결정 3d7bd2be "쉬었다 두 번 끙끙")');
  }
  check(same(pop[0], strain), 'lump_pop: 첫 칸 = 끙끙(쿡에 한 번 더 끙), 같은 자리라 안 튄다');
  const ms = DUCT_LUMP.lump_travel.ms;
  check(ms[0] >= 160, `lump_travel 첫 칸 ${ms[0]}ms ≥ 160 (창 쪽 머묾, PR #900 재리뷰 1)`);
  check(ms.at(-1) >= 80 && ms.at(-1) <= 120, `lump_travel 마지막 칸 ${ms.at(-1)}ms 80~120 (덜컥 → 깃털 한 박자, 재리뷰 2)`);
  check(ms.slice(1, -1).every((m) => m === 80), 'lump_travel 가운데 칸 80ms(E2)');
  for (const [k, a] of Object.entries(DUCT_LUMP)) check(a.ms.length === a.frames.length, `${k}: 칸 ${a.frames.length}개 = 시간 ${a.ms.length}개`);
  for (const k of ['lump_travel', 'lump_back', 'lump_pop', 'sock_through']) { const s = DUCT_LUMP[k].ms.reduce((a, b) => a + b, 0); check(s <= 1500, `${k}: 칸 시간 합 ${s}ms ≤ 1500`); }
}
{
  // 말랑한 양말 혹(sock_through)
  const fs = anims.sock_through;
  const inside = (x, y) => (y >= DUCT.runY && y < DUCT.runY + DUCT.runH && x >= DUCT.endX && x < DUCT.x + DUCT.w) || (x >= DUCT.x && x < DUCT.x + DUCT.w && y >= DUCT.runY && y < DUCT.bottom);
  let edgeBad = 0, inkInside = 0, white = 0;
  for (const t of fs) for (const [x, y, c] of pixels(t)) {
    if (inside(x, y) && c === C.ink) inkInside++;
    if (c === C.white) white++;
    const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]);
    if (c !== C.ink && n4.some(([nx, ny]) => t.get(nx, ny) === EMPTY && !inside(nx, ny) && ny < DUCT.bottom)) edgeBad++;
  }
  check(edgeBad === 0, `sock_through: 벽에 닿는 테두리 ink 아닌 픽셀 ${edgeBad} = 0`);
  check(inkInside === 0, `sock_through: 관 안쪽 ink 픽셀 ${inkInside} = 0`);
  check(white === 0, `sock_through: 반짝(white) ${white} = 0 (패 모서리 반짝은 열쇠 혹만)`);
  // 부풂 = 관 밖으로 나온 몸(ink 아닌) 두께. 가로 칸은 위로, 세로 칸은 왼쪽으로 잰다
  const bulgeH = (t) => DUCT.runY - Math.min(...pixels(t).filter(([, , c]) => c !== C.ink).map(([, y]) => y));
  const bulgeV = (t) => DUCT.x - Math.min(...pixels(t).filter(([, , c]) => c !== C.ink).map(([x]) => x));
  const sH = layer((t) => lumpSoftH(t, 188)), aH = layer((t) => lumpH(t, 188));
  const sV = layer((t) => lumpSoftV(t, 96)), aV = layer((t) => lumpV(t, 96));
  check(bulgeH(sH) === 2 && bulgeH(aH) === 3, `가로 칸 부풂: 말랑 ${bulgeH(sH)}px < 각진 ${bulgeH(aH)}px`);
  check(bulgeV(sV) === 2 && bulgeV(aV) === 4, `세로 칸 부풂: 말랑 ${bulgeV(sV)}px < 각진 ${bulgeV(aV)}px`);
  // 어깨: 각진 혹은 가장 부푼 줄이 넓고(어깨가 평평), 말랑한 혹은 좁다(둥긂)
  const topRun = (t) => { const ps = pixels(t).filter(([, , c]) => c !== C.ink); const y0 = Math.min(...ps.map(([, y]) => y)); return ps.filter(([, y]) => y === y0).length; };
  check(topRun(sH) < topRun(aH), `가로 칸 가장 부푼 줄 폭: 말랑 ${topRun(sH)} < 각진 ${topRun(aH)} (둥근 어깨)`);
  const stuckLayer = layer((t) => lumpSoftV(t, LUMP_STUCK.y));
  check(!fs.some((t) => same(t, stuckLayer)) && !fs.some((t) => same(t, stuck)), 'sock_through: 걸린 자리(cy 150)에서 멈추는 칸 없음');
  const lastMaxY = Math.max(...pixels(fs.at(-1)).map(([, y]) => y)), lastMinY = Math.min(...pixels(fs.at(-1)).map(([, y]) => y));
  check(lastMaxY === DRYER_TOP - 1 && lastMinY >= LUMP_STUCK.y + 8, `sock_through 마지막 칸 y ${lastMinY}~${lastMaxY}: 건조기 위 끝 바로 위, 걸린 자리 아래`);
  check(same(fs[0], layer((t) => lumpSoftH(t, LUMP_PATH.h[0]))), 'sock_through 첫 칸 = 창 쪽 가로 자리');
  check(DUCT_LUMP.sock_through.ms.slice(1).every((m) => m === 80), 'sock_through 첫 칸 뒤는 80ms(E2)');
}
{
  // 꼬리(#935 묶음 2 판정 ②, Luna 안 (가)): 말랑한 혹 뒤쪽(창 쪽·위쪽) 관 속에만 lav 줄. 앞쪽엔 없다. 각진 열쇠 혹엔 없다.
  const tailOf = (withT, without) => { const a = layer(withT), b = layer(without); return pixels(a).filter(([x, y, c]) => b.get(x, y) !== c); };
  const inside = (x, y) => (y >= DUCT.runY && y < DUCT.runY + DUCT.runH && x >= DUCT.endX && x < DUCT.x + DUCT.w) || (x >= DUCT.x && x < DUCT.x + DUCT.w && y >= DUCT.runY && y < DUCT.bottom);
  for (const cx of LUMP_PATH.h) {
    const tp = tailOf((t) => lumpSoftH(t, cx), (t) => lumpSoftH(t, cx, { tail: false }));
    const ok = tp.every(([x, y, c]) => c === C.lav && inside(x, y) && x < cx - 11 && x >= DUCT.endX + 5);
    if (cx === LUMP_PATH.h[0]) check(ok, `가로 cx ${cx}(창에서 막 나옴): 꼬리 ${tp.length}px, 판자 구멍 쪽(x < ${DUCT.endX + 5})엔 안 그림`);
    else check(ok && tp.length >= 16, `가로 cx ${cx}: 꼬리 ${tp.length}px ≥ 16, 전부 관 속 lav, 혹 왼쪽(창 쪽)에만`);
  }
  for (const cy of [...LUMP_PATH.v, 158, 173]) {
    const tp = tailOf((t) => lumpSoftV(t, cy), (t) => lumpSoftV(t, cy, { tail: false }));
    const ok = tp.every(([x, y, c]) => c === C.lav && inside(x, y) && y < cy - 11 && y >= DUCT.runY + DUCT.runH && (cy <= LUMP_STUCK.y || y >= LUMP_STUCK.y + 8));
    check(ok && (cy !== LUMP_PATH.v[0] || tp.length >= 16), `세로 cy ${cy}: 꼬리 ${tp.length}px, 관 속 lav, 혹 위쪽에만, 걸린 자리를 지난 칸은 그 자리에 안 남김`);
  }
  check(!anims.lump_travel.some((t) => pixels(t).some(([x, y, c]) => c === C.lav && inside(x, y) && x < 300 && x > 200 && y === DUCT.runY + 6 && t.get(x + 1, y) === C.lav && t.get(x + 2, y) === C.lav && t.get(x + 3, y) === C.lav && t.get(x + 4, y) === C.lav)),
    '각진 열쇠 혹(lump_travel)엔 꼬리 줄이 없다(말랑 = 휙 지나감, 각진 = 버팀)');
}

// ── 출력
const cropper = (R) => (img) => { const c = new Image(R.w, R.h); for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) c.set(x, y, img.get(R.x + x, R.y + y)); return c; };
const near = cropper({ x: 339, y: 104, w: 56, h: 64 });
const shots = [bg, over(bg, stuck), over(bg, strain), over(bg, glint)].map(near);
const strip = new Image(shots.length * 58 - 2, 64, C.white);
shots.forEach((s, i) => strip.blit(s, i * 58, 0));
writeFileSync(join(HERE, 'laundromat-duct-lump-4x.png'), indexedPng(strip, 4));
{
  const S = 4, w = strip.w * S, h = strip.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = strip.get(Math.floor(x / S), Math.floor(y / S)); raw[y * (w + 1) + 1 + x] = c === EMPTY ? 255 : Y[c]; }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, 'laundromat-duct-lump-gray-4x.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
const wide = cropper({ x: 86, y: 38, w: 308, h: 132 });
writeFileSync(join(HERE, 'laundromat-duct-lump-path-2x.png'), indexedPng(wide(over(bg, ...anims.lump_travel)), 2));
{
  const seq = [{ img: wide(bg), ms: 600 }];
  const add = (k) => anims[k].forEach((t, i) => seq.push({ img: wide(over(bg, t)), ms: DUCT_LUMP[k].ms[i] }));
  add('lump_travel'); add('stuck'); add('stuck'); add('lump_back');
  seq.push({ img: wide(bg), ms: 500 });
  add('lump_travel'); add('stuck'); add('lump_pop');
  seq.push({ img: wide(bg), ms: 600 });
  writeFileSync(join(HERE, 'laundromat-duct-lump-anim-2x.png'), animatedPng(seq, 2));
}
const blind = new Image(W * 2 + 4, H, C.white);
blind.blit(bg, 0, 0);
blind.blit(over(bg, stuck), W + 4, 0);
writeFileSync(join(HERE, 'laundromat-duct-lump-blind-1x.png'), indexedPng(blind, 1));

{
  const near2 = cropper({ x: 166, y: 42, w: 46, h: 24 }), nearV = cropper({ x: 346, y: 80, w: 42, h: 34 });
  const rows = [
    [over(bg, layer((t) => lumpH(t, 188))), over(bg, layer((t) => lumpSoftH(t, 188)))].map(near2),
    [over(bg, layer((t) => lumpV(t, 96))), over(bg, layer((t) => lumpSoftV(t, 96)))].map(nearV),
  ];
  const sheet = new Image(2 * 48, 24 + 2 + 34, C.white);
  rows[0].forEach((s, i) => sheet.blit(s, i * 48, 0));
  rows[1].forEach((s, i) => sheet.blit(s, i * 48 + 2, 26));
  writeFileSync(join(HERE, 'laundromat-duct-lump-soft-4x.png'), indexedPng(sheet, 4));
  const seq = [{ img: wide(bg), ms: 600 }];
  anims.sock_through.forEach((t, i) => seq.push({ img: wide(over(bg, t)), ms: DUCT_LUMP.sock_through.ms[i] }));
  seq.push({ img: wide(bg), ms: 800 });
  writeFileSync(join(HERE, 'laundromat-duct-lump-soft-anim-2x.png'), animatedPng(seq, 2));
}
{
  // 꼬리 전·후(#935 (가)): Mia 2-1 ★① 스크린샷이 찍은 가로 마지막 자리(cx 330)와 세로 cy 96. 위 = 전(꼬리 없음), 아래 = 후. 2배
  const cut = cropper({ x: 270, y: 40, w: 112, h: 72 });
  const pair = [
    over(bg, layer((t) => lumpSoftH(t, 330, { tail: false }))), over(bg, layer((t) => lumpSoftH(t, 330))),
    over(bg, layer((t) => lumpSoftV(t, 96, { tail: false }))), over(bg, layer((t) => lumpSoftV(t, 96))),
  ].map(cut);
  const sheet = new Image(2 * 114, 2 * 74, C.white);
  pair.forEach((s, i) => sheet.blit(s, (i >> 1) * 114, (i & 1) * 74));
  writeFileSync(join(HERE, 'laundromat-duct-lump-tail-2x.png'), indexedPng(sheet, 2));
}

if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
