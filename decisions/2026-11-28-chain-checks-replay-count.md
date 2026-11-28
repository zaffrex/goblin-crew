---
schema: 1
id: 4df7b10c-2152-4283-9211-57b751d1f8f3
title: ADR-1031 사슬 검사는 solution 리플레이에서 실제로 맞은 규칙만 세고, 튜토리얼은 상수 목록으로 C1(집기)·C7만 본다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: chain-checks
scope: [src/core/puzzle/check.ts, content/screens/**]
revisit_when: 튜토리얼 화면이 둘 이상이 되거나, 리뷰(Kai·Ben)에서 튜토리얼에도 C4(b)를 걸자고 하거나, C2가 "이미 켜진 플래그를 다시 set하는 변화"를 재료로 세야 하는 설계가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1051
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- C1·C2·C4(b)는 `solution`을 `step`으로 리플레이해 실제로 맞은 규칙(`StepResult.ruleId`)의 `chain` 태그만 센다. 존재하는 규칙 수가 아니다.
- C2 "변화가 켠 플래그"는 `set` 값이 아니라 상태 변화(앞 상태 true 아님 → 뒤 true)로 본다. 결합 쪽은 `when.flags`의 true 값만 간선으로 본다(C6과 같은 셈, false 조건은 간선 아님).
- C4(b)는 화면 `start.at`에 있는 쭉이(`PICKER`) 아닌 캐릭터별로 `solution` 행동의 `char` 기준 `change`·`combine` 규칙 수 ≥1. `use`만으로는 안 된다.
- C7(`pick` 대상 서로 다른 ID ≤4)은 정적 셈이고 `CHAIN_EXEMPT` 화면에도 건다.
- 튜토리얼은 화면 JSON 필드가 아니라 `check.ts`의 `CHAIN_TUTORIAL = ['magpie_nest']` 상수로 판별하고, C1(집기 ≥1)·C7만 본다. C2·C4(b)는 안 본다.

## 이유
- 규칙이 있기만 하고 정답 길에서 안 쓰이면 퍼즐 몸통이 아니다. ADR-1031 표의 셈 열도 "`solution` 리플레이에서"라고 적었다.
- `set`만 보면 이미 true인 플래그를 다시 켜는 규칙이 거짓 통과한다.
- ADR 표가 C2를 "일반 화면"으로 한정했고 C4(b)는 범위가 비어 있어, 튜토리얼에선 집기 하나만 가르친다는 ADR 163줄 취지에 맞췄다. 튜토리얼이 하나뿐이라 필드보다 상수가 싸다.

## 검토했지만 택하지 않은 안
- 튜토리얼 판별을 `ScreenData.tutorial` 필드로: 화면 하나 때문에 형식·검사·문서가 늘어서 보류. 둘이 되면 옮긴다.
- C7을 `validate.ts`로: ADR 2절이 네 검사를 `check.ts` 한 곳에 묶어서 그대로 둠.
- 튜토리얼에도 C4(b): 범위가 ADR에 안 적혀 있어 PR #1051 리뷰에 물음으로 남김.