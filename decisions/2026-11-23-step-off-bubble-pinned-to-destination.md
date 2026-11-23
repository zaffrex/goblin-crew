---
schema: 1
id: 0bd90d69-dc2c-40e4-b6c7-d7aa702272a9
title: 비켜 서기 대사의 말풍선은 걷는 몸이 아니라 도착점에 선 몸 기준으로 한 번 놓는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: speech-bubble-placement
scope: [src/core/scene.ts, src/main.ts]
related: [56576de5-4721-4a10-8828-cb63356d0e1f, 172c8490-3fdc-45eb-9cda-dfd368a826f2]
revisit_when: 비켜 서기 말고도 대사 중 엔진 걷기가 생기거나, 도착점 위 자리가 단서(길 F 입구 등)를 가린다는 QA 보고가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#866
  - pr: zaffrex/goblin-crew#868
  - pr: zaffrex/goblin-crew#865
---
## 결정
비켜 서기(#862) 대사가 떠 있는 동안 말풍선 화자 상자는 `stepOffBubbleBox`(`src/core/scene.ts`)가 주는 **도착점(`stepOff.to`)에 도착 방향(`stepOff.face`)으로 선 몸 상자**다. 서 있기 자세 `spriteHit`이고, 없으면 `characterHitBox`다. 걷는 동안 프레임마다 자리를 다시 고르지 않는다.
- 화자가 비켜 서는 캐릭터이고 아직 `to`로 가는 중이거나 `to`에 서 있을 때만 쓴다.
- 비켜 서는 중 다른 곳으로 걷기 시작했으면 null이다. 이때는 예전처럼 지금 몸을 따라간다.
- 가리면 안 되는 물건(`bubbleKeepBoxes`)과 다른 사람 몸(`bubbleBodyBoxes`)은 바꾸지 않는다.

## 이유
- 휴대폰 844×390 main `108fd4e`에서 걷는 동안 옆자리가 동료 몸에 막혔다. 그래서 말풍선이 0.2초 만에 옆(443,260)에서 위(365,192)로 튀고, 그 뒤 51px 미끄러졌다(#865 Luna 프레임 리뷰).
- 도착점 기준으로 놓으면 처음부터 413,192에 고정된다. 도착 뒤 main 자리와 같다.
- 도착 뒤 서 있는 몸(`bodies`)과 같은 상자라서 도착하는 순간에도 말풍선이 안 움직인다.

## 검토했지만 택하지 않은 안
- 대사 끝까지 비켜 서기를 미루기: 대사를 닫는 탭이 덮인 몸에 먹힌다(`ui-interaction.md` 5-1-1절).
- 지금 몸 상자를 x만 옮기기: 걷기 칸과 서 있기 칸의 히트 상자가 달라서 도착할 때 어긋난다.