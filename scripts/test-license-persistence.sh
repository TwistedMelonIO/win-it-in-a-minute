#!/bin/bash
# Win It In A Minute — license persistence auto-test.
#
# Verifies the dual-tier license persistence (docker volume + host backup)
# survives every destruction scenario short of a full Docker factory reset
# or simultaneous deletion of both tiers.
#
# Run with the container already up and a valid license active:
#     bash scripts/test-license-persistence.sh
#
# Exit 0 = all pass, 1 = at least one failure.
# T6 (reboot) and T8 (Docker factory reset) require human action and
# are intentionally NOT automated here.

set -u

CONTAINER="win-it-in-a-minute"
PORT=4000
HOST_BACKUP_DIR="$HOME/.twisted-melon/wiiam"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
DIM=$'\033[2m'
RESET=$'\033[0m'

PASS=0
FAIL=0
FAILURES=()

step() { echo ""; echo "${YELLOW}── $1${RESET}"; }
ok()   { echo "  ${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
bad()  { echo "  ${RED}✗${RESET} $1"; FAIL=$((FAIL + 1)); FAILURES+=("$1"); }

wait_for_app() {
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${PORT}/api/license_status" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

is_license_valid() {
  curl -s "http://localhost:${PORT}/api/license_status" 2>/dev/null \
    | python3 -c "import sys,json; print('YES' if json.load(sys.stdin).get('valid') else 'NO')" 2>/dev/null
}

verify_valid() {
  local label="$1"
  if ! wait_for_app; then bad "$label — app did not respond within 30s"; return 1; fi
  if [ "$(is_license_valid)" = "YES" ]; then ok "$label — license valid"; return 0
  else bad "$label — license INVALID after recovery"; return 1; fi
}

echo "${YELLOW}═════════════════════════════════════════════════"
echo "  Win It In A Minute — License Persistence Auto Test"
echo "═════════════════════════════════════════════════${RESET}"

step "Pre-check — baseline state"
if ! wait_for_app; then
  bad "App is not responding on port ${PORT}. Start it with: docker compose up -d"
  exit 1
fi
if [ "$(is_license_valid)" != "YES" ]; then
  bad "Baseline license is NOT valid. Activate a license before running this test."
  exit 1
fi
ok "App responding, baseline license is valid"

if [ ! -f "$HOST_BACKUP_DIR/license_key" ]; then
  bad "Host backup file missing: $HOST_BACKUP_DIR/license_key"
  echo ""
  echo "${RED}v3.5.0 dual-tier persistence is not active. Rebuild with the new code.${RESET}"
  exit 1
fi
ok "Host backup present at $HOST_BACKUP_DIR/"

cd "$PROJECT_DIR"

step "T1 — Container restart"
docker compose restart "$CONTAINER" > /dev/null 2>&1
verify_valid "T1"

step "T2 — Rebuild (docker compose up -d --build)"
docker compose up -d --build > /dev/null 2>&1
verify_valid "T2"

step "T3 — Force recreate without LICENSE_KEY env"
( unset LICENSE_KEY && docker compose up -d --force-recreate > /dev/null 2>&1 )
verify_valid "T3"

step "T4 — docker compose down -v (volume destroyed)"
docker compose down -v > /dev/null 2>&1
docker compose up -d > /dev/null 2>&1
verify_valid "T4"
if docker compose logs "$CONTAINER" 2>/dev/null | grep -q "Restored volume from host backup: license_key"; then
  ok "T4 — server logged 'Restored volume from host backup'"
else
  bad "T4 — expected log line 'Restored volume from host backup: license_key' not found"
fi

step "T5 — Delete host backup, then restart container"
rm -rf "$HOST_BACKUP_DIR"
docker compose restart "$CONTAINER" > /dev/null 2>&1
verify_valid "T5"
if [ -f "$HOST_BACKUP_DIR/license_key" ] && [ -f "$HOST_BACKUP_DIR/machine_id" ]; then
  ok "T5 — host backup repopulated from volume"
else
  bad "T5 — host backup was not repopulated"
fi

step "T7 — Bad license paste via web UI"
ORIGINAL_KEY=$(cat "$HOST_BACKUP_DIR/license_key" 2>/dev/null || echo "")
RESPONSE=$(curl -s -X POST "http://localhost:${PORT}/api/activate_license" \
  -H "Content-Type: application/json" \
  -d '{"license_key":"this-is-a-junk-string-not-a-real-key"}')
REJECTED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('YES' if not d.get('valid') else 'NO')" 2>/dev/null)
if [ "$REJECTED" = "YES" ]; then ok "T7 — bad key was rejected by validator"
else bad "T7 — bad key was NOT rejected (unexpected)"; fi
DISK_KEY=$(cat "$HOST_BACKUP_DIR/license_key" 2>/dev/null || echo "")
if [ -n "$ORIGINAL_KEY" ] && [ "$DISK_KEY" = "$ORIGINAL_KEY" ]; then
  ok "T7 — disk copy of license unchanged after bad paste"
else
  bad "T7 — disk copy was modified by a rejected key (clobber bug)"
fi
curl -sf -X POST "http://localhost:${PORT}/api/validate_license" > /dev/null 2>&1
verify_valid "T7 (post-revalidate)"

echo ""
echo "${YELLOW}═════════════════════════════════════════════════${RESET}"
TOTAL=$((PASS + FAIL))
if [ $FAIL -eq 0 ]; then
  echo "${GREEN}All ${PASS}/${TOTAL} checks passed.${RESET}"
  echo ""
  echo "Manual tests still required before rollout:"
  echo "  T6 — Mac mini reboot (auto-start)"
  echo "  T8 — Docker Desktop factory reset"
  exit 0
else
  echo "${RED}${FAIL} of ${TOTAL} checks FAILED:${RESET}"
  for f in "${FAILURES[@]}"; do echo "  ${RED}✗${RESET} $f"; done
  exit 1
fi
