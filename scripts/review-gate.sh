#!/usr/bin/env bash
# Computes the review-gate commit status for PR $PR. See .github/workflows/review-gate.yml
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEAM="$ROOT/team/team.json"
REPO="$GITHUB_REPOSITORY"
BOT=$(jq -r '.github_bot_login' "$TEAM")
CEO=$(jq -r '.ceo.github_login' "$TEAM")

pr=$(gh api "repos/$REPO/pulls/$PR")
sha=$(jq -r '.head.sha' <<<"$pr")
state() { # state <success|failure|pending> <description>
  echo "review-gate: $1 — $2"
  gh api -X POST "repos/$REPO/statuses/$sha" -f state="$1" -f context=review-gate -f description="${2:0:139}" >/dev/null
}
role_of() { jq -r --arg f "$1" '.roles | to_entries[] | select(.value.signature as $s | $f | contains($s)) | .key' "$TEAM" | head -n1; }

[ "$(jq -r '.state' <<<"$pr")" = open ] || { echo "PR not open"; exit 0; }
pr_user=$(jq -r '.user.login' <<<"$pr")
if [ "$pr_user" = "$CEO" ]; then state success "진마씨 PR"; exit 0; fi

files=$(gh api --paginate "repos/$REPO/pulls/$PR/files" --jq '.[].filename')
if ! grep -qvE '^(docs/meetings/|docs/decisions/|docs/team/status\.md$)' <<<"$files"; then
  state success "회의록/결정 기록/상태 문서만 변경 — 자동 통과"; exit 0
fi
is_adr=false; grep -qE '^docs/adr/[0-9]{4}-' <<<"$files" && ! grep -qx 'docs/adr/0000-template.md' <<<"$files" && is_adr=true

if [ "$pr_user" = "dependabot[bot]" ]; then
  author_role=dependabot   # 의존성 PR: 일반 PR처럼 팀 역할의 ✅ 승인 1개면 통과 (보통 인프라 Sam)
else
  author_line=$(jq -r '.body // ""' <<<"$pr" | grep -m1 '작성자:' || true)
  author_role=$(role_of "$author_line")
  [ -n "$author_role" ] || { state failure "PR 본문에 '작성자: <서명>' 줄이 없음"; exit 0; }
fi

head_date=$(gh api "repos/$REPO/commits/$sha" --jq '.commit.committer.date')

# 마지막 커밋 이후 봇 코멘트 중 서명이 있는 것: 역할별 최신 판정
verdicts=$(gh api --paginate "repos/$REPO/issues/$PR/comments" \
  --jq ".[] | select(.user.login == \"$BOT\" and .created_at > \"$head_date\") | {at: .created_at, body: .body}" | jq -s '.')
declare -A latest=()
while read -r c; do
  body=$(jq -r '.body' <<<"$c")
  r=$(role_of "$(head -n1 <<<"$body")")
  [ -n "$r" ] && [ "$r" != "$author_role" ] || continue
  # 판정 표시는 줄 맨 앞에 있을 때만 센다 (인용 `> `도 제외, 본문 중 다른 PR 언급의 "✅ 승인"은 무시)
  if grep -qE '^[[:space:]]*((- |\* )?(\*\*)?)🔁 수정 요청([[:space:]]|$|\*\*|[.:])' <<<"$body"; then latest[$r]=changes
  elif grep -qE '^[[:space:]]*((- |\* )?(\*\*)?)✅ 승인([[:space:]]|$|\*\*|[.:])' <<<"$body"; then
    # 리뷰한 커밋 표기(`sha: abc1234`)가 있으면 head SHA와 맞을 때만 센다 (#126).
    # 표기가 없는 승인은 전환기라 지금처럼 세되 경고를 남긴다.
    # 줄 맨 앞(불릿·굵게 허용)에서 시작하는 표기만 인정하고, 본문 속 "지난 커밋 abc1234" 같은 서술은 무시한다.
    # 판정 줄 이후만 보고, 그중 첫 표기를 쓴다 (판정 뒤 예시 목록의 `- sha: ...`을 집지 않도록, #190).
    rsha=$(sed -n '/^[[:space:]]*\(\(- \|\* \)\?\(\*\*\)\?\)\?✅ 승인/,$p' <<<"$body" | grep -oiE '^[[:space:]]*((- |\* )?(\*\*)?)?`?sha`?(\*\*)?[^0-9a-zA-Z]{0,6}[0-9a-f]{7,40}' | grep -oiE '[0-9a-f]{7,40}$' | head -n1 | tr 'A-F' 'a-f' || true)
    if [ -z "$rsha" ]; then
      echo "warn: $r 승인에 리뷰한 커밋(sha) 표기가 없음 (#126)"; latest[$r]=approve
    elif [ "${sha#"$rsha"}" != "$sha" ]; then latest[$r]=approve
    else echo "ignore: $r 승인은 옛 커밋($rsha) 기준 — head ${sha:0:7}"; fi
  fi
done < <(jq -c 'sort_by(.at) | .[]' <<<"$verdicts")

approvers=(); blockers=()
for r in "${!latest[@]}"; do
  [ "${latest[$r]}" = approve ] && approvers+=("$r") || blockers+=("$r")
done
if [ "${#blockers[@]}" -gt 0 ]; then state failure "수정 요청 미해결: ${blockers[*]}"; exit 0; fi

if [ "$is_adr" = true ]; then
  need_pm=$([ "$author_role" = pm ] && echo false || echo true)
  has_pm=false; for r in "${approvers[@]}"; do [ "$r" = pm ] && has_pm=true; done
  if [ "${#approvers[@]}" -lt 2 ]; then state pending "ADR: 다른 역할 승인 2개 필요 (현재 ${#approvers[@]}: ${approvers[*]:-없음})"; exit 0; fi
  if [ "$need_pm" = true ] && [ "$has_pm" = false ]; then state pending "ADR: PM 승인 필요 (현재: ${approvers[*]})"; exit 0; fi
  state success "ADR 승인: ${approvers[*]}"
else
  if [ "${#approvers[@]}" -lt 1 ]; then state pending "다른 역할의 ✅ 승인 필요 (마지막 커밋 이후)"; exit 0; fi
  state success "승인: ${approvers[*]}"
fi
