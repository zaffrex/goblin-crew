---
schema: 1
id: 52818ae3-5ba1-4bfe-bd1c-421a0eeb0940
title: 터치 탭이 걷기 영역 밖을 눌러 바닥 걷기가 되면 `あるく`를 0.6초(또는 다음 탭까지) 띄운다. 영역 안 탭과 마우스는 안 띄운다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: walk-feedback
scope: [src/core/firstNotes.ts, src/main.ts]
related: [2fe7d080-f6b6-4336-a8a4-08b51926246f, f06ba58d-f14b-4665-9c32-61bd046f1ea5]
revisit_when: 다음 모바일 회차 Mia 기록에서 `あるく`가 "여긴 배경"으로 안 읽히거나, 영역 안 걷기에서도 "반응 없음"이 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#601
---
## 결정
`worldTap`(`src/main.ts`)에서 터치 탭(slop > 0)의 결과가 바닥 걷기(`intent.kind === 'walk'`)이고 누른 점이 `WALK_AREA`(양 끝 포함) 밖이면, `noteWalkTap`(`src/core/firstNotes.ts`)이 대상 라벨 자리에 `ui.verb.walk`(`あるく`)를 `WALK_TAP_NOTE_TICKS`(36틱, 0.6초) 또는 다음 탭까지 띄운다. 걷기 시작(`pollWalkStart`) 전에 불러서, 그 탭의 긴 걷기 안내(`walk_skip`)는 안 뜨고 `WALK_NOTE_MAX` 횟수도 안 센다. 설계 문서 `docs/design/ui-interaction.md` 5-2-6절.

## 이유
Mia `park_fountain` 모바일 2회에서 홈통·시계·돌우산 판 탭(전부 y 200 위)은 몸이 누른 곳이 아닌 아래 바닥으로 걸어가서 "반응 없음"과 "실패"를 구분하지 못했다. 데스크톱은 호버 라벨이 이미 `あるく`라 터치만 이 신호가 빠져 있었다.

## 검토했지만 택하지 않은 안
- 모든 바닥 걷기 탭에 띄우기: 휴대폰 탭 중 걷기가 가장 많아 라벨이 자주 깜빡이고 발을 덮는다(#858). 영역 안 탭은 몸이 누른 자리로 가서 걷는 것 자체가 답이다(Luna).
- 반응 없는 소품마다 hotspot 반응 추가: 소품별 대사(Kai)·칸 비용이 들고 안전망이 아니다. 시계 한 줄 반응·홈통 지우기는 이것과 별개로 먼저 한다.