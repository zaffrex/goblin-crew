#!/usr/bin/env bash
# Near-real-time Slack listener (no server): polls the team channels and the CEO's DM with each member,
# and wakes the right agent (agent.yml, mode=event) when it is mentioned or when the CEO writes.
# Runs inside a long GitHub Actions job (slack-listener.yml) that is restarted by cron.
#
# Env: SLACK_TOKEN_<ROLE> (x5), GH_TOKEN, REPO
# Optional: POLL_SECONDS=15 MAX_SECONDS=20400 LOOKBACK_SECONDS=60 ROLE_WAKES_PER_HOUR=20
#           BOT_WAKES_PER_THREAD_PER_HOUR=8 DRY_RUN=1 (print dispatches instead of running them)
#
# Privacy: the repo is public, so Actions logs are public. Never log or dispatch Slack message text;
# only pass pointers (channel, ts, author). The agent reads the text itself through scripts/slack.sh.
set -uo pipefail   # no -e: one failed API call must not kill the listener

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEAM="$ROOT/team/team.json"
ROLES=(pm designer frontend backend infra)
CEO_ID=$(jq -r '.ceo.slack_user_id' "$TEAM")
POLL=${POLL_SECONDS:-15}; MAX=${MAX_SECONDS:-20400}; LOOKBACK=${LOOKBACK_SECONDS:-60}
ROLE_CAP=${ROLE_WAKES_PER_HOUR:-20}; THREAD_CAP=${BOT_WAKES_PER_THREAD_PER_HOUR:-8}
REPO="${REPO:?REPO is required}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
field() { jq -r --arg r "$1" --arg f "$2" '.roles[$r][$f] // empty' "$TEAM"; }
token_of() { local v; v=$(field "$1" slack_token_env); if [ -n "$v" ]; then printf '%s' "${!v:-}"; fi; }

slack() { # slack <token> <GET|POST> <method> <query-or-json>  -> json on stdout, empty on failure
  local resp
  if [ "$2" = GET ]; then
    resp=$(curl -sS -G "https://slack.com/api/$3" -H "Authorization: Bearer $1" --data "$4" 2>/dev/null)
  else
    resp=$(curl -sS -X POST "https://slack.com/api/$3" -H "Authorization: Bearer $1" \
      -H "Content-Type: application/json; charset=utf-8" --data "$4" 2>/dev/null)
  fi
  if [ "$(jq -r '.ok' <<<"$resp" 2>/dev/null)" = "true" ]; then printf '%s' "$resp"; return 0; fi
  local err; err=$(jq -r '.error // "no-response"' <<<"$resp" 2>/dev/null)
  log "slack $3 failed: ${err:-unknown}"
  [ "$err" = ratelimited ] && sleep 30
  return 1
}

# --- who is who -------------------------------------------------------------------------------
declare -A ROLE_OF_UID
TOKENS=()
for r in "${ROLES[@]}"; do
  t=$(token_of "$r"); [ -n "$t" ] || { log "no token for $r"; continue; }
  TOKENS+=("$t")
  uid=$(slack "$t" POST auth.test '{}' | jq -r '.user_id // empty')
  [ -n "$uid" ] && ROLE_OF_UID[$uid]=$r
done
[ "${#TOKENS[@]}" -gt 0 ] || { log "no Slack tokens; exiting"; exit 1; }

