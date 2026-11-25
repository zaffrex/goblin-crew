---
schema: 1
id: ed1aa819-eab5-4a9e-b4b3-1c99f3fe8823
title: 대상 앞까지 걷는 사람의 설 곳이 가만히 서 있는 동료와 겹치면 그 동료가 비켜 서고 행동하는 쪽을 본다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: character-overlap
scope: [src/core/scene.ts, src/core/sceneMakeRoom.test.ts]
related: [2fe7d080-f6b6-4336-a8a4-08b51926246f, 56576de5-4721-4a10-8828-cb63356d0e1f, 5b5d751a-2cb2-43bf-9193-3a836dbc03e1]
revisit_when: 비켜 서는 걸음이 "누가 왜 움직이지?"로 읽힌다는 플레이 기록이 나오거나, 비켜 설 거리가 길어 다음 행동을 기다리게 만들면
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#968
  - pr: zaffrex/goblin-crew#969
---
## 결정
- `scene.ts` `makeRoom`: 행동하는 캐릭터가 바닥에서 대상 앞까지 걸어갈 때(`approachPoint`) 설 곳의 몸 상자가 가만히 서 있는 동료(바닥 자리, 걷기·깡충 아님, 이번 행동 이벤트에 안 나옴)와 겹치면, 그 동료가 탭한 틱에 엔진 걷기로 비켜 선다.
- 설 곳: 지금 x에서 가장 가까운 x 중 걷기 영역 안 + 행동하는 몸·다른 동료와 안 겹침 + 낮은 퍼즐 대상과 `APPROACH_GAP` 넘게 떨어짐. 몸 상자는 걷는 방향·돌아선 방향 둘 다로 본다. 같으면 왼쪽, 없으면 몸만 피하는 곳, 그것도 없으면 그대로. y 그대로. 도착하면 행동하는 쪽을 본다(`stepOff` 착지 재사용). 기절 행동에서는 안 한다.
- 팀 기록은 `docs/decisions/2026-11-26-approach-make-room.md`, 설계 `ui-interaction.md` 5-2-7절이 우선이다.

## 이유
빨래방 ズッシー × 3번 건조기 설 곳이 プピ 시작 자리를 덮어 プピ가 사라지고 말풍선 화자가 틀려 보였다(#968). 클리어 길이 466틱 그대로이고 화면 1·2 정답 길에서는 안 켜진다.

## 검토했지만 택하지 않은 안
- 화면 JSON `floor` x 옮기기: ノビー 걷기가 늘어 250에서 486틱, 240에서 493틱으로 H6 480틱 잠금과 부딪힌다. プピ만 옮기는 필드는 코어 타입 변경.
- 그리기 순서로 プピ를 앞에: ズッシー가 대신 가려진다.