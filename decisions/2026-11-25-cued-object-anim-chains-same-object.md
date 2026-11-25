---
schema: 1
id: 5b68be9e-cfa7-4789-9fab-2b1c13a451b1
title: 칸 신호로 겹쳐 뜬 물건 anim이 끝나는 틱에 대기열 맨 앞이 같은 물건 anim이면 겹쳐 이어 시작한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: scene-cue-overlays
scope: [src/core/scene.ts, content/screens/*.json]
revisit_when: 신호로 뜬 물건 anim 뒤에 다른 물건 anim이 바로 이어져야 하는 show가 생길 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#955
  - pr: zaffrex/goblin-crew#963
  - url: https://github.com/zaffrex/goblin-crew/blob/main/docs/decisions/2026-11-15-sprite-asset-pipeline.md
---
## 결정
`scene.ts` `tickOverlays`에서 칸 신호로 겹쳐 뜬 물건 anim이 끝나는 틱에, 캐릭터 연출이 아직 돌고 대기열 맨 앞이 같은 물건의 anim이면 그것도 겹쳐 이어 시작한다. 팀 기록은 `docs/decisions/2026-11-15-sprite-asset-pipeline.md` 5-2절 개정 2026-11-26(#955)이다.

## 이유
See `docs/decisions/2026-11-15-sprite-asset-pipeline.md`.

## 검토했지만 택하지 않은 안
- 공용 스프라이트 `common.reach_wobble`에 세 번째 신호 추가: 다른 화면 show에도 영향이 간다.
- show 순서만 바꾸기: `nest_sucked`를 앞당기면 첫 신호(닿기 전)에 빨려서 원인과 결과가 어긋난다.