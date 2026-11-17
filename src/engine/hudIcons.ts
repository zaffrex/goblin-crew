// HUD 동사 아이콘 시트 로드와 그리기 (#255). 메타 해석은 core/hudIcons.ts.
// 메타 JSON은 번들에 넣고, 이미지는 assetUrl()로만 읽는다(ADR-0004 결정 8, sprites.ts와 같은 방식).
// 메타가 틀렸거나 이미지가 아직·실패면 false → hud.ts가 임시 글자를 그린다(얼굴 칸과 같은 방식).

import raw from '../../public/ui/hud-icons.json';
import { ICON_SIZE, parseHudIconMeta, type HudIconMeta } from '../core/hudIcons';
import { assetUrl } from './assets';

interface IconSheet {
  meta: HudIconMeta;
  image: HTMLImageElement;
  ready: boolean;
}

function loadIcons(): IconSheet | null {
  let meta: HudIconMeta;
  try {
    meta = parseHudIconMeta(raw);
  } catch (e) {
    console.warn(`public/ui/hud-icons.json: ${(e as Error).message}`);
    return null;
  }
  const sheet: IconSheet = { meta, image: new Image(), ready: false };
  sheet.image.onload = () => {
    sheet.ready = true;
  };
  sheet.image.src = assetUrl(`ui/${meta.image}`);
  return sheet;
}

const SHEET = loadIcons();

/** 아이콘 `id` 칸을 `at`(왼쪽 위)에 20×20 그대로 그린다. 시트가 없거나 아직이거나 모르는 id거나 칸이 시트 밖이면 false. */
export function drawHudIcon(ctx: CanvasRenderingContext2D, id: string, at: { x: number; y: number }): boolean {
  if (!SHEET?.ready) return false;
  const i = SHEET.meta.icons[id];
  if (i === undefined || (i + 1) * ICON_SIZE > SHEET.image.naturalWidth) return false;
  ctx.drawImage(SHEET.image, i * ICON_SIZE, 0, ICON_SIZE, ICON_SIZE, at.x, at.y, ICON_SIZE, ICON_SIZE);
  return true;
}