# --- channels to watch: team channels + CEO DM per member ----------------------------------------
declare -A CH_TOKEN CH_NAME CH_DMROLE CURSOR WIDE_CURSOR SEEN
# WIDE_CURSOR: separate cursor for the wide scan, advanced only by wide scans (a normal tick moving CURSOR must not hide
# old-thread replies from it). SEEN[ch:ts]: messages already handled, so normal and wide scans never wake twice.
# Start cursor: previous listener's end - OVERLAP (covers the handover and any cron-recovery gap, issue #11).
# Cancelled runs are skipped: queued cron runs get cancelled at each handover and would give a too-early end (PM #11).
# Capped at MAX_BACKFILL so old posts never wake agents; falls back to now - LOOKBACK if no previous run is found.
OVERLAP=${OVERLAP_SECONDS:-30}; MAX_BACKFILL=${MAX_BACKFILL_SECONDS:-3600}
PREV_END=""
prev_iso=$(gh run list -R "$REPO" --workflow slack-listener.yml --status completed --limit 10 --json updatedAt,conclusion --jq '[.[] | select(.conclusion != "cancelled")] | max_by(.updatedAt) | .updatedAt // empty' 2>/dev/null) || prev_iso=""
[ -n "$prev_iso" ] && PREV_END=$(date -d "$prev_iso" +%s 2>/dev/null || true)
now_s=$(date +%s)
if [ -n "$PREV_END" ]; then
  start_s=$(( PREV_END - OVERLAP ))
  [ "$start_s" -lt $(( now_s - MAX_BACKFILL )) ] && start_s=$(( now_s - MAX_BACKFILL ))
  [ "$start_s" -gt "$now_s" ] && start_s=$(( now_s - LOOKBACK ))
else
  start_s=$(( now_s - LOOKBACK ))
fi
start_cursor="${start_s}.000000"
i=0
while IFS=$'\t' read -r name id; do
  CH_TOKEN[$id]="${TOKENS[$(( i % ${#TOKENS[@]} ))]}"; CH_NAME[$id]=$name; CH_DMROLE[$id]=""; CURSOR[$id]=$start_cursor; WIDE_CURSOR[$id]=$start_cursor
  i=$((i + 1))
done < <(jq -r '.slack_channels | to_entries[] | "\(.key)\t\(.value)"' "$TEAM")
for r in "${ROLES[@]}"; do
  t=$(token_of "$r"); [ -n "$t" ] || continue
  dm=$(slack "$t" POST conversations.open "$(jq -n --arg u "$CEO_ID" '{users:$u}')" | jq -r '.channel.id // empty')
  [ -n "$dm" ] || continue
  CH_TOKEN[$dm]=$t; CH_NAME[$dm]="ceo-dm"; CH_DMROLE[$dm]=$r; CURSOR[$dm]=$start_cursor; WIDE_CURSOR[$dm]=$start_cursor
done
# Handover gap (numbers only, no message text): seconds between the previous listener job ending and this one starting.
# If the max over a week exceeds LOOKBACK_SECONDS, raise LOOKBACK_SECONDS (issue #11).
gap_log() {
  [ -n "$PREV_END" ] || return 0
  log "handover gap: $(( $(date +%s) - PREV_END ))s since previous listener ended (cursor = prev end - ${OVERLAP}s, cap ${MAX_BACKFILL}s)"
}
gap_log
log "watching ${#CH_NAME[@]} conversations, ${#ROLE_OF_UID[@]} member bots"

# --- wake bookkeeping ---------------------------------------------------------------------------
declare -A PENDING ROLE_WAKES THREAD_WAKES THREAD_WARNED
recent_count() { # recent_count "<space-separated epoch list>" -> prints pruned list; count = words
  local now; now=$(date +%s); local out="" x
  for x in $1; do [ $((now - x)) -lt 3600 ] && out="$out $x"; done
  echo "$out"
}

enqueue() { # enqueue <role> <line> <by-bot:0|1> <thread-key>
  local role="$1" line="$2" bybot="$3" key="$4"
  if [ "$bybot" = 1 ]; then
    THREAD_WAKES[$key]=$(recent_count "${THREAD_WAKES[$key]:-}")
    if [ "$(wc -w <<<"${THREAD_WAKES[$key]}")" -ge "$THREAD_CAP" ]; then
      if [ -z "${THREAD_WARNED[$key]:-}" ]; then
        THREAD_WARNED[$key]=1
        local ch="${key%%:*}" ts="${key#*:}"
        AGENT_ROLE=infra "$ROOT/scripts/slack.sh" --as infra post "${CH_NAME[$ch]}" \
          "🛑 이 스레드에서 멤버끼리 자동 호출이 1시간에 ${THREAD_CAP}번을 넘어서 잠시 멈춰요. 다음 정기 작업에서 이어가요." \
          --thread "$ts" >/dev/null 2>&1 || true
        log "thread cap hit: ${CH_NAME[$ch]} $ts"
      fi
      return
    fi
    THREAD_WAKES[$key]="${THREAD_WAKES[$key]} $(date +%s)"
  fi
  PENDING[$role]="${PENDING[$role]:-}"$'\n'"- $line"
}

