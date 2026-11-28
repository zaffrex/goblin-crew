---
schema: 1
id: 3652cc6f-8376-42f6-bd64-2f68c20f4d7d
title: "핫스팟 있음/없음은 `variants`가 아닌 별도 조건 `present: { flags }`로 쓰고, 코어 판정·클릭·그림이 같은 판정으로 빠진다"
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: puzzle-hands
scope: [src/core/puzzle/types.ts, src/core/puzzle/step.ts, src/core/puzzle/validate.ts, src/core/interact.ts, src/core/scene.ts, src/core/sceneArt.ts]
related: [042fb914-74fd-4b79-8f2d-40dc15f5ddcc]
revisit_when: 사라짐/나타남 조건에 플래그 말고 다른 것(자리·손·아이템)이 필요한 화면이 나오거나, 그림 쪽이 사라지는 칸을 `states`로 직접 그리겠다고 할 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1043
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `HotspotDef.present?: { flags }`. 없으면 늘 있다. 플래그가 안 맞으면 그 핫스팟은 화면에 없다.
- 판정은 `hotspotPresent(screen, flags, id)` 하나(`types.ts`). 
  - 코어 `step` `isValidAction`: 없는 핫스팟 대상 행동은 `invalid`(BFS에서도 빠짐, 폴백도 없음). 든 물건 내려놓기 판정 다음에 본다.
  - UI `hotspotBox`: `null` → 클릭 판정·행동 상자·라벨·말풍선 keep 상자가 같이 빠진다.
  - 그림 `SceneView.absent`: 물건 `ids`가 전부 없는 핫스팟이면 멈춘 모습을 안 그린다(`frame: null`과 같음). 보이는 플래그(`shownFlags`)로 봐서 anim 시작/끝 때 같이 바뀌고, 그 물건 anim이 재생 중이면 anim이 먼저다. 그림 형식은 안 바꾼다.
- 검사(오류): `take-not-held`(들 물건을 `take`하는데 `when.item`·`when.holds`로 그 물건을 요구하지 않음), `take-leaves-item`(같은 규칙 `set`이 그 물건의 `present`를 끄지 않음). `present.flags`는 선언된 플래그 하나 이상.
- "나타남" 플래그를 켜는 규칙이 없는 경우는 따로 검사하지 않는다. BFS가 못 깸으로 잡는다(테스트로 확인).

## 이유
- #1043에서 Kai·Luna가 찾은 구멍: `take`로 다 쓴 들 물건이 제자리에 다시 생겨 다시 집히고(BFS는 정상 길로 봄), 결합으로 새로 생기는 물건은 "없음"을 적을 방법이 없었다.
- `variants`는 첫 일치 규칙이라, 상자 옮기기 갈래가 먼저 맞으면 사라짐이 묻힌다. 있음/없음은 상자와 따로 봐야 한다.
- 판정 함수를 하나로 두어 코어·클릭·그림이 어긋나지 않는다(Luna 조건 "판정도 그림도 같이 빠짐").

## 검토했지만 택하지 않은 안
- `variants`에 `off: true`: 위 첫 일치 문제.
- 그림은 화면 그림 `states`에 `frame: null`을 디자이너가 따로 적기: 같은 조건을 두 파일에 쓰게 되고 빠뜨리면 유령 그림이 남는다.
- `take-not-held`를 경고로: 조용히 아무 일도 안 일어나는 규칙이라 오류로 했다.