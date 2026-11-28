---
schema: 1
id: 6af3132c-c247-4da6-ab36-b20805f2a467
title: 물건 사슬 퍼즐(ADR-1031)의 첫 적용 화면은 빨래방(laundromat)을 다시 짜는 것으로 한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: item-chain-puzzle
scope: [content/screens/laundromat*, docs/design/*laundromat*]
revisit_when: 빨래방 새 판이 진마씨 플레이에서 다시 "단순하다"는 답을 받거나, 다시 짜는 데 그림 손실이 47칸보다 크게 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#1031
  - pr: zaffrex/goblin-crew#1039
  - pr: zaffrex/goblin-crew#1037
---
## 결정
#1031 설계 회의 PM 정리(2026-11-28)에서 물건 사슬 원칙(ADR-1031, #1037)을 처음 적용할 화면을 빨래방(`laundromat`) 다시 짜기로 정했다. `magpie_nest`(튜토리얼, 집기 ≥1)와 `park_fountain`은 빨래방 새 판이 진마씨께 통한 뒤에 다시 본다.

## 이유
- 진마씨가 가장 최근에 플레이한 판이고, 진마씨의 "건조기가 왜 그렇게 동작하는지 모르겠다"는 지적에 같은 방 안에서 답할 수 있다.
- 방, 세탁기, 건조기, 자판기 그림을 다시 쓸 수 있다. 기계를 누구나 아는 성질(적신다·말린다·내준다)대로 쓰면 장치 쪽 새 그림 칸은 거의 0이다(Luna 1라운드).

## 당시 상황과 제약
- 진마씨 3화면 답(11/28): "퍼즐 요소가 전혀 없다"
- 사용량이 빠듯하다(#117).
- 대가: 역회전 → 흡입 줄에 묶인 그림 약 47칸(≈15h)이 정답 길에서 빠질 수 있다. 반응이나 실패 쪽으로 재사용할 수 있는지는 Kai와 Luna가 설계에서 본다.

## 검토했지만 택하지 않은 안
- 새 4번째 화면: 배경과 장치 그림을 처음부터 그려야 해서 비싸고, 진마씨의 건조기 질문에도 답하지 못한다.
- `magpie_nest` 먼저: 튜토리얼이라 사슬 하한(C1 ≥1)이 낮아서, 진마씨의 "단순하다"를 검증하기에 약하다.

회의록: docs/meetings/2026-11-28-item-chain-design.md