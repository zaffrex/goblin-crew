---
schema: 1
id: bc3c9a81-7909-4542-9094-c058f8569d84
title: R1 새 칸 검사는 물건 anim의 n번째 변형(`대상.이름#k`)도 같은 화면 줄이 부르는 반응 칸으로 센다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: r1-cell-budget
scope: [tests/art/r1-cells.test.ts]
revisit_when: n번째 변형 말고 화면 데이터가 이름으로 부르지 않는 물건 anim이 새로 생기거나(코드가 직접 부르는 anim), ADR-0422 세는 법이 바뀔 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#942
  - issue: zaffrex/goblin-crew#764
  - issue: zaffrex/goblin-crew#765
---
## 결정
`tests/art/r1-cells.test.ts`의 반응 칸 세기에서, 화면 데이터가 `["대상", "이름"]`으로 부르는 물건 anim은 `anims["대상.이름"]`뿐 아니라 `anims["대상.이름#k"]`(#765 n번째 변형)의 `frames`·`variants[].frames`도 반응 칸으로 센다.

## 이유
엔진은 같은 `show` 줄이 두 번째부터 `이름#2`를 고른다(#765). 그런데 검사가 정확한 키만 봐서 `laundromat` `dryer_3.burst#2`의 고유 칸이 "기본 칸도 반응 칸도 아닌 칸"으로 실패했다(PR #942). `magpie.snub#2`는 칸이 다른 anim과 다 겹쳐서 그동안 안 드러났을 뿐이다. 짧은 판도 플레이어가 보는 반응 그림이라 R1 비용에 들어가야 한다.

## 당시 상황과 제약
빨래방 시트 2/2-a(PR #942, #764)에서 처음 고유 칸을 가진 `#k` 변형이 생겼다. 고친 뒤 `magpie_nest`·`park_fountain` 장부 숫자는 그대로였고, `laundromat`은 33/15 → 44/17이 됐다.

## 검토했지만 택하지 않은 안
- `#k` 칸을 기본 칸으로 빼기: 짧은 판도 새 그림이 들 수 있어서 예산에서 빠지면 R1이 비용을 덜 센다.
- 분류 검사에서 `#k`만 예외로 두기: 장부에 안 잡혀 리뷰어가 diff에서 칸 증가를 못 읽는다.