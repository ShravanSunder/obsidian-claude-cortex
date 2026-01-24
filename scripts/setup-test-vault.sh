#!/bin/bash
# Creates a minimal test vault with cortex plugin installed

VAULT_PATH="${1:-/tmp/test-vault}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Setting up test vault at: $VAULT_PATH"
echo "Project root: $PROJECT_ROOT"

# Create vault structure
mkdir -p "$VAULT_PATH/.obsidian/plugins/cortex"
mkdir -p "$VAULT_PATH/.obsidian/plugins/hot-reload"

# Enable plugins
echo '["cortex", "hot-reload"]' > "$VAULT_PATH/.obsidian/community-plugins.json"

# Disable prompts and configure app
cat > "$VAULT_PATH/.obsidian/app.json" << 'EOF'
{"promptDelete": false, "alwaysUpdateLinks": true}
EOF

# Create .hotreload marker for cortex plugin
touch "$VAULT_PATH/.obsidian/plugins/cortex/.hotreload"

# Copy plugin files (if they exist)
if [[ -f "$PROJECT_ROOT/main.js" ]]; then
  cp "$PROJECT_ROOT/main.js" "$VAULT_PATH/.obsidian/plugins/cortex/"
  echo "Copied main.js"
fi
cp "$PROJECT_ROOT/manifest.json" "$VAULT_PATH/.obsidian/plugins/cortex/"
echo "Copied manifest.json"

if [[ -f "$PROJECT_ROOT/styles.css" ]]; then
  cp "$PROJECT_ROOT/styles.css" "$VAULT_PATH/.obsidian/plugins/cortex/"
  echo "Copied styles.css"
fi

# Install hot-reload plugin
if [[ ! -f "$VAULT_PATH/.obsidian/plugins/hot-reload/main.js" ]]; then
  echo "Installing hot-reload plugin..."
  git clone --depth 1 https://github.com/pjeby/hot-reload.git /tmp/hot-reload-tmp 2>/dev/null
  cp /tmp/hot-reload-tmp/main.js /tmp/hot-reload-tmp/manifest.json \
     "$VAULT_PATH/.obsidian/plugins/hot-reload/"
  rm -rf /tmp/hot-reload-tmp
  echo "hot-reload plugin installed"
fi

# Create test note
cat > "$VAULT_PATH/Test.md" << 'EOF'
# Test Note

This vault is for automated plugin testing.

## Test Content

- List item 1
- List item 2

```javascript
console.log("test code block");
```
EOF

# Pre-configure Obsidian to skip wizard
mkdir -p ~/.config/obsidian
VAULT_ID=$(echo -n "$VAULT_PATH" | md5sum | cut -c1-16)
cat > ~/.config/obsidian/obsidian.json << EOF
{
  "vaults": {"${VAULT_ID}": {"path": "${VAULT_PATH}", "ts": $(date +%s)000, "open": true}},
  "updateDisabled": true,
  "insider": false
}
EOF

echo ""
echo "Test vault created at: $VAULT_PATH"
echo "Obsidian config: ~/.config/obsidian/obsidian.json"
ls -la "$VAULT_PATH/.obsidian/plugins/"
