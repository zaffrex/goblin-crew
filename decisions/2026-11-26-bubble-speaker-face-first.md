---
schema: 1
id: da8df8c3-9ecf-48ae-aeef-404708ddb733
title: 말풍선 자리 비용 순서는 [화자 얼굴, 단서, 동료 몸, 장난감]이고, 처음 자리가 화자 얼굴을 덮어도 옆·후보 비교로 간다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-26
owner: "@zaffrex"
topic: speech-bubble-placement
scope: [src/core/bubble.ts, src/core/scene.ts, src/main.ts]
related: [172c8490-3fdc-45eb-9cda-dfd368a826f2, 1fbc7010-e6a5-4bda-948a-227a5d317366, 0bd90d69-dc2c-40e4-b6c7-d7aa702272a9]
revisit_when: Mia·진마씨 플레이에서 "말풍선이 단서를 가려서 몰랐다"가 나오거나, 납작·엉덩방아 자세에서 얼굴 상자가 실제 얼굴과 어긋나 보일 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#967
  - issue: zaffrex/goblin-crew#970
  - pr: zaffrex/goblin-crew#987
---
## 결정
- `placeBubble`(`src/core/bubble.ts`)의 가장 덜 덮는 자리 비용(`coverCost`)은 **[화자 얼굴, 단서, 동료 몸, 장난감]** 순으로 앞 칸부터 비교한다.
- 처음 자리가 화자 얼굴(`BubbleAnchor.face`)을 덮으면 단서를 덮을 때처럼 옆 → 후보 비교로 간다.
- 얼굴 상자는 `scene.ts` `speakerFaceBox`: 머리 위 칸과 같은 서 있기 얼굴 상자(`headAnchor`). 비켜 서기 대사 중이면 도착점·도착 방향. 자세는 따라가지 않는다.
- 물건 화자(anim 칸)는 얼굴을 넘기지 않아 예전 순서 그대로다.
- 팀 기록은 `docs/decisions/2026-11-26-bubble-speaker-face-first.md`, 설계 `docs/design/ui-interaction.md` 6-5절이 우선이다.

## 이유
바닥 화자의 발 아래 자리는 라벨 줄 위로 끌려 올라와(`bubbleBounds`) 화자 몸·얼굴 위에 놓인다. 예전 비용은 화자를 빼고 세서 그 자리가 0점으로 이겼고, 빨래방 ★① `reverse_first`에서 プピ 얼굴을 통째로 덮었다(#970). 대사 동안 말하는 사람 표정이 개그의 반이다(Luna). cover 비교 8사례에서 단서 가림 숫자 변화는 0이었다.

## 검토했지만 택하지 않은 안
- 뒤집은 자리가 화자와 겹치면 후보에서만 빼기: 더 좁지만 처음 자리 자체가 얼굴을 덮는 경우는 못 고친다.
- 얼굴 상자를 그린 몸 클릭 상자로 자르기: 서 있기에서도 1px 어긋나고, 지금 시트는 자세별 hit가 없어 실익이 없었다.

## 당시 상황과 제약
#935 Mia 묶음 중이라 PR #987은 묶음 판정 뒤 머지한다. 비용: #970 장면에서 말풍선이 옆의 ノビー 얼굴 아래 절반을 덮는다(우선순위상 동료 몸).