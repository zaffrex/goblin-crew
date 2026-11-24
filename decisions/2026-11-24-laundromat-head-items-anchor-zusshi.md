---
schema: 1
id: 4de95253-eb32-436b-bdb0-0776c2188fc2
title: 빨래방 머리 위 물건(양말·깃털·둥지)은 `anchor`로 ズッシー 머리에 그리고, 대기열이 빌 때까지만 남긴다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: laundromat-head-items
scope: [docs/design/screens/laundromat.md, content/screens/laundromat.json, art/scenes/laundromat.*]
related: [2620d7b4-effa-454a-9b94-3aea162bad0c]
revisit_when: Luna 재리뷰에서 대사 끝까지만 남기는 것이 박자 눈금 ④(몸에 남음)로 인정되지 않거나, 9-3 블라인드·Mia 플레이에서 "둥지가 하늘에서 떨어졌다"가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#900
  - issue: zaffrex/goblin-crew#901
  - issue: zaffrex/goblin-crew#897
---
## 결정
- 스테이지 3 `laundromat`의 머리 위 물건 셋(★① 양말, 1-2·3-2 깃털, 클리어 둥지 모자)은 Theo의 `anchor` 기능(#901, 형식 기록 개정 11)으로 캐릭터 얼굴 상자 기준에 그린다.
- 클리어 둥지 모자를 받는 사람은 **ズッシー**다.
- 머리 위 물건은 **연출 대기열이 빌 때까지(대사 끝)만** 남긴다. "다음 행동까지 남기기"(Theo 추측 +40줄)는 넣지 않는다.

## 당시 상황과 제약
- 머리 자리가 발 y 200~252 어디든이라 지금 엔진으로는 머리 위 물건을 못 그린다(PR #900 Theo E5).
- Luna 박자 눈금 ④(결과가 몸에 남음)가 웃긴 박자 셈(H1)에 들어간다.

## 이유
- 양말 → 깃털 → 둥지가 한 사람 머리에서 이어져야 세 번째 박자가 반복 개그로 읽힌다(Luna). 정답 두 순서 모두 클리어 때 ズッシー는 건조기 옆 약 40px 안이다.
- 남기는 시간은 엔진 코드를 최소로 두고, 판정에서 아쉽다는 말이 나오면 그때 늘린다.

## 검토했지만 택하지 않은 안
- 둥지 모자를 ノビー가 받기: 클리어 때 늘 문 앞 x 367이라 "문 → 머리" 길은 그리기 쉽지만, 머리 위 반복이 끊긴다.
- ④를 빼고 바닥에 떨어뜨리기(엔진 0): H1이 커밋 순서 3 → 2로 떨어진다.
- 다음 행동까지 남기기(+40줄): 지금은 필요가 확인되지 않았다.