---
schema: 1
id: 1f3f1475-3336-45ce-9cd0-aeaa6c5a1597
title: 빨래방 덕트·들창 배치는 그대로 두고, 길바닥 열쇠는 90,236 30×8의 열쇠 실루엣(패 9×6 → 빨간 끈 → 구멍 2×2 고리 → 몸 → 이)으로 다시 그린다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: laundromat-art-layout
scope: [art/scenes/laundromat.room.mjs, art/scenes/laundromat.shutter.mjs, art/scenes/laundromat.objects.mjs, content/screens/laundromat.json, docs/design/screens/laundromat-bg-sketch.mjs, docs/design/screens/laundromat-gap-snatch-preview.mjs]
supersedes: ecfe391e-bd1e-4877-8099-09031f6e1409
related: [675d4bae-5cfa-4ea1-a048-f4fb443b2358, 3d7bd2be-3c2e-42e6-ad9d-5ce01cdcb74a]
revisit_when: A쌍(길바닥 열쇠 → 틈 속 머리) 블라인드 재판정에서 다시 열쇠로 안 읽히거나, `gap.nudge`(5-1, 오른쪽 6px 밀기) 칸을 찍을 때 고리·몸이 판 뒤로 너무 가려질 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#764
  - pr: zaffrex/goblin-crew#908
---
## 결정
- 덕트·후드·들창·셔터는 이전 결정 그대로다. 덕트(`DUCT`)는 3번 건조기 뒤에서 y 52까지 올라가 꺾이고 위쪽 벽 y 52~63을 가로질러 들창 오른쪽 칸 판자(끝 x 92)를 뚫고 나간다. 바깥 후드(`HOOD`)는 들창 왼쪽 칸 안 y 54~62. 들창 틀(`TRANSOM`)은 58,22 56×52이고 `magpie` 핫스팟이 이 상자를 쓴다. 셔터 잠김 그림은 아래 끝을 6px 띄우고 꼭짓점 x 112를 가장 큰 틈 14px로 찌그러뜨린다. 덕트 혹(O6) 가로 길은 y 52~63.
- **바뀐 것: 길바닥 열쇠(O1)는 `KEY_ON_STREET` 90,236, `KEY_TAG` 30×8**이다(전: 97,236 19×8). `gap` 핫스팟(80,222 40×24) 안이다.
  - 왼쪽부터 나무 패 9×6(둥지 속 패 O2와 같은 크기) → 끈 redD 3px → 둥근 금색 고리 8×8(가운데 구멍 2×2는 비워 길바닥이 비친다, 구멍 106,239) → 몸 8px → 위로 솟은 이 두 개(높이 2·1).
  - 금색 픽셀이 나무 패보다 많다(52 : 28). 높은 것(고리·이)은 틈 꼭짓점 가까이, 낮은 패는 틈이 얕은 왼쪽에 둔다.
  - 까치 부리(reach) 끝은 고리 구멍을 겨누고, bite는 부리가 금색 고리 테를 문다. 머리 칸(`GAP_HEAD_ROWS`)은 안 바꾼다.
- 검사: `laundromat-bg-sketch.mjs`에 "금색 ≥ 나무 패", "고리 구멍 2×2가 비고 둘레 8px이 금색"을 더한다. `laundromat-gap-snatch-preview.mjs`의 bite 검사는 lint 고리 대신 금색 고리 테와 부리의 맞닿음을 본다.

## 이유
- 11/25 단서 칸 블라인드(#764)에서 길바닥 열쇠가 "갈색 상자 + 노란 병아리"(Luna 판정자), "주황·갈색 덩어리"(PM 판정자)로 읽혔다. 누운 열쇠가 6×4 노란 덩어리로 뭉쳤고, 고리 구멍 ink 1px이 눈으로 찍혔고, 패(10×8)가 열쇠보다 커서 눈이 먼저 패로 갔다.
- S0(문 밖에 열쇠가 있다)과 S4(까치가 가져갔다)가 이 칸에 걸려 있어 시트에 넣기 전에 고쳐야 했다.
- 끈은 처음에 lint였는데 길바닥 빛 띠(y 239 lint, 240 lav) 위라 안 보여서, 패와 열쇠가 따로 노는 것처럼 보였다. redD는 빛 띠와 명도 차 62~109.

## 당시 상황과 제약
- 틈은 꼭짓점 x 112에서만 14px이고 양 끝은 6px이라, 8px 높이 고리는 x 103~110에만 들어간다. 패를 오른쪽에 두면 `gap` 핫스팟 오른쪽 끝(x 119)을 넘어서 패는 왼쪽에 두었다.
- 새 칸은 0이다(O1 칸을 다시 그림). 화면 JSON은 note 한 줄만 바뀐다.

## 검토했지만 택하지 않은 안
- 패를 7×5로 줄이기(#764 블라인드 코멘트 처음 안): S5 "패가 넓어서 걸린다"를 약하게 하고, 둥지 속 패(9×6)와 크기가 달라진다. 크기는 두고 금색 면적을 늘렸다.
- 열쇠를 왼쪽으로 눕히고 패를 오른쪽에: 패가 핫스팟 밖으로 나간다.
- 까치 머리 위치를 옮기기: 머리는 틈 꼭짓점에서만 보여서 못 옮긴다.