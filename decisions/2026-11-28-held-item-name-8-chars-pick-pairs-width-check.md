---
schema: 1
id: ea707a33-1fb6-43ac-ac39-07f862c4022e
title: 쭉이가 드는 물건 이름은 8자 이하로 쓰고, 라벨 폭 검사는 `pick` 대상 × 같은 화면 모든 대상만 짝지어 잰다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: ja-label-width
scope: [tests/content/ja-text-rules.test.ts, docs/design/ja-text.md, content/text/ja.json]
related: [73250029-c752-4d16-b5b6-edb224d29073, 042fb914-74fd-4b79-8f2d-40dc15f5ddcc]
revisit_when: 대상 라벨 패턴(`ui.label.item`·`ui.verb.put`)이나 터치 꼬리 글이 바뀔 때, 또는 든 물건 이름을 화면 이름 키가 아닌 따로 짧은 키에서 찾게 바꿀 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1063
  - pr: zaffrex/goblin-crew#1060
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- `ja-text.md` 2절: 쭉이가 드는 물건(`pick` 규칙 대상)의 화면 이름(`<screen>.name.<id>`)은 **8자 이하**로 쓴다. 대상 10자 + 든 물건 8자 + `に…を使う` + 터치 꼬리 = 33자 = 478.8px로 480 안이다.
- `tests/content/ja-text-rules.test.ts` "대상 라벨 폭"은 배포 순서 화면 JSON에서 `do.pick === true` 규칙 대상을 모아, 그 물건 × 같은 화면 모든 대상의 `held` 라벨과 `{item}をおろす`(`put`)를 채워 잰다. 숫자 상한이 아니라 실제 셈이다.

## 이유
- #1060부터 든 물건 라벨 이름은 아이템 키(5자)가 아니라 화면 이름 키(10자)에서 온다. 둘 다 10자면 506.8px로 넘는데, 기존 테스트는 `held`·`put`을 채우지 않아 못 잡았다. 지금 화면 최대는 478.8px라 운으로 맞았다.
- 빨래방 v2 JSON PR(#1031)이 `pick` 규칙을 넣기 전에 막아 두려는 것이다.

## 검토했지만 택하지 않은 안
- 화면의 모든 이름 쌍을 든 물건 후보로 재기: 들 수 없는 긴 이름 두 개가 같은 화면에 있으면 거짓 실패가 난다(지금도 `magpie_nest`가 478.8px로 1.2px 차이).
- 든 물건도 아이템처럼 5자: v2 초안 `かわいたタオル`(7자)처럼 성질 낱말 + 이름이 안 들어간다.
- 든 물건 전용 짧은 이름 키: 글 키가 하나 늘고, 같은 물건이 화면 라벨과 든 라벨에서 다른 이름이 된다.