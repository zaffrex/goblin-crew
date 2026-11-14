#!/usr/bin/env bash
# Slack helper for goblin-crew agents. Requires SLACK_BOT_TOKEN, curl, jq.
#
# Usage:
#   scripts/slack.sh --as <role> post <channel> <text|-> [--thread <ts>]   # prints message ts
#   scripts/slack.sh history <channel> [limit=30] [oldest_ts]              # newest last
#   scripts/slack.sh thread <channel> <ts>
#   scripts/slack.sh react <channel> <ts> <emoji-name>
#   scripts/slack.sh --as <role> upload <channel> <file> [comment] [--thread <ts>]
#   scripts/slack.sh permalink <channel> <ts>
#   scripts/slack.sh join-all                                              # bot joins all team channels
#
# <channel>: general | dev | meeting | decisions | ceo | github  (or a raw channel ID)
# <role>:    pm | designer | frontend | backend | infra
# text "-" reads the message body from stdin (use for multi-line messages).
# Mention the CEO with the literal token {CEO}; it is replaced by a real Slack mention.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEAM="$ROOT/team/team.json"
: "${SLACK_BOT_TOKEN:?SLACK_BOT_TOKEN is not set}"

die() { echo "slack.sh: $*" >&2; exit 1; }

api() { # api <method> <json-body>
  local method="$1" body="$2" resp
  resp=$(curl -sS -X POST "https://slack.com/api/$method" \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$body")
  if [ "$(jq -r '.ok' <<<"$resp")" != "true" ]; then
    die "$method failed: $(jq -c '{error, needed, warning}' <<<"$resp")"
  fi
  printf '%s' "$resp"
}

api_get() { # api_get <method> <querystring>
  local resp
  resp=$(curl -sS -G "https://slack.com/api/$1" -H "Authorization: Bearer $SLACK_BOT_TOKEN" --data "$2")
  [ "$(jq -r '.ok' <<<"$resp")" = "true" ] || die "$1 failed: $(jq -c '{error, needed}' <<<"$resp")"
  printf '%s' "$resp"
}

channel_id() {
  local c="${1#\#}"; c="${c#goblin-}"
  local id; id=$(jq -r --arg c "$c" '.slack_channels[$c] // empty' "$TEAM")
  if [ -n "$id" ]; then echo "$id"; elif [[ "$1" =~ ^[CG][A-Z0-9]+$ ]]; then echo "$1"; else die "unknown channel: $1"; fi
}

ROLE=""
if [ "${1:-}" = "--as" ]; then ROLE="${2:?role required}"; shift 2; fi
CMD="${1:-}"; shift || true

role_field() { jq -r --arg r "$ROLE" --arg f "$1" '.roles[$r][$f] // empty' "$TEAM"; }

# Cache of user id -> display name for history output
declare -A UNAME
user_name() {
  local u="$1"
  if [ -z "${UNAME[$u]:-}" ]; then
    local ceo; ceo=$(jq -r '.ceo.slack_user_id' "$TEAM")
    if [ "$u" = "$ceo" ]; then UNAME[$u]="사장님"
    else UNAME[$u]=$(curl -sS -G https://slack.com/api/users.info -H "Authorization: Bearer $SLACK_BOT_TOKEN" --data "user=$u" | jq -r '.user.real_name // .user.name // "unknown"'); fi
  fi
  echo "${UNAME[$u]}"
}

format_messages() { # stdin: messages array json (newest last)
  local ceo; ceo=$(jq -r '.ceo.slack_user_id' "$TEAM")
  jq -c '.[]' | while read -r m; do
    local who ts text replies
    ts=$(jq -r '.ts' <<<"$m")
    if [ "$(jq -r '.username // empty' <<<"$m")" != "" ]; then who=$(jq -r '.username' <<<"$m")
    elif [ "$(jq -r '.user // empty' <<<"$m")" != "" ]; then who=$(user_name "$(jq -r '.user' <<<"$m")")
    else who=$(jq -r '.bot_profile.name // "bot"' <<<"$m"); fi
    replies=$(jq -r '.reply_count // 0' <<<"$m")
    text=$(jq -r '.text' <<<"$m" | sed "s/<@$ceo>/@사장님/g")
    printf -- '--- ts=%s | %s%s\n%s\n' "$ts" "$who" "$( [ "$replies" != 0 ] && echo " | 스레드 답글 ${replies}개" )" "$text"
  done
}

case "$CMD" in
  post)
    [ -n "$ROLE" ] || die "post requires --as <role>"
    ch=$(channel_id "${1:?channel}"); text="${2:?text or -}"; shift 2
    thread=""; if [ "${1:-}" = "--thread" ]; then thread="${2:?ts}"; fi
    [ "$text" = "-" ] && text="$(cat)"
    ceo=$(jq -r '.ceo.slack_user_id' "$TEAM")
    text="${text//\{CEO\}/<@$ceo>}"
    body=$(jq -n --arg ch "$ch" --arg t "$text" --arg u "$(role_field slack_username)" \
      --arg i "$(role_field icon_emoji)" --arg th "$thread" \
      '{channel:$ch, text:$t, username:$u, icon_emoji:$i, unfurl_links:false} + (if $th != "" then {thread_ts:$th} else {} end)')
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
    for ch in $(jq -r '.slack_channels[]' "$TEAM"); do
      api conversations.join "$(jq -n --arg c "$ch" '{channel:$c}')" >/dev/null && echo "joined $ch"
    done
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
    sig="$(role_field signature)"
    body=$(jq -n --arg id "$(jq -r '.file_id' <<<"$up")" --arg ch "$ch" --arg c "${sig//\*\*/*} $comment" --arg th "$thread" \
      '{files:[{id:$id}], channel_id:$ch, initial_comment:$c} + (if $th != "" then {thread_ts:$th} else {} end)')
    api files.completeUploadExternal "$body" >/dev/null
    echo ok
    ;;
  *)
    sed -n '2,15p' "$0"; exit 1 ;;
esac
