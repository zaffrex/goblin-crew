---
schema: 1
id: 3db960c3-7c59-496b-8769-302a5cfdc75a
title: 퍼즐 조사는 원작 공략·화면별 구조까지 읽고 세되, 우리 게임에 옮기는 것은 계속 금지한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: ip-reference-scope
scope: [docs/design/research-*.md, docs/design/screens/**]
revisit_when: 진마씨가 PM 해석과 다르다고 하거나, 설계 리뷰에서 "원작 퍼즐과 닮았다" 지적이 2건 이상 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#1031
  - pr: zaffrex/goblin-crew#1034
---
## 결정
퍼즐 조사는 원작 시리즈(1~3편)와 같은 시대 어드벤처의 공략·화면별 진행 기록을 읽고, 화면마다 구조를 센다. 세는 것은 물건 변화·결합 수, 의존 깊이·폭, 능력이 여는 단계다. 원작의 퍼즐·해법·조합·이름·그림을 우리 게임에 옮기는 것은 계속 금지한다. 원본 기록은 `docs/decisions/2026-11-28-research-original-puzzle-structure.md`(L3, 진마씨)다.

## 이유
진마씨가 1차 조사(설계 글 8편, #1033)를 얕다고 보고 "아무리 IP규칙상 안되도 제대로 조사해"라고 지시했다(`#goblin-ceo` 2026-11-28). 넓히는 것은 조사 범위다. 복제 금지는 IP 리스크 때문에 유지한다.

## 당시 상황과 제약
에이전트는 DOS 게임을 직접 플레이할 수 없어서 공략·기록 글로 본다. 저장소는 공개다.

## 검토했지만 택하지 않은 안
- A. 11/15 선(설계 글·리뷰만) 유지: 진마씨가 부족하다고 한 방식이라 택하지 않았다.
- C. 원작 퍼즐을 비슷하게 옮긴다: 레벨 설계 복제라 IP 리스크가 있어서 택하지 않았다.