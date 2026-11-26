---
schema: 1
id: 220ea3d8-8bd5-4de5-906a-7dfe244b0aa2
title: 말풍선 아닌 연출(busy) 중 화면 속 동료의 그린 알파 칸을 누르면 바로 전환한다(매달린 사람·움직이는 사람 제외)
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-26
owner: "@zaffrex"
topic: busy-input
scope: [src/core/scene.ts, tests/art/busy-mate-switch.test.ts, docs/design/ui-interaction.md]
revisit_when: Mia·진마씨 플레이에서 "연출 중 사람이 멋대로 바뀌었다"가 나오거나, 연출 중 동료 클릭이 호버 라벨 없음 때문에 또 헛클릭으로 보고될 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - url: https://github.com/zaffrex/goblin-crew/blob/main/docs/decisions/2026-11-26-busy-mate-switch.md
  - issue: zaffrex/goblin-crew#935
---
## 결정
`sceneTap`은 말풍선이 아닌 연출 중 화면 속 동료의 보이는 그림 칸(`drawnBodies`, 여유 0)을 누르면 진행 중 이벤트를 건드리지 않고 바로 전환한다(`ui-interaction.md` 5절 예외 다섯). 팀 기록은 `docs/decisions/2026-11-26-busy-mate-switch.md`가 우선이다.

## 이유
See `docs/decisions/2026-11-26-busy-mate-switch.md`.