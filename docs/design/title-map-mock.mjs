// 메인화면(타이틀)·깬 판 맵 배치 목업 (#792). 설계 문서 docs/design/title-and-map.md의 숫자를 그대로 그린다.
// 실행: node docs/design/title-map-mock.mjs
// 입력: public/scenes/<id>-bg.png (배경, 썸네일 자리 확인용. 실제 썸네일은 시작 상태 장면을 자른다, 문서 3-3절)
// 출력: docs/design/art/title-map-mock-2x.png (960×1080 = 2배 목업 두 장을 위아래로: 타이틀 / 맵)
// 글자는 그리지 않는다. 글자 자리는 막대(폭 = 글자 예산 × 글자 크기)로 보인다. 빌드에 들어가지 않는 설계 자료다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const PAL = readFileSync(join(HERE, 'art/bosong-32.hex'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  .map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
const C = { ink: 0, plum: 1, dusk: 2, lav: 3, lint: 4, cotton: 5, white: 6, yel: 15, yelD: 14 };
const W = 480, H = 270;
const ORDER = JSON.parse(readFileSync(join(ROOT, 'content/screens/order.json'), 'utf8'));

// ── 문서 숫자 (title-and-map.md 2절·3절) ──
export const TITLE = {
  dim: 0.55,
  ja: { x: 90, y: 46, w: 300, h: 36 },
  en: { x: 160, y: 88, w: 160, h: 14 },
  buttons: { x: 174, w: 132, h: 28, y0: 132, gap: 8 },
  confirm: { y: 240, h: 14, w: 280 },
};
export const MAP = {
  back: { x: 8, y: 8, w: 72, h: 28 },
  card: { w: 128, h: 100, y: 76, xs: [24, 176, 328] },
  thumb: { dx: 4, dy: 4, w: 120, h: 68 },
  name: { dy: 78, h: 16 },
  stamp: { size: 16 },
  locked: { y: 200, h: 14, w: 280 },
  pathY: 126,
};
// 썸네일 자르는 자리(시작 상태 장면의 왼쪽 위). 그림 전 화면은 null(잠금 칸과 같은 회색).
export const THUMB_ORIGIN = { magpie_nest: [88, 18], park_fountain: [165, 60], laundromat: null };

// ── 아주 작은 PNG 읽기(8비트 인덱스, 인터레이스 없음만) ──
function readIndexedPng(path) {
  const d = readFileSync(path);
  let p = 8, w = 0, h = 0, plte = null; const idat = [];
  while (p < d.length) {
    const len = d.readUInt32BE(p), type = d.toString('ascii', p + 4, p + 8), body = d.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); if (body[8] !== 8 || body[9] !== 3 || body[12] !== 0) throw new Error(`${path}: 8비트 인덱스만`); }
    if (type === 'PLTE') plte = body;
    if (type === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h);
  let prev = new Uint8Array(w);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (w + 1)], row = raw.subarray(y * (w + 1) + 1, (y + 1) * (w + 1)), cur = new Uint8Array(w);
    for (let x = 0; x < w; x++) {
      const a = x ? cur[x - 1] : 0, b = prev[x], c = x ? prev[x - 1] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pr = f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : f === 3 ? (a + b) >> 1 : f === 2 ? b : f === 1 ? a : 0;
      cur[x] = (row[x] + pr) & 255;
    }
    out.set(cur, y * w); prev = cur;
  }
  return { w, h, px: (x, y) => { const i = out[y * w + x] * 3; return [plte[i], plte[i + 1], plte[i + 2]]; } };
}

// ── 그리기 ──
const img = new Uint8Array(W * H * 2 * 3); // 1배 목업 두 장(위 타이틀, 아래 맵)
const put = (x, y, rgb, a = 1) => {
  if (x < 0 || x >= W || y < 0 || y >= H * 2) return;
  const i = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) img[i + k] = Math.round(img[i + k] * (1 - a) + rgb[k] * a);
};
const rect = (x, y, w, h, c, a = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, PAL[c], a); };
const frame = (x, y, w, h, c, t = 1) => { rect(x, y, w, t, c); rect(x, y + h - t, w, t, c); rect(x, y, t, h, c); rect(x + w - t, y, t, h, c); };
const bgOf = (id) => { const f = join(ROOT, `public/scenes/${id}-bg.png`); return existsSync(f) ? readIndexedPng(f) : null; };

