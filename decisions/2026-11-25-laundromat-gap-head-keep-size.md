---
schema: 1
id: 1d747091-b499-4901-85d2-34df7f9d21cc
title: 빨래방 틈 속 까치 머리는 틈 크기(14px)와 `!` fx를 안 바꾸고 그대로 물건 시트에 굽는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-art
scope: [art/scenes/laundromat.objects.mjs, art/scenes/laundromat.shutter.mjs, docs/design/screens/laundromat-gap-snatch-preview.mjs]
related: [1f3f1475-3336-45ce-9cd0-aeaa6c5a1597]
revisit_when: 시트 뒤 Mia 묶음 플레이에서 "열쇠를 누가 가져갔나"를 까치가 아닌 것으로 적을 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - url: https://github.com/zaffrex/goblin-crew/blob/main/docs/decisions/2026-11-25-laundromat-gap-head-keep-size.md
  - pr: zaffrex/goblin-crew#932
  - issue: zaffrex/goblin-crew#764
---
## 결정
빨래방 `gap.snatch` 틈 속 머리는 틈 크기 14px(`DENT.rise` 8)와 fx 없음 그대로 물건 시트에 굽는다. 팀 기록은 `docs/decisions/2026-11-25-laundromat-gap-head-keep-size.md`다.

## 이유
See `docs/decisions/2026-11-25-laundromat-gap-head-keep-size.md`.