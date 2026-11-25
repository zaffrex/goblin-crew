---
schema: 1
id: 0e9e0cc0-5465-4ab1-9481-b91675707878
title: 연결 순서 클리어·끝 카드는 머리 위 칸(그림 형식 16절)과 겹치면 그 위로 올리고, 캐릭터 몸은 여전히 피하지 않는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: clear-card-placement
scope: [src/main.ts, src/core/cutPlace.ts]
related: [cb472bb7-17c6-4bfb-b90d-df2121e09e25, 1fbc7010-e6a5-4bda-948a-227a5d317366]
revisit_when: 머리 위 칸이 높은 자리(선반·사다리 위 등)에 생겨 카드가 CUT_MIN_TOP까지 올라가 HUD 얼굴 줄을 덮을 때, 또는 Mia·진마씨가 올라간 카드가 다른 단서를 가린다고 할 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#975
  - pr: zaffrex/goblin-crew#977
---
## 결정
`src/main.ts`에서 연결 순서(ORDER) 클리어·끝 카드 `#clear`는 `cutCenter(size, 머리 위 칸 상자)`로 놓는다. 머리 위 칸 상자는 그 프레임의 `headPlaces` 결과(말풍선 keep 상자 #947과 같은 자리)다. 겹치면 카드 아래끝을 그 칸 위 `CUT_GAP`으로 올리고, 캐릭터 몸 상자는 여전히 피하지 않는다(#683 그대로). 머리 위 칸이 없는 판은 지금처럼 게임 화면 가운데다. 게이지 0 컷과 화면 하나 카드는 바뀌지 않는다.

## 이유
#974로 빨래방 끝 카드 동안 둥지 모자·까치(펀치라인 그림)가 남게 됐는데, 640×300 @2에서는 글자 최소 20px 때문에 커진 카드 상자가 까치 머리를 약 8px 덮었다(#975). 머리 위 칸만 피하면 그 그림만 지키고, 다른 화면 카드 자리는 그대로 둘 수 있다.

## 검토했지만 택하지 않은 안
- 압축 배율(1.2 미만)에서만 카드를 게임 높이 10% 위에 두기: 단순하지만 머리 위 칸이 없는 화면 1·2 카드 자리까지 같이 바뀐다.
- ORDER 카드도 캐릭터 몸 전체를 피하기(화면 하나 카드처럼): #683에서 연결 순서 카드는 가운데로 정했고, 몸까지 피하면 화면마다 카드 자리가 크게 흔들린다.

## 당시 상황과 제약
확인: 로컬 빌드 `solve.ts --deploy` 3화면 클리어. 640×300 @2에서 약 11 내부 px, 1280×720에서 2~3px 올라감, 844×390 @3에서 겹침 0. 화면 1·2 카드는 머리 위 칸이 없어 안 바뀐다. 팀 설계 문서 `docs/design/ui-interaction.md` 6-6절 위치 줄이 우선이다.