# 사장님 가이드

## 지켜보기
- **Slack**: `#goblin-dev`에서 작업 보고와 기술 토론을, `#goblin-meeting`에서 회의를, `#goblin-decisions`에서 결정 로그를, `#goblin-ceo`에서 주간 리포트와 결정 요청을 볼 수 있습니다. `#goblin-github`에는 GitHub 이벤트가 올라옵니다.
- **GitHub**: 이슈와 PR 코멘트를 보시면 됩니다. 모든 역할이 `claude[bot]` 계정으로 쓰고, 첫 줄의 서명(예: **[FE 테오]**)으로 누가 썼는지 구분합니다.
- **Actions 탭**: 에이전트가 실행될 때마다 `agent` 워크플로 실행 기록이 남습니다.

## 개입하기
- Slack 아무 채널에나 글을 쓰시면 됩니다. 에이전트는 실행할 때마다 Slack을 읽고, 사장님 글에 최우선으로 답합니다. 반응까지 최대 약 1시간 걸립니다.
- 바로 반응이 필요하면 GitHub 이슈나 PR에 코멘트를 다세요. PM이 즉시 깨어납니다. 특정 역할을 부르려면 `[[designer]]`처럼 씁니다.
- L3 결정 요청은 `#goblin-ceo`와 `ceo-decision` 라벨 이슈로 옵니다. 이슈에 답을 코멘트로 달아 주시면 됩니다.

## 멈추기와 속도 조절
- **완전 정지**: `gh variable set TEAM_PAUSED --body true -R zaffrex/goblin-crew` (재개: `--body false`)
- **속도 조절**: `team/schedule.json`의 `tick_every_hours`, `tick_roles`, `quiet_hours_kst`. 팀이 PR로 직접 조정할 수도 있습니다.
- **모델**: 역할별 모델과 effort는 `team/team.json`에 있습니다 (PM·디자이너·프론트 Opus 5.5, 백엔드·인프라 Sonnet 5.5).
- **비상 조절**: `gh variable set AGENT_MODEL --body claude-sonnet-5-5 -R zaffrex/goblin-crew`로 전원의 모델을 한 번에 덮어쓸 수 있습니다. 해제하려면 `gh variable delete AGENT_MODEL -R zaffrex/goblin-crew`를 실행하세요.
- **수동 실행**: `gh workflow run agent.yml -R zaffrex/goblin-crew -f role=pm -f mode=tick`

## 비용
- Claude 사용량은 사장님 구독에서 차감됩니다 (`CLAUDE_CODE_OAUTH_TOKEN`). 한도에 닿으면 실행이 실패하고, 인프라가 `#goblin-dev`에 알립니다.
- GitHub Actions는 public 저장소라 무료입니다.
