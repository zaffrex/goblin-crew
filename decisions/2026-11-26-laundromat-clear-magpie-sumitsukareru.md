---
schema: 1
id: 14d7ce03-1173-40c1-9a9b-4d06247f4972
title: 빨래방 클리어 clear_magpie는 한 줄 12자 `先輩、住みつかれてます！`로 바꾸고, 구조(clear_nest 없음, 대사 한 줄)와 8초 안은 그대로 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-26
owner: "@zaffrex"
topic: laundromat-clear-show
scope: [content/screens/laundromat.json, content/text/ja.json, docs/design/screens/laundromat.md]
supersedes: 6bec426e-6d46-4954-9d81-4bd1d8ecd85a
related: [4de95253-eb32-436b-bdb0-0776c2188fc2]
revisit_when: Mia 묶음 2나 진마씨 플레이에서 이 줄이 어색하다/누구 머리인지 모르겠다는 말이 나오거나, 클리어 replay가 480틱을 넘을 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#935
  - issue: zaffrex/goblin-crew#802
---
## 결정
- `laundromat` `duct_unstick` 클리어 show의 구조는 이전 결정 그대로다: `clear_nest` 없음, 까치가 둥지 모자 위에 앉은 뒤 プピ `clear_magpie` 한 줄만.
- 글만 바꾼다: `先輩、頭に\n住まれてます！` → **`先輩、住みつかれてます！`**(한 줄 12자).
- 글자 수가 같아 클리어 길이는 466틱(7.77초) 그대로다. `tests/art/laundromat-timing.test.ts` H6 480틱 잠금도 그대로다.

## 이유
Mia 묶음 1-1이 `住まれてます`를 "부자연스럽다"고 짚었고 `住みつかれてます`를 예로 들었다(#935). 일본어 원어민이 없는 팀이라 Mia·진마씨가 짚은 줄은 먼저 고친다. `頭に`를 넣으면 14자라 482틱으로 H6을 넘는다. 둥지+까치가 머리에 앉은 그림이 "어디에"를 보여 주므로 `頭に`를 뺐다.

## 당시 상황과 제약
클리어 여유 0.24초(14틱). 대사 길이는 `60 + 8×글자` 틱이라 2자만 늘어도 넘친다.

## 검토했지만 택하지 않은 안
- `先輩、頭に\n住みつかれてます！`(14자): 482틱으로 H6 초과.
- `先輩、住みつかれた！`처럼 반말: プピ는 です・ます 말투(ja-text 3절)라 안 맞는다.