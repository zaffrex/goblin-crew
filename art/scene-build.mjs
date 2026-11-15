// 화면 배경·물건 시트 만들기 + 검사 (형식: docs/decisions/2026-11-16-scene-art-format-v1.md, #157 10절 1단계).
// art/build.mjs가 부른다. 파일을 쓰지 않는 순수 함수라 tests/art/scenes.test.ts가 가짜 장면으로 검사를 확인한다.
//
// buildScene(SCENE, screen) → { problems, bg, objects, meta }
//   SCENE  : art/scenes/<화면>.mjs의 SCENE
//   screen : content/screens/<화면>.json (히트 박스·플래그·ID의 진실)
//   problems가 비어 있지 않으면 build.mjs가 실패한다(형식 기록 8절).
//
// 물건 그림은 480×270 투명 화면에 제자리로 그린다(3절). 여기서 불투명 영역을 잘라 시트에 붙이고 `at`(화면 좌표)을 적는다.

import { Image, C, EMPTY, indexedPng } from './lib/pixel.mjs';

export const SCREEN_W = 480, SCREEN_H = 270;
export const BG_MAX_BYTES = 100 * 1024; // ADR-0007 결정 8
export const ANIM_MAX_MS = 1500; // 형식 기록 8절: anim ms 합 상한(busy 길이)
const SHEET_MAX_W = 512; // 시트 한 줄 폭. 넘으면 다음 줄(선반 쌓기)

const LAYERS = ['back', 'front'];
const OBJECT_KEYS = ['ids', 'draw', 'loop', 'layer', 'states', 'overlay'];
const STATE_KEYS = ['when', 'draw', 'loop', 'layer'];
const OVERLAY_KEYS = ['sortY', 'draw'];
const ANIM_KEYS = ['ms', 'frames', 'layer'];
const LOOP_KEYS = ['ms', 'frames'];

/** 화면 JSON의 [x, y, w, h] 두 개가 겹치나 */
const overlaps = (a, b) => a.x < b[0] + b[2] && b[0] < a.x + a.w && a.y < b[1] + b[3] && b[1] < a.y + a.h;

/** Image의 불투명 영역 */
function bbox(img) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.c[y * img.w + x] !== EMPTY) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(img, b) {
  const o = new Image(b.w, b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) o.c[y * b.w + x] = img.c[(b.y + y) * img.w + b.x + x];
  return o;
}

/** 그림에 그 색이 있나 */
function hasColor(img, col) {
  return img.c.includes(col);
}

/** `when` 플래그를 적용했을 때 그 대상의 히트 박스(hotspot `variants`는 첫 일치, src/core/interact.ts hotspotBox와 같은 규칙) */
function boxFor(screen, id, flags) {
  const hs = screen.hotspots?.[id];
  if (hs) {
    const v = hs.variants?.find((variant) => Object.entries(variant.when.flags).every(([k, val]) => flags[k] === val));
    return v?.box ?? hs.box;
  }
  return screen.spots?.[id]?.box ?? null;
}

/** ms(정수 하나 또는 프레임별 배열) → 프레임별 배열. 틀리면 problems에 적고 null */
function normMs(ms, n, where, problems) {
  const arr = Array.isArray(ms) ? ms : Array.from({ length: n }, () => ms);
  if (Array.isArray(ms) && ms.length !== n) {
    problems.push(`${where}: ms 배열 길이 ${ms.length} ≠ frames ${n}`);
    return null;
  }
  if (!arr.every((v) => Number.isInteger(v) && v > 0)) {
    problems.push(`${where}: ms는 양의 정수여야 한다 (${JSON.stringify(ms)})`);
    return null;
  }
  return arr;
}

function unknownKeys(obj, allowed, where, problems) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) problems.push(`${where}: 모르는 필드 '${k}' (쓸 수 있는 것: ${allowed.join(', ')})`);
}

/**
 * @param {object} SCENE art/scenes/<화면>.mjs의 SCENE
 * @param {object} screen content/screens/<화면>.json
 * @param {{ bgMaxBytes?: number }} [opts] 테스트용. 32색 인덱스 PNG는 480×270에서 약 80KB를 넘기 어려워 상한을 낮춰 검사를 확인한다.
 */
