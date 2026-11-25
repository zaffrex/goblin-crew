---
schema: 1
id: 5b5d751a-2cb2-43bf-9193-3a836dbc03e1
title: 빨래방 클리어 전체 길이는 CI에서 틱으로 재고, 8초 안에 들어오기 전까지는 지금 길이(646틱)를 상한으로 두다가 들어오면 H6 480틱으로 잠근다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: clear-length-h6
scope: [tests/art/laundromat-timing.test.ts]
related: [6182ce95-8bd8-4be7-b960-0f64e9a2021d, 361c83e7-c362-4211-a5cd-daa3f5a08f84]
revisit_when: Kai (d) PR이 빨래방 클리어를 8초 안으로 줄여 KNOWN_OVER_TICKS가 null이 될 때, 또는 다른 화면에도 같은 전체 길이 검사가 필요해질 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#964
  - issue: zaffrex/goblin-crew#802
---
## 결정
- `tests/art/laundromat-timing.test.ts`가 `aha-s6-clear` 사례를 실제 `scene.ts`에 넣고(물건 시트 메타·캐릭터 시트 메타·`ja.json` 글 길이, 엔진 `screenData`와 같은 재료) 마지막 탭 → 대기열 빔을 틱으로 잰다. 마우스·터치 둘 다.
- 상한은 `KNOWN_OVER_TICKS ?? H6_TICKS`다. 지금은 `KNOWN_OVER_TICKS = 646`(11/26 main `120b465`, 10.77초)이라 클리어가 더 길어지는 PR만 막는다.
- 8초(480틱) 안에 들어왔는데 `KNOWN_OVER_TICKS`가 아직 숫자면 잠금 검사가 잰 초와 "null로 바꿔 주세요" 메시지로 실패한다. 그 한 줄을 null로 바꾸면 H6 480틱으로 잠긴다.

## 이유
- 그동안 H6 쪽 검사는 셔터 `roll_up` ≤ 500ms 하나뿐이라, 글·그림·엔진이 클리어를 늘려도 CI가 몰랐다.
- 지금 클리어가 이미 8초를 넘어서(#802 (d)) 480을 바로 걸면 main이 빨개진다. 그래서 지금 값을 상한으로 두고, 들어오는 순간 H6로 잠그게 했다.
- (d) 완료 조건의 "replay로 잰 숫자"를 실패 메시지와 CI가 그대로 내준다.

## 검토했지만 택하지 않은 안
- 480틱을 `it.fails`로 거는 안: 들어오는 순간 왜 실패하는지 메시지가 안 보이고, 늘어나는 걸 막지 못한다.
- 480틱 검사를 `skip`으로 두는 안: (d) 뒤 누군가 켜야 하는데 잊기 쉽고, 그 전까지 늘어나는 걸 막지 못한다.
- 손으로 replay만 하는 안: 지금까지 방식. 다른 PR이 길이를 바꿔도 모른다.

## 당시 상황과 제약
- 우려: 상한이 "지금 값"이라 (d) 전에 다른 PR이 클리어를 조금 줄이면 상한이 느슨한 채 남는다. (d)에서 잠기면 사라지는 문제라 따로 줄이는 장치는 안 넣었다.