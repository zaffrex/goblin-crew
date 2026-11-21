#!/usr/bin/env bash
# Per-role agent run usage over the last N hours (default 24).
# Usage: scripts/usage-report.sh [hours]
# Proxy metric only: wall-clock of GitHub Actions runs, not real subscription tokens.
# Queries the Actions API in 24h slices (created=A..B, B inclusive so slices end 1s before the next starts),
# because created-filtered results are capped at 1000; compares total_count per slice and WARNs on truncation.
# Appends loop warnings: same role >= TICK_BURST (6) tick runs or >= EVENT_BURST (12) event runs in any 1h window
# (events have a higher bar: mention bursts of 6-8/h are normal, mention ping-pong loops are what burns usage), or >= 3 consecutive failures.
# Env: TICK_BURST, EVENT_BURST override the thresholds.
# Env: USAGE_RUNS_JSON=<file> reads runs (array of {name,createdAt,updatedAt,conclusion,status}) instead of gh (tests).
set -euo pipefail
HOURS="${1:-24}"
TICK_BURST="${TICK_BURST:-6}"; EVENT_BURST="${EVENT_BURST:-12}"
[[ "$HOURS" =~ ^[0-9]+$ ]] || { echo "hours must be an integer" >&2; exit 2; }
SINCE=$(date -u -d "-${HOURS} hours" +%Y-%m-%dT%H:%M:%SZ)
if [ -n "${USAGE_RUNS_JSON:-}" ]; then
  RUNS=$(cat "$USAGE_RUNS_JSON")
else
  # The runs API caps created-filtered results at 1000, so query 24h slices and compare total_count with what we got.
  NOW=$(date +%s); START=$(date -u -d "$SINCE" +%s); PARTS=""
  for ((a=START; a<NOW; a+=86400)); do
    b=$((a+86399)); [ "$b" -gt "$NOW" ] && b=$((NOW+1))
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
jq -r --argjson tickb "$TICK_BURST" --argjson eventb "$EVENT_BURST" --arg since "$SINCE" --arg hours "$HOURS" '
  def mins: ((.updatedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) / 60;
  [ .[] | select(.createdAt >= $since and .status == "completed")
        | . + {role: (.name | split(" · ")[0]), mode: (.name | split(" · ")[1] // "?")} ] as $runs
  | ( $runs | group_by(.role) | map(
        (sort_by(.createdAt)) as $s
        | def burst($m): ($s | map(select(.mode == $m) | .createdAt|fromdateiso8601)) as $t
            | [ range(0; $t|length) as $i | [ $t[$i:][] | select(. < $t[$i] + 3600) ] | length ] | max // 0;
          (burst("tick")) as $tb | (burst("event")) as $eb
        | ([ $s[] | if .conclusion == "failure" then 1 else 0 end ]
            | reduce .[] as $f ({cur:0,max:0,}; (if $f == 1 then .cur += 1 else .cur = 0 end) | .max = ([.max,.cur]|max)) | .max) as $streak
        | { role: $s[0].role, tb: $tb, eb: $eb, streak: $streak }
      )) as $loop
  | "| role | runs | tick | event | total min | avg min | failed |",
    "|---|---|---|---|---|---|---|",
    ( $runs | group_by(.role)[] |
      "| \(.[0].role) | \(length) | \(map(select(.mode=="tick"))|length) | \(map(select(.mode=="event"))|length) | \(map(mins)|add|floor) | \((map(mins)|add/length*10|floor)/10) | \(map(select(.conclusion=="failure"))|length) |" ),
    "| *total* | \($runs|length) | | | \($runs|map(mins)|add // 0|floor) | | \($runs|map(select(.conclusion=="failure"))|length) |",
    "",
    ( $loop[] | select(.tb >= $tickb) | "LOOP? \(.role): 1시간 안에 tick \(.tb)회 실행" ),
    ( $loop[] | select(.eb >= $eventb) | "LOOP? \(.role): 1시간 안에 event \(.eb)회 실행 (멘션 핑퐁 의심)" ),
    ( $loop[] | select(.streak >= 3) | "LOOP? \(.role): 연속 실패 \(.streak)회" ),
    "note: role \"agent\" = runs before #55 naming; minutes = updatedAt-createdAt incl. queue time; window: last \($hours)h since \($since); completed runs only; cancelled counted as runs"'  <<<"$RUNS"
