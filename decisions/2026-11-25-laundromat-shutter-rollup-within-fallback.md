---
schema: 1
id: 361c83e7-c362-4211-a5cd-daa3f5a08f84
title: 빨래방 클리어 셔터 올라감(`shutter.roll_up`)은 잠김·올라감 그림을 섞은 21px 4칸 + 올라감, 합 480ms로 엔진 폴백 0.5초 안에 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-clear-timing
scope: [art/scenes/laundromat.mjs, tests/art/laundromat-timing.test.ts]
revisit_when: "Kai #802 (d)로 빨래방 클리어가 8초 안에 들어와 여유가 생기거나, Mia #935·진마씨 플레이에서 셔터가 열리는 순간이 안 보인다는 보고가 나올 때"
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#764
  - issue: zaffrex/goblin-crew#802
---
## 결정
- `shutter.roll_up`(클리어 마지막 박자)은 올라감 그림 위에 잠김 그림의 판을 21px씩 끌어올린 4칸 + 올라감 그림(= `key.back` 멈춘 모습) 1칸이다. 손그림 0칸, ms 90·90·90·90·120 = 480ms.
- `tests/art/laundromat-timing.test.ts`가 합 ≤ 500ms(엔진 폴백)를 막는다.
- 진입 연출 `gap.glint`는 둥지 반짝과 같은 별(`sparkStar`)을 틈 안 110,234에 작은 별 → 큰 별 → 작은 별 → 멈춘 모습(500ms)으로 띄운다.

## 이유
- 빨래방 클리어는 이미 ADR-0761 H6 8초를 넘는다(11/25 replay 10.95초, #802 (d)). 시트에 anim이 없을 때 엔진은 0.5초를 쓰므로, 그림이 붙으면서 클리어가 더 길어지면 안 된다.
- 21px은 R3(칸 사이 이동 21px 안)이다.

## 검토했지만 택하지 않은 안
- 설계 문서의 1.0초: H6 넘침을 0.5초 더 키운다.
- 3칸(26px씩): 칸 하나를 아끼지만 R3를 넘는다.