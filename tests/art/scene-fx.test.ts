// 엔진 효과 표(src/core/sceneFx.ts)가 팔레트 파일·빌드 검사 표와 같은지 (그림 형식 개정 4, 11-4·11-5절).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FX_MODES } from '../../art/scene-build.mjs';
import { BOSONG_32, SCENE_FX } from '../../src/core/sceneFx';

const ROOT = join(import.meta.dirname, '..', '..');

describe('효과 표와 팔레트', () => {
  it('BOSONG_32는 docs/design/art/bosong-32.hex와 같다(번호 = 줄 번호)', () => {
    const hex = readFileSync(join(ROOT, 'docs', 'design', 'art', 'bosong-32.hex'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((h) => `#${h.toLowerCase()}`);
    expect(BOSONG_32).toEqual(hex);
  });

  it('빌드 검사 표(art/scene-build.mjs FX_MODES)와 엔진 표(SCENE_FX)가 같다', () => {
    expect(JSON.parse(JSON.stringify(SCENE_FX))).toEqual(FX_MODES);
  });
});
