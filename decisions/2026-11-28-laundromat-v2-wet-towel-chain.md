---
schema: 1
id: 498efd4d-7252-460c-b273-eb51b0fdee0e
title: 빨래방 다시 짜기는 후보 B 전제(문 밖 열쇠를 안에서 되찾기)를 지키고, 역회전 건조기 대신 젖은 수건 물건 사슬로 짠다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-28
owner: "@zaffrex"
topic: laundromat-design
scope: [docs/design/screens/laundromat-v2.md, docs/design/screens/laundromat.md, content/screens/laundromat.json]
supersedes: 2620d7b4-effa-454a-9b94-3aea162bad0c
related: [6af3132c-c247-4da6-ab36-b20805f2a467, 14d7ce03-1173-40c1-9a9b-4d06247f4972]
revisit_when: Mia 블라인드나 진마씨 재플레이에서 "쭉이만 움직인다", "동전 끼임이 억지", 또는 다시 "퍼즐 요소가 없다"가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#1031
---
## 결정
- 스테이지 3 `laundromat`의 다시 짜기(ADR-1031 첫 적용)는 후보 B의 **전제**("문 밖으로 안 나가고 셔터 밑 틈 밖에 떨어진 가게 열쇠를 되찾는다")를 그대로 둔다.
- **메커닉은 바꾼다**: 거꾸로 도는 건조기 → 흡입 줄을 정답 길에서 빼고, 물건 사슬로 짠다. 까치를 プピッ으로 깨움 → 묵직이 쿵으로 자판기 동전·덕트 위 수건을 떨어뜨림(`weight.shake_down` 2번) → 쭉이가 수건과 동전을 세탁기에 넣음 → 낀 동전을 プピッ으로 울려 떨어뜨림(`sound.rattle`) → 젖은 수건 → 쭉이가 젖은 수건으로 틈 밖 열쇠를 덮어 끌어옴.
- 설계 원본은 `docs/design/screens/laundromat-v2.md`(#1031). 머지되면 화면 JSON PR이 이 문서대로 바뀌는 날 `laundromat.md`를 대체한다.

## 이유
- 진마씨 3화면 답(`#goblin-ceo` 2026-11-28): "퍼즐 요소가 전혀 없다", "처음의 건조기가 왜 이렇게 동작하는지 이해 못 했다". 역회전 건조기는 그 화면만의 버릇이라 앞으로 추론이 안 됐다.
- ADR-1031 6절이 첫 적용 화면을 빨래방으로 정하면서 "역회전 → 흡입 줄이 정답 길에서 빠질 수 있다"고 적었다.
- 새 사슬은 C1~C9 숫자를 다 지킨다(클릭 10, 깊이 6, 폭 2, 물건 6, 들 것 2, 쭉이 60%, 표 밖 버릇 1). Theo 모형 BFS(#1061): 노드 90, 최단 10, 막다른 상태 0.

## 당시 상황과 제약
- 그림 사용량이 빠듯해 방·세탁기·자판기·셔터·틈·열쇠 그림을 그대로 쓰고 새 칸은 13칸(Luna, #1061 리뷰).
- 후보 B 선택은 진마씨 L3였다. 전제는 지키고 메커닉만 ADR-1031에 따라 바꾼다.
- 진마씨께는 머지 뒤 PM이 알린다(L3 아님, #1061 PM 코멘트).

## 검토했지만 택하지 않은 안
- 역회전 건조기를 남기고 "왜"를 설명하는 단서만 더하기: 진마씨 ③을 단서로 메우는 것이고, 물건 변화·결합이 여전히 없다.
- 동전을 넣자마자 세탁기가 도는 안(동전 끼임 없음): 쭉이 6/9 = 67%로 C4(a) 경고(PM 한 표, Kai 결정으로 ⑤ 유지 + T7 동전 떨림). Mia에서 끼임이 억지로 읽히면 회의 없이 이 안으로 간다.