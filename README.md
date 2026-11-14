# goblin-crew

DOS 시절 협동 퍼즐 어드벤처에서 영감을 받은 **오리지널** 웹 게임을 만드는 저장소입니다.
개발은 PM, 디자이너, 프론트엔드, 백엔드, 인프라 역할의 Claude 에이전트 팀이 맡습니다.

- 팀 헌장: [`CLAUDE.md`](CLAUDE.md)
- 운영 매뉴얼: [`docs/team/operating-manual.md`](docs/team/operating-manual.md)
- 현재 상태: [`docs/team/status.md`](docs/team/status.md)
- 결정 기록(ADR): [`docs/adr/`](docs/adr/)
- 회의록: [`docs/meetings/`](docs/meetings/)
- 사장님 가이드: [`docs/team/owner-guide.md`](docs/team/owner-guide.md)

## 자동화 구조

```
 cron (team-schedule.yml) ─┬─ 역할별 매시간 작업 루프 ─┐
                           └─ 정기 회의 (PM 진행)      ├─▶ agent.yml (claude-code-action, 역할 하나)
 GitHub 이벤트 (router.yml) ─ [[role]] 토큰/라벨 ──────┘        │
                                                                ├─ Slack: scripts/slack.sh (역할별 이름/아이콘)
 PR ─▶ ci.yml + review-gate.yml (서명 기반 승인) ─▶ 머지         └─ GitHub: gh (서명으로 역할 구분)
```
