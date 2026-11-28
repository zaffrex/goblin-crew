---
schema: 1
id: a8c9d0d4-4ac0-4c92-9f04-4ebb2490ed96
title: 내려놓은 물건은 크기 그대로 아래 가운데를 쭉이 몸 앞(안 되면 등 뒤) 바닥 점에 옮기고, 놓인 자리는 연출 대기열이 빌 때만 지운다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: held-item-draw
scope: [src/core/scene.ts, src/core/interact.ts, src/core/sceneArt.ts, src/main.ts]
related: [15df458b-61ed-48bd-a139-c32bd2b15e6d, 73250029-c752-4d16-b5b6-edb224d29073, 3652cc6f-8376-42f6-bd64-2f68c20f4d7d]
revisit_when: 놓인 물건이 앞쪽 낮은 퍼즐 대상 상자와 겹친다는 보고(Luna v2 1배 PNG 확인 포함)가 나오거나, 바닥 띠 높이가 다른 `free` 자리(위층 바닥 등)에 물건을 놓는 화면이 생길 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#1065
  - issue: zaffrex/goblin-crew#1031
---
## 당시 상황과 제약
ADR-1031 4절(116줄): 내려놓은 위치는 퍼즐 상태가 아니고, 엔진이 쭉이가 선 `free` 자리의 x에 그리고 핫스팟 상자를 옮긴다. 빨래방 v2(#1061 5절)는 놓인 자리가 `variants`보다 먼저 이기고, 집거나 `present`가 꺼지면 지워져야 젖은 수건이 바닥 `variants` 자리로 나온다.

## 결정
- UI 상태 `SceneState.placed: Record<물건 ID, 점>`. `put`이 맞은 행동에서 `putPoint`(`scene.ts`)가 고른 점을 적는다. 판을 새로 만들면 빈다(저장 안 함).
- 점: 쭉이 서 있기 몸 상자(시트 `hit`·`anchor`, 보는 방향 반영) 앞 끝 + `APPROACH_GAP`(2) + 물건 폭/2. 오른쪽을 보면 발 x + 15 + 2 + 폭/2, 왼쪽을 보면 발 x − 15 − 2 − 폭/2. 그 상자가 걷기 영역(`walkAreaOf`, 양 끝 포함)을 넘으면 등 뒤(13 + 2 + 폭/2), 둘 다 넘으면 발 x. y는 발 y. 폭은 놓은 뒤 상자(`variants` 반영).
- 상자는 지금 상자(`variants` 반영) 크기 그대로, 아래 가운데를 그 점에 둔다(`placedBox`, 가로 `round(x − 폭/2)`). `hotspotBox(..., placed)`·`TapContext.placed`·`targetBox`·`approachPoint`·낮은 대상 목록이 같은 상자를 쓴다.
- 그림은 멈춘 모습 칸 아래 가운데를 같은 점에 맞추는 dx·dy(`placedShifts`, `carriedPlace`와 같은 셈)를 `frameNudges`로 그 물건의 모든 칸에 준다.
- 지우기는 연출 대기열이 빌 때(`prunePlaced`, `sceneTick`의 `settle` 직전)만: 다시 들었거나(`hands === id`) `present`가 꺼진 물건.

## 이유
- 집는 즉시 지우면 다시 집으러 걸어가는 동안과 집기 0번 칸(`carry: null`)에서 물건이 원래 자리로 튄다. 손 그림이 `handsShown`으로 미뤄지는 것과 맞추려면 연출이 끝난 뒤 지워야 한다. 입력 쪽은 든 물건·없는 물건이 이미 `hotspotBox` null이라 늦게 지워도 판정이 안 바뀐다.
- 발 x에 두면 그리는 순서(물건 → 사람) 때문에 쭉이 다리에 가린다. Luna가 서 있기 0번 칸으로 겹쳐 잰 값: v2 동전 0%, 수건 16%, 바구니 42~50%만 보였다. 앞쪽 자리는 셋 다 100%이고, 몸 `hit` 상자와도 안 겹쳐 쭉이를 고른 채 눌러도 물건이 먼저 잡힌다(#1066 리뷰).
- 발 y를 같이 적으면 바닥 띠 높이를 화면마다 따로 정할 필요가 없고, 그림이 쭉이 발과 같은 줄에 선다.

## 검토했지만 택하지 않은 안
- 발 x 그대로(이 PR 첫 커밋): 위 가림. v2 `coin_put` 길에서 동전이 사라진 것처럼 보인다.
- 앞쪽 낮은 퍼즐 대상과 겹치면 뒤쪽: 이 PR에선 안 넣는다. 겹침이 실제로 나오면 그때 한 줄 더한다.
- 집기·`take` 순간 바로 지우기: 위 순간이동.
- x만 저장하고 y는 그 물건 `variants` 바닥 상자에서: 바닥 상자가 없는 물건(덕트 위 수건 등)은 y를 정할 곳이 없다.
- 고정 슬롯 목록: ADR-1031 PM 판단 ②에서 이미 받지 않음.