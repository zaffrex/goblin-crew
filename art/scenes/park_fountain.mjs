// 화면 2 `park_fountain` 그림 원본 (#380, 형식: docs/decisions/2026-11-16-scene-art-format-v1.md).
// 그림 빌드 연결(#468 시작 조건): 물건 시트(손님·관리인·자명종·재킷)를 지금 그린 만큼 빌드에 넣는다.
// 배경 본 그림은 아직 없어서 draft: true다. 배경 PNG를 내보내지 않고 엔진은 임시 방(drawRoom)을 그린다.
// 배경을 그리면 bg(img)를 채우고 draft: false로 바꾼다(magpie_nest.mjs와 같은 길). 스케치는 docs/design/screens/park_fountain-bg-sketch.mjs.
// 물건·일시 연출은 art/scenes/park_fountain.objects.mjs에 그린다. 그 파일을 고치면 `node art/build.mjs`로 시트를 다시 만들어 같이 커밋한다(npm test가 --check로 막는다).

import { C } from '../lib/pixel.mjs';
import { OBJECTS, ANIMS } from './park_fountain.objects.mjs';

export const SCENE = {
  id: 'park_fountain',
  draft: true,
  // draft라 내보내지 않지만 검사(8절 불투명)는 돈다. 한 색으로 채워 둔다.
  bg(img) { img.rect(0, 0, 480, 270, C.cotton); },
  objects: OBJECTS,
  anims: ANIMS,
};
