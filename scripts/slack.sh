#!/usr/bin/env bash
# Slack helper for goblin-crew agents. Requires curl, jq and per-role bot tokens.
#
# Usage:
#   scripts/slack.sh --as <role> post <channel> <text|-> [--thread <ts>]   # prints message ts
#   scripts/slack.sh [--as <role>] history <channel> [limit=30] [oldest_ts] # newest last
#   scripts/slack.sh [--as <role>] thread <channel> <ts>
#   scripts/slack.sh --as <role> react <channel> <ts> <emoji-name>
#   scripts/slack.sh --as <role> upload <channel> <file> [comment] [--thread <ts>]
#   scripts/slack.sh permalink <channel> <ts>
#   scripts/slack.sh join-all                    # every member's bot joins all team channels
#   scripts/slack.sh ids                         # Slack user id of each member's bot
#
# <channel>: general | dev | meeting | decisions | ceo | github | ceo-dm  (or a raw channel ID)
#            ceo-dm = the DM between the CEO and <role>'s own bot (use with --as <role>).
# <role>:    pm | designer | frontend | backend | infra
# text "-" reads the message body from stdin (use for multi-line messages).
# Mentions in posted text: {CEO} -> the CEO, {@pm} {@designer} {@frontend} {@backend} {@infra} -> that member.
#
# Tokens: each member is a separate Slack app. Its bot token is in the env var named by
# team.json .roles.<role>.slack_token_env (e.g. SLACK_TOKEN_PM). Without --as, AGENT_ROLE's token
# is used. Legacy fallback: a single SLACK_BOT_TOKEN posting with a custom username/icon.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEAM="$ROOT/team/team.json"
ROLES=(pm designer frontend backend infra)
CEO_ID=$(jq -r '.ceo.slack_user_id' "$TEAM")

die() { echo "slack.sh: $*" >&2; exit 1; }

ROLE=""
if [ "${1:-}" = "--as" ]; then ROLE="${2:?role required}"; shift 2; fi
CMD="${1:-}"; shift || true

field() { jq -r --arg r "$1" --arg f "$2" '.roles[$r][$f] // empty' "$TEAM"; }
token_of() { local v; v=$(field "$1" slack_token_env); if [ -n "$v" ]; then printf "%s" "${!v:-}"; fi; }

# Pick the token for this invocation.
LEGACY=0
ACTOR="${ROLE:-${AGENT_ROLE:-}}"
TOKEN=""
[ -n "$ACTOR" ] && TOKEN=$(token_of "$ACTOR")
if [ -z "$TOKEN" ] && [ -z "$ROLE" ]; then
  for r in "${ROLES[@]}"; do TOKEN=$(token_of "$r"); [ -n "$TOKEN" ] && { ACTOR="$r"; break; }; done
fi
if [ -z "$TOKEN" ] && [ -n "${SLACK_BOT_TOKEN:-}" ]; then TOKEN="$SLACK_BOT_TOKEN"; LEGACY=1; fi
[ -n "$TOKEN" ] || [ "$CMD" = "join-all" ] || [ "$CMD" = "ids" ] || die "no Slack token for role '${ACTOR:-?}'"

