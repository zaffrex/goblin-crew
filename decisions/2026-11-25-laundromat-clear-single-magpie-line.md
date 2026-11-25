---
schema: 1
id: 6bec426e-6d46-4954-9d81-4bd1d8ecd85a
title: 빨래방 클리어 연출은 clear_nest를 빼고 clear_magpie 한 줄(12자)만 남겨 8초 안에 맞춘다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-clear-show
scope: [content/screens/laundromat.json, content/text/ja.json, docs/design/screens/laundromat.md]
related: [4de95253-eb32-436b-bdb0-0776c2188fc2, 5b68be9e-cfa7-4789-9fab-2b1c13a451b1]
revisit_when: Theo replay가 8초(480틱)를 넘거나, Mia 묶음(#935)에서 둥지가 머리에 떨어지는 순간이 안 읽힌다/끝 그림이 안 웃겼다는 말이 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#802
  - pr: zaffrex/goblin-crew#966
  - issue: zaffrex/goblin-crew#935
---
## 결정
- `laundromat` `duct_unstick` 클리어 show에서 ズッシー 대사 `clear_nest`(`…巣ごと、帰ってきた。`)를 뺀다. 둥지가 머리에 덮일 때는 대사가 없다.
- 까치가 둥지 모자 위에 앉은 뒤 プピ `clear_magpie` 한 줄만 둔다: `先輩、頭に\n住まれてます！`(12자).
- 계산 길이 약 7.76초(ADR-0761 H6 8초 안, 여유 약 0.24초). 실제 길이는 Theo replay로 확인한다.
- 이 show에 박자·글자를 더하려면 다른 것을 빼야 한다.

## 이유
이 판의 웃음은 ズッシー 머리 위가 양말 → 깃털 → 둥지+까치로 커지는 줄이고, 끝 그림(까치가 둥지 모자 위에 앉음)이 펀치라인이다. 이 안이면 끝 그림이 대사 동안 약 3.1초 머문다. 둥지 단계는 말없이 약 0.9초 지나가는데, ズッシー가 과묵한 성격이라 말없이 둥지를 쓰고 서 있는 것도 맞다.

## 당시 상황과 제약
그림이 다 붙은 replay가 10.93초(#955 뒤 약 10.76초)로 8초를 넘었다. 엔진 쪽 같은 박자(`door_bang`·`nest_hat`)는 −0.33초뿐이라 기댈 수 없었다. 대사 길이는 `60 + 8×글자` 틱.

## 검토했지만 택하지 않은 안
- ① `clear_magpie` 빼기(약 7.63초, 여유 더 큼): 끝 그림이 셔터와 겹쳐 약 0.5초만 보이고, 대사가 앞 단계(둥지)에 붙어 펀치라인을 밟는다.
- 두 줄 다 남기고 글만 줄이기: 27자 중 22자를 빼야 해서 안 된다.