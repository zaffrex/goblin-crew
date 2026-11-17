// 스프라이트 시트 생성 (ADR-0007 결정 7·8). 원본은 art/ 아래 텍스트, 출력 PNG·JSON은 커밋한다.
// 화면 배경·물건 시트(public/scenes/)도 여기서 만든다(art/scene-build.mjs, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md).
// HUD 동사 아이콘 시트(public/ui/hud-icons.*)도 여기서 만든다(art/ui/hud-icons.mjs, 규격: docs/design/ui-interaction.md 6-1-2절).
// 실행:
//   node art/build.mjs          시트(public/sprites/, public/scenes/)와 미리보기(docs/design/art/)를 다시 만든다
//   node art/build.mjs --check  다시 만들었을 때 커밋된 시트와 바이트가 다르면 실패한다(npm test에서 부른다)
// 화면 검사(형식 기록 8절)는 두 모드 모두 돈다. 어기면 실패한다.
// 화면 SCENE.draft가 true면 배경 PNG를 내보내지 않는다(엔진은 drawRoom 폴백). 물건 시트는 draft와 상관없이 내보낸다.
//
// 시트 하나 = 가로 한 줄. 프레임 순서는 anims 순서대로 이어 붙인다.
// 검사(어기면 오류): 칸은 16의 배수, 서 있기 0번에서 두 발 폭(외곽선 포함)은 짝수, 딛은 발의 맨 아랫줄은 칸의 마지막 행.

import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { Image, C, EMPTY, HEX, indexedPng, animatedPng } from './lib/pixel.mjs';
import { SHEET as JJUK, HEAD_BOX as JJUK_HEAD } from './sprites/jjuk-v4.mjs';
import { SHEET as MUKJIK, HEAD_BOX as MUKJIK_HEAD } from './sprites/mukjik.mjs';
import { SHEET as PPIK, HEAD_BOX as PPIK_HEAD } from './sprites/ppik.mjs';
import { SCENE as MAGPIE_NEST } from './scenes/magpie_nest.mjs';
import { buildScene } from './scene-build.mjs';
import { clippedEdge } from './lib/finish.mjs';
import { buildIcons, previewIcons } from './ui/hud-icons-build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'sprites');
const PREVIEW = join(ROOT, 'docs', 'design', 'art');
const SHEETS = [{ ...JJUK, head: JJUK_HEAD }, { ...MUKJIK, head: MUKJIK_HEAD }, { ...PPIK, head: PPIK_HEAD }];
const SCENE_OUT = join(ROOT, 'public', 'scenes');
const SCENES = [MAGPIE_NEST];
const UI_OUT = join(ROOT, 'public', 'ui');

function fail(msg) {
  throw new Error(`[art] ${msg}`);
}

/** 신발 부품 픽셀의 가로 범위 + 바깥 외곽선 1px씩 */
function feetSpan(K, feet) {
  let x0 = Infinity, x1 = -Infinity, y1 = -1;
  for (let y = 0; y < K.h; y++)
    for (let x = 0; x < K.w; x++)
      if (feet.includes(K.p[y * K.w + x]) && K.get(x, y) !== EMPTY) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  return { x0: x0 - 1, x1: x1 + 1, bottom: y1 + 1 };
}

/** 그림 상자 여러 개의 합집합 [x, y, w, h]. 최소 클릭 크기(characters.ts MIN_HIT_SIZE 24)보다 작으면 실패한다. */
function unionBox(boxes) {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  if (x1 - x0 < 24 || y1 - y0 < 24) fail(`매달린 자세 그림 상자 ${x1 - x0}×${y1 - y0}가 최소 클릭 크기 24×24보다 작다`);
  return [x0, y0, x1 - x0, y1 - y0];
}

