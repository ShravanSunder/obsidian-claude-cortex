#!/bin/bash
# Launches Obsidian headlessly with CDP enabled

export DISPLAY="${DISPLAY:-:99}"
VAULT_PATH="${VAULT_PATH:-/tmp/test-vault}"
CDP_PORT="${CDP_PORT:-9222}"
OBSIDIAN="${OBSIDIAN:-/usr/local/bin/obsidian}"

echo "=== Obsidian Test Environment ==="
echo "DISPLAY=$DISPLAY"
echo "VAULT_PATH=$VAULT_PATH"
echo "CDP_PORT=$CDP_PORT"
echo ""

# Verify Xvfb is running
if ! pgrep -x Xvfb > /dev/null; then
  echo "Warning: Xvfb not running. Starting..."
  Xvfb :99 -screen 0 1920x1080x24 &
  sleep 2
fi

# Check Obsidian exists
if [[ ! -f "$OBSIDIAN" ]]; then
  echo "Error: Obsidian not found at $OBSIDIAN"
  exit 1
fi

# Check vault exists
if [[ ! -d "$VAULT_PATH" ]]; then
  echo "Error: Vault not found at $VAULT_PATH"
  echo "Run scripts/setup-test-vault.sh first"
  exit 1
fi

# Kill existing Obsidian
if pgrep -f "Obsidian" > /dev/null; then
  echo "Stopping existing Obsidian..."
  pkill -f "Obsidian" 2>/dev/null || true
  sleep 2
fi

# Launch Obsidian with remote debugging
echo "Starting Obsidian..."
"$OBSIDIAN" \
  --remote-debugging-port="$CDP_PORT" \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  "$VAULT_PATH" &

OBSIDIAN_PID=$!
echo "Obsidian PID: $OBSIDIAN_PID"

# Wait for CDP to be ready
echo "Waiting for CDP endpoint..."
for i in {1..30}; do
  if curl -s "http://localhost:$CDP_PORT/json/version" > /dev/null 2>&1; then
    echo ""
    echo "=== CDP Ready ==="
    curl -s "http://localhost:$CDP_PORT/json/version" | head -5
    echo ""
    echo "Obsidian is running!"
    echo "CDP endpoint: http://localhost:$CDP_PORT"
    exit 0
  fi
  echo -n "."
  sleep 1
done

echo ""
echo "Error: CDP endpoint not ready after 30s"
echo "Check if Obsidian started correctly"
exit 1
