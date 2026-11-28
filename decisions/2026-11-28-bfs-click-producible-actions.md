---
schema: 1
id: 0b1c0b8a-7743-4189-997b-28e0ad1ca8ac
title: BFS `actions`는 누르기로 낼 수 있는 동사(서는 자리 `move`·자기 능력·`item`)만 시도하고, UI보다 조금 넓은 상위 집합으로 두며 테스트로 UI ⊆ BFS를 고정한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: puzzle-bfs-actions
scope: [src/core/puzzle/check.ts, tests/content/click-actions.test.ts]
related: [042fb914-74fd-4b79-8f2d-40dc15f5ddcc]
revisit_when: 동사 버튼(보기·손)이 다시 생기거나, 화면 JSON에 `look`/`hand` 규칙이 필요해지거나, 서는 자리 `move`+능력 상위 집합 때문에 BFS가 UI로 못 가는 클리어 길을 찾는 화면이 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1058
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `screenHost.actions`(`clickActions`)는 캐릭터 × 대상마다 `move`(서는 자리만) + 그 캐릭터 자기 능력 + `item`(파티 아이템, 쭉이 든 물건)만 낸다. `look`·`hand`와 남의 능력은 안 낸다.
- UI(`interact.ts` `targetIntent`)를 정확히 옮겨 적지 않고, 서는 자리마다 `move`와 능력을 둘 다 넣는 **상위 집합**으로 둔다.
- `tests/content/click-actions.test.ts`가 닿는 모든 상태에서 `targetIntent`가 내는 퍼즐 행동 ⊆ `actions`를 고정한다.

## 이유
- ADR-1031 3절: 틀린 작동 게이지로 노드 ×5 → CI 시간을 줄여야 한다. 세 화면 노드 수·최단·필수 특기 그대로, `checkScreen` 252/125/16ms → 100/44/8ms.
- `look`·`hand`는 #311로 동사 버튼이 없어져 플레이어가 못 낸다. BFS에 두면 실제로 없는 길을 센다.
- 정확히 옮기면 UI 판정(특기 자리·지금 자리)을 코어에 두 벌로 적어야 해서 어긋날 위험이 있다. 상위 집합 + 테스트면 "UI 길을 BFS가 놓침"(막다른·필수 특기 오판)은 막힌다.

## 당시 상황과 제약
- 손 1칸 코어 3/4, PR #1058. 4/4에서 든 물건 누르기를 `targetIntent`에 붙이면 같은 테스트가 그것도 덮는다.

## 검토했지만 택하지 않은 안
- `targetIntent`를 코어에서 불러 정확히 같은 행동만: 코어가 UI 모듈(히트·HUD)에 기대게 되고, 4/4 전에는 든 물건 행동이 빠진다.
- 7동사 전부 유지: 느리고 실제로 못 누르는 길까지 센다.