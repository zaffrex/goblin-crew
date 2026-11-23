---
schema: 1
id: 56576de5-4721-4a10-8828-cb63356d0e1f
title: 높은 대상 밑에서 행동한 뒤 몸이 낮은 퍼즐 대상(hintAbility 있음)을 덮으면 그 캐릭터 첫 대사 시작 때 비켜 선다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: floor-walk-positioning
scope: [src/core/scene.ts, docs/design/ui-interaction.md]
related: [2fe7d080-f6b6-4336-a8a4-08b51926246f]
revisit_when: 말풍선이 화자를 따라 움직이는 게 거슬린다는 리뷰·QA 관찰이 나오거나, 장난감(hintAbility 없음) 대상이 가려져 탭이 먹힌다는 보고가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#862
  - pr: zaffrex/goblin-crew#865
  - issue: zaffrex/goblin-crew#601
---
## 결정
`scene.ts` `stepOffPoint`가 정한다(`ui-interaction.md` 5-1-1절).
- 조건: 바닥에서 높은 대상(상자 아래쪽이 `WALK_AREA.top` 위)으로 걸어가 행동했고, 행동 뒤에도 바닥이며(그 캐릭터 `walk`·`place`·`release`, `faint`·`clear` 없음), 행동 자리 몸 상자가 낮은 퍼즐 대상과 겹친다.
- 낮은 퍼즐 대상 = `hintAbility` 있는 핫스팟·자리(행동 뒤 상자) 중 아래쪽이 `WALK_AREA.top` 아래인 것. `hintAbility` 없는 장난감·배경은 덮어도 된다(#598과 같은 구분).
- 설 곳: 낮은 퍼즐 대상과 `APPROACH_GAP` 넘게 떨어지고 동료와 안 겹치는 가장 가까운 x. 온 쪽 먼저, 없으면 반대쪽. y 그대로.
- 때: 그 행동의 그 캐릭터 첫 `say` 시작 때 엔진 걷기. 대사가 닫힐 때 걷기가 안 끝났으면 그 점에 바로 선다(본 대사 잠금 0.4초 대비).
- 퍼즐 상태·BFS·세이브·`approachPoint`는 그대로.

## 이유
장대는 수직이라 행동 자리는 높은 대상 바로 밑이어야 하는데, `park_fountain`에서 그 자리(ノビー x 224)가 땅 비둘기 상자를 덮어 다음 정답 수 탭이 전환으로 먹혔다(468px, #601 모바일 1회 #27). 대사 시작 때 걸으면 대사를 닫는 탭이 늘 비켜 선 몸으로 판정된다.

## 당시 상황과 제약
"행동이 끝나도 그 자리에 남는다"(5-1절)가 기존 규칙이라 예외 하나를 더한다. 분수 테두리처럼 높은 대상 바로 밑에 늘 있는 배경 핫스팟까지 세면 비킬 곳이 없다.

## 검토했지만 택하지 않은 안
- 화면 데이터에 비켜 설 점 필드 추가: `HOTSPOT_KEYS`(src/core/puzzle/validate.ts)를 바꾸는 코어 PR이고 화면마다 손으로 잡아야 한다.
- 대상 `hintAbility`가 지금 캐릭터 특기면 동료 그림보다 대상을 먼저 맞추기(#862 안 B): 입력 규칙 2-1절 변경이라 모든 화면 탭 판정에 퍼진다.
- 대사 끝에 비켜 서기: 말풍선은 안 움직이지만 대사를 닫는 터치 탭이 덮인 몸에 먹힌다(5절 예외 넷 2).
- 모든 겹친 핫스팟을 세기: 분수 테두리 때문에 후보가 없어진다.