function buildSheet(def) {
  const [cw, ch] = def.cell ?? [48, 64];
  if (cw % 16 || ch % 16) fail(`${def.name}: 칸 ${cw}×${ch}는 16의 배수가 아니다`);
  const frames = [];
  const anims = {};
  for (const a of def.anims) {
    const start = frames.length;
    for (let k = 0; k < a.frames; k++) {
      const p = def.pose(a.name, k);
      const f = def.drawFrame(p);
      f.anim = a.name;
      f.k = k;
      f.pose = p;
      frames.push(f);
    }
    const idx = Array.from({ length: a.frames }, (_, i) => start + i);
    anims[a.name] = a.by === 'distance' ? { frames: idx, by: 'distance' } : { frames: idx, ms: a.ms };
    // 칸 신호(시트 파이프라인 기록 5-2절, #199): show에서 이 연출 바로 뒤의 fx가 뜨는 칸. 칸 순서만 적고 fx 이름은 모른다.
    // 오름차순 배열이면 신호가 여럿이다(`ability-feedback.md` 4절, #284): k번째 신호 = 이어진 fx 중 k번째.
    if (a.cue !== undefined) {
      const cues = Array.isArray(a.cue) ? a.cue : [a.cue];
      const ok = cues.length > 0 && cues.every((c, i) => Number.isInteger(c) && c >= 0 && c < a.frames && (i === 0 || c > cues[i - 1]));
      if (a.by === 'distance' || !ok) fail(`${def.name} ${a.name}: cue는 ms 자세의 칸 순서(0~${a.frames - 1}) 하나 또는 오름차순 배열이어야 한다`);
      anims[a.name].cue = a.cue;
    }
    // 매달린 자세(hold)는 손 기준점을 메타에 적는다(형식 기록 7절). 프레임마다 같아야 고리에서 손이 안 미끄러진다.
    const hands = idx.map((i) => frames[i].hand).filter(Boolean);
    if (a.name === 'hold' && hands.length !== a.frames) fail(`${def.name} hold: 프레임마다 손 기준점(hand)이 있어야 한다`);
    if (hands.length) {
      if (hands.some((h) => h[0] !== hands[0][0] || h[1] !== hands[0][1])) fail(`${def.name} ${a.name}: 프레임마다 손 기준점이 다르다 ${JSON.stringify(hands)}`);
      anims[a.name].hand = hands[0];
      // 매달린 동안 고정할 방향(1 오른쪽 / -1 왼쪽). 손 기준점은 이 방향으로 그렸을 때 맞춘다.
      const facing = frames[idx[0]].facing;
      if (facing !== 1 && facing !== -1) fail(`${def.name} ${a.name}: 손 기준점이 있으면 facing(1 또는 -1)이 있어야 한다`);
      anims[a.name].facing = facing;
      // 매달린 자세는 서 있기 hit과 몸 위치가 달라서(후드로 높이 매달린 삑삑이) 이 자세 모든 칸 그림 상자의 합집합을
      // 클릭 상자로 적는다(#203). 엔진은 이 자세를 그리는 동안 서 있기 hit 대신 이 값을 쓴다.
      anims[a.name].hit = unionBox(idx.map((i) => frames[i].K.bbox()));
    }
    // 칸 위로 나가는 장대(reach_hang_up 등): 프레임별 출구 점과 집게 칸(#187 Theo 초안, 시트 파이프라인 기록 5-1절).
    // 엔진은 tip에서 대상 점까지 장대를 잇고 끝에 claw 칸을 그린다. tip 없는 칸은 tip·claw·joint가 null이다(#284: reach_wobble
    // 3번 칸처럼 장대가 넘어와 칸 안에 들어온 칸). 대신 첫 칸에는 tip이 있어야 한다(엔진이 연출 시작부터 늘리기 시작한다).
    const tips = idx.map((i) => frames[i].tip ?? null);
    if (tips.some(Boolean)) {
      if (!tips[0]) fail(`${def.name} ${a.name}: 장대 tip은 첫 칸에 있어야 한다`);
      const claws = idx.map((i, j) => (tips[j] ? frames[i].claw : null));
      if (!claws.every((c, j) => !tips[j] || (Number.isInteger(c) && c >= 0 && c < (def.claw?.frames ?? 0)))) fail(`${def.name} ${a.name}: tip 있는 칸마다 claw 칸 번호가 필요하다`);
      anims[a.name].tip = tips;
      anims[a.name].claw = claws;
      // 대상 점 몇 px 아래에서 장대 끝(집게 기준점)이 멈추는가(#284, 실패 연출 "모자람"). 없으면 대상 점까지 닿는다.
      if (a.short !== undefined) {
        if (!Number.isInteger(a.short) || a.short < 0) fail(`${def.name} ${a.name}: short는 0 이상 정수 px`);
        anims[a.name].short = a.short;
      }
      // 마디 위상(#194, ADR-0007 장대 3조각 8px): 칸 0행부터 첫 마디 행까지 px. 엔진은 이은 구간에서 이 행을 8px마다 찍는다.
      // 그래서 이 행의 tip 4px(잉크 · 장대 2px · 잉크)는 손 등에 가리지 않은 순수 마디 행이어야 한다.
      const joints = idx.map((i, j) => (tips[j] ? frames[i].joint : null));
      idx.forEach((i, j) => {
        if (!tips[j]) return;
        const f = frames[i], jy = joints[j], [tx, ty] = tips[j];
        if (!Number.isInteger(jy) || jy < 0 || jy >= 8) fail(`${def.name} ${a.name}${j}: 장대 마디 위상(joint)은 0~7`);
        const row = [-2, -1, 0, 1].map((dx) => f.K.get(tx + dx, ty + jy));
        if (row[0] !== C.ink || row[3] !== C.ink || row[1] !== C.dusk || row[2] !== C.dusk)
          fail(`${def.name} ${a.name}${j}: ${ty + jy}행 tip 4px가 마디(잉크·dusk·dusk·잉크)가 아니다`);
      });
      anims[a.name].joint = joints;
    }
  }

  // 기준점: 서 있기 0번의 두 발 가운데. 두 발 폭은 짝수여야 반전 축이 픽셀 경계에 온다(ADR-0007 결정 4).
  const stand = frames[0];
  const fs = feetSpan(stand.K, stand.feet);
  const span = fs.x1 - fs.x0 + 1;
  if (span % 2) fail(`${def.name}: 서 있기 0번 두 발 폭 ${span}px가 홀수다(x ${fs.x0}~${fs.x1})`);
  const ax = fs.x0 + span / 2;

  // 딛은 발은 바닥에 닿아야 한다(발 맨 아랫줄 = 칸 마지막 행)
  // 매달린 칸(hand가 있음)은 발이 공중이라 빼고, 대신 아래 "고리 손 기준점" 검사가 손 위치를 본다(삑삑이 hold).
  for (const f of frames) {
    if (f.hand) continue;
    const b = f.K.bbox();
    if (b.y + b.h !== ch) fail(`${def.name} ${f.anim}${f.k}: 맨 아랫줄이 ${b.y + b.h - 1}행이다(바닥 ${ch - 1}행)`);
  }

  // 칸 가장자리에서 몸이 잘리면 안 된다(ADR-0007 결정 3 외곽선, #220): 위 0행과 왼·오른쪽 끝 열에 부품(몸·머리·장대) 픽셀이
  // 있으면 그 바깥 외곽선이 칸 밖으로 나가 잘린다. 부품 픽셀은 외곽선(ink)이어야 한다. fx(속도선·먼지·물방울)는 부품이 없어서 안 센다.
  // 칸 위로 나가는 장대(tip이 있는 칸)는 엔진이 이어 그리니 0행에서 장대 4열만 뺀다(#223). 아래 행은 신발 밑창 자리라 검사하지 않는다(위 "딛은 발" 검사).
  for (const f of frames) {
    const bad = clippedEdge(f.K, { tip: f.tip });
    if (bad.length) fail(`${def.name} ${f.anim}${f.k}: 칸 가장자리에서 그림이 잘린다(외곽선 없음) ${bad.slice(0, 6).join(' ')}${bad.length > 6 ? ' …' : ''}`);
  }

  const img = new Image(cw * frames.length, ch);
  frames.forEach((f, i) => img.blit(f.K, i * cw, 0));
  const hb = stand.K.bbox();
  const meta = {
    '//': `node art/build.mjs로 만든 파일. 직접 고치지 않는다. 원본: art/sprites/${def.source ?? def.character}.mjs. 좌표는 칸 왼쪽 위 기준 px.`,
    image: `${def.name}.png`,
    character: def.character,
    cell: [cw, ch],
    anchor: [ax, ch],
    hit: [hb.x, hb.y, hb.w, hb.h],
    head: def.head,
    walkCycle: def.walkCycle,
    anims,
  };
  // 장대 끝 집게 칸(가로 한 줄). 시트 메타에 claw {image, cell, anchor}로 적는다.
  let clawImg = null;
  if (def.claw) {
    const [kw, kh] = def.claw.cell;
    clawImg = new Image(kw * def.claw.frames, kh);
    def.claw.rows.forEach((rows, k) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (def.claw.legend[ch] !== undefined) clawImg.set(k * kw + x, y, def.claw.legend[ch]);
    })));
    meta.claw = { image: `${def.name}-claw.png`, cell: def.claw.cell, anchor: def.claw.anchor };
    // 장대가 칸 위로 늘어나는 최대 길이(px)와 0에서 다 늘어날 때까지 ms(#284). 없으면 한 번에 대상까지 잇는다(예전 동작).
    if (def.claw.max !== undefined) meta.claw.max = def.claw.max;
    if (def.claw.growMs !== undefined) meta.claw.growMs = def.claw.growMs;
  }
  return { def, frames, img, meta, ax, cw, ch, feet: fs, clawImg };
}

