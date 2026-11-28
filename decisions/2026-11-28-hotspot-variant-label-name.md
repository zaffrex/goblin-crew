---
schema: 1
id: cb3d5e86-6a61-4fa4-8e4a-c7ba070d90ab
title: 상태에 따라 바뀌는 물건 라벨 이름은 핫스팟 `variants[].name`(이름 ID)으로 적고, UI 라벨만 읽는다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: hotspot-label-name
scope: [src/core/interact.ts, src/core/puzzle/types.ts, src/core/puzzle/validate.ts, tests/content/ja-text-rules.test.ts]
revisit_when: 한 물건의 이름이 위치 변형과 따로 바뀌어야 해서(첫 일치 변형에 box를 되풀이해 적기 번거로워) 화면 JSON이 길어질 때, 또는 Kai가 상태별 이름 대신 이름 하나 + 색으로 가기로 정할 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `HotspotVariant.name?: string`(ID). 상자(`box`)와 같은 **첫 일치 변형**의 `name`이 있으면 라벨 이름 글은 `<screen>.name.<name>`, 없으면 `<screen>.name.<핫스팟 ID>`.
- `hotspotNameId(screen, puzzle, id)`(`interact.ts`)가 고르고, `labelText(label, screenId, t, nameOf?)`의 네 번째 인자로 넘긴다. 대상과 든 물건(`held`) 이름 둘 다 탄다. 캐릭터 이름은 안 탄다.
- 퍼즐 판정(`step`·BFS)은 안 읽는다. `validate.ts`는 ID 문법과 글 키 존재(`ref-text`)를 본다.
- 라벨 폭 테스트는 `pick` 대상의 상태별 이름도 든 물건 이름으로 잰다(8자 기준 그대로).

## 당시 상황과 제약
빨래방 v2 설계(`laundromat-v2.md` 2·8절)가 `かわいたタオル` → `ぬれたタオル`처럼 상태에 따라 바뀌는 이름을 쓴다. 엔진은 핫스팟마다 이름 키가 하나였다. 젖음 여부가 정답 길 단서(`gap_drag` vs `gap_dry`)라 라벨에 보이는 게 낫다.

## 이유
- 상태 판정을 상자와 같은 첫 일치 규칙으로 하면 그림·상자·이름이 한 변형 안에서 같이 바뀌어 어긋날 일이 적다.
- 이름 ID를 화면 이름 네임스페이스 안에 두면 기존 글 검사(라벨 폭, 8자)가 그대로 돈다.

## 검토했지만 택하지 않은 안
- A: 이름 하나 + 젖음은 색으로만(엔진 0줄). 설계 문서가 이미 두 이름을 쓰고, 라벨이 단서를 놓친다.
- 이름을 그림 시트(`states[].when`)에 두기: 라벨은 퍼즐 데이터 쪽 대상인데 그림 형식에 UI 글을 섞게 된다.
- 이름만 따로 첫 일치(`name` 있는 변형 중 첫 것): 상자와 규칙이 갈려 읽기 어렵다.