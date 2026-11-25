---
schema: 1
id: ecfe391e-bd1e-4877-8099-09031f6e1409
title: 빨래방 덕트 가로 구간은 천장 밑이 아니라 위쪽 벽 y 52~63으로 바깥 후드와 높이를 맞추고, 들창 틀은 58,22 56×52로 한다
status: superseded
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: laundromat-art-layout
scope: [art/scenes/laundromat.room.mjs, art/scenes/laundromat.shutter.mjs, art/scenes/laundromat.objects.mjs, content/screens/laundromat.json]
related: [fac85337-9fb2-4d67-8972-1c96dda314eb, 2620d7b4-effa-454a-9b94-3aea162bad0c]
revisit_when: 9-3 그림 블라인드(Mia)에서 "덕트가 어디로 가나 / 창 밖에 무엇이 있나"가 틀리게 읽히거나, 화면 JSON PR에서 덕트 혹 이동 길이 이 높이와 안 맞을 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#908
  - issue: zaffrex/goblin-crew#764
  - pr: zaffrex/goblin-crew#900
---
## 결정
- 스테이지 3 `laundromat` 배기 덕트(`DUCT`)는 3번 건조기 뒤에서 y 52까지 세로로 올라가 꺾이고, **위쪽 벽 y 52~63**을 가로질러 들창 오른쪽 칸 판자(끝 x 92)를 뚫고 나간다.
- 바깥 배기 후드(`HOOD`)는 들창 왼쪽 칸 안 y 54~62에 둔다. 덕트 가로 구간과 같은 높이라 "덕트 → 판자 → 창살 뒤 → 후드 → 둥지"가 한 줄로 읽힌다.
- 들창 틀(`TRANSOM`)은 **58,22 56×52**다. 화면 JSON의 `magpie` 핫스팟은 이 상자를 그대로 쓴다.
- 셔터 잠김 그림은 아래 끝을 6px 띄우고, 열쇠 자리(꼭짓점 x 112)를 가장 큰 틈 14px로 찌그러뜨린다. 길바닥 열쇠 자리는 97,236(19×8)이고 `gap` 핫스팟(80,222 40×24) 안에 있다.
- 덕트 혹(O6)의 가로 이동 길은 y 52~63 구간을 따른다.

## 이유
- 설계(`docs/design/screens/laundromat.md` 2-1)는 "천장을 따라"를 제안했다. 하지만 바깥 후드와 높이가 다르면 눈이 판자에서 끊긴다. 그러면 단서 S2·S3("둥지 ↔ 건조기")가 그림으로 이어지지 않는다.
- 천장 밑(y 16~30)으로 지나가면 켜진 형광등과 그 빛 띠(y 16~22)를 가린다.
- 들창 왼쪽 칸 안에 까치 18 + 둥지 11 + 후드 9 = 38px이 들어가야 한다. 설계 제안 약 48×44로는 부족해서 틀을 키웠다.

## 당시 상황과 제약
- 설계 #900 머지 뒤 첫 그림 PR(#908)이다. 설계 좌표는 "제안"이고, 높은 창·덕트 길은 Luna 그림에서 정하기로 되어 있었다.
- 화면 JSON은 아직 이전 초안이다. Kai·Theo가 화면 JSON PR에서 이 숫자를 옮긴다.

## 검토했지만 택하지 않은 안
- 천장 밑 가로 구간 + 판자 앞에서 아래로 꺾어 들어가기: 형광등을 가리고, 후드와 높이가 달라 한 줄로 안 읽힌다.
- 설계 제안 48×44 들창: 까치·둥지·후드가 창 안에 다 안 들어간다.