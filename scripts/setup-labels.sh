#!/usr/bin/env bash
# Creates/updates the team's GitHub labels. Usage: scripts/setup-labels.sh <owner/repo>
set -euo pipefail
R="${1:?owner/repo}"
mk() { gh label create "$1" -R "$R" --color "$2" --description "$3" --force >/dev/null && echo "label: $1"; }
mk role:pm 5319e7 "PM Noah"
mk role:design e99695 "디자이너 Luna"
mk role:fe 1d76db "프론트엔드 Theo"
mk role:be 0e8a16 "백엔드 Ben"
mk role:infra fbca04 "인프라 Sam"
mk role:qa d93f0b "QA Mia"
mk type:feature a2eeef "기능"
mk type:bug d73a4a "버그"
mk type:chore cfd3d7 "잡무"
mk type:adr 0052cc "ADR 작성 (L2 결정)"
mk type:meeting c5def5 "회의 액션 아이템"
mk prio:p0 b60205 "최우선"
mk prio:p1 d93f0b "높음"
mk prio:p2 fef2c0 "보통"
mk status:blocked 000000 "막힘"
mk ceo-decision ff0000 "진마씨 결정 필요 (L3)"