export function buildScene(SCENE, screen, { bgMaxBytes = BG_MAX_BYTES } = {}) {
  const problems = [];
  const id = SCENE.id;
  if (id !== screen.id) problems.push(`SCENE.id '${id}' ≠ 화면 JSON id '${screen.id}'`);
  const screenFlags = screen.flags ?? {};
  const knownIds = new Set([...Object.keys(screen.hotspots ?? {}), ...Object.keys(screen.spots ?? {})]);

  // ── 배경(8절: 480×270, 불투명, ink·hint 없음, PNG ≤ 100KB)
  const bg = new Image(SCREEN_W, SCREEN_H);
  SCENE.bg(bg);
  if (bg.c.includes(EMPTY)) problems.push('배경: 칠하지 않은 칸(투명)이 있다');
  if (hasColor(bg, C.ink)) problems.push('배경: 0번 ink 픽셀이 있다(ADR-0007 결정 3-1, 만질 수 있는 것 전용)');
  if (hasColor(bg, C.hint)) problems.push('배경: 31번 hint 픽셀이 있다(ADR-0007 결정 3-1, 호버 강조 전용)');
  const bgPng = indexedPng(bg);
  if (bgPng.length > bgMaxBytes) problems.push(`배경 PNG ${(bgPng.length / 1024).toFixed(1)}KB > ${(bgMaxBytes / 1024).toFixed(0)}KB(ADR-0007 결정 8)`);

  // ── 그림 한 장 그리기 → 잘라서 프레임 목록에 넣기
  const pics = []; // { img, at: [x, y], where }
  /** draw(img)를 투명 화면에 그려서 프레임 번호를 돌려준다. boxes가 비어 있지 않으면 불투명 영역이 그중 하나와 겹쳐야 한다(모르는 ID는 이미 따로 잡는다). */
  function picture(draw, where, boxes) {
    if (typeof draw !== 'function') {
      problems.push(`${where}: draw가 함수가 아니다`);
      return -1;
    }
    const full = new Image(SCREEN_W, SCREEN_H);
    draw(full);
    const b = bbox(full);
    if (!b) {
      problems.push(`${where}: 아무것도 그리지 않았다`);
      return -1;
    }
    if (hasColor(full, C.hint)) problems.push(`${where}: 31번 hint 픽셀이 있다(호버 외곽선은 엔진이 만든다)`);
    if (boxes?.length && !boxes.some((box) => box && overlaps(b, box)))
      problems.push(`${where}: 그림 [${b.x},${b.y},${b.w},${b.h}]이 히트 박스 ${boxes.map((x) => `[${x}]`).join(' / ')}와 겹치지 않는다`);
    pics.push({ img: crop(full, b), at: [b.x, b.y], where });
    return pics.length - 1;
  }

  function layerOf(v, where) {
    if (v === undefined) return 'back';
    if (!LAYERS.includes(v)) problems.push(`${where}: layer '${v}'는 back/front만 된다`);
    return v;
  }

  function loopOf(loop, where, boxes) {
    if (loop === undefined) return undefined;
    unknownKeys(loop, LOOP_KEYS, where, problems);
    if (!Array.isArray(loop.frames) || loop.frames.length === 0) {
      problems.push(`${where}: frames가 비었다`);
      return undefined;
    }
    const frames = loop.frames.map((d, i) => picture(d, `${where}[${i}]`, boxes));
    const ms = normMs(loop.ms, frames.length, where, problems);
    return ms ? { frames, ms } : undefined;
  }

  // ── 물건(2·3·4·5·6절)
  const owner = new Map(); // 대상 ID → 물건 키
  const objects = [];
  for (const [key, o] of Object.entries(SCENE.objects ?? {})) {
    const w = `objects.${key}`;
    unknownKeys(o, OBJECT_KEYS, w, problems);
    const ids = o.ids ?? [key];
    if (!Array.isArray(ids) || ids.length === 0) {
      problems.push(`${w}: ids는 비어 있지 않은 배열이어야 한다`);
      continue;
    }
    for (const t of ids) {
      if (!knownIds.has(t)) problems.push(`${w}: '${t}'는 화면 JSON의 hotspot·spot ID가 아니다`);
      if (owner.has(t)) problems.push(`${w}: '${t}'를 '${owner.get(t)}'도 맡는다(한 ID는 물건 하나만)`);
      owner.set(t, key);
    }
    const boxesAt = (flags) => ids.map((t) => boxFor(screen, t, flags)).filter(Boolean);

    const baseBoxes = boxesAt(screenFlags);
    const def = { frame: picture(o.draw, `${w}.draw`, baseBoxes), layer: layerOf(o.layer, w) };
    const defLoop = loopOf(o.loop, `${w}.loop`, baseBoxes);
    if (defLoop) def.loop = defLoop;

    const states = [];
    for (const [i, s] of (o.states ?? []).entries()) {
      const sw = `${w}.states[${i}]`;
      unknownKeys(s, STATE_KEYS, sw, problems);
      const flags = s.when?.flags;
      if (!flags || typeof flags !== 'object' || Object.keys(s.when).some((k) => k !== 'flags')) {
        problems.push(`${sw}: when은 { flags: {...} } 모양이어야 한다(hotspot variants와 같다)`);
        continue;
      }
      for (const f of Object.keys(flags)) if (!(f in screenFlags)) problems.push(`${sw}: 플래그 '${f}'가 화면 JSON flags에 없다`);
      const boxes = boxesAt({ ...screenFlags, ...flags });
      const st = { when: { flags }, frame: picture(s.draw, `${sw}.draw`, boxes), layer: layerOf(s.layer, sw) };
      const lp = loopOf(s.loop, `${sw}.loop`, boxes);
      if (lp) st.loop = lp;
      states.push(st);
    }

    const out = { key, ids, default: def };
    if (states.length) out.states = states;
    if (o.overlay !== undefined) {
      const ow = `${w}.overlay`;
      unknownKeys(o.overlay, OVERLAY_KEYS, ow, problems);
      const sy = o.overlay.sortY;
      if (!Number.isInteger(sy)) problems.push(`${ow}: sortY는 정수여야 한다`);
      else if (!baseBoxes.some(([, by, , bh]) => by <= sy && sy <= by + bh))
        problems.push(`${ow}: sortY ${sy}가 히트 박스 세로 범위(${baseBoxes.map(([, by, , bh]) => `${by}~${by + bh}`).join(' / ')}) 밖이다`);
      out.overlay = { sortY: sy, frame: picture(o.overlay.draw, `${ow}.draw`, baseBoxes) };
    }
    objects.push(out);
  }

  // ── 일시 연출(4·5절). 대상은 어떤 물건의 ID, ms 합 ≤ 1500. 연출은 움직이므로 히트 박스 겹침은 보지 않는다.
  const anims = {};
  for (const [name, a] of Object.entries(SCENE.anims ?? {})) {
    const w = `anims['${name}']`;
    unknownKeys(a, ANIM_KEYS, w, problems);
    const dot = name.indexOf('.');
    const target = dot > 0 ? name.slice(0, dot) : '';
    if (!target || dot === name.length - 1) {
      problems.push(`${w}: 키는 '대상.이름' 모양이어야 한다`);
      continue;
    }
    if (!owner.has(target)) problems.push(`${w}: 대상 '${target}'을 맡은 물건이 없다(objects 키 또는 ids)`);
    if (!Array.isArray(a.frames) || a.frames.length === 0) {
      problems.push(`${w}: frames가 비었다`);
      continue;
    }
    const frames = a.frames.map((d, i) => picture(d, `${w}[${i}]`, null));
    const ms = normMs(a.ms, frames.length, w, problems);
    if (ms) {
      const sum = ms.reduce((s, v) => s + v, 0);
      if (sum > ANIM_MAX_MS) problems.push(`${w}: ms 합 ${sum} > ${ANIM_MAX_MS}(busy 길이 상한, 넘으면 L1로 올린다)`);
    }
    anims[name] = { object: owner.get(target) ?? null, frames, ms: ms ?? [], layer: layerOf(a.layer, w) };
  }

  // ── 시트: 선반 쌓기(왼쪽 → 오른쪽, 폭 512 넘으면 다음 줄). 그림 순서는 위에서 만든 순서라 결정적이다.
  let sheet = null;
  const frames = [];
  if (pics.length) {
    let x = 0, y = 0, rowH = 0, sheetW = 0;
    for (const p of pics) {
      if (x > 0 && x + p.img.w > SHEET_MAX_W) {
        y += rowH;
        x = 0;
        rowH = 0;
      }
      frames.push({ src: [x, y, p.img.w, p.img.h], at: p.at });
      p.sx = x;
      p.sy = y;
      x += p.img.w;
      rowH = Math.max(rowH, p.img.h);
      sheetW = Math.max(sheetW, x);
    }
    sheet = new Image(sheetW, y + rowH);
    for (const p of pics) sheet.blit(p.img, p.sx, p.sy);
  }

  const meta = sheet && {
    '//': `node art/build.mjs로 만든 파일. 직접 고치지 않는다. 원본: art/scenes/${id}.mjs. 형식: docs/decisions/2026-11-16-scene-art-format-v1.md. frames[i].src = 시트 안 [x,y,w,h], at = 화면 좌표(왼쪽 위).`,
    image: `${id}-objects.png`,
    screen: id,
    frames,
    objects,
    anims,
  };

  return { problems, draft: SCENE.draft === true, bg, bgPng, sheet, meta };
}
