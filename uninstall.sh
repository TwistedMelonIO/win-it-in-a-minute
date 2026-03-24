#!/bin/bash

# ============================================================
#  Win It In A Minute — Uninstall
#  Removes all containers, images, volumes, and project files.
#  Drag this file into a Terminal window and press Enter.
# ============================================================

PROJECT_NAME="win-it-in-a-minute"

echo ""
echo "  ========================================"
echo "    Win It In A Minute - Uninstall"
echo "  ========================================"
echo ""
echo "  This will permanently remove:"
echo ""
echo "    - Docker container (win-it-in-a-minute)"
echo "    - Docker images"
echo "    - Docker volumes (license, settings)"
echo "    - The win-it-in-a-minute project folder"
echo ""
echo "  This cannot be undone."
echo ""
read -p "  Type YES to confirm: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo ""
    echo "  Uninstall cancelled."
    echo ""
    read -p "  Press Enter to exit..."
    exit 0
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  Stopping containers..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down 2>/dev/null

echo "  Removing Docker images..."
docker rmi win-it-in-a-minute-win-it-in-a-minute 2>/dev/null

echo "  Removing Docker volumes..."
docker volume rm win-it-in-a-minute_wiiam-data 2>/dev/null

echo "  Removing project folder..."
rm -rf "$SCRIPT_DIR"

echo ""
echo "  ========================================"
echo "    UNINSTALL COMPLETE"
echo "  ========================================"
echo ""
echo "  Win It In A Minute has been removed from"
echo "  this machine."
echo ""
echo "  To reinstall, visit:"
echo "  https://github.com/TwistedMelonIO/win-it-in-a-minute"
echo ""
read -p "  Press Enter to exit..."
