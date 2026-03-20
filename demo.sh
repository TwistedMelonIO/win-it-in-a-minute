#!/bin/bash
# ==============================================
# WIN IT IN A MINUTE V2 — CONTINUOUS DEMO
# ==============================================
# Open http://localhost:4000 in a browser and
# start screen recording before running this.
# Press Ctrl+C to stop.
# ==============================================

API="http://localhost:4000/api"

score() {
  curl -s -X POST "$API/update-score" \
    -H "Content-Type: application/json" \
    -d "{\"team\":\"$1\",\"delta\":$2}" > /dev/null
}

reset() {
  curl -s -X POST "$API/reset" > /dev/null
}

trap 'echo ""; echo "🛑 Demo stopped."; exit 0' INT

echo "🎬 WIIAM V2 Demo — Continuous mode"
echo "   Scores will change every 2 seconds."
echo "   Press Ctrl+C to stop."
echo ""

reset
sleep 2

TEAMS=("red" "blue")

while true; do
  TEAM=${TEAMS[$((RANDOM % 2))]}

  # 70% chance increase, 30% chance decrease
  if (( RANDOM % 10 < 7 )); then
    DELTA=1
    ARROW="▲"
  else
    DELTA=-1
    ARROW="▼"
  fi

  STATE=$(curl -s "$API/state")
  RED=$(echo "$STATE" | grep -o '"redScore":[0-9]*' | grep -o '[0-9]*')
  BLUE=$(echo "$STATE" | grep -o '"blueScore":[0-9]*' | grep -o '[0-9]*')

  # Don't decrease below 0
  if (( DELTA == -1 )); then
    if [[ "$TEAM" == "red" && "$RED" -le 0 ]]; then
      DELTA=1
      ARROW="▲"
    elif [[ "$TEAM" == "blue" && "$BLUE" -le 0 ]]; then
      DELTA=1
      ARROW="▲"
    fi
  fi

  score "$TEAM" "$DELTA"

  # Fetch updated state
  STATE=$(curl -s "$API/state")
  RED=$(echo "$STATE" | grep -o '"redScore":[0-9]*' | grep -o '[0-9]*')
  BLUE=$(echo "$STATE" | grep -o '"blueScore":[0-9]*' | grep -o '[0-9]*')

  if [[ "$TEAM" == "red" ]]; then
    echo "🔴 Red $ARROW  →  RED $RED — BLUE $BLUE"
  else
    echo "🔵 Blue $ARROW  →  RED $RED — BLUE $BLUE"
  fi

  sleep 2
done
