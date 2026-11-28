---
schema: 1
id: 614886db-75d6-47f5-b09e-0daadd8f41a6
title: 쭉이가 든 물건을 얹는 점은 `tip`이 아닌 새 메타 키 `carry`로 서 있기·걷기 칸마다 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: jjuk-held-item
scope: [art/sprites/jjuk-v4.mjs, art/build.mjs, public/sprites/jjuk-base.json, src/core/sprite.ts]
revisit_when: 든 채로 나오는 반응 anim(step_up, common.zap·wet 등)에 얹는 점을 붙일 때, 또는 엔진이 장대를 이어 그리는 조건을 `tip` 말고 다른 것으로 바꿀 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1042
  - pr: zaffrex/goblin-crew#1037
  - issue: zaffrex/goblin-crew#1031
---
## 결정
쭉이 시트 `idle`·`walk` 자세에 프레임마다 `carry: [x, y]`를 둔다. x는 장대 가운데선(픽셀 경계, `tip`과 같은 뒤집기 규칙), y는 장대 끝 갈고리 위 외곽선 행이다. 엔진은 든 물건 그림의 아래 가운데를 이 점에 맞춰 갈고리 위에 얹고, 장대를 이어 그리거나 집게를 덧그리지 않는다. `art/build.mjs`는 그 행이 갈고리 위 잉크인지 검사하고, `src/core/sprite.ts`는 칸 수·칸 안 범위를 검사한다.

## 이유
`spritePole`은 `tip`이 있는 연출이면 장대를 칸 위로 이어 그리고 `claw` 칸을 덧그린다. 형식 검사도 `tip`이 있으면 `claw` 번호를 요구한다. 서 있기·걷기는 갈고리가 칸 안에 이미 그려져 있어서 이어 그릴 장대도 집게도 없다. 같은 키를 쓰면 든 채로 나오는 반응 anim에 붙이는 순간 장대가 두 번 그려진다.

## 당시 상황과 제약
ADR-1031(#1037) 5절에는 "`idle`·`walk`에 `tip`만 붙인다"라고 적혀 있다(Luna 리뷰 문장). ADR은 승인 3개를 받은 상태라 본문은 고치지 않고 #1037 코멘트와 #1042 본문에 차이를 적었다. 새 그림 0칸, PNG 바이트 그대로다.

## 검토했지만 택하지 않은 안
- ADR 문장대로 `tip` 재사용: 위 이유로 연출 자세에서 장대·집게가 이중으로 그려진다.
- 갈고리 링 아래에 물건을 매달기: 20×20 물건이 얼굴을 가린다(서 있기에서 갈고리가 머리 높이).