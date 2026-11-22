---
schema: 1
id: 6182ce95-8bd8-4be7-b960-0f64e9a2021d
title: 그림 칸 시간 상한 같은 그림 쪽 고정 검사는 미리보기 스크립트가 아니라 CI에서 도는 vitest(tests/art/)에 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: art-checks
scope: [tests/art/**, docs/design/screens/*-preview.mjs]
revisit_when: 미리보기 검사(docs/design/screens/*-preview.mjs)가 CI에서 돌게 되면, 두 곳 중 한 곳으로 모은다
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#820
  - pr: zaffrex/goblin-crew#816
  - issue: zaffrex/goblin-crew#802
---
## 결정
연출 길이 한도(ADR-0761 H5·H6)를 지키려고 시트 anim의 칸 시간 합을 고정하는 검사는 `tests/art/`의 vitest 테스트로 둔다. 빌드된 `public/scenes/<화면>-objects.json`을 읽는다. 첫 예는 `tests/art/park-fountain-timing.test.ts`다(`floor.pigeons_perch` + `jacket.slide` ≤ 2070ms).

## 이유
- 미리보기 검사(`docs/design/screens/<화면>-objects-preview.mjs`)는 사람이 직접 돌릴 때만 실행된다. CI 테스트·워크플로 어디에서도 부르지 않는다. 그래서 그림 PR에서 칸 시간을 늘려도 아무도 못 잡는다. 이 검사의 목적이 바로 그걸 막는 것이다.
- vitest는 `npm test`로 CI `check`에서 돌아서, 상한을 넘으면 PR이 막힌다.

## 당시 상황과 제약
`park_fountain` S2 정답 2번이 replay로 +1.38초라 H5 한도 1.5초까지 0.12초만 남았다(PR #816 Theo 우려 1). 처음에는 미리보기 스크립트에 검사 줄을 넣었다가 CI에서 안 돈다는 걸 알고 옮겼다.

## 검토했지만 택하지 않은 안
- 미리보기 스크립트에 검사 줄 추가: 그림 작업 때 눈에는 띄지만 강제력이 없다.
- 두 곳 다 넣기: 상한 숫자가 두 곳에 생겨 고칠 때 어긋날 수 있다.