// 화면 배경·물건 시트 로드와 그리기 (#157 10절 2단계). 고르기(무엇을 그리나)는 core/sceneArt.ts.
// 메타 JSON은 빌드 때 `public/scenes/*-objects.json`을 모아 번들에 넣는다(engine/sprites.ts와 같은 방식).
// 배경 PNG는 메타 `bg`가 있을 때만 요청한다. draft 배경은 내보내지 않으므로 404(M1 판정 A4)가 나지 않는다.
// 이미지 로드 전·실패면 그리지 않고 false → main.ts가 임시 방·상자를 그린다(형식 기록 9절 폴백).

import { parseSceneArt, type SceneArtMeta } from '../core/sceneArt';
import { assetUrl } from './assets';

export interface SceneArt {
  meta: SceneArtMeta;
  /** 물건 시트. 다 읽히면 `objectsReady`. */
  objects: HTMLImageElement;
  objectsReady: boolean;
  /** 배경. 메타에 `bg`가 없으면 null. */
  bg: HTMLImageElement | null;
  bgReady: boolean;
}

const RAW = import.meta.glob<unknown>('../../public/scenes/*-objects.json', { eager: true, import: 'default' });

/** 화면 ID → 메타. 형식이 틀린 메타는 경고만 남기고 뺀다(그 화면은 임시 그림). 이미지는 아직 읽지 않는다. */
const METAS = new Map<string, SceneArtMeta>();
for (const [path, raw] of Object.entries(RAW)) {
  try {
    const meta = parseSceneArt(raw);
    METAS.set(meta.screen, meta);
  } catch (e) {
    console.warn(`${path}: ${(e as Error).message}`);
  }
}

/** 그 화면의 그림 메타(동기, 번들에 들어 있음). 장면 로직(busy 길이·보이는 플래그)에 넘긴다. */
export function sceneArtMeta(screenId: string): SceneArtMeta | null {
  return METAS.get(screenId) ?? null;
}

function load(path: string, onReady: () => void): HTMLImageElement {
  const image = new Image();
  image.onload = onReady;
  image.src = assetUrl(`scenes/${path}`);
  return image;
}

/** 그 화면의 이미지를 읽기 시작한다. 메타가 없으면 null. */
export function loadSceneArt(screenId: string): SceneArt | null {
  const meta = METAS.get(screenId);
  if (!meta) return null;
  const art: SceneArt = { meta, objects: null as unknown as HTMLImageElement, objectsReady: false, bg: null, bgReady: false };
  art.objects = load(meta.image, () => {
    art.objectsReady = true;
  });
  if (meta.bg)
    art.bg = load(meta.bg, () => {
      art.bgReady = true;
    });
  return art;
}

/** 배경 한 장. 읽혔으면 그리고 true. */
export function drawSceneBg(ctx: CanvasRenderingContext2D, art: SceneArt | null): boolean {
  if (!art?.bg || !art.bgReady) return false;
  ctx.drawImage(art.bg, 0, 0);
  return true;
}

/** 시트 프레임 하나를 제자리(`at`)에 그린다. 시트가 아직이면 아무것도 안 한다. */
export function drawSceneFrame(ctx: CanvasRenderingContext2D, art: SceneArt, frame: number): void {
  if (!art.objectsReady) return;
  const f = art.meta.frames[frame];
  if (!f) return;
  const [sx, sy, w, h] = f.src;
  ctx.drawImage(art.objects, sx, sy, w, h, f.at[0], f.at[1], w, h);
}
