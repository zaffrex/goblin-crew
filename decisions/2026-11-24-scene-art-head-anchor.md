---
schema: 1
id: 1184dab2-feed-43b8-bd14-22427baed537
title: "머리 위 anim(`anchor`)은 칸을 얼굴 상자 위 가운데 기준 상대 좌표로 그리고, 평소 안 보이는 머리 위 물건은 장식 물건 `draw: null`로 둔다"
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: scene-art-format
scope: [art/scene-build.mjs, src/core/sceneArt.ts, src/engine/sceneArt.ts]
related: [0d74c83f-dc3c-4979-bfa9-bd0ba63ff173, 4de95253-eb32-436b-bdb0-0776c2188fc2]
revisit_when: 머리 말고 손·발 자리가 필요해지거나, 판정에서 머리 위 물건이 쿵·움찔 자세 때 머리와 따로 논다는 말이 나오면 자세별 머리 자리를 본다.
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#901
  - pr: zaffrex/goblin-crew#900
---
## 결정
- 그림 anim에 `anchor: { char, point: 'head' }`를 적으면 그 칸은 그림 화면 `ANCHOR_ORIGIN` (240, 135)를 "얼굴 상자 위 가운데"로 보고 그린다. 빌드는 메타 `at`을 그 점에서 잰 상대 좌표로 내보낸다. 늘 `front`이고, 캐릭터가 왼쪽을 보면 가운데 세로줄로 좌우를 뒤집는다.
- 엔진은 `SceneDraws.heads`로 받아 사람 위에 그린다(`headPlace`, `scene.ts` `headAnchor`). 외곽선·덮개·말풍선 상자에서는 빠진다.
- 장식 물건(`ids: []`)만 `default`에 `draw: null`(평소 안 그림)을 둘 수 있다.
- 팀 기록은 `docs/decisions/2026-11-16-scene-art-format-v1.md` 16절(개정 12)이 우선이다.

## 이유
- 발 y가 걷기 영역 안에서 자유라 머리 자리가 고정이 아니다. 몸 칸 0으로 양말·깃털·둥지 모자를 그리려면 캐릭터 기준 좌표가 필요하다(설계 E5).
- 평소 안 보이는 물건을 그리려고 쓸모없는 기본 그림 칸 + 빈 플래그 state를 넣으면 시트 칸만 늘고 읽기 어렵다. 장식 물건은 히트 박스가 없어 안 그려도 임시 상자 문제가 없다.

## 검토했지만 택하지 않은 안
- 캐릭터를 정한 자리로 옮기는 연출 이벤트: 퍼즐 이벤트(`src/core/puzzle/`)를 바꿔야 해서 코어 PR이 된다.
- 기본 그림 + `when: { flags: {} }` + `draw: null` state 우회: 시트 칸 1개 낭비, 뜻이 숨는다.
- 자세별 머리 자리(시트 `head` 칸별): 지금 쓰는 화면이 없어 비용만 는다.