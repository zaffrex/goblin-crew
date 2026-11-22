// 그림이 있는 화면에서 클릭 대상이 물건 시트에 빠지면 실패한다 (#828).
// 시트가 안 그리는 대상은 엔진이 임시 색 상자로 그린다(`src/main.ts` `uncovered()`, 형식 기록
// docs/decisions/2026-11-16-scene-art-format-v1.md 9절 폴백). 그림 전 화면에서는 맞는 동작이지만, 그림이 붙은 화면에서는
// 단서 그림 위에 판이 서 버린다. PR #827에서 `park_fountain` `statue`가 그렇게 40×70 보라 판으로 덮였는데 `npm test`가 통과했다.
// 시트가 없는 화면(그림 전, 예: `laundromat`)은 보지 않는다. 그림 PR이 시트를 만드는 순간부터 그 화면 대상 전부를 그려야 한다.
// 일부러 시트 없이 두는 대상이 필요해지면 그때 예외 목록을 L1로 정한다(지금은 없음).

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coveredIds, type SceneArtMeta } from '../../src/core/sceneArt';

const ROOT = join(import.meta.dirname, '..', '..');
const SCREENS = join(ROOT, 'content', 'screens');

interface ScreenLike {
  hotspots: Record<string, unknown>;
  spots?: Record<string, { box?: unknown }>;
}

/** 엔진이 상자로 그릴 수 있는 대상 ID: hotspot 전부 + `box`가 있는 spot(`sceneLayout`과 같은 기준). */
function targetIds(screen: ScreenLike): string[] {
  const spots = Object.entries(screen.spots ?? {}).filter(([, s]) => s.box !== undefined).map(([id]) => id);
  return [...Object.keys(screen.hotspots), ...spots];
}

/** 시트가 그리지 않아 임시 상자로 남는 대상. */
function placeholderIds(screen: ScreenLike, meta: SceneArtMeta): string[] {
  const covered = coveredIds(meta);
  return targetIds(screen).filter((id) => !covered.has(id));
}

// order.json은 화면이 아니다(ADR-0065 8절).
const withSheet = readdirSync(SCREENS)
  .filter((f) => f.endsWith('.json') && f !== 'order.json')
  .map((f) => f.slice(0, -'.json'.length))
  .filter((id) => existsSync(join(ROOT, 'public', 'scenes', `${id}-objects.json`)));

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

describe('그림 있는 화면의 클릭 대상은 전부 물건 시트에 있다 (#828)', () => {
  it('검사할 화면이 있다(폴더를 잘못 읽어 0개로 통과하지 않게)', () => {
    expect(withSheet).toContain('magpie_nest');
    expect(withSheet).toContain('park_fountain');
  });

  it.each(withSheet)('%s: 임시 상자로 그려지는 대상 0개', (id) => {
    const screen = read<ScreenLike>(join(SCREENS, `${id}.json`));
    const meta = read<SceneArtMeta>(join(ROOT, 'public', 'scenes', `${id}-objects.json`));
    expect(placeholderIds(screen, meta), '시트에 없어서 임시 상자가 그려짐 → art/scenes/<화면>.mjs objects에 그리기').toEqual([]);
  });

  it('시트에서 대상 하나를 빼면 잡는다', () => {
    const screen = read<ScreenLike>(join(SCREENS, 'park_fountain.json'));
    const meta = read<SceneArtMeta>(join(ROOT, 'public', 'scenes', 'park_fountain-objects.json'));
    const without = { ...meta, objects: meta.objects.filter((o) => !o.ids.includes('duck')) };
    expect(placeholderIds(screen, without)).toContain('duck');
  });

  it('상자 있는 spot도 대상이고, 상자 없는 spot(걷기 자리)은 아니다', () => {
    const screen: ScreenLike = { hotspots: { a: {} }, spots: { floor: {}, board: { box: [0, 0, 8, 8] } } };
    expect(targetIds(screen)).toEqual(['a', 'board']);
  });
});
