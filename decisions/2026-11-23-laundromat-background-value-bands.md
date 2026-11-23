---
schema: 1
id: fac85337-9fb2-4d67-8972-1c96dda314eb
title: laundromat 배경 명도 띠는 천장 dusk / 벽 cotton / 기계 줄 뒤 아래 벽 띠 plum / 바닥 woodL로 하고, 이 위에 올라갈 물건은 띠와 명도 차 30 이상을 지킨다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: laundromat-art
scope: [art/scenes/laundromat.*.mjs, docs/design/screens/laundromat-bg-sketch.mjs]
revisit_when: 3번 건조기·세제 자판기 그림이 들어올 때, 또는 Kai 다시 보기(#802)로 기계 줄·서는 자리가 바뀔 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#857
  - issue: zaffrex/goblin-crew#764
---
## 결정
`laundromat` 방 껍데기(`art/scenes/laundromat.room.mjs`)의 명도 띠를 위에서부터 천장 dusk(Y87) / 벽 cotton(Y222) / 아래 벽 띠 plum(Y54, y 172~235) / 바닥 woodL(Y149)로 한다. 앞으로 이 화면에 그리는 물건(3번 건조기, 세제 자판기 등)은 뒤에 있는 띠와 명도 차 30 이상을 둔다. 시안 스크립트 `laundromat-bg-sketch.mjs` 검사 18줄이 이 기준을 지킨다.

## 이유
- 세탁기 몸 grnL(Y155) 바로 뒤가 아래 벽 띠다. 띠가 plum이면 명도 차가 101이라 세탁기 줄이 한 덩어리로 읽힌다.
- 세 사람 주색 다섯(red 104, dusk 87, teal 86, white 249, yel 208)과 세탁기 몸 모두에서 30 이상 떨어지는 명도는 ≤56뿐이다. 계산하면 세탁기 때문에 ≤125 또는 ≥185, red 때문에 ≤74 또는 ≥134, dusk·teal 때문에 ≤56이 남는다.
- 벽 cotton은 셔터 판 lint와 44, 걸쇠 red와 118 차다. 셔터 오른쪽 걸쇠 자리에는 빨강·갈색이 없다(laundromat.md 9-1).

## 당시 상황과 제약
배경(결정 3-1)에는 ink·hint를 쓰지 않는다. 바닥과 세 사람 사이 명도 차는 30 이상이어야 한다(결정 3-4). 세탁기·셔터 색은 #853·#856에서 이미 정해졌다.

## 검토했지만 택하지 않은 안
- 벽 전체를 밝은 cotton 하나로 칠하는 안(자리 표시 그대로): 세탁기 몸과 67 차는 되지만, ズッシー 흰 셔츠와 27 차라 셔터 옆 벽에서 몸이 묻힌다.
- 중간 명도 띠(Y134~178): 세탁기 몸(155)과 30 차를 만들 수 없다.
- 꺼진 벽걸이 TV: 화면에서 가장 어두운 네모라 셔터·걸쇠보다 눈이 먼저 가서 뺐다.

## 우려
띠와 ズッシー 멜빵·쿵 글자(teal)의 명도 차는 32로 기준선에 가깝다. 그래서 쿵 글자 자리(laundromat.md Q5)는 발치(바닥과 63 차)를 추천한다. 정하는 건 배경을 붙이는 PR에서 Theo와 L1로 한다.