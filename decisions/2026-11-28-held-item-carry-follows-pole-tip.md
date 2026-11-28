---
schema: 1
id: d86e6c85-476d-414c-a555-b682ce570ede
title: 든 물건 그림은 쭉이 첫 연출이 끝날 때까지 옛 손을 따르고, `carry` 없는 연출은 장대를 이은 칸이면 집게 위, 아니면 서 있기 첫 칸 점에 얹는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: held-item-draw
scope: [src/core/scene.ts, src/core/sprite.ts, src/core/sceneArt.ts, src/main.ts, art/build.mjs]
supersedes: 15df458b-61ed-48bd-a139-c32bd2b15e6d
related: [614886db-75d6-47f5-b09e-0daadd8f41a6, 042fb914-74fd-4b79-8f2d-40dc15f5ddcc]
revisit_when: 높은 데서 집기(`common.pick_high`)를 실제 화면 규칙이 쓰기 시작할 때(0번 칸 동안 물건이 제자리에 있어야 하는데 지금 규칙으로는 집게를 따라 올라간다), 또는 다 뻗은 집게 위 물건이 대상 그림과 겹친다는 그림 리뷰가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1064
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `step`이 쭉이 손(`hands`)을 바꾼 행동은 그림이 `SceneState.handsShown`(옛 손)을 따르다가, 그 행동 이벤트 중 **쭉이 첫 캐릭터 연출(`anim`, target `jjuk`)이 끝날 때** 새 손으로 바꾼다. 쭉이 연출이 없으면 바로 바꾼다. (이전 결정 그대로)
- 그 연출이 재생되는 동안은 손이 바뀌기 전후 중 있는 쪽이 그 물건이고, 칸의 `carry`가 정한다: 점이면 손, `null`이면 제자리. (그대로)
- 자세에 `carry`가 없는 연출:
  - **이 칸에 `spritePole`이 장대를 이으면(`tip` 있는 칸)** 든 물건 아래 가운데 = (이은 장대 가운데선 x, 집게 칸 위 끝 y = 집게 첫 잉크 행). 장대가 자라면 같이 올라간다. (새 예외, PR #1064 Luna 리뷰)
  - 그 밖(`tip: null` 칸, `zap`·`wet`·`flatten`처럼 `tip` 없는 반응)은 서 있기(`idle`) 첫 칸 `carry` 점. 그것도 없으면(시트 없음) 손에 안 그리고 제자리에서도 뺀다.
- `art/build.mjs`는 집게 칸 0행마다 잉크가 있는지 검사한다(물건이 집게 위에 떠 보이지 않게).
- 손에 그리는 물건은 `sceneArtView.absent`로 제자리 그림에서 빼고, 물건 칸은 지금 멈춘 모습(`pictureOf`)의 아래 가운데를 점에 맞춘다. (그대로)

## 이유
- 빨래방 v2에서 든 물건을 쓰는 행동은 거의 다 장대 연출이다(든 물건 × 틀린 대상 = `common.reach_wobble`, `towel_in`·`coin_stick`도 장대를 뻗는다). 서 있기 점에 두면 빈 집게만 64px 올라가고 물건은 머리 높이에 혼자 떠 있다.
- 디자이너 13칸 셈(`laundromat-v2.md` 9-2절)이 "장대를 뻗는 anim에 든 물건이 `tip`을 따라가면 0칸"을 가정한다. 연출마다 `carry`를 찍지 않아도 된다.
- 집게 칸 위 끝은 서 있기 `carry` y("갈고리 위 외곽선 행")와 같은 뜻이다.

## 검토했지만 택하지 않은 안
- 장대 연출마다 `carry` 메타 찍기: 장대가 칸 밖으로 나가 칸 안 점으로는 못 쓴다. 칸이 늘어난다.
- 집게 첫 잉크 행을 시트 메타에 새 키로 내보내기: 지금 집게 두 칸 다 0행이 첫 잉크라 빌드 검사 한 줄로 충분하다.

## 당시 상황과 제약
- `common.pick_high` 0번(장대가 물건까지 자라는 칸)은 지금 규칙으로 물건이 집게를 따라 올라간다. 아직 그 연출로 집는 화면 규칙이 없어 미뤘다.