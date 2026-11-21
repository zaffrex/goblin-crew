#!/usr/bin/env bash
# Daily usage record: run from Sam's tick. After 09:00 KST, if today's record is not yet in #goblin-dev, post it.
# Slack is the state (marker "[사용량 기록 YYYY-MM-DD]"), so no extra PRs or workflow changes are needed.
# Usage: scripts/usage-daily.sh [--dry]   (--dry prints instead of posting)
# Env: SLACK_SH overrides the slack helper path (tests).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SLACK="${SLACK_SH:-scripts/slack.sh}"
TODAY=$(TZ=Asia/Seoul date +%F)
HOUR=$(TZ=Asia/Seoul date +%-H)
MARK="[사용량 기록 $TODAY]"
if [ "$HOUR" -lt 9 ]; then echo "before 09:00 KST, skip"; exit 0; fi
# Check since today's 09:00 KST (not "last N messages": a busy channel pushes the marker out). 999 = API max per page.
OLDEST=$(TZ=Asia/Seoul date -d "$TODAY 09:00" +%s)
if "$SLACK" --as infra history dev 999 "$OLDEST" | grep -qF "$MARK"; then echo "already posted today"; exit 0; fi
R24=$(scripts/usage-report.sh 24 2>&1)
R7=$(scripts/usage-report.sh 168 2>&1)
SUM7=$(grep -F '*total*' <<<"$R7" | sed 's/^| \*total\* | \([0-9]*\) .*| \([0-9]*\) | | \([0-9]*\) |$/\1회 \/ \2분 \/ 실패 \3/')
WARN7=$(grep '^WARN:' <<<"$R7" | sed 's/^/7일 /' || true)
BODY=$(printf '%s 최근 24h (대리 지표, 진마씨 화면 사용률과 대조용)\n```\n%s\n```\n7일: %s%s' \
  "$MARK" "$R24" "$SUM7" "${WARN7:+$'\n'$WARN7}")
if [ "${1:-}" = "--dry" ]; then echo "$BODY"; else "$SLACK" --as infra post dev - <<<"$BODY"; fi
