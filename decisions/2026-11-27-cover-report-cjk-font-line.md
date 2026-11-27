---
schema: 1
id: db0d1ea5-18ee-4409-88aa-662ec2a99f78
title: cover.ts 리포트는 CJK 글꼴 유무를 머리에 적고, 글꼴 없이 잰 가림 비율은 판정에 쓰지 않는다(경고만, 종료 코드 그대로)
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-27
owner: "@zaffrex"
topic: playtest-bubble-cover
scope: [scripts/playtest/cover.ts, scripts/playtest/README.md]
revisit_when: 게임이 웹 글꼴을 직접 싣게 되어 러너 글꼴과 상관없이 같은 글자가 그려질 때, 또는 U+10FFFD를 그리는 글꼴 때문에 오탐이 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1008
  - pr: zaffrex/goblin-crew#1007
  - pr: zaffrex/goblin-crew#1006
  - issue: zaffrex/goblin-crew#792
---
## 결정
- `scripts/playtest/cover.ts`는 페이지마다 카드를 닫은 뒤 한 번, 말풍선 글꼴로 「あ」와 U+10FFFD(어떤 글꼴에도 없는 글자)를 캔버스에 그려 픽셀을 비교한다. 같으면 CJK 글꼴이 없는 것으로 본다.
- 리포트 머리(URL 아래)에 `CJK 글꼴: 있음/없음` 줄을 적는다. 없으면 "이 표의 비율은 판정에 쓰지 않는다"를 붙이고 stderr에 경고한다.
- 종료 코드와 측정값은 바꾸지 않는다.
- README의 "글꼴이 없어도 판정은 된다"에 `cover.ts`는 예외라는 줄을 붙인다.

## 이유
- 글꼴이 없으면 글자가 네모로 그려져 말풍선 폭·줄바꿈·자리가 달라지고, 가림 비율이 몇십 % 바뀐다. 그런데 리포트에는 그 표시가 없었다.
  - #1006: `aha-s4-suck` M1 gap이 글꼴이 없을 때 0%, 있을 때 30%.
  - #1007: 디자이너 리뷰가 글꼴 없이 `aha-s2-reverse` D1·D4를 ❌로 잘못 적었다. 글꼴이 있으면 ✅였다.
- 진마씨 요청 전 점검(near-final 조건 3)이 이 숫자에 기댄다.

## 당시 상황과 제약
- PM·디자이너 러너에는 CJK 글꼴이 없고, Theo 환경에는 있다.
- 2026-11-27 3화면 요청 직전이었고, 앞 두 판 측정이 남아 있었다.

## 검토했지만 택하지 않은 안
- **글꼴이 없으면 종료 코드 1로 실패.** 글꼴 없는 환경에서도 장면 확인용으로 도구를 돌리는 일이 있어서 흐름을 깨지 않으려고 택하지 않았다.
- **Node에서 `fc-list :lang=ja`로 확인.** 리눅스 전용이고, 브라우저가 실제로 그 글꼴을 쓰는지는 모른다. 그래서 브라우저 안에서 픽셀로 보는 쪽을 택했다.
- **README만 고치기.** 리포트만 보는 사람은 여전히 모르기 때문에 택하지 않았다.