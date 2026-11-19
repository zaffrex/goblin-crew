// art/scene-build.mjs 타입(tests/art/scenes.test.ts용). 런타임 형식은 docs/decisions/2026-11-16-scene-art-format-v1.md.

export interface Img {
  w: number;
  h: number;
  c: Int16Array;
  set(x: number, y: number, col: number): void;
  rect(x: number, y: number, w: number, h: number, col: number): void;
}
type Draw = (img: Img) => void;
interface Loop { ms: number | number[]; frames: Draw[] }
interface Picture { draw: Draw; loop?: Loop; layer?: 'back' | 'front' }
export interface SceneSrc {
  id: string;
  draft?: boolean;
  bg: Draw;
  objects?: Record<string, Partial<Picture> & {
    ids?: string[];
    states?: (Partial<Picture> & { when: { flags: Record<string, boolean> } })[];
    overlay?: { sortY: number; draw: Draw };
    tilt?: { step: number; weight: Record<string, number>; pivot: number; run: number; draw: Record<string, Draw> };
    noFloor?: { box: [number, number, number, number]; y: number };
  } & Record<string, unknown>>;
  anims?: Record<string, { ms: number | number[]; frames: Draw[]; layer?: 'back' | 'front'; tilt?: number[]; variants?: ({ when: { flags: Record<string, boolean> }; ms: number | number[]; frames: Draw[]; layer?: 'back' | 'front'; tilt?: number[] } & Record<string, unknown>)[] } & Record<string, unknown>>;
}
export interface Frame { src: [number, number, number, number]; at: [number, number] }
interface PicMeta { frame: number; layer: 'back' | 'front'; loop?: { frames: number[]; ms: number[] } }
export interface SceneMeta {
  image: string;
  screen: string;
  frames: Frame[];
  objects: { key: string; ids: string[]; default: PicMeta; states?: (PicMeta & { when: { flags: Record<string, boolean> } })[]; overlay?: { sortY: number; frame: number }; tilt?: { step: number; weight: Record<string, number>; pivot: number; run: number; frames: Record<string, number> }; noFloor?: { box: [number, number, number, number]; y: number } }[];
  bg: string | null;
  anims: Record<string, { object: string | null; frames: number[]; ms: number[]; layer: 'back' | 'front'; tilt?: number[]; variants?: { when: { flags: Record<string, boolean> }; frames: number[]; ms: number[]; layer: 'back' | 'front'; tilt?: number[] }[] }>;
}
export const SCREEN_W: number;
export const SCREEN_H: number;
export const BG_MAX_BYTES: number;
export const ANIM_MAX_MS: number;
export function buildScene(scene: SceneSrc, screen: unknown, opts?: { bgMaxBytes?: number }): {
  problems: string[];
  draft: boolean;
  bg: Img;
  bgPng: Uint8Array;
  sheet: Img | null;
  meta: SceneMeta | null;
};
