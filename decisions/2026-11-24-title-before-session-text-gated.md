---
schema: 1
id: 1de46a7a-bd8c-4c2f-adee-7b5702dc19d3
title: 타이틀은 판을 만들기 전에 띄우고, 버튼 글(Kai)이 글 파일에 없으면 건너뛰어 지금처럼 바로 게임이다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: title-screen
scope: [src/main.ts, src/engine/title.ts, src/core/title.ts]
related: [86c61b41-eb09-4418-b904-dd387d5be454, 13d50386-25d1-4423-b252-9b9c6e32f2d0]
revisit_when: 타이틀 → 게임 사이 어두워짐 0.3초(설계 2-4절)를 붙일 때 루프 밖 대기 구조가 걸리거나, 맵(3/3)에서 게임 → 맵 → 게임으로 판을 여러 번 바꿔야 해서 top-level await 한 번으로 안 될 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#792
---
## 결정
- `src/main.ts`는 세이브를 읽은 뒤, 판(`session`)을 만들기 **전에** `await runTitle(...)`(`src/engine/title.ts`)로 타이틀을 띄운다. 누른 결과(`index`·`prev`·`activeCharacter`)가 그대로 첫 판·`saved`·지금 캐릭터가 된다. 게임 루프·캔버스 입력·카드 핸들러는 타이틀이 끝난 뒤에 붙는다.
- 타이틀은 세이브가 켜진 기본 링크(`saveStore && ORDER`) + 도구 쿼리 없음(`skipsTitle`) + **버튼 글 키가 글 파일에 다 있음**(`titleTextReady`: `ui.title.continue`·`ui.title.new`·`ui.title.new_confirm`)일 때만 뜬다. 글이 없으면 지금처럼 바로 게임이다.
- `はじめ` 두 번째 누름이 확정되면 그 자리에서 `saveStore.clear()`로 세이브를 지운다.
- 맵 버튼은 3/3 PR 전까지 `withoutMap`으로 뺀다.

## 이유
- 루프 안에 `title` 단계를 넣으면 `startCard.open`·`flow.phase`로 막는 입력·틱 게이트 10곳 넘게 조건을 더해야 한다. 판을 만들기 전에 기다리면 게이트는 0곳 바뀌고, 시작 카드 글도 고른 화면 기준으로 한 번만 만든다.
- 일본어 글은 Kai 몫이라 FE가 임시 글을 넣지 않는다. 키 이름(`ui.title.new`)이 버튼에 찍힌 판이 기본 링크(늘 최신 main)로 나가면 안 된다. 글 PR이 들어오는 순간 코드 수정 없이 켜진다.
- 첫 카드 전에 새로고침하면 옛 `つづき`가 다시 뜨는 걸 막으려고 세이브를 바로 지운다(설계 2-3절 "세이브를 지우고").

## 검토했지만 택하지 않은 안
- 루프 안 `title` 단계: 위 게이트 비용.
- 임시 일본어 글로 바로 켜기: 글 담당(Kai) 경계를 넘는다.
- `?title=1` 같은 쿼리 뒤에 숨기기: 기본 링크 결정(86c61b41)과 어긋난다.