// ── 미리보기: 칸 테두리 + 바닥 위에 프레임을 놓는다. 위: 색 / 가운데: 실루엣 / 아래: 서 있기 0번과 좌우 반전(기준점 축) 겹치기
function previewSheet(s) {
  const gap = 6;
  const n = s.frames.length;
  const W = n * (s.cw + gap) + gap;
  const rowH = s.ch + 10;
  const img = new Image(W, rowH * 3, C.cotton);
  for (let r = 0; r < 3; r++) {
    const y0 = r * rowH + 4;
    img.rect(0, y0 + s.ch, W, rowH - s.ch - 4, C.grnL);
    if (r < 2) {
      s.frames.forEach((f, i) => {
        const x0 = gap + i * (s.cw + gap);
        for (let x = 0; x < s.cw; x += 2) img.set(x0 + x, y0 - 1, C.lint);
        for (let y = 0; y < s.ch; y += 2) {
          img.set(x0 - 1, y0 + y, C.lint);
          img.set(x0 + s.cw, y0 + y, C.lint);
          img.set(x0 + s.ax, y0 + y, C.lav); // 기준점 축
        }
        img.blit(f.K, x0, y0, r === 1 ? { map: () => C.ink } : {});
      });
    } else {
      // 오른쪽을 본 그림과 왼쪽을 본 그림(ax 축 반전)을 같은 기준점에 놓는다. 발 위치가 같아야 돌아설 때 안 튄다.
      const x0 = gap + s.cw;
      img.blit(s.frames[0].K, x0, y0);
      const x1 = x0 + s.cw + gap * 4;
      img.blit(s.frames[0].K, x1, y0, { flipAx: s.ax });
      for (let y = 0; y < s.ch; y += 2) {
        img.set(x0 + s.ax, y0 + y, C.red);
        img.set(x1 + s.ax, y0 + y, C.red);
      }
    }
  }
  return img;
}

