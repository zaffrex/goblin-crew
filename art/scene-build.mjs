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
const OBJECT_KEYS = ['ids', 'draw', 'loop', 'layer', 'states', 'overlay', 'tilt', 'noFloor'];
const TILT_KEYS = ['rest', 'weight', 'pivot', 'run', 'draw'];
const NO_FLOOR_KEYS = ['box', 'y'];
const STATE_KEYS = ['when', 'draw', 'loop', 'layer'];
const OVERLAY_KEYS = ['sortY', 'draw'];
const ANIM_KEYS = ['ms', 'frames', 'layer', 'tilt', 'variants'];
const VARIANT_KEYS = ['when', 'ms', 'frames', 'layer', 'tilt'];
const LOOP_KEYS = ['ms', 'frames'];
// 11절(개정 4): 효과 자리와 효과 anim
const FX_OBJECT_KEYS = ['effect', 'area', 'colors', 'mode', 'states'];
const FX_STATE_KEYS = ['when', 'mode'];
const FX_ANIM_KEYS = ['effect', 'mode', 'ms'];
/**
 * 엔진 효과 표(src/core/sceneFx.ts `SCENE_FX`)의 모드 이름. 빌드는 TS를 못 읽어서 같은 표를 여기 둔다.
 * 두 표가 같은지는 src/core/sceneFx.test.ts가 본다. still = 멈춘 모드(default·state), play = 연출 모드(효과 anim).
 */
