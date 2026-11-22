---
schema: 1
id: 2fe7d080-f6b6-4336-a8a4-08b51926246f
title: 바닥 걷기 도착점이 동료 몸과 겹치면 가장 가까운 안 겹치는 x로 비켜 선다(y는 그대로)
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: floor-walk-stand-point
scope: [src/core/scene.ts]
revisit_when: 플레이 보고에서 "누른 데로 안 간다"가 나오거나, 걷기 영역이 사각형 하나가 아니게 될 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#825
  - pr: zaffrex/goblin-crew#826
  - issue: zaffrex/goblin-crew#601
---
## 결정
`standAside()`(`src/core/scene.ts`)가 바닥 걷기(`intent.kind === 'walk'`)와 `move floor`의 누른 점을 고친다.
- 걷는 캐릭터의 서 있기 몸 상자(`characterHitBox`, 방향 = 걸어갈 방향)가 동료 몸(걷는 중이면 목표 자리, 아니면 `bodies`)과 겹치면, 동료 상자 양옆 2px 틈(`APPROACH_GAP`) 후보 중 걷기 영역 안·누구와도 안 겹치는 x 가운데 누른 x에 가장 가까운 것으로 옮긴다. 같으면 왼쪽, 없으면 누른 점 그대로.
- y는 바꾸지 않는다.
- 5-2-1절 다시 누르기 건너뛰기는 비켜 선 점끼리 비교한다.
- `approachPoint`, 자동 걷기, 퍼즐 상태·BFS·세이브는 바꾸지 않는다.

설계 문서: `docs/design/ui-interaction.md` 5-2-5절.

## 이유
Mia `park_fountain` 5회차(#601)에서 즛시가 동상(클릭 대상 아님)을 눌러 y 200에 섰는데 노비(224,242)와 x 2px 차이라 몸이 겹쳤다. 걷기 영역 높이(52px)가 몸 높이(50~64px)보다 작아서 x가 겹치면 y가 달라도 그림이 겹친다. 그래서 y가 아니라 x로 비켜야 한다.

## 당시 상황과 제약
`layout-check`(#821)는 몸↔바닥 물건만 보고 캐릭터끼리는 안 본다. Luna가 #601에서 엔진 쪽 몫(p2, Theo 판단)으로 넘겼다.

## 검토했지만 택하지 않은 안
- 겹쳐 서기를 그대로 둠: 5회차에서 "어색한 곳"으로 보고됨.
- y로 앞뒤 비키기: 걷기 영역이 낮아 y를 바꿔도 몸이 겹친다.
- 대상 앞 걷기(`approachPoint`)까지 적용: 정답 길 설 곳과 H5 연출 시간이 바뀌어 범위 밖으로 뺐다.

## 잃는 것
동료 사이 좁은 틈(시작 배치 40px 간격이면 3~9px)을 누르면 누른 곳이 아니라 무리 끝에 선다.