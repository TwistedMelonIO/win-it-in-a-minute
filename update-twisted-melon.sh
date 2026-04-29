#!/bin/bash
# Twisted Melon — bulk docker updater for demo / venue machines.
#
# Run once on each machine to install OR update Chart Toppers, Win It In
# A Minute, and DocForge. Idempotent: clones missing repos, pulls existing
# ones, then rebuilds the docker containers.
#
# Usage:
#     bash <(curl -fsSL https://raw.githubusercontent.com/TwistedMelonIO/win-it-in-a-minute/main/update-twisted-melon.sh)
# OR (offline / from a clone):
#     bash update-twisted-melon.sh
#
# License keys are NOT touched — they persist via the dual-tier system
# (docker volume + ~/.twisted-melon/<project>/ host backup).

set -e

GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
RESET=$'\033[0m'

ORG="TwistedMelonIO"
PROJECTS=(chart-toppers win-it-in-a-minute docforge)

# Map repo → host-backup directory name (for license persistence)
declare -A BACKUP_DIRS=(
  [chart-toppers]="chart-toppers"
  [win-it-in-a-minute]="wiiam"
  [docforge]=""   # docforge has no license gate
)

echo ""
echo "${YELLOW}╔════════════════════════════════════════════════════╗"
echo "║  Twisted Melon — Docker Updater                    ║"
echo "╚════════════════════════════════════════════════════╝${RESET}"

# Sanity checks
if ! command -v docker > /dev/null; then
  echo "${RED}✗ Docker not installed. Install Docker Desktop first.${RESET}" >&2
  exit 1
fi
if ! docker info > /dev/null 2>&1; then
  echo "${RED}✗ Docker daemon not running. Start Docker Desktop and try again.${RESET}" >&2
  exit 1
fi
if ! command -v git > /dev/null; then
  echo "${RED}✗ git not installed.${RESET}" >&2
  exit 1
fi

cd ~

for repo in "${PROJECTS[@]}"; do
  echo ""
  echo "${YELLOW}── $repo ──────────────────────────────${RESET}"

  # Ensure host-backup dir exists for projects that need it
  backup="${BACKUP_DIRS[$repo]}"
  if [ -n "$backup" ]; then
    mkdir -p ~/.twisted-melon/"$backup"
  fi

  if [ ! -d ~/"$repo"/.git ]; then
    echo "  Cloning $repo..."
    git clone --quiet "https://github.com/$ORG/$repo.git" ~/"$repo"
  else
    echo "  Pulling latest..."
    git -C ~/"$repo" pull --ff-only --quiet || {
      echo "${RED}  ✗ git pull failed in ~/$repo — resolve manually.${RESET}" >&2
      continue
    }
  fi

  echo "  Rebuilding container..."
  ( cd ~/"$repo" && docker compose up -d --build > /dev/null 2>&1 ) || {
    echo "${RED}  ✗ docker compose failed in ~/$repo${RESET}" >&2
    continue
  }

  # Show resulting version (best-effort)
  ver=$(grep -m1 '"version"' ~/"$repo"/package.json 2>/dev/null | sed -E 's/.*"version": *"([^"]+)".*/\1/')
  if [ -z "$ver" ]; then
    ver=$(grep -m1 'version="' ~/"$repo"/src/api.py 2>/dev/null | sed -E 's/.*version="([^"]+)".*/\1/')
  fi
  echo "  ${GREEN}✓ $repo${RESET}${ver:+ → v$ver} updated"
done

echo ""
echo "${GREEN}╔════════════════════════════════════════════════════╗"
echo "║  All Twisted Melon dockers updated.                ║"
echo "╚════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "Web UIs:"
echo "  • Chart Toppers       → http://localhost:3200"
echo "  • Win It In A Minute  → http://localhost:4000"
echo "  • DocForge            → http://localhost:8899"
echo ""
echo "Verify license persistence on each show:"
echo "  cd ~/chart-toppers && bash scripts/test-all.sh"
echo "  cd ~/win-it-in-a-minute && bash scripts/test-all.sh"
