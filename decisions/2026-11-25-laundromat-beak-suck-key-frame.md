---
schema: 1
id: 23936607-2c34-4b37-8ba6-734681f3b806
title: 빨래방 3-2 `beak_suck` 첫 칸은 앉은 까치 + 부리에 문 금색 고리 합성 1칸으로 한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-art
scope: [art/scenes/laundromat.objects.mjs, docs/design/screens/laundromat-beak-suck-preview.mjs, docs/design/screens/laundromat.md]
related: [1d747091-b499-4901-85d2-34df7f9d21cc, c21eff40-e994-4ef6-9278-522aa9e240d1]
revisit_when: 시트 뒤 Mia 묶음 3-2 길 회차에서 "열쇠를 누가 가져갔나"가 까치 말고 다른 것으로 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#932
  - issue: zaffrex/goblin-crew#764
  - url: https://github.com/zaffrex/goblin-crew/blob/main/docs/decisions/2026-11-25-laundromat-gap-head-keep-size.md
---
## 결정
`magpie.beak_suck` 첫 칸을 smug 앉음 + 부리에 문 금색 고리·자루 합성 1칸(`magpieSitKey`)으로 한다. 팀 기록은 `docs/decisions/2026-11-25-laundromat-gap-head-keep-size.md`(Theo #932 리뷰로 고친 절)다.

## 이유
See `docs/decisions/2026-11-25-laundromat-gap-head-keep-size.md`.