flush() {
  local role ctx
  for role in "${!PENDING[@]}"; do
    ROLE_WAKES[$role]=$(recent_count "${ROLE_WAKES[$role]:-}")
    if [ "$(wc -w <<<"${ROLE_WAKES[$role]}")" -ge "$ROLE_CAP" ]; then
      log "role cap hit: $role (kept pending, retry next tick)"; continue
    fi
    ctx="Slack에서 너를 불렀다. 먼저 아래 위치의 메시지와 스레드를 읽고(scripts/slack.sh --as <너의 역할> thread <channel> <thread_ts>), 그 스레드에 바로 답한다:${PENDING[$role]}"
    if [ "${DRY_RUN:-}" = 1 ]; then echo "DISPATCH $role :: $ctx"
    elif ! gh workflow run agent.yml -R "$REPO" -f role="$role" -f mode=event -f context="$ctx" >/dev/null 2>&1; then
      log "dispatch failed for $role (kept pending, retry next tick)"; continue   # do not lose the queue on failure
    else log "woke $role"; fi
    ROLE_WAKES[$role]="${ROLE_WAKES[$role]} $(date +%s)"
    unset 'PENDING[$role]'   # only drop what was dispatched; capped roles keep their queue
  done
}

author_label() { if [ "$1" = ceo ]; then echo "진마씨"; else field "$1" slack_username; fi; }

process() { # process <channel-id> <message-json> <thread-parent-user>
  local ch="$1" m="$2" parent_user="$3"
  local subtype user author ts thread mentions targets t
  subtype=$(jq -r '.subtype // ""' <<<"$m")
  case "$subtype" in ""|thread_broadcast|file_share) ;; *) return ;; esac
  [ -z "${SEEN[$ch:$(jq -r '.ts' <<<"$m")]:-}" ] || return 0
  SEEN[$ch:$(jq -r '.ts' <<<"$m")]=1
  user=$(jq -r '.user // ""' <<<"$m")
  if [ "$user" = "$CEO_ID" ]; then author=ceo
  elif [ -n "${ROLE_OF_UID[$user]:-}" ]; then author=${ROLE_OF_UID[$user]}
  else return; fi   # other humans/bots never wake agents
  ts=$(jq -r '.ts' <<<"$m"); thread=$(jq -r '.thread_ts // .ts' <<<"$m")
  mentions=""
  for u in $(jq -r '.text // ""' <<<"$m" | grep -o '<@[UW][A-Z0-9]*>' | tr -d '<@>' | sort -u); do
    [ -n "${ROLE_OF_UID[$u]:-}" ] && mentions="$mentions ${ROLE_OF_UID[$u]}"
  done
  targets=""
  if [ "$author" = ceo ]; then
    if [ -n "$mentions" ]; then targets=$mentions
    elif [ -n "${CH_DMROLE[$ch]}" ]; then targets=${CH_DMROLE[$ch]}
    elif [ -n "$parent_user" ] && [ -n "${ROLE_OF_UID[$parent_user]:-}" ]; then targets=${ROLE_OF_UID[$parent_user]}
    else targets=pm; fi
  else
    for t in $mentions; do [ "$t" != "$author" ] && targets="$targets $t"; done
  fi
  [ -n "$targets" ] || return 0
  local line bybot=0; [ "$author" != ceo ] && bybot=1
  line="channel=${CH_NAME[$ch]} ts=$ts thread_ts=$thread 작성자=$(author_label "$author")"
  for t in $targets; do enqueue "$t" "$line" "$bybot" "$ch:$thread"; done
  log "event ${CH_NAME[$ch]} ts=$ts from=$author -> $targets"
}

