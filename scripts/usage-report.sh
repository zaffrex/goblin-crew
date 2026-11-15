#!/usr/bin/env bash
# Per-role agent run usage over the last N hours (default 24).
# Usage: scripts/usage-report.sh [hours]
# Proxy metric only: wall-clock of GitHub Actions runs, not real subscription tokens.
set -euo pipefail
HOURS="${1:-24}"
[[ "$HOURS" =~ ^[0-9]+$ ]] || { echo "hours must be an integer" >&2; exit 2; }
LIMIT=500
SINCE=$(date -u -d "-${HOURS} hours" +%Y-%m-%dT%H:%M:%SZ)
gh run list --workflow agent.yml --limit "$LIMIT" --json name,createdAt,updatedAt,conclusion,status |
jq -r --argjson limit "$LIMIT" --arg since "$SINCE" '
  def mins: ((.updatedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) / 60;
  (length as $n | (map(.createdAt) | min // "") as $oldest
   | if $n >= $limit and $oldest > $since then "WARN: truncated at \($n) runs (oldest \($oldest) is newer than window start); counts are too low" else "" end) as $warn
  | [ .[] | select(.createdAt >= $since and .status == "completed")
        | . + {role: (.name | split(" · ")[0]), mode: (.name | split(" · ")[1] // "?")} ] as $runs
  | (if $warn != "" then $warn, "" else empty end),
    "| role | runs | tick | event | total min | avg min | failed |",
    "|---|---|---|---|---|---|---|",
    ( $runs | group_by(.role)[] |
      "| \(.[0].role) | \(length) | \(map(select(.mode=="tick"))|length) | \(map(select(.mode=="event"))|length) | \(map(mins)|add|floor) | \((map(mins)|add/length*10|floor)/10) | \(map(select(.conclusion=="failure"))|length) |" ),
    "",
    "note: role \"agent\" = runs before #55 naming; minutes = updatedAt-createdAt incl. queue time; window: last '"$HOURS"'h since \($since); completed runs only; cancelled counted as runs"'
