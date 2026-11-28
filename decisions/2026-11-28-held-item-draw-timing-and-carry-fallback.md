---
schema: 1
id: 15df458b-61ed-48bd-a139-c32bd2b15e6d
title: 든 물건 그림은 그 행동의 쭉이 첫 연출이 끝날 때까지 옛 손을 따르고, `carry` 없는 연출은 서 있기 첫 칸 점에 얹는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: held-item-draw
scope: [src/core/scene.ts, src/core/sprite.ts, src/core/sceneArt.ts, src/main.ts]
related: [042fb914-74fd-4b79-8f2d-40dc15f5ddcc, 614886db-75d6-47f5-b09e-0daadd8f41a6, 3652cc6f-8376-42f6-bd64-2f68c20f4d7d]
revisit_when: 든 채 받는 반응 연출에서 물건이 갈고리와 떨어져 보인다는 그림 리뷰가 나오거나, 내려놓은 물건을 놓인 자리로 옮기는 조각을 붙일 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1064
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `step`이 쭉이 손(`hands`)을 바꾼 행동은 그림이 `SceneState.handsShown`(옛 손)을 따르다가, 그 행동 이벤트 중 **쭉이 첫 캐릭터 연출(`anim`, target `jjuk`)이 끝날 때** 새 손으로 바꾼다. 쭉이 연출이 없으면 바로 바꾼다. 순번 셈은 플래그 `deferShown`(형식 4-2절)과 같다.
- 그 연출이 재생되는 동안은 손이 바뀌기 전후 중 있는 쪽이 그 물건이고, 칸의 `carry`가 정한다: 점이면 손, `null`이면 제자리(#1056 형식).
- 자세에 `carry`가 없는 연출(든 채 받는 반응 등)은 서 있기(`idle`) 첫 칸 `carry` 점에 얹는다. 그것도 없으면(시트 없음) 손에 안 그리고 제자리에서도 뺀다.
- 손에 그리는 물건은 `sceneArtView.absent`로 제자리 그림(앞판 포함)에서 뺀다. 물건 칸은 그 물건의 지금 멈춘 모습(`pictureOf`)이고 아래 가운데를 점에 맞춘다(가로 `round(x − 폭/2)`, 안 뒤집음).

## 이유
- 퍼즐 상태는 탭 순간 바뀌어서 그대로 그리면 쭉이가 물건 앞까지 걸어가는 동안 물건이 이미 손에 있다. 첫 연출 끝으로 미루면 걷기 동안 제자리, 집기 칸에서 손으로 간다.
- `carry` 없는 연출에서 물건을 숨기거나 제자리로 돌리면 반응 한 번마다 물건이 깜박이거나 튄다. 반응 연출 몸은 대개 서 있기와 가까워 서 있기 첫 칸 점이 덜 어색하다(추측, 그림 확인은 Luna).

## 검토했지만 택하지 않은 안
- 손 바꾸기 이벤트를 코어에 추가: ADR-1031 결정(손 이벤트 없음, 042fb914)과 어긋나고 코어 PR이 된다.
- `carry` 없는 연출 동안 숨기기 / 제자리에 그리기: 위 깜박임 문제.
- 모든 쭉이 연출에 `carry` 필수: 그림 칸 메타 작업이 연출 수만큼 늘어난다. 어색한 연출만 붙인다.