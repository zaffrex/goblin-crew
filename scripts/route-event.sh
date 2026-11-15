#!/usr/bin/env bash
# Event router (runs inside router.yml). Reads $GITHUB_EVENT_PATH and dispatches agent.yml runs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEAM="$ROOT/team/team.json"
EV="$GITHUB_EVENT_PATH"
REPO="$GITHUB_REPOSITORY"
BOT=$(jq -r '.github_bot_login' "$TEAM")
CEO=$(jq -r '.ceo.github_login' "$TEAM")
LOOP_LIMIT=12   # 한 이슈/PR에서 최근 60분 동안 봇 코멘트가 이만큼 넘으면 더 깨우지 않는다

num=$(jq -r '.issue.number // .pull_request.number' "$EV")
url=$(jq -r '.comment.html_url // .issue.html_url // .pull_request.html_url' "$EV")
case "$EVENT_NAME" in
  issue_comment) who=$(jq -r '.comment.user.login' "$EV"); assoc=$(jq -r '.comment.author_association' "$EV"); body=$(jq -r '.comment.body // ""' "$EV") ;;
  issues)        who=$(jq -r '.sender.login' "$EV"); assoc=$(jq -r '.issue.author_association' "$EV"); body=$(jq -r '.issue.body // ""' "$EV") ;;
  pull_request)  who=$(jq -r '.pull_request.user.login' "$EV"); assoc=$(jq -r '.pull_request.author_association' "$EV"); body=$(jq -r '.pull_request.body // ""' "$EV") ;;
  *) echo "unsupported event $EVENT_NAME"; exit 0 ;;
esac
kind=$([ "$EVENT_NAME" = pull_request ] || jq -e '.issue.pull_request' "$EV" >/dev/null 2>&1 && echo PR || echo 이슈)

# 1) 신뢰 검사
trusted=false
if [ "$who" = "$BOT" ] || [ "$who" = "$CEO" ]; then trusted=true
elif [[ "$assoc" =~ ^(OWNER|MEMBER|COLLABORATOR)$ ]]; then trusted=true; fi
if [ "$trusted" != true ]; then echo "untrusted author $who ($assoc) — ignore"; exit 0; fi

# 2) 작성 역할 (봇 글의 첫 줄 서명)
author_role=""
if [ "$who" = "$BOT" ]; then
  first=$(head -n1 <<<"$body")
  author_role=$(jq -r --arg f "$first" '.roles | to_entries[] | select(.value.signature as $s | $f | contains($s)) | .key' "$TEAM" | head -n1)
fi
who_label=$([ -n "$author_role" ] && jq -r --arg r "$author_role" '.roles[$r].signature' "$TEAM" || { [ "$who" = "$CEO" ] && echo 사장님 || echo "$who"; })

# 3) 깨울 역할 결정
# HTML 주석, 펜스 코드 블록(``` / ~~~), 인라인 코드(`..`, ``..``) 안의 토큰은 설명이므로 읽지 않는다.
# 순서 중요: 주석 → 펜스 → 이중 백틱 → 단일 백틱. 짝 없는 백틱은 그대로 둔다(줄 단위로만 짝을 맞춘다).
strip_quoted() {
  perl -0pe 's/<!--.*?-->//gs; s/^[ \t]*```.*?^[ \t]*```[ \t]*$//gms; s/^[ \t]*~~~.*?^[ \t]*~~~[ \t]*$//gms; s/``[^\n]*?``//g; s/`[^`\n]*`//g' <<<"$1"
}
declare -A wake=()
for r in $(grep -oE '\[\[(pm|designer|frontend|backend|infra)\]\]' <<<"$(strip_quoted "$body")" | tr -d '[]' | sort -u); do wake[$r]=1; done

if [ "$EVENT_NAME" = issues ] && [ "$ACTION" = labeled ]; then
  label=$(jq -r '.label.name' "$EV")
  r=$(jq -r --arg l "$label" '.roles | to_entries[] | select(.value.label == $l) | .key' "$TEAM")
  issue_first=$(jq -r '.issue.body // ""' "$EV" | head -n1)
  issue_author_role=$(jq -r --arg f "$issue_first" '.roles | to_entries[] | select(.value.signature as $s | $f | contains($s)) | .key' "$TEAM" | head -n1)
  # 역할 라벨만 반응. 이미 위에서 토큰 처리를 했으니 labeled 이벤트에서는 본문 토큰을 다시 쓰지 않는다.
  wake=()
  if [ -n "$r" ] && [ "$r" != "$issue_author_role" ]; then wake[$r]=1; fi
  if [ "$label" = "ceo-decision" ]; then echo "ceo-decision label — PM handles escalation in its own run"; fi
fi

if [ "$EVENT_NAME" = issues ] && [ "$ACTION" = opened ]; then
  has_role_label=$(jq -r '[.issue.labels[].name | select(startswith("role:"))] | length' "$EV")
  if [ "${#wake[@]}" -eq 0 ] && [ "$has_role_label" = 0 ]; then wake[pm]=1; fi
fi

# 사장님 글은 토큰이 없어도 PM이 본다
if [ "$who" = "$CEO" ] && [ "${#wake[@]}" -eq 0 ] && [ "$EVENT_NAME" != pull_request ]; then wake[pm]=1; fi

# 자기 자신은 깨우지 않는다
[ -n "$author_role" ] && unset "wake[$author_role]"

if [ "${#wake[@]}" -eq 0 ]; then echo "nobody to wake"; exit 0; fi

# 4) 루프 방지
since=$(date -u -d '60 minutes ago' +%Y-%m-%dT%H:%M:%SZ)
recent=$(gh api "repos/$REPO/issues/$num/comments?since=$since&per_page=100" --jq "[.[] | select(.user.login == \"$BOT\")] | length")
if [ "$recent" -ge "$LOOP_LIMIT" ]; then
  echo "loop guard: $recent bot comments in last hour on #$num"
  scripts/slack.sh --as infra post dev "🛑 루프 방지: ${kind} #${num}에서 최근 1시간 봇 코멘트가 ${recent}개라 자동 호출을 멈췄어요. 다음 정기 작업에서 이어갑니다. $url" || true
  exit 0
fi

# 5) 디스패치
ctx="${kind} #${num} 에서 ${who_label}의 ${EVENT_NAME}/${ACTION} 이벤트 — $url"
for r in "${!wake[@]}"; do
  echo "wake $r: $ctx"
  gh workflow run agent.yml -R "$REPO" -f role="$r" -f mode=event -f context="$ctx"
done
