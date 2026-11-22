---
schema: 1
id: a57c74bd-c60f-4088-8f43-5ecdd55ee8fa
title: 회색 배치 검사는 배치 JSON 비교 대신 엔진 approachPoint가 세우는 자리의 몸 겹침을 보고, 시작 겹침·설 자리 없음만 error로 막는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-22
owner: "@zaffrex"
topic: layout-check
scope: [scripts/layout/**]
revisit_when: 화면 JSON과 따로 노는 회색 배치 파일이 다시 생기거나, warning(stand-neighbor)이 그림 PR에서 실제 문제로 반복되거나, 플래그 조합·출발 y에 따라 설 곳이 달라지는 화면이 생길 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#768
  - pr: zaffrex/goblin-crew#821
---
## 결정
`scripts/layout/`의 회색 배치 검사(#768)는 `content/screens/<id>.json`(+ 있으면 물건 그림 메타)만 읽고, 엔진 `createScene`·`approachPoint`를 그대로 불러 캐릭터가 실제로 서는 자리의 몸 상자 겹침을 본다.
- error(종료 코드 1, `npm test`에서 모든 화면 0으로 고정): `start-body` 시작 몸이 바닥 물건 앞에 겹침, `no-side` 바닥 물건 양옆 어디에도 몸이 안 들어감
- warning(보고만): `stand-neighbor` 바닥 물건 옆에 서면 이웃 바닥 물건 앞에 겹침
- 높은 대상 아래 바닥 물건 앞에 서는 것은 설계대로라 보고하지 않는다

## 이유
- 이슈 원래 안(`<id>-layout.json` ↔ 화면 JSON 비교)은 11/22에 회색 배치 JSON이 화면 JSON으로 옮겨지고 지워져 비교할 대상이 없다("진실은 하나").
- 상자 크기·화면 밖·HUD·목표 줄·걷기 영역은 `validate.ts`가 이미 본다. 남은 빈칸은 걸어가 섰을 때의 몸이다.
- 엔진 함수를 그대로 부르면 `park_fountain-layout.mjs`처럼 엔진 숫자 사본(`ENGINE`)이 엔진과 어긋날 일이 없다.
- warning을 error로 하면 현재 화면(`laundromat` `dryer_3`↔`soap_vending` 16px, `magpie_nest` 까치↔바구니 32px)이 바로 막히고, 받아들일지는 그림 쪽 판단이라서 보고만 한다.

## 검토했지만 택하지 않은 안
- 배치 JSON ↔ 화면 JSON 차이 보고: 입력 파일이 없다.
- 화면마다 `*-layout.mjs` 손 검사: 엔진 숫자 사본이 생기고 화면마다 다시 써야 한다.
- 모든 겹침(높은 대상 앞 포함)을 보고: 둥지 밑 바구니, 분수 앞 등 설계대로인 경우가 수십 줄 나와 잡음이 된다.
- warning 목록을 테스트에 고정: 그림 PR마다 테스트를 고쳐야 해서 마찰이 크다.