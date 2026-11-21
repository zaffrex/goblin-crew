#!/usr/bin/env bash
# Per-role agent run usage over the last N hours (default 24).
# Usage: scripts/usage-report.sh [hours]
# Proxy metric only: wall-clock of GitHub Actions runs, not real subscription tokens.
# Paginates the Actions API with a created>= filter, so 7-day (168h) windows are not truncated.
# Appends loop warnings: same role >= 6 tick runs in any 1h window (events excluded: mention bursts are normal), or >= 3 consecutive failures.
# Env: USAGE_RUNS_JSON=<file> reads runs (array of {name,createdAt,updatedAt,conclusion,status}) instead of gh (tests).
set -euo pipefail
HOURS="${1:-24}"
[[ "$HOURS" =~ ^[0-9]+$ ]] || { echo "hours must be an integer" >&2; exit 2; }
SINCE=$(date -u -d "-${HOURS} hours" +%Y-%m-%dT%H:%M:%SZ)
if [ -n "${USAGE_RUNS_JSON:-}" ]; then
  RUNS=$(cat "$USAGE_RUNS_JSON")
else
  # The runs API caps created-filtered results at 1000, so query 24h slices and compare total_count with what we got.
  NOW=$(date +%s); START=$(date -u -d "$SINCE" +%s); PARTS=""
  for ((a=START; a<NOW; a+=86400)); do
    b=$((a+86400)); [ "$b" -gt "$NOW" ] && b=$((NOW+1))
    A=$(date -u -d "@$a" +%Y-%m-%dT%H:%M:%SZ); B=$(date -u -d "@$b" +%Y-%m-%dT%H:%M:%SZ)
    Q="repos/{owner}/{repo}/actions/workflows/agent.yml/runs?created=${A}..${B}&per_page=100"
    TOTAL=$(gh api "$Q&page=1" --jq '.total_count')
    PART=$(gh api --paginate "$Q" --jq '.workflow_runs[] | {name, createdAt: .created_at, updatedAt: .updated_at, conclusion, status}' | jq -s '.')
    GOT=$(jq 'length' <<<"$PART")
    [ "$GOT" -eq "$TOTAL" ] || echo "WARN: truncated $A..$B: got $GOT of $TOTAL runs; counts are too low" >&2
    PARTS+="$PART"$'\n'
  done
  RUNS=$(jq -s 'add // []' <<<"$PARTS")
fi
jq -r --arg since "$SINCE" --arg hours "$HOURS" '
  def mins: ((.updatedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) / 60;
  [ .[] | select(.createdAt >= $since and .status == "completed")
        | . + {role: (.name | split(" · ")[0]), mode: (.name | split(" · ")[1] // "?")} ] as $runs
  | ( $runs | group_by(.role) | map(
        (sort_by(.createdAt)) as $s
        | ($s | map(select(.mode == "tick") | .createdAt|fromdateiso8601)) as $t
        | ([ range(0; $t|length) as $i
             | [ $t[$i:][] | select(. < $t[$i] + 3600) ] | length ] | max // 0) as $burst
        | ([ $s[] | if .conclusion == "failure" then 1 else 0 end ]
            | reduce .[] as $f ({cur:0,max:0,}; (if $f == 1 then .cur += 1 else .cur = 0 end) | .max = ([.max,.cur]|max)) | .max) as $streak
        | { role: $s[0].role, burst: $burst, streak: $streak }
      )) as $loop
  | "| role | runs | tick | event | total min | avg min | failed |",
    "|---|---|---|---|---|---|---|",
    ( $runs | group_by(.role)[] |
      "| \(.[0].role) | \(length) | \(map(select(.mode=="tick"))|length) | \(map(select(.mode=="event"))|length) | \(map(mins)|add|floor) | \((map(mins)|add/length*10|floor)/10) | \(map(select(.conclusion=="failure"))|length) |" ),
    "| *total* | \($runs|length) | | | \($runs|map(mins)|add // 0|floor) | | \($runs|map(select(.conclusion=="failure"))|length) |",
    "",
    ( $loop[] | select(.burst >= 6) | "LOOP? \(.role): 1시간 안에 \(.burst)회 실행" ),
    ( $loop[] | select(.streak >= 3) | "LOOP? \(.role): 연속 실패 \(.streak)회" ),
    "note: role \"agent\" = runs before #55 naming; minutes = updatedAt-createdAt incl. queue time; window: last \($hours)h since \($since); completed runs only; cancelled counted as runs"'  <<<"$RUNS"
