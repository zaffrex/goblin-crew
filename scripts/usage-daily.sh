#!/usr/bin/env bash
# Daily usage record: run from Sam's tick. After 09:00 KST, if today's record is not yet in #goblin-dev, post it.
# Slack is the state (marker "[사용량 기록 YYYY-MM-DD]"), so no extra PRs or workflow changes are needed.
# Usage: scripts/usage-daily.sh [--dry]   (--dry prints instead of posting)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
TODAY=$(TZ=Asia/Seoul date +%F)
HOUR=$(TZ=Asia/Seoul date +%-H)
MARK="[사용량 기록 $TODAY]"
if [ "$HOUR" -lt 9 ]; then echo "before 09:00 KST, skip"; exit 0; fi
if scripts/slack.sh --as infra history dev 60 | grep -qF "$MARK"; then echo "already posted today"; exit 0; fi
BODY=$(printf '%s 최근 24h (대리 지표, 진마씨 화면 사용률과 대조용)\n```\n%s\n```\n7일: %s' \
  "$MARK" "$(scripts/usage-report.sh 24)" \
  "$(scripts/usage-report.sh 168 | grep -F '*total*' | sed 's/^| \*total\* | \([0-9]*\) .*| \([0-9]*\) | | \([0-9]*\) |$/\1회 \/ \2분 \/ 실패 \3/')")
if [ "${1:-}" = "--dry" ]; then echo "$BODY"; else scripts/slack.sh --as infra post dev - <<<"$BODY"; fi