# --- tick watchdog ------------------------------------------------------------------------------
# GitHub cron (team-schedule.yml) fires late or skips hours (11/14~15 we saw 3~4 hour gaps).
# If a role in tick_roles has had no tick for tick_every_hours + TICK_GRACE_MIN, dispatch one here.
# Ticks are found by agent.yml run-name "<role> · tick". The listener start counts as the last tick,
# so a fresh listener never bursts all roles at once.
TICK_GRACE_MIN=${TICK_GRACE_MIN:-20}
watchdog() {
  local cfg every limit now runs r last last_s
  cfg=$(gh api "repos/$REPO/contents/team/schedule.json" --jq .content 2>/dev/null | base64 -d 2>/dev/null)
  [ -n "$cfg" ] || return 0
  [ "$(jq -r '.paused // false' <<<"$cfg")" = true ] && return 0
  jq -e --argjson h "$(TZ=Asia/Seoul date +%-H)" '(.quiet_hours_kst // []) | index($h)' <<<"$cfg" >/dev/null && return 0
  every=$(jq -r '.tick_every_hours // 1' <<<"$cfg")
  now=$(date +%s); limit=$(( every * 3600 + TICK_GRACE_MIN * 60 ))
  runs=$(gh run list -R "$REPO" --workflow agent.yml --limit 100 --json displayTitle,createdAt 2>/dev/null) || return 0
  for r in $(jq -r '.tick_roles[]' <<<"$cfg"); do
    last=$(jq -r --arg p "$r · tick" '[.[] | select(.displayTitle | startswith($p)) | .createdAt] | max // empty' <<<"$runs")
    last_s=$began; [ -n "$last" ] && last_s=$(date -d "$last" +%s) && [ "$last_s" -lt "$began" ] && last_s=$began
    [ $(( now - last_s )) -lt "$limit" ] && continue
    if [ "${DRY_RUN:-}" = 1 ]; then echo "DISPATCH $r :: watchdog tick"
    else gh workflow run agent.yml -R "$REPO" -f role="$r" -f mode=tick -f context="정기 작업 (cron이 늦어 감시가 대신 깨움, 매 ${every}시간)" >/dev/null 2>&1 \
      && log "watchdog tick: $r (last tick ${last:-none})" || log "watchdog dispatch failed for $r"; fi
  done
}

# conversations.history; in wide mode follow next_cursor (max WIDE_MAX_PAGES) and merge pages into one object.
# Rate: Tier 3 (~50/min per method per app). Normal ticks = 1 call/conversation/15s. Wide = pages/conversation/5min.
# 11 conversations (6 channels + 5 DMs) spread over 5 tokens: ~2-3 conversations/token -> ~10 calls/min/token normal
# + at most ~3 x WIDE_MAX_PAGES / 5 per min for the wide scan, i.e. < 15/min/token even with 2 pages each.
WIDE_EVERY=${WIDE_EVERY_CYCLES:-20}; WIDE_DAYS=${WIDE_DAYS:-30}; WIDE_MAX_PAGES=${WIDE_MAX_PAGES:-5}
fetch_history() { # fetch_history <token> <channel> <oldest> <wide:0|1>
  local tok="$1" ch="$2" oldest="$3" wide="$4" page next="" acc='{"messages":[]}' q n=0
  while :; do
    q="channel=$ch&oldest=$oldest&limit=100"; [ "$wide" = 1 ] && q="channel=$ch&oldest=$oldest&limit=200"
    [ -n "$next" ] && q="$q&cursor=$next"
    page=$(slack "$tok" GET conversations.history "$q") || { [ "$n" = 0 ] && return 1; break; }
    acc=$(jq -c --argjson p "$page" '.messages += $p.messages' <<<"$acc")
    n=$((n + 1))
    [ "$wide" = 1 ] && [ "$n" -lt "$WIDE_MAX_PAGES" ] || break
    next=$(jq -r '.response_metadata.next_cursor // empty' <<<"$page")
    [ -n "$next" ] || break
  done
  printf '%s' "$acc"
}

