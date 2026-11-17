// 소리 글자 시트 로드와 그리기 (#284, `docs/design/ability-feedback.md` 3절). 메타 해석·자리 계산은 core/fxText.ts.
// 메타 JSON은 번들에 넣고, 이미지는 assetUrl()로만 읽는다(ADR-0004 결정 8, hudIcons.ts와 같은 방식).
// 시트가 없거나 아직이거나 그 fx 칸이 없으면 false → 호출하는 쪽이 임시 별(drawSpark)을 그린다.

import raw from '../../public/ui/fx-text.json';
import type { Loaded } from '../core/fallbacks';
import { fxTextAt, parseFxTextMeta, TING_FX, TING_SPARK, tingSparkAt, type FxCell, type FxTextMeta } from '../core/fxText';
import { assetUrl } from './assets';

interface TextSheet {
  meta: FxTextMeta;
  image: HTMLImageElement;
  ready: boolean;
}

function loadSheet(): TextSheet | null {
  let meta: FxTextMeta;
  try {
    meta = parseFxTextMeta(raw);
  } catch (e) {
    console.warn(`public/ui/fx-text.json: ${(e as Error).message}`);
    return null;
  }
  const sheet: TextSheet = { meta, image: new Image(), ready: false };
  sheet.image.onload = () => {
    sheet.ready = true;
  };
  sheet.image.src = assetUrl(`ui/${meta.image}`);
  return sheet;
}

const SHEET = loadSheet();

/** 시트 상태(재생 도구 임시 그림 세기용). */
export function fxTextState(): Loaded {
  return !SHEET ? 'none' : SHEET.ready ? 'ready' : 'loading';
}

function cellOf(id: string): FxCell | null {
  if (!SHEET?.ready) return null;
  const c = SHEET.meta.cells[id];
  if (!c || c[0] + c[2] > SHEET.image.naturalWidth || c[1] + c[3] > SHEET.image.naturalHeight) return null;
  return c;
}

function blit(ctx: CanvasRenderingContext2D, c: FxCell, at: { x: number; y: number }): void {
  ctx.drawImage(SHEET!.image, c[0], c[1], c[2], c[3], at.x, at.y, c[2], c[3]);
}

/**
 * fx `effect`의 글자를 대상 기준점 `at`(그림 위 끝 가운데) 위에 그린다. 시작 뒤 `t`틱.
 * 그렸거나 일부러 안 그렸으면(튀기가 끝남) true. 시트·칸이 없어서 못 그렸으면 false.
 */
export function drawFxText(ctx: CanvasRenderingContext2D, effect: string, at: { x: number; y: number }, t: number, screenW: number): boolean {
  const cell = cellOf(effect);
  if (!cell) return false;
  const pos = fxTextAt(effect, cell, at, t, screenW);
  if (!pos) return true;
  blit(ctx, cell, pos);
  if (effect === TING_FX) {
    const spark = cellOf(TING_SPARK);
    const sp = spark ? tingSparkAt(pos, cell, spark, t, screenW) : null;
    if (spark && sp) blit(ctx, spark, sp);
  }
  return true;
}