// ── 걷기 미리보기(APNG): 90px/s로 바닥을 걸어간다. 프레임은 거리로 넘긴다(floor(걸은 거리 / (walkCycle/6)) % 6).
function previewWalk(s) {
  const W = 200, H = s.ch + 8;
  const speed = 90; // px/s (WALK_SPEED 1.5 × 60Hz)
  const dt = 50; // ms
  const walk = s.meta.anims.walk.frames;
  const idle = s.meta.anims.idle.frames;
  const out = [];
  const floor = (img) => {
    img.rect(0, s.ch, W, H - s.ch, C.grnL);
    for (let x = 0; x < W; x += 12) img.set(x, s.ch + 2, C.grn);
  };
  const startX = 20, endX = W - 20;
  // 1) 서 있기(숨쉬기) 한 번
  for (const [i, f] of idle.entries()) {
    const img = new Image(W, H, C.cotton);
    floor(img);
    img.blit(s.frames[f].K, startX - s.ax, 0);
    out.push({ img, ms: s.meta.anims.idle.ms[i] });
  }
  // 2) 오른쪽으로 걷기
  for (let t = 0, x = startX; x <= endX; t += dt, x = startX + (speed * t) / 1000) {
    const dist = x - startX;
    const k = Math.floor(dist / (s.meta.walkCycle / 6)) % 6;
    const img = new Image(W, H, C.cotton);
    floor(img);
    img.blit(s.frames[walk[k]].K, Math.round(x) - s.ax, 0);
    out.push({ img, ms: dt });
  }
  // 3) 돌아서서 서 있기(왼쪽 보기, ax 축 반전)
  const img = new Image(W, H, C.cotton);
  floor(img);
  img.blit(s.frames[idle[0]].K, endX - s.ax, 0, { flipAx: s.ax });
  out.push({ img, ms: 900 });
  return out;
}