# --- main loop ----------------------------------------------------------------------------------
began=$(date +%s); cycle=0; chained=0
# Queue the next listener job shortly before MAX so the handover gap stays small (cron alone left gaps up to ~3h).
# concurrency (cancel-in-progress: false) keeps it pending until this job ends; only one pending run exists at a time.
CHAIN_LEAD=${CHAIN_LEAD_SECONDS:-300}
chain_next() {
  [ "$chained" = 1 ] && return 0; chained=1
  if [ "${DRY_RUN:-}" = 1 ]; then echo "DISPATCH next listener job"; return 0; fi
  gh workflow run slack-listener.yml -R "$REPO" --ref main >/dev/null 2>&1 \
    && log "queued next listener job" || log "queueing next listener job failed (cron will take over)"
}
while [ $(( $(date +%s) - began )) -lt "$MAX" ]; do
  cycle=$((cycle + 1))
  [ $(( $(date +%s) - began )) -ge $(( MAX - CHAIN_LEAD )) ] && chain_next
  if [ $((cycle % 40)) = 0 ]; then   # ~10 min: honor team/schedule.json pause
    paused=$(gh api "repos/$REPO/contents/team/schedule.json" --jq .content 2>/dev/null | base64 -d 2>/dev/null | jq -r '.paused // false')
    [ "$paused" = true ] && { log "schedule paused; exiting"; exit 0; }
  fi
  [ $((cycle % 20)) = 0 ] && watchdog   # ~5 min
  # Normal tick: parents from the last 72h. Every WIDE_EVERY cycles (~5 min, same as the watchdog) widen to
  # WIDE_DAYS so replies on old parents (long CEO threads) are found via latest_reply, paging through history.
  if [ $((cycle % WIDE_EVERY)) = 0 ]; then since=$(( $(date +%s) - WIDE_DAYS * 86400 )); wide=1
  else since=$(( $(date +%s) - 259200 )); wide=0; fi
  for ch in "${!CH_NAME[@]}"; do
    tok=${CH_TOKEN[$ch]}; if [ "$wide" = 1 ]; then cur=${WIDE_CURSOR[$ch]}; else cur=${CURSOR[$ch]}; fi; newcur=$cur
    hist=$(fetch_history "$tok" "$ch" "$since" "$wide") || continue
    while read -r m; do
      [ -n "$m" ] || continue
      process "$ch" "$m" ""
    done < <(jq -c --arg c "$cur" '[.messages[] | select((.ts|tonumber) > ($c|tonumber))] | reverse | .[]' <<<"$hist")
    newcur=$(jq -r --arg c "$cur" '[.messages[].ts, .messages[].latest_reply // empty, $c] | max_by(tonumber)' <<<"$hist")
    for p in $(jq -r --arg c "$cur" '.messages[] | select(.latest_reply != null and (.latest_reply|tonumber) > ($c|tonumber)) | .ts' <<<"$hist"); do
      rep=$(slack "$tok" GET conversations.replies "channel=$ch&ts=$p&oldest=$cur&limit=200") || continue
      parent_user=$(jq -r --arg p "$p" '.messages[] | select(.ts == $p) | .user // ""' <<<"$rep")
      [ -n "$parent_user" ] || parent_user=$(jq -r --arg p "$p" '.messages[] | select(.ts == $p) | .user // ""' <<<"$hist")
      while read -r m; do
        [ -n "$m" ] || continue
        process "$ch" "$m" "$parent_user"
      done < <(jq -c --arg c "$cur" --arg p "$p" '.messages[] | select(.ts != $p and (.ts|tonumber) > ($c|tonumber))' <<<"$rep")
    done
    if [ "$wide" = 1 ]; then WIDE_CURSOR[$ch]=$newcur; else CURSOR[$ch]=$newcur; fi
  done
  flush
  sleep "$POLL"
done
log "max runtime reached; the next scheduled run takes over"
