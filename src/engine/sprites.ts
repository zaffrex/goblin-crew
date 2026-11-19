// 캐릭터 스프라이트 시트 로드와 그리기 (#140).
// 메타 JSON은 빌드 때 `public/sprites/*-base.json`을 모아 번들에 넣는다. 그래서 시트가 없는 캐릭터는
// 이미지 요청 자체를 안 한다(404 → 콘솔 에러 없음, M1 판정 A4). 새 캐릭터 시트는 json·png만 넣으면 붙는다.
// 이미지는 assetUrl()로만 읽는다(ADR-0004 결정 8). 로드 전·실패면 null → 호출하는 쪽이 실루엣을 그린다.

import type { Loaded } from '../core/fallbacks';
import { cellTops, frameSourceX, headSource, headTop, parseSpriteMeta, spriteBox, spriteFacing, spriteFrame, spritePole, type PoleDraw, type Pose, type SpriteMeta } from '../core/sprite';
import type { Walker } from '../core/walk';
import { assetUrl } from './assets';
import { buildOutlined } from './outline';

interface Sheet {
  meta: SpriteMeta;
  image: HTMLImageElement;
  ready: boolean;
  /** 칸마다 호버 외곽선을 칠한 시트(#157 10-1절). 못 만들면 null(외곽선 없음). */
  outlined: HTMLCanvasElement | null;
  /** 장대 끝 집게 칸 줄(5-1절). 메타에 `claw`가 없으면 null. 아직 안 왔으면 장대도 잇지 않는다. */
  claw: { image: HTMLImageElement; ready: boolean } | null;
  /** 칸마다 불투명 위끝(#464). 픽셀을 못 읽었으면 null → 앵커는 늘 기본 `hit` 위끝(예전과 같다). */
  tops: (number | null)[] | null;
}

/** 그린 캐릭터의 앵커 높이(내부 y, #464). `low`면 낮은 자세라 서 있기 히트 박스 위끝 대신 이 값을 그대로 쓴다. */
export interface SpriteTop {
  top: number;
  low: boolean;
}

const RAW = import.meta.glob<unknown>('../../public/sprites/*-base.json', { eager: true, import: 'default' });

/** 캐릭터 ID → 기본 시트. 메타가 틀린 시트는 경고만 남기고 빼서 실루엣으로 둔다. */
function loadSheets(): Map<string, Sheet> {
  const sheets = new Map<string, Sheet>();
  for (const [path, raw] of Object.entries(RAW)) {
    let meta: SpriteMeta;
    try {
      meta = parseSpriteMeta(raw);
    } catch (e) {
      console.warn(`${path}: ${(e as Error).message}`);
      continue;
    }
    const image = new Image();
    const sheet: Sheet = { meta, image, ready: false, outlined: null, claw: null, tops: null };
    if (meta.claw) {
      const claw = { image: new Image(), ready: false };
      claw.image.onload = () => {
        claw.ready = true;
      };
      claw.image.src = assetUrl(`sprites/${meta.claw.image}`);
      sheet.claw = claw;
    }
    image.onload = () => {
      const [cw, ch] = meta.cell;
      const cells = Array.from({ length: Math.floor(image.naturalWidth / cw) }, (_, i) => [frameSourceX(meta, i), 0, cw, ch] as const);
      sheet.outlined = buildOutlined(image, cells);
      sheet.tops = readTops(image, meta);
      sheet.ready = true;
    };
    image.src = assetUrl(`sprites/${meta.image}`);
    sheets.set(meta.character, sheet);
  }
  return sheets;
}

/** 칸마다 불투명 위끝(#464). 시트를 읽을 때 한 번. 캔버스를 못 쓰면 null(앵커가 예전처럼 서 있는 높이). */
function readTops(image: HTMLImageElement, meta: SpriteMeta): (number | null)[] | null {
  const { naturalWidth: w, naturalHeight: h } = image;
  if (w === 0 || h === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    return cellTops(ctx.getImageData(0, 0, w, h).data, w, meta.cell, Math.floor(w / meta.cell[0]));
  } catch (e) {
    console.warn(`칸 위끝을 못 읽었어요(${image.src}): ${(e as Error).message}`);
    return null;
  }
}

const SHEETS = loadSheets();

/** 캐릭터 ID → 시트 메타(동기, 번들에 들어 있음). 장면 로직의 캐릭터 연출 busy 길이에 넘긴다(scene.ts `SceneData.sprites`). */
export function spriteMetas(): Record<string, SpriteMeta> {
  return Object.fromEntries([...SHEETS].map(([id, sheet]) => [id, sheet.meta]));
}

