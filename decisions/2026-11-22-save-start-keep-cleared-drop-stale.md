---
schema: 1
id: 13d50386-25d1-4423-b252-9b9c6e32f2d0
title: 페이지를 열 때 다 깬 세이브는 이어 쓰고, checkpoint 화면이 배포 순서에 없는 세이브는 버린다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: save-resume
scope: [src/core/progress.ts, src/main.ts]
related: [86c61b41-eb09-4418-b904-dd387d5be454]
revisit_when: 타이틀·맵(#792)이 들어와 `새로 하기`가 생기거나, contentVersion 마이그레이션(화면 id 변경)이 필요해질 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#767
  - pr: zaffrex/goblin-crew#800
---
## 결정
`startFromSave(loaded, order)`(`src/core/progress.ts`)가 시작 위치(`resumeFrom`)와 이번 판 클리어 카드가 이어 쓸 세이브(`prev`)를 같이 고른다.
- 다 깬 세이브(`solvedScreens ⊇ order`)는 처음 화면에서 시작하지만 `prev`로 이어 쓴다. 다시 깬 화면은 `saveOnCard`의 "다시 하기" 경로라 `solvedScreens`와 checkpoint가 그대로다.
- checkpoint 화면이 배포 순서에 없으면 `prev = null`로 새로 쓴다.
- 손상·상위 버전은 store가 백업 키로 옮기고 null을 준다(새로 하기).
- 타이틀의 `새로 하기`(#792)는 이 함수가 아니라 호출 쪽에서 `prev = null`로 시작한다.

## 이유
- 타이틀이 생기기 전에는 다 깬 플레이어가 새로고침하면 처음 화면이다. 이때 옛 세이브를 버리면 맵(#792)이 쓸 깬 화면 기록을 잃는다.
- checkpoint가 사라진 화면을 가리키는 세이브를 이어 쓰면, 이미 깬 화면을 다시 깰 때 checkpoint가 안 바뀌어 새로고침마다 처음으로 돌아간다.

## 검토했지만 택하지 않은 안
- 시작이 `new`면 늘 `prev = null`: 단순하지만 다 깬 진행도가 첫 카드에서 지워진다.
- 늘 `prev = loaded`: 사라진 화면 checkpoint에 갇힌다(위 이유 2).