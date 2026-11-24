---
schema: 1
id: 3d7bd2be-3c2e-42e6-ad9d-5ce01cdcb74a
title: 빨래방 덕트 혹은 패 모양으로 어깨가 각진 은색 혹으로 그리고(관은 안 찢음), 걸린 혹은 duct 핫스팟 안 367,150에 둔다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-24
owner: "@zaffrex"
topic: laundromat-duct-art
scope: [art/scenes/laundromat.objects.mjs, docs/design/screens/laundromat-duct-lump-preview.mjs]
related: [ecfe391e-bd1e-4877-8099-09031f6e1409, 675d4bae-5cfa-4ea1-a048-f4fb443b2358]
revisit_when: Mia 블라인드에서 걸린 혹이 "원래 있던 이음매"로 읽히거나, 빌드 연결 replay에서 가로 → 세로 건너뛰기가 끊겨 보일 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#764
---
## 결정
- 스테이지 3 `laundromat` O6 덕트 혹은 새 칸 3칸이다: 가로 1(`lumpH`, 24×18), 세로 걸림 멈춘 모습 1 + 끙끙 1(`lumpV`, 22×22).
- 혹은 관과 같은 은색 단으로, 관을 찢지 않고 **어깨가 각진 상자 모양**으로 부풀린다. 속의 넓적한 나무 패(S5 "패가 넓다")를 모양으로만 말한다.
- ink 외곽선은 관에서 튀어나온 부분에만 둔다. 관 속(관과 이어지는 양 끝)에는 ink를 두지 않는다.
- 걸린 혹 가운데는 367,150(= `duct` reachPoint)이고, 멈춘 모습·끙끙 둘 다 `duct` 핫스팟(352,120 30×44) 안에 그린다. 건조기 위 끝 164 아래는 잘라 낸다.
- `lump_travel` 자리: 가로 cx 110·188·268·330(걸이 줄 x 150·236·316을 피함) → 세로 cy 96 → 걸림 cy 150. 첫 칸 200ms(창 쪽 머묾), 가운데 80ms, 마지막 덜컥 100ms. `lump_back`은 거꾸로(0칸), `lump_pop`은 끙끙 → 건조기 뒤로 쑥(0칸), 대기 반복 `stuck`은 쉬었다 두 번 끙끙.

## 이유
- 둥근 혹은 "공기 방울"로 읽혀서 왜 걸렸는지 설명이 안 된다. 각진 어깨가 패의 모서리가 관을 미는 모양이다.
- 관 자체는 배경이라 외곽선이 없다. 혹 양 끝에 세로 ink 줄이 남으면 관 위에 붙인 스티커처럼 보인다.
- 걸린 혹은 ★③ 누를 곳이다(S6). 그린 픽셀이 핫스팟 밖으로 나가면 혹을 눌렀는데 반응이 없는 자리가 생긴다.
- PR #900 재리뷰 replay 확인 1(창 쪽 1~2칸 머묾)·2(덜컥 80~120ms)를 칸 시간으로 미리 맞췄다.

## 검토했지만 택하지 않은 안
- 관이 찢어져 패가 보이는 안: 단서는 더 세지만 "알고 나면 당연한"보다 정답을 알려 주는 쪽이고, 클리어 때 관이 멀쩡해야 하는 연출과 어긋난다.
- 가로 자리 110·174·238·302(같은 간격): 238은 걸이 줄 236을 덮는다.
- 끙끙 때 혹 양옆에 힘쓰는 금 셋: 가운데 금이 핫스팟 왼쪽 끝 352 밖으로 나간다. 위아래 둘로 줄였다.