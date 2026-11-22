---
schema: 1
id: 90a1246f-e268-4206-9b83-1a2354735a5a
title: 물건 시트가 있는 화면은 hotspot 전부와 상자 있는 spot 전부를 시트에 그려야 하고, 시트 없는 그림 전 화면은 검사하지 않는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: scene-art-coverage
scope: [tests/art/hotspot-coverage.test.ts, content/screens/*.json, public/scenes/*-objects.json, art/scenes/**]
related: [6182ce95-8bd8-4be7-b960-0f64e9a2021d]
revisit_when: 일부러 임시 상자로 남겨 둘 클릭 대상이 필요해질 때(그때 예외 목록을 L1로 정한다), 또는 엔진의 `uncovered()` 폴백 규칙이 바뀔 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#828
  - pr: zaffrex/goblin-crew#829
  - pr: zaffrex/goblin-crew#827
---
## 결정
`tests/art/hotspot-coverage.test.ts`(vitest)로 고정한다.
- `public/scenes/<id>-objects.json`이 있는 화면마다 hotspot 전부와 `box` 있는 spot 전부가 `coveredIds(meta)` 안에 있어야 한다. 빠진 ID가 있으면 실패한다.
- 대상 기준은 `sceneLayout()`과 같다. 상자 없는 spot(걷기 자리 `floor`·`fountain_seat`)은 대상이 아니다.
- 시트가 없는 화면(그림 전, 예: `laundromat`)은 검사하지 않는다. 그림 PR이 시트를 만드는 순간부터 그 화면 대상 전부를 그려야 머지된다.
- 예외 목록은 지금 두지 않는다.

## 이유
시트가 안 그리는 대상은 엔진이 임시 색 상자로 그린다(`src/main.ts` `uncovered()`, scene-art-format 9절 폴백). PR #827에서 `park_fountain` `statue`가 동상 그림 위에 40×70 보라 판으로 덮였는데 `npm test`는 통과했다. 단서(동상 손)가 가려진 채 QA 6회차에 나갈 뻔했다. 반쪽 그림 배포를 막으려면 CI에서 걸려야 한다.

## 당시 상황과 제약
그림 쪽 고정 검사는 vitest에 둔다는 11/22 기록을 따른다. 재생 도구 A7(`box:<id>`)도 같은 걸 잡지만 사람이 `--require-art`로 돌려야만 보인다.

## 검토했지만 택하지 않은 안
- 재생 도구 A7만 믿기: 사람이 돌려야 해서 #827처럼 빠진다.
- 시트 없는 화면도 검사: 그림 전 회색 화면은 임시 상자가 맞는 동작이라 늘 실패한다.
- 처음부터 예외 목록 두기: 지금 필요한 대상이 없고, 예외가 열려 있으면 빠뜨림이 다시 숨는다.
- 안 보이는 멈춘 모습(개정 9)까지 잡기: 일부러 안 그리는 것이라 `coveredIds`에 들어가는 지금 동작이 맞다.