---
schema: 1
id: b2fd759e-149a-4025-b24a-83a76e31c255
title: QA 회차 claim은 gh 실패를 exit 3으로 나누고, 적은 뒤 다시 읽어 동시 claim에서 물러난다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-27
owner: "@zaffrex"
topic: qa-round-ledger
scope: [scripts/qa/round.ts]
related: [fcc649e5-4a6a-4263-b1c5-4b386d02755c]
revisit_when: 회차 claim이 동시에 실제로 겹쳐 Mia가 0회 불리는 일이 생기거나, 장부를 이슈 댓글 밖으로 옮길 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1021
  - issue: zaffrex/goblin-crew#1012
---
## 결정
`scripts/qa/round.ts`의 종료 코드는 0 새 회차, 1 중복(Mia를 부르지 않음), 2 잘못된 입력, 3 장부 읽기·쓰기 실패(중복 아님)다. claim은 댓글에 `claim-id`를 넣어 적고, 적은 뒤 다시 읽어 같은 회차의 첫 댓글이 내 `claim-id`가 아니면 exit 1로 물러난다.

## 이유
gh 실패가 exit 1이면 "중복"과 구분되지 않아 회차가 조용히 안 돈다(Sam, Noah 지적). 잠금 없이 check와 post 사이에 둘이 끼면 둘 다 통과한다(Luna 수정 요청). 다시 읽기는 잠금 없이 이슈 댓글만으로 그 경쟁을 줄인다.

## 검토했지만 택하지 않은 안
- 잠금 파일·외부 잠금: 장부를 댓글에 둔다는 기존 결정과 어긋나고 운영 부담이 늘어난다.
- 현행 유지(exit 1 하나): 실패와 중복이 섞인다.

## 한계
둘이 정확히 동시에 claim하면 둘 다 물러나 Mia가 0회 불릴 수 있다. 중복 호출보다 안전한 쪽이라 받아들인다.