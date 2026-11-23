---
schema: 1
id: 172c8490-3fdc-45eb-9cda-dfd368a826f2
title: 말풍선은 아래 라벨 줄·게이지 띠에 놓지 않는다(라벨이 안 떠 있어도 그 자리를 비운다)
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: speech-bubble-placement
scope: [src/core/bubble.ts, src/main.ts]
revisit_when: "라벨 줄 위치·높이(LABEL_BOTTOM, #label 글꼴)가 바뀌거나, 바닥 화자 말풍선이 옆으로 가면서 단서 물건을 덮는다는 QA 보고가 나올 때"
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#848
  - issue: zaffrex/goblin-crew#601
---
## 결정
`placeBubble`에 넘기는 영역은 게임 화면 전체가 아니라 `bubbleBounds(game, labelBottom, labelFontPx)`다. 아래끝 = 대상 라벨 윗선(`LABEL_BOTTOM` − 라벨 글자 × 1.6). 라벨이 안 떠 있어도 이 자리는 늘 비운다. 최대 폭은 예전처럼 게임 화면 폭이다. 그 위에서는 기존 규칙(위 → HUD 피하기 → 옆 → 가장 덜 덮는 자리 #598)을 그대로 쓴다.

## 이유
`park_fountain` 묶음 1-1(`r2-b.png`)에서 분수 앞 바닥 ノビー의 젖는 대사가 발 아래로 뒤집혔다. 그 말풍선이 아래끝까지 밀려 게이지 막대와 첫 감소 안내 `ゲージが1マス減った！…`를 함께 덮었다. 첫 감소는 다치는 실패의 첫 말풍선과 같은 순간에 나와서 늘 겹치고, 게이지 규칙을 배울 유일한 글이 안 읽힌다. 영역만 줄이면 기존 비용 비교가 옆 자리를 고른다. 1280×720은 오른쪽 옆, 844×390은 왼쪽 옆이다.

## 당시 상황과 제약
묶음 판정 중이라 게임 번들 변경은 판정 뒤에 머지한다. 라벨은 DOM, 게이지 띠는 캔버스여서 실제 DOM 상자 대신 상수·글자 크기로 계산했다.

## 검토했지만 택하지 않은 안
- 라벨이 떠 있을 때만 피하기: 호버 라벨이 뜨고 꺼질 때마다 말풍선이 위아래로 뛴다.
- 라벨 DOM을 `avoid` 상자에 넣기: `avoid`는 오른쪽으로만 밀어서 가운데 라벨을 못 넘고 결국 가운데에 남는다.
- 겹칠 때 안내 라벨을 말풍선 위로 옮기기: 라벨 자리가 고정이라는 규칙(6-3-5절)이 깨지고, 게이지 막대는 여전히 덮인다.
- 아래 자리가 발 위로 끌어올려지면 후보에서 빼기: 고칠 곳이 늘어난다. 끌어올린 자리는 몸·물건을 덮어 값이 이미 높아서 같은 결과가 나온다.