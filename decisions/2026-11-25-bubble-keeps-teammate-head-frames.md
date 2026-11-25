---
schema: 1
id: 1fbc7010-e6a5-4bda-948a-227a5d317366
title: 말풍선은 화자가 아닌 사람의 머리 위 칸(anchor anim)을 단서 무게 keep 상자로 피하고, 화자 자기 머리 위 칸은 피하지 않는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: speech-bubble-placement
scope: [src/main.ts, src/core/sceneArt.ts]
related: [1184dab2-feed-43b8-bd14-22427baed537, 4de95253-eb32-436b-bdb0-0776c2188fc2]
revisit_when: 말풍선이 동료 얼굴을 덮는 게 Mia QA나 진마씨 플레이에서 문제로 보고되거나, 화자 자기 머리 위 물건을 말풍선이 덮는 사례가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#947
  - pr: zaffrex/goblin-crew#948
---
## 결정
- `headPlaces(meta, heads, faceOf)`(`src/core/sceneArt.ts`)가 이번 프레임 머리 위 칸(형식 16절) 자리를 한 번 계산하고, 엔진은 그 자리에 그린다.
- 같은 자리 가운데 **화자가 아닌 캐릭터**의 머리 위 칸을 `headKeepBoxes`로 `bubbleKeepBoxes`에 더한다. 무게는 단서(`toy` 아님)다.
- 화자 자기 머리 위 칸은 keep에 넣지 않는다.

## 이유
- 빨래방 3-2에서 プピ가 `laundromat.suck`을 말하는 동안 ズッシー 머리에 꽂힌 깃털이 웃음(설계 8-1 ④)인데, 머리 위 칸이 핫스팟이 아니라 keep 목록에 없어서 말풍선이 덮었다(#947).
- 그리는 자리와 지키는 자리를 같은 함수 값으로 써서 둘이 어긋나지 않게 한다.

## 당시 상황과 제약
- #598 순서(단서 → 동료 몸 → 장난감)를 그대로 쓰므로, 빨래방 3-2에서는 말풍선이 왼쪽 옆으로 가서 ノビー 몸(D1에서는 얼굴 반)을 덮는다. 대사 약 2초 동안이고 그 박자에 ノビー는 할 일이 없다.

## 검토했지만 택하지 않은 안
- 화자 자기 머리 위 칸도 keep에 넣기: 화자 머리 위 자리가 늘 막혀 말풍선이 옆으로만 간다. 2/2-a 양말에서 자기 머리 위 칸은 덮이지 않는 것을 확인했다.
- 장난감(`toy`) 무게로 넣기: 다 막힌 경우 가장 먼저 포기돼 3-2처럼 단서가 오른쪽을 막는 배치에서 다시 덮인다.