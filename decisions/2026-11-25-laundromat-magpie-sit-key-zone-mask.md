---
schema: 1
id: c21eff40-e994-4ef6-9278-522aa9e240d1
title: 빨래방 앉은 까치는 둥지 위에 그리고, 열쇠 자리(x ≥ 79, y ≥ 36)는 늘 비워 재사용 포즈가 고리·끈을 안 가리게 한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-magpie-sit
scope: [art/scenes/laundromat.objects.mjs, docs/design/screens/laundromat-magpie-peek-preview.mjs]
related: [675d4bae-5cfa-4ea1-a048-f4fb443b2358]
revisit_when: 빌드 연결(시트) PR에서 그리는 순서나 snub 뒤집기 방식이 바뀔 때, 또는 블라인드에서 내려다보기가 "둥지 속을 쪼는" 그림으로 읽힐 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#764
  - pr: zaffrex/goblin-crew#920
---
## 결정
- 스테이지 3 `laundromat` 앉은 까치(`magpieSit`, 60,27 20×18)는 그리는 순서 nest → magpie(까치가 둥지 위)로 둔다.
- 앉은 까치 그림은 **열쇠 자리 `MAGPIE_KEY_ZONE`(x ≥ 79, y ≥ 36)를 늘 비운다.** 둥지가 비어 있어도 비워서 그림이 튀지 않게 한다.
- 이 마스크에 걸리는 건 재사용 포즈뿐이다: `puff` 배 끝 4px(대기 0.3초), 좌우 뒤집은 포즈(snub) 꼬리 끝 3~4px. 새 칸 내려다보기(`peek`)와 안 뒤집은 `smug`·`flick`은 0px.
- 검사(`laundromat-magpie-peek-preview.mjs`)는 포즈 전부(smug·flick·puff·peek) × 뒤집기 2 = 8장에서 "열쇠·패·끈·고리 외곽선 가림 0"을 본다. 결정 675d4bae("가리는 수 0", 배 오른쪽 끝 x 78)는 그대로 지킨다.

## 이유
- PR #920 Theo 리뷰: 재사용 `puff`가 고리 왼쪽 외곽선 2px, 뒤집은 포즈가 끈 1px를 가렸다. 기존 검사는 `smug`만 봤다.
- 마스크는 새 칸 0이고, 잘리는 곳이 배 끝·꼬리 끝 1px 줄이라 1배에서 안 보인다. 단서 기준(가림 0)을 느슨하게 하지 않아도 된다.

## 검토했지만 택하지 않은 안
- 둥지를 까치 앞에 그리기(순서 magpie → nest): 고리는 안 가리지만 둥지 윗줄(y 43~44)이 발과 내려다보기 부리 끝을 먹어 최대 15px가 가려지고, 내려다보기가 "둥지 속을 쪼는" 그림으로 읽혔다.
- 기준을 "금색·패 밝은 면 0, 외곽선·끈 n px까지"로 나누기(Theo 제안): 결정 675d4bae를 고쳐야 하고, 0.3초마다 고리 외곽선이 몸에 붙는 그림이 남는다.
- `puff`·뒤집은 포즈를 이 화면용으로 새로 그리기: 새 칸 +2~4.