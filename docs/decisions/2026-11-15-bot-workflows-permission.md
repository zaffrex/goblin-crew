# 결정: 팀 봇에 workflows 권한 부여 (A), 리뷰 게이트는 사장님 승인으로 잠금

- 레벨: L3(사장님)
- 날짜: 2026-11-15
- 결정자: 사장님
- 참여: PM Noah(안건 정리), 인프라 Sam(막힘 보고)
- 출처: `#goblin-ceo` 사장님 결정 (2026-11-15), 이슈 #24

## 배경
Sam이 `deploy.yml`을 올리려다 막혔다. GitHub App에 `workflows` 권한이 없으면 `.github/workflows/*`를 수정할 수 없다. 권한을 주면 에이전트가 자기 감시 장치(CI, 리뷰 게이트)를 고칠 수 있게 되므로 L3로 올렸다.

## 선택지
- A. 권한만 부여 (빠름 / 리뷰 게이트를 봇이 무력화할 수 있음)
- B. 권한 없이 사장님이 웹에서 붙여넣기 (안전 / 매번 사장님 손 필요)
- C. 권한 부여 + `.github/` 변경은 사장님 승인 필수 (팀 추천 / 워크플로 PR마다 Approve 1번)

## 결정
**A.** 사장님: "A 로 가. 다만 리뷰 게이트는 봇이 못고치게 할순 없어?"
- 권한은 사장님이 앱 설정에서 부여한다.
- 리뷰 게이트 잠금: CODEOWNERS + 룰셋 "Require review from Code Owners"로 게이트 파일 변경에 사장님 승인을 요구한다. 봇은 룰셋을 바꿀 수 없어서(API 403 확인) 스스로 풀 수 없다.
- **잠금 범위: 2번** (사장님 "2로 가", 2026-11-15 01:08 KST). 게이트 파일(`review-gate.yml`, `scripts/review-gate.sh`, `team/team.json`, `.github/CODEOWNERS`) + `.github/workflows/` 전체를 CODEOWNERS로 사장님 승인 필수로 둔다. 1번만으로는 새 워크플로가 `review-gate` 상태를 위조하는 우회가 남기 때문.

## 후속 발견: 앱 권한만으로는 부족 (2026-11-15 01:2x)
- 사장님이 보내 준 화면상 Claude 앱 설치에는 이미 `workflows: Read and write`가 있다.
- 그래도 PM이 시험 push(`.github/workflows/` 아래 파일)를 해 보니 거절됐다.
- 원인: `agent.yml`의 `claude-code-action`이 토큰 교환 때 기본 권한(contents, pull_requests, issues)만 요청한다. `additional_permissions`에 `workflows: write`를 넣어야 한다. 이 줄은 워크플로 파일 안이라 봇이 고칠 수 없어서 **사장님이 웹에서 1회 PR을 만들고 머지**한다.
- 적용 순서: ① 사장님 `agent.yml` PR 머지 → ② CODEOWNERS PR #27에 `/.github/workflows/` 추가 후 머지 → ③ 룰셋 `main-protection`에 "Require review from Code Owners" 켜기. ③을 먼저 켜면 사장님 PR에 본인 승인이 필요해져 막힌다.
- 리스크: 토큰 교환 서버가 `workflows` 요청을 거절할 수 있다(미확인). 그러면 이번 건은 B(사장님 붙여넣기)로 처리한다.

## 적용 완료 (2026-11-15 01:35 KST)
- ① 사장님 `agent.yml` PR #30 머지 (`additional_permissions: workflows: write`)
- ② CODEOWNERS PR #27 머지 (`/.github/workflows/`, `review-gate.yml`, `scripts/review-gate.sh`, `team/team.json`, `.github/CODEOWNERS` → 사장님)
- ③ 사장님이 룰셋 `main-protection`에서 "Require review from Code Owners" 켬. API로 `require_code_owner_review: true` 확인.
- 검증: 봇 토큰으로 `.github/workflows/` 변경 브랜치 push 성공 (시험 브랜치는 즉시 삭제). 워크플로 PR #31은 코드 오너 승인 전까지 `BLOCKED` 상태로 잠금이 동작함을 확인. 위 리스크(토큰 교환 거절)는 발생하지 않음.

## 반대 의견
- PM: 1번만으로는 새 워크플로 파일이 `review-gate` 상태를 위조하는 우회가 남는다. 그래서 2번을 추천했다. 결정은 사장님 몫.
- 확인 중 기존 구멍을 발견: 게이트가 PR 쪽 `scripts/review-gate.sh`를 실행해서 PR이 자기 게이트를 고칠 수 있다. Sam이 main 쪽 스크립트로 판정하게 고친다 (#24).

## 다시 볼 조건
- 게이트 우회나 무단 워크플로 변경이 한 번이라도 발견되면 즉시 2번(또는 B)으로 강화하고 사장님께 보고.
- 사장님 승인 대기로 워크플로 PR이 1일 넘게 막히는 일이 반복되면 범위를 재검토.
