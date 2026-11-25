import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import mapJson from '../../content/map.json';
import orderJson from '../../content/screens/order.json';
import { thumbOrigin } from '../../src/core/map';

// src/core는 Node 타입 없이 타입체크한다(tsconfig.core.json). 파일 존재를 보는 검사는 여기 둔다.
const SCENE = { width: 480, height: 270 };
const hasObjectSheet = (id: string): boolean => existsSync(fileURLToPath(new URL(`../../public/scenes/${id}-objects.json`, import.meta.url)));

describe('thumbOrigin per deployed screen (title-and-map 3-3절)', () => {
  // 그림(물건 시트)이 들어간 판은 자르는 자리도 같이 정한다. laundromat은 #764 시트 뒤에도 빠져서 맵에 dusk 한 색으로 남았다.
  it('every deployed screen with an object sheet has an origin (no dusk card once art is in)', () => {
    const withArt = (orderJson as string[]).filter(hasObjectSheet);
    expect(withArt.length).toBeGreaterThan(0);
    for (const id of withArt) {
      expect(thumbOrigin(mapJson, id, SCENE).origin, `content/map.json thumbOrigin.${id}`).not.toBeNull();
    }
  });
});
