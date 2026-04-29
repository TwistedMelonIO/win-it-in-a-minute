#!/bin/bash
# Win It In A Minute — full auto-test suite.
#
# Runs every automated test in order. Currently the suite is just license
# persistence; future test scripts can be appended here.
#
# Usage:
#     bash scripts/test-all.sh
#
# Exit 0 = all suites passed, 1 = at least one failed.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

cd "$PROJECT_DIR"

echo ""
echo "${YELLOW}╔════════════════════════════════════════════════════╗"
echo "║  Win It In A Minute — Full Auto-Test Suite         ║"
echo "╚════════════════════════════════════════════════════╝${RESET}"

# ── Suite 1: License persistence ────────────────────────────────
echo ""
echo "${YELLOW}▶ Suite 1/1 — License persistence${RESET}"
if ! bash "$SCRIPT_DIR/test-license-persistence.sh"; then
  echo ""
  echo "${RED}✗ License persistence suite FAILED.${RESET}"
  echo "${RED}  Do not roll out — fix license persistence first.${RESET}"
  exit 1
fi

# ── All passed ──────────────────────────────────────────────────
echo ""
echo "${GREEN}╔════════════════════════════════════════════════════╗"
echo "║  All automated test suites passed.                 ║"
echo "╚════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "Manual rollout checks still required:"
echo "  • Mac mini reboot (auto-start)"
echo "  • Docker Desktop factory reset (optional)"
exit 0
