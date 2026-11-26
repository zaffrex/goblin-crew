---
schema: 1
id: 72bb7b22-1990-4407-ba2b-3bd07c7e1440
title: 마지막 판 끝 카드는 결과 줄(<id>.clear_card) + ui.end로 띄우고, ui.end에서 「第1章」·「靴下の謎」를 뺀다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-26
owner: "@zaffrex"
topic: clear-card-text
scope: [src/core/flow.ts, src/main.ts, scripts/playtest/solve.ts, content/text/ja.json]
related: [0e9e0cc0-5465-4ab1-9481-b91675707878, 41ca0bcc-af1e-4a01-a57a-ac0f36893d83]
revisit_when: 휴대폰 회차·진마씨 플레이에서 끝 카드가 "아직 계속", "갑자기 끝남", "왜 끝났는지 모름"으로 또 읽히거나, 3줄 카드가 휴대폰에서 머리 위 칸·얼굴을 덮을 때. 4·5번째 판이 생기면 ui.end 글을 함께 고친다.
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#935
---
## 결정
- `cardLines`의 `body`를 줄 키 배열로 바꾸고, 마지막 판은 `[<id>.clear_card(있으면), "ui.end"]`다. 맵 다시 하기도 같고 다음 줄만 `ui.map.return`.
- `laundromat.clear_card` = `今度こそカギが戻った！`, `ui.end` = `おしまい！\n遊んでくれてありがとう`.
- 팀 기록은 `docs/decisions/2026-11-26-laundromat-last-card-result-line.md`가 우선이다.

## 이유
#935 묶음 2(2/2)에서 이전 끝 카드 `第1章 おわり！\n…消えた靴下の謎、解決。`가 "열쇠와 안 이어짐", 「第1章」 때문에 "아직 계속", "갑자기 끝남"으로 읽혔다. 이전 팀 기록(2026-11-26 card-why-and-last-card, C2 = ui.end만)의 "다시 볼 조건"에 닿았다.

## 검토했지만 택하지 않은 안
- 보류 맺음 컷: 새 그림 칸이 들고 H6 클리어 여유가 0.23초뿐이다.
- ui.end 글만 바꾸기: 공용 끝 카드가 빨래방 문장이 되어 다른 판이 마지막인 순서에서 틀린 글이 된다.