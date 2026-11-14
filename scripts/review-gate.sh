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
if [ "$pr_user" = "$CEO" ]; then state success "사장님 PR"; exit 0; fi

files=$(gh api --paginate "repos/$REPO/pulls/$PR/files" --jq '.[].filename')
if ! grep -qvE '^(docs/meetings/|docs/decisions/|docs/team/status\.md$)' <<<"$files"; then
  state success "회의록/결정 기록/상태 문서만 변경 — 자동 통과"; exit 0
fi
is_adr=false; grep -qE '^docs/adr/[0-9]{4}-' <<<"$files" && ! grep -qx 'docs/adr/0000-template.md' <<<"$files" && is_adr=true

author_line=$(jq -r '.body // ""' <<<"$pr" | grep -m1 '작성자:' || true)
author_role=$(role_of "$author_line")
[ -n "$author_role" ] || { state failure "PR 본문에 '작성자: <서명>' 줄이 없음"; exit 0; }

head_date=$(gh api "repos/$REPO/commits/$sha" --jq '.commit.committer.date')

# 마지막 커밋 이후 봇 코멘트 중 서명이 있는 것: 역할별 최신 판정
verdicts=$(gh api --paginate "repos/$REPO/issues/$PR/comments" \
  --jq ".[] | select(.user.login == \"$BOT\" and .created_at > \"$head_date\") | {at: .created_at, body: .body}" | jq -s '.')
declare -A latest=()
while read -r c; do
  body=$(jq -r '.body' <<<"$c")
  r=$(role_of "$(head -n1 <<<"$body")")
  [ -n "$r" ] && [ "$r" != "$author_role" ] || continue
  if grep -q '🔁 수정 요청' <<<"$body"; then latest[$r]=changes
  elif grep -q '✅ 승인' <<<"$body"; then latest[$r]=approve; fi
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
