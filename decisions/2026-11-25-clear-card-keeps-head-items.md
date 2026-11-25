---
schema: 1
id: cb472bb7-17c6-4bfb-b90d-df2121e09e25
title: 빨래방 머리 위 물건은 대기열이 빌 때까지만 남기되, 클리어한 판은 카드 동안 머리 위 칸을 남긴다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-head-items
scope: [src/core/scene.ts, docs/decisions/2026-11-16-scene-art-format-v1.md]
supersedes: 4de95253-eb32-436b-bdb0-0776c2188fc2
revisit_when: 다른 화면 클리어에서 손님·관리인 같은 붙든 제자리 칸도 카드 뒤에 남아야 한다는 판정이 나오거나, 카드 뒤가 아닌 다음 행동까지 머리 위 물건을 남겨야 할 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#973
  - pr: zaffrex/goblin-crew#900
  - pr: zaffrex/goblin-crew#966
---
## 결정
- 빨래방 머리 위 물건 셋(양말·깃털·둥지 모자)은 그대로 `anchor`로 ズッシー 머리에 그리고, 클리어 전 행동에서는 **연출 대기열이 빌 때까지만** 남긴다(이전 결정 그대로).
- **예외: 그 판을 클리어했으면(`cleared`) 대기열이 빈 뒤에도 붙든 머리 위 칸(`anchor` + `hold`)을 놓지 않는다.** 카드가 닫히면 판이 버려지니 남는 곳은 카드 동안뿐이다.
- 다른 붙든 칸(형식 13절 `hold`)과 캐릭터 마지막 장은 지금처럼 놓는다. 화면 1·2 카드 뒤 모습은 그대로다.
- 구현: `src/core/scene.ts` `settle`. 팀 기록은 `docs/decisions/2026-11-16-scene-art-format-v1.md` 16절 개정 13이 우선이다.

## 당시 상황과 제약
- 빨래방 클리어 끝 그림(둥지 모자 위 까치)이 카드가 뜨는 칸에 사라졌다(#973, Luna). 끝 카드는 데모에서 가장 오래 보는 정지 화면이다.
- Kai #966이 "끝 그림이 펀치라인"이라 `clear_magpie` 한 줄 안을 골랐다. H6 8초(466틱)는 카드 뒤 그림만 바뀌어서 안 바뀐다.

## 이유
- 엔진 줄 1개, 새 칸 0칸이다(Luna 방향 1).
- "다음 행동까지 남기기"(+40줄)는 여전히 안 넣는다. 클리어한 판에는 다음 행동이 없다.
- 머리 위 칸만으로 좁히면 `park_fountain` 손님·관리인·チュック `take_off`가 카드 뒤에서 안 바뀐다(#973 완료 조건).

## 검토했지만 택하지 않은 안
- 클리어 때 붙든 칸 전부 남기기: `park_fountain` 카드 뒤 손님·관리인·チュック 자세가 바뀐다.
- 둥지 모자 + 까치를 `key.back` 상태 그림으로 굽기: ズッシー 자리가 고정이 아니라 새 칸 1~2칸 + 자리 맞춤이 든다.