---
schema: 1
id: 0d74c83f-dc3c-4979-bfa9-bd0ba63ff173
title: "핫스팟 없는 그림은 장식 물건(`ids: []`)으로 두고, 다른 대상의 anim이 원본 `object`로 그 물건을 바꿔 그린다"
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: scene-art-format
scope: [art/scene-build.mjs, src/core/sceneArt.ts, src/core/scene.ts, art/scenes/*.mjs]
revisit_when: 장식 물건이 한 화면에 3개를 넘거나, 장식이 클릭·호버를 받아야 하는 그림이 생길 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#901
  - pr: zaffrex/goblin-crew#900
  - url: https://github.com/zaffrex/goblin-crew/blob/main/docs/decisions/2026-11-16-scene-art-format-v1.md
---
## 결정
화면 그림 형식 개정 11: 그림 물건은 `ids: []`를 적으면 장식 물건이 되고, anim 원본 `object`로 그 물건을 바꿔 그린다. 4-2절 (a)의 "그 물건"은 anim이 바꿔 그리는 물건(`animObject`)이다. 내용은 `docs/decisions/2026-11-16-scene-art-format-v1.md` 15절에 있다.

## 이유
See `docs/decisions/2026-11-16-scene-art-format-v1.md`.