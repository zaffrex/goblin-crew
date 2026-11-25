---
schema: 1
id: 5049a733-d362-4ddf-a49b-95e211309ff3
title: 화면 JSON `walkArea`로 화면별 걷기 영역을 두고(줄이기만), 높은/바닥 대상 기준선은 공통 y 200(`HIGH_TARGET_LINE`)을 그대로 쓴다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: walk-area
scope: [src/core/config.ts, src/core/scene.ts, src/core/puzzle/types.ts, src/core/puzzle/validate.ts, src/main.ts, scripts/layout/check.ts, content/screens/*.json]
related: [2fe7d080-f6b6-4336-a8a4-08b51926246f, 56576de5-4721-4a10-8828-cb63356d0e1f, 52818ae3-5ba1-4bfe-bd1c-421a0eeb0940]
revisit_when: 높은 물건 기준선이 화면마다 달라야 하는 화면이 나오거나, 공통 영역보다 넓은 걷기 영역이 필요한 화면이 생길 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#938
  - pr: zaffrex/goblin-crew#940
---
## 결정
- `ScreenData.walkArea?: { left?, top?, right?, bottom? }`. 적은 키만 공통 `WALK_AREA`(x 16~463, y 200~252)를 덮는다(`walkAreaOf`). 공통 영역 안으로 줄이기만 한다(검사 `walk-area`: 정수, 공통 범위 안, 비지 않음).
- 걷기를 자르는 곳은 전부 화면 값을 쓴다: 바닥 탭, `move floor` 도착점, 비켜 서기 후보 x 범위, 높은 대상 앞 내려서기 아래 끝, 처음 배치, `releasePoint`·`board` 검사, 터치 `あるく` 안내의 "영역 밖", 회색 배치 검사 양 끝.
- 높은/바닥 대상 기준선은 화면 값을 안 따른다. `HIGH_TARGET_LINE`(= 200)을 쓴다.
- 빨래방만 `"walkArea": { "top": 244 }`(셔터 아래 끝 `SHUTTER.y + h`). 다른 두 화면(바닥 위 끝 196·198)은 안 적는다.
- 팀 기록은 `docs/decisions/2026-11-25-per-screen-walk-area.md`가 우선이다.

## 이유
빨래방 그림 바닥이 y 236부터라 공통 영역 그대로면 벽 띠(y 200~235)를 누를 때 발이 벽 위에 섰다(진마씨 보고, #938). 바닥 첫 줄 236에 세우면 셔터 앞에서 발이 셔터 밑 레일(244)보다 8px 위에 떠서, 가장 앞으로 나온 바닥 물건인 셔터 아래 끝 244에 맞췄다(Luna PR 리뷰). 기준선까지 236을 따라가면 아래 끝이 236인 `dryer_3`·`soap_vending`이 높은 대상이 되어, `stomp` 설 곳(옆 → 가운데)과 덕트 뒤 비켜 서기의 낮은 대상 목록이 바뀐다.

## 당시 상황과 제약
정답 길은 `floor`(y 244)·`reachPoint`로만 서서 테스트에서 안 걸렸다. 넓히기를 막은 건 아래 끝 252가 게이지 띠(y 256~) 때문에 정해진 값이라서다.

## 검토했지만 택하지 않은 안
- 그림 바닥을 y 200까지 올리기: 세탁기·건조기·자판기를 다 다시 그려야 한다.
- 공통 `WALK_AREA.top`을 236으로 올리기: 화면 1 시소 판(y 214~240)·고리 releasePoint(y 235)가 영역 밖이 된다.
- 빨래방 위 끝을 바닥 첫 줄 236으로: 셔터 앞에서 발이 판 위에 뜨고 길바닥 열쇠가 발보다 앞에 그려진다. 대신 244는 앞뒤 깊이가 8px로 준다.