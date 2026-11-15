// 캐릭터 스프라이트 시트 로드와 그리기 (#140).
// 메타 JSON은 빌드 때 `public/sprites/*-base.json`을 모아 번들에 넣는다. 그래서 시트가 없는 캐릭터는
// 이미지 요청 자체를 안 한다(404 → 콘솔 에러 없음, M1 판정 A4). 새 캐릭터 시트는 json·png만 넣으면 붙는다.
// 이미지는 assetUrl()로만 읽는다(ADR-0004 결정 8). 로드 전·실패면 null → 호출하는 쪽이 실루엣을 그린다.

import { frameSourceX, parseSpriteMeta, spriteBox, spriteFrame, type Pose, type SpriteMeta } from '../core/sprite';
import type { Walker } from '../core/walk';
import { assetUrl } from './assets';

interface Sheet {
  meta: SpriteMeta;
  image: HTMLImageElement;
  ready: boolean;
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
    const sheet: Sheet = { meta, image, ready: false };
    image.onload = () => {
      sheet.ready = true;
    };
    image.src = assetUrl(`sprites/${meta.image}`);
    sheets.set(meta.character, sheet);
  }
  return sheets;
}

const SHEETS = loadSheets();

/**
 * 시트 그림으로 그린다. 그렸으면 그림 꼭대기(내부 y, 메타 `hit` 위끝)를 돌려준다. 말풍선·▼ 위치용.
 * 시트가 없거나 아직 안 왔거나 그 자세가 없으면 아무것도 안 그리고 null(→ 실루엣).
 */
export function drawSprite(ctx: CanvasRenderingContext2D, w: Walker, pose: Pose): number | null {
  const sheet = SHEETS.get(w.id);
  if (!sheet?.ready) return null;
  const frame = spriteFrame(sheet.meta, pose);
  if (frame === null) return null;
  const { meta, image } = sheet;
  const [cw, ch] = meta.cell;
  const [ax, ay] = meta.anchor;
  const fx = Math.round(w.x);
  const fy = Math.round(w.y);
  const sx = frameSourceX(meta, frame);
  if (w.facing === 1) {
    ctx.drawImage(image, sx, 0, cw, ch, fx - ax, fy - ay, cw, ch);
  } else {
    ctx.save();
    ctx.translate(fx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, sx, 0, cw, ch, -ax, fy - ay, cw, ch);
    ctx.restore();
  }
  return spriteBox(meta, w.x, w.y, w.facing).top + meta.hit[1];
}
