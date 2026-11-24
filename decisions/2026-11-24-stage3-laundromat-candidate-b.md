---
schema: 1
id: 2620d7b4-effa-454a-9b94-3aea162bad0c
title: 스테이지 3 `laundromat`은 후보 B "거꾸로 도는 건조기"로 설계한다(진마씨 L3)
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: stage3-laundromat-design
scope: [docs/design/screens/laundromat.md, content/screens/laundromat*]
revisit_when: '#897 설계에서 "첫 시도(건조기 쿵) = 정답 1단계"를 막을 자리가 안 나오면 진마씨께 사실과 대안(A 또는 C)을 다시 올린다'
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#897
  - issue: zaffrex/goblin-crew#894
  - pr: zaffrex/goblin-crew#898
---
## 결정
스테이지 3 `laundromat`은 Kai 후보 문서(`docs/design/stage3-pitch.md`) 3절의 **후보 B「문 밖으로 한 발짝도 안 나가고, 문 밖에 떨어진 열쇠를 줍는다」(거꾸로 도는 건조기)**로 설계한다. 지금 "높은 걸쇠" 초안은 대체한다. 설계는 #897(Kai), 그림 #764는 설계 머지까지 멈춘다. 팀 기록은 `docs/decisions/2026-11-24-stage3-candidate-b.md`(우선).

## 이유
진마씨(L3)가 훅 한 줄만 보고 B를 골랐다(`#goblin-ceo` 2026-11-24). 팀 추천은 C였지만 진마씨 선택을 따른다. 사용률 69%라 리셋 전 바로 진행한다.

## 당시 상황과 제약
스테이지 2가 진마씨께 "뻔함, 웃음 0"이었고, 진마씨가 "스테이지 3은 획기적 아이디어로, 빨리"를 정했다. 풀이는 진마씨께 미리 보이지 않는다.

## 검토했지만 택하지 않은 안
- A 낚시(거품 바다): 자판기 치기가 우연히 나올 위험
- C 따라쟁이 건조기(Kai·PM 추천): 정답 2행동으로 짧고, 핫스팟 이동 엔진 확인 필요