export const FX_MODES = {
  fountain_water: { still: ['on', 'off'], play: ['stop', 'burst'] },
};

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
    const img = crop(full, b);
    // 같은 자리·같은 픽셀이면 한 장으로 합친다(반복 첫 칸 = 멈춘 모습인 경우가 많다, PR #165 리뷰).
    const same = pics.findIndex((p) => p.at[0] === b.x && p.at[1] === b.y && p.img.w === img.w && p.img.h === img.h && p.img.c.every((v, i) => v === img.c[i]));
    if (same >= 0) return same;
    pics.push({ img, at: [b.x, b.y], where });
    return pics.length - 1;
  }

  function layerOf(v, where) {
    if (v === undefined) return 'back';
    if (!LAYERS.includes(v)) problems.push(`${where}: layer '${v}'는 back/front만 된다`);
    return v;
  }

  /** 형식 기록 4절(개정 3): 반복 첫 칸 = 멈춘 모습. anim 끝·상태 변경 때 반복을 0부터 세므로(#237) 다르면 도착 순간 다른 그림이 튄다. */
  function loopStartsAtRest(lp, frame, where) {
    if (lp && frame >= 0 && lp.frames[0] >= 0 && lp.frames[0] !== frame)
      problems.push(`${where}[0]: 반복 첫 칸이 멈춘 모습(draw)과 다르다. 첫 칸은 draw와 같은 자리·같은 픽셀로 그린다(4절)`);
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

  /** state `when`이 { flags } 모양이고 플래그가 화면 JSON에 있나. 틀리면 problems에 적고 null */
  function whenFlags(when, where) {
    const flags = when?.flags;
    if (!flags || typeof flags !== 'object' || Object.keys(when).some((k) => k !== 'flags')) {
      problems.push(`${where}: when은 { flags: {...} } 모양이어야 한다(hotspot variants와 같다)`);
      return null;
    }
    for (const f of Object.keys(flags)) if (!(f in screenFlags)) problems.push(`${where}: 플래그 '${f}'가 화면 JSON flags에 없다`);
    return flags;
  }

  // ── 효과 자리(11절, 개정 4): 그림·ID가 없고, 좌표(area)를 적는 유일한 물건. 늘 back, 적은 순서 자리에서 그린다.
  function fxObject(key, o, w) {
    unknownKeys(o, FX_OBJECT_KEYS, w, problems);
    const fx = FX_MODES[o.effect];
    if (!fx) problems.push(`${w}: effect '${o.effect}'는 엔진 효과 표에 없다(${Object.keys(FX_MODES).join(', ')})`);
    const { area, colors } = o;
    if (!Array.isArray(area) || area.length !== 4 || !area.every(Number.isInteger) || area[2] <= 0 || area[3] <= 0)
      problems.push(`${w}: area는 [x, y, w, h] 정수(w·h > 0)`);
    else if (area[0] < 0 || area[1] < 0 || area[0] + area[2] > SCREEN_W || area[1] + area[3] > SCREEN_H)
      problems.push(`${w}: area [${area}]가 ${SCREEN_W}×${SCREEN_H} 밖으로 나간다`);
    if (!Array.isArray(colors) || colors.length !== 4 || !colors.every((c) => Number.isInteger(c) && c >= 0 && c < 32) || new Set(colors).size !== 4)
      problems.push(`${w}: colors는 bosong-32 번호(0~31) 서로 다른 4개`);
    else if (colors.includes(C.ink) || colors.includes(C.hint)) problems.push(`${w}: colors에 0번 ink·31번 hint는 못 쓴다(ADR-0007 결정 3-1)`);
    const still = (mode, where) => {
      if (fx && !fx.still.includes(mode)) problems.push(`${where}: mode '${mode}'는 ${o.effect}의 멈춘 모드(${fx.still.join(', ')})가 아니다`);
    };
    still(o.mode, w);
    const states = [];
    for (const [i, s] of (o.states ?? []).entries()) {
      const sw = `${w}.states[${i}]`;
      unknownKeys(s, FX_STATE_KEYS, sw, problems);
      const flags = whenFlags(s.when, sw);
      if (!flags) continue;
      still(s.mode, sw);
      states.push({ when: { flags }, mode: s.mode });
    }
    const out = { key, ids: [], effect: o.effect, area, colors, default: { mode: o.mode } };
    if (states.length) out.states = states;
    return out;
  }

  // ── 물건(2·3·4·5·6절)
  const owner = new Map(); // 대상 ID → 물건 키
  const objects = [];
  const fxSlots = new Map(); // 효과 자리 키 → 효과 이름
  for (const [key, o] of Object.entries(SCENE.objects ?? {})) {
    const w = `objects.${key}`;
    if (o.effect !== undefined) {
      objects.push(fxObject(key, o, w));
      fxSlots.set(key, o.effect);
      continue;
    }
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
    loopStartsAtRest(defLoop, def.frame, `${w}.loop`);

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
      loopStartsAtRest(lp, st.frame, `${sw}.loop`);
      states.push(st);
    }

    const out = { key, ids, default: def };
    if (states.length) out.states = states;
    if (o.overlay !== undefined) {
      const ow = `${w}.overlay`;
      unknownKeys(o.overlay, OVERLAY_KEYS, ow, problems);
      const sy = o.overlay.sortY;
      const frame = picture(o.overlay.draw, `${ow}.draw`, baseBoxes);
      if (!Number.isInteger(sy)) problems.push(`${ow}: sortY는 정수여야 한다`);
      else if (!baseBoxes.some(([, by, , bh]) => by <= sy && sy <= by + bh))
        problems.push(`${ow}: sortY ${sy}가 히트 박스 세로 범위(${baseBoxes.map(([, by, , bh]) => `${by}~${by + bh}`).join(' / ')}) 밖이다`);
      // 6절 개정 1: 앞판 불투명 영역은 발 위 10px 이하(위 끝 ≥ sortY − 11). sortY가 틀렸으면 위에서 이미 잡았다.
      else if (frame >= 0 && pics[frame].at[1] < sy - 11)
        problems.push(`${ow}: 그림 위 끝 y ${pics[frame].at[1]} < sortY − 11(${sy - 11}). 앞판은 발 위 10px 이하만 가린다(6절)`);
      out.overlay = { sortY: sy, frame };
    }
    // 12절(개정 5·7): 멈춘 기울기. 키 = 기울기 d(−rest 또는 rest), 값 = 그 그림. 0은 멈춘 모습 그대로다.
    if (o.tilt !== undefined) {
      const tw = `${w}.tilt`;
      unknownKeys(o.tilt, TILT_KEYS, tw, problems);
      const { rest, weight, pivot, run } = o.tilt;
      if (!Number.isInteger(rest) || rest <= 0) problems.push(`${tw}: rest는 양의 정수여야 한다`);
      if (typeof pivot !== 'number' || !Number.isFinite(pivot)) problems.push(`${tw}: pivot은 수여야 한다`);
      if (!Number.isInteger(run) || run <= 0) problems.push(`${tw}: run은 양의 정수여야 한다`);
      if (!weight || typeof weight !== 'object' || Object.values(weight).some((v) => !Number.isInteger(v) || v <= 0))
        problems.push(`${tw}: weight는 { 캐릭터 ID: 양의 정수 }여야 한다`);
      if (ids.filter((t) => screen.spots?.[t]?.board).length === 0) problems.push(`${tw}: ids 중 board 자리가 없다(올라탈 끝이 없음)`);
      const frames = {};
      for (const [k, d] of Object.entries(o.tilt.draw ?? {})) {
        const n = Number(k);
        if (Math.abs(n) !== rest) problems.push(`${tw}.draw['${k}']: 키는 −rest 또는 rest여야 한다`);
        frames[k] = picture(d, `${tw}.draw['${k}']`, baseBoxes);
      }
      if (Number.isInteger(rest)) for (const need of [-rest, rest]) if (!(String(need) in frames)) problems.push(`${tw}.draw: '${need}' 칸이 없다(쉬는 판 두 장)`);
      out.tilt = { rest, weight, pivot, run, frames };
    }
    // 12절(개정 5): 바닥 걷기 목표가 box 안이면 y로 옮긴다(판 밑에 서지 않게). y는 box 밖, 걷기 영역 안이어야 한다(엔진이 영역으로 자른다).
    if (o.noFloor !== undefined) {
      const nw = `${w}.noFloor`;
      unknownKeys(o.noFloor, NO_FLOOR_KEYS, nw, problems);
      const { box, y } = o.noFloor;
      if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isInteger) || box[2] <= 0 || box[3] <= 0) problems.push(`${nw}: box는 [x, y, w, h] 정수`);
      else if (!Number.isInteger(y) || (y >= box[1] && y < box[1] + box[3])) problems.push(`${nw}: y는 box 세로 범위 밖의 정수여야 한다`);
      out.noFloor = { box, y };
    }
    objects.push(out);
  }

  // ── 일시 연출(4·5절). 대상은 어떤 물건의 ID, ms 합 ≤ 1500. 연출은 움직이므로 히트 박스 겹침은 보지 않는다.
  const anims = {};
  const tiltKeys = new Set(objects.filter((o) => o.tilt).map((o) => o.key));
  for (const [name, a] of Object.entries(SCENE.anims ?? {})) {
    const w = `anims['${name}']`;
    const isFx = a.effect !== undefined;
    unknownKeys(a, isFx ? FX_ANIM_KEYS : ANIM_KEYS, w, problems);
    const dot = name.indexOf('.');
    const target = dot > 0 ? name.slice(0, dot) : '';
    if (!target || dot === name.length - 1) {
      problems.push(`${w}: 키는 '대상.이름' 모양이어야 한다`);
      continue;
    }
    // 11-3절: 효과 anim. 키의 대상은 화면 JSON의 hotspot·spot ID(물건 ID가 아니어도 된다), 바꾸는 것은 effect가 가리키는 효과 자리.
    if (isFx) {
      if (!knownIds.has(target)) problems.push(`${w}: 대상 '${target}'는 화면 JSON의 hotspot·spot ID가 아니다`);
      const fx = FX_MODES[fxSlots.get(a.effect)];
      if (!fxSlots.has(a.effect)) problems.push(`${w}: effect '${a.effect}'는 효과 자리 키가 아니다(${[...fxSlots.keys()].join(', ') || '효과 자리 없음'})`);
      else if (fx && !fx.play.includes(a.mode)) problems.push(`${w}: mode '${a.mode}'는 ${fxSlots.get(a.effect)}의 연출 모드(${fx.play.join(', ')})가 아니다`);
      if (!Number.isInteger(a.ms) || a.ms <= 0) problems.push(`${w}: 효과 anim ms는 양의 정수 하나(길이)`);
      else if (a.ms > ANIM_MAX_MS) problems.push(`${w}: ms ${a.ms} > ${ANIM_MAX_MS}(busy 길이 상한, 넘으면 L1로 올린다)`);
      anims[name] = { object: fxSlots.has(a.effect) ? a.effect : null, frames: [], ms: [a.ms], layer: 'back', mode: a.mode };
      continue;
    }
    if (!owner.has(target)) problems.push(`${w}: 대상 '${target}'을 맡은 물건이 없다(objects 키 또는 ids)`);
    if (!Array.isArray(a.frames) || a.frames.length === 0) {
      problems.push(`${w}: frames가 비었다`);
      continue;
    }
    const one = (src, where) => {
      const frames = src.frames.map((d, i) => picture(d, `${where}[${i}]`, null));
      const ms = normMs(src.ms, frames.length, where, problems);
      if (ms) {
        const sum = ms.reduce((s, v) => s + v, 0);
        if (sum > ANIM_MAX_MS) problems.push(`${where}: ms 합 ${sum} > ${ANIM_MAX_MS}(busy 길이 상한, 넘으면 L1로 올린다)`);
      }
      const res = { frames, ms: ms ?? [], layer: layerOf(src.layer, where) };
      // 12-5절(개정 6): 칸별 기울기 d. 판 위 발이 그 칸의 판 높이를 따른다. 기울기 물건의 anim만, 칸 수와 같은 길이의 정수.
      if (src.tilt !== undefined) {
        if (!tiltKeys.has(owner.get(target))) problems.push(`${where}.tilt: 대상 물건에 tilt가 없다(칸별 기울기는 기울기 물건 anim만)`);
        else if (!Array.isArray(src.tilt) || src.tilt.length !== frames.length || !src.tilt.every(Number.isInteger))
          problems.push(`${where}.tilt: frames와 같은 길이(${frames.length})의 정수 배열이어야 한다`);
        else res.tilt = [...src.tilt];
      }
      return res;
    };
    const out = { object: owner.get(target) ?? null, ...one(a, w) };
    // 4-1절(개정 1): 갈래는 첫 일치, 없으면 기본. 갈래 layer는 기본을 물려받지 않는다(없으면 back).
    if (a.variants !== undefined) {
      const variants = [];
      for (const [i, v] of (Array.isArray(a.variants) ? a.variants : []).entries()) {
        const vw = `${w}.variants[${i}]`;
        unknownKeys(v, VARIANT_KEYS, vw, problems);
        const flags = v.when?.flags;
        if (!flags || typeof flags !== 'object' || Object.keys(v.when).some((k) => k !== 'flags')) {
          problems.push(`${vw}: when은 { flags: {...} } 모양이어야 한다(hotspot variants와 같다)`);
          continue;
        }
        for (const f of Object.keys(flags)) if (!(f in screenFlags)) problems.push(`${vw}: 플래그 '${f}'가 화면 JSON flags에 없다`);
        if (!Array.isArray(v.frames) || v.frames.length === 0) {
          problems.push(`${vw}: frames가 비었다`);
          continue;
        }
        variants.push({ when: { flags }, ...one(v, vw) });
      }
      if (!Array.isArray(a.variants) || variants.length === 0) problems.push(`${w}: variants는 비어 있지 않은 배열이어야 한다`);
      else out.variants = variants;
    }
    anims[name] = out;
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
    // 배경 PNG 파일 이름. draft면 null(내보내지 않음 → 엔진은 임시 방을 그린다, 9절). 엔진은 이 값으로만 배경을 요청한다(404 방지).
    bg: SCENE.draft === true ? null : `${id}-bg.png`,
    screen: id,
    frames,
    objects,
    anims,
  };

  return { problems, draft: SCENE.draft === true, bg, bgPng, sheet, meta };
}
