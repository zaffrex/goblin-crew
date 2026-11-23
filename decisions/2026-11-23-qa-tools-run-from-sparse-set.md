---
schema: 1
id: 810f81a2-0c60-4847-a627-e2b1fe14311c
title: QA 도구는 agent.yml QA sparse 목록 파일만으로 떠야 하고, 그 목록만 복사해 browse.ts를 띄우는 테스트로 지킨다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-23
owner: "@zaffrex"
topic: qa-sparse-checkout
scope: [scripts/qa/**, scripts/playtest/cdp.ts, tests/qa-sparse-checkout.test.ts]
related: [f06ba58d-f14b-4665-9c32-61bd046f1ea5]
revisit_when: QA 실행 checkout 방식(agent.yml sparse 블록)을 바꾸거나, QA 도구가 브라우저 실행 중에 저장소 파일을 읽게 될 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#855
  - pr: zaffrex/goblin-crew#854
  - issue: zaffrex/goblin-crew#601
---
## 결정
`scripts/qa/`의 실행 파일(테스트 제외)과 그것이 불러오는 모듈은 `.github/workflows/agent.yml` QA checkout의 `sparse-checkout` 목록에 있는 파일만 import·읽기 한다. `content/`·`docs/`·`src/`는 목록에 넣지 않는다(정답 미리 보기 방지, #516). 이 조건은 `tests/qa-sparse-checkout.test.ts`가 지킨다: 목록 경로만 임시 폴더에 복사하고 `node scripts/qa/browse.ts`를 일부러 막히는 URL로 띄워, `ENOENT`·`ERR_MODULE_NOT_FOUND` 없이 url-guard까지 가는지 본다.

## 이유
#850이 `seen.ts` 모듈 최상위에서 `content/text/ja.json`을 읽게 했는데, CI는 전체 checkout이라 초록이었고 QA 실행만 클릭 0번에서 멈췄다(#601 모바일 1회, 11/23). CI와 QA 실행의 파일 집합이 달라서 생기는 문제라, QA 실행과 같은 파일 집합에서 실제로 띄워 보는 게 가장 직접적이다.

## 당시 상황과 제약
- #854가 안내 글자를 `seen.ts`에 직접 두고 ja.json과 같은지는 테스트로 보게 고쳤다(결정 f06ba58d 기록 방식은 그대로).
- 테스트는 agent.yml 블록을 그대로 읽어서 목록이 바뀌어도 따라간다. 블록을 못 찾으면 실패한다.

## 검토했지만 택하지 않은 안
- 정적 검사(`scripts/qa/*.ts`에 `content/`·`../../` 문자열 금지): 주석에 `content/`가 나와 오탐이 나고, 동적 경로를 못 잡는다.
- QA checkout에 `content/text/ja.json` 추가: Mia가 대사를 미리 다 보게 된다(진마씨 11/23 반대).
- 한계: url-guard 뒤 브라우저 실행 중 읽는 파일은 못 잡는다. 지금 그런 읽기는 `--actions` 파일뿐이다.