function stats(s) {
  return s.frames.map((f) => {
    let filled = 0, ink = 0;
    const cols = new Set();
    for (let i = 0; i < f.K.c.length; i++) {
      const c = f.K.c[i];
      if (c === EMPTY) continue;
      filled++;
      cols.add(c);
      if (c === C.ink) ink++;
    }
    const b = f.K.bbox();
    return `${f.anim}${f.k}: 그림 ${b.w}×${b.h}, 칠한 픽셀 ${filled}, 잉크 ${ink}, 색 ${cols.size}, 상체 ${f.pose.chest}px`;
  });
}

const check = process.argv.includes('--check');
const outputs = [];
const built = SHEETS.map(buildSheet);
for (const s of built) {
  outputs.push([join(OUT, `${s.def.name}.png`), indexedPng(s.img)]);
  outputs.push([join(OUT, `${s.def.name}.json`), Buffer.from(JSON.stringify(s.meta, null, 2) + '\n')]);
  if (s.clawImg) outputs.push([join(OUT, `${s.def.name}-claw.png`), indexedPng(s.clawImg)]);
}

// ── HUD 동사 아이콘(#255): 20×20 칸 가로 한 줄 + 칸 번호 메타
const icons = buildIcons();
outputs.push([join(UI_OUT, 'hud-icons.png'), indexedPng(icons.sheet)]);
outputs.push([join(UI_OUT, 'hud-icons.json'), Buffer.from(JSON.stringify(icons.meta, null, 2) + '\n')]);

// ── 고리 손 기준점(형식 기록 7절): 발(hold 자리) + (손 − anchor) = 화면 grips. 시트에 hold.hand가 있을 때만 본다.
for (const S of SCENES) {
  const screen = JSON.parse(readFileSync(join(ROOT, 'content', 'screens', `${S.id}.json`), 'utf8'));
  for (const [spotId, grip] of Object.entries(S.grips ?? {})) {
    const spot = screen.spots[spotId];
    if (!spot?.hold) fail(`화면 ${S.id} grips.${spotId}: hold 자리가 아니다`);
    for (const s of built) {
      // hold뿐 아니라 손 기준점이 있는 모든 자세(매달린 채 하는 연출, 쭉이 reach_hang_up 등)를 본다(#203).
      for (const [name, a] of Object.entries(s.meta.anims)) {
        const h = a.hand;
        if (!h) continue;
        // 엔진 spriteBox와 같은 규칙: 왼쪽을 보면 칸 왼쪽 = 발 − (칸 폭 − anchor), 칸 안 x는 (칸 폭 − 1 − x)
        const [cw] = s.meta.cell;
        const [ax, ay] = s.meta.anchor;
        const left = a.facing === -1 ? spot.x - (cw - ax) + (cw - 1 - h[0]) : spot.x - ax + h[0];
        const at = [left, spot.y + h[1] - ay];
        if (at[0] !== grip[0] || at[1] !== grip[1]) fail(`${s.def.name} ${name} 손이 화면 ${S.id} ${spotId}에서 (${at})다(facing ${a.facing}). 고리 손 기준점은 (${grip})`);
      }
    }
  }
}

