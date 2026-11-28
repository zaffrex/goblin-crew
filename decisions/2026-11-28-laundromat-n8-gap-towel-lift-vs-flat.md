---
schema: 1
id: acd4190b-c9f3-4736-ba44-ae8b42ff9fe2
title: 빨래방 v2 N8 틈 밖 수건은 한 띠 칸을 쓰고, 마름은 열쇠 위 아치 들뜸, 젖음은 들뜸 0으로 덮어서 가른다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: laundromat-v2-art
scope: [art/scenes/laundromat.gap-towel.mjs, docs/design/screens/laundromat-v2-gap-preview.mjs]
related: [498efd4d-7252-460c-b273-eb51b0fdee0e, 1f3f1475-3336-45ce-9cd0-aeaa6c5a1597]
revisit_when: Mia 기록이나 진마씨 플레이에서 T5 "왜 빈손인지"를 못 읽거나, 클리어 cover에서 젖은 수건이 틈 속 길바닥에 묻혀 "열쇠가 그냥 왔다"로 적히면
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1076
  - issue: zaffrex/goblin-crew#1067
---
## 결정
- N8(바닥에 납작 미끄러지는 수건 띠)은 31×5 손그림 1칸이고, 자리·들뜸·색은 코드다(`gapTowel(img, pose)`).
- T5 `slip`(마른 수건): 같은 띠가 열쇠를 덮는 자리에서 오른쪽 반이 아치로 6px 들떠, 아치 밑으로 열쇠 금색이 절반 이상 보인다.
- 클리어 첫 박자 `cover`(젖은 수건): 들뜸 0으로 열쇠 금색·나무 패를 다 덮는다. 색은 N4와 같은 한 단 내림.
- `back`(빈 수건 돌아옴): 가게 바닥에 두고 열쇠와 가로 18px 이상 떨어뜨린다.
- 셔터 바깥 픽셀은 판 아래 끝(244 − gapLift)보다 위를 외곽선까지 잘라 그린다.
- 설계 9-2절의 "색만 바꾼다"는 "색 + 들뜸 0"으로 읽는다. 칸 수(13칸)는 그대로다.

## 이유
- 틈이 6~14px라 열쇠 위 빈 줄이 3~6px뿐이다. "위로 날아 지나가기"는 들어갈 자리가 없다.
- 들뜸(가벼움) ↔ 착 붙음(무거움)이 퍼즐 이유(가벼워서 안 끌린다)와 같은 축이다.

## 검토했지만 택하지 않은 안
- 수건이 열쇠 너머 먼 줄(틈 꼭대기)로 날아가는 그림: 첫 시안에서 열쇠 이를 가리고 파도처럼 읽혔다.
- 젖은 수건을 마른 것과 같은 아치 모양에 색만 바꾸기: 덮었다는 게 안 읽힌다.

## 당시 상황과 제약
- 블라인드 2회(1배, 새 에이전트): 1회차는 빈 수건 끝이 열쇠 바로 밑이라 "끌어내기 성공"으로 읽혔다. 떼어 놓은 2회차는 "빈손" ✅, "가벼워서" ❌. 이유는 움직임·대사·라벨이 맡는 쪽을 PM·Kai에게 물었다(N5 #1074와 같은 모양).
- 젖은 teal(Y86)과 틈 속 dusk(Y87)의 명도 차가 1이다. 색상과 ink 외곽선으로만 갈린다.