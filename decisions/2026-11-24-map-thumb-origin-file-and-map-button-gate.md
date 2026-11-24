---
schema: 1
id: 3db76b3e-4604-485a-bfeb-0e91e6725877
title: 맵 썸네일 자르는 자리는 content/map.json 한 곳에만 두고, マップ 버튼은 맵 글이 다 있고 판이 카드 3자리에 들어갈 때만 띄운다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: title-map
scope: [content/map.json, src/core/map.ts, src/engine/map.ts, src/main.ts]
related: [1de46a7a-bd8c-4c2f-adee-7b5702dc19d3]
revisit_when: 배포 순서에 4번째 판이 들어갈 때(카드 자리 3개를 넘음), 또는 맵을 동네 지도 그림(2단계)으로 바꿀 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#792
---
## 당시 상황과 제약
설계 `docs/design/title-and-map.md` 3-3절은 썸네일 자르는 자리를 "맵 설정 파일 하나(이름은 Theo가 정함)"에만 두고 화면 데이터(ADR-0065 스키마)에는 넣지 말라고 했다. Luna가 리뷰에서 숫자를 고친다. 맵 카드 자리는 3개(x 24·176·328)뿐이다.

## 결정
- 썸네일 왼쪽 위는 `content/map.json` `thumbOrigin.<screenId>: [x, y]`에만 둔다. 없거나 틀리면(정수 아님, 120×68이 화면 밖) 그 카드 썸네일은 dusk 한 색이고 콘솔 경고만 남긴다(`core/map.ts` `thumbOrigin`).
- 타이틀 `マップ` 버튼은 `mapReady(text, order)`가 참일 때만 둔다: `ui.map.back`·`ui.map.locked`·`ui.title.map`과 배포 순서 모든 판의 `<id>.map.name`이 있고, 판 수가 카드 자리(3) 이하. 아니면 `withoutMap`.

## 이유
- 숫자를 JSON 한 곳에 두면 Luna가 코드 없이 고칠 수 있고, 화면 데이터 스키마를 안 건드린다.
- 글 키가 없으면 키 이름이 버튼·카드에 찍힌 판이 기본 링크로 나간다. 4번째 판은 그릴 자리가 없어서, 맵을 깨진 채 띄우기보다 버튼을 빼고 설계부터 다시 본다.

## 검토했지만 택하지 않은 안
- `core/map.ts` 상수: 그림 쪽 숫자를 고칠 때마다 코드 PR이 된다.
- 화면 JSON(`content/screens/<id>.json`)에 필드 추가: 설계가 금지했고 ADR-0065 스키마 변경(L2)이다.