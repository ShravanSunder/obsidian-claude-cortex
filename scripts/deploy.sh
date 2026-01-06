#!/bin/bash
#
# Deploy Cortex plugin to Obsidian vault
#
# Usage:
#   OBSIDIAN_VAULT_PATH=/path/to/vault ./scripts/deploy.sh
#
# Environment Variables:
#   OBSIDIAN_VAULT_PATH - Path to Obsidian vault root (required)
#   SKIP_BUILD          - Set to "true" to skip build step (optional)
#
# Example:
#   export OBSIDIAN_VAULT_PATH="$HOME/Documents/my-vault"
#   ./scripts/deploy.sh
#

set -e

# Check for required environment variable
if [[ -z "$OBSIDIAN_VAULT_PATH" ]]; then
    echo "Error: OBSIDIAN_VAULT_PATH environment variable is not set"
    echo ""
    echo "Usage: OBSIDIAN_VAULT_PATH=/path/to/vault ./scripts/deploy.sh"
    echo ""
    echo "Example:"
    echo "  export OBSIDIAN_VAULT_PATH=\"\$HOME/Documents/my-vault\""
    echo "  ./scripts/deploy.sh"
    exit 1
fi

# Construct plugin destination path
INSTALL_DEST="$OBSIDIAN_VAULT_PATH/.obsidian/plugins/cortex"

# Verify vault path exists
if [[ ! -d "$OBSIDIAN_VAULT_PATH" ]]; then
    echo "Error: Vault path does not exist: $OBSIDIAN_VAULT_PATH"
    exit 1
fi

# Create plugin directory if it doesn't exist
if [[ ! -d "$INSTALL_DEST" ]]; then
    echo "Creating plugin directory: $INSTALL_DEST"
    mkdir -p "$INSTALL_DEST"
fi

# Build unless skipped
if [[ "$SKIP_BUILD" != "true" ]]; then
    echo "Building Cortex..."
    pnpm run build
else
    echo "Skipping build (SKIP_BUILD=true)"
fi

# Verify build artifacts exist
if [[ ! -f "main.js" ]] || [[ ! -f "manifest.json" ]] || [[ ! -f "styles.css" ]]; then
    echo "Error: Build artifacts not found. Run 'pnpm run build' first."
    exit 1
fi

# Deploy
echo "Deploying to $INSTALL_DEST..."
cp main.js manifest.json styles.css "$INSTALL_DEST/"

echo "Done! Reload Obsidian to see changes."
