---
schema: 1
id: 86c61b41-eb09-4418-b904-dd387d5be454
title: 쿼리 없는 기본 배포 링크는 늘 최신 main이고, 새 기능을 진마씨 배려로 쿼리 뒤에 숨기지 않는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: deploy-default-link
scope: [src/main.ts, src/core/flow.ts, content/screens/order.json]
related: [e98f6115-5bdf-4479-9d2e-28de6784c4f2]
revisit_when: 대외 공개(L3)를 준비해 공개용 안정판과 개발용 최신 링크를 나눠야 할 때, 또는 진마씨가 고정된 판을 원할 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#766
  - pr: zaffrex/goblin-crew#789
  - pr: zaffrex/goblin-crew#790
  - issue: zaffrex/goblin-crew#767
---
## 결정
쿼리 없는 기본 배포 링크는 늘 최신 main이다. 진마씨가 플레이 중이라는 이유로 머지를 미루거나, 새 기능을 `?playtest=1` 같은 쿼리 뒤에 숨기지 않는다. 쿼리는 팀 도구용(`?screen=` 화면 하나, `?playtest=1&order=` 순서 덮어쓰기, 재생·프레임 훅)으로만 쓴다. 세이브(#767)를 붙일 때 `usesSave`에는 `ORDER`가 아니라 `playtestOrder(...)` 결과를 넘겨, 기본 링크에서는 세이브가 켜지게 한다.

## 이유
진마씨 방침(`#goblin-meeting` M2 플래닝 스레드 2026-11-22): "나를 배려할필요는 없고 … 항상 너희들이 개발하고 잇는 최신을 올려줘". 팀 공식 기록은 `docs/decisions/2026-11-22-default-link-always-latest.md`(L3)다.

## 당시 상황과 제약
11/21 L1 기록(`multi-screen-link-before-planning`)은 진마씨 재플레이 중 배포본이 바뀌지 않게 쿼리 없는 경로를 고정했다. #789로 기본 링크도 `order.json` 순서로 이어지게 되면서, 이제 `ORDER`는 기본 링크에서도 null이 아니다.

## 검토했지만 택하지 않은 안
- 기본 링크를 진마씨 확인용 안정판으로 고정하고 새 기능은 `?playtest=1` 뒤에만: 진마씨가 직접 원하지 않으셨다