// 1) 타이틀 (y 0~269)
{
  const bg = bgOf(ORDER[0]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, bg ? bg.px(x, y) : PAL[C.dusk]);
  rect(0, 0, W, H, C.ink, TITLE.dim);
  const { ja, en, buttons: b, confirm } = TITLE;
  rect(ja.x, ja.y, ja.w, ja.h, C.yel); frame(ja.x - 2, ja.y - 2, ja.w + 4, ja.h + 4, C.ink, 2); // 일본어 제목 자리(28~32px 10자)
  rect(en.x, en.y, en.w, en.h, C.cotton);
  // 버튼 3개: 이어 하기(주 버튼) / 새로 하기 / 맵
  for (let k = 0; k < 3; k++) {
    const y = b.y0 + k * (b.h + b.gap);
    rect(b.x, y, b.w, b.h, C.ink, 0.88); frame(b.x, y, b.w, b.h, k === 0 ? C.yel : C.lav);
    rect(b.x + (b.w - 84) / 2, y + 7, 84, 14, k === 0 ? C.yel : C.white); // 6자 × 14px
  }
  rect((W - confirm.w) / 2, confirm.y, confirm.w, confirm.h, C.yel, 0.6); // 새로 하기 확인 줄(첫 누름 뒤에만)
  // 캐릭터 셋 서 있는 자리(시작 카드 얼굴과 같은 서 있기 그림 재사용, 새 칸 0)
  for (const [x, hh] of [[16, 46], [42, 34], [68, 22]]) rect(x, 252 - hh, 20, hh, C.white, 0.85);
}

// 2) 맵 (y 270~539)
{
  const oy = H;
  rect(0, oy, W, H, C.ink);
  const { back, card, thumb, name, stamp, locked, pathY } = MAP;
  rect(back.x, oy + back.y, back.w, back.h, C.ink); frame(back.x, oy + back.y, back.w, back.h, C.lav);
  rect(back.x + 8, oy + back.y + 7, 56, 14, C.white); // 4자 × 14px
  // 길(점선) — 카드 사이와 마지막 카드 오른쪽 끝까지(다음 판이 생길 자리)
  for (let x = 0; x < W; x += 6) {
    const onCard = card.xs.some((cx) => x >= cx - 2 && x < cx + card.w + 2);
    if (!onCard && x > card.xs[0]) rect(x, oy + pathY, 2, 2, C.lint);
  }
  const state = ['cleared', 'cleared', 'locked']; // 목업: 앞 두 판 깸, 셋째 잠금
  ORDER.forEach((id, i) => {
    const cx = card.xs[i], cy = oy + card.y, st = state[i];
    rect(cx, cy, card.w, card.h, C.plum);
    const org = THUMB_ORIGIN[id], bg = org && bgOf(id);
    for (let y = 0; y < thumb.h; y++) for (let x = 0; x < thumb.w; x++)
      put(cx + thumb.dx + x, cy + thumb.dy + y, bg ? bg.px(org[0] + x, org[1] + y) : PAL[C.dusk]);
    if (st === 'locked') { rect(cx + thumb.dx, cy + thumb.dy, thumb.w, thumb.h, C.ink, 0.8); rect(cx + 52, cy + 26, 24, 24, C.cotton, 0.9); }
    frame(cx, cy, card.w, card.h, st === 'cleared' ? C.yel : C.lint, st === 'cleared' ? 2 : 1);
    rect(cx + (card.w - 96) / 2, cy + name.dy, 96, name.h - 4, st === 'locked' ? C.lint : C.white); // 이름 8자 × 12px
    if (st === 'cleared') { const sx = cx + thumb.dx + thumb.w - stamp.size - 2, sy = cy + thumb.dy + 2; rect(sx, sy, stamp.size, stamp.size, C.yel); frame(sx, sy, stamp.size, stamp.size, C.ink); }
  });
  rect((W - locked.w) / 2, oy + locked.y, locked.w, locked.h, C.cotton, 0.5); // 잠금 칸을 눌렀을 때만 뜨는 줄
}

// ── 2배로 키워 RGB PNG로 쓰기 ──
const S = 2, OW = W * S, OH = H * 2 * S, rows = [];
for (let y = 0; y < OH; y++) {
  const r = Buffer.alloc(1 + OW * 3);
  for (let x = 0; x < OW; x++) { const i = ((y / S | 0) * W + (x / S | 0)) * 3; r[1 + x * 3] = img[i]; r[2 + x * 3] = img[i + 1]; r[3 + x * 3] = img[i + 2]; }
  rows.push(r);
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, b) => { const l = Buffer.alloc(4); l.writeUInt32BE(b.length); const tb = Buffer.concat([Buffer.from(t, 'ascii'), b]); const cb = Buffer.alloc(4); cb.writeUInt32BE(crc(tb)); return Buffer.concat([l, tb, cb]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = join(HERE, 'art/title-map-mock-2x.png');
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${out} (${OW}×${OH})`);
