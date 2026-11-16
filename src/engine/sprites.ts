// 캐릭터 스프라이트 시트 로드와 그리기 (#140).
// 메타 JSON은 빌드 때 `public/sprites/*-base.json`을 모아 번들에 넣는다. 그래서 시트가 없는 캐릭터는
// 이미지 요청 자체를 안 한다(404 → 콘솔 에러 없음, M1 판정 A4). 새 캐릭터 시트는 json·png만 넣으면 붙는다.
// 이미지는 assetUrl()로만 읽는다(ADR-0004 결정 8). 로드 전·실패면 null → 호출하는 쪽이 실루엣을 그린다.

import type { Loaded } from '../core/fallbacks';
import { frameSourceX, parseSpriteMeta, spriteBox, spriteFacing, spriteFrame, type Pose, type SpriteMeta } from '../core/sprite';
import type { Walker } from '../core/walk';
import { assetUrl } from './assets';
import { buildOutlined } from './outline';

interface Sheet {
  meta: SpriteMeta;
  image: HTMLImageElement;
  ready: boolean;
  /** 칸마다 호버 외곽선을 칠한 시트(#157 10-1절). 못 만들면 null(외곽선 없음). */
  outlined: HTMLCanvasElement | null;
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
    const sheet: Sheet = { meta, image, ready: false, outlined: null };
    image.onload = () => {
      const [cw, ch] = meta.cell;
      const cells = Array.from({ length: Math.floor(image.naturalWidth / cw) }, (_, i) => [frameSourceX(meta, i), 0, cw, ch] as const);
      sheet.outlined = buildOutlined(image, cells);
      sheet.ready = true;
    };
    image.src = assetUrl(`sprites/${meta.image}`);
    sheets.set(meta.character, sheet);
  }
  return sheets;
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
 * 시트 그림으로 그린다. 그렸으면 그림 꼭대기(내부 y, 메타 `hit` 위끝)를 돌려준다. 말풍선·▼ 위치용.
 * 시트가 없거나 아직 안 왔거나 그 자세가 없으면 아무것도 안 그리고 null(→ 실루엣).
 * `outlined`면 호버 외곽선 시트에서 자른다(실루엣에는 외곽선이 없다).
 */
export function drawSprite(ctx: CanvasRenderingContext2D, w: Walker, pose: Pose, outlined = false): number | null {
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
  return spriteBox(meta, w.x, w.y, facing).top + meta.hit[1];
}
