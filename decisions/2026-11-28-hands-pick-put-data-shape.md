---
schema: 1
id: 042fb914-74fd-4b79-8f2d-40dc15f5ddcc
title: "쭉이 손 1칸은 `hands` 상태 + 효과 `pick: true`/`put: true`(물건 = 규칙 대상 핫스팟)로 쓰고, 손 이벤트는 내지 않으며 기절해도 손은 그대로다"
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: item-chain-hands
scope: [src/core/puzzle/**, content/screens/**]
revisit_when: UI 조각(4/4)에서 손 바꾸기 그림에 이벤트가 필요해지거나, 기절 뒤 든 채로 순간이동한 쭉이가 어색하다는 리뷰·QA가 나올 때, 또는 물건 ID와 핫스팟 ID를 나눠야 하는 설계가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1043
  - pr: zaffrex/goblin-crew#1037
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `PuzzleState.hands?: string`(없으면 빈손), 드는 사람은 `PICKER = 'jjuk'`. 파티 `items`와 섞지 않고 세이브하지 않는다.
- 효과 `pick: true`/`put: true`. 물건 ID = 규칙 대상 핫스팟 ID다. `take`가 든 물건이면 손을 비운다(재료로 써서 사라짐).
- 엔진 조건: `pick`은 쭉이 빈손일 때만, `put`은 쭉이가 그 물건을 들고 `free` 자리일 때만 맞는다. 든 물건은 화면 대상이 아니고, 든 채로 쭉이 `stretch`는 `invalid`다.
- 내려놓기 행동 모양은 `{ char: 'jjuk', verb: 'item', item: X, target: X }`이고 걷지 않는다.
- 손 바꾸기 이벤트는 내지 않는다. UI는 행동 앞뒤 `hands`로 그린다.
- 기절해도 손은 그대로다(파티 아이템과 같은 ADR-0018 G2).
- BFS 상태 키는 들었을 때만 `hands`를 붙인다(빈손 키는 전과 같음).

## 이유
- 물건 = 대상이면 ADR-1031 C7 "`pick` 규칙 대상 중 서로 다른 물건 ID 수"를 그대로 센다. 물건 ID를 따로 적게 하면 대상과 어긋날 수 있다.
- 새 이벤트 종류를 넣으면 `scene.ts` 이벤트 스위치까지 코어 PR에 들어온다. 앞뒤 상태로 충분하다.
- 기절 때 손을 비우면 물건이 어디로 가는지(제자리? 쓰러진 자리?) 새 규칙이 필요하다. 아이템과 같게 두는 쪽이 규칙이 하나 적다.

## 검토했지만 택하지 않은 안
- `pick: "sock"`처럼 물건 ID를 값으로: 대상과 중복, 어긋날 위험.
- 내려놓기를 엔진 내장(규칙 없이): ADR-1031 표가 "효과 `put`이 있는 규칙"이고, 못 내려놓는 물건을 데이터로 만들 수 있어야 한다.
- 손 이벤트(`hands` pick/put): 4/4 UI에서 필요하면 붙인다.
- 기절 시 손 비우기: 위 이유.