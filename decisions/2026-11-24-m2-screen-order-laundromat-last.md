---
schema: 1
id: 41ca0bcc-af1e-4a01-a57a-ac0f36893d83
title: M2 데모 순서는 magpie_nest → park_fountain → laundromat로 확정하고, 빨래방이 마지막 판(엔딩)이다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: screen-order
scope: [content/screens/order.json]
related: [2620d7b4-effa-454a-9b94-3aea162bad0c, e98f6115-5bdf-4479-9d2e-28de6784c4f2]
revisit_when: "park_fountain을 #802로 다시 열고 진마씨가 그 판을 웃겼다고 할 때, 4·5번째 판을 붙일 때, 또는 진마씨가 다른 순서를 원할 때"
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#905
  - issue: zaffrex/goblin-crew#897
  - pr: zaffrex/goblin-crew#900
---
## 결정
- `content/screens/order.json`의 지금 순서 `magpie_nest` → `park_fountain` → `laundromat`를 M2 데모 확정 순서로 한다. 바꾸지 않는다.
- 팀 임시 순서 기록(`docs/decisions/2026-11-22-default-link-interim-order.md`) 2번 "#764 그림 머지 날 회의록 순서로 바꾼다"는 취소한다.
- 튜토리얼은 `magpie_nest`, 데모 마지막 판(끝 카드 앞)은 `laundromat`. `park_fountain`의 엔딩 표기는 #802에서 다시 열 때 본다.
- 팀 기록은 `docs/adr/0905-m2-screen-order-laundromat-third.md`(우선).

## 이유
빨래방 B 설계(#897, PR #900)는 세 번째 판 전제다. 첫 놀람이 `magpie_nest`에서 배운 プピ × 까치가 빗나가는 것이라 첫 판이면 사라진다. 가장 센 판을 마지막에 두는 것이 "웃음이 진마씨께 안 닿는다" 문제에 가장 싼 대응이고, 진마씨 스테이지 번호와 게임 안 순서도 같아진다.

## 검토했지만 택하지 않은 안
- 회의록 순서(`laundromat` 첫 판): B 설계를 다시 써야 한다.
- `magpie_nest` → `laundromat` → `park_fountain`: 엔딩 설계는 살지만 진마씨가 "뻔함"이라 한 판으로 데모가 끝나고 번호가 어긋난다.