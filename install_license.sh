#!/bin/bash

# ============================================================
#  Win It In A Minute — License Installer
#  Drag this file into a Terminal window and press Enter.
# ============================================================

PROJECT_NAME="win-it-in-a-minute"
CONTAINER_NAME="win-it-in-a-minute"
WEB_PORT=4000
API_URL="http://localhost:${WEB_PORT}"

echo ""
echo "  ========================================"
echo "    Win It In A Minute - License Setup"
echo "  ========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect host hardware UUID and write to .env for stable machine ID
echo "  Detecting hardware ID..."
HW_UUID=""
if [ "$(uname)" = "Darwin" ]; then
    HW_UUID=$(ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null | awk -F'"' '/IOPlatformUUID/{print $4}')
elif [ -f /etc/machine-id ]; then
    HW_UUID=$(cat /etc/machine-id 2>/dev/null)
elif [ -f /var/lib/dbus/machine-id ]; then
    HW_UUID=$(cat /var/lib/dbus/machine-id 2>/dev/null)
fi

if [ -n "$HW_UUID" ]; then
    # Write/update HOST_HARDWARE_ID in .env (preserve other vars)
    ENV_FILE="$SCRIPT_DIR/.env"
    if [ -f "$ENV_FILE" ]; then
        # Remove old HOST_HARDWARE_ID line if present
        grep -v '^HOST_HARDWARE_ID=' "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true
        mv "$ENV_FILE.tmp" "$ENV_FILE"
    fi
    echo "HOST_HARDWARE_ID=$HW_UUID" >> "$ENV_FILE"
    echo "  Hardware ID locked: ${HW_UUID:0:8}..."
else
    echo "  Warning: Could not detect hardware UUID."
    echo "  Machine ID will fall back to container-based (not stable across reinstalls)."
fi
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "  Docker is not running!"
    echo "  Please start Docker Desktop and try again."
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
fi

# Build and start the container (without license first to get Machine ID)
echo "  Building and starting the container..."
echo ""

# Check if docker-compose.yml exists
if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    echo "  docker-compose.yml not found!"
    echo "  Make sure this script is in the project root."
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
fi

# Stop any existing container
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down 2>/dev/null

# Start without license to get machine ID
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build 2>&1

echo ""
echo "  Waiting for container to start..."
sleep 5

# Get the machine ID from the API
echo "  Retrieving Machine ID..."
MACHINE_ID=""
for i in {1..10}; do
    MACHINE_ID=$(curl -s "${API_URL}/api/license_status" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('machine_id',''))" 2>/dev/null)
    if [ -n "$MACHINE_ID" ]; then
        break
    fi
    sleep 2
done

if [ -z "$MACHINE_ID" ]; then
    echo "  Could not retrieve Machine ID."
    echo "  The container may still be starting up."
    echo "  Try running this script again in a moment."
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
fi

echo ""
echo "  ========================================"
echo "    YOUR MACHINE ID"
echo "  ========================================"
echo ""
echo "  $MACHINE_ID"
echo ""
echo "  ========================================"
echo ""

# Copy machine ID to clipboard if possible
echo "$MACHINE_ID" | pbcopy 2>/dev/null
if [ $? -eq 0 ]; then
    echo "  Machine ID has been copied to your clipboard!"
    echo ""
fi

echo "  Send this Machine ID to your license provider."
echo "  They will send you a license key."
echo ""
echo "  If you already have a license key, paste it below."
echo "  Otherwise, press Enter to skip for now."
echo ""
read -p "  License Key: " LICENSE_KEY

if [ -z "$LICENSE_KEY" ]; then
    echo ""
    echo "  No license key entered."
    echo "  The app is running at: ${API_URL}"
    echo "  Re-run this script when you have your license key."
    echo ""
    read -p "  Press Enter to exit..."
    exit 0
fi

# Stop the container and restart with the license key
echo ""
echo "  Applying license key..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down 2>/dev/null

# Set the LICENSE_KEY environment variable and restart
export LICENSE_KEY="$LICENSE_KEY"
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d 2>&1

echo ""
echo "  Waiting for container to start with license..."
sleep 5

# Verify the license
echo "  Verifying license..."
LICENSE_STATUS=""
for i in {1..10}; do
    LICENSE_STATUS=$(curl -s "${API_URL}/api/license_status" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('VALID' if d.get('valid') else d.get('error','UNKNOWN'))" 2>/dev/null)
    if [ -n "$LICENSE_STATUS" ]; then
        break
    fi
    sleep 2
done

echo ""
if [ "$LICENSE_STATUS" = "VALID" ]; then
    echo "  ========================================"
    echo "    LICENSE ACTIVATED SUCCESSFULLY!"
    echo "  ========================================"
    echo ""
    echo "  The app is now running at: ${API_URL}"
    echo ""

    # ── Docforge Export (always) ─────────────────────────────
    echo "  ── Certificate details ─────────────────"
    echo "  (press Enter to skip a field)"
    echo ""
    read -p "  Licensee name (e.g. MSC Poesia): " LICENSEE_NAME
    read -p "  Expiry days (blank = permanent): " EXPIRY_DAYS

    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S+00:00")
    DOCFORGE_FILE="$HOME/Desktop/win-it-in-a-minute-license.docforge"

    python3 -c "
import json, sys

data = {
    'docforge_version': '1.0',
    'type': 'license',
    'name': 'win-it-in-a-minute',
    'created_at': sys.argv[1],
    'updated_at': sys.argv[1],
    'data': {
        'project_id': 'win-it-in-a-minute',
        'machine_id': sys.argv[2],
        'licensee': sys.argv[3],
        'expiry_days': sys.argv[4] if sys.argv[4] else '',
        'license_key': sys.argv[5]
    }
}

with open(sys.argv[6], 'w') as f:
    json.dump(data, f, indent=2)
" "$TIMESTAMP" "$MACHINE_ID" "$LICENSEE_NAME" "$EXPIRY_DAYS" "$LICENSE_KEY" "$DOCFORGE_FILE"

    if [ -f "$DOCFORGE_FILE" ]; then
        echo ""
        echo "  ✓ Docforge file: $DOCFORGE_FILE"
    else
        echo ""
        echo "  ✗ Failed to create .docforge file."
    fi
else
    echo "  ========================================"
    echo "    LICENSE ACTIVATION FAILED"
    echo "  ========================================"
    echo ""
    echo "  Error: $LICENSE_STATUS"
    echo ""
    echo "  Please check your license key and try again."
fi

echo ""
read -p "  Press Enter to exit..."
