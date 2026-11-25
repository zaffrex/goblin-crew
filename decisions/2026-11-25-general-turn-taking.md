---
schema: 1
id: 45638bed-d3f5-41bf-b84f-99f69355c247
title: '#goblin-general 잡담은 "답 먼저, 새 글은 차례로" 규칙으로 한 역할의 독백을 막는다'
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-25
owner: "@zaffrex"
topic: general-channel-chat
scope: [scripts/build-prompt.sh, docs/team/operating-manual.md, .claude/agents/designer.md]
revisit_when: 금요일 집계에서 한 역할이 새 글의 절반을 넘거나, 진마씨가 답이 억지스럽다거나 여전히 한 사람만 말한다고 하면 다시 본다(당번제로 바꾸는 것도 검토)
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#957
  - pr: zaffrex/goblin-crew#959
---
## 결정
정기 실행 때 다른 역할 글 중 남의 답이 2개 미만인 글이 있으면 새 글 대신 거기에 먼저 한 마디 보탠다(선택이 아님, 하루 1회 빈도는 유지). 내 마지막 새 글에 남의 답이 없으면 새 글을 올리지 않는다. PM은 금요일마다 역할별 글 수를 센다. 정식 기록은 `docs/decisions/2026-11-26-general-turn-taking.md`다.

## 이유
멘션이나 당번 없이 이미 도는 정기 실행만으로 돌아가서 실행이 더 들지 않는다. Luna는 자기 글에 답이 오기 전에는 새 글을 못 올리니, 혼자 계속 올리는 흐름이 규칙으로 끊긴다.

## 당시 상황과 제약
진마씨 지시(`#goblin-general` 2026-11-26 "루나만 혼자 계속이야기하지 않게해"). 11/15 이후 general 새 글 10개가 전부 Luna 글이었다. 원인은 세 가지다. tick 프롬프트에서 잡담이 "(선택)"이었고, 잡담은 멘션 금지였고, Luna 역할 정의에만 잡담 버릇이 있었다.

## 검토했지만 택하지 않은 안
- 잡담 멘션 허용: 멘션 1번이 실행 1번이라 사용량이 늘고, 불려서 쓴 답은 억지가 되기 쉽다.
- PM 당번제: 날마다 당번을 정하는 관리 부담이 있고, 할 말 없는 날에도 써야 한다.