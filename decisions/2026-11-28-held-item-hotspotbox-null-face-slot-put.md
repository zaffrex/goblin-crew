---
schema: 1
id: 73250029-c752-4d16-b5b6-edb224d29073
title: 쭉이가 든 물건은 `hotspotBox`가 null을 줘서 클릭·라벨·대상 상자·걷기에서 한 곳으로 빠지고, 내려놓기는 HUD 쭉이 얼굴 칸으로만 낸다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: jjuk-hands-input
scope: [src/core/interact.ts, src/core/scene.ts]
related: [042fb914-74fd-4b79-8f2d-40dc15f5ddcc, 3652cc6f-8376-42f6-bd64-2f68c20f4d7d]
revisit_when: 4/4 그리기 PR에서 내려놓은 물건 상자를 쭉이 x로 옮길 때, 또는 Mia·진마씨 플레이에서 내려놓기를 못 찾는다는 보고가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1060
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `hotspotBox(screen, puzzle, id)`(`src/core/interact.ts`)는 `puzzle.hands === id`면 `null`을 준다. 든 물건은 장대 끝에 있어 화면 대상이 아니다(ADR-1031 1절).
  - 그래서 클릭 판정(`worldTargets`), 라벨, `sceneLayout` 핫스팟 상자, `scene.ts` `targetBox`가 같이 빠진다. 내려놓기 행동(`{ jjuk, item, item: X, target: X }`)은 `targetBox`가 없으니 `approachPoint`가 `null`이라 걷지 않는다. 장면 코드는 따로 안 고친다.
- 내려놓기는 **HUD 쭉이 얼굴 칸**으로만 낸다: 쭉이가 골라져 있고 `free` 자리에 서 있을 때(`ownFaceIntent`). 아니면 지금처럼 아무 일 없음. 월드의 쭉이 몸은 내려놓기를 안 낸다.
- 든 채로 쭉이 × 아무 대상(핫스팟·서는 자리) = `item` 행동. 라벨 `Label.held`로 물건 이름을 화면 이름 키(`<screen>.name.<id>`)에서 찾는다.

## 이유
- 든 물건 제외를 `hotspotBox` 한 곳에 두면 클릭·라벨·걷기·장면 상자가 같은 판정을 쓴다. `present` 조건(3652cc6f)이 `hotspotBox` 한 곳으로 빠지는 것과 같은 모양이다.
- ADR-1031 4절 표가 "쭉이 얼굴"을 지금 "아무 일 없음" 자리라 새 버튼 0으로 골랐다. HUD 칸이 그 자리다.

## 검토했지만 택하지 않은 안
- `worldTargets`에서만 든 물건을 빼기: 장면 `targetBox`·`approachPoint`가 원래 상자로 걸어가서 내려놓기가 걷게 된다. 별도 예외가 필요하다.
- 월드의 쭉이 몸 클릭도 내려놓기: 휴대폰에서 찾기 쉬울 수 있지만 ADR 표 밖이고, 서는 자리 위 내 몸 = 그 자리 규칙(6-4-1b)과 겹친다. 플레이 보고가 나오면 다시 본다.