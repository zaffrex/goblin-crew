---
schema: 1
id: fcc649e5-4a6a-4263-b1c5-4b386d02755c
title: QA 회차 장부는 저장소 파일이 아니라 이슈 댓글 `QA-ROUND:` 줄에 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-27
owner: "@zaffrex"
topic: qa-round-ledger
scope: [scripts/qa/round.ts, scripts/qa/round.test.ts]
revisit_when: PM이 아닌 역할도 동시에 Mia를 부르게 되어 check/claim 경쟁이 실제로 중복 회차를 만들 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#1012
  - pr: zaffrex/goblin-crew#1019
---
## 결정
QA 회차 이름은 해당 이슈의 댓글 한 줄 `QA-ROUND: <이름>`으로 적는다. `scripts/qa/round.ts claim`이 같은 이름(공백·대소문자·전각 차이 무시)이 이미 있으면 exit 1로 끝나 Mia를 부르지 않는다.

## 이유
회고 #2 A2(#1012): 같은 블라인드를 두 번 돌려 사용량이 낭비됐다(#764). 댓글 장부는 PR 없이 바로 쓰고, 어느 역할 실행이든 같은 곳을 읽는다.

## 검토했지만 택하지 않은 안
- 저장소 파일(`docs/` tsv): 기록마다 PR·머지를 기다려야 해서 Mia 호출 직전의 확인으로는 느리고, 그 사이 중복이 생긴다.
- 이슈 본문 "이번 회차" 절만 보기: 본문은 Mia가 읽는 지시문이라 장부와 섞이고, 수정 이력이 남지 않는다.

## 알려진 한계
check와 claim 사이 동시 실행은 잠금이 없다. 부르는 쪽이 PM 한 명이라 허용한다.