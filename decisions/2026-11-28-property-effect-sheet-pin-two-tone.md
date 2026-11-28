---
schema: 1
id: 682a4a40-c2ff-4c3a-9498-39993b155926
title: 성질 효과는 물건 위에 얹는 공통 시트 prop-fx(pin 메타)로 그리고, 따뜻함은 pink 김, 색은 두 단 짝으로 빨래방 띠 위 명도 차를 지킨다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: property-effects-art
scope: [art/ui/prop-fx.mjs, public/ui/prop-fx.*, tests/art/prop-fx.test.ts]
related: [fac85337-9fb2-4d67-8972-1c96dda314eb, 6182ce95-8bd8-4be7-b960-0f64e9a2021d]
revisit_when: "#1052 성질 표에서 성질 줄이 바뀌거나, 엔진 4/4에서 pin 네 개로 못 붙이는 물건이 나오거나, Mia 기록에서 젖음 방울과 반짝 별이 섞여 읽힐 때"
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1059
  - issue: zaffrex/goblin-crew#1053
  - pr: zaffrex/goblin-crew#1052
---
## 결정
- 성질(젖음·따뜻함·반짝)과 `sound.puff` 바람은 물건마다 상태 그림을 그리지 않고 공통 시트 `public/ui/prop-fx.png` + `prop-fx.json`의 효과를 얹는다. 효과마다 2칸, 메타는 `frames`·`ms`·`loop`·`anchor`·`pin`이다.
- `pin`은 칸의 `anchor`를 맞출 물건 상자 자리다: `bottom`(젖음), `top`(따뜻함), `top-right`(반짝), `source`(바람, 부는 쪽 부리, 오른쪽 칸을 왼쪽이면 anchor x로 뒤집기).
- 따뜻함 김은 pink·pinkL로 그린다(빨래방 `duct.warm_puff` 따뜻한 바람이 pink라 화면 사이 "따뜻함 = pink"). 바람은 곧은 선(white+lint)으로 물결 김과 모양으로 가른다.
- 효과 색은 두 단 짝으로 짓고, `tests/art/prop-fx.test.ts`가 빨래방 띠 네 개(dusk/cotton/plum/woodL) 위에서 칸마다 효과 픽셀 40% 이상이 명도 차 30 이상인지 막는다. 외곽선(ink)은 없다.

## 이유
- ADR-1031 5절: 성질은 효과로 얹어 화면마다 새 칸을 줄인다(C5 두 번째 사용 0칸).
- 엔진이 물건 높이·모양으로 자리를 추측하면 틀리는 곳을 그림에서 찾게 된다. 효과마다 붙는 자리가 정해져 있어 메타에 적는 쪽이 검사하기 쉽다.
- 한 단 색은 어느 띠에서든 반쯤 사라진다(예: white는 cotton 벽과 27 차, yel 별 끝은 cotton과 14 차). 두 단이면 밝은 벽에서는 어두운 단, 바닥에서는 밝은 단이 읽힌다.

## 당시 상황과 제약
- 띠 결정 fac85337(명도 차 30), 그림 고정 검사는 vitest에(6182ce95). 엔진 그리기는 Theo ADR-1031 4/4 몫이라 이번에는 시트·메타·검사만 만들었다(#1059).

## 검토했지만 택하지 않은 안
- 김을 눕혀 바람으로 재사용(0칸): "따뜻한 바람"으로 읽혀 성질 표 규칙 2(같은 성질 = 같은 결과)를 그림이 깬다(#1052 리뷰).
- 흰 김: 전통적이지만 cotton 벽 위에서 안 보이고 빨래방 따뜻함 색(pink)과 어긋난다.
- 엔진이 효과 자리를 물건 상자에서 추측: 메타 없이 되지만 효과마다 규칙이 달라 결국 엔진에 표가 생긴다.