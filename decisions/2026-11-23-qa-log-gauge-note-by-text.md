---
schema: 1
id: f06ba58d-f14b-4665-9c32-61bd046f1ea5
title: "QA 글 기록기는 #label 자리를 첫 게이지 감소 안내 글자일 때만 적고, 게임 번들은 안 바꾼다"
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: qa-seen-log
scope: [scripts/qa/seen.ts, scripts/qa/browse.ts]
revisit_when: "첫 게이지 안내 말고도 #label 자리에 잠깐 뜨는 안내(긴 걷기·전환 안내)를 QA가 놓쳐 보고가 틀리거나, 게임이 안내를 다른 요소로 옮길 때"
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#601
  - pr: zaffrex/goblin-crew#850
---
## 결정
`scripts/qa/seen.ts`의 `SEEN_RECORDER`는 `#label` 요소를 통째로 적지 않고, 글자가 `content/text/ja.json`의 `ui.hud.gauge_first_drop`과 똑같을 때만 `게이지 안내`로 적는다(`SEEN_SOURCES`의 `only`). 호버 라벨은 계속 안 적는다. 게임 번들(`src/`, `index.html`)은 안 바꾼다.

## 이유
- 묶음 1-3(#601 P1-e)에서 "걷기만 했는데 말풍선 없이 게이지 −1"로 보고된 건 #2 다치는 실패의 첫 감소 안내가 기록에 없어서였다. 안내는 `#label` 자리에 2.5초 뜨고 아무 클릭에나 지워진다.
- `park_fountain` 판정 중이라 판정 빌드와 섞이지 않게 `scripts/qa/`만 바꾼다(#845·#847과 같은 방식).
- 규칙을 배우는 순간은 첫 감소뿐이고, 그 뒤 감소는 말풍선이 같이 뜬다.

## 검토했지만 택하지 않은 안
- `#label`을 통째로 적기: 클릭마다 호버 라벨 줄이 붙어 목록이 두 배로 시끄러워진다.
- 게임 쪽에서 `#label`에 `data-note` 표시 달기: 가장 튼튼하지만 게임 번들이 바뀌어 판정 대상 빌드와 섞인다.
- 캔버스 픽셀로 게이지 칸 수 변화 적기: 레이아웃 좌표에 묶여 깨지기 쉽고 비용이 크다.
- 시간 규칙(클릭 직후가 아니고 스스로 사라진 라벨만): 캐릭터가 커서 밑을 지나가면 생기는 호버 변화와 클릭으로 지워진 안내를 못 가른다.