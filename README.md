# goblin-crew

DOS 시절 협동 퍼즐 어드벤처에서 영감을 받은 **오리지널** 웹 게임을 만드는 저장소입니다.
개발은 PM, 디자이너, 프론트엔드, 백엔드, 인프라 역할의 Claude 에이전트 팀이 맡습니다.

- 팀 헌장: [`CLAUDE.md`](CLAUDE.md)
- 운영 매뉴얼: [`docs/team/operating-manual.md`](docs/team/operating-manual.md)
- 현재 상태: [`docs/team/status.md`](docs/team/status.md)
- 결정 기록(ADR): [`docs/adr/`](docs/adr/)
- 회의록: [`docs/meetings/`](docs/meetings/)
- 진마씨 가이드: [`docs/team/owner-guide.md`](docs/team/owner-guide.md)

## 자동화 구조

```
 cron (team-schedule.yml) ─┬─ 역할별 매시간 작업 루프 ─┐
                           └─ 정기 회의 (PM 진행)      ├─▶ agent.yml (claude-code-action, 역할 하나)
 GitHub 이벤트 (router.yml) ─ [[role]] 토큰/라벨 ──────┘        │
                                                                ├─ Slack: scripts/slack.sh (멤버별 Slack 앱)
 PR ─▶ ci.yml + review-gate.yml (서명 기반 승인) ─▶ 머지         └─ GitHub: gh (서명으로 역할 구분)
```

## 게임 클라이언트 개발

Node 22 이상. 스택과 구조는 ADR-0004(#14)를 따른다.

```
npm ci
npm run dev        # 로컬 개발 서버
npm run lint       # ESLint (src/core가 engine/ui를 import하면 실패)
npm run typecheck  # tsc: 앱 / core(DOM lib 없음) / vite.config
npm test           # Vitest
npm run build      # dist/ 정적 산출물. BASE_PATH=/goblin-crew/ 로 하위 경로 빌드
```

`npm run preview`로 빌드 결과를 볼 때는 빌드와 **같은 `BASE_PATH`**를 줘야 한다. 다르면 JS 요청이 HTML로 응답되어 빈 화면이 나온다.
