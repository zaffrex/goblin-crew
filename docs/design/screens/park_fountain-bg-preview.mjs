// 화면 2 배경 미리보기·검사 (#380). 원본: art/scenes/park_fountain.mjs (배경), art/scenes/park_fountain.objects.mjs (물건)
// 실행: node docs/design/screens/park_fountain-bg-preview.mjs
// 출력(같은 폴더):
//   park_fountain-bg-1x.png        배경 전체 실제 크기(480×270). 진마씨가 보시는 기준
//   park_fountain-bg-2x.png        같은 그림 2배
//   park_fountain-bg-gray-2x.png   명도(흑백) 2배 (ADR-0007 결정 3-6)
//   park_fountain-bg-scene-2x.png  배경 + 물건 멈춘 모습 + 세 사람 시작 위치(배포본 첫 화면과 같은 배치)
//   park_fountain-bg-vs-2x.png     위: 구도 시안 / 아래: 지금 배경 + 물건
// 검사(어기면 종료 코드 1): 480×270, 빈 칸 없음, ink(0)·hint(31) 없음, 배경 PNG ≤ 100KB(결정 8),
//   구도 시안에서 정한 대비 넷(시안 park_fountain-bg-sketch.mjs와 같은 기준, 이제 진짜 배경·물건으로 잰다):
//   - 흙길 주색과 세 사람 주색 명도 차 ≥ 30 (결정 3-4)
//   - 분수대 테두리 돌 주색(물건)과 흙길 주색 차 ≥ 30 (설계 1-1, 단서 ②)
//   - 물줄기 기둥 뒤 배경 주색과 물 밝음(26)·물보라(6) 차 ≥ 60
//   - 재킷 두 자리 뒤 배경 주색과 재킷 주색 차 ≥ 60
//   그리고 명도판에서 동상 몸통이 나무와 붙지 않게: 몸통 왼쪽 가장자리 줄의 밝은 돌(lint·lav) 비율 ≥ 60% (시안 남은 위험)

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C, PALETTE, EMPTY, Image, indexedPng } from '../../../art/lib/pixel.mjs';
import { SCENE, W, H } from '../../../art/scenes/park_fountain.mjs';
import { bg as sketchBg, fg as sketchFg, people } from './park_fountain-bg-sketch.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SCREEN = JSON.parse(readFileSync(join(ROOT, 'content/screens/park_fountain.json'), 'utf8'));
const Y = PALETTE.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b));

const bg = new Image(W, H);
SCENE.bg(bg);
const objs = new Image(W, H);
for (const o of Object.values(SCENE.objects)) o.draw?.(objs); // 효과 자리(water)는 그림이 없다

// ── 검사
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) problems.push(msg); };
const count = (img, x0, y0, w, h) => { const m = new Map(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = img.get(x, y); if (c !== EMPTY) m.set(c, (m.get(c) ?? 0) + 1); } return m; };
const main = (img, x0, y0, w, h) => [...count(img, x0, y0, w, h)].sort((a, b) => b[1] - a[1])[0][0];
const dY = (a, b) => Math.abs(Y[a] - Y[b]);
const all = count(bg, 0, 0, W, H);
check(bg.w === 480 && bg.h === 270, '배경 480×270');
check(!bg.c.includes(EMPTY), '빈 칸 없음(불투명)');
check(!all.has(C.ink) && !all.has(C.hint), '배경에 ink(0)·hint(31) 없음');
const floorMain = main(bg, 0, 214, W, 44);
const PEOPLE = { 'ノビー 셔츠': C.red, 'ノビー 바지': C.dusk, 'ズッシー 멜빵': C.teal, 'ズッシー 셔츠': C.white, 'プピ 우비': C.yel };
for (const [name, c] of Object.entries(PEOPLE)) check(dY(c, floorMain) >= 30, `흙길 주색 #${floorMain}(Y${Y[floorMain]}) vs ${name} #${c}(Y${Y[c]}) 차 ${dY(c, floorMain)} ≥ 30`);
const [fx, fy, fw] = SCREEN.hotspots.fountain.box;
const rimMain = main(objs, fx, fy, fw, 18);
check(dY(rimMain, floorMain) >= 30, `테두리 돌 주색 #${rimMain}(Y${Y[rimMain]}) vs 흙길 차 ${dY(rimMain, floorMain)} ≥ 30`);
const [wx, , ww] = SCENE.objects.water.area;
const columnBack = main(bg, wx + ww / 3, 70, ww / 3, 96);
for (const c of [C.tealL, C.white]) check(dY(c, columnBack) >= 60, `물줄기 뒤 주색 #${columnBack}(Y${Y[columnBack]}) vs 물 #${c}(Y${Y[c]}) 차 ${dY(c, columnBack)} ≥ 60`);
for (const [name, [x, y, w, h]] of [['꼭대기', [214, 18, 20, 12]], ['손 둘레', [248, 100, 26, 26]]]) {
  const back = main(bg, x, y, w, h);
  check(dY(C.pink, back) >= 60, `재킷 #${C.pink}(Y${Y[C.pink]}) vs ${name} 뒤 #${back}(Y${Y[back]}) 차 ${dY(C.pink, back)} ≥ 60`);
}
{
  // 몸통 왼쪽 가장자리: 줄마다 가장 왼쪽 동상 픽셀부터 2px
  let lit = 0, n = 0;
  for (let y = 122; y < 150; y++) {
    const hw = 7 + (y - 118) * 0.3;
    const x0 = Math.ceil(224 - hw - 0.5);
    for (const x of [x0, x0 + 1]) { n++; if ([C.lint, C.lav].includes(bg.get(x, y))) lit++; }
  }
  check(lit / n >= 0.6, `동상 몸통 왼쪽 빛 ${lit}/${n} (${Math.round((lit / n) * 100)}%) ≥ 60%`);
}
const png1 = indexedPng(bg, 1);
check(png1.length <= 100 * 1024, `배경 PNG ${(png1.length / 1024).toFixed(1)}KB ≤ 100KB`);
console.log(`배경 색 수: ${all.size}`);

// ── 출력
const scene = new Image(W, H);
scene.blit(bg, 0, 0); scene.blit(objs, 0, 0); scene.blit(people, 0, 0);
const gray = (img, S, file) => {
  const w = img.w * S, h = img.h * S;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Y[img.get(Math.floor(x / S), Math.floor(y / S))];
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const k = Buffer.alloc(4); k.writeUInt32BE(crc(td)); return Buffer.concat([l, td, k]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  writeFileSync(join(HERE, file), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
};
writeFileSync(join(HERE, 'park_fountain-bg-1x.png'), png1);
writeFileSync(join(HERE, 'park_fountain-bg-2x.png'), indexedPng(bg, 2));
writeFileSync(join(HERE, 'park_fountain-bg-scene-2x.png'), indexedPng(scene, 2));
gray(scene, 2, 'park_fountain-bg-gray-2x.png');
{
  const vs = new Image(W, H * 2 + 4, C.dusk);
  vs.blit(sketchBg, 0, 0); vs.blit(sketchFg, 0, 0); vs.blit(people, 0, 0); vs.blit(scene, 0, H + 4);
  writeFileSync(join(HERE, 'park_fountain-bg-vs-2x.png'), indexedPng(vs, 2));
}
if (problems.length) { console.error(`${problems.length}개 검사 실패`); process.exit(1); }