/** 캐릭터 시트 상태(임시 그림 세기 #142용). 시트가 없으면 none, 이미지가 아직이면 loading. */
export function spriteState(id: string): Loaded {
  const sheet = SHEETS.get(id);
  return !sheet ? 'none' : sheet.ready ? 'ready' : 'loading';
}

/**
 * HUD 얼굴 칸(#255, 설계 6-1-1절): 시트 `idle` 첫 칸의 `head` 박스를 `at`(왼쪽 위)에 그대로 그린다.
 * 시트가 없거나 아직이거나 `head`가 없으면 false(→ 임시 색 칸).
 */
export function drawHead(ctx: CanvasRenderingContext2D, id: string, at: { x: number; y: number }): boolean {
  const sheet = SHEETS.get(id);
  const src = sheet?.ready ? headSource(sheet.meta) : null;
  if (!src) return false;
  ctx.drawImage(sheet!.image, src.x, src.y, src.width, src.height, at.x, at.y, src.width, src.height);
  return true;
}

/**
 * 시트 그림으로 그린다. 그렸으면 앵커 높이(내부 y)를 돌려준다. 말풍선·별·▼ 위치용.
 * 보통은 메타 `hit` 위끝이고, 지금 칸이 낮은 자세(납작·엉덩방아)면 그 칸의 불투명 위끝이다(`core/sprite.ts` `headTop`, #464).
 * 시트가 없거나 아직 안 왔거나 그 자세가 없으면 아무것도 안 그리고 null(→ 실루엣).
 * `outlined`면 호버 외곽선 시트에서 자른다(실루엣에는 외곽선이 없다).
 */
export function drawSprite(ctx: CanvasRenderingContext2D, w: Walker, pose: Pose, outlined = false): SpriteTop | null {
  const sheet = SHEETS.get(w.id);
  if (!sheet?.ready) return null;
  const frame = spriteFrame(sheet.meta, pose);
  if (frame === null) return null;
  const { meta } = sheet;
  const image = outlined && sheet.outlined ? sheet.outlined : sheet.image;
  const [cw, ch] = meta.cell;
  const [ax, ay] = meta.anchor;
  const fx = Math.round(w.x);
  const fy = Math.round(w.y);
  const sx = frameSourceX(meta, frame);
  const facing = spriteFacing(meta, pose, w.facing);
  if (facing === 1) {
    ctx.drawImage(image, sx, 0, cw, ch, fx - ax, fy - ay, cw, ch);
  } else {
    ctx.save();
    ctx.translate(fx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, sx, 0, cw, ch, -ax, fy - ay, cw, ch);
    ctx.restore();
  }
  const pole = sheet.claw?.ready ? spritePole(meta, pose, w.x, w.y, facing) : null;
  if (pole) drawPole(ctx, sheet.image, sheet.claw!.image, meta, pole);
  const head = headTop(meta, sheet.tops?.[frame] ?? null);
  return { top: spriteBox(meta, w.x, w.y, facing).top + head.y, low: head.low };
}

/**
 * 칸 위로 이은 장대(tip 0행 4px를 위로 늘림)와 8px마다 마디(#194), 끝 집게(파이프라인 기록 5-1절, #189).
 * 장대 줄은 외곽선 시트가 아니라 원본에서 자른다(0행 잉크가 외곽선 주황으로 늘어나지 않게). 호버 외곽선은 몸에만 있다.
 */
function drawPole(ctx: CanvasRenderingContext2D, image: HTMLImageElement, clawImage: HTMLImageElement, meta: SpriteMeta, p: PoleDraw): void {
  const [cw, ch] = meta.claw!.cell;
  const { src } = p;
  const blit = (img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dh: number): void => {
    if (!p.flip) {
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, dh);
      return;
    }
    ctx.save();
    ctx.translate(dx + sw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, dy, sw, dh);
    ctx.restore();
  };
  if (p.bottom > p.top) blit(image, src.x, src.y, src.width, 1, p.left, p.top, p.bottom - p.top); // 연출 첫 틱(길이 0)은 집게만(#284)
  for (const jy of p.joints) blit(image, src.x, p.jointSrcY, src.width, 1, p.left, jy, 1); // 마디(#194): 시트 마디 행을 8px마다
  blit(clawImage, p.claw * cw, 0, cw, ch, p.clawLeft, p.clawTop, ch);
}