api() { # api <method> <json-body> [token]
  local resp
  resp=$(curl -sS -X POST "https://slack.com/api/$1" \
    -H "Authorization: Bearer ${3:-$TOKEN}" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$2")
  [ "$(jq -r '.ok' <<<"$resp")" = "true" ] || die "$1 failed: $(jq -c '{error, needed, warning}' <<<"$resp")"
  printf '%s' "$resp"
}

api_get() { # api_get <method> <querystring> [token]
  local resp
  resp=$(curl -sS -G "https://slack.com/api/$1" -H "Authorization: Bearer ${3:-$TOKEN}" --data "$2")
  [ "$(jq -r '.ok' <<<"$resp")" = "true" ] || die "$1 failed: $(jq -c '{error, needed}' <<<"$resp")"
  printf '%s' "$resp"
}

channel_id() {
  local c="${1#\#}"; c="${c#goblin-}"
  if [ "$c" = "ceo-dm" ]; then
    api conversations.open "$(jq -n --arg u "$CEO_ID" '{users:$u}')" | jq -r '.channel.id'; return
  fi
  local id; id=$(jq -r --arg c "$c" '.slack_channels[$c] // empty' "$TEAM")
  if [ -n "$id" ]; then echo "$id"; elif [[ "$1" =~ ^[CGD][A-Z0-9]+$ ]]; then echo "$1"; else die "unknown channel: $1"; fi
}

member_uid() { # Slack user id of a member's bot (empty if that member has no token)
  local t; t=$(token_of "$1"); [ -n "$t" ] || return 0
  api auth.test '{}' "$t" | jq -r '.user_id'
}

# user id -> display name (members shown as "Noah (PM)", the CEO as "사장님")
declare -A UNAME
user_name() {
  local u="$1"
  if [ -z "${UNAME[$u]:-}" ]; then
    if [ "$u" = "$CEO_ID" ]; then UNAME[$u]="사장님"
    else
      local n; n=$(curl -sS -G https://slack.com/api/users.info -H "Authorization: Bearer $TOKEN" --data "user=$u" \
        | jq -r '(.user.profile.display_name | select(. != null and . != "")) // .user.real_name // .user.name // "unknown"')
      UNAME[$u]=$(pretty "$n")
    fi
  fi
  echo "${UNAME[$u]}"
}
pretty() { jq -r --arg n "$1" '([.roles[] | select(.name == $n) | .slack_username] | first) // $n' "$TEAM"; }

format_messages() { # stdin: messages array json (newest last)
  jq -c '.[]' | while read -r m; do
    local who ts text replies uid
    ts=$(jq -r '.ts' <<<"$m")
    who=$(jq -r '.username // .bot_profile.name // empty' <<<"$m")
    if [ -n "$who" ]; then who=$(pretty "$who")
    elif [ -n "$(jq -r '.user // empty' <<<"$m")" ]; then who=$(user_name "$(jq -r '.user' <<<"$m")")
    else who="bot"; fi
    replies=$(jq -r '.reply_count // 0' <<<"$m")
    text=$(jq -r '.text' <<<"$m")
    for uid in $(grep -o '<@[UW][A-Z0-9]*>' <<<"$text" | sort -u | tr -d '<@>'); do
      text="${text//<@$uid>/@$(user_name "$uid")}"
    done
    printf -- '--- ts=%s | %s%s\n%s\n' "$ts" "$who" "$( [ "$replies" != 0 ] && echo " | 스레드 답글 ${replies}개" )" "$text"
  done
}

expand_mentions() { # replace {CEO} and {@role} with real Slack mentions
  local t="$1" r uid
  t="${t//\{CEO\}/<@$CEO_ID>}"
  for r in "${ROLES[@]}"; do
    [[ "$t" == *"{@$r}"* ]] || continue
    uid=$(member_uid "$r")
    if [ -n "$uid" ]; then t="${t//\{@$r\}/<@$uid>}"; else t="${t//\{@$r\}/@$(field "$r" name)}"; fi
  done
  printf '%s' "$t"
}

case "$CMD" in
  post)
    [ -n "$ROLE" ] || die "post requires --as <role>"
    ch=$(channel_id "${1:?channel}"); text="${2:?text or -}"; shift 2
    thread=""; if [ "${1:-}" = "--thread" ]; then thread="${2:?ts}"; fi
    [ "$text" = "-" ] && text="$(cat)"
    text=$(expand_mentions "$text")
    body=$(jq -n --arg ch "$ch" --arg t "$text" --arg th "$thread" \
      '{channel:$ch, text:$t, unfurl_links:false} + (if $th != "" then {thread_ts:$th} else {} end)')
    if [ "$LEGACY" = 1 ]; then
      body=$(jq --arg u "$(field "$ROLE" slack_username)" --arg i "$(field "$ROLE" icon_emoji)" '. + {username:$u, icon_emoji:$i}' <<<"$body")
    fi
    api chat.postMessage "$body" | jq -r '.ts'
    ;;
  history)
    ch=$(channel_id "${1:?channel}"); limit="${2:-30}"; oldest="${3:-0}"
    api_get conversations.history "channel=$ch&limit=$limit&oldest=$oldest" | jq '.messages | reverse' | format_messages
    ;;
  thread)
    ch=$(channel_id "${1:?channel}"); ts="${2:?ts}"
    api_get conversations.replies "channel=$ch&ts=$ts&limit=200" | jq '.messages' | format_messages
    ;;
  react)
    ch=$(channel_id "${1:?channel}")
    api reactions.add "$(jq -n --arg c "$ch" --arg t "${2:?ts}" --arg n "${3:?emoji}" '{channel:$c, timestamp:$t, name:$n}')" >/dev/null
    echo ok
    ;;
  join-all)
    joined=0
    for r in "${ROLES[@]}"; do
      t=$(token_of "$r"); [ -n "$t" ] || { echo "skip $r (no token)"; continue; }
      for ch in $(jq -r '.slack_channels[]' "$TEAM"); do api conversations.join "$(jq -n --arg c "$ch" '{channel:$c}')" "$t" >/dev/null; done
      echo "joined: $r"; joined=1
    done
    if [ "$joined" = 0 ] && [ -n "${SLACK_BOT_TOKEN:-}" ]; then
      for ch in $(jq -r '.slack_channels[]' "$TEAM"); do api conversations.join "$(jq -n --arg c "$ch" '{channel:$c}')" "$SLACK_BOT_TOKEN" >/dev/null; done
      echo "joined: legacy bot"
    fi
    ;;
  ids)
    for r in "${ROLES[@]}"; do echo "$r $(field "$r" name) $(member_uid "$r")"; done
    ;;
  permalink)
    ch=$(channel_id "${1:?channel}")
    api_get chat.getPermalink "channel=$ch&message_ts=${2:?ts}" | jq -r '.permalink'
    ;;
  upload)
    [ -n "$ROLE" ] || die "upload requires --as <role>"
    ch=$(channel_id "${1:?channel}"); file="${2:?file}"; comment="${3:-}"; shift 2; [ $# -gt 0 ] && shift
    thread=""; if [ "${1:-}" = "--thread" ]; then thread="${2:?ts}"; fi
    [ -f "$file" ] || die "no such file: $file"
    size=$(wc -c <"$file"); name=$(basename "$file")
    up=$(api_get files.getUploadURLExternal "filename=$name&length=$size")
    curl -sS -F "file=@$file" "$(jq -r '.upload_url' <<<"$up")" >/dev/null
    comment=$(expand_mentions "$comment")
    if [ "$LEGACY" = 1 ]; then sig="$(field "$ROLE" signature)"; comment="${sig//\*\*/*} $comment"; fi
    body=$(jq -n --arg id "$(jq -r '.file_id' <<<"$up")" --arg ch "$ch" --arg c "$comment" --arg th "$thread" \
      '{files:[{id:$id}], channel_id:$ch, initial_comment:$c} + (if $th != "" then {thread_ts:$th} else {} end)')
    api files.completeUploadExternal "$body" >/dev/null
    echo ok
    ;;
  *)
    sed -n '2,23p' "$0"; exit 1 ;;
esac
