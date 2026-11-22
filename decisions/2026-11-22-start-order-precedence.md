---
schema: 1
id: e98f6115-5bdf-4479-9d2e-28de6784c4f2
title: "플레이 순서 우선순위: playtest order > ?screen= 화면 하나 > 배포 order.json"
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: screen-order
scope: [src/core/flow.ts, src/main.ts, scripts/playtest/solve.ts, content/screens/order.json]
revisit_when: 세이브(#767)를 붙여 "이어 하기"가 생기거나, 특정 화면부터 순서를 이어 시작하는 디버그 링크가 필요해질 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#766
  - pr: zaffrex/goblin-crew#789
---
## 결정
`flow.ts` `startOrder`가 이번 판 순서를 이렇게 고른다.
1. `?playtest=1&order=a,b`가 맞으면 그 순서
2. `?screen=<id>`가 있으면 null(그 화면 하나, 연결 경로를 안 탄다). 모르는 id여도 기본 화면 하나
3. 아니면 배포 `content/screens/order.json`. 파일이 틀리면 null(화면 하나) + 콘솔 에러

`order.json`은 ADR-0065 8절대로 `content/screens/`에 두고, 그 폴더를 훑는 곳(번들 glob, 테스트)은 `order.json`을 뺀다.

## 이유
`?screen=`은 재생·프레임 도구(`solve.ts --screen`, `frames.ts`)와 화면 2 확인 링크가 "그 화면 하나만"을 기대하고 쓴다. 쿼리 없는 배포본을 연결하면서 이 동작을 바꾸면 도구와 기존 확인 링크가 다 깨진다. playtest order는 명시적 덮어쓰기라 가장 먼저다. 틀린 `order.json`으로 판이 안 열리는 것보다 화면 하나가 낫다(테스트가 먼저 막는다).

## 당시 상황과 제약
진마씨가 중간본을 이어서 해 보고 싶어 해서 #766을 앞당겼다. 임시 순서는 `docs/decisions/2026-11-22-default-link-interim-order.md`.

## 검토했지만 택하지 않은 안
- `?screen=<id>`를 "배포 순서에서 그 화면부터 시작"으로 바꾸기: 도구가 화면 하나 카드(`soloCardKey`)를 기대해서 깨지고, 순서에 없는 화면은 다시 예외가 필요하다
- `order.json`을 `content/order.json`으로 옮겨 폴더 스캔 수정을 피하기: ADR-0065 8절 위치와 달라 ADR 개정이 필요하다