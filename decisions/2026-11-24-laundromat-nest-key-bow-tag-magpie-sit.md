---
schema: 1
id: 675d4bae-5cfa-4ea1-a048-f4fb443b2358
title: 빨래방 둥지 속 열쇠 단서는 오른쪽 끝 금색 고리 + 둥지 앞 나무 패 두 자리에 그리고, 앉은 까치는 60,27(배 오른쪽 끝 x 78) 안에 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: laundromat-nest-art
scope: [art/scenes/laundromat.objects.mjs, docs/design/screens/laundromat-nest-key-preview.mjs]
related: [4de95253-eb32-436b-bdb0-0776c2188fc2, 0d74c83f-dc3c-4979-bfa9-bd0ba63ff173]
revisit_when: Mia 블라인드에서 둥지 속 열쇠가 안 보인다고 나오거나, O3 앉은 까치 그림이 60,27 20×18 자리에 들어가지 않을 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#920
  - issue: zaffrex/goblin-crew#764
---
## 결정
- 스테이지 3 `laundromat` O2 "열쇠 든 둥지"는 단서를 두 자리에 나눠 그린다. 금색 고리는 둥지 오른쪽 끝 잔가지에 꽂혀 하늘로 솟고(x 80~84, y 37~45), 나무 패는 둥지 앞면에 늘어진다(70,46 9×6). 둘은 끈 4px로 잇는다.
- 앉은 까치(O3 앉음·내려다보기, 이후 PR)는 **60,27 20×18 자리**에 두고, 배 오른쪽 끝은 x 78을 넘지 않는다. 발 아래 끝은 y 44(둥지 윗줄)다. 그보다 오른쪽은 고리 자리다.
- `key_in`·`key_out`·대기 반짝은 열쇠 든 둥지·반짝 2칸과 빈 둥지를 재사용한다(0칸).
- `laundromat-nest-key-preview.mjs` 검사가 "까치가 열쇠·패·끈 픽셀을 가리는 수 0"을 지킨다.

## 이유
- 금색 고리 하나만 그리면 1배에서 "노란 점"이 된다(#154 진마씨 피드백).
- 들창 칸이 26px뿐이고 둥지 위는 까치가 차지한다. 까치 발 아래의 둥지 앞면과 까치 오른쪽 하늘만 가리지 않는 자리라서 거기에 나눠 그렸다.
- 패는 O1 길바닥 패와 같은 모양이라 "길바닥에 있던 그 패"로 읽히고, S5(혹 속에 걸리는 패)와도 같은 물건이 된다.

## 검토했지만 택하지 않은 안
- 고리를 둥지 왼쪽 위에 두는 안: 앉은 까치 꼬리(x 60~66, y 38~44)와 겹친다.
- O1 패 그림(19×8)을 둥지 위에 그대로 얹는 안: 둥지(22px)를 거의 덮고, 까치 앉을 자리와 겹친다.
- 까치를 고리 앞에 그리는 안: 단서 고리가 배에 가려진다.