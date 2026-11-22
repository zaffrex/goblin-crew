// 화면 JSON(+ 있으면 물건 그림 메타)을 읽어 `SceneData`로. 검사 CLI와 테스트가 같이 쓴다.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSceneArt } from '../../src/core/sceneArt';
import type { ScreenData } from '../../src/core/puzzle/types';
import type { SceneData } from '../../src/core/scene';

/** `content/screens/`의 화면 ID(`order.json` 뺌, ADR-0065 8절). */
export function screenIds(root = '.'): string[] {
  return readdirSync(join(root, 'content/screens'))
    .filter((f) => f.endsWith('.json') && f !== 'order.json')
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** 그림이 아직 없는 화면(회색 배치)은 `art` 없이. 있으면 높은 대상 앞 내려서기(`clearOf`)가 그림 상자를 쓴다. */
export function loadScene(id: string, root = '.'): SceneData {
  const screen = JSON.parse(readFileSync(join(root, 'content/screens', `${id}.json`), 'utf8')) as ScreenData;
  const artPath = join(root, 'public/scenes', `${id}-objects.json`);
  const art = existsSync(artPath) ? parseSceneArt(JSON.parse(readFileSync(artPath, 'utf8'))) : undefined;
  return art ? { screen, art } : { screen };
}