// ── 화면: 검사 → 출력. 내보내지 않는 파일(draft 배경, 물건이 없을 때 시트)은 커밋돼 있으면 안 된다(낡은 그림).
const absent = [];
const sceneLines = [];
for (const S of SCENES) {
  const screen = JSON.parse(readFileSync(join(ROOT, 'content', 'screens', `${S.id}.json`), 'utf8'));
  const r = buildScene(S, screen);
  if (r.problems.length) {
    console.error(`[art] 화면 ${S.id} 검사 실패 ${r.problems.length}건:\n  ${r.problems.join('\n  ')}`);
    process.exit(1);
  }
  const bgPath = join(SCENE_OUT, `${S.id}-bg.png`);
  if (r.draft) absent.push(bgPath);
  else outputs.push([bgPath, r.bgPng]);
  const sheetPaths = [join(SCENE_OUT, `${S.id}-objects.png`), join(SCENE_OUT, `${S.id}-objects.json`)];
  if (r.sheet) {
    outputs.push([sheetPaths[0], indexedPng(r.sheet)]);
    outputs.push([sheetPaths[1], Buffer.from(JSON.stringify(r.meta, null, 2) + '\n')]);
  } else absent.push(...sheetPaths);
  const bgKb = (r.bgPng.length / 1024).toFixed(1);
  const sheetInfo = r.sheet ? `물건 ${r.meta.objects.length}개·그림 ${r.meta.frames.length}장 ${r.sheet.w}×${r.sheet.h}` : '물건 없음(엔진 폴백 상자)';
  sceneLines.push(`${S.id}: 배경 ${bgKb}KB${r.draft ? ' (draft, 내보내지 않음)' : ''}, ${sheetInfo}`);
}

if (check) {
  const bad = outputs.filter(([p, buf]) => !existsSync(p) || !readFileSync(p).equals(buf)).map(([p]) => relative(ROOT, p));
  for (const p of absent) if (existsSync(p)) bad.push(`${relative(ROOT, p)} (내보내지 않는 파일인데 있다. 지운다)`);
  if (bad.length) {
    console.error(`[art] 커밋된 시트가 원본과 다르다. node art/build.mjs로 다시 만들어 커밋한다:\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`[art] 출력 ${outputs.length}개가 원본과 같다. ${sceneLines.join(' / ')}`);
} else {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(SCENE_OUT, { recursive: true });
  mkdirSync(UI_OUT, { recursive: true });
  for (const [p, buf] of outputs) writeFileSync(p, buf);
  for (const p of absent) if (existsSync(p)) rmSync(p);
  for (const line of sceneLines) console.log(line);
  writeFileSync(join(PREVIEW, 'hud-icons-preview-4x.png'), indexedPng(previewIcons(icons.cells, HEX), 4));
  console.log(`hud-icons: ${icons.cells.length}개 ${icons.sheet.w}×${icons.sheet.h} (${Object.keys(icons.meta.icons).join(' ')})`);
  for (const s of built) {
    writeFileSync(join(PREVIEW, `${s.def.name}-preview-4x.png`), indexedPng(previewSheet(s), 4));
    writeFileSync(join(PREVIEW, `${s.def.name}-walk-3x.png`), animatedPng(previewWalk(s), 3));
    const kb = (outputs.find(([p]) => p.endsWith(`${s.def.name}.png`))[1].length / 1024).toFixed(1);
    console.log(`${s.def.name}: ${s.frames.length}장, ${s.img.w}×${s.img.h}, ${kb}KB, anchor [${s.meta.anchor}], 두 발 x ${s.feet.x0}~${s.feet.x1}, hit [${s.meta.hit}]`);
    for (const line of stats(s)) console.log(`  ${line}`);
  